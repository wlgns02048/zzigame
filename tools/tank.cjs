#!/usr/bin/env node
'use strict';
// ================= 생존 측정 (버티는 힘) =================
// tools/dummy.cjs와 같이 무적(?god=1)으로 --pre초까지 봇이 판을 진행해 레벨 · 주문을 쌓은 뒤, 무적을 풀고 두 가지 시험 중 하나로 버티는 힘을 잰다.
// 시험 중에는 성장이 멈춘다: 웨이브 · 보석/상자 줍기 없음, 적 생명력 · 공격력 배율은 시험 시작 시점 값으로 고정.
//
//   hit   (기본) 받는 피해 시험: 봇은 제자리, 옆에 움직이지 않는 허수아비(생명력 10억 · 공격 안 함).
//         허수아비가 0.5초마다 때리고 원시 DPS는 --base에서 시작해 초당 --ramp씩 오른다. 회피 · 처치 속도와 상관없이
//         생명력 · 방어도 · 유연성 · 보호막 · 치유 · 면역기 · 죽음 방지만 본다 → 견딘 시간 · 견딘 원시 피해(유효 생명력)
//   swarm 몰려오는 적 시험: 스테이지 로스터의 몹이 화면 밖에서 몰려온다(초당 --rate 마리, 초당 --rate-up씩 증가).
//         봇은 평소처럼 움직인다(--still이면 제자리). 처치 속도 · 광역 · 카이팅까지 포함한 실전형 생존
//
//   node tools/tank.cjs                                     세 직업 모두, hit, 8판
//   node tools/tank.cjs --cls warlock --mode swarm --runs 16
//   node tools/tank.cjs --mode hit --base 30 --ramp 3 --max 240
//   node tools/tank.cjs --query "&stage=naxxramas&gear=92&talents=1"
//   node tools/tank.cjs --static <폴더>                     다른 코드 사본으로 측정 (변경 전후 비교)
//   node tools/tank.cjs --json
//
// 판마다 고정 시드(?seed=, 판 i는 seed+i) — 직업이 달라도 같은 시드 묶음을 쓴다. 필요: Playwright (sim.cjs 참고)
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn, execSync } = require('node:child_process');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const CLSES = opt('cls', 'all') === 'all' ? ['mage', 'warlock', 'hunter'] : opt('cls').split(',');
const MODE = opt('mode', 'hit'), RUNS = +opt('runs', 8), PRE = +opt('pre', 480), SEED = +opt('seed', 100), MAX = +opt('max', 300);
const QUERY = opt('query', '&stage=moltencore&gear=64&talents=1'), PAR = +opt('parallel', 4);
const STATIC = opt('static', path.join(__dirname, '..')), JSON_OUT = args.includes('--json');
const CFG = { mode: MODE, max: MAX, base: +opt('base', 10), ramp: +opt('ramp', 1), rate: +opt('rate', 4), rateUp: +opt('rate-up', 0.25), still: args.includes('--still'), defs: args.includes('--defs') };
// --defs: 시험 직전에 아래 생존기 중 없는 것을 1레벨로 배운다 (봇 빌드는 보통 생존기를 거의 고르지 않는다)
const DEFS = { mage: ['iceblock', 'icebarrier'], warlock: ['unendingresolve', 'healthstone', 'deathcoil'], hunter: ['turtle', 'exhilaration', 'survivalfittest'] };

const loadPlaywright = () => {
  try { return require('playwright'); } catch { /* 전역 설치 확인 */ }
  const root = execSync('npm root -g').toString().trim();
  for (const p of ['playwright', '@executeautomation/playwright-mcp-server/node_modules/playwright']) {
    try { return require(path.join(root, p)); } catch { /* 다음 후보 */ }
  }
  console.error('Playwright가 없습니다: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
};

// 서버는 임시 포트/임시 DB로 직접 띄운다 (Z:(RaiDrive)가 아닌 OS 임시 폴더)
const startServer = () => new Promise((resolve, reject) => {
  const port = 18900 + Math.floor(Math.random() * 90);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zzigame-tank-'));
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, STATIC_DIR: path.resolve(STATIC), NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  proc.stdout.on('data', d => { if (/server on/.test(d)) resolve({ url: `http://localhost:${port}`, stop: () => new Promise(done => {
    proc.removeAllListeners('exit');
    proc.once('exit', () => { try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* 임시 폴더라 남아도 무방 */ } done(); });
    proc.kill();
  }) }); });
  proc.on('exit', c => reject(new Error('서버 종료 ' + c)));
});

