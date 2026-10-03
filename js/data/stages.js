'use strict';
// ================= 스테이지 (브라우저 · 서버 공용) =================
// 시간 값은 모두 "스테이지 길이 대비 비율"이고, 적 등장 시점(t0)은 기준 길이 900초 척도다.
// 서버는 duration · 보스 수 · 보상 · 아이템 레벨만 쓰고, 브라우저는 적 구성까지 쓴다.
// power는 권장 아이템 레벨 장비 + 특성의 화력/생존력 증가분에 맞춘 곡선 (tools/sim.cjs --query "&gear=…&talents=1"로 검증).
(function (root) {
  const SWARMS = [0.2, 0.3, 7 / 15, 0.6, 0.8, 14 / 15]; // 900초 기준 180 · 270 · 420 · 540 · 720 · 840초
  const STAGES = {
    // ---------- 챕터 1: 오리지널 ----------
    deadmines: {
      chapter: 'classic', order: 1, type: 'dungeon', name: '죽음의 폐광', icon: 'deadmines', duration: 600, theme: 'mine',
      desc: '서부 몰락지대 아래, 데피아즈단이 비밀 함선을 건조하는 폐광.',
      power: { hp: 0.5, dmg: 0.6 }, ilvl: 20,
      roster: [['kobold', 0, 10], ['defias_thug', 30, 8], ['defias_mage', 160, 3], ['defias_goon', 300, 2], ['defias_ogre', 420, 1.2]],
      swarm: ['kobold', 'defias_thug'],
      bosses: [
        { at: 1 / 3, id: 'rhahkzor', warn: '라크조르: "반 클리프가 너희를 막으라 했다!"' },
        { at: 2 / 3, id: 'mrsmite', warn: '미스터 스마이트: "모두 일하러 가라!"' },
        { at: 1, id: 'vancleef', warn: '에드윈 밴클리프: "누구도 형제회를 막을 수 없다!"' },
      ],
      loot: [
        { name: '형제회의 망토', slot: 'back', stats: ['crit', 'haste'] }, { name: '그을린 데피아즈 장화', slot: 'feet', stats: ['haste', 'vers'] },
        { name: '밴클리프의 칼날', slot: 'dagger', stats: ['crit', 'mastery'] }, { name: '제련공의 바지', slot: 'legs', stats: ['mastery', 'vers'] },
        { name: '해적의 덧옷', slot: 'chest', stats: ['crit', 'vers'] }, { name: '선장의 반지', slot: 'finger', stats: ['haste', 'mastery'] },
        { name: '스마이트의 망치', slot: 'mace2h', stats: ['crit', 'haste'] }, { name: '대장장이의 판금 장갑', slot: 'hands', armor: 'plate', stats: ['mastery', 'vers'] },
        { name: '데피아즈 가죽 조끼', slot: 'chest', armor: 'leather', stats: ['crit', 'vers'] }, { name: '광부의 사슬 장화', slot: 'feet', armor: 'mail', stats: ['haste', 'mastery'] }, { name: '데피아즈 석궁', slot: 'crossbow', stats: ['crit', 'mastery'] },
        { name: '조수 부르는 자의 사슬 어깨보호구', slot: 'shoulder', armor: 'mail', stats: ['crit', 'haste'] }, { name: '밴클리프의 원형 방패', slot: 'shield', stats: ['haste', 'mastery'] },
      ],
    },
    shadowfang: {
      chapter: 'classic', order: 2, type: 'dungeon', name: '그림자송곳니 성채', icon: 'shadowfang', duration: 600, theme: 'forest',
      desc: '은빛소나무 숲 위, 미친 대마법사 아루갈이 늑대인간을 부리는 성채.',
      power: { hp: 0.58, dmg: 0.65 }, ilvl: 26,
      roster: [['wolf', 0, 10], ['worgen', 40, 8], ['ghost', 150, 3], ['skeleton', 220, 4], ['worgen_brute', 380, 1.5]],
      swarm: ['wolf', 'worgen'],
      bosses: [
        { at: 1 / 3, id: 'silverlaine', warn: '실버레인 남작: "내 성에서 나가라!"' },
        { at: 2 / 3, id: 'springvale', warn: '사령관 스프링베일: "빛은 나를 버렸다..."' },
        { at: 1, id: 'arugal', warn: '대마법사 아루갈: "너희는 내 아이들의 먹이가 되리라!"' },
      ],
      loot: [
        { name: '아루갈의 지팡이', slot: 'staff', stats: ['crit', 'haste'] }, { name: '늑대인간 송곳니 목걸이', slot: 'neck', stats: ['crit', 'vers'] },
        { name: '은빛소나무 두건', slot: 'head', stats: ['haste', 'mastery'] }, { name: '실버레인의 인장', slot: 'finger', stats: ['crit', 'mastery'] },
        { name: '그림자송곳니 손목보호구', slot: 'wrist', stats: ['haste', 'vers'] }, { name: '밤의 어둠 장갑', slot: 'hands', stats: ['mastery', 'vers'] },
        { name: '실버레인의 판금 흉갑', slot: 'chest', armor: 'plate', stats: ['mastery', 'vers'] }, { name: '늑대 송곳니 단검', slot: 'dagger', prim: 'agi', stats: ['crit', 'mastery'] },
        { name: '늑대가죽 사슬 투구', slot: 'head', armor: 'mail', stats: ['crit', 'vers'] }, { name: '은빛소나무 장궁', slot: 'bow', stats: ['crit', 'haste'] }, { name: '울부짖는 늑대 가죽 장갑', slot: 'hands', armor: 'leather', stats: ['haste', 'mastery'] },
        { name: '아루갈의 폭풍 사슬 장갑', slot: 'hands', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '늑대인간 토템 철퇴', slot: 'mace1h', prim: 'int', stats: ['haste', 'vers'] },
      ],
    },
    scarlet: {
      chapter: 'classic', order: 3, type: 'dungeon', name: '붉은십자군 수도원', icon: 'scarletmonastery', duration: 600, theme: 'monastery',
      desc: '티리스팔 숲의 광신도 붉은십자군 본거지.',
      power: { hp: 0.66, dmg: 0.7 }, ilvl: 32,
      roster: [['scarlet_soldier', 0, 10], ['scarlet_hound', 30, 6], ['scarlet_mage', 140, 3], ['scarlet_monk', 220, 4], ['scarlet_knight', 380, 1.5]],
      swarm: ['scarlet_soldier', 'scarlet_hound'],
      bosses: [
        { at: 1 / 3, id: 'loksey', warn: '사냥개조련사 록시: "녀석들아, 물어라!"' },
        { at: 2 / 3, id: 'doan', warn: '비전술사 도안: "너희는 비전의 힘을 보게 될 것이다!"' },
        { at: 1, id: 'whitemane', warn: '종교재판관 화이트메인: "이단자들을 정화하라!"' },
      ],
      loot: [
        { name: '비전술사의 예복', slot: 'chest', stats: ['crit', 'haste'] }, { name: '붉은십자군 인장', slot: 'finger', stats: ['haste', 'vers'] },
        { name: '화이트메인의 교서', slot: 'offhand', stats: ['crit', 'mastery'] }, { name: '광신자의 어깨덧옷', slot: 'shoulder', stats: ['mastery', 'vers'] },
        { name: '종교재판관의 허리띠', slot: 'waist', stats: ['crit', 'vers'] }, { name: '사냥개조련사의 장화', slot: 'feet', stats: ['haste', 'mastery'] },
        { name: '종교재판관의 판금 견갑', slot: 'shoulder', armor: 'plate', stats: ['haste', 'vers'] }, { name: '붉은십자군 방패', slot: 'shield', stats: ['mastery', 'vers'] }, { name: '광신자의 가죽 다리보호구', slot: 'legs', armor: 'leather', stats: ['crit', 'mastery'] },
        { name: '붉은십자군 사슬 갑옷', slot: 'chest', armor: 'mail', stats: ['crit', 'haste'] }, { name: '사냥개조련사 록세이의 장궁', slot: 'bow', stats: ['haste', 'mastery'] }, { name: '파괴자', slot: 'axe2h', stats: ['crit', 'vers'] },
        { name: '불꽃날 사슬 다리보호구', slot: 'legs', armor: 'mail', stats: ['crit', 'haste'] }, { name: '심판관의 토템 망치', slot: 'mace1h', prim: 'int', stats: ['crit', 'mastery'] },
      ],
    },
    scholomance: {
      chapter: 'classic', order: 4, type: 'dungeon', name: '스칼로맨스', icon: 'scholomance', duration: 600, theme: 'crypt',
      desc: '저주받은 귀족 바로브 가문의 지하실을 차지한 강령술 학교.',
      power: { hp: 0.75, dmg: 0.75 }, ilvl: 40,
      roster: [['skeleton', 0, 9], ['ghoul', 30, 7], ['student', 60, 4], ['necromancer', 180, 2], ['ghost', 240, 2], ['abomination', 420, 1]],
      swarm: ['skeleton', 'ghoul'],
      bosses: [
        { at: 1 / 3, id: 'jandice', warn: '잔다이스 바로브: "환영 속에서 길을 잃어라."' },
        { at: 2 / 3, id: 'frostwhisper', warn: '라스 프로스트위스퍼: "얼어붙어 죽어라!"' },
        { at: 1, id: 'gandling', warn: '암흑스승 간들링: "수업을 시작하지!"' },
      ],
      loot: [
        { name: '간들링의 두건', slot: 'head', stats: ['crit', 'mastery'] }, { name: '프로스트위스퍼의 지팡이', slot: 'staff', stats: ['haste', 'mastery'] },
        { name: '강령술사의 망토', slot: 'back', stats: ['crit', 'vers'] }, { name: '바로브 가문의 반지', slot: 'finger', stats: ['crit', 'haste'] },
        { name: '뼈 장식 다리보호구', slot: 'legs', stats: ['haste', 'vers'] }, { name: '어둠의 교본', slot: 'offhand', stats: ['mastery', 'vers'] },
        { name: '그림자 장인 조끼', slot: 'chest', armor: 'leather', stats: ['haste', 'mastery'] }, { name: '용맹의 투구', slot: 'head', armor: 'plate', stats: ['crit', 'vers'] }, { name: '뼈 갈퀴손', slot: 'fist', stats: ['crit', 'haste'] },
        { name: '야수추적자 투구', slot: 'head', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '야수추적자 장갑', slot: 'hands', armor: 'mail', stats: ['haste', 'vers'] }, { name: '해골 탄환 나팔총', slot: 'gun', stats: ['crit', 'haste'] },
        { name: '대지영혼 사슬 갑옷', slot: 'chest', armor: 'mail', stats: ['haste', 'mastery'] }, { name: '간들링의 정령 방패', slot: 'shield', stats: ['crit', 'vers'] },
      ],
    },
    stratholme: {
      chapter: 'classic', order: 5, type: 'dungeon', name: '스트라솔름', icon: 'stratholme', duration: 600, theme: 'ruins',
      desc: '아서스가 불태운 도시. 지금은 스컬지와 붉은십자군이 뒤엉켜 싸운다.',
      power: { hp: 0.85, dmg: 0.8 }, ilvl: 48,
      roster: [['ghoul', 0, 9], ['zombie', 40, 6], ['scarlet_soldier', 80, 4], ['gargoyle', 160, 4], ['necromancer', 220, 3], ['abomination', 380, 1.2]],
      swarm: ['ghoul', 'zombie'],
      bosses: [
        { at: 1 / 3, id: 'anastari', warn: '남작부인 아나스타리: "네 몸은 이제 내 것이다."' },
        { at: 2 / 3, id: 'ramstein', warn: '먹보 람스타인이 우리에서 풀려납니다!' },
        { at: 1, id: 'rivendare', warn: '남작 리븐데어: "어리석은 것들. 스컬지의 영광을 보아라!"' },
      ],
      loot: [
        { name: '리븐데어의 망토', slot: 'back', stats: ['haste', 'mastery'] }, { name: '죽음의 군마 고삐 장신구', slot: 'trinket', stats: ['crit', 'haste'] },
        { name: '아나스타리의 손목보호구', slot: 'wrist', stats: ['crit', 'mastery'] }, { name: '역병 도시의 로브', slot: 'chest', stats: ['haste', 'vers'] },
        { name: '남작의 인장 반지', slot: 'finger', stats: ['mastery', 'vers'] }, { name: '람스타인의 사슬 목걸이', slot: 'neck', stats: ['crit', 'haste'] },
        { name: '야수추적자 갑옷', slot: 'chest', armor: 'mail', stats: ['crit', 'haste'] }, { name: '야수추적자 장화', slot: 'feet', armor: 'mail', stats: ['haste', 'mastery'] }, { name: '그림자 장인 바지', slot: 'legs', armor: 'leather', stats: ['crit', 'mastery'] },
        { name: '윌리의 휴대용 곡사포', slot: 'gun', stats: ['crit', 'haste'] }, { name: '리븐데어의 룬검', slot: 'sword1h', prim: 'agi', stats: ['crit', 'vers'] }, { name: '용맹의 흉갑', slot: 'chest', armor: 'plate', stats: ['mastery', 'vers'] },
        { name: '대지영혼 투구', slot: 'head', armor: 'mail', stats: ['crit', 'haste'] }, { name: '남작의 폭풍 철퇴', slot: 'mace1h', prim: 'int', stats: ['haste', 'mastery'] },
      ],
    },
    moltencore: {
      chapter: 'classic', order: 6, type: 'raid', name: '화산 심장부', icon: 'moltencore', duration: 900, theme: 'lava',
      desc: '검은바위 산 깊은 곳, 불의 군주 라그나로스가 잠든 용암 동굴.',
      power: { hp: 0.95, dmg: 0.9 }, ilvl: 60,
      roster: [['fireling', 0, 10], ['corehound', 60, 6], ['flamewaker', 140, 5], ['fireelemental', 260, 3], ['lavagiant', 480, 1]],
      swarm: ['fireling', 'corehound'],
      bosses: [
        { at: 1 / 3, id: 'lucifron', warn: '루시프론: "불의 군주의 영역을 침범한 자, 죽으리라!"' },
        { at: 2 / 3, id: 'magmadar', warn: '마그마다르가 포효합니다!' },
        { at: 1, id: 'ragnaros', warn: '라그나로스: "너무 이르다, 청지기여! 날 깨우다니!"' },
      ],
      loot: [
        { name: '아케이나이트 두건', slot: 'head', stats: ['crit', 'haste'] }, { name: '마법사 숙련의 로브', slot: 'chest', stats: ['crit', 'mastery'] },
        { name: '불타는 손 장갑', slot: 'hands', stats: ['haste', 'mastery'] }, { name: '라그나로스의 반지', slot: 'finger', stats: ['crit', 'vers'] },
        { name: '용암 지팡이', slot: 'staff', stats: ['crit', 'haste'] }, { name: '불의 군주의 어깨보호구', slot: 'shoulder', stats: ['haste', 'vers'] },
        { name: '마그마다르의 송곳니 목걸이', slot: 'neck', stats: ['mastery', 'vers'] }, { name: '심장부 화염 장신구', slot: 'trinket', stats: ['crit', 'mastery'] },
        { name: '거인추적자 투구', slot: 'head', armor: 'mail', stats: ['crit', 'haste'] }, { name: '거인추적자 갑옷', slot: 'chest', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '힘의 투구', slot: 'head', armor: 'plate', stats: ['crit', 'vers'] }, { name: '밤살해자 조끼', slot: 'chest', armor: 'leather', stats: ['haste', 'vers'] },
        { name: '스트라이커의 징표', slot: 'bow', stats: ['crit', 'mastery'] }, { name: '불의 군주의 철퇴', slot: 'mace1h', stats: ['haste', 'vers'] }, { name: '거인추적자 다리보호구', slot: 'legs', armor: 'mail', stats: ['haste', 'mastery'] },
        { name: '대지분노 투구', slot: 'head', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '대지분노 흉갑', slot: 'chest', armor: 'mail', stats: ['crit', 'haste'] }, { name: '용암 심장 방패', slot: 'shield', stats: ['haste', 'mastery'] },
      ],
    },
    blackwing: {
      chapter: 'classic', order: 7, type: 'raid', name: '검은날개 둥지', icon: 'blackwinglair', duration: 900, theme: 'lair',
      desc: '검은용 네파리안이 색깔 혼합 용족을 실험하는 둥지.',
      power: { hp: 1.08, dmg: 0.97 }, ilvl: 70,
      roster: [['whelp', 0, 10], ['blackrock', 40, 7], ['drakonid', 160, 5], ['dragon_tech', 220, 3], ['chromatic', 440, 1]],
      swarm: ['whelp', 'blackrock'],
      bosses: [
        { at: 1 / 3, id: 'razorgore', warn: '폭군 서슬송곳니가 알을 지키며 달려듭니다!' },
        { at: 2 / 3, id: 'vaelastrasz', warn: '타락한 밸라스트라즈: "도망쳐라... 나를 막을 수 없다!"' },
        { at: 1, id: 'nefarian', warn: '네파리안: "이 순간을 기다렸다. 이제 너희가 죽을 차례다!"' },
      ],
      loot: [
        { name: '네메시스 두건', slot: 'head', stats: ['crit', 'mastery'] }, { name: '용족 사냥꾼의 망토', slot: 'back', stats: ['haste', 'vers'] },
        { name: '밸라스트라즈의 장신구', slot: 'trinket', stats: ['crit', 'haste'] }, { name: '혈통의 지팡이', slot: 'staff', stats: ['haste', 'mastery'] },
        { name: '그림자 비늘 다리보호구', slot: 'legs', stats: ['crit', 'vers'] }, { name: '서슬송곳니의 손목보호구', slot: 'wrist', stats: ['mastery', 'vers'] },
        { name: '검은용의 인장', slot: 'finger', stats: ['crit', 'haste'] }, { name: '네파리안의 어깨덧옷', slot: 'shoulder', stats: ['crit', 'mastery'] },
        { name: '용추적자 투구', slot: 'head', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '용추적자 어깨갑옷', slot: 'shoulder', armor: 'mail', stats: ['crit', 'haste'] }, { name: '격노의 흉갑', slot: 'chest', armor: 'plate', stats: ['haste', 'mastery'] }, { name: '피송곳니 조끼', slot: 'chest', armor: 'leather', stats: ['crit', 'vers'] },
        { name: '아쉬제렐, 응징의 석궁', slot: 'crossbow', stats: ['crit', 'haste'] }, { name: '아쉬칸디, 형제단의 대검', slot: 'sword2h', stats: ['crit', 'vers'] }, { name: '용추적자 장화', slot: 'feet', armor: 'mail', stats: ['haste', 'vers'] },
        { name: '열 폭풍 투구', slot: 'head', armor: 'mail', stats: ['crit', 'haste'] }, { name: '열 폭풍 흉갑', slot: 'chest', armor: 'mail', stats: ['haste', 'mastery'] }, { name: '용족 지배의 철퇴', slot: 'mace1h', prim: 'int', stats: ['crit', 'haste'] },
      ],
    },
    naxxramas: {
      chapter: 'classic', order: 8, type: 'raid', name: '낙스라마스', icon: 'naxxramas', duration: 900, theme: 'necropolis',
      desc: '동부 역병지대 하늘에 뜬 강령술의 성채. 켈투자드가 기다린다.',
      power: { hp: 1.2, dmg: 1.05 }, ilvl: 80,
      roster: [['ghoul', 0, 9], ['spider', 30, 8], ['skeleton', 80, 5], ['cryptfiend', 200, 3], ['gargoyle', 240, 3], ['necromancer', 280, 2], ['abomination', 420, 1.2]],
      swarm: ['spider', 'ghoul'],
      bosses: [
        { at: 1 / 3, id: 'anubrekhan', warn: '아눕레칸: "작은 것들이 내 둥지에 들어왔군."' },
        { at: 2 / 3, id: 'patchwerk', warn: '패치워크: "패치워크랑 놀아줘!"' },
        { at: 1, id: 'kelthuzad', warn: '켈투자드: "너희의 영혼은 이제 리치 왕의 것이다!"' },
      ],
      loot: [
        { name: '서리불꽃 두건', slot: 'head', stats: ['crit', 'haste'] }, { name: '서리불꽃 로브', slot: 'chest', stats: ['crit', 'mastery'] },
        { name: '켈투자드의 지팡이', slot: 'staff', stats: ['haste', 'mastery'] }, { name: '서리불꽃 손목보호구', slot: 'wrist', stats: ['crit', 'vers'] },
        { name: '아눕레칸의 장신구', slot: 'trinket', stats: ['haste', 'vers'] }, { name: '역병의 인장', slot: 'finger', stats: ['crit', 'mastery'] },
        { name: '서리불꽃 장화', slot: 'feet', stats: ['haste', 'mastery'] }, { name: '낙스라마스 목걸이', slot: 'neck', stats: ['crit', 'haste'] },
        { name: '지하추적자 투구', slot: 'head', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '지하추적자 갑옷', slot: 'chest', armor: 'mail', stats: ['crit', 'haste'] }, { name: '드레드노트 흉갑', slot: 'chest', armor: 'plate', stats: ['mastery', 'vers'] }, { name: '뼈낫 조끼', slot: 'chest', armor: 'leather', stats: ['crit', 'haste'] },
        { name: '네루비안 노예 조련사', slot: 'crossbow', stats: ['crit', 'mastery'] }, { name: '굶주린 냉기', slot: 'sword1h', prim: 'agi', stats: ['haste', 'vers'] }, { name: '메네실의 힘', slot: 'mace2h', stats: ['crit', 'haste'] }, { name: '지하추적자 손목보호구', slot: 'wrist', armor: 'mail', stats: ['haste', 'mastery'] },
        { name: '대지파괴자 투구', slot: 'head', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '대지파괴자 흉갑', slot: 'chest', armor: 'mail', stats: ['haste', 'mastery'] }, { name: '죽음의 기운 방패', slot: 'shield', stats: ['crit', 'vers'] },
      ],
    },
    // ---------- 특별: 리치 왕의 분노 챕터 피날레 (기존 콘텐츠) ----------
    icecrown: {
      chapter: 'special', order: 99, type: 'raid', name: '얼음왕관의 시련', icon: 'icecrown', duration: 900, theme: 'icecrown',
      desc: '원래의 시련. 리치 왕의 분노 챕터가 열리면 피날레가 됩니다.',
      power: { hp: 1, dmg: 1 }, ilvl: 55,
      roster: [['ghoul', 0, 10], ['skeleton', 45, 8], ['zombie', 100, 6], ['gargoyle', 160, 5], ['necromancer', 220, 3], ['cryptfiend', 320, 3], ['abomination', 440, 1.2]],
      swarm: ['ghoul', 'gargoyle|skeleton'],
      bosses: [
        { at: 1 / 3, id: 'patchwerk', warn: '패치워크: "패치워크랑 놀아줘!"' },
        { at: 2 / 3, id: 'kelthuzad', warn: '켈투자드: "너희의 영혼은 이제 리치 왕의 것이다!"' },
        { at: 1, id: 'lichking', warn: '리치 왕: "드디어... 내 앞에 섰구나."' },
      ],
      loot: [
        { name: '얼음왕관 성채의 두건', slot: 'head', stats: ['crit', 'haste'] }, { name: '사로나이트 인장', slot: 'finger', stats: ['haste', 'mastery'] },
        { name: '서리한의 파편', slot: 'trinket', stats: ['crit', 'mastery'] }, { name: '리치 왕의 망토', slot: 'back', stats: ['crit', 'vers'] },
        { name: '팔린러쉬, 쿠엘탈라스의 수호자', slot: 'crossbow', stats: ['crit', 'haste'] }, { name: '안카하르 혈액 사냥꾼 갑옷', slot: 'chest', armor: 'mail', stats: ['crit', 'mastery'] }, { name: '이미야르 군주의 흉갑', slot: 'chest', armor: 'plate', stats: ['haste', 'vers'] }, { name: '그림자칼날 조끼', slot: 'chest', armor: 'leather', stats: ['crit', 'vers'] },
        { name: '서리마녀의 사슬 투구', slot: 'head', armor: 'mail', stats: ['crit', 'haste'] }, { name: '얼음왕관 정령 철퇴', slot: 'mace1h', prim: 'int', stats: ['haste', 'mastery'] },
      ],
    },
  };
  const CHAPTERS = [
    { id: 'classic', name: '오리지널', desc: '아제로스의 첫 번째 위협들' },
    { id: 'special', name: '특별 스테이지', desc: '확장팩 챕터가 열리기 전까지의 특별 콘텐츠' },
  ];
  // 영웅 난이도
  const DIFFICULTY = {
    normal: { name: '일반', hp: 1, dmg: 1, ilvl: 0, badge: 1, gold: 1 },
    heroic: { name: '영웅', hp: 1.4, dmg: 1.25, ilvl: 12, badge: 2, gold: 1.5 },
  };
  // 엔드리스 (쐐기돌식): 60초마다 단계 +1
  const ENDLESS = {
    interval: 60, hpPer: 0.12, dmgPer: 0.06, bossEvery: 3,
    affixes: {
      fortified: { name: '경화', icon: 'affix_fortified', desc: '보스가 아닌 적의 생명력 +20%, 공격력 +30%' },
      tyrannical: { name: '폭군', icon: 'affix_tyrannical', desc: '보스와 정예의 생명력 +30%, 공격력 +15%' },
      raging: { name: '분노', icon: 'affix_raging', desc: '생명력 30% 이하의 적이 공격력 +50%' },
      bolstering: { name: '강화', icon: 'affix_bolstering', desc: '정예가 죽으면 주변 적의 생명력 +10%, 공격력 +5% (최대 10중첩)' },
      sanguine: { name: '피웅덩이', icon: 'affix_sanguine', desc: '적이 죽은 자리에 피웅덩이: 적은 회복, 당신은 피해' },
      volcanic: { name: '화산', icon: 'affix_volcanic', desc: '주기적으로 발밑에서 화염이 분출' },
    },
    // 단계별로 붙는 접두어 (주마다 회전)
    slots: [{ at: 2, pool: ['fortified', 'tyrannical'] }, { at: 4, pool: ['raging', 'bolstering', 'sanguine'] }, { at: 7, pool: ['volcanic', 'sanguine', 'bolstering'] }],
  };
  // 주차 문자열 → 이번 주 접두어
  const weeklyAffixes = weekKey => {
    let h = 0; for (const c of weekKey) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const out = [];
    for (const s of ENDLESS.slots) { const pool = s.pool.filter(a => !out.includes(a)); out.push(pool[h % pool.length]); h = Math.floor(h / 7) + 13; }
    return out;
  };
  // 클리어 점수 (랭킹 기준). 클리어 순간에 확정되고, 서버가 같은 식으로 다시 계산한다.
  //   처치: 마지막 보스가 나오기 전까지만 센다 (마지막 보스를 일부러 살려 두고 졸개를 잡는 게 이득이 되지 않게)
  //   보스: 처치마다 boss점 + 빨리 잡을수록 speed × par / (par + 걸린 초) — 3초 4348 · 20초 2500 · 60초 1250
  // s = { kills, elites, bosses: [보스 순서대로 걸린 초 또는 null(못 잡음)] }
  const SCORE = { kill: 1, elite: 50, boss: 3000, speed: 5000, par: 20 };
  const scoreOf = s => {
    const kills = s.kills * SCORE.kill, elites = s.elites * SCORE.elite;
    const bosses = s.bosses.map(sec => (sec == null ? 0 : Math.round(SCORE.boss + SCORE.speed * SCORE.par / (SCORE.par + sec))));
    return { kills, elites, bosses, total: kills + elites + bosses.reduce((a, b) => a + b, 0) };
  };
  // 클리어 판정 시각에 보스가 몇 마리 나왔는지 (서버 검증용)
  const bossesBy = (stage, t) => STAGES[stage].bosses.filter(b => b.at * STAGES[stage].duration <= t + 1).length;
  // 다음 스테이지 개방 조건: 이전 스테이지 일반 클리어
  const prevStage = id => {
    const s = STAGES[id]; if (s.chapter !== 'classic') return null;
    const list = Object.entries(STAGES).filter(([, v]) => v.chapter === s.chapter).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);
    const i = list.indexOf(id); return i > 0 ? list[i - 1] : null;
  };
  // 골드 배율: 스테이지 단계(권장 아이템 레벨 20 → 1배, 80 → 2.5배) × 난이도(영웅 1.5배)
  // 판에서 줍는 골드 · 시간 보너스 · 클리어 보너스 모두에 붙는다 (브라우저는 줍는 골드, 서버는 나머지와 검증 한도)
  const goldMul = (stage, diff) => +((1 + (STAGES[stage].ilvl - 20) / 40) * DIFFICULTY[diff].gold).toFixed(3);
  for (const id in STAGES) STAGES[id].id = id;
  const API = { STAGES, CHAPTERS, DIFFICULTY, ENDLESS, SWARMS, SCORE, weeklyAffixes, bossesBy, prevStage, goldMul, scoreOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else Object.assign(root.G, { STAGE_DATA: API });
})(this);
