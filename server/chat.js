'use strict';
// ================= 접속자 · 채팅 API =================
// 브라우저가 몇 초마다 /api/chat/poll 을 부르는 짧은 폴링 방식. (GitHub Pages → 나스 서버로 출처가 다르고
// DSM 리버스 프록시를 거치므로 WebSocket · SSE 대신 가장 단순하고 확실한 방법을 쓴다)
// - 접속자: 마지막 폴링 후 PRESENCE_TTL 안에 있는 사람. 메모리에만 둔다 (서버 재시작 시 다음 폴링에 다시 채워짐)
// - 채팅: DB에 저장해 재시작 후에도 최근 대화가 남는다. 게스트도 '게스트1234' 같은 이름으로 쓸 수 있다
//   (이름은 브라우저가 간직하는 cid에서 서버가 만든다 — 남의 번호를 골라 쓸 수 없게)
const crypto = require('node:crypto');
const guestName = cid => '게스트' + String(parseInt(crypto.createHash('sha256').update('guest:' + cid).digest('hex').slice(0, 8), 16) % 9000 + 1000);

module.exports = ({ db, route, fail, limit, readJson, clientIp, isAdmin }) => {
  const PRESENCE_TTL = 70000;   // 탭이 백그라운드면 60초마다 폴링하므로 그보다 길게
  const HISTORY = 50;           // 처음 열 때 보내는 최근 메시지 수
  const KEEP_DAYS = 7;          // 이보다 오래된 메시지는 지운다
  const MAX_LEN = 200;

  const SCHEMA = `(
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    guest_name TEXT,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`;
  db.exec('CREATE TABLE IF NOT EXISTS chat_messages ' + SCHEMA);
  // 2.3.0 테이블(user_id NOT NULL, guest_name 없음)을 게스트 메시지를 담을 수 있게 바꾼다
  if (!db.prepare('PRAGMA table_info(chat_messages)').all().some(c => c.name === 'guest_name')) db.tx(() => {
    db.exec('ALTER TABLE chat_messages RENAME TO chat_messages_old');
    db.exec('CREATE TABLE chat_messages ' + SCHEMA);
    db.exec('INSERT INTO chat_messages (id, user_id, text, created_at) SELECT id, user_id, text, created_at FROM chat_messages_old');
    db.exec('DROP TABLE chat_messages_old');
  });

  // key('u:아이디' | 'g:cid') → { name, admin, guest, where, seen }
  const presence = new Map();
  const deleted = []; // 관리자가 지운 메시지 { id, at } — 이미 받아 간 화면에서도 지우도록 잠시 알려 준다
  const prune = () => {
    const now = Date.now();
    for (const [k, p] of presence) if (now - p.seen > PRESENCE_TTL) presence.delete(k);
    while (deleted.length && now - deleted[0].at > 600000) deleted.shift();
  };
  setInterval(() => {
    prune();
    db.prepare('DELETE FROM chat_messages WHERE created_at < ?').run(Date.now() - KEEP_DAYS * 86400000);
  }, 3600000).unref();

  const msgRows = (sql, ...args) => db.prepare(`
    SELECT m.id, COALESCE(u.username, m.guest_name) AS name, m.user_id IS NULL AS guest, m.text, m.created_at AS at
    FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id ${sql}`)
    .all(...args).map(r => ({ ...r, guest: !!r.guest, admin: !r.guest && isAdmin(r.name) }));
  const validCid = cid => typeof cid === 'string' && /^[\w-]{8,40}$/.test(cid);

  // 폴링: 접속 표시를 갱신하고 접속자 목록 + after 이후의 새 메시지를 돌려준다
  route('POST', '/api/chat/poll', async (req, u) => {
    limit('chatpoll:' + clientIp(req), 300, 60000);
    const { after, cid, where } = await readJson(req);
    const w = typeof where === 'string' && /^[a-z0-9_]{1,24}(:[a-z]{1,10})?$/.test(where) ? where : 'lobby';
    const gk = validCid(cid) ? 'g:' + cid : null;
    if (u) {
      presence.set('u:' + u.id, { name: u.info.username, admin: u.info.admin, where: w, seen: Date.now() });
      if (gk) presence.delete(gk); // 이 브라우저에서 방금 로그인했으면 게스트 목록에서 뺀다
    } else if (gk) presence.set(gk, { name: guestName(cid), guest: true, where: w, seen: Date.now() });
    prune();

    // 로그인한 사람을 먼저, 그다음 게스트
    const online = [...presence.values()].map(p => ({ name: p.name, admin: !!p.admin, guest: !!p.guest, where: p.where }))
      .sort((a, b) => a.guest - b.guest || a.name.localeCompare(b.name, 'ko'));
    const guests = online.filter(o => o.guest).length;

    const a = Math.max(0, Math.floor(+after || 0));
    const messages = a
      ? msgRows('WHERE m.id > ? ORDER BY m.id LIMIT 100', a)
      : msgRows('ORDER BY m.id DESC LIMIT ?', HISTORY).reverse();
    return { online, guests, messages, deleted: deleted.map(d => d.id), you: u ? null : gk && guestName(cid) };
  });

  route('POST', '/api/chat', async (req, u) => {
    const { text, cid } = await readJson(req);
    if (!u) {
      if (!validCid(cid)) fail(400, '잘못된 요청입니다.');
      limit('chatguest:' + clientIp(req), 10, 10000); // cid를 바꿔 가며 도배하지 못하게 IP로도 묶는다
    }
    const who = u ? u.id : 'g:' + cid;
    limit('chat:' + who, 5, 10000);
    limit('chatmin:' + who, 30, 60000);
    const t = typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    if (!t) fail(400, '메시지를 입력하세요.');
    if (t.length > MAX_LEN) fail(400, `메시지는 ${MAX_LEN}자까지 쓸 수 있습니다.`);
    const r = db.prepare('INSERT INTO chat_messages (user_id, guest_name, text, created_at) VALUES (?, ?, ?, ?)')
      .run(u ? u.id : null, u ? null : guestName(cid), t, Date.now());
    return { id: Number(r.lastInsertRowid) };
  });

  route('DELETE', '/api/chat/:id', async (req, u, url, [id]) => {
    if (!u.info.admin) fail(403, '관리자만 메시지를 지울 수 있습니다.');
    if (!db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id).changes) fail(404, '메시지를 찾을 수 없습니다.');
    deleted.push({ id, at: Date.now() });
    return { ok: true };
  }, { auth: true });
};
