'use strict';
// ================= 얼음왕관의 시련 서버 =================
// 정적 파일 + 계정 · 게임 경제(server/game.js) · 건의사항 API. 외부 의존성 없이 Node 내장 모듈(node:sqlite)만 사용.
// 재화와 아이템은 서버만 바꾼다 — 브라우저는 결과를 받아 보여줄 뿐이다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = +process.env.PORT || 8080;
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const ADMINS = new Set((process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const SESSION_TTL = 90 * 86400 * 1000; // 마지막 사용 후 90일
const STATUSES = ['open', 'planned', 'done', 'rejected'];
const CORS_ORIGINS = new Set((process.env.CORS_ORIGINS || 'https://icecrown-trial.duckdns.org').split(',').map(s => s.trim()).filter(Boolean));

const db = require('./db')(DATA_DIR);

// ---------- 유틸 ----------
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const hashPw = pw => {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
};
const checkPw = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const got = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 32);
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex'));
};

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

// IP/사용자별 간단한 요청 제한 (메모리, 재시작 시 초기화)
const buckets = new Map();
const limit = (key, max, windowMs) => {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  if (++b.n > max) fail(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
};
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 600000).unref();

const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

const readJson = req => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', c => {
    size += c.length;
    if (size > 32768) { reject(new HttpError(413, '요청이 너무 큽니다.')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (!chunks.length) return resolve({});
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, '잘못된 요청입니다.')); }
  });
  req.on('error', reject);
});

const send = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
};

