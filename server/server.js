'use strict';
// ================= 얼음왕관의 시련 서버 =================
// 정적 파일 + 계정/재화/특성/런/건의사항 API. 외부 의존성 없이 Node 내장 모듈(node:sqlite)만 사용.
// 재화와 특성은 서버만 바꾼다 — 브라우저는 결과를 받아 보여줄 뿐이다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = +process.env.PORT || 8080;
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const ADMINS = new Set((process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const SESSION_TTL = 90 * 86400 * 1000; // 마지막 사용 후 90일
const STATUSES = ['open', 'planned', 'done', 'rejected'];
// 브라우저와 같은 정의 파일을 읽는다 (비용 계산/검증용)
const TALENTS = require(path.join(STATIC_DIR, 'js', 'data', 'talents.js'));
const CLASSES = ['mage'];
const STAGES = { icecrown: { duration: 900, victoryGold: 500 } };
// 런 보고 검증 한도 — 정상 플레이 최고치(골드 0.8/초, 처치 8.5/초, 2026-10 시뮬레이션)의 여유분
const RUN_LIMITS = { goldPerSec: 4, goldFlat: 300, killsPerSec: 30, killsFlat: 200, clockSlack: 1.1, clockFlat: 20 };

// ---------- DB ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pw_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_seen INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS votes (
    suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (suggestion_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS wallets (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, currency)
  );
  CREATE TABLE IF NOT EXISTS talent_ranks (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    node TEXT NOT NULL,
    rank INTEGER NOT NULL,
    PRIMARY KEY (user_id, scope, node)
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    best_time REAL NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cls TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    t REAL NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    gold REAL NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    victory INTEGER NOT NULL DEFAULT 0,
    time_bonus REAL,
    paid INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS runs_user ON runs (user_id, started_at);
`);

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

// 여러 쓰기를 하나로 묶는다 (중간에 실패하면 전부 취소)
const tx = fn => {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
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
const authUser = req => {
  const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const th = sha256(m[1]);
  const row = db.prepare(`SELECT s.last_seen, u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(th);
  if (!row) return null;
  if (Date.now() - row.last_seen > SESSION_TTL) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(th); return null; }
  db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(Date.now(), th);
  return { id: row.id, username: row.username, admin: ADMINS.has(row.username.toLowerCase()), tokenHash: th };
};
const requireUser = req => authUser(req) || fail(401, '로그인이 필요합니다.');

const validName = n => typeof n === 'string' && /^[A-Za-z0-9가-힣_]{2,16}$/.test(n);
const validPw = p => typeof p === 'string' && p.length >= 4 && p.length <= 64;
const userInfo = u => ({ username: u.username, admin: !!u.admin });

// ---------- 프로필 (재화 · 특성 · 기록) ----------
const getWallet = uid => {
  const w = {};
  for (const r of db.prepare('SELECT currency, amount FROM wallets WHERE user_id = ?').all(uid)) w[r.currency] = r.amount;
  return w;
};
const addCurrency = (uid, currency, delta) => {
  db.prepare(`INSERT INTO wallets (user_id, currency, amount) VALUES (?, ?, ?)
    ON CONFLICT (user_id, currency) DO UPDATE SET amount = amount + excluded.amount`).run(uid, currency, delta);
};
const getProfile = uid => {
  const talents = {};
  for (const r of db.prepare('SELECT scope, node, rank FROM talent_ranks WHERE user_id = ?').all(uid)) (talents[r.scope] ||= {})[r.node] = r.rank;
  const pr = db.prepare('SELECT best_time, wins FROM profiles WHERE user_id = ?').get(uid) || { best_time: 0, wins: 0 };
  return { wallet: getWallet(uid), talents, best: pr.best_time, wins: pr.wins };
};

// ---------- API ----------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:\w+/g, '(\\d+)') + '$'), fn });

route('POST', '/api/auth/register', async req => {
  limit('reg:' + clientIp(req), 30, 3600000);
  const { username, password } = await readJson(req);
  if (!validName(username)) fail(400, '아이디는 2~16자의 한글/영문/숫자/_ 만 쓸 수 있습니다.');
  if (!validPw(password)) fail(400, '비밀번호는 4~64자로 입력하세요.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) fail(409, '이미 사용 중인 아이디입니다.');
  const r = db.prepare('INSERT INTO users (username, pw_hash, created_at) VALUES (?, ?, ?)').run(username, hashPw(password), Date.now());
  const uid = Number(r.lastInsertRowid);
  const user = { username, admin: ADMINS.has(username.toLowerCase()) };
  return { token: newSession(uid), user: userInfo(user), profile: getProfile(uid) };
});

route('POST', '/api/auth/login', async req => {
  limit('login:' + clientIp(req), 20, 600000);
  const { username, password } = await readJson(req);
  const u = typeof username === 'string' && db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || typeof password !== 'string' || !checkPw(password, u.pw_hash)) fail(401, '아이디 또는 비밀번호가 틀렸습니다.');
  return { token: newSession(u.id), user: userInfo({ username: u.username, admin: ADMINS.has(u.username.toLowerCase()) }), profile: getProfile(u.id) };
});

route('POST', '/api/auth/logout', async req => {
  const u = authUser(req);
  if (u) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(u.tokenHash);
  return { ok: true };
});

route('GET', '/api/me', async req => {
  const u = requireUser(req);
  return { user: userInfo(u), profile: getProfile(u.id) };
});

// 특성 포인트 구매: 서버가 비용을 계산해 골드를 차감한다
route('POST', '/api/talents/buy', async req => {
  const u = requireUser(req);
  const { scope, id } = await readJson(req);
  const def = TALENTS.find(scope, id) || fail(400, '알 수 없는 특성입니다.');
  return tx(() => {
    const row = db.prepare('SELECT rank FROM talent_ranks WHERE user_id = ? AND scope = ? AND node = ?').get(u.id, scope, id);
    const rank = row ? row.rank : 0;
    if (rank >= def.max) fail(400, '이미 최대 등급입니다.');
    const cost = TALENTS.cost(def, rank);
    if ((getWallet(u.id).gold || 0) < cost) fail(400, '골드가 부족합니다.');
    addCurrency(u.id, 'gold', -cost);
    db.prepare(`INSERT INTO talent_ranks (user_id, scope, node, rank) VALUES (?, ?, ?, 1)
      ON CONFLICT (user_id, scope, node) DO UPDATE SET rank = rank + 1`).run(u.id, scope, id);
    return { profile: getProfile(u.id) };
  });
});

// ---------- 런 ----------
// 시작 시 ID 발급 → 진행 중/종료 시 누적값 보고 → 서버가 검증하고 이전 지급분과의 차액만 지급
route('POST', '/api/runs/start', async req => {
  const u = requireUser(req);
  limit('run:' + u.id, 120, 3600000);
  const { cls, stage } = await readJson(req);
  if (!CLASSES.includes(cls)) fail(400, '알 수 없는 직업입니다.');
  if (!STAGES[stage]) fail(400, '알 수 없는 스테이지입니다.');
  const id = crypto.randomBytes(16).toString('base64url'), now = Date.now();
  db.prepare('INSERT INTO runs (id, user_id, cls, stage, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, u.id, cls, stage, now, now);
  return { runId: id };
});

route('POST', '/api/runs/report', async req => {
  const u = requireUser(req);
  const b = await readJson(req);
  const num = (v, name) => (Number.isFinite(v) && v >= 0 ? v : fail(400, `잘못된 값: ${name}`));
  const t = num(b.t, 't'), kills = Math.floor(num(b.kills, 'kills')), gold = num(b.gold, 'gold'), level = Math.floor(num(b.level, 'level'));
  const victory = !!b.victory, final = !!b.final;
  return tx(() => {
    const run = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(String(b.runId), u.id) || fail(404, '런을 찾을 수 없습니다.');
    if (run.status !== 'active') fail(409, '이미 끝난 런입니다.');
    const st = STAGES[run.stage], L = RUN_LIMITS, now = Date.now();
    const real = (now - run.started_at) / 1000;
    const bad = [];
    if (t > real * L.clockSlack + L.clockFlat) bad.push('time');
    if (t < run.t || kills < run.kills || gold < run.gold) bad.push('rewind');
    if (kills > t * L.killsPerSec + L.killsFlat) bad.push('kills');
    if (gold > t * L.goldPerSec + L.goldFlat) bad.push('gold');
    if (victory && t < st.duration - 5) bad.push('victory');
    if (bad.length) {
      db.prepare("UPDATE runs SET status = 'rejected', updated_at = ? WHERE id = ?").run(now, run.id);
      console.warn(`run rejected user=${u.username} run=${run.id} reasons=${bad.join(',')} t=${t} real=${real.toFixed(0)} kills=${kills} gold=${gold}`);
      fail(422, '런 기록을 확인할 수 없어 보상이 지급되지 않았습니다.');
    }
    // 생존 시간 보너스는 첫 보고 시점에 한 번만, 승리 보너스도 한 번만 (엔드리스로 이어가도 중복 없음)
    const timeBonus = run.time_bonus ?? t / 6;
    const won = run.victory || victory;
    const total = Math.floor(gold + timeBonus + (won ? st.victoryGold : 0));
    const gain = Math.max(0, total - run.paid);
    if (gain) addCurrency(u.id, 'gold', gain);
    db.prepare(`UPDATE runs SET t = ?, kills = ?, gold = ?, level = ?, victory = ?, time_bonus = ?, paid = ?, status = ?, updated_at = ? WHERE id = ?`)
      .run(t, kills, gold, level, won ? 1 : 0, timeBonus, run.paid + gain, final ? 'done' : 'active', now, run.id);
    db.prepare(`INSERT INTO profiles (user_id, best_time, wins) VALUES (?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET best_time = max(best_time, excluded.best_time), wins = wins + excluded.wins`)
      .run(u.id, t, victory && !run.victory ? 1 : 0);
    return { gain, profile: getProfile(u.id) };
  });
});

route('GET', '/api/suggestions', async (req, url) => {
  const u = authUser(req);
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
    mine: !!u && r.author.toLowerCase() === u.username.toLowerCase(),
  }));
  return { items, more: rows.length > PAGE };
});

