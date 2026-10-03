'use strict';
// WoW 아이콘 (wow.zamimg.com 에서 받은 원본, assets/icons/*.jpg)
G.ICON_KEYS = [
  'abomination', 'arcaneint', 'area', 'blink', 'blizzard', 'bonechilling', 'brainfreeze', 'chest', 'chillstreak', 'classmage',
  'coldfront', 'coldhearted', 'coldsnap', 'cometstorm', 'coneofcold', 'crit', 'cryptfiend', 'duration', 'fingersoffrost', 'flurry',
  'food', 'freeze', 'freezingrain', 'freezingwinds', 'frostarmor', 'frostbite', 'frostbolt', 'frostfire', 'frostnova', 'frozenorb',
  'gargoyle', 'ghoul', 'giantheart', 'glacialfrag', 'glacialspike', 'gold', 'haste', 'icebarrier', 'iceblock', 'icefloes', 'icelance',
  'icenova', 'icicles', 'icyveins', 'kelthuzad', 'lichking', 'luck', 'magnet', 'mirrorimage', 'necromancer', 'patchwerk', 'permafrost',
  'pickup', 'projectile', 'rayoffrost', 'regen', 'reroll', 'shatter', 'shiftingpower', 'skeleton', 'soulstone', 'speed', 'splinter',
  'splinterstorm', 'splittingice', 'stamina', 'thermalvoid', 'timewarp', 'waterelemental', 'winterschill', 'xp', 'zombie',
  // 지속 피해 표시 (적 머리 위)
  'corruption', 'agony', 'unstableaffliction', 'siphonlife', 'haunt', 'seedofcorruption', 'blackarrow',
  // 사냥꾼 표식 (적 머리 위)
  'eagle', 'huntersmark', 'sentinel',
  // 전리품
  'bloodlust',
];
G.icon = k => `assets/icons/${k}.jpg`;
G.IMG = {};

G.loadAssets = () => Promise.all(G.ICON_KEYS.map(k => new Promise(res => {
  const im = new Image();
  im.onload = () => res(); im.onerror = () => res();
  im.src = G.icon(k); G.IMG[k] = im;
})));
