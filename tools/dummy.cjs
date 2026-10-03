#!/usr/bin/env node
'use strict';
// ================= 허수아비 측정 (단일 대상 화력) =================
// 무적(?god=1)으로 --pre초까지 봇이 판을 진행해 레벨 · 주문을 쌓은 뒤, 몹을 모두 치우고
// 움직이지 않는 보스 허수아비(생명력 10억)를 --dur초 동안 때려 DPS를 잰다.
// 생존 · 이동은 결과에 들어가지 않으므로 봇의 생존 실력과 상관없이 직업 간 · 수치 변경 전후 보스 화력을 비교할 수 있다.
// 허수아비는 G.Waves.boss로 등록해서 보스 대상 판단(얼어붙음 · 악의적인 환희 사용 등)이 실제 보스전처럼 돈다.
//
//   node tools/dummy.cjs --cls mage                        기본: 8판, 화산 심장부 · 템렙 64 · 특성 31점, 8분 진행 후 90초
//   node tools/dummy.cjs --cls warlock --runs 16 --pre 300 --dur 60
//   node tools/dummy.cjs --cls hunter --query "&stage=naxxramas&gear=92&talents=1"
//   node tools/dummy.cjs --cls warlock --static <폴더>     다른 코드 사본으로 측정 (변경 전후 비교: git show로 옛 파일을 넣은 사본)
//   node tools/dummy.cjs --json
//
// 판마다 고정 시드(?seed=, 판 i는 seed+i) — tools/sim.cjs와 같다. 필요: Playwright (sim.cjs 참고)
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn, execSync } = require('node:child_process');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const CLS = opt('cls', 'mage'), RUNS = +opt('runs', 8), PRE = +opt('pre', 480), DUR = +opt('dur', 90), SEED = +opt('seed', 100);
const QUERY = opt('query', '&stage=moltencore&gear=64&talents=1'), PAR = +opt('parallel', 4);
const STATIC = opt('static', path.join(__dirname, '..')), JSON_OUT = args.includes('--json');

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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zzigame-dummy-'));
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

const runOne = async (browser, url, seed) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${url}/?sim=${PRE}&seed=${seed}&cls=${CLS}&god=1${QUERY}`);
  await page.waitForFunction(() => /END t=/.test(document.getElementById('errlog').textContent), null, { timeout: 0, polling: 500 });
  const r = await page.evaluate(dur => {
    const p = G.player;
    // 웨이브를 멈추고 봇은 제자리에서 싸운다 (이동 없음)
    G.Waves.update = () => {}; G.Bot.dir = () => [0, 0];
    Object.assign(G.Bot, { on: true, sync: true }); Object.assign(G, { simulating: true, paused: false, state: 'play' });
    Object.assign(G, { enemies: [], zones: [], tele: [], eprojs: [], pickups: [], chests: [] }); p.pendingLv = 0;
    const e = G.Enemy.spawn('rhahkzor', p.x + 250, p.y), X = e.x, Y = e.y;
    e.hp = e.maxHp = 1e9; e.speed = 0; e.dmg = 0; G.Waves.boss = e;
    G.meter.reset();
    const t0 = G.t;
    for (let i = 0; i < 30 * dur; i++) {
      G.enemies = G.enemies.filter(x => x === e); e.x = X; e.y = Y; // 소환된 쫄 · 돌진 이동 제거
      G.update(1 / 30);
      if (G.UI.modalKind === 'levelup') G.pickUpgrade(0);
    }
    const t = G.t - t0, tot = G.meter.total;
    return {
      level: p.level, dps: Math.round(tot / t),
      top: Object.entries(G.meter.d).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${Math.round(v / tot * 100)}%`).join(','),
      skills: p.order.map(id => id + p.skillLevel(id)).join(' '),
    };
  }, DUR);
  r.seed = seed; r.errs = errors;
  await page.close();
  return r;
};

(async () => {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const results = [], queue = Array.from({ length: RUNS }, (_, i) => SEED + i);
  try {
    await Promise.all(Array.from({ length: Math.min(PAR, RUNS) }, async () => {
      while (queue.length) {
        results.push(await runOne(browser, server.url, queue.shift()));
        if (!JSON_OUT) process.stderr.write(`\r${results.length}/${RUNS} 완료`);
      }
    }));
  } finally { await browser.close(); await server.stop(); }
  results.sort((a, b) => a.seed - b.seed);
  if (JSON_OUT) { console.log(JSON.stringify(results, null, 2)); return; }
  const pad = (v, n) => String(v).padStart(n), ds = results.map(r => r.dps).sort((a, b) => a - b);
  console.log(`\n\n허수아비 ${CLS} · ${RUNS}판 · ${PRE}초 진행 후 ${DUR}초 · 쿼리 "${QUERY}"${STATIC !== path.join(__dirname, '..') ? ' · 코드 ' + STATIC : ''}\n`);
  console.log(' seed  레벨    DPS  주력 주문');
  for (const r of results) console.log(`${pad(r.seed, 5)}  ${pad(r.level, 4)}  ${pad(r.dps, 5)}  ${r.top}${r.errs.length ? '  ⚠ ' + r.errs[0] : ''}`);
  console.log(`\n평균 DPS ${Math.round(ds.reduce((a, b) => a + b, 0) / ds.length)} · 중앙값 ${ds[ds.length >> 1]} · 최저 ${ds[0]} · 최고 ${ds[ds.length - 1]}`);
  if (results.some(r => r.errs.length)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
