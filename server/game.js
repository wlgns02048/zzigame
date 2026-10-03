'use strict';
// ================= 게임 경제 API =================
// 캐릭터 · 특성 · 장비 · 보석/마법부여 · 가챠 · 런 보상 · 랭킹 · 퀘스트 · 금고.
// 재화와 아이템은 여기서만 바뀐다. 정의 데이터는 브라우저와 같은 js/data/*.js 를 읽는다.
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = ({ db, route, fail, limit, readJson, STATIC_DIR, saveLog, log }) => {
  const data = f => require(path.join(STATIC_DIR, 'js', 'data', f));
  const TALENTS = data('talents.js'), ITEMS = data('items.js'), SD = data('stages.js');
  const { STAGES, DIFFICULTY, ENDLESS } = SD;
  const CLASSES = Object.keys(ITEMS.CLASS_GEAR);
  const rng = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;
  // 런 보고 검증 한도 — 정상 플레이 최고치(골드 0.8/초, 처치 8.5/초)의 여유분. 엔드리스 후반 밀도까지 감안
  const RUN_LIMITS = { goldPerSec: 4, goldFlat: 300, killsPerSec: 30, killsFlat: 200, clockSlack: 1.1, clockFlat: 20 };
  // 테스트 전용: 실제 경과 시간 검증 끄기 (운영에서는 절대 설정하지 말 것)
  const SKIP_CLOCK = process.env.ZZ_SKIP_CLOCK === '1';

  // ---------- 지갑 ----------
  const getWallet = uid => {
    const w = {};
    for (const r of db.prepare('SELECT currency, amount FROM wallets WHERE user_id = ?').all(uid)) w[r.currency] = r.amount;
    return w;
  };
  const addCurrency = (uid, currency, delta) => {
    if (!delta) return;
    db.prepare(`INSERT INTO wallets (user_id, currency, amount) VALUES (?, ?, ?)
      ON CONFLICT (user_id, currency) DO UPDATE SET amount = amount + excluded.amount`).run(uid, currency, delta);
  };
  const spend = (uid, currency, amount) => {
    if ((getWallet(uid)[currency] || 0) < amount) fail(400, `${ITEMS.CURRENCIES[currency].name}이(가) 부족합니다.`);
    addCurrency(uid, currency, -amount);
  };
  const addRewards = (uid, rew) => { for (const k in rew) addCurrency(uid, k, rew[k]); };

  // ---------- 아이템 ----------
  const itemRow = r => ({ id: r.id, ...JSON.parse(r.data), equip: r.equip_cls ? { cls: r.equip_cls, slot: r.equip_slot } : null, locked: !!r.locked });
  const getItem = (uid, id) => {
    const r = db.prepare('SELECT * FROM items WHERE id = ? AND user_id = ?').get(id, uid);
    return r ? itemRow(r) : fail(404, '아이템을 찾을 수 없습니다.');
  };
  const saveItem = it => {
    const { id, equip, locked, ...rest } = it;
    db.prepare('UPDATE items SET data = ? WHERE id = ?').run(JSON.stringify(rest), id);
  };
  const bagCount = uid => db.prepare('SELECT COUNT(*) AS n FROM items WHERE user_id = ? AND equip_cls IS NULL').get(uid).n;
  // 가방이 가득 차면 자동 분해 (재료로 전환)
  const giveItem = (uid, item) => {
    if (bagCount(uid) >= ITEMS.BAG_SIZE) { const de = ITEMS.disenchant(item); addRewards(uid, de); return { ...item, autoDE: de }; }
    const r = db.prepare('INSERT INTO items (user_id, data, created_at) VALUES (?, ?, ?)').run(uid, JSON.stringify(item), Date.now());
    return { id: Number(r.lastInsertRowid), ...item };
  };
  const addStack = (uid, kind, ref, delta) => {
    db.prepare(`INSERT INTO stacks (user_id, kind, ref, count) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, kind, ref) DO UPDATE SET count = count + excluded.count`).run(uid, kind, ref, delta);
    db.prepare('DELETE FROM stacks WHERE user_id = ? AND kind = ? AND ref = ? AND count <= 0').run(uid, kind, ref);
  };
  const stackCount = (uid, kind, ref) => (db.prepare('SELECT count FROM stacks WHERE user_id = ? AND kind = ? AND ref = ?').get(uid, kind, ref) || { count: 0 }).count;
  // 직업 캐릭터의 착용 장비 평균 아이템 레벨 (양손 무기는 두 칸으로 계산)
  const equippedIlvl = (uid, cls) => {
    const rows = db.prepare('SELECT data FROM items WHERE user_id = ? AND equip_cls = ?').all(uid, cls).map(r => JSON.parse(r.data));
    let sum = 0; for (const it of rows) sum += it.ilvl * (ITEMS.SLOT[it.slot].twoHand ? 2 : 1);
    return Math.round(sum / 16);
  };
  // 가챠/금고 아이템 레벨 기준: 클리어한 가장 높은 스테이지
  const progressIlvl = uid => {
    let best = 20;
    for (const r of db.prepare('SELECT stage, difficulty FROM progress WHERE user_id = ? AND clears > 0').all(uid)) {
      const s = STAGES[r.stage]; if (s) best = Math.max(best, s.ilvl + DIFFICULTY[r.difficulty].ilvl);
    }
    return best;
  };

  // ---------- 기간(일일/주간) 카운터 ----------
  const getPeriod = (uid, period, key) => {
    const r = db.prepare('SELECT counters, claimed FROM period_progress WHERE user_id = ? AND period = ? AND pkey = ?').get(uid, period, key);
    return r ? { counters: JSON.parse(r.counters), claimed: JSON.parse(r.claimed) } : { counters: {}, claimed: [] };
  };
  const setPeriod = (uid, period, key, p) => {
    db.prepare(`INSERT INTO period_progress (user_id, period, pkey, counters, claimed) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id, period, pkey) DO UPDATE SET counters = excluded.counters, claimed = excluded.claimed`)
      .run(uid, period, key, JSON.stringify(p.counters), JSON.stringify(p.claimed));
  };
  // ev: { kill: n, boss: n, clear: 1, ... } — 합산 카운터는 더하고, 최대값 카운터(endless, *Ilvl)는 최대값
  const MAX_COUNTERS = new Set(['endless', 'dungeonIlvl', 'raidIlvl', 'endlessIlvl']);
  const track = (uid, ev) => {
    const keys = ITEMS.periodKeys();
    for (const period of ['daily', 'weekly']) {
      const p = getPeriod(uid, period, keys[period]);
      for (const k in ev) { if (!ev[k]) continue; p.counters[k] = MAX_COUNTERS.has(k) ? Math.max(p.counters[k] || 0, ev[k]) : (p.counters[k] || 0) + ev[k]; }
      setPeriod(uid, period, keys[period], p);
    }
  };
  const hashStr = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
  const dailyQuests = (uid, key) => {
    const pool = ITEMS.QUESTS.daily.slice(), out = []; let h = hashStr(uid + ':' + key);
    while (out.length < ITEMS.QUESTS.dailyCount && pool.length) { out.push(pool.splice(h % pool.length, 1)[0]); h = Math.floor(h / 7) + 101; }
    return out;
  };
  const questView = uid => {
    const keys = ITEMS.periodKeys(), view = {};
    for (const period of ['daily', 'weekly']) {
      const p = getPeriod(uid, period, keys[period]);
      const list = period === 'daily' ? dailyQuests(uid, keys.daily) : ITEMS.QUESTS.weekly;
      view[period] = { key: keys[period], list: list.map(q => ({ id: q.id, progress: Math.min(q.goal, p.counters[q.track] || 0), goal: q.goal, claimed: p.claimed.includes(q.id) })) };
    }
    return view;
  };

  // ---------- 금고 ----------
  // 지난주 진행으로 이번 주 선택지를 만든다 (처음 볼 때 한 번 생성)
  const vaultView = uid => {
    const keys = ITEMS.periodKeys();
    const lastWeek = ITEMS.periodKeys(Date.now() - 7 * 86400000).weekly;
    let row = db.prepare('SELECT * FROM vault WHERE user_id = ? AND week = ?').get(uid, keys.weekly);
    if (!row) {
      const prev = getPeriod(uid, 'weekly', lastWeek).counters, options = [];
      for (const r of ITEMS.VAULT.rows) {
        const have = prev[r.track] || 0;
        const base = r.id === 'dungeon' ? prev.dungeonIlvl : r.id === 'raid' ? prev.raidIlvl : prev.endlessIlvl;
        r.goals.forEach((g, i) => {
          if (have < g || !base) return;
          const ilvl = base + ITEMS.VAULT.bonusIlvl + i * 3;
          const ex = rng() < ITEMS.VAULT.exclusiveChance ? ITEMS.pick(rng, ITEMS.VAULT_ITEMS) : null;
          options.push({ row: r.id, item: ITEMS.makeItem(rng, ex ? { slot: ex.slot, quality: 3, ilvl, named: ex } : { quality: 3, ilvl }) });
        });
      }
      db.prepare('INSERT INTO vault (user_id, week, options, claimed) VALUES (?, ?, ?, NULL)').run(uid, keys.weekly, JSON.stringify(options));
      row = db.prepare('SELECT * FROM vault WHERE user_id = ? AND week = ?').get(uid, keys.weekly);
    }
    const cur = getPeriod(uid, 'weekly', keys.weekly).counters;
    return {
      week: keys.weekly, options: JSON.parse(row.options), claimed: row.claimed,
      rows: ITEMS.VAULT.rows.map(r => ({ id: r.id, have: cur[r.track] || 0, goals: r.goals })),
    };
  };

  // ---------- 프로필 ----------
  const talentView = uid => {
    const out = {};
    for (const tree in TALENTS.TREES) out[tree] = { ranks: {}, bought: 0, resets: 0 };
    for (const r of db.prepare('SELECT scope, node, rank FROM talent_ranks WHERE user_id = ?').all(uid)) if (out[r.scope]) out[r.scope].ranks[r.node] = r.rank;
    for (const r of db.prepare('SELECT tree, bought, resets FROM talent_points WHERE user_id = ?').all(uid)) if (out[r.tree]) Object.assign(out[r.tree], { bought: r.bought, resets: r.resets });
    return out;
  };
  const getProfile = uid => {
    const stacks = { gem: {}, enchant: {} };
    for (const r of db.prepare('SELECT kind, ref, count FROM stacks WHERE user_id = ?').all(uid)) (stacks[r.kind] ||= {})[r.ref] = r.count;
    const progress = {};
    for (const r of db.prepare('SELECT * FROM progress WHERE user_id = ?').all(uid)) (progress[r.stage] ||= {})[r.difficulty] = { clears: r.clears, best: r.best_clear, endless: r.best_endless };
    const gacha = {};
    for (const r of db.prepare('SELECT kind, pity, pulls FROM gacha_state WHERE user_id = ?').all(uid)) gacha[r.kind] = { pity: r.pity, pulls: r.pulls };
    const pr = db.prepare('SELECT best_time, wins FROM profiles WHERE user_id = ?').get(uid) || { best_time: 0, wins: 0 };
    const chars = db.prepare('SELECT cls, spec FROM characters WHERE user_id = ? ORDER BY created_at').all(uid);
    return {
      wallet: getWallet(uid),
      characters: chars.map(r => r.cls),
      specs: Object.fromEntries(chars.map(r => [r.cls, ITEMS.specOf(r.cls, r.spec)])),
      talents: talentView(uid),
      items: db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY id').all(uid).map(itemRow),
      stacks, progress, gacha, quests: questView(uid), vault: vaultView(uid),
      affixes: SD.weeklyAffixes(ITEMS.periodKeys().weekly), progressIlvl: progressIlvl(uid),
      best: pr.best_time, wins: pr.wins,
    };
  };
  const ok = uid => ({ profile: getProfile(uid) });
  const requireChar = (uid, cls) => {
    if (!db.prepare('SELECT 1 FROM characters WHERE user_id = ? AND cls = ?').get(uid, cls)) fail(400, '캐릭터가 없습니다.');
  };
  const onRegister = uid => { db.prepare('INSERT OR IGNORE INTO characters (user_id, cls, created_at) VALUES (?, ?, ?)').run(uid, 'mage', Date.now()); };

  route('GET', '/api/me', async (req, u) => ({ user: u.info, ...ok(u.id) }), { auth: true });

  // ---------- 캐릭터 ----------
  route('POST', '/api/characters', async (req, u) => {
    const { cls } = await readJson(req);
    if (!CLASSES.includes(cls)) fail(400, '알 수 없는 직업입니다.');
    db.prepare('INSERT OR IGNORE INTO characters (user_id, cls, created_at, spec) VALUES (?, ?, ?, ?)').run(u.id, cls, Date.now(), ITEMS.defaultSpec(cls));
    return ok(u.id);
  }, { auth: true });
  // 전문화 전환: 같은 장비의 주 능력치 · 특성 트리가 바뀐다
  route('POST', '/api/characters/spec', async (req, u) => {
    const { cls, spec } = await readJson(req);
    requireChar(u.id, cls);
    if (!ITEMS.SPECS[spec] || ITEMS.SPECS[spec].cls !== cls) fail(400, '이 직업의 전문화가 아닙니다.');
    db.prepare('UPDATE characters SET spec = ? WHERE user_id = ? AND cls = ?').run(spec, u.id, cls);
    return ok(u.id);
  }, { auth: true });
  const charSpec = (uid, cls) => { const r = db.prepare('SELECT spec FROM characters WHERE user_id = ? AND cls = ?').get(uid, cls); return ITEMS.specOf(cls, r && r.spec); };

  // ---------- 특성 ----------
  // 트리 = 전문화의 특성 트리. 그 전문화를 가진 직업 캐릭터가 있어야 한다
  const treeOwned = (uid, tree) => {
    if (!TALENTS.TREES[tree]) fail(400, '알 수 없는 특성 트리입니다.');
    if (tree === 'library') return;
    const sp = Object.values(ITEMS.SPECS).find(s => s.tree === tree);
    if (!sp) fail(400, '알 수 없는 특성 트리입니다.');
    requireChar(uid, sp.cls);
  };
  route('POST', '/api/talents/point', async (req, u) => {
    const { tree } = await readJson(req);
    treeOwned(u.id, tree);
    return db.tx(() => {
      const cur = talentView(u.id)[tree];
      if (cur.bought >= TALENTS.TREES[tree].maxPoints) fail(400, '더 이상 포인트를 살 수 없습니다.');
      spend(u.id, 'gold', TALENTS.pointCost(tree, cur.bought));
      db.prepare(`INSERT INTO talent_points (user_id, tree, bought) VALUES (?, ?, 1)
        ON CONFLICT (user_id, tree) DO UPDATE SET bought = bought + 1`).run(u.id, tree);
      return ok(u.id);
    });
  }, { auth: true });
  // 배분 저장: 기존 등급을 낮출 수는 없다 (낮추려면 초기화)
  route('POST', '/api/talents/set', async (req, u) => {
    const { tree, ranks } = await readJson(req);
    treeOwned(u.id, tree);
    if (!ranks || typeof ranks !== 'object') fail(400, '잘못된 요청입니다.');
    return db.tx(() => {
      const cur = talentView(u.id)[tree];
      for (const k in cur.ranks) if ((ranks[k] || 0) < cur.ranks[k]) fail(400, '이미 배운 특성은 초기화해야 내릴 수 있습니다.');
      const err = TALENTS.validate(tree, ranks, cur.bought); if (err) fail(400, err);
      for (const k in ranks) if (ranks[k] > 0) db.prepare(`INSERT INTO talent_ranks (user_id, scope, node, rank) VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id, scope, node) DO UPDATE SET rank = excluded.rank`).run(u.id, tree, k, ranks[k]);
      return ok(u.id);
    });
  }, { auth: true });
  route('POST', '/api/talents/reset', async (req, u) => {
    const { tree } = await readJson(req);
    treeOwned(u.id, tree);
    return db.tx(() => {
      const cur = talentView(u.id)[tree];
      spend(u.id, 'gold', TALENTS.respecCost(cur.resets));
      db.prepare('DELETE FROM talent_ranks WHERE user_id = ? AND scope = ?').run(u.id, tree);
      db.prepare(`INSERT INTO talent_points (user_id, tree, resets) VALUES (?, ?, 1)
        ON CONFLICT (user_id, tree) DO UPDATE SET resets = resets + 1`).run(u.id, tree);
      return ok(u.id);
    });
  }, { auth: true });

  // ---------- 장비 ----------
  route('POST', '/api/items/equip', async (req, u) => {
    const { itemId, cls, slot } = await readJson(req);
    requireChar(u.id, cls);
    return db.tx(() => {
      const it = getItem(u.id, itemId);
      if (!ITEMS.canEquip(slot, it.slot)) fail(400, '그 칸에 착용할 수 없는 아이템입니다.');
      if (!ITEMS.canUse(cls, it)) fail(400, '이 직업은 착용할 수 없는 아이템입니다.');
      if (!ITEMS.canEquipFor(cls, slot, it)) fail(400, '쌍수를 쓸 수 없는 직업은 보조무기 칸에 한손 무기를 낄 수 없습니다.');
      if (it.equip) fail(400, '이미 착용 중인 아이템입니다.');
      const unequip = s => db.prepare('UPDATE items SET equip_cls = NULL, equip_slot = NULL WHERE user_id = ? AND equip_cls = ? AND equip_slot = ?').run(u.id, cls, s);
      unequip(slot);
      // 양손 무기는 보조장비를 벗기고, 보조장비를 끼면 양손 무기를 벗긴다
      if (ITEMS.SLOT[it.slot].twoHand) unequip('offhand');
      if (slot === 'offhand') {
        const mh = db.prepare('SELECT data FROM items WHERE user_id = ? AND equip_cls = ? AND equip_slot = ?').get(u.id, cls, 'mainhand');
        if (mh && ITEMS.SLOT[JSON.parse(mh.data).slot].twoHand) unequip('mainhand');
      }
      if (bagCount(u.id) > ITEMS.BAG_SIZE) fail(400, '가방이 가득 찼습니다.');
      db.prepare('UPDATE items SET equip_cls = ?, equip_slot = ? WHERE id = ?').run(cls, slot, it.id);
      return ok(u.id);
    });
  }, { auth: true });
  route('POST', '/api/items/unequip', async (req, u) => {
    const { cls, slot } = await readJson(req);
    return db.tx(() => {
      if (bagCount(u.id) >= ITEMS.BAG_SIZE) fail(400, '가방이 가득 찼습니다.');
      db.prepare('UPDATE items SET equip_cls = NULL, equip_slot = NULL WHERE user_id = ? AND equip_cls = ? AND equip_slot = ?').run(u.id, cls, slot);
      return ok(u.id);
    });
  }, { auth: true });
  route('POST', '/api/items/lock', async (req, u) => {
    const { itemId, locked } = await readJson(req);
    getItem(u.id, itemId);
    db.prepare('UPDATE items SET locked = ? WHERE id = ?').run(locked ? 1 : 0, itemId);
    return ok(u.id);
  }, { auth: true });
  // 판매 / 분해 (여러 개)
  const bulk = mode => async (req, u) => {
    const { ids } = await readJson(req);
    if (!Array.isArray(ids) || !ids.length || ids.length > 100) fail(400, '잘못된 요청입니다.');
    return db.tx(() => {
      const got = {};
      for (const id of ids) {
        const it = getItem(u.id, id);
        if (it.equip) fail(400, `${it.name}: 착용 중인 아이템입니다.`);
        if (it.locked) fail(400, `${it.name}: 잠긴 아이템입니다.`);
        const rew = mode === 'sell' ? { gold: ITEMS.sellPrice(it) } : ITEMS.disenchant(it);
        for (const k in rew) got[k] = (got[k] || 0) + rew[k];
        db.prepare('DELETE FROM items WHERE id = ?').run(id);
      }
      addRewards(u.id, got);
      if (mode === 'de') track(u.id, { de: ids.length });
      return { got, ...ok(u.id) };
    });
  };
  route('POST', '/api/items/sell', bulk('sell'), { auth: true });
  route('POST', '/api/items/disenchant', bulk('de'), { auth: true });
  // 보석 박기 (기존 보석은 파괴 — 와우와 같음)
  route('POST', '/api/items/socket', async (req, u) => {
    const { itemId, index, gemId } = await readJson(req);
    return db.tx(() => {
      const it = getItem(u.id, itemId);
      if (!(index >= 0 && index < it.sockets.length)) fail(400, '보석 홈이 없습니다.');
      if (!ITEMS.canSocket(it.sockets[index], gemId)) fail(400, '그 홈에 넣을 수 없는 보석입니다.');
      if (gemId.startsWith('meta') && it.gems.some((g, i) => i !== index && g && g.startsWith('meta'))) fail(400, '얼개 보석은 하나만 넣을 수 있습니다.');
      if (stackCount(u.id, 'gem', gemId) < 1) fail(400, '보석이 없습니다.');
      addStack(u.id, 'gem', gemId, -1);
      it.gems[index] = gemId; saveItem(it);
      return ok(u.id);
    });
  }, { auth: true });
  route('POST', '/api/items/enchant', async (req, u) => {
    const { itemId, enchantId } = await readJson(req);
    return db.tx(() => {
      const it = getItem(u.id, itemId);
      if (!ITEMS.canEnchant(it.slot, enchantId)) fail(400, '이 부위에 쓸 수 없는 마법부여입니다.');
      if (stackCount(u.id, 'enchant', enchantId) < 1) fail(400, '마법부여서가 없습니다.');
      addStack(u.id, 'enchant', enchantId, -1);
      it.enchant = enchantId; saveItem(it);
      return ok(u.id);
    });
  }, { auth: true });

  // ---------- 가챠 ----------
  route('POST', '/api/gacha', async (req, u) => {
    const { kind, count, premium } = await readJson(req);
    const g = ITEMS.GACHA[kind] || fail(400, '알 수 없는 뽑기입니다.');
    const n = count === 10 ? 10 : 1;
    if (premium && (!g.premium || n !== 1)) fail(400, '잘못된 요청입니다.');
    limit('gacha:' + u.id, 200, 600000);
    return db.tx(() => {
      if (premium) spend(u.id, g.premium.currency, g.premium.cost); else spend(u.id, g.currency, n === 10 ? g.cost10 : g.cost);
      const st = db.prepare('SELECT pity, pulls FROM gacha_state WHERE user_id = ? AND kind = ?').get(u.id, kind) || { pity: 0, pulls: 0 };
      const ctx = { ilvl: progressIlvl(u.id) };
      const rolls = [];
      for (let i = 0; i < n; i++) rolls.push(ITEMS.gachaRoll(rng, kind, st, { premium }));
      // 10회 보장: 최소 등급 미만만 나왔으면 마지막 하나를 보장 등급 이상으로 다시 굴림
      const rk = v => (v === 'meta' ? 5 : v);
      if (n === 10 && rolls.every(v => rk(v) < g.ten.min)) rolls[9] = ITEMS.gachaRoll(rng, kind, st, { floor: g.ten.min });
      const results = rolls.map(v => {
        const rew = ITEMS.gachaReward(rng, kind, v, ctx);
        if (rew.type === 'item') return { ...rew, item: giveItem(u.id, rew.item) };
        addStack(u.id, rew.type, rew.id, 1); return rew;
      });
      db.prepare(`INSERT INTO gacha_state (user_id, kind, pity, pulls) VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id, kind) DO UPDATE SET pity = excluded.pity, pulls = excluded.pulls`).run(u.id, kind, st.pity, st.pulls + n);
      track(u.id, { gacha: n });
      return { results, ...ok(u.id) };
    });
  }, { auth: true });

  // ---------- 런 ----------
  const stageUnlocked = (uid, stage, diff) => {
    const prev = SD.prevStage(stage);
    const cleared = (s, d) => !!db.prepare('SELECT 1 FROM progress WHERE user_id = ? AND stage = ? AND difficulty = ? AND clears > 0').get(uid, s, d);
    if (prev && !cleared(prev, 'normal')) return false;
    if (diff === 'heroic' && !cleared(stage, 'normal')) return false;
    return true;
  };
  route('POST', '/api/runs/start', async (req, u) => {
    limit('run:' + u.id, 120, 3600000);
    const { cls, stage, difficulty = 'normal' } = await readJson(req);
    requireChar(u.id, cls);
    if (!STAGES[stage]) fail(400, '알 수 없는 스테이지입니다.');
    if (!DIFFICULTY[difficulty]) fail(400, '알 수 없는 난이도입니다.');
    if (!stageUnlocked(u.id, stage, difficulty)) fail(403, '아직 열리지 않은 스테이지입니다.');
    const id = crypto.randomBytes(16).toString('base64url'), now = Date.now();
    db.prepare('INSERT INTO runs (id, user_id, cls, spec, stage, difficulty, ilvl, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, u.id, cls, charSpec(u.id, cls), stage, difficulty, equippedIlvl(u.id, cls), now, now);
    return { runId: id, affixes: SD.weeklyAffixes(ITEMS.periodKeys().weekly) };
  }, { auth: true });

  // 판 성과 → 받을 보상 누적치 (보고마다 다시 계산해 이미 준 만큼 뺀다)
  const entitlement = (run, s) => {
    const st = STAGES[run.stage], df = DIFFICULTY[run.difficulty], raid = st.type === 'raid';
    const won = s.clearT != null;
    return {
      // 줍는 골드(s.gold)는 브라우저에서 이미 배율이 붙어 온다
      gold: Math.floor(s.gold + (s.timeBonus + (won ? (raid ? 500 : 300) : 0)) * SD.goldMul(run.stage, run.difficulty)),
      badge: s.bossKills * (raid ? 2 : 1) * df.badge + (won ? (raid ? 6 : 3) * df.badge : 0),
      rough: s.endlessLv + Math.floor(s.endlessLv / 5) * 3,
    };
  };
  const lootRoll = (run, kind) => {
    const st = STAGES[run.stage], heroic = run.difficulty === 'heroic', raid = st.type === 'raid';
    const table = kind === 'fail' ? [[1, 70], [2, 30]]
      : raid ? (heroic ? [[2, 30], [3, 67], [4, 3]] : [[2, 60], [3, 40]])
        : (heroic ? [[2, 70], [3, 30]] : [[1, 50], [2, 45], [3, 5]]);
    const quality = ITEMS.weighted(rng, table);
    let ilvl = st.ilvl + DIFFICULTY[run.difficulty].ilvl + Math.floor(rng() * 5) - 2;
    if (kind === 'fail') ilvl -= 5;
    if (kind === 'endless') ilvl += Math.min(15, run.endlessLv || 0);
    if (quality === 4) { const L = ITEMS.pick(rng, ITEMS.LEGENDARIES); return ITEMS.makeItem(rng, { slot: L.slot, quality: 4, ilvl: ilvl + 6, named: L }); }
    const named = quality >= 2 && rng() < 0.7 ? ITEMS.pick(rng, st.loot) : null;
    return ITEMS.makeItem(rng, named ? { slot: named.slot, quality, ilvl, named: { ...named, quality } } : { quality, ilvl });
  };

  route('POST', '/api/runs/report', async (req, u) => {
    const b = await readJson(req, 196608); // 판 기록(log)이 실려 와서 다른 요청보다 크다
    const num = (v, name) => (Number.isFinite(v) && v >= 0 ? v : fail(400, `잘못된 값: ${name}`));
    const t = num(b.t, 't'), kills = Math.floor(num(b.kills, 'kills')), gold = num(b.gold, 'gold');
    const level = Math.floor(num(b.level, 'level')), bossKills = Math.floor(num(b.bossKills ?? 0, 'bossKills'));
    const victory = !!b.victory, final = !!b.final;
    const out = db.tx(() => {
      const run = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(String(b.runId), u.id) || fail(404, '런을 찾을 수 없습니다.');
      if (run.status !== 'active') fail(409, '이미 끝난 런입니다.');
      const st = STAGES[run.stage], L = RUN_LIMITS, now = Date.now(), raid = st.type === 'raid';
      const real = (now - run.started_at) / 1000;
      const clearT = run.clear_t ?? (victory ? t : null);
      const endlessLv = clearT != null ? Math.max(0, Math.floor((t - clearT) / ENDLESS.interval)) : 0;
      const maxBosses = SD.bossesBy(run.stage, Math.min(t, st.duration)) + (clearT != null ? Math.floor(endlessLv / ENDLESS.bossEvery) + 1 : 0);
      const bad = [];
      // 피의 욕망으로 더 흐른 게임 시간(lust)은 인정하되, 판 내내 켜져 있는 경우(실제 시간 × 0.5)를 넘지 못한다
      const lust = Math.min(Number.isFinite(b.lust) && b.lust > 0 ? b.lust : 0, real * 0.5);
      if (!SKIP_CLOCK && t > real * L.clockSlack + L.clockFlat + lust) bad.push('time');
      if (t < run.t || kills < run.kills || gold < run.gold || bossKills < run.boss_kills) bad.push('rewind');
      if (kills > t * L.killsPerSec + L.killsFlat) bad.push('kills');
      if (gold > (t * L.goldPerSec + L.goldFlat) * SD.goldMul(run.stage, run.difficulty)) bad.push('gold');
      if (bossKills > maxBosses) bad.push('bosses');
      if (victory && run.clear_t == null && t < st.duration - 5) bad.push('victory');
      if (bad.length) {
        // 거부 표시는 커밋되어야 하므로 여기서 던지지 않고 트랜잭션 밖에서 실패 처리
        db.prepare("UPDATE runs SET status = 'rejected', updated_at = ? WHERE id = ?").run(now, run.id);
        log(`run rejected user=${u.info.username} run=${run.id} reasons=${bad.join(',')} t=${t} real=${real.toFixed(0)} kills=${kills} gold=${gold} bosses=${bossKills}`);
        return { rejected: true };
      }
      const timeBonus = run.time_bonus ?? t / 6;
      const firstWin = clearT != null && run.clear_t == null;
      const paid = JSON.parse(run.paid_json || '{}');
      // 재화: 누적 권리 - 지급분
      const ent = entitlement(run, { gold, timeBonus, bossKills, clearT, endlessLv });
      const gain = {};
      for (const k in ent) { const d = ent[k] - (paid[k] || 0); if (d > 0) { gain[k] = d; paid[k] = ent[k]; } }
      addRewards(u.id, gain);
      // 아이템
      const loot = [];
      const prog = db.prepare('SELECT * FROM progress WHERE user_id = ? AND stage = ? AND difficulty = ?').get(u.id, run.stage, run.difficulty);
      if (firstWin) {
        let n = (raid ? 3 : 2) + (run.difficulty === 'heroic' ? 1 : 0) + (!prog || !prog.clears ? 1 : 0);
        if (t <= st.duration + 60) n++; // 빠른 클리어 보너스 (쐐기돌 상자처럼)
        for (let i = 0; i < n; i++) loot.push(lootRoll(run, 'win'));
      }
      const milestones = Math.floor(endlessLv / 5);
      for (let m = paid.milestones || 0; m < milestones; m++) loot.push(lootRoll({ ...run, endlessLv }, 'endless'));
      paid.milestones = Math.max(paid.milestones || 0, milestones);
      if (final && clearT == null && t >= st.duration * 0.5 && !paid.failLoot) { paid.failLoot = 1; if (rng() < 0.6) loot.push(lootRoll(run, 'fail')); }
      const given = loot.map(it => giveItem(u.id, it));
      // 진행 · 기록
      if (firstWin) {
        db.prepare(`INSERT INTO progress (user_id, stage, difficulty, clears, best_clear) VALUES (?, ?, ?, 1, ?)
          ON CONFLICT (user_id, stage, difficulty) DO UPDATE SET clears = clears + 1, best_clear = min(coalesce(best_clear, 1e9), excluded.best_clear)`)
          .run(u.id, run.stage, run.difficulty, clearT);
      }
      if (endlessLv > 0) db.prepare('UPDATE progress SET best_endless = max(best_endless, ?) WHERE user_id = ? AND stage = ? AND difficulty = ?').run(endlessLv, u.id, run.stage, run.difficulty);
      db.prepare(`INSERT INTO profiles (user_id, best_time, wins) VALUES (?, ?, ?)
        ON CONFLICT (user_id) DO UPDATE SET best_time = max(best_time, excluded.best_time), wins = wins + excluded.wins`).run(u.id, t, firstWin ? 1 : 0);
      // 퀘스트 · 금고 카운터 (이번 보고에서 늘어난 만큼)
      const dBoss = bossKills - run.boss_kills, ilvlNow = st.ilvl + DIFFICULTY[run.difficulty].ilvl;
      track(u.id, {
        kill: kills - run.kills, boss: dBoss, clear: firstWin ? 1 : 0, heroic: firstWin && run.difficulty === 'heroic' ? 1 : 0,
        raid: firstWin && raid ? 1 : 0, endless: endlessLv, play: final && t >= 300 ? 1 : 0,
        dungeonClears: firstWin && !raid ? 1 : 0, dungeonIlvl: firstWin && !raid ? ilvlNow : 0,
        raidBosses: raid ? dBoss : 0, raidIlvl: raid && dBoss > 0 ? ilvlNow : 0,
        endlessRuns: endlessLv >= 5 && run.endless_lv < 5 ? 1 : 0, endlessIlvl: endlessLv >= 5 ? ilvlNow + Math.min(15, endlessLv) : 0,
      });
      db.prepare(`UPDATE runs SET t = ?, kills = ?, gold = ?, level = ?, victory = ?, time_bonus = ?, paid = ?, paid_json = ?, boss_kills = ?,
        clear_t = ?, endless_lv = ?, status = ?, updated_at = ? WHERE id = ?`)
        .run(t, kills, gold, level, clearT != null ? 1 : 0, timeBonus, paid.gold || 0, JSON.stringify(paid), bossKills, clearT, Math.max(run.endless_lv, endlessLv), final ? 'done' : 'active', now, run.id);
      // 판 기록은 분석용이라 저장에 실패해도 보상 정산은 그대로 진행한다
      if (b.log) try { saveLog(u.id, run.id, b.log); } catch (e) { log(`run log skipped run=${run.id}: ${e.message}`); }
      return { gain, loot: given, endlessLv, ...ok(u.id) };
    });
    if (out.rejected) fail(422, '런 기록을 확인할 수 없어 보상이 지급되지 않았습니다.');
    return out;
  }, { auth: true });

  // ---------- 랭킹 ----------
  // 필터 읽기 (스테이지 제외) — 단일 랭킹과 전체 요약이 같이 쓴다
  const rankFilter = url => {
    const difficulty = url.searchParams.get('difficulty') || 'normal';
    const kind = url.searchParams.get('kind') === 'endless' ? 'endless' : 'clear';
    const cls = url.searchParams.get('cls'), week = url.searchParams.get('scope') === 'week';
    if (!DIFFICULTY[difficulty]) fail(400, '알 수 없는 난이도입니다.');
    if (cls && !CLASSES.includes(cls)) fail(400, '알 수 없는 직업입니다.');
    const since = week ? Date.parse(ITEMS.periodKeys().weekly + 'T00:00:00Z') - ITEMS.RESET.tzOffsetH * 3600000 + ITEMS.RESET.weeklyHour * 3600000 : 0;
    return { difficulty, kind, cls, since };
  };
  // 한 스테이지의 사용자별 최고 기록 1개씩, 순위 순 (SQLite: min/max 집계 시 나머지 열은 그 행의 값)
  const rankRows = (stage, f, u, limit) => {
    const where = `r.stage = ? AND r.difficulty = ? AND r.started_at >= ? AND r.status != 'rejected' ${f.cls ? 'AND r.cls = ?' : ''}`;
    const args = [stage, f.difficulty, f.since].concat(f.cls ? [f.cls] : []);
    const sql = f.kind === 'clear'
      ? `SELECT us.username, r.cls, r.ilvl, min(r.clear_t) AS value FROM runs r JOIN users us ON us.id = r.user_id
         WHERE ${where} AND r.clear_t IS NOT NULL GROUP BY r.user_id ORDER BY value ASC${limit ? ' LIMIT ' + limit : ''}`
      : `SELECT us.username, r.cls, r.ilvl, max(r.endless_lv) AS value FROM runs r JOIN users us ON us.id = r.user_id
         WHERE ${where} AND r.endless_lv > 0 GROUP BY r.user_id ORDER BY value DESC${limit ? ' LIMIT ' + limit : ''}`;
    const me = u && u.info.username.toLowerCase();
    return db.prepare(sql).all(...args).map((r, i) => ({ rank: i + 1, username: r.username, cls: r.cls, ilvl: r.ilvl, value: r.value, me: !!me && r.username.toLowerCase() === me }));
  };
  route('GET', '/api/rankings', async (req, u, url) => {
    const stage = url.searchParams.get('stage'), f = rankFilter(url);
    if (!STAGES[stage]) fail(400, '알 수 없는 스테이지입니다.');
    const all = rankRows(stage, f, u), mine = all.find(r => r.me);
    return { rows: all.slice(0, 50), count: all.length, me: mine && mine.rank > 50 ? mine : null };
  });
  // 전체 스테이지 요약: 스테이지마다 상위 3명 · 참여 인원 · 내 순위
  route('GET', '/api/rankings/overview', async (req, u, url) => {
    const f = rankFilter(url);
    return { stages: Object.keys(STAGES).map(stage => {
      const all = rankRows(stage, f, u);
      return { stage, count: all.length, top: all.slice(0, 3), me: all.find(r => r.me) || null };
    }) };
  });

  // ---------- 퀘스트 ----------
  route('POST', '/api/quests/claim', async (req, u) => {
    const { period, id } = await readJson(req);
    if (period !== 'daily' && period !== 'weekly') fail(400, '잘못된 요청입니다.');
    return db.tx(() => {
      const key = ITEMS.periodKeys()[period];
      const list = period === 'daily' ? dailyQuests(u.id, key) : ITEMS.QUESTS.weekly;
      const q = list.find(x => x.id === id) || fail(400, '오늘의 퀘스트가 아닙니다.');
      const p = getPeriod(u.id, period, key);
      if (p.claimed.includes(id)) fail(400, '이미 보상을 받았습니다.');
      if ((p.counters[q.track] || 0) < q.goal) fail(400, '아직 완료하지 않았습니다.');
      p.claimed.push(id); setPeriod(u.id, period, key, p);
      addRewards(u.id, q.reward);
      return { reward: q.reward, ...ok(u.id) };
    });
  }, { auth: true });

  // ---------- 금고 ----------
  route('POST', '/api/vault/claim', async (req, u) => {
    const { index } = await readJson(req);
    return db.tx(() => {
      const v = vaultView(u.id);
      if (v.claimed != null) fail(400, '이번 주 금고 보상을 이미 받았습니다.');
      const opt = v.options[index] || fail(400, '선택지가 없습니다.');
      const item = giveItem(u.id, opt.item);
      db.prepare('UPDATE vault SET claimed = ? WHERE user_id = ? AND week = ?').run(index, u.id, v.week);
      return { item, ...ok(u.id) };
    });
  }, { auth: true });

  return { getProfile, onRegister };
};
