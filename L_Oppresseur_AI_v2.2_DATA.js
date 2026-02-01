/* L'OPPRESSEUR AI v2.2 - DATA
   - Large choice libraries for: structures, emotional intensities, writing styles, accents/regions, genres
   - Templates (themes) and help text
*/

'use strict';
const APP_VERSION = 'v2.2 ULTIMATE';
const STRUCTURES = [
  {
    id:'classic_3v_hook',
    label:'classic (intro + verse1 + hook + verse2 + hook + verse3 + hook + outro)',
    group:'rap essentials',
    bars:{intro:4, verse1:16, hook:8, verse2:16, verse3:16, outro:4},
    notes:[
      'balanced radio-ready rap structure',
      'hook repeats 3x, each verse evolves the story'
    ],
    useWhen:['most topics', 'album tracks', 'general purpose']
  },
  {
    id:'two_verse_hook',
    label:'short (intro + verse1 + hook + verse2 + hook + outro)',
    group:'rap essentials',
    bars:{intro:4, verse1:16, hook:8, verse2:16, outro:4},
    notes:['faster impact, fewer verses', 'good for single idea or punchy concept'],
    useWhen:['tight message', 'quick release', 'demo']
  },
  {
    id:'hook_heavy_anthem',
    label:'anthem (intro + hook + verse1 + hook + verse2 + hook + hook + outro)',
    group:'hooks & anthems',
    bars:{intro:4, hook:8, verse1:12, verse2:12, outro:4},
    notes:['hook dominates, chants / slogans', 'high replayability'],
    useWhen:['motivation', 'crowd energy', 'brand anthem']
  },
  {
    id:'storytelling_rise',
    label:'storytelling rise (intro + verse1 + verse2 + hook + verse3 + outro)',
    group:'narrative',
    bars:{intro:4, verse1:16, verse2:16, hook:8, verse3:24, outro:4},
    notes:['hook arrives later', 'verse3 = climax / conclusion'],
    useWhen:['true story', 'plot twist', 'cinematic scene']
  },
  {
    id:'cinematic_build',
    label:'cinematic build (long intro + verse1 + prehook + hook + verse2 + hook + outro)',
    group:'cinematic',
    bars:{intro:8, verse1:16, prehook:4, hook:8, verse2:16, outro:8},
    notes:['intro sets atmosphere', 'prehook increases tension before hook'],
    useWhen:['dark themes', 'visual storytelling', 'movie-like']
  },
  {
    id:'interlude_break',
    label:'interlude break (intro + verse1 + hook + interlude + verse2 + hook + verse3 + outro)',
    group:'cinematic',
    bars:{intro:4, verse1:16, hook:8, interlude:8, verse2:16, verse3:16, outro:4},
    notes:['interlude is instrumental or spoken', 'good for contrast and breath'],
    useWhen:['long tracks', 'concept songs', 'intense emotions']
  },
  {
    id:'minimal_mantra',
    label:'minimal mantra (intro + verse1 + hook x4 + outro)',
    group:'experimental',
    bars:{intro:4, verse1:12, hook:6, outro:4},
    notes:['very repetitive hook', 'hypnotic / mantra vibe'],
    useWhen:['lo-fi', 'ambient rap', 'meditative']
  },
  {
    id:'no_hook_poem',
    label:'no hook (intro + verse1 + verse2 + verse3 + outro)',
    group:'lyrical',
    bars:{intro:4, verse1:20, verse2:20, verse3:20, outro:4},
    notes:['pure writing focus', 'continuous narrative / poetry'],
    useWhen:['poetic', 'conscious', 'hard topics']
  },
  {
    id:'bridge_switch',
    label:'bridge switch (intro + verse1 + hook + verse2 + bridge + hook + verse3 + outro)',
    group:'bridges & switches',
    bars:{intro:4, verse1:16, hook:8, verse2:16, bridge:8, verse3:16, outro:4},
    notes:['bridge changes angle (confession, twist, calm)', 'then hook hits harder'],
    useWhen:['emotional arcs', 'contrast', 'big reveal']
  },
  {
    id:'double_time_core',
    label:'double-time (intro + verse1 fast + hook + verse2 fast + hook + verse3 fast + outro)',
    group:'flow-focused',
    bars:{intro:4, verse1:16, hook:8, verse2:16, verse3:16, outro:4},
    notes:['denser syllables', 'rhythm-first writing'],
    useWhen:['technical rap', 'hardcore', 'drill']
  },
  {
    id:'freestyle_open',
    label:'freestyle open (loose sections, no strict bars, raw energy)',
    group:'freestyle',
    bars:{intro:0, verse1:0, hook:0, verse2:0, verse3:0, outro:0},
    notes:['freer structure', 'lets the model improvise'],
    useWhen:['freestyle', 'warm-up', 'rapid ideas']
  },
  {
    id:'call_response_hook',
    label:'call & response (intro + hook + verse + hook + verse + hook + outro)',
    group:'hooks & anthems',
    bars:{intro:4, hook:8, verse1:14, verse2:14, outro:4},
    notes:['hook designed for crowd response', 'short lines, strong rhythm'],
    useWhen:['live vibe', 'anthem', 'party']
  },
  {
    id:'verse_stack',
    label:'verse stack (intro + verse1 + verse2 + verse3 + hook + outro)',
    group:'lyrical',
    bars:{intro:4, verse1:16, verse2:16, verse3:16, hook:8, outro:4},
    notes:['hook arrives after 3 verses', 'big payoff at the end'],
    useWhen:['story', 'conscious build', 'concept']
  },
  {
    id:'hook_only',
    label:'hook-only (intro + hook x6 + outro)',
    group:'experimental',
    bars:{intro:4, hook:8, outro:4},
    notes:['extreme repetition', 'used for memes / viral hooks'],
    useWhen:['experimental', 'commercial', 'tiktok-style']
  },
  {
    id:'drill_layout',
    label:'drill layout (intro + hook + verse1 + hook + verse2 + hook + outro)',
    group:'genre-specific',
    bars:{intro:4, hook:8, verse1:12, verse2:12, outro:4},
    notes:['short aggressive verses', 'punchy hook'],
    useWhen:['drill', 'hardcore', 'street energy']
  },
  {
    id:'trap_modern_layout',
    label:'modern trap (intro + hook + verse1 + hook + verse2 + hook + outro)',
    group:'genre-specific',
    bars:{intro:4, hook:8, verse1:16, verse2:16, outro:4},
    notes:['hook early', 'verses keep cadence and ad-libs (written, not actual voices)'],
    useWhen:['trap', 'melodic trap', 'dark trap']
  },
  {
    id:'lofi_diary',
    label:'lo-fi diary (intro + verse1 + hook + verse2 + hook + spoken outro)',
    group:'genre-specific',
    bars:{intro:6, verse1:14, hook:6, verse2:14, outro:8},
    notes:['intimate', 'soft hooks', 'spoken outro conclusion'],
    useWhen:['lo-fi', 'introspection']
  },
  {
    id:'cypher_4x8',
    label:'cypher (4 verses of 8 bars, no hook)',
    group:'flow-focused',
    bars:{intro:0, verse1:8, verse2:8, verse3:8, verse4:8, outro:0},
    notes:['compact verses', 'show skills fast'],
    useWhen:['cyphers', 'showcase', 'technical']
  },
  {
    id:'epic_longform',
    label:'epic longform (intro + verse1 + hook + verse2 + hook + verse3 + hook + verse4 + outro)',
    group:'longform',
    bars:{intro:8, verse1:16, hook:8, verse2:16, verse3:16, verse4:16, outro:8},
    notes:['album centerpiece', 'big arc, multiple revelations'],
    useWhen:['concept', 'deep story', 'long tracks']
  },
  {
    id:'reverse_hook',
    label:'reverse hook (hook + verse1 + hook + verse2 + hook + verse3 + outro)',
    group:'hooks & anthems',
    bars:{hook:8, verse1:16, verse2:16, verse3:16, outro:4},
    notes:['starts with the hook', 'immediate identity'],
    useWhen:['branding', 'singles', 'commercial']
  }
];
const EMOTIONAL_INTENSITIES = [
  { id:'whispered_fragile', label:'whispered fragile', group:'internal', description:'low-volume emotional openness, careful words, shaky honesty, small details that hit hard', cues:['short sentences','confessions','soft tension'], energy:1 },
  { id:'vulnerable', label:'vulnerable', group:'internal', description:'open wound but proud, admits pain without self-hate, real talk, grounded', cues:['human','direct','no theatrics'], energy:2 },
  { id:'melancholic', label:'melancholic', group:'internal', description:'sad but lucid, reflective, memory-heavy, quiet nights and long thoughts', cues:['images of time','regret','calm'], energy:2 },
  { id:'introspective', label:'introspective', group:'internal', description:'analysis mode, self-observation, patterns, truths, lessons', cues:['logic','clarity','insight'], energy:3 },
  { id:'cold_lucid', label:'cold lucid', group:'tension', description:'emotion under ice, surgical truths, controlled delivery', cues:['short hooks','precise words'], energy:3 },
  { id:'determined', label:'determined', group:'tension', description:'focused forward drive, grit without yelling, discipline energy', cues:['action verbs','momentum'], energy:4 },
  { id:'resilient', label:'resilient', group:'tension', description:'took hits but still standing, stubborn strength, calm power', cues:['scars as lessons','steady tone'], energy:4 },
  { id:'hopeful', label:'hopeful', group:'elevation', description:'light breaking through, not cheesy, earned optimism', cues:['future','rebuild','promise'], energy:4 },
  { id:'balanced', label:'balanced', group:'neutral', description:'middle ground, both pain and strength, documentary tone', cues:['contrast','truth'], energy:4 },
  { id:'heated', label:'heated', group:'combat', description:'anger rising, sharper lines, more pressure', cues:['accusations','edge'], energy:5 },
  { id:'rebellious', label:'rebellious', group:'combat', description:'refuses to bow, anti-control, proud defiance', cues:['refusal','identity'], energy:6 },
  { id:'aggressive', label:'aggressive', group:'combat', description:'hard delivery, hostile energy, punchlines hit', cues:['short attacks','hard endings'], energy:7 },
  { id:'furious', label:'furious', group:'explosive', description:'red zone, burning, relentless', cues:['rapid lines','violent verbs'], energy:8 },
  { id:'rage_pure', label:'rage pure', group:'explosive', description:'maximum heat, no compromise, volcanic', cues:['chant hooks','heavy accusations'], energy:9 },
  { id:'triumphant', label:'triumphant', group:'elevation', description:'victory earned, chest up, confidence', cues:['dominant hook','big statements'], energy:7 },
  { id:'empowered', label:'empowered', group:'elevation', description:'freedom regained, self-control, ownership', cues:['boundaries','decisions'], energy:6 },
  { id:'dark_humor', label:'dark humor', group:'special', description:'grim jokes, sarcasm, cold punchlines', cues:['irony','snap endings'], energy:5 },
  { id:'paranoid', label:'paranoid', group:'special', description:'suspicion, betrayal, tension, watch your back', cues:['questions','doubts'], energy:6 },
  { id:'unstoppable', label:'unstoppable', group:'elevation', description:'machine mode, relentless forward force', cues:['repetition','mantras'], energy:8 },
  { id:'reflective_pride', label:'reflective pride', group:'special', description:'proud without ego, calm testimony', cues:['gratitude','facts'], energy:5 }
];
const WRITING_STYLES = [
  {
    id:'oppresseur_qc_conscious',
    label:"l'oppresseur — rap conscient québécois",
    group:'signature',
    description:'lucid, grounded, street-real without caricature, strong lines, no filler, documentary emotion',
    rules:[
      'québec natural phrasing, clean but real',
      'no "français de france" stiffness',
      'powerful but controlled'
    ]
  },
  {
    id:'rap_conscient',
    label:'rap conscient (dénonce / engagé)',
    group:'message',
    description:'denounces injustice, transmits a worldview, prioritizes meaning and coherence; must sound credible',
    rules:['concrete examples','clear position','no empty slogans']
  },
  {
    id:'rap_egotrip',
    label:'rap égotrip (clash / boss energy)',
    group:'battle',
    description:'self-proclaimed best, competitive, sharp comparisons, dominance; punchlines are the engine',
    rules:['confident tone','no whining','bar-ending rhymes']
  },
  {
    id:'rap_poetique',
    label:'rap poétique (écriture soutenue)',
    group:'craft',
    description:'melodic imagery, careful cadence, form + meaning; poetic without being vague',
    rules:['images grounded','avoid clichés','musical vowels']
  },
  {
    id:'rap_gangsta',
    label:'rap gangsta (street posture)',
    group:'street',
    description:'hard codes, loyalty, danger, survival; must keep credibility and realism',
    rules:['no fairy-tale flex','scenes, not brag lists','cold consequences']
  },
  {
    id:'rap_hardcore',
    label:'rap hardcore (rejet & violence verbale)',
    group:'street',
    description:'raw critique of society, pressure, poverty, conflict; intense language without being random',
    rules:['direct attacks on systems','tight rhythm','no nonsense']
  },
  {
    id:'rap_commercial',
    label:'rap commercial (tendance / radio)',
    group:'industry',
    description:'catchy hooks, simple words, wide appeal; still must stay decent and coherent',
    rules:['short hook','clear theme','repeatable']
  },
  {
    id:'rap_narratif',
    label:'rap narratif (histoire / scènes)',
    group:'story',
    description:'clear story progression, visuals, turning points, characters; like a short film',
    rules:['scene markers','timeline','payoff']
  },
  {
    id:'rap_introspectif',
    label:'rap introspectif (self-control / vérité)',
    group:'mind',
    description:'inner dialogue, patterns, self-mastery, emotional clarity; strong conclusions',
    rules:['honest','no self-hate','lesson at end']
  },
  {
    id:'rap_dark_sarcastic',
    label:'rap sarcastique sombre',
    group:'special',
    description:'irony, cold humor, cynical truth; lines end with sharp twists',
    rules:['short punches','ironic contrasts']
  },
  {
    id:'spoken_word_rap',
    label:'spoken word rap (prose rythmée)',
    group:'craft',
    description:'spoken cadence, less rhymes, more impact; still rhythmic and structured',
    rules:['varied line lengths','strong imagery','clear delivery']
  }
];
const ACCENTS_REGIONS = [
  { id:'qc_mtl_street', label:'québec — montréal street', group:'québec', description:'regional phrasing, street realism, punchy cadence, no forced contractions', examples:['ça clanche','pour vrai','j’ai compris'] },
  { id:'qc_clean', label:'québec — clean', group:'québec', description:'clear québécois without heavy slang, precise articulation', examples:['c’est clair','je reste droit'] },
  { id:'fr_paris', label:'france — paris', group:'france', description:'standard french rap diction, clean syntax, punchy modern phrases', examples:['j’avance','j’assume'] },
  { id:'fr_banlieue', label:'france — banlieue', group:'france', description:'urban french street tone, tighter slang but still readable', examples:['j’fais le taf','pas le temps'] },
  { id:'fr_litteraire', label:'france — littéraire', group:'france', description:'more formal, poetic, refined; still rap-friendly', examples:['lucidité','constat'] },
  { id:'ca_fr_neutral', label:'canada francophone — neutre', group:'canada', description:'neutral canadian french, clear, minimal slang', examples:['je continue','ça fait du sens'] },
  { id:'intl_fr', label:'international francophone', group:'intl', description:'neutral global french, avoids very local idioms', examples:['je progresse','je résiste'] }
];
const MUSIC_GENRES = [
  { id:'boom_bap', label:'boom bap', group:'hip-hop', description:'classic drums, swing, sample vibe; lyrical focus' },
  { id:'boom_bap_dark', label:'dark boom bap', group:'hip-hop', description:'minor keys, dusty samples, heavy drums' },
  { id:'trap', label:'trap', group:'trap', description:'808s, crisp hats, modern bounce' },
  { id:'dark_trap', label:'dark trap', group:'trap', description:'sinister textures, heavy 808, cold atmosphere' },
  { id:'melodic_trap', label:'trap mélodique', group:'trap', description:'melodies + 808, emotional but punchy' },
  { id:'drill', label:'drill', group:'trap', description:'sliding bass, aggressive patterns, sharp delivery' },
  { id:'lofi_rap', label:'lo-fi rap', group:'chill', description:'warm noise, soft drums, diary vibe' },
  { id:'cloud_rap', label:'cloud rap', group:'chill', description:'airy pads, reverb, floaty mood' },
  { id:'cinematic_rap', label:'rap cinématique', group:'cinematic', description:'strings, piano, big drums, soundtrack feeling' },
  { id:'industrial_hiphop', label:'industrial hip-hop', group:'experimental', description:'distortion, metallic hits, harsh textures' },
  { id:'phonk_rap', label:'phonk', group:'trap', description:'memphis textures, cowbells, dark bounce' },
  { id:'grime', label:'grime', group:'uk', description:'140bpm, raw synths, tight flows' },
  { id:'jersey_club_rap', label:'jersey club rap', group:'dance', description:'fast bounce, chopped samples' },
  { id:'afro_rap', label:'afro-rap', group:'global', description:'afro rhythms, warm grooves, modern rap' },
  { id:'rage_trap', label:'rage trap', group:'trap', description:'hyper energy synths, aggressive bounce' },
  { id:'g_funk', label:'g-funk', group:'west', description:'funk leads, smooth bounce, classic west vibe' },
  { id:'old_school', label:'old school hip-hop', group:'hip-hop', description:'simple drums, party cadence, clear hooks' },
  { id:'electro_rap', label:'electro rap', group:'electronic', description:'synth-driven, EDM energy with rap' },
  { id:'ambient_rap', label:'ambient rap', group:'chill', description:'atmospheric soundscapes, minimal drums' },
  { id:'latin_rap', label:'latin rap', group:'global', description:'latin rhythms, percussive drive' },
  { id:'reggae_rap', label:'reggae rap', group:'global', description:'offbeat groove with rap delivery' },
  { id:'rock_rap', label:'rock rap', group:'fusion', description:'guitars, live drums, rap cadence' },
  { id:'metal_rap', label:'metal rap', group:'fusion', description:'heavy guitars, aggressive rhythms' },
  { id:'soul_rap', label:'soul rap', group:'fusion', description:'soul samples / chords, warm emotional tone' }
];
const GENRE_HELP = {
  title:'guide des genres',
  body:'Chaque genre influence le groove, l’espace entre les lignes, et le type de hook. Choisis le genre avant de générer pour que l’écriture colle au beat.'
};
const DEFAULT_TEMPLATES = [
  {
    category:'🔥 lutte & résilience',
    templates:[
      { title:'tenir debout', desc:'rester solide quand tout te pousse à plier, scènes concrètes, constats lucides' },
      { title:'marche droite', desc:'discipline, self-control, progression lente mais vraie' },
      { title:'rien n’est donné', desc:'les obstacles comme école, conséquences, choix' }
    ]
  },
  {
    category:'⚡ dénonciation & société',
    templates:[
      { title:'système truqué', desc:'injustice, hypocrisie, double standard, sans discours vide' },
      { title:'vitrine', desc:'apparences vs réalité, mensonges acceptés, vérité qui dérange' }
    ]
  },
  {
    category:'🎭 introspection',
    templates:[
      { title:'se regarder en face', desc:'patterns, erreurs, lucidité sans auto-destruction' },
      { title:'nuit blanche', desc:'pensées lourdes, silence, décisions' }
    ]
  }
];


// expose to non-module usage
window.OPP_DATA = window.OPP_DATA || {};
Object.assign(window.OPP_DATA, {
  APP_VERSION,
  STRUCTURES,
  EMOTIONAL_INTENSITIES,
  WRITING_STYLES,
  ACCENTS_REGIONS,
  MUSIC_GENRES,
  GENRE_HELP,
  DEFAULT_TEMPLATES
});
