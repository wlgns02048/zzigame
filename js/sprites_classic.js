'use strict';
// ================= 오리지널 챕터 적 · 보스 스프라이트 =================
// 손그림 대신 몇 가지 생성기(인간형 · 네발짐승 · 거미 · 용 · 정령 · 유령)에 색과 장비만 바꿔 찍어낸다.
// sprites.js의 도우미(ell, poly, line, lg, rg, eyes)를 그대로 쓴다.

// 인간형 (기본 좌표 64×76). o: skin, cloth, cloth2, pants, trim, head, weapon, robe, tabard, cape, eye, shield, fur
function drawHumanoid(x, o) {
  const skin = o.skin || '#e0b896', c1 = o.cloth || '#6b4b2a', c2 = o.cloth2 || '#3a2614', pants = o.pants || '#3b3226';
  if (o.cape) poly(x, [[22, 28], [42, 28], [48, 64], [16, 64]], o.cape);
  // 다리 / 로브
  if (o.robe) {
    poly(x, [[21, 28], [43, 28], [49, 68], [15, 68]], lg(x, 0, 28, 0, 68, [[0, c1], [1, c2]]));
    if (o.trim) { poly(x, [[15, 68], [49, 68], [48, 64], [16, 64]], o.trim); line(x, 32, 32, 32, 64, o.trim, 2); }
  } else if (o.tail) {
    poly(x, [[21, 40], [43, 40], [36, 62], [30, 74], [26, 62]], lg(x, 0, 40, 0, 74, [[0, c1], [1, 'rgba(0,0,0,0)']]));
  } else {
    line(x, 27, 48, 24, 66, pants, 5); line(x, 37, 48, 40, 66, pants, 5);
    line(x, 24, 66, 19, 67, '#221a12', 4); line(x, 40, 66, 45, 67, '#221a12', 4);
    poly(x, [[21, 28], [43, 28], [45, 50], [19, 50]], lg(x, 0, 28, 0, 50, [[0, c1], [1, c2]]));
  }
  if (o.tabard) { poly(x, [[26, 30], [38, 30], [37, 56], [27, 56]], o.tabard); if (o.emblem) ell(x, 32, 38, 3.2, 3.2, o.emblem); }
  if (o.belt !== false) line(x, 20, 47, 44, 47, o.trim || '#2a1a0c', 2.5);
  // 뒷팔
  line(x, 22, 31, 16, 44, o.armor || c2, 5);
  if (o.claws) { line(x, 16, 44, 12, 48, '#ddd', 1.2); line(x, 16, 44, 14, 50, '#ddd', 1.2); }
  // 어깨 (판금)
  if (o.armor) { ell(x, 21, 29, 6, 4.5, o.armor); ell(x, 43, 29, 6, 4.5, o.armor); }
  if (o.wings) {
    x.save(); x.translate(30, 30);
    poly(x, [[0, 0], [-14, -16], [-26, -14], [-30, -2], [-18, 4]], o.wings, '#000', 1);
    x.restore();
  }
  // 머리
  const hx = 32, hy = 18;
  const head = o.head || 'bald';
  if (head === 'wolf') {
    ell(x, hx, hy, 9, 9, o.fur || '#5a4a3a');
    poly(x, [[hx + 4, hy - 2], [hx + 16, hy + 2], [hx + 14, hy + 7], [hx + 4, hy + 7]], o.fur || '#5a4a3a');
    ell(x, hx + 15, hy + 2.5, 1.8, 1.6, '#111');
    poly(x, [[hx - 6, hy - 6], [hx - 4, hy - 16], [hx, hy - 8]], o.fur || '#5a4a3a'); poly(x, [[hx + 1, hy - 7], [hx + 4, hy - 16], [hx + 6, hy - 6]], o.fur || '#5a4a3a');
    line(x, hx + 6, hy + 7, hx + 13, hy + 7, '#eee', 1);
  } else if (head === 'bull') {
    ell(x, hx, hy, 10, 10, skin); ell(x, hx + 7, hy + 4, 5, 4, '#6b5040'); ell(x, hx + 9, hy + 4, 1, 1, '#000');
    x.beginPath(); x.arc(hx - 10, hy - 8, 7, Math.PI * 0.2, Math.PI * 0.9); x.strokeStyle = '#e8dcc0'; x.lineWidth = 3; x.stroke();
    x.beginPath(); x.arc(hx + 10, hy - 8, 7, Math.PI * 0.1, Math.PI * 0.8); x.stroke();
  } else if (head === 'dragon') {
    ell(x, hx, hy, 9, 9, skin);
    poly(x, [[hx + 4, hy - 3], [hx + 17, hy + 1], [hx + 15, hy + 7], [hx + 4, hy + 6]], skin);
    poly(x, [[hx - 5, hy - 6], [hx - 12, hy - 18], [hx - 1, hy - 9]], o.horn || '#d8cfa8'); poly(x, [[hx + 1, hy - 8], [hx - 2, hy - 20], [hx + 5, hy - 9]], o.horn || '#d8cfa8');
  } else if (head === 'kobold') {
    ell(x, hx, hy + 2, 8, 8, skin);
    poly(x, [[hx + 4, hy], [hx + 13, hy + 4], [hx + 4, hy + 8]], skin); ell(x, hx + 12.5, hy + 4, 1.4, 1.4, '#222');
    poly(x, [[hx - 7, hy - 4], [hx - 14, hy - 9], [hx - 6, hy]], skin);
    ell(x, hx - 1, hy - 6, 3, 2, '#e8e0c8'); line(x, hx - 1, hy - 8, hx - 1, hy - 13, '#f5f0e0', 2);
    x.globalCompositeOperation = 'lighter'; ell(x, hx - 1, hy - 15, 3, 4, 'rgba(255,200,80,0.9)'); x.globalCompositeOperation = 'source-over';
  } else if (head === 'skull') {
    ell(x, hx, hy, 8, 8.5, rg(x, hx - 2, hy - 3, 10, [[0, '#fbf6e6'], [1, '#bdb59d']]));
    ell(x, hx + 2, hy - 1, 2.2, 2.4, '#1b1210'); ell(x, hx + 6, hy - 0.5, 1.8, 2.2, '#1b1210');
  } else {
    ell(x, hx, hy, 8, 9, skin);
    if (o.beard) poly(x, [[hx - 2, hy + 4], [hx + 9, hy + 4], [hx + 5, hy + 14], [hx, hy + 12]], o.beard);
    if (o.hair) poly(x, [[hx - 9, hy - 2], [hx - 2, hy - 11], [hx + 8, hy - 8], [hx + 2, hy - 5], [hx - 6, hy + 14], [hx - 10, hy + 10]], o.hair);
  }
  if (head === 'hood' || o.hood) { poly(x, [[hx, hy - 14], [hx + 10, hy + 2], [hx + 6, hy + 12], [hx - 8, hy + 12], [hx - 11, hy + 2]], o.hood || c1); ell(x, hx + 2, hy + 4, 5.5, 6.5, '#0b0612'); }
  if (head === 'helm') { poly(x, [[hx - 9, hy - 2], [hx - 7, hy - 10], [hx + 7, hy - 10], [hx + 9, hy - 2], [hx + 9, hy + 6], [hx - 9, hy + 6]], o.armor || '#8a8f99', '#222', 1); line(x, hx - 1, hy - 2, hx + 9, hy - 2, '#111', 2); }
  if (head === 'horned') { poly(x, [[hx - 9, hy - 2], [hx - 7, hy - 10], [hx + 7, hy - 10], [hx + 9, hy - 2], [hx + 9, hy + 6], [hx - 9, hy + 6]], o.armor || '#333', '#000', 1); poly(x, [[hx - 7, hy - 8], [hx - 16, hy - 20], [hx - 4, hy - 10]], '#ddd'); poly(x, [[hx + 7, hy - 8], [hx + 14, hy - 20], [hx + 4, hy - 10]], '#ddd'); }
  if (head === 'bandana') { poly(x, [[hx - 9, hy - 3], [hx + 9, hy - 3], [hx + 9, hy + 2], [hx - 9, hy + 2]], o.mask || '#b0201c'); poly(x, [[hx - 2, hy + 4], [hx + 9, hy + 4], [hx + 8, hy + 10], [hx - 1, hy + 10]], o.mask || '#b0201c'); }
  if (head === 'crown' || o.crown) poly(x, [[hx - 8, hy - 6], [hx - 8, hy - 13], [hx - 4, hy - 9], [hx, hy - 15], [hx + 4, hy - 9], [hx + 8, hy - 13], [hx + 8, hy - 6]], o.crown || '#e8c050', '#5a4010', 1);
  if (o.eye) eyes(x, head === 'hood' || o.hood ? [[hx + 2, hy + 4], [hx + 5, hy + 4.5]] : [[hx + 3, hy - 1], [hx + 6.5, hy - 0.5]], o.eye, 1.3);
  // 앞팔 + 무기
  line(x, 42, 31, 47, 42, o.armor || c1, 5);
  ell(x, 47, 42, 3, 3, o.claws ? (o.fur || skin) : skin);
  if (o.claws) { line(x, 48, 44, 53, 46, '#eee', 1.3); line(x, 48, 42, 54, 42, '#eee', 1.3); }
  const wpn = o.weapon;
  if (wpn === 'dagger') { line(x, 47, 42, 56, 33, '#cfd8e0', 2.5); line(x, 45, 44, 49, 40, '#6a4a2a', 3); }
  else if (wpn === 'sword') { line(x, 47, 42, 58, 18, '#dfe6ee', 3); line(x, 47, 42, 58, 18, '#fff', 1); line(x, 43, 40, 51, 44, '#8a6a20', 3); }
  else if (wpn === 'axe') { line(x, 47, 46, 54, 16, '#6a4423', 3); poly(x, [[52, 14], [62, 12], [62, 26], [54, 24]], '#b8c0c8', '#333', 1); }
  else if (wpn === 'mace') { line(x, 47, 46, 54, 20, '#6a4423', 3.5); ell(x, 54, 18, 6, 6, '#9aa0a8'); }
  else if (wpn === 'staff') { line(x, 50, 8, 46, 70, '#5a3a1a', 3); ell(x, 50, 7, 4.5, 4.5, o.orb || '#c060ff'); x.globalCompositeOperation = 'lighter'; ell(x, 50, 7, 7, 7, 'rgba(255,255,255,0.25)'); x.globalCompositeOperation = 'source-over'; }
  else if (wpn === 'hammer') { line(x, 47, 46, 58, 10, '#3a2a1a', 4); poly(x, [[50, 4], [66, 4], [66, 16], [50, 16]], o.orb || '#ffb040', '#401000', 1.5); }
  if (o.shield) { ell(x, 17, 42, 7, 9, o.shield); ell(x, 17, 42, 2.5, 3, o.emblem || '#e8c050'); }
}

