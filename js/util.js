'use strict';
// 전역 네임스페이스
const G = window.G = {
  state: 'menu',      // menu | play | over
  paused: false,
  t: 0,               // 런 경과 시간(초)
  W: 1280, H: 720,
  enemies: [], projs: [], eprojs: [], zones: [], tele: [], pickups: [],
  parts: [], texts: [], rings: [], pets: [], images: [], delayed: [],
  cam: { x: 0, y: 0, shake: 0 },
  mouse: { sx: 0, sy: 0, x: 0, y: 0, down: false },
  keys: {},
  params: new URLSearchParams(location.search),
};

// ?seed=N: 난수를 고정해 같은 조건이면 같은 결과가 나오게 한다 (밸런스 시뮬레이터용)
if (G.params.get('seed')) {
  let a = (+G.params.get('seed')) >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 직업 레지스트리 (js/classes/*.js 에서 채움)
G.CLASSES = {};
G.cls = (p = G.player) => G.CLASSES[p.cls];

window.addEventListener('error', e => {
  const el = document.getElementById('errlog');
  if (el) el.textContent += `ERR ${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}\n`;
});

G.U = {
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  d2: (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  choice: a => a[Math.floor(Math.random() * a.length)],
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
  fmtTime(s) { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); },
  num(n) { n = Math.round(n); if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K'; return n.toLocaleString(); },
  wpick(items, wf) {
    let tot = 0; for (const it of items) tot += wf(it);
    let r = Math.random() * tot;
    for (const it of items) { r -= wf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  },
  // 결정적 해시 랜덤 (장식물 배치용)
  hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; },
};

// 게임 시간 기준 지연 실행
G.later = (delay, fn) => G.delayed.push({ t: delay, fn });

// 공간 해시 (적 충돌 탐색)
G.Grid = {
  cell: 80, map: new Map(),
  key(cx, cy) { return (cx + 5000) * 10007 + (cy + 5000); },
  clear() { for (const a of this.map.values()) a.length = 0; },
  add(e) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(e);
  },
  // 반경 안의 적 (적 반지름 포함)
  query(x, y, r, out = []) {
    if (!(r >= 0) || !isFinite(x + y)) return out;
    r = Math.min(r, 1500);
    const c = this.cell, x0 = Math.floor((x - r - 50) / c), x1 = Math.floor((x + r + 50) / c);
    const y0 = Math.floor((y - r - 50) / c), y1 = Math.floor((y + r + 50) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = this.map.get(this.key(cx, cy)); if (!a) continue;
      for (const e of a) {
        if (e.dead) continue;
        const rr = r + e.r; const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy <= rr * rr) out.push(e);
      }
    }
    return out;
  },
};

G.nearestEnemy = (x, y, range = 99999, filter) => {
  let best = null, bd = range * range;
  for (const e of G.enemies) {
    if (e.dead || (filter && !filter(e))) continue;
    const d = G.U.d2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
};

// 적이 가장 밀집한 지점 찾기 (샘플링)
G.densestPoint = (x, y, range, radius) => {
  const b = G.Waves && G.Waves.boss;
  if (b && !b.dead && Math.random() < 0.5 && G.U.d2(x, y, b.x, b.y) < range * range) return { x: b.x, y: b.y, n: 1 };
  let best = null, bc = 0;
  const cand = G.enemies.filter(e => !e.dead && G.U.d2(x, y, e.x, e.y) < range * range);
  const n = Math.min(cand.length, 24);
  for (let i = 0; i < n; i++) {
    const e = cand[Math.floor(Math.random() * cand.length)];
    const c = G.Grid.query(e.x, e.y, radius).length;
    if (c > bc) { bc = c; best = e; }
  }
  return best ? { x: best.x, y: best.y, n: bc } : null;
};
