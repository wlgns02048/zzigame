#!/usr/bin/env node
'use strict';
// ================= 밸런스 시뮬레이터 =================
// 봇으로 여러 판을 화면 없이 돌려 생존 시간 · 클리어율 · DPS를 표로 출력한다.
// 판마다 고정 시드(?seed=)라서 코드가 같으면 결과도 같다 → 수치 변경 전후 비교에 쓴다.
//
//   node tools/sim.cjs                       기본: 8판, 15분 20초까지
//   node tools/sim.cjs --runs 16 --secs 600
//   node tools/sim.cjs --query "&all=1"      게임 URL 파라미터 추가 (?all, ?god 등)
//   node tools/sim.cjs --seed 100            시드 시작값 (판 i는 seed+i)
//   node tools/sim.cjs --query "&stage=naxxramas&cls=warlock&diff=heroic&gear=92&talents=1"
//                                            스테이지 · 직업 · 난이도, 가상 장비(영웅 풀세트 아이템 레벨) · 직업 특성 31점
//   node tools/sim.cjs --query "&auto=1"     핵심 주문을 모두 자동 시전으로 (재사용 대기시간 페널티 적용)
//   node tools/sim.cjs --json                결과를 JSON으로
//
// 필요: Playwright (npm i -g playwright 후 npx playwright install chromium)
// 서버는 임시 포트/임시 DB로 직접 띄운다. Z:(RaiDrive)가 아닌 OS 임시 폴더를 쓴다.
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn, execSync } = require('node:child_process');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const RUNS = +opt('runs', 8), SECS = +opt('secs', 920), SEED = +opt('seed', 12345), QUERY = opt('query', ''), PAR = +opt('parallel', 4);
const JSON_OUT = args.includes('--json');

const loadPlaywright = () => {
  try { return require('playwright'); } catch { /* 전역 설치 확인 */ }
  const root = execSync('npm root -g').toString().trim();
  for (const p of ['playwright', '@executeautomation/playwright-mcp-server/node_modules/playwright']) {
    try { return require(path.join(root, p)); } catch { /* 다음 후보 */ }
  }
  console.error('Playwright가 없습니다: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
};

const startServer = () => new Promise((resolve, reject) => {
  const port = 18900 + Math.floor(Math.random() * 90);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zzigame-sim-'));
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  proc.stdout.on('data', d => { if (/server on/.test(d)) resolve({ url: `http://localhost:${port}`, stop: () => new Promise(done => {
    // Windows는 프로세스가 끝나야 DB 파일 잠금이 풀린다
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
  await page.goto(`${url}/?sim=${SECS}&seed=${seed}${QUERY}`);
  await page.waitForFunction(() => /END t=/.test(document.getElementById('errlog').textContent), null, { timeout: 0, polling: 500 });
  const r = await page.evaluate(() => {
    const p = G.player, log = document.getElementById('errlog').textContent;
    return {
      t: Math.round(G.t), dead: p.dead, victory: !p.dead && G.state === 'over', level: p.level, kills: G.stats.kills,
      dps: Math.round(G.meter.total / Math.max(1, G.t)), gold: Math.round(G.stats.gold),
      boss: G.Waves.boss ? `${G.Waves.boss.id}:${Math.max(0, Math.round(G.Waves.boss.hp / G.Waves.boss.maxHp * 100))}%` : '-',
      top: Object.entries(G.meter.d).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + Math.round(v / Math.max(1, G.meter.total) * 100) + '%').join(','),
      errs: log.split('\n').filter(l => l.startsWith('ERR')),
    };
  });
  r.seed = seed; r.errs = r.errs.concat(errors);
  await page.close();
  return r;
};

(async () => {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const results = [], queue = Array.from({ length: RUNS }, (_, i) => SEED + i);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(PAR, RUNS) }, async () => {
    while (queue.length) {
      const seed = queue.shift();
      results.push(await runOne(browser, server.url, seed));
      if (!JSON_OUT) process.stderr.write(`\r${results.length}/${RUNS} 완료`);
    }
  }));
  await browser.close(); await server.stop();
  results.sort((a, b) => a.seed - b.seed);
  if (JSON_OUT) { console.log(JSON.stringify(results, null, 2)); return; }

  const pad = (v, n) => String(v).padStart(n);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  console.log(`\n\n시뮬레이션 ${RUNS}판 · 최대 ${fmt(SECS)} · 쿼리 "${QUERY}" · ${((Date.now() - t0) / 1000).toFixed(0)}초 소요\n`);
  console.log(' seed   결과    시간  레벨   처치    DPS  보스          주력 주문');
  for (const r of results) {
    const res = r.victory ? '승리' : r.dead ? '사망' : '생존';
    console.log(`${pad(r.seed, 5)}   ${res}   ${fmt(r.t)}  ${pad(r.level, 4)}  ${pad(r.kills, 5)}  ${pad(r.dps, 5)}  ${r.boss.padEnd(13)} ${r.top}${r.errs.length ? '  ⚠ ' + r.errs[0] : ''}`);
  }
  const ts = results.map(r => r.t).sort((a, b) => a - b), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`\n클리어율 ${results.filter(r => r.victory).length}/${RUNS} · 생존 평균 ${fmt(Math.round(avg(ts)))} · 중앙값 ${fmt(ts[Math.floor(ts.length / 2)])} · 평균 DPS ${Math.round(avg(results.map(r => r.dps)))} · 평균 레벨 ${avg(results.map(r => r.level)).toFixed(1)}`);
  const errCount = results.filter(r => r.errs.length).length;
  if (errCount) { console.log(`⚠ 오류가 난 판: ${errCount}`); process.exitCode = 1; }
})();