route('POST', '/api/suggestions', async req => {
  const u = requireUser(req);
  limit('post:' + u.id, 10, 3600000);
  const { title, body } = await readJson(req);
  const t = typeof title === 'string' ? title.trim() : '', b = typeof body === 'string' ? body.trim() : '';
  if (t.length < 2 || t.length > 80) fail(400, '제목은 2~80자로 입력하세요.');
  if (b.length < 2 || b.length > 2000) fail(400, '내용은 2~2000자로 입력하세요.');
  const r = db.prepare('INSERT INTO suggestions (user_id, title, body, created_at) VALUES (?, ?, ?, ?)').run(u.id, t, b, Date.now());
  return { id: Number(r.lastInsertRowid) };
});

route('POST', '/api/suggestions/:id/vote', async (req, url, [id]) => {
  const u = requireUser(req);
  if (!db.prepare('SELECT 1 FROM suggestions WHERE id = ?').get(id)) fail(404, '글을 찾을 수 없습니다.');
  const had = db.prepare('DELETE FROM votes WHERE suggestion_id = ? AND user_id = ?').run(id, u.id).changes > 0;
  if (!had) db.prepare('INSERT INTO votes (suggestion_id, user_id) VALUES (?, ?)').run(id, u.id);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM votes WHERE suggestion_id = ?').get(id);
  return { votes: n, voted: !had };
});

