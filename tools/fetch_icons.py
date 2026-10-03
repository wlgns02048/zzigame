"""WoW 아이콘 받기: 키마다 후보 이름을 순서대로 시도해 처음 존재하는 것을 assets/icons/<키>.jpg로 저장.
사용: python tools/fetch_icons.py   (이미 있는 파일은 건너뜀)"""
import os, sys, urllib.request, urllib.error

BASE = 'https://wow.zamimg.com/images/wow/icons/medium/{}.jpg'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

ICONS = {
    # ---- 흑마법사 ----
    'classwarlock': ['classicon_warlock'],
    'corruption': ['spell_shadow_abominationexplosion'],
    'agony': ['spell_shadow_curseofsargeras'],
    'shadowbolt': ['spell_shadow_shadowbolt'],
    'seedofcorruption': ['spell_shadow_seedofdestruction'],
    'unstableaffliction': ['spell_shadow_unstableaffliction_3', 'spell_shadow_unstableaffliction_1'],
    'drainlife': ['spell_shadow_lifedrain02'],
    'fear': ['spell_shadow_possession'],
    'shadowfury': ['ability_warlock_shadowfurytga', 'spell_shadow_shadowfury'],
    'demoniccircle': ['spell_shadow_demoniccircleteleport'],
    'unendingresolve': ['spell_shadow_demonictactics'],
    'healthstone': ['warlock_-healthstone', 'inv_stone_04'],
    'imp': ['spell_shadow_summonimp'],
    'voidwalker': ['spell_shadow_summonvoidwalker'],
    'felhunter': ['spell_shadow_summonfelhunter'],
    'soulshard': ['inv_misc_gem_amethyst_02'],
    'rainoffire': ['spell_shadow_rainoffire'],
    'chaosbolt': ['ability_warlock_chaosbolt'],
    'haunt': ['ability_warlock_haunt'],
    'deathcoil': ['spell_shadow_deathcoil'],
    'siphonlife': ['spell_shadow_requiem'],
    'maleficrapture': ['ability_warlock_everlastingaffliction'],
    'darkpact': ['spell_shadow_deathpact'],
    'nightfall': ['spell_shadow_twilight'],
    'shadowembrace': ['spell_shadow_shadowembrace'],
    'hellfire': ['spell_fire_incinerate'],
    'demonarmor': ['spell_shadow_ragingscream'],
    'shadowmastery': ['spell_shadow_shadetruesight'],
    'inferno': ['spell_shadow_summoninfernal'],
    'lifetap': ['spell_shadow_burningspirit'],
    'curseofweakness': ['spell_shadow_curseofmannoroth'],
    'amplifycurse': ['spell_shadow_contagion'],
    'grimreach': ['spell_shadow_callofbone'],
    'felconcentration': ['spell_shadow_fingerofdeath'],
    'suppression': ['spell_shadow_unsummonbuilding'],
    'drainsoul': ['spell_shadow_haunting'],
    'soulleech': ['spell_shadow_soulleech_3'],
    'darksoul': ['spell_warlock_soulburn', 'spell_shadow_soulgem'],
    'shadowburn': ['spell_shadow_scourgebuild'],
    'doom': ['spell_shadow_auraofdarkness'],
    # ---- 직업 특성 (마법사 추가분) ----
    'elementalprecision': ['spell_ice_magicdamage'],
    'iceshards': ['spell_frost_iceshard'],
    'arcticreach': ['spell_shadow_darkritual'],
    'frostchanneling': ['spell_frost_stun'],
    'wintersgrasp': ['spell_frost_frostward'],
    'improvedblizzard': ['spell_frost_icestorm'],
    # ---- 클래식 보스 / 적 ----
    'vancleef': ['achievement_boss_edwinvancleef', 'inv_misc_bandana_03'],
    'rhahkzor': ['inv_misc_head_ogre_01', 'achievement_character_human_male'],
    'mrsmite': ['inv_misc_head_tauren_01', 'ability_warrior_cleave'],
    'silverlaine': ['achievement_boss_baronsilverlaine', 'inv_misc_head_human_01'],
    'springvale': ['achievement_boss_commandersspringvale', 'spell_holy_sealofvengeance'],
    'arugal': ['achievement_boss_archmagearugal', 'spell_shadow_summonfelguard'],
    'loksey': ['inv_misc_head_human_01', 'ability_hunter_beastcall'],
    'doan': ['inv_staff_13', 'spell_holy_arcaneintellect'],
    'whitemane': ['achievement_boss_highinquisitorwhitemane', 'spell_holy_resurrection'],
    'jandice': ['inv_misc_head_human_02', 'spell_shadow_charm'],
    'frostwhisper': ['spell_frost_frostbolt02', 'spell_frost_chainsofice'],
    'gandling': ['achievement_boss_darkmastergandling', 'spell_shadow_raisedead'],
    'anastari': ['spell_shadow_mindsteal', 'inv_misc_head_undead_01'],
    'ramstein': ['spell_shadow_abominationexplosion', 'inv_misc_monsterhead_02'],
    'rivendare': ['achievement_boss_baronrivendare', 'ability_mount_undeadhorse'],
    'lucifron': ['spell_fire_lavaspawn', 'spell_shadow_curse'],
    'magmadar': ['ability_hunter_pet_corehound', 'inv_misc_monsterhead_02'],
    'ragnaros': ['achievement_boss_ragnaros', 'spell_fire_elemental_totem'],
    'razorgore': ['achievement_boss_razorgore', 'inv_misc_head_dragon_black'],
    'vaelastrasz': ['achievement_boss_vaelastrasz', 'inv_misc_head_dragon_red'],
    'nefarian': ['achievement_boss_nefarion', 'inv_misc_head_dragon_black'],
    'anubrekhan': ['achievement_boss_anubrekhan', 'inv_misc_ahnqirajtrinket_01'],
    'defias': ['inv_misc_bandana_03'],
    'kobold': ['inv_misc_candle_02', 'inv_misc_head_kobold_01'],
    'worgen': ['ability_racial_worgenform', 'inv_misc_monsterhead_04'],
    'wolf': ['ability_hunter_pet_wolf'],
    'bat': ['ability_hunter_pet_bat'],
    'ghost': ['spell_shadow_ghostkey'],
    'scarlet': ['inv_shield_05', 'spell_holy_sealofwrath'],
    'hound': ['ability_hunter_pet_hyena', 'ability_hunter_pet_wolf'],
    'student': ['inv_misc_book_09'],
    'spider': ['ability_hunter_pet_spider'],
    'fireelemental': ['spell_fire_elemental_totem', 'spell_fire_fire'],
    'corehound': ['ability_hunter_pet_corehound', 'ability_hunter_pet_hyena'],
    'flamewaker': ['spell_fire_firearmor'],
    'drakonid': ['inv_misc_head_dragon_bronze', 'inv_misc_head_dragon_black'],
    'whelp': ['ability_hunter_pet_dragonhawk', 'inv_misc_head_dragon_red'],
    'blackrock': ['inv_misc_head_orc_01'],
    # ---- 던전 / 공격대 / 챕터 ----
    'deadmines': ['achievement_zone_deadmines', 'inv_pick_02', 'inv_misc_bandana_03'],
    'shadowfang': ['achievement_zone_shadowfangkeep', 'inv_misc_monsterhead_04'],
    'scarletmonastery': ['achievement_zone_scarletmonastery', 'inv_shield_05'],
    'scholomance': ['achievement_zone_scholomance', 'inv_misc_book_09'],
    'stratholme': ['achievement_zone_stratholme', 'ability_mount_undeadhorse'],
    'moltencore': ['achievement_zone_moltencore', 'spell_fire_lavaspawn'],
    'blackwinglair': ['achievement_zone_blackwinglair', 'inv_misc_head_dragon_black'],
    'naxxramas': ['achievement_dungeon_naxxramas', 'inv_trinket_naxxramas04'],
    'icecrown': ['achievement_zone_icecrown_01', 'achievement_boss_lichking', 'spell_frost_frostward'],
    'heroic': ['achievement_dungeon_heroic_gloryoftheraider', 'ability_warrior_innerrage'],
    # ---- 장비 ----
    'eq_head': ['inv_helmet_29'], 'eq_neck': ['inv_jewelry_necklace_07'], 'eq_shoulder': ['inv_shoulder_02'],
    'eq_back': ['inv_misc_cape_06'], 'eq_chest': ['inv_chest_cloth_05'], 'eq_wrist': ['inv_bracer_09'],
    'eq_hands': ['inv_gauntlets_17'], 'eq_waist': ['inv_belt_08'], 'eq_legs': ['inv_pants_08'], 'eq_feet': ['inv_boots_05'],
    'eq_finger': ['inv_jewelry_ring_03'], 'eq_trinket': ['inv_trinket_naxxramas03', 'inv_misc_gem_pearl_04'],
    'eq_staff': ['inv_staff_13'], 'eq_dagger': ['inv_weapon_shortblade_25'], 'eq_wand': ['inv_wand_07'], 'eq_offhand': ['inv_misc_book_07'],
    'eq_head2': ['inv_helmet_53', 'inv_crown_01'], 'eq_chest2': ['inv_chest_cloth_43', 'inv_chest_cloth_12'], 'eq_staff2': ['inv_staff_20', 'inv_staff_07'],
    'eq_shoulder2': ['inv_shoulder_23', 'inv_shoulder_25'], 'eq_legs2': ['inv_pants_cloth_05', 'inv_pants_07'], 'eq_hands2': ['inv_gauntlets_14'],
    'eq_finger2': ['inv_jewelry_ring_ahnqiraj_01', 'inv_jewelry_ring_15'], 'eq_neck2': ['inv_jewelry_necklace_ahnqiraj_02', 'inv_jewelry_amulet_04'],
    'eq_trinket2': ['inv_misc_rune_06', 'inv_trinket_naxxramas06'], 'eq_back2': ['inv_misc_cape_20', 'inv_misc_cape_18'],
    'atiesh': ['inv_staff_medivh'], 'eyeofsulfuras': ['inv_hammer_unique_sulfuras', 'spell_fire_fire'],
    'empty_slot': ['inv_misc_questionmark'],
    # ---- 보석 / 마법부여 / 재화 ----
    'gem_red': ['inv_jewelcrafting_livingruby_02', 'inv_misc_gem_ruby_02'],
    'gem_yellow': ['inv_jewelcrafting_dawnstone_02', 'inv_misc_gem_topaz_02'],
    'gem_blue': ['inv_jewelcrafting_starofelune_02', 'inv_misc_gem_sapphire_02'],
    'gem_purple': ['inv_jewelcrafting_nightseye_02', 'inv_misc_gem_amethyst_01'],
    'gem_green': ['inv_jewelcrafting_talasite_02', 'inv_misc_gem_emerald_02'],
    'gem_orange': ['inv_jewelcrafting_nobletopaz_02', 'inv_misc_gem_opal_02'],
    'gem_meta': ['inv_jewelcrafting_shadowspirit_02', 'inv_misc_gem_diamond_02'],
    'enchant': ['inv_enchant_formulasuperior_01', 'inv_scroll_06'],
    'enchant_weapon': ['spell_holy_greaterheal', 'inv_enchant_shardgleamingsmall'],
    'badge': ['spell_holy_championsbond'],
    'dust': ['inv_enchant_dustarcane'],
    'essence': ['inv_enchant_essenceeternallarge'],
    'shard': ['inv_enchant_shardnexuslarge', 'inv_enchant_shardbrilliantlarge'],
    'roughgem': ['inv_ore_thorium_02', 'inv_ore_mithril_01'],
    # ---- 로비 / 기능 ----
    'vault': ['achievement_guildperk_bountifulbags', 'inv_box_04'],
    'quest': ['inv_misc_note_01'],
    'questweekly': ['inv_misc_note_06', 'inv_letter_15'],
    'ranking': ['achievement_arena_2v2_7', 'inv_misc_trophy_argent'],
    'bag': ['inv_misc_bag_10'],
    'talents': ['ability_marksmanship', 'inv_misc_book_11'],
    'library': ['inv_misc_book_11'],
    'gacha_equip': ['inv_box_02'], 'gacha_enchant': ['inv_misc_enggizmos_27', 'inv_scroll_03'], 'gacha_gem': ['inv_misc_gem_bloodgem_01', 'inv_jewelcrafting_gem_01'],
    'portal': ['spell_arcane_portaldalaran'],
    'endless': ['inv_relics_hourglass', 'spell_holy_borrowedtime'],
    'board': ['inv_letter_09', 'inv_misc_note_01'],
    'affix_fortified': ['ability_toughness'], 'affix_tyrannical': ['achievement_boss_archaedas'],
    'affix_raging': ['ability_warrior_focusedrage'], 'affix_volcanic': ['spell_shaman_lavasurge'],
    'affix_bolstering': ['ability_warrior_battleshout'], 'affix_sanguine': ['spell_shadow_bloodboil'],
    # ---- 달라란 도서관 신규 ----
    'widevision': ['spell_holy_mindvision'], 'banish': ['spell_shadow_cripple'], 'seal': ['spell_holy_sealofwisdom'],
    'scroll': ['inv_scroll_11'], 'treasure': ['inv_misc_coin_02'], 'legendcall': ['inv_misc_rune_09', 'spell_arcane_arcane04'],
    'schoolauto': ['spell_arcane_blink'], 'schoolactive': ['spell_arcane_arcanepotency'], 'schoolpassive': ['spell_holy_magicalsentry'],
    'autocast': ['inv_misc_pocketwatch_01'],
    'bloodlust': ['spell_nature_bloodlust'],
    # ---- 고통 흑마법사 개편 ----
    'darkglare': ['inv_beholderwarlock'], 'viletaint': ['sha_spell_shadow_shadesofdarkness_nightborne'], 'phantomsingularity': ['inv_enchant_voidsphere'],
}

def main():
    os.makedirs(OUT, exist_ok=True)
    missing = []
    for key, cands in ICONS.items():
        dst = os.path.join(OUT, key + '.jpg')
        if os.path.exists(dst):
            continue
        for name in cands:
            try:
                with urllib.request.urlopen(BASE.format(name), timeout=15) as r:
                    data = r.read()
                open(dst, 'wb').write(data)
                break
            except urllib.error.HTTPError:
                continue
        else:
            missing.append(key)
    print('missing:', missing if missing else 'none')
    return 1 if missing else 0

if __name__ == '__main__':
    sys.exit(main())