// 네발짐승 (70×50): 늑대 · 사냥개 · 용암 사냥개
function drawBeast(x, o) {
  const f1 = o.fur || '#6a6a70', f2 = o.fur2 || '#3a3a40';
  const leg = (sx, ex) => line(x, sx, 30, ex, 46, f2, 4);
  leg(18, 15); leg(24, 27); leg(46, 44); leg(52, 55);
  x.beginPath(); x.moveTo(12, 24); x.quadraticCurveTo(2, 16, 4, 6); x.strokeStyle = f2; x.lineWidth = 4; x.stroke();
  ell(x, 34, 26, 22, 10, lg(x, 0, 16, 0, 36, [[0, f1], [1, f2]]));
  if (o.mane) { x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) ell(x, 22 + i * 7, 17, 4, 5, o.mane); x.globalCompositeOperation = 'source-over'; }
  const head = (hx, hy) => {
    ell(x, hx, hy, 8, 7, f1);
    poly(x, [[hx + 3, hy - 2], [hx + 14, hy + 1], [hx + 13, hy + 6], [hx + 3, hy + 5]], f1);
    ell(x, hx + 13, hy + 2, 1.6, 1.5, '#111');
    poly(x, [[hx - 5, hy - 5], [hx - 3, hy - 13], [hx + 1, hy - 6]], f2);
    eyes(x, [[hx + 3, hy - 2]], o.eye || '#ffd040', 1.3);
    line(x, hx + 5, hy + 5, hx + 12, hy + 5, '#eee', 0.9);
  };
  head(54, 18);
  if (o.twoHeads) head(48, 12);
}

