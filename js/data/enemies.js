'use strict';
// 적 데이터. 능력치는 "스테이지 배율 1" 기준이고, 스테이지(js/data/stages.js)의 power가 곱해진다.
// 등장 시점 · 출현 가중치는 스테이지 roster에 있다.
// ranged.kind: 투사체 색 (shadow | frost | fire | holy | arcane)
G.ENEMIES = {
  // ---- 스컬지 (얼음왕관 · 스칼로맨스 · 스트라솔름 · 낙스라마스) ----
  ghoul: { name: '구울', hp: 16, speed: 90, dmg: 5, r: 13, xp: 1, icon: 'ghoul', scale: 1 },
  skeleton: { name: '해골 전사', hp: 30, speed: 80, dmg: 7, r: 13, xp: 2, icon: 'skeleton', scale: 1 },
  zombie: { name: '역병 좀비', hp: 62, speed: 56, dmg: 10, r: 16, xp: 3, icon: 'zombie', scale: 1 },
  gargoyle: { name: '가고일', hp: 26, speed: 150, dmg: 8, r: 13, xp: 2, icon: 'gargoyle', scale: 0.9, fly: true },
  necromancer: { name: '강령술사', hp: 48, speed: 72, dmg: 8, r: 14, xp: 4, icon: 'necromancer', scale: 1, ranged: { range: 280, cd: 2.8, dmg: 11, speed: 240 } },
  cryptfiend: { name: '지하 마귀', hp: 150, speed: 74, dmg: 16, r: 20, xp: 7, icon: 'cryptfiend', scale: 1 },
  abomination: { name: '누더기골렘', hp: 440, speed: 58, dmg: 24, r: 30, xp: 16, icon: 'abomination', scale: 1 },
  spider: { name: '낙스라마스 거미', hp: 22, speed: 115, dmg: 6, r: 14, xp: 2, icon: 'spider', scale: 1 },
  // ---- 죽음의 폐광 ----
  kobold: { name: '코볼트 광부', hp: 14, speed: 95, dmg: 5, r: 12, xp: 1, icon: 'kobold', scale: 1 },
  defias_thug: { name: '데피아즈 강도', hp: 24, speed: 88, dmg: 6, r: 13, xp: 2, icon: 'defias', scale: 1 },
  defias_mage: { name: '데피아즈 마법사', hp: 34, speed: 70, dmg: 6, r: 13, xp: 3, icon: 'defias', scale: 1, ranged: { range: 260, cd: 3, dmg: 9, speed: 230, kind: 'fire' } },
  defias_goon: { name: '데피아즈 행동대원', hp: 90, speed: 66, dmg: 12, r: 18, xp: 5, icon: 'defias', scale: 1 },
  defias_ogre: { name: '데피아즈 오우거', hp: 300, speed: 58, dmg: 20, r: 26, xp: 12, icon: 'rhahkzor', scale: 1 },
  // ---- 그림자송곳니 ----
  wolf: { name: '굶주린 늑대', hp: 16, speed: 120, dmg: 5, r: 13, xp: 1, icon: 'wolf', scale: 1 },
  worgen: { name: '그림자송곳니 늑대인간', hp: 34, speed: 92, dmg: 8, r: 15, xp: 2, icon: 'worgen', scale: 1 },
  ghost: { name: '원혼', hp: 30, speed: 80, dmg: 7, r: 13, xp: 3, icon: 'ghost', scale: 1, fly: true, ranged: { range: 240, cd: 3.2, dmg: 9, speed: 220 } },
  worgen_brute: { name: '늑대인간 도살자', hp: 320, speed: 70, dmg: 20, r: 26, xp: 12, icon: 'worgen', scale: 1 },
  // ---- 붉은십자군 ----
  scarlet_soldier: { name: '붉은십자군 병사', hp: 28, speed: 84, dmg: 7, r: 14, xp: 2, icon: 'scarlet', scale: 1 },
  scarlet_hound: { name: '붉은십자군 사냥개', hp: 18, speed: 125, dmg: 5, r: 13, xp: 1, icon: 'hound', scale: 1 },
  scarlet_mage: { name: '붉은십자군 마법사', hp: 36, speed: 70, dmg: 7, r: 13, xp: 3, icon: 'scarlet', scale: 1, ranged: { range: 270, cd: 2.8, dmg: 10, speed: 240, kind: 'fire' } },
  scarlet_monk: { name: '붉은십자군 수도사', hp: 40, speed: 115, dmg: 8, r: 14, xp: 3, icon: 'scarlet', scale: 1 },
  scarlet_knight: { name: '붉은십자군 기사', hp: 340, speed: 62, dmg: 22, r: 26, xp: 14, icon: 'scarlet', scale: 1 },
  // ---- 스칼로맨스 ----
  student: { name: '스칼로맨스 학생', hp: 30, speed: 78, dmg: 6, r: 13, xp: 2, icon: 'student', scale: 1, ranged: { range: 250, cd: 3.4, dmg: 8, speed: 220 } },
  // ---- 화산 심장부 ----
  fireling: { name: '화염 정령 새끼', hp: 18, speed: 100, dmg: 6, r: 12, xp: 1, icon: 'fireelemental', scale: 1 },
  corehound: { name: '심장부 사냥개', hp: 60, speed: 110, dmg: 10, r: 18, xp: 3, icon: 'corehound', scale: 1 },
  flamewaker: { name: '화염피조물', hp: 70, speed: 80, dmg: 12, r: 16, xp: 4, icon: 'flamewaker', scale: 1 },
  fireelemental: { name: '화염 군주의 하수인', hp: 140, speed: 72, dmg: 16, r: 20, xp: 7, icon: 'fireelemental', scale: 1, ranged: { range: 260, cd: 3, dmg: 14, speed: 230, kind: 'fire' } },
  lavagiant: { name: '용암 거인', hp: 480, speed: 55, dmg: 26, r: 32, xp: 18, icon: 'fireelemental', scale: 1 },
  // ---- 검은날개 둥지 ----
  whelp: { name: '검은 새끼용', hp: 16, speed: 130, dmg: 5, r: 12, xp: 1, icon: 'whelp', scale: 1, fly: true },
  blackrock: { name: '검은바위 투사', hp: 36, speed: 86, dmg: 8, r: 15, xp: 2, icon: 'blackrock', scale: 1 },
  drakonid: { name: '용혈족', hp: 110, speed: 80, dmg: 14, r: 20, xp: 6, icon: 'drakonid', scale: 1 },
  dragon_tech: { name: '고블린 기술자', hp: 50, speed: 75, dmg: 8, r: 14, xp: 4, icon: 'blackrock', scale: 1, ranged: { range: 260, cd: 2.6, dmg: 10, speed: 250, kind: 'arcane' } },
  chromatic: { name: '오색 용혈족', hp: 460, speed: 60, dmg: 26, r: 32, xp: 18, icon: 'drakonid', scale: 1 },

  // ================= 보스 =================
  // 기존 3종은 G.Boss의 전용 AI, 나머지는 skills 목록으로 움직이는 범용 AI
  patchwerk: { name: '패치워크', hp: 7000, speed: 92, dmg: 30, r: 46, xp: 200, icon: 'patchwerk', scale: 1.5, boss: true, title: '증오의 화신', glow: '120,255,80' },
  kelthuzad: { name: '켈투자드', hp: 24000, speed: 85, dmg: 22, r: 36, xp: 400, icon: 'kelthuzad', scale: 1.35, boss: true, title: '낙스라마스의 군주', fly: true },
  lichking: { name: '리치 왕', hp: 70000, speed: 98, dmg: 40, r: 40, xp: 0, icon: 'lichking', scale: 1.4, boss: true, title: '얼음왕관의 지배자' },

  rhahkzor: { name: '라크조르', title: '데피아즈 우두머리', hp: 7000, speed: 88, dmg: 28, r: 34, xp: 200, icon: 'rhahkzor', scale: 1, boss: true, glow: '255,150,60',
    move: 'chase', skills: [{ type: 'slam', name: '분쇄', cd: 7, r: 130, dmg: 40 }, { type: 'enrage', at: 0.3 }] },
  mrsmite: { name: '미스터 스마이트', title: '데피아즈 갑판장', hp: 24000, speed: 92, dmg: 30, r: 34, xp: 400, icon: 'mrsmite', scale: 1, boss: true, glow: '255,150,60',
    move: 'chase', skills: [{ type: 'charge', name: '돌진', cd: 9, dmg: 34 }, { type: 'slam', name: '천둥 강타', cd: 8, r: 150, dmg: 36, root: 1 }, { type: 'summon', name: '선원 호출', cd: 18, id: 'defias_thug', n: 6 }] },
  vancleef: { name: '에드윈 밴클리프', title: '데피아즈단 두목', hp: 70000, speed: 105, dmg: 32, r: 34, xp: 0, icon: 'vancleef', scale: 1, boss: true, glow: '255,80,60',
    move: 'chase', skills: [{ type: 'volley', name: '단검 투척', cd: 6, n: 12, dmg: 18, speed: 260, kind: 'blade' }, { type: 'charge', name: '그림자 습격', cd: 10, dmg: 40 },
      { type: 'summon', name: '형제회 호출', cd: 16, id: 'defias_goon', n: 4 }, { type: 'enrage', at: 0.3 }] },

  silverlaine: { name: '실버레인 남작', title: '그림자송곳니의 주인', hp: 7000, speed: 88, dmg: 26, r: 34, xp: 200, icon: 'silverlaine', scale: 1, boss: true, glow: '150,200,255',
    move: 'chase', skills: [{ type: 'zones', name: '어둠의 장막', cd: 11, n: 3, r: 70, dmg: 9, life: 8, color: '80,80,160' }, { type: 'summon', name: '원혼 소환', cd: 15, id: 'ghost', n: 4 }] },
  springvale: { name: '사령관 스프링베일', title: '타락한 성기사', hp: 24000, speed: 86, dmg: 30, r: 34, xp: 400, icon: 'springvale', scale: 1, boss: true, glow: '255,230,150',
    move: 'chase', skills: [{ type: 'slam', name: '정의의 망치', cd: 7, r: 140, dmg: 40 }, { type: 'zones', name: '신성화', cd: 12, n: 2, r: 90, dmg: 10, life: 7, color: '255,220,120' }, { type: 'heal', name: '빛의 섬광', at: 0.4, amt: 0.2 }] },
  arugal: { name: '대마법사 아루갈', title: '늑대인간의 아버지', hp: 70000, speed: 82, dmg: 24, r: 32, xp: 0, icon: 'arugal', scale: 1, boss: true, glow: '200,100,255',
    move: 'kite', skills: [{ type: 'volley', name: '어둠의 화살 일제 사격', cd: 4.5, n: 14, dmg: 14, speed: 210 }, { type: 'blast', name: '아루갈의 저주', cd: 9, r: 90, dmg: 30, root: 1.4, color: '170,60,255' },
      { type: 'teleport', name: '순간이동', cd: 12 }, { type: 'summon', name: '늑대인간 소환', cd: 15, id: 'worgen', n: 8 }] },

  loksey: { name: '사냥개조련사 록시', title: '붉은십자군 사냥꾼', hp: 7000, speed: 95, dmg: 26, r: 34, xp: 200, icon: 'loksey', scale: 1, boss: true, glow: '255,80,60',
    move: 'chase', skills: [{ type: 'summon', name: '사냥개 풀기', cd: 10, id: 'scarlet_hound', n: 8 }, { type: 'slam', name: '난타', cd: 8, r: 120, dmg: 36 }, { type: 'enrage', at: 0.4 }] },
  doan: { name: '비전술사 도안', title: '붉은십자군 비전술사', hp: 24000, speed: 80, dmg: 24, r: 32, xp: 400, icon: 'doan', scale: 1, boss: true, glow: '255,100,255',
    move: 'kite', skills: [{ type: 'volley', name: '비전 화살', cd: 4.5, n: 12, dmg: 14, speed: 230, kind: 'arcane' }, { type: 'nova', name: '마법 파열', cd: 11, r: 220, dmg: 44, cast: 2 }, { type: 'teleport', name: '점멸', cd: 10 }] },
  whitemane: { name: '종교재판관 화이트메인', title: '붉은십자군 대종교재판관', hp: 70000, speed: 90, dmg: 32, r: 32, xp: 0, icon: 'whitemane', scale: 1, boss: true, glow: '255,240,200',
    move: 'chase', skills: [{ type: 'slam', name: '천벌', cd: 7, r: 140, dmg: 44 }, { type: 'zones', name: '신성한 불길', cd: 10, n: 3, r: 80, dmg: 11, life: 8, color: '255,200,80' },
      { type: 'summon', name: '십자군 소집', cd: 16, id: 'scarlet_soldier', n: 8 }, { type: 'heal', name: '부활', at: 0.5, amt: 0.25 }] },

  jandice: { name: '잔다이스 바로브', title: '바로브 가문', hp: 7000, speed: 85, dmg: 22, r: 32, xp: 200, icon: 'jandice', scale: 1, boss: true, glow: '255,120,255',
    move: 'kite', skills: [{ type: 'summon', name: '환영', cd: 9, id: 'student', n: 8 }, { type: 'teleport', name: '사라짐', cd: 8 }, { type: 'volley', name: '저주의 화살', cd: 6, n: 10, dmg: 12, speed: 200 }] },
  frostwhisper: { name: '라스 프로스트위스퍼', title: '리치', hp: 24000, speed: 80, dmg: 24, r: 32, xp: 400, icon: 'frostwhisper', scale: 1, boss: true, glow: '120,200,255',
    move: 'kite', skills: [{ type: 'volley', name: '얼음 화살 일제 사격', cd: 4.5, n: 16, dmg: 14, speed: 210, kind: 'frost' }, { type: 'blast', name: '서리 고리', cd: 9, r: 100, dmg: 32, root: 1.6, color: '120,200,255' }] },
  gandling: { name: '암흑스승 간들링', title: '스칼로맨스 교장', hp: 70000, speed: 84, dmg: 26, r: 32, xp: 0, icon: 'gandling', scale: 1, boss: true, glow: '80,255,120',
    move: 'kite', skills: [{ type: 'volley', name: '어둠의 화살 일제 사격', cd: 4.2, n: 16, dmg: 15, speed: 215 }, { type: 'portal', name: '어둠의 차원문', cd: 14 },
      { type: 'zones', name: '어둠의 웅덩이', cd: 10, n: 3, r: 75, dmg: 11, life: 9, color: '60,200,90' }, { type: 'summon', name: '해골 일으키기', cd: 14, id: 'skeleton', n: 10 }] },

  anastari: { name: '남작부인 아나스타리', title: '밴시', hp: 7000, speed: 90, dmg: 22, r: 32, xp: 200, icon: 'anastari', scale: 1, boss: true, glow: '200,220,255', fly: true,
    move: 'kite', skills: [{ type: 'volley', name: '밴시의 울부짖음', cd: 5, n: 12, dmg: 14, speed: 220 }, { type: 'blast', name: '정신 지배', cd: 10, r: 90, dmg: 26, root: 1.5, color: '180,140,255' }] },
  ramstein: { name: '먹보 람스타인', title: '누더기골렘', hp: 24000, speed: 90, dmg: 34, r: 40, xp: 400, icon: 'ramstein', scale: 1.4, boss: true, glow: '120,255,80',
    move: 'chase', skills: [{ type: 'slam', name: '짓밟기', cd: 7, r: 160, dmg: 46 }, { type: 'charge', name: '돌진', cd: 10, dmg: 40 }, { type: 'enrage', at: 0.3 }] },
  rivendare: { name: '남작 리븐데어', title: '스트라솔름의 영주', hp: 70000, speed: 96, dmg: 36, r: 34, xp: 0, icon: 'rivendare', scale: 1, boss: true, glow: '120,200,255',
    move: 'chase', skills: [{ type: 'slam', name: '죽음의 일격', cd: 7, r: 150, dmg: 48 }, { type: 'zones', name: '부정의 오라', cd: 11, n: 3, r: 80, dmg: 12, life: 9, color: '90,255,120' },
      { type: 'summon', name: '해골 소환', cd: 14, id: 'skeleton', n: 10 }, { type: 'aura', r: 150, dmg: 5 }] },

  lucifron: { name: '루시프론', title: '화염피조물 군주', hp: 7000, speed: 86, dmg: 26, r: 32, xp: 200, icon: 'lucifron', scale: 1, boss: true, glow: '255,120,40',
    move: 'kite', skills: [{ type: 'blast', name: '임박한 파멸', cd: 8, r: 100, dmg: 34, color: '170,60,255' }, { type: 'volley', name: '어둠의 충격', cd: 5, n: 12, dmg: 14, speed: 220 }, { type: 'summon', name: '경호대', cd: 16, id: 'flamewaker', n: 3 }] },
  magmadar: { name: '마그마다르', title: '용암 사냥개의 왕', hp: 24000, speed: 100, dmg: 34, r: 40, xp: 400, icon: 'magmadar', scale: 1, boss: true, glow: '255,120,40',
    move: 'chase', skills: [{ type: 'zones', name: '용암 폭탄', cd: 8, n: 4, r: 70, dmg: 13, life: 8, color: '255,110,20' }, { type: 'charge', name: '광란', cd: 9, dmg: 40 }, { type: 'enrage', at: 0.5 }] },
  ragnaros: { name: '라그나로스', title: '불의 군주', hp: 70000, speed: 55, dmg: 40, r: 44, xp: 0, icon: 'ragnaros', scale: 1, boss: true, glow: '255,140,40',
    move: 'chase', skills: [{ type: 'nova', name: '라그나로스의 분노', cd: 10, r: 240, dmg: 50, cast: 1.6 }, { type: 'zones', name: '용암 분출', cd: 6, n: 5, r: 70, dmg: 14, life: 7, color: '255,110,20' },
      { type: 'volley', name: '불타는 망치', cd: 5, n: 14, dmg: 16, speed: 220, kind: 'fire' }, { type: 'summon', name: '화염의 아들', cd: 18, id: 'fireelemental', n: 6, at: 0.6 }] },

  razorgore: { name: '폭군 서슬송곳니', title: '검은용 수호자', hp: 7000, speed: 90, dmg: 30, r: 34, xp: 200, icon: 'razorgore', scale: 1, boss: true, glow: '200,80,255',
    move: 'chase', skills: [{ type: 'summon', name: '새끼용 무리', cd: 9, id: 'whelp', n: 10 }, { type: 'slam', name: '꼬리 휘두르기', cd: 8, r: 140, dmg: 40 }] },
  vaelastrasz: { name: '타락한 밸라스트라즈', title: '붉은용', hp: 24000, speed: 88, dmg: 32, r: 36, xp: 400, icon: 'vaelastrasz', scale: 1, boss: true, glow: '255,80,40',
    move: 'chase', skills: [{ type: 'aura', r: 170, dmg: 6 }, { type: 'volley', name: '화염 숨결', cd: 5, n: 14, dmg: 15, speed: 230, kind: 'fire' }, { type: 'slam', name: '꼬리 휘두르기', cd: 9, r: 150, dmg: 42 }] },
  nefarian: { name: '네파리안', title: '검은날개의 군주', hp: 70000, speed: 96, dmg: 38, r: 40, xp: 0, icon: 'nefarian', scale: 1, boss: true, glow: '180,60,255',
    move: 'chase', skills: [{ type: 'volley', name: '그림자불꽃', cd: 5, n: 18, dmg: 16, speed: 220 }, { type: 'blast', name: '공포의 포효', cd: 10, r: 110, dmg: 34, root: 1.5, color: '170,60,255' },
      { type: 'summon', name: '용혈족 호출', cd: 15, id: 'drakonid', n: 5 }, { type: 'zones', name: '검은 불길', cd: 9, n: 3, r: 80, dmg: 13, life: 8, color: '160,60,220' }, { type: 'enrage', at: 0.2 }] },

  anubrekhan: { name: '아눕레칸', title: '거미 지구의 군주', hp: 7000, speed: 85, dmg: 30, r: 40, xp: 200, icon: 'anubrekhan', scale: 1, boss: true, glow: '160,255,80',
    move: 'chase', skills: [{ type: 'summon', name: '지하 수호병', cd: 10, id: 'spider', n: 10 }, { type: 'aura', name: '메뚜기 떼', r: 160, dmg: 6 }, { type: 'charge', name: '충격', cd: 9, dmg: 36 }] },
};
for (const id in G.ENEMIES) G.ENEMIES[id].id = id;