const runOne = async (browser, url, cls, seed) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${url}/?sim=${PRE}&seed=${seed}&cls=${cls}&god=1${QUERY}`);
  await page.waitForFunction(() => /END t=/.test(document.getElementById('errlog').textContent), null, { timeout: 0, polling: 500 });
  const r = await page.evaluate(C => {
    const p = G.player, W = G.Waves, dt = 1 / 30;
    G.params.delete('god');
    // 성장 · 난이도 고정
    const hm = W.hpMul(), dm = W.dmgMul();
    W.hpMul = () => hm; W.dmgMul = () => dm; W.update = () => {};
    Object.assign(G.Bot, { on: true, sync: true }); Object.assign(G, { simulating: true, paused: false, state: 'play' });
    Object.assign(G, { enemies: [], zones: [], tele: [], eprojs: [], pickups: [], chests: [] }); p.pendingLv = 0;
    if (C.defs) for (const id of C.defs) if (!p.skills[id]) G.P.learn(id);
    p.hp = p.maxHp;
    const start = { level: p.level, maxHp: Math.round(p.maxHp), armor: +(Math.min(0.6, p.stats.armor) * 100).toFixed(1), vers: +((p.stats.vers || 0) * 50).toFixed(1), revives: p.revives || 0 };

    // 피해 기록: 원시(배율 전) · 보호막 흡수 · 실제 생명력 손실
    let raw = 0, lost = 0, absorbed = 0, immuneT = 0, saves = 0;
    const hurt = G.hurtPlayer;
    G.hurtPlayer = (d, src) => {
      const immune = G.cls(p).immune(p);
      if (!p.dead && !immune) raw += d * dm;
      const h0 = p.hp, a0 = p.absorb || 0;
      hurt(d, src);
      absorbed += Math.max(0, a0 - (p.absorb || 0));
      lost += Math.max(0, h0 - Math.max(0, p.hp));
    };
    const pd = G.playerDeath; let revUsed = 0;
    G.playerDeath = () => { if (p.revives > 0) revUsed++; pd(); };
    const cl = G.cls(p), pv = cl.preventDeath.bind(cl);
    cl.preventDeath = q => { const ok = pv(q); if (ok) saves++; return ok; };

    let e = null, X = 0, Y = 0;
    if (C.mode === 'hit') {
      e = G.Enemy.spawn('rhahkzor', p.x + 90, p.y); X = e.x; Y = e.y;
      e.hp = e.maxHp = 1e9; e.speed = 0; e.dmg = 0; W.boss = e;
      G.Boss.update = () => {}; // 보스 기술 없음 — 피해는 아래 고정 일정으로만
      G.Bot.dir = () => [0, 0];
    } else if (C.still) G.Bot.dir = () => [0, 0];
    G.meter.reset();
    const kills0 = G.stats.kills, hp0 = p.hp, t0 = G.t;
    let hitAcc = 0, spawnAcc = 0, hpLow = 1;
    while (!p.dead && G.t - t0 < C.max) {
      const t = G.t - t0;
      if (C.mode === 'hit') {
        G.enemies = G.enemies.filter(x => x === e); e.x = X; e.y = Y; e.atkT = 99; // 허수아비는 스스로 공격하지 않는다
        G.zones = G.zones.filter(z => !z.hurt); G.tele = []; G.eprojs = [];
        hitAcc += dt;
        if (hitAcc >= 0.5) { hitAcc -= 0.5; G.hurtPlayer((C.base + C.ramp * t) * 0.5 / dm, e); }
      } else {
        spawnAcc += (C.rate + C.rateUp * t) * dt;
        while (spawnAcc >= 1 && G.enemies.length < 450) { spawnAcc--; const [x, y] = W.ringPos(); G.Enemy.spawn(W.pickType(), x, y); }
      }
      G.pickups = []; G.chests = [];
      G.update(dt);
      if (G.UI.modalKind === 'levelup') G.pickUpgrade(0);
      if (G.cls(p).immune(p)) immuneT += dt;
      hpLow = Math.min(hpLow, Math.max(0, p.hp) / p.maxHp);
    }
    const t = G.t - t0, healed = Math.max(0, (p.dead ? 0 : p.hp) - hp0 + lost);
    return {
      ...start, dead: p.dead, t: +t.toFixed(1), raw: Math.round(raw), lost: Math.round(lost), absorbed: Math.round(absorbed), healed: Math.round(healed),
      immuneT: +immuneT.toFixed(1), saves, revUsed, hpLow: Math.round(hpLow * 100),
      skills: p.order.map(id => id + p.skillLevel(id)).join(' '), passives: Object.keys(p.passives).join(' '),
      kills: G.stats.kills - kills0, dps: Math.round(G.meter.total / Math.max(1, t)),
      cause: p.dead && G.RunLog && G.RunLog.snapshot().death ? G.RunLog.snapshot().death.by : null,
    };
  }, { ...CFG, defs: CFG.defs ? DEFS[cls] || [] : null });
  r.cls = cls; r.seed = seed; r.errs = errors;
  await page.close();
  return r;
};

(async () => {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const results = [], queue = CLSES.flatMap(c => Array.from({ length: RUNS }, (_, i) => [c, SEED + i])), total = queue.length;
  try {
    await Promise.all(Array.from({ length: Math.min(PAR, total) }, async () => {
      while (queue.length) {
        const [c, s] = queue.shift();
        results.push(await runOne(browser, server.url, c, s));
        if (!JSON_OUT) process.stderr.write(`\r${results.length}/${total} 완료`);
      }
    }));
  } finally { await browser.close(); await server.stop(); }
  results.sort((a, b) => CLSES.indexOf(a.cls) - CLSES.indexOf(b.cls) || a.seed - b.seed);
  if (JSON_OUT) { console.log(JSON.stringify(results, null, 2)); return; }

  const pad = (v, n) => String(v).padStart(n), avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const desc = (CFG.defs ? '생존기 추가 · ' : '') + (MODE === 'hit' ? `받는 피해 (원시 DPS ${CFG.base} + 초당 ${CFG.ramp})` : `몰려오는 적 (초당 ${CFG.rate}마리 + 초당 ${CFG.rateUp}${CFG.still ? ' · 제자리' : ''})`);
  console.log(`\n\n생존 측정 · ${desc} · ${RUNS}판 · ${PRE}초 진행 후 최대 ${MAX}초 · 쿼리 "${QUERY}"${STATIC !== path.join(__dirname, '..') ? ' · 코드 ' + STATIC : ''}\n`);
  console.log(' 직업      seed  레벨  생명력  방어  유연   견딘초  원시피해   손실   흡수   치유  면역초 방지 최저%  처치   DPS');
  for (const r of results) {
    console.log(`${r.cls.padEnd(8)} ${pad(r.seed, 5)}  ${pad(r.level, 4)}  ${pad(r.maxHp, 6)}  ${pad(r.armor, 4)}  ${pad(r.vers, 4)}  ${pad(r.dead ? r.t : r.t + '+', 7)}  ${pad(r.raw, 8)}  ${pad(r.lost, 5)}  ${pad(r.absorbed, 5)}  ${pad(r.healed, 5)}  ${pad(r.immuneT, 6)}  ${pad(r.saves + r.revUsed, 3)}  ${pad(r.hpLow, 4)}  ${pad(r.kills, 5)}  ${pad(r.dps, 5)}${r.errs.length ? '  ⚠ ' + r.errs[0] : ''}`);
  }
  console.log('\n직업 요약          견딘초(평균·중앙)  원시피해(유효 생명력)  생명력   치유   흡수  면역초  생존판');
  for (const c of CLSES) {
    const R = results.filter(r => r.cls === c); if (!R.length) continue;
    console.log(`${c.padEnd(8)}          ${pad(avg(R.map(r => r.t)).toFixed(1), 6)} · ${pad(med(R.map(r => r.t)), 5)}       ${pad(Math.round(avg(R.map(r => r.raw))), 8)}            ${pad(Math.round(avg(R.map(r => r.maxHp))), 6)}  ${pad(Math.round(avg(R.map(r => r.healed))), 5)}  ${pad(Math.round(avg(R.map(r => r.absorbed))), 5)}  ${pad(avg(R.map(r => r.immuneT)).toFixed(1), 5)}   ${R.filter(r => !r.dead).length}/${R.length}`);
  }
  if (results.some(r => r.errs.length)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