// 거미 (64×48)
function drawSpider(x, o) {
  const c = o.body || '#3a2a3a', l = o.leg || '#1a121a';
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.6;
    line(x, 34, 28, 34 + Math.cos(a) * 18, 28 + Math.sin(a) * 10 - 8, l, 2.4);
    line(x, 34 + Math.cos(a) * 18, 28 + Math.sin(a) * 10 - 8, 34 + Math.cos(a) * 28, 44, l, 2);
    line(x, 30, 28, 30 - Math.cos(a) * 18, 28 + Math.sin(a) * 10 - 8, l, 2.4);
    line(x, 30 - Math.cos(a) * 18, 28 + Math.sin(a) * 10 - 8, 30 - Math.cos(a) * 28, 44, l, 2);
  }
  ell(x, 22, 26, 13, 11, lg(x, 0, 15, 0, 37, [[0, o.light || '#6a4a6a'], [1, c]]));
  if (o.mark) ell(x, 22, 24, 4, 5, o.mark);
  ell(x, 40, 28, 8, 7, c);
  eyes(x, [[44, 26], [46, 27], [43, 29], [46, 29.5]], o.eye || '#ff3030', 1.1);
  line(x, 46, 31, 50, 35, '#ddd', 1.2);
}

// 새끼용 / 용 (64×52)
function drawDragon(x, o) {
  const s1 = o.scale || '#a03020', s2 = o.scale2 || '#501008';
  const wing = sc => { x.save(); x.translate(30, 22); x.scale(sc, 1); poly(x, [[0, 0], [-8, -16], [-22, -20], [-30, -8], [-22, -4], [-14, 2]], o.wing || s2, '#000', 1); x.restore(); };
  wing(1);
  x.beginPath(); x.moveTo(20, 30); x.quadraticCurveTo(4, 36, 6, 22); x.strokeStyle = s2; x.lineWidth = 4; x.stroke();
  line(x, 28, 34, 26, 44, s2, 4); line(x, 38, 34, 40, 44, s2, 4);
  ell(x, 32, 28, 13, 9, lg(x, 0, 19, 0, 37, [[0, s1], [1, s2]]));
  ell(x, 30, 31, 7, 4, o.belly || '#e8c070');
  line(x, 40, 24, 46, 16, s1, 6);
  ell(x, 48, 14, 7, 6, s1);
  poly(x, [[50, 12], [60, 15], [58, 19], [50, 18]], s1);
  poly(x, [[45, 9], [42, 1], [48, 8]], '#e8dcc0');
  eyes(x, [[51, 12]], o.eye || '#ffe040', 1.3);
  wing(-0.7);
}