// ---------- 인증 ----------
const newSession = userId => {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, last_seen) VALUES (?, ?, ?)').run(sha256(token), userId, Date.now());
  return token;
};
const userInfo = username => ({ username, admin: ADMINS.has(username.toLowerCase()) });
const authUser = req => {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const th = sha256(m[1]);
  const row = db.prepare(`SELECT s.last_seen, u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(th);
  if (!row) return null;
  if (Date.now() - row.last_seen > SESSION_TTL) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(th); return null; }
  db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(Date.now(), th);
  return { id: row.id, info: userInfo(row.username), tokenHash: th };
};
const requireUser = req => authUser(req) || fail(401, '로그인이 필요합니다.');

const validName = n => typeof n === 'string' && /^[A-Za-z0-9가-힣_]{2,16}$/.test(n);
const validPw = p => typeof p === 'string' && p.length >= 4 && p.length <= 64;

// ---------- 라우팅 ----------
// fn(req, user, url, params). opts.auth: 로그인 필수 (아니면 user는 null일 수 있음)
const routes = [];
const route = (method, pattern, fn, opts = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:\w+/g, '(\\d+)') + '$'), fn, opts });

const game = require('./game')({ db, route, fail, requireUser, limit, readJson, STATIC_DIR, log: (...a) => console.warn(...a) });

route('POST', '/api/auth/register', async req => {
  limit('reg:' + clientIp(req), 30, 3600000);
  const { username, password } = await readJson(req);
  if (!validName(username)) fail(400, '아이디는 2~16자의 한글/영문/숫자/_ 만 쓸 수 있습니다.');
  if (!validPw(password)) fail(400, '비밀번호는 4~64자로 입력하세요.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) fail(409, '이미 사용 중인 아이디입니다.');
  return db.tx(() => {
    const r = db.prepare('INSERT INTO users (username, pw_hash, created_at) VALUES (?, ?, ?)').run(username, hashPw(password), Date.now());
    const uid = Number(r.lastInsertRowid);
    game.onRegister(uid);
    return { token: newSession(uid), user: userInfo(username), profile: game.getProfile(uid) };
  });
});

route('POST', '/api/auth/login', async req => {
  limit('login:' + clientIp(req), 20, 600000);
  const { username, password } = await readJson(req);
  const u = typeof username === 'string' && db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || typeof password !== 'string' || !checkPw(password, u.pw_hash)) fail(401, '아이디 또는 비밀번호가 틀렸습니다.');
  game.onRegister(u.id); // 예전 계정에 기본 캐릭터가 없으면 만든다
  return { token: newSession(u.id), user: userInfo(u.username), profile: game.getProfile(u.id) };
});

route('POST', '/api/auth/logout', async (req, u) => {
  if (u) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(u.tokenHash);
  return { ok: true };
});

// ---------- 건의사항 ----------
route('GET', '/api/suggestions', async (req, u, url) => {
  const sort = url.searchParams.get('sort') === 'top' ? 'votes DESC, s.id DESC' : 's.id DESC';
  const offset = Math.max(0, Math.floor(+url.searchParams.get('offset') || 0));
  const PAGE = 20;
  const rows = db.prepare(`
    SELECT s.id, s.title, s.body, s.status, s.created_at, us.username AS author,
      (SELECT COUNT(*) FROM votes v WHERE v.suggestion_id = s.id) AS votes,
      EXISTS(SELECT 1 FROM votes v WHERE v.suggestion_id = s.id AND v.user_id = ?) AS voted
    FROM suggestions s JOIN users us ON us.id = s.user_id
    ORDER BY ${sort} LIMIT ? OFFSET ?`).all(u ? u.id : -1, PAGE + 1, offset);
  const items = rows.slice(0, PAGE).map(r => ({
    ...r, voted: !!r.voted,
    mine: !!u && r.author.toLowerCase() === u.info.username.toLowerCase(),
  }));
  return { items, more: rows.length > PAGE };
});

route('POST', '/api/suggestions', async (req, u) => {
  limit('post:' + u.id, 10, 3600000);
  const { title, body } = await readJson(req);
  const t = typeof title === 'string' ? title.trim() : '', b = typeof body === 'string' ? body.trim() : '';
  if (t.length < 2 || t.length > 80) fail(400, '제목은 2~80자로 입력하세요.');
  if (b.length < 2 || b.length > 2000) fail(400, '내용은 2~2000자로 입력하세요.');
  const r = db.prepare('INSERT INTO suggestions (user_id, title, body, created_at) VALUES (?, ?, ?, ?)').run(u.id, t, b, Date.now());
  return { id: Number(r.lastInsertRowid) };
}, { auth: true });

route('POST', '/api/suggestions/:id/vote', async (req, u, url, [id]) => {
  if (!db.prepare('SELECT 1 FROM suggestions WHERE id = ?').get(id)) fail(404, '글을 찾을 수 없습니다.');
  const had = db.prepare('DELETE FROM votes WHERE suggestion_id = ? AND user_id = ?').run(id, u.id).changes > 0;
  if (!had) db.prepare('INSERT INTO votes (suggestion_id, user_id) VALUES (?, ?)').run(id, u.id);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM votes WHERE suggestion_id = ?').get(id);
  return { votes: n, voted: !had };
}, { auth: true });

route('PATCH', '/api/suggestions/:id', async (req, u, url, [id]) => {
  if (!u.info.admin) fail(403, '관리자만 상태를 바꿀 수 있습니다.');
  const { status } = await readJson(req);
  if (!STATUSES.includes(status)) fail(400, '알 수 없는 상태입니다.');
  if (!db.prepare('UPDATE suggestions SET status = ? WHERE id = ?').run(status, id).changes) fail(404, '글을 찾을 수 없습니다.');
  return { ok: true };
}, { auth: true });

route('DELETE', '/api/suggestions/:id', async (req, u, url, [id]) => {
  const s = db.prepare('SELECT user_id FROM suggestions WHERE id = ?').get(id) || fail(404, '글을 찾을 수 없습니다.');
  if (s.user_id !== u.id && !u.info.admin) fail(403, '본인 글만 삭제할 수 있습니다.');
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(id);
  return { ok: true };
}, { auth: true });

// ---------- 정적 파일 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PUBLIC = /^\/(index\.html|(css|js|assets)\/[\w\-./]+)$/; // 이 경로 외에는 서빙하지 않음 (server/, data/, .git 등 노출 방지)

const serveStatic = (req, res, pathname) => {
  if (pathname === '/') pathname = '/index.html';
  if (!PUBLIC.test(pathname) || pathname.includes('..')) { res.writeHead(404); return res.end('Not found'); }
  const file = path.join(STATIC_DIR, pathname);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // 코드는 항상 최신으로, 아이콘은 하루 캐시
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    return serveStatic(req, res, p);
  }
  // 공개 주소(GitHub Pages)에서 연 화면이 이 서버의 API를 부를 수 있게 허용 (그 출처만)
  if (CORS_ORIGINS.has(req.headers.origin)) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  try {
    for (const r of routes) {
      const m = r.method === req.method && r.re.exec(url.pathname);
      if (!m) continue;
      const u = r.opts.auth ? requireUser(req) : authUser(req);
      return send(res, 200, await r.fn(req, u, url, m.slice(1).map(Number)));
    }
    fail(404, '알 수 없는 요청입니다.');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: '서버 오류가 발생했습니다.' });
  }
}).listen(PORT, () => console.log(`zzigame server on :${PORT} (static: ${STATIC_DIR}, data: ${DATA_DIR})`));

// 배포 시 docker stop(SIGTERM): 새 연결은 받지 않고, 처리 중인 요청은 마친 뒤 DB를 닫고 종료한다.
// (docker의 기본 유예 10초 안에 끝나도록 8초 뒤에는 강제 종료)
const shutdown = sig => {
  console.log(`${sig}: 종료 중`);
  server.close(() => { try { db.close(); } catch { /* 이미 닫힘 */ } process.exit(0); });
  server.closeIdleConnections();
  setTimeout(() => process.exit(0), 8000).unref();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
