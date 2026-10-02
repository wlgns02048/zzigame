'use strict';
// 스컬지 적 데이터. t0: 등장 시작 시간(초), w: 출현 가중치
G.ENEMIES = {
  ghoul: { name: '구울', hp: 16, speed: 90, dmg: 5, r: 13, xp: 1, t0: 0, w: 10, icon: 'ghoul', scale: 1 },
  skeleton: { name: '해골 전사', hp: 30, speed: 80, dmg: 7, r: 13, xp: 2, t0: 45, w: 8, icon: 'skeleton', scale: 1 },
  zombie: { name: '역병 좀비', hp: 62, speed: 56, dmg: 10, r: 16, xp: 3, t0: 100, w: 6, icon: 'zombie', scale: 1 },
  gargoyle: { name: '가고일', hp: 26, speed: 150, dmg: 8, r: 13, xp: 2, t0: 160, w: 5, icon: 'gargoyle', scale: 0.9, fly: true },
  necromancer: { name: '강령술사', hp: 48, speed: 72, dmg: 8, r: 14, xp: 4, t0: 220, w: 3, icon: 'necromancer', scale: 1, ranged: { range: 280, cd: 2.8, dmg: 11, speed: 240 } },
  cryptfiend: { name: '지하 마귀', hp: 150, speed: 74, dmg: 16, r: 20, xp: 7, t0: 320, w: 3, icon: 'cryptfiend', scale: 1 },
  abomination: { name: '누더기골렘', hp: 440, speed: 58, dmg: 24, r: 30, xp: 16, t0: 440, w: 1.2, icon: 'abomination', scale: 1 },
  // 보스
  patchwerk: { name: '패치워크', hp: 7000, speed: 92, dmg: 30, r: 46, xp: 200, icon: 'patchwerk', scale: 1.5, boss: true, title: '증오의 화신' },
  kelthuzad: { name: '켈투자드', hp: 24000, speed: 85, dmg: 22, r: 36, xp: 400, icon: 'kelthuzad', scale: 1.35, boss: true, title: '낙스라마스의 군주', fly: true },
  lichking: { name: '리치 왕', hp: 70000, speed: 98, dmg: 40, r: 40, xp: 0, icon: 'lichking', scale: 1.4, boss: true, title: '얼음왕관의 지배자' },
};
for (const id in G.ENEMIES) G.ENEMIES[id].id = id;

G.BOSS_SCHEDULE = [
  { t: 300, id: 'patchwerk', warn: '패치워크: "패치워크랑 놀아줘!"' },
  { t: 600, id: 'kelthuzad', warn: '켈투자드: "너희의 영혼은 이제 리치 왕의 것이다!"' },
  { t: 900, id: 'lichking', warn: '리치 왕: "드디어... 내 앞에 섰구나."' },
];
G.SWARMS = [180, 270, 420, 540, 720, 840];