route('PATCH', '/api/suggestions/:id', async (req, url, [id]) => {
  const u = requireUser(req);
  if (!u.admin) fail(403, '관리자만 상태를 바꿀 수 있습니다.');
  const { status } = await readJson(req);
  if (!STATUSES.includes(status)) fail(400, '알 수 없는 상태입니다.');
  if (!db.prepare('UPDATE suggestions SET status = ? WHERE id = ?').run(status, id).changes) fail(404, '글을 찾을 수 없습니다.');
  return { ok: true };
});

route('DELETE', '/api/suggestions/:id', async (req, url, [id]) => {
  const u = requireUser(req);
  const s = db.prepare('SELECT user_id FROM suggestions WHERE id = ?').get(id) || fail(404, '글을 찾을 수 없습니다.');
  if (s.user_id !== u.id && !u.admin) fail(403, '본인 글만 삭제할 수 있습니다.');
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(id);
  return { ok: true };
});

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

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    return serveStatic(req, res, p);
  }
  try {
    for (const r of routes) {
      const m = r.method === req.method && r.re.exec(url.pathname);
      if (m) return send(res, 200, await r.fn(req, url, m.slice(1).map(Number)));
    }
    fail(404, '알 수 없는 요청입니다.');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: '서버 오류가 발생했습니다.' });
  }
}).listen(PORT, () => console.log(`zzigame server on :${PORT} (static: ${STATIC_DIR}, data: ${DATA_DIR})`));