// 불 정령 (56×64)
function drawFlame(x, o) {
  x.globalCompositeOperation = 'lighter';
  const layers = [[o.outer || 'rgba(255,80,10,0.55)', 20, 26], [o.mid || 'rgba(255,150,30,0.8)', 14, 20], [o.core || 'rgba(255,240,170,0.95)', 7, 12]];
  for (const [col, rx, ry] of layers) {
    x.beginPath(); x.moveTo(28 - rx, 44);
    x.quadraticCurveTo(28 - rx, 44 - ry, 28 - rx * 0.4, 44 - ry * 1.7);
    x.quadraticCurveTo(28, 44 - ry * 1.2, 28 + rx * 0.3, 44 - ry * 2.1);
    x.quadraticCurveTo(28 + rx, 44 - ry, 28 + rx, 44);
    x.quadraticCurveTo(28, 60, 28 - rx, 44); x.fillStyle = col; x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  eyes(x, [[24, 26], [32, 26]], o.eye || '#fff8c0', 1.8);
}

// 바위/용암 거인 (90×100)
function drawGiant(x, o) {
  const r1 = o.rock || '#4a3a34', r2 = o.rock2 || '#221814', glow = o.glow || '#ff7020';
  line(x, 34, 74, 30, 96, r2, 12); line(x, 56, 74, 60, 96, r2, 12);
  ell(x, 45, 52, 28, 26, rg(x, 40, 42, 34, [[0, r1], [1, r2]]));
  line(x, 20, 44, 8, 70, r1, 12); line(x, 70, 44, 82, 70, r1, 12);
  ell(x, 8, 72, 8, 7, r2); ell(x, 82, 72, 8, 7, r2);
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = glow; x.lineWidth = 2.5;
  for (const [a, b, c2, d] of [[30, 40, 44, 56], [50, 36, 58, 52], [36, 60, 52, 68], [44, 44, 46, 30]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); }
  x.globalCompositeOperation = 'source-over';
  ell(x, 46, 24, 12, 11, r1);
  eyes(x, [[42, 22], [50, 22]], glow, 2.2);
}

// 유령 (60×70)
function drawGhost(x, o) {
  x.globalAlpha = 0.85;
  drawHumanoid(x, { ...o, tail: true, belt: false });
  x.globalAlpha = 1;
}

(function () {
  const H = (o, w = 64, h = 76, k = 1) => [w * k, h * k, x => { x.scale(k, k); drawHumanoid(x, o); }];
  const defias = { cloth: '#5a3a22', cloth2: '#2a1a0c', head: 'bandana', eye: '#ffd8a0' };
  const scarlet = { cloth: '#d8d0c8', cloth2: '#9a9088', tabard: '#b01818', emblem: '#f0d060', head: 'helm', armor: '#a8aab0' };
  G.EXTRA_SPRITES = {
    // ---- 죽음의 폐광 ----
    kobold: [48, 56, x => { x.scale(0.75, 0.75); drawHumanoid(x, { skin: '#8a6a4a', cloth: '#6a5a3a', cloth2: '#3a2a1a', head: 'kobold', weapon: 'dagger', eye: '#ffe060' }); }],
    defias_thug: H({ ...defias, weapon: 'dagger' }),
    defias_mage: H({ ...defias, robe: true, cloth: '#4a2a3a', cloth2: '#1a0a14', trim: '#b02020', weapon: 'staff', orb: '#ff8040' }),
    defias_goon: H({ ...defias, cloth: '#4a4a52', armor: '#6a6a72', weapon: 'mace' }, 64, 76, 1.3),
    defias_ogre: H({ skin: '#9a8a5a', cloth: '#5a4a2a', cloth2: '#2a2010', head: 'bald', weapon: 'mace', eye: '#ff4020' }, 64, 76, 1.5),
    rhahkzor: H({ skin: '#a89060', cloth: '#5a3a1a', cloth2: '#2a1a0a', head: 'bald', weapon: 'mace', eye: '#ff3010' }, 64, 76, 1.7),
    mrsmite: H({ skin: '#6a4a30', cloth: '#3a3a42', armor: '#6a6a72', head: 'bull', weapon: 'axe', eye: '#ff3010' }, 64, 76, 1.7),
    vancleef: H({ ...defias, cloth: '#2a1a1a', cloth2: '#0a0606', cape: '#7a1010', weapon: 'sword', eye: '#ff6040', mask: '#c01818' }, 64, 76, 1.6),
    // ---- 그림자송곳니 ----
    wolf: [70, 50, x => drawBeast(x, { fur: '#6a6a70', fur2: '#34343a' })],
    worgen: H({ head: 'wolf', fur: '#5a4a3a', cloth: '#5a4a3a', cloth2: '#3a2a1a', pants: '#3a2a1a', claws: true, belt: false, eye: '#ffe040' }),
    worgen_brute: H({ head: 'wolf', fur: '#3a3030', cloth: '#3a3030', cloth2: '#1a1414', pants: '#2a2020', claws: true, belt: false, eye: '#ff3020' }, 64, 76, 1.5),
    ghost: [64, 76, x => drawGhost(x, { cloth: 'rgba(170,220,255,0.75)', cloth2: 'rgba(80,120,200,0.3)', skin: '#c8e8ff', hair: '#e0f0ff', eye: '#ffffff' })],
    silverlaine: H({ skin: '#b8d0e0', cloth: '#3a4a8a', cloth2: '#1a2a5a', head: 'helm', armor: '#9aa8c0', weapon: 'sword', cape: '#2a3a7a', eye: '#a0e0ff' }, 64, 76, 1.6),
    springvale: H({ skin: '#8aa080', cloth: '#a8a8b0', cloth2: '#606068', head: 'helm', armor: '#c0c0c8', tabard: '#e0d0a0', emblem: '#f0c040', weapon: 'mace', shield: '#a09060', eye: '#80ff80' }, 64, 76, 1.6),
    arugal: H({ skin: '#c8b8a8', cloth: '#4a1a5a', cloth2: '#1a0a24', robe: true, trim: '#c060ff', hood: '#3a1048', weapon: 'staff', orb: '#b040ff', eye: '#d080ff' }, 64, 76, 1.7),
    // ---- 붉은십자군 ----
    scarlet_soldier: H({ ...scarlet, weapon: 'sword', shield: '#b01818' }),
    scarlet_hound: [70, 50, x => drawBeast(x, { fur: '#8a6a4a', fur2: '#4a3020', eye: '#ffd040' })],
    scarlet_mage: H({ ...scarlet, head: 'hood', hood: '#b01818', robe: true, cloth: '#b01818', cloth2: '#600808', trim: '#f0e0c0', weapon: 'staff', orb: '#ff8030' }),
    scarlet_monk: H({ ...scarlet, head: 'bald', cloth: '#c02020', cloth2: '#701010', armor: null, weapon: 'none' }),
    scarlet_knight: H({ ...scarlet, weapon: 'mace', shield: '#b01818' }, 64, 76, 1.45),
    loksey: H({ ...scarlet, head: 'bald', armor: null, beard: '#6a4020', weapon: 'axe' }, 64, 76, 1.6),
    doan: H({ ...scarlet, head: 'hood', hood: '#8a1010', robe: true, cloth: '#e0d8d0', cloth2: '#a01818', trim: '#f0c040', weapon: 'staff', orb: '#ff60ff', beard: '#e0e0e0' }, 64, 76, 1.6),
    whitemane: H({ skin: '#f0d0c0', hair: '#f8f8f8', robe: true, cloth: '#f0ece8', cloth2: '#b01818', trim: '#f0c040', weapon: 'mace', eye: '#a0d0ff' }, 64, 76, 1.7),
    // ---- 스칼로맨스 ----
    student: H({ robe: true, cloth: '#3a2a4a', cloth2: '#140a1c', trim: '#6a40a0', head: 'hood', hood: '#2a1a3a', weapon: 'staff', orb: '#60ff80', eye: '#60ff80' }),
    jandice: H({ skin: '#f0d0c8', hair: '#3a1a1a', robe: true, cloth: '#6a1a5a', cloth2: '#2a0a24', trim: '#e0b0ff', weapon: 'staff', orb: '#ff80ff', eye: '#ff80ff' }, 64, 76, 1.5),
    frostwhisper: H({ head: 'skull', robe: true, cloth: '#2a4a8a', cloth2: '#0a1a3a', trim: '#a0e0ff', crown: '#a0e0ff', weapon: 'staff', orb: '#80d8ff', eye: '#80e0ff' }, 64, 76, 1.65),
    gandling: H({ head: 'skull', robe: true, cloth: '#1a1a22', cloth2: '#050508', trim: '#40ff70', hood: '#101016', weapon: 'staff', orb: '#40ff70', eye: '#40ff70' }, 64, 76, 1.75),
    // ---- 스트라솔름 ----
    anastari: [96, 114, x => { x.scale(1.5, 1.5); drawGhost(x, { cloth: 'rgba(230,240,255,0.8)', cloth2: 'rgba(120,140,200,0.3)', skin: '#e8f0ff', hair: '#ffffff', eye: '#a0c0ff' }); }],
    rivendare: H({ skin: '#a0b0b8', cloth: '#2a2a32', cloth2: '#0a0a10', head: 'horned', armor: '#3a3a44', weapon: 'sword', cape: '#101018', eye: '#80d0ff' }, 64, 76, 1.75),
    // ---- 화산 심장부 ----
    fireling: [42, 48, x => { x.scale(0.75, 0.75); drawFlame(x, {}); }],
    corehound: [70, 50, x => drawBeast(x, { fur: '#6a3a1a', fur2: '#2a1408', mane: 'rgba(255,120,20,0.8)', eye: '#ffe060' })],
    flamewaker: H({ skin: '#c84a1a', cloth: '#5a1a0a', cloth2: '#2a0a04', head: 'dragon', horn: '#f0a040', armor: '#4a2a1a', weapon: 'axe', eye: '#ffe060' }),
    fireelemental: [56, 64, x => drawFlame(x, {})],
    lavagiant: [90, 100, x => drawGiant(x, {})],
    lucifron: H({ skin: '#d85a1a', cloth: '#3a0a04', cloth2: '#1a0402', head: 'dragon', horn: '#ffd060', armor: '#5a2a10', robe: true, trim: '#ff8020', weapon: 'staff', orb: '#ff4010', eye: '#fff060' }, 64, 76, 1.6),
    magmadar: [70 * 1.8, 50 * 1.8, x => { x.scale(1.8, 1.8); drawBeast(x, { fur: '#7a3a14', fur2: '#2a1004', mane: 'rgba(255,140,30,0.9)', twoHeads: true, eye: '#fff060' }); }],
    ragnaros: [130, 146, x => {
      x.scale(2.3, 2.3); drawFlame(x, { outer: 'rgba(255,60,0,0.7)', mid: 'rgba(255,140,20,0.85)', core: 'rgba(255,230,140,0.95)', eye: '#ffffff' });
      x.setTransform(1, 0, 0, 1, 0, 0); line(x, 96, 120, 116, 20, '#2a1a0a', 7); poly(x, [[100, 6], [128, 6], [128, 30], [100, 30]], '#3a3030', '#ff8020', 3);
    }],
    // ---- 검은날개 둥지 ----
    whelp: [64, 52, x => drawDragon(x, { scale: '#2a2a30', scale2: '#0a0a10', belly: '#6a6a70', eye: '#ff4020' })],
    blackrock: H({ skin: '#5a7a3a', cloth: '#3a3a42', cloth2: '#1a1a20', armor: '#4a4a52', head: 'bald', weapon: 'axe', eye: '#ff3020' }),
    drakonid: H({ skin: '#3a3a44', head: 'dragon', cloth: '#2a2a30', cloth2: '#101014', armor: '#4a4a54', wings: '#20202a', weapon: 'none', claws: true, fur: '#3a3a44', eye: '#ff4020' }, 64, 76, 1.25),
    dragon_tech: H({ skin: '#7aa050', cloth: '#5a4a3a', cloth2: '#2a2018', head: 'bald', weapon: 'staff', orb: '#40c0ff', eye: '#ffe040' }, 64, 76, 0.85),
    chromatic: H({ skin: '#8a3a8a', head: 'dragon', horn: '#f0e080', cloth: '#5a2a6a', cloth2: '#2a0a3a', armor: '#3a8a3a', wings: '#3a3a9a', claws: true, fur: '#8a3a8a', eye: '#ffe040' }, 64, 76, 1.6),
    razorgore: H({ skin: '#2a2a32', head: 'dragon', cloth: '#1a1a22', cloth2: '#08080c', armor: '#3a3a44', wings: '#18181e', claws: true, fur: '#2a2a32', eye: '#ff2010' }, 64, 76, 1.8),
    vaelastrasz: H({ skin: '#a02010', head: 'dragon', horn: '#f0d080', cloth: '#801808', cloth2: '#400804', armor: '#5a1008', wings: '#600c06', claws: true, fur: '#a02010', eye: '#40ff40' }, 64, 76, 1.85),
    nefarian: H({ skin: '#1a1a22', head: 'dragon', horn: '#c0b090', cloth: '#14141a', cloth2: '#04040a', armor: '#2a2a34', wings: '#0e0e14', cape: '#3a0a4a', claws: true, fur: '#1a1a22', eye: '#c040ff' }, 64, 76, 2.0),
    // ---- 낙스라마스 ----
    spider: [64, 48, x => drawSpider(x, {})],
    anubrekhan: [64 * 2, 48 * 2, x => { x.scale(2, 2); drawSpider(x, { body: '#2a3a2a', light: '#5a7a5a', leg: '#141e14', mark: '#c0a040', eye: '#a0ff40' }); }],
  };
})();

// ================= 스테이지 테마 (바닥 · 장식 · 입자) =================
// pal: base(바탕) · a/b(얼룩) · hi(밝은 얼룩) · acc(강조 얼룩) · sp(반짝임) · crack(균열). particles: snow | dust | ash | ember | none
G.THEMES = {
  icecrown: { pal: null, decor: ['rock', 'pine', 'pine', 'tree', 'grave', 'grave', 'saronite', 'ice', 'bones', 'rock'], particles: 'snow' },
  mine: { pal: { base: '#2a2016', a: '90,70,45', b: '20,15,10', hi: '160,130,90', acc: '200,150,60', sp: '200,180,140', crack: '120,90,60' }, decor: ['stone', 'stone', 'crate', 'crate', 'bones', 'stone', 'crate'], particles: 'dust', glow: { crate: '255,170,60' } },
  forest: { pal: { base: '#1b241a', a: '50,70,45', b: '12,18,12', hi: '110,140,100', acc: '80,120,160', sp: '150,170,140', crack: '70,90,60' }, decor: ['tree', 'tree', 'tree', 'grave', 'stone'], particles: 'none' },
  monastery: { pal: { base: '#2a2626', a: '90,80,80', b: '25,20,20', hi: '170,160,150', acc: '200,40,40', sp: '200,190,180', crack: '120,100,100' }, decor: ['pillar', 'pillar', 'grave', 'stone', 'crate'], particles: 'none' },
  crypt: { pal: { base: '#1c1f24', a: '60,70,60', b: '10,12,10', hi: '120,130,120', acc: '80,255,120', sp: '160,200,160', crack: '60,120,70' }, decor: ['grave', 'bones', 'pillar', 'stone', 'bones'], particles: 'ash' },
  ruins: { pal: { base: '#25201e', a: '80,60,50', b: '20,14,12', hi: '150,120,100', acc: '255,120,40', sp: '200,170,150', crack: '140,80,50' }, decor: ['tree', 'grave', 'bones', 'stone', 'crate'], particles: 'ember' },
  lava: { pal: { base: '#2a140c', a: '120,40,10', b: '20,8,4', hi: '180,80,30', acc: '255,110,20', sp: '255,180,100', crack: '255,120,40' }, decor: ['lavarock', 'lavarock', 'stone', 'bones'], particles: 'ember', glow: { lavarock: '255,110,20' } },
  lair: { pal: { base: '#1e1a1a', a: '70,50,50', b: '15,10,10', hi: '130,100,100', acc: '200,60,255', sp: '180,150,150', crack: '160,60,60' }, decor: ['stone', 'bones', 'lavarock', 'pillar'], particles: 'ash', glow: { lavarock: '255,90,30' } },
  necropolis: { pal: { base: '#1a1f22', a: '50,80,70', b: '10,14,12', hi: '110,140,130', acc: '60,255,200', sp: '150,200,190', crack: '60,160,130' }, decor: ['web', 'bones', 'grave', 'pillar', 'saronite'], particles: 'ash' },
};
G.theme = () => G.THEMES[(G.state !== 'menu' && G.Waves.stage && G.Waves.stage.theme) || 'icecrown'];

function drawThemeGround(x, w, h, pal) {
  x.fillStyle = pal.base; x.fillRect(0, 0, w, h);
  const blob = (cx, cy, r, col, sy = 1) => {
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.save(); x.translate(cx + ox, cy + oy); x.scale(1, sy); x.translate(-(cx + ox), -(cy + oy));
      x.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2); x.restore();
    }
  };
  let s = 11; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 40; i++) blob(R() * w, R() * h, 60 + R() * 120, `rgba(${R() < 0.5 ? pal.a : pal.b},${0.25 + R() * 0.25})`, 0.6 + R() * 0.4);
  for (let i = 0; i < 22; i++) blob(R() * w, R() * h, 40 + R() * 80, `rgba(${pal.hi},${0.06 + R() * 0.08})`, 0.4 + R() * 0.3);
  for (let i = 0; i < 8; i++) blob(R() * w, R() * h, 30 + R() * 50, `rgba(${pal.acc},${0.06 + R() * 0.08})`, 0.35);
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${pal.sp},${0.04 + R() * 0.12})`; x.fillRect(R() * w, R() * h, R() < 0.9 ? 1 : 2, 1); }
  x.strokeStyle = `rgba(${pal.crack},0.12)`; x.lineWidth = 1;
  for (let i = 0; i < 14; i++) { let px = R() * w, py = R() * h; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 5; j++) { px += (R() - 0.5) * 50; py += (R() - 0.5) * 30; x.lineTo(px, py); } x.stroke(); }
}
function drawCrate(x) {
  poly(x, [[6, 18], [44, 18], [44, 48], [6, 48]], lg(x, 0, 18, 0, 48, [[0, '#8a6a3a'], [1, '#4a3418']]), '#2a1a08', 1.5);
  poly(x, [[6, 18], [16, 10], [54, 10], [44, 18]], '#9a7a48', '#2a1a08', 1.5); poly(x, [[44, 18], [54, 10], [54, 40], [44, 48]], '#5a4020', '#2a1a08', 1.5);
  line(x, 6, 18, 44, 48, '#3a2810', 2); line(x, 44, 18, 6, 48, '#3a2810', 2);
}
function drawPillar(x) {
  poly(x, [[10, 8], [38, 8], [36, 92], [12, 92]], lg(x, 10, 0, 38, 0, [[0, '#6a6460'], [0.5, '#a8a29c'], [1, '#5a5450']]), '#2a2624', 1.5);
  poly(x, [[4, 2], [44, 2], [42, 10], [6, 10]], '#8a847e', '#2a2624', 1.5); poly(x, [[6, 92], [42, 92], [44, 100], [4, 100]], '#7a746e', '#2a2624', 1.5);
  for (let i = 0; i < 3; i++) line(x, 16 + i * 8, 14, 16 + i * 8, 88, 'rgba(0,0,0,0.25)', 1.5);
}
function drawLavaRock(x) {
  poly(x, [[4, 44], [10, 18], [26, 8], [46, 14], [58, 36], [52, 48], [10, 50]], lg(x, 0, 8, 0, 50, [[0, '#4a3028'], [1, '#1a0e0a']]), '#0a0504', 1.5);
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,120,30,0.9)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(14, 40); x.lineTo(24, 28); x.lineTo(36, 34); x.lineTo(48, 22); x.stroke(); x.globalCompositeOperation = 'source-over';
}
function drawWeb(x) {
  x.strokeStyle = 'rgba(220,230,220,0.45)'; x.lineWidth = 1;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.beginPath(); x.moveTo(40, 30); x.lineTo(40 + Math.cos(a) * 36, 30 + Math.sin(a) * 26); x.stroke(); }
  for (let r = 8; r < 36; r += 7) { x.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2; x.lineTo(40 + Math.cos(a) * r, 30 + Math.sin(a) * r * 0.72); } x.stroke(); }
}
// 눈 없는 바위 (얼음왕관 외 테마용)
function drawStone(x) {
  poly(x, [[4, 44], [10, 20], [26, 10], [46, 14], [58, 36], [52, 48], [10, 50]], lg(x, 0, 10, 0, 50, [[0, '#6a625a'], [1, '#2a2622']]), '#141210', 1.5);
  poly(x, [[14, 22], [26, 14], [40, 18], [30, 26]], 'rgba(255,255,255,0.12)');
  line(x, 20, 36, 34, 30, 'rgba(0,0,0,0.3)', 1.5);
}
G.EXTRA_DECOR = { crate: [56, 50, drawCrate], pillar: [48, 102, drawPillar], lavarock: [62, 52, drawLavaRock], web: [80, 60, drawWeb], stone: [62, 52, drawStone] };
G.Spr.groundFor = function (id) {
  this.groundCache ||= {};
  if (!this.groundCache[id]) { const T = G.THEMES[id]; this.groundCache[id] = T.pal ? this.make(512, 512, (x, w, h) => drawThemeGround(x, w, h, T.pal)) : this.ground; }
  return this.groundCache[id];
};
