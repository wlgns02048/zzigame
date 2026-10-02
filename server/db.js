'use strict';
// ================= DB (node:sqlite) =================
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

module.exports = dataDir => {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'game.db'));
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
    -- 재화
    CREATE TABLE IF NOT EXISTS wallets (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, currency)
    );
    -- 캐릭터 (직업당 하나)
    CREATE TABLE IF NOT EXISTS characters (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cls TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, cls)
    );
    -- 특성: tree = 'library' 또는 직업 id
    CREATE TABLE IF NOT EXISTS talent_ranks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      node TEXT NOT NULL,
      rank INTEGER NOT NULL,
      PRIMARY KEY (user_id, scope, node)
    );
    CREATE TABLE IF NOT EXISTS talent_points (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tree TEXT NOT NULL,
      bought INTEGER NOT NULL DEFAULT 0,
      resets INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, tree)
    );
    -- 장비 (data = 생성된 아이템 JSON). 착용 중이면 equip_cls/equip_slot
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      equip_cls TEXT,
      equip_slot TEXT,
      locked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS items_user ON items (user_id);
    -- 보석 · 마법부여서 (쌓이는 소모품)
    CREATE TABLE IF NOT EXISTS stacks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (user_id, kind, ref)
    );
    CREATE TABLE IF NOT EXISTS gacha_state (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      pity INTEGER NOT NULL DEFAULT 0,
      pulls INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, kind)
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      clears INTEGER NOT NULL DEFAULT 0,
      best_clear REAL,
      best_endless INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, stage, difficulty)
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
    -- 퀘스트 · 금고 진행 (기간별 카운터)
    CREATE TABLE IF NOT EXISTS period_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      pkey TEXT NOT NULL,
      counters TEXT NOT NULL DEFAULT '{}',
      claimed TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (user_id, period, pkey)
    );
    CREATE TABLE IF NOT EXISTS vault (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week TEXT NOT NULL,
      options TEXT NOT NULL,
      claimed INTEGER,
      PRIMARY KEY (user_id, week)
    );
  `);
  // 기존 DB에 새 열 추가 (이미 있으면 건너뜀)
  const ensure = (table, cols) => {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    for (const [c, def] of Object.entries(cols)) if (!have.has(c)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${c} ${def}`);
  };
  ensure('runs', {
    difficulty: "TEXT NOT NULL DEFAULT 'normal'", boss_kills: 'INTEGER NOT NULL DEFAULT 0', clear_t: 'REAL', endless_lv: 'INTEGER NOT NULL DEFAULT 0',
    ilvl: 'INTEGER NOT NULL DEFAULT 0', paid_json: "TEXT NOT NULL DEFAULT '{}'",
  });
  db.exec('CREATE INDEX IF NOT EXISTS runs_rank ON runs (stage, difficulty, clear_t)');

  // 여러 쓰기를 하나로 묶는다 (중간에 실패하면 전부 취소)
  db.tx = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  return db;
};
