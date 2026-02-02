/* L'OPPRESSEUR AI v2.2 - LOGIC
   - Multi-LLM (Gemini/OpenAI/Claude) key management and switching
   - 2-pass strategy -> lyrics -> style-suno (final) generation
   - IndexedDB library
   - UI helpers: dynamic explain panels, search/filter, templates
*/

'use strict';

import {
  APP_VERSION,
  STRUCTURES,
  EMOTIONAL_INTENSITIES,
  WRITING_STYLES,
  ACCENTS_REGIONS,
  MUSIC_GENRES,
  DEFAULT_TEMPLATES
} from './L_Oppresseur_AI_v2.2_DATA.js';

const DB_NAME = 'oppresseur_v22';
const DB_VERSION = 1;
let db = null;

const state = {
  currentOutput: '',
  currentStrategy: null,
  currentSunoStyle: '',
  currentTitle: '',
  lastPromptBundle: null,
  compare: { A: null, B: null },
  editorItemId: null
};

// ---------- Utilities ----------
function $(id){ return document.getElementById(id); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function nowIso(){ return new Date().toISOString(); }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function countWords(t){ return (t||'').trim().split(/\s+/).filter(Boolean).length; }
function clampStr(s, max){ s = (s||'').trim(); return s.length<=max ? s : s.slice(0, max-1).trim(); }

function toast(msg, type='info'){
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.innerHTML = escapeHtml(msg);
  document.body.appendChild(n);
  setTimeout(()=>{ n.remove(); }, 3200);
}

// ---------- IndexedDB ----------
async function initDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e)=>{
      const d = e.target.result;
      if(!d.objectStoreNames.contains('lyrics')){
        const s = d.createObjectStore('lyrics', {keyPath:'id', autoIncrement:true});
        s.createIndex('date','date',{unique:false});
        s.createIndex('favorite','favorite',{unique:false});
      }
    };
  });
}

async function dbAddLyric(item){
  const tx = db.transaction(['lyrics'],'readwrite');
  const store = tx.objectStore('lyrics');
  return new Promise((resolve,reject)=>{
    const req = store.add(item);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

async function dbUpdateLyric(id, patch){
  const tx = db.transaction(['lyrics'],'readwrite');
  const store = tx.objectStore('lyrics');
  return new Promise((resolve,reject)=>{
    const getReq = store.get(id);
    getReq.onerror = ()=>reject(getReq.error);
    getReq.onsuccess = ()=>{
      const item = getReq.result;
      Object.assign(item, patch);
      const putReq = store.put(item);
      putReq.onerror = ()=>reject(putReq.error);
      putReq.onsuccess = ()=>resolve(putReq.result);
    };
  });
}

async function dbGetAllLyrics(){
  const tx = db.transaction(['lyrics'],'readonly');
  const store = tx.objectStore('lyrics');
  return new Promise((resolve,reject)=>{
    const req = store.getAll();
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}

async function dbDeleteLyric(id){
  const tx = db.transaction(['lyrics'],'readwrite');
  const store = tx.objectStore('lyrics');
  return new Promise((resolve,reject)=>{
    const req = store.delete(id);
    req.onsuccess = ()=>resolve();
    req.onerror = ()=>reject(req.error);
  });
}

// ---------- Settings: Keys & Provider ----------
const LS_KEYS = {
  provider:'v22_provider',
  gemini:'v22_key_gemini',
  openai:'v22_key_openai',
  claude:'v22_key_claude',
  openaiBase:'v22_openai_base',
  claudeBase:'v22_claude_base',
  modelGemini:'v22_model_gemini',
  modelOpenAI:'v22_model_openai',
  modelClaude:'v22_model_claude'
};


function renderRuntimeModels(models){
  const sel = document.getElementById('runtimeModel');
  if(!sel) return;
  sel.innerHTML = '';
  if(!models || !models.length){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'aucun modèle validé';
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }
  for(const m of models){
    const opt = document.createElement('option');
    opt.value = m.id || m;
    opt.textContent = m.label || m.id || m;
    sel.appendChild(opt);
  }
  sel.disabled = false;
  // select first by default if empty
  if(!sel.value) sel.value = (models[0].id || models[0]);
}
// ----- Model detection (via server /api/models) -----
const DETECTED_KEY = 'lop_ai_detected_models_v1'; // localStorage JSON

function loadDetectedModels(){
  try{ return JSON.parse(localStorage.getItem(DETECTED_KEY) || '{}') || {}; }catch{ return {}; }
}
function saveDetectedModels(obj){
  localStorage.setItem(DETECTED_KEY, JSON.stringify(obj||{}));
}
function getKeyOverride(provider){
  // clés uniquement via Vercel env (aucune clé dans l'app)
  return '';
}
function setKeyOverride(provider, val){
  const v=(val||'').trim();
  if(provider==='gemini') localStorage.setItem('lop_api_gemini_key', v);
  if(provider==='openai') localStorage.setItem('lop_api_openai_key', v);
  if(provider==='claude') localStorage.setItem('lop_api_anthropic_key', v);
}
function getSelectedModel(provider){
  // priorité: select runtime (dans l'onglet générateur)
  const runtime = document.getElementById('runtimeModel');
  if(runtime && runtime.value) return runtime.value;

  if(provider==='gemini') return ($('modelGemini')?.value || 'gemini-1.5-flash').trim();
  if(provider==='openai') return ($('modelOpenAI')?.value || 'gpt-4o-mini').trim();
  if(provider==='claude') return ($('modelClaude')?.value || 'claude-3-5-haiku-latest').trim();
  return '';
}
async function detectModels(provider, keyOverride){
  const res = await fetch('/api/models', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({provider})
  });
  const js = await res.json().catch(()=>({}));
  if(!res.ok || !js.ok) throw new Error(js.error || ('erreur models '+res.status));
  return js.models || [];
}

function loadSettingsToUI(){
  const provider = localStorage.getItem(LS_KEYS.provider) || 'gemini';
  $('providerGemini').checked = provider==='gemini';
  $('providerOpenAI').checked = provider==='openai';
  $('providerClaude').checked = provider==='claude';

  $('keyGemini').value = localStorage.getItem(LS_KEYS.gemini) || '';
  $('keyOpenAI').value = localStorage.getItem(LS_KEYS.openai) || '';
  $('keyClaude').value = localStorage.getItem(LS_KEYS.claude) || '';

  $('openaiBase').value = localStorage.getItem(LS_KEYS.openaiBase) || 'https://api.openai.com/v1/responses';
  $('claudeBase').value = localStorage.getItem(LS_KEYS.claudeBase) || 'https://api.anthropic.com/v1/messages';

  $('modelGemini').value = localStorage.getItem(LS_KEYS.modelGemini) || 'gemini-1.5-pro';
  $('modelOpenAI').value = localStorage.getItem(LS_KEYS.modelOpenAI) || 'gpt-4.1-mini';
  $('modelClaude').value = localStorage.getItem(LS_KEYS.modelClaude) || 'claude-3-5-sonnet-latest';
}

function saveSettingsFromUI(){
  const provider = $('providerGemini').checked ? 'gemini' : ($('providerOpenAI').checked ? 'openai' : 'claude');
  localStorage.setItem(LS_KEYS.provider, provider);

  localStorage.setItem(LS_KEYS.gemini, ($('keyGemini').value||'').trim());
  localStorage.setItem(LS_KEYS.openai, ($('keyOpenAI').value||'').trim());
  localStorage.setItem(LS_KEYS.claude, ($('keyClaude').value||'').trim());

  localStorage.setItem(LS_KEYS.openaiBase, ($('openaiBase').value||'').trim());
  localStorage.setItem(LS_KEYS.claudeBase, ($('claudeBase').value||'').trim());

  localStorage.setItem(LS_KEYS.modelGemini, ($('modelGemini').value||'').trim());
  localStorage.setItem(LS_KEYS.modelOpenAI, ($('modelOpenAI').value||'').trim());
  localStorage.setItem(LS_KEYS.modelClaude, ($('modelClaude').value||'').trim());

  toast('✅ paramètres sauvegardés', 'success');
}

function getActiveProvider(){
  return localStorage.getItem(LS_KEYS.provider) || 'gemini';
}
function getActiveKey(){
  const p = getActiveProvider();
  if(p==='gemini') return (localStorage.getItem(LS_KEYS.gemini)||'').trim();
  if(p==='openai') return (localStorage.getItem(LS_KEYS.openai)||'').trim();
  return (localStorage.getItem(LS_KEYS.claude)||'').trim();
}

// ---------- LLM calls ----------
async function callGemini(key, model, prompt){
  // Uses Google Generative Language API (public endpoint)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{temperature:0.9, maxOutputTokens:2048}
    })
  });
  const js = await res.json().catch(()=>({}));
  if(!res.ok){
    const msg = js?.error?.message || res.statusText || 'gemini error';
    throw new Error(`gemini: ${msg}`);
  }
  return js?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callOpenAI(key, baseUrl, model, prompt){
  // OpenAI Responses API (browser calls may fail on CORS depending on environment)
  const res = await fetch(baseUrl, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.9,
      max_output_tokens: 2200
    })
  });
  const js = await res.json().catch(()=>({}));
  if(!res.ok){
    const msg = js?.error?.message || res.statusText || 'openai error';
    throw new Error(`openai: ${msg}`);
  }
  // Responses API can return different shapes; try a few
  return js?.output_text || js?.output?.[0]?.content?.[0]?.text || js?.choices?.[0]?.message?.content || '';
}

async function callClaude(key, baseUrl, model, prompt){
  // Anthropic Messages API (browser calls may fail on CORS depending on environment)
  const res = await fetch(baseUrl, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key': key,
      'anthropic-version':'2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2200,
      temperature: 0.9,
      messages: [{role:'user', content: prompt}]
    })
  });
  const js = await res.json().catch(()=>({}));
  if(!res.ok){
    const msg = js?.error?.message || res.statusText || 'claude error';
    throw new Error(`claude: ${msg}`);
  }
  // Messages API returns content array with text blocks
  if(Array.isArray(js?.content)){
    const txt = js.content.map(x => x?.text || '').join('\n').trim();
    return txt;
  }
  return js?.completion || '';
}


async function callLLM(prompt){
  const provider = getActiveProvider();
  const model = getSelectedModel(provider);
  const payload = { provider, model, prompt };
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const js = await res.json().catch(()=>({}));
  if(!res.ok || !js.ok){
    throw new Error(js.error || ('erreur api '+res.status));
  }
  return js.text || '';
}


// ---------- Explain panels ----------
function renderExplain(kind, id){
  const box = $('explainBox');
  const title = $('explainTitle');
  const body = $('explainBody');
  const list = $('explainList');

  let item = null;
  let headline = '';
  let desc = '';
  let bullets = [];

  if(kind==='structure'){
    item = STRUCTURES.find(x=>x.id===id);
    headline = item?.label || '';
    desc = `objectif: ${item?.notes?.[0] || ''}\nusage: ${(item?.useWhen||[]).join(', ')}`;
    bullets = [
      `groupe: ${item?.group || '-'}`,
      `bars: ${Object.entries(item?.bars||{}).map(([k,v])=>`${k}:${v}`).join(' | ') || '—'}`,
      ...(item?.notes||[]).map(x=>`note: ${x}`)
    ];
  } else if(kind==='intensity'){
    item = EMOTIONAL_INTENSITIES.find(x=>x.id===id);
    headline = item?.label || '';
    desc = item?.description || '';
    bullets = [
      `groupe: ${item?.group || '-'}`,
      `énergie: ${item?.energy ?? '-'}/10`,
      ...(item?.cues||[]).map(x=>`cues: ${x}`)
    ];
  } else if(kind==='style'){
    item = WRITING_STYLES.find(x=>x.id===id);
    headline = item?.label || '';
    desc = item?.description || '';
    bullets = [
      `groupe: ${item?.group || '-'}`,
      ...(item?.rules||[]).map(x=>`règle: ${x}`)
    ];
  } else if(kind==='accent'){
    item = ACCENTS_REGIONS.find(x=>x.id===id);
    headline = item?.label || '';
    desc = item?.description || '';
    bullets = [
      `groupe: ${item?.group || '-'}`,
      ...(item?.examples||[]).map(x=>`ex: ${x}`)
    ];
  } else if(kind==='genre'){
    item = MUSIC_GENRES.find(x=>x.id===id);
    headline = item?.label || '';
    desc = item?.description || '';
    bullets = [
      `groupe: ${item?.group || '-'}`,
      'influence: groove, espace, type de hook, tempo implicite'
    ];
  }

  title.textContent = headline || 'détail';
  body.textContent = desc || '';
  list.innerHTML = bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join('');
  box.classList.remove('hidden');
}

function hideExplain(){
  $('explainBox').classList.add('hidden');
}

// ---------- Populate selects ----------
function fillSelect(selectEl, items, placeholder){
  selectEl.innerHTML = '';
  if(placeholder){
    const op = document.createElement('option');
    op.value = '';
    op.textContent = placeholder;
    selectEl.appendChild(op);
  }
  for(const it of items){
    const op = document.createElement('option');
    op.value = it.id;
    op.textContent = it.label;
    selectEl.appendChild(op);
  }
}

// ---------- Tabs ----------
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.toggle('active', c.id===name));
  if(name==='library') refreshLibrary();
  if(name==='stats') refreshStats();
}

// ---------- Prompt engineering ----------
function getSelectionBundle(){
  const theme = ($('theme').value||'').trim();
  const structureId = $('structure').value;
  const intensityId = $('intensity').value;
  const styleId = $('writingStyle').value;
  const accentId = $('accent').value;
  const genreId = $('genre').value;

  const structure = STRUCTURES.find(x=>x.id===structureId);
  const intensity = EMOTIONAL_INTENSITIES.find(x=>x.id===intensityId);
  const wstyle = WRITING_STYLES.find(x=>x.id===styleId);
  const accent = ACCENTS_REGIONS.find(x=>x.id===accentId);
  const genre = MUSIC_GENRES.find(x=>x.id===genreId);

  return { theme, structureId, intensityId, styleId, accentId, genreId, structure, intensity, wstyle, accent, genre };
}

function buildStrategyPrompt(bundle){
  const { theme, structure, intensity, wstyle, accent, genre } = bundle;

  const structureBars = structure?.bars ? Object.entries(structure.bars).map(([k,v])=>`${k}:${v}`).join(', ') : '';
  const intensityHints = intensity?.cues?.join(', ') || '';
  const styleRules = (wstyle?.rules||[]).join(' | ');
  const accentHints = (accent?.examples||[]).join(' | ');

  return `tu es un assistant d'écriture musicale. ta mission: produire une stratégie JSON détaillée avant d'écrire.

contraintes globales:
- texte en français, accent/région: ${accent?.label || '—'}
- style d'écriture: ${wstyle?.label || '—'}
- genre musical visé: ${genre?.label || '—'}
- intensité émotionnelle: ${intensity?.label || '—'}
- structure: ${structure?.label || '—'} (bars: ${structureBars || '—'})

règles de cohérence:
- la stratégie doit traduire EXACTEMENT les choix ci-dessus
- pas de remplissage, chaque section a un objectif clair
- pas d'allusions au fait de "rapper derrière le micro"
- rester crédible dans le style choisi

thème demandé:
${theme}

guides rapides:
- intensité cues: ${intensityHints || '—'}
- règles du style: ${styleRules || '—'}
- exemples de tournures: ${accentHints || '—'}

réponds uniquement en JSON strict, sans backticks, sans texte autour.
format:
{
  "titre": "titre court",
  "logline": "1 phrase qui résume le morceau",
  "pov": "je/tu/il + justification",
  "mots_cles": ["7 à 12 mots clés"],
  "lexique": {
    "expressions_a_favoriser": ["5-10"],
    "expressions_a_eviter": ["5-10"]
  },
  "arc_emotionnel": "début -> milieu -> fin",
  "structure": {
    "id": "${structure?.id || ''}",
    "plan": [
      {"section":"intro","objectif":"...","couleur":"...","bar_count": ${structure?.bars?.intro ?? 0}},
      {"section":"verse1","objectif":"...","couleur":"...","bar_count": ${structure?.bars?.verse1 ?? 0}},
      {"section":"hook","objectif":"...","couleur":"...","bar_count": ${structure?.bars?.hook ?? 0}},
      {"section":"verse2","objectif":"...","couleur":"...","bar_count": ${structure?.bars?.verse2 ?? 0}},
      {"section":"verse3","objectif":"...","couleur":"...","bar_count": ${structure?.bars?.verse3 ?? 0}},
      {"section":"bridge","objectif":"...","couleur":"...","bar_count": ${structure?.bars?.bridge ?? 0}},
      {"section":"outro","objectif":"...","couleur":"...","bar_count": ${structure?.bars?.outro ?? 0}}
    ]
  },
  "directives_ecriture": {
    "densite_rimes": "faible/moyenne/forte",
    "longueur_lignes": "courtes/moyennes/longues",
    "rythme": "lent/mid/rapide",
    "interdits": ["jurons extrêmes", "racisme", "réseaux sociaux", "parents"]
  },
  "tags": {
    "accent_region": "${accent?.id || ''}",
    "writing_style": "${wstyle?.id || ''}",
    "genre": "${genre?.id || ''}",
    "intensity": "${intensity?.id || ''}"
  }
}`;
}

function buildLyricsPrompt(bundle, strategy){
  const { wstyle, accent, genre, intensity, structure } = bundle;
  const plan = strategy?.structure?.plan || [];

  // We'll request explicit section tags to match the plan and keep it easy to parse/edit.
  return `tu es un auteur de rap. écris des paroles complètes en respectant la stratégie ci-dessous.

STRATÉGIE JSON:
${JSON.stringify(strategy, null, 2)}

contraintes de rendu:
- langue: français
- accent/région: ${accent?.label || '—'} (écriture adaptée, pas caricature)
- style d'écriture: ${wstyle?.label || '—'}
- genre musical: ${genre?.label || '—'}
- intensité émotionnelle: ${intensity?.label || '—'}
- structure: ${structure?.label || '—'}

règles importantes:
- chaque section suit le plan (objectif + couleur + bar_count). respecte les bar_count en lignes multiples de 4 quand possible.
- chaque ligne doit avoir du sens, pas de remplissage.
- pas de référence aux parents, pas de références aux réseaux sociaux, pas de référence à la couleur de peau.
- éviter le ton "français de france" si accent québec, et inversement.
- ne mentionne jamais "je rappe" ou "derrière le micro".

format de sortie (obligatoire):
- commence par: titre: "..."
- ensuite sections avec balises entre crochets, ex:
[intro]
...
[verse 1]
...
[hook]
...
[verse 2]
...
[verse 3]
...
[outro]
...

écris maintenant.`;
}

function buildSunoStylePrompt(bundle, lyrics){
  const { wstyle, accent, genre, intensity } = bundle;

  return `tu es un directeur musical. crée un "style suno" sur mesure basé sur les choix et les paroles.

choix:
- accent/région: ${accent?.label || '—'}
- style d'écriture: ${wstyle?.label || '—'}
- genre musical: ${genre?.label || '—'}
- intensité émotionnelle: ${intensity?.label || '—'}

paroles:
${lyrics}

règles:
- retourne un seul paragraphe (pas de puces)
- pas de points, utilise uniquement des virgules
- aucune majuscule sauf le mot Québec si présent
- inclure bpm plausible, une tonalité (ex: key g minor), texture de mix, instruments, sound design, vibe
- mentionner "male vocals" et préciser rap 100% rappé, pas de chant
- ne dépasse jamais 1000 caractères espaces inclus
- ne mentionne pas d'artistes connus

retourne uniquement le style suno.`;
}

// ---------- Generation ----------
function setLoading(on){
  $('generateBtn').disabled = on;
  $('loadingState').classList.toggle('hidden', !on);
}

function setPass(step){
  const p1 = $('pass1'); const p2 = $('pass2'); const p3 = $('pass3');
  [p1,p2,p3].forEach(x=>{ x.classList.remove('active'); x.classList.remove('completed'); });
  if(step>=1) p1.classList.add('active');
  if(step>=2){ p1.classList.add('completed'); p2.classList.add('active'); }
  if(step>=3){ p2.classList.add('completed'); p3.classList.add('active'); }
}

async function generateAll(){
  hideExplain();

  const bundle = getSelectionBundle();
  if(!bundle.theme){
    toast('💭 entre un thème', 'error'); return;
  }
  if(!bundle.structureId || !bundle.intensityId || !bundle.styleId || !bundle.accentId || !bundle.genreId){
    toast('⚠️ choisis structure, intensité, style, accent et genre', 'error'); return;
  }

  const showStrategy = $('showStrategy').checked;
  $('output').textContent = '';
  $('strategyBox').classList.add('hidden');
  $('sunoBox').classList.add('hidden');
  $('outputActions').classList.add('hidden');

  setLoading(true);

  try{
    setPass(1);

    const strategyPrompt = buildStrategyPrompt(bundle);
    const raw = await callLLM(strategyPrompt);

    let strategy = null;
    try{
      strategy = JSON.parse(raw.trim());
    }catch(e){
      // Try to salvage if model wraps JSON in code fences
      const cleaned = raw.replace(/```json|```/g,'').trim();
      strategy = JSON.parse(cleaned);
    }

    state.currentStrategy = strategy;
    state.currentTitle = strategy?.titre || '';
    state.lastPromptBundle = bundle;

    if(showStrategy){
      $('strategyContent').textContent = JSON.stringify(strategy, null, 2);
      $('strategyBox').classList.remove('hidden');
    }

    await sleep(250);
    setPass(2);

    const lyricsPrompt = buildLyricsPrompt(bundle, strategy);
    const lyrics = await callLLM(lyricsPrompt);

    state.currentOutput = lyrics.trim();
    $('output').textContent = state.currentOutput;

    await sleep(250);
    setPass(3);

    const stylePrompt = buildSunoStylePrompt(bundle, state.currentOutput);
    const suno = await callLLM(stylePrompt);
    state.currentSunoStyle = clampStr(suno.replace(/\./g,','), 1000); // enforce no dots, length
    $('sunoContent').textContent = state.currentSunoStyle;
    $('sunoBox').classList.remove('hidden');

    $('outputActions').classList.remove('hidden');
    toast('🔥 génération terminée (v2.2)', 'success');

    await trackStats(bundle, state.currentOutput);

  }catch(err){
    console.error(err);
    $('output').textContent = `erreur: ${err.message || err}`;
    toast(`❌ ${err.message || err}`, 'error');
  }finally{
    setLoading(false);
    // finalize pass UI
    $('pass1').classList.add('completed');
    $('pass2').classList.add('completed');
    $('pass3').classList.add('completed');
    setTimeout(()=>{
      ['pass1','pass2','pass3'].forEach(id=>$(id).classList.remove('active'));
    }, 1200);
  }
}

// ---------- Actions ----------
function copyText(t, okMsg){
  navigator.clipboard.writeText(t||'');
  toast(okMsg,'success');
}

async function saveCurrent(){
  if(!state.currentOutput) return;

  const bundle = state.lastPromptBundle || getSelectionBundle();
  const item = {
    title: state.currentTitle || 'sans titre',
    theme: bundle.theme || '',
    lyrics: state.currentOutput,
    sunoStyle: state.currentSunoStyle,
    strategy: state.currentStrategy,
    meta:{
      structure: bundle.structureId,
      intensity: bundle.intensityId,
      writingStyle: bundle.styleId,
      accent: bundle.accentId,
      genre: bundle.genreId
    },
    date: nowIso(),
    favorite: false,
    words: countWords(state.currentOutput || '')
  };

  try{
    const id = await dbAddLyric(item);
    toast('💾 sauvegardé', 'success');
    await refreshLibrary();
    await refreshStats();
    downloadTxt(item, id);
  }catch(e){
    toast('❌ erreur sauvegarde','error');
  }
}

function downloadTxt(item, id){
  const content =
`title: ${item.title}

theme:
${item.theme}

lyrics:
${item.lyrics}

suno style:
${item.sunoStyle}

meta:
${JSON.stringify(item.meta, null, 2)}
`;
  const blob = new Blob([content], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `oppresseur_v22_${id}_${(item.title||'sans_titre').replace(/[^\w\-]+/g,'_').slice(0,40)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function loadToEditor(){
  if(!state.currentOutput) return;
  $('editorTitle').value = state.currentTitle || '';
  $('editorLyrics').value = state.currentOutput || '';
  $('editorSuno').value = state.currentSunoStyle || '';
  state.editorItemId = null;
  switchTab('editor');
  toast('✏️ chargé dans l’éditeur','success');
}

async function saveFromEditor(mode){
  const title = ($('editorTitle').value||'').trim() || 'sans titre';
  const lyrics = ($('editorLyrics').value||'').trim();
  const sunoStyle = clampStr(($('editorSuno').value||'').trim().replace(/\./g,','), 1000);
  if(!lyrics){ toast('⚠️ paroles vides','error'); return; }

  if(mode==='update' && state.editorItemId){
    await dbUpdateLyric(state.editorItemId, { title, lyrics, sunoStyle });
    toast('✅ mise à jour','success');
  }else{
    await dbAddLyric({
      title, theme:'',
      lyrics, sunoStyle,
      strategy:null,
      meta:{},
      date: nowIso(),
      favorite:false,
      words: countWords(lyrics)
    });
    toast('✅ nouvelle version','success');
  }
  await refreshLibrary();
  await refreshStats();
  switchTab('library');
}

function addToCompare(slot){
  if(!state.currentOutput){ toast('⚠️ rien à comparer','info'); return; }
  state.compare[slot] = { title: state.currentTitle, lyrics: state.currentOutput, sunoStyle: state.currentSunoStyle };
  $(slot==='A' ? 'compareA' : 'compareB').textContent = state.currentOutput;
  toast(`🔄 ajouté en ${slot}`, 'success');
}

function clearCompare(){
  state.compare = {A:null,B:null};
  $('compareA').textContent = 'charge une version A';
  $('compareB').textContent = 'charge une version B';
  toast('🗑️ comparaison effacée','info');
}

// ---------- Library ----------
async function refreshLibrary(){
  const list = $('libraryList');
  const items = await dbGetAllLyrics();
  items.sort((a,b)=> (b.date||'').localeCompare(a.date||''));

  const q = ($('librarySearch').value||'').trim().toLowerCase();
  const filterFav = $('filterFav').checked;

  const filtered = items.filter(it=>{
    if(filterFav && !it.favorite) return false;
    if(!q) return true;
    return (it.title||'').toLowerCase().includes(q) || (it.theme||'').toLowerCase().includes(q) || (it.lyrics||'').toLowerCase().includes(q);
  });

  if(filtered.length===0){
    list.innerHTML = `<div class="text-muted" style="padding:40px 0;text-align:center;">aucune création</div>`;
    return;
  }

  list.innerHTML = filtered.map(it=>{
    const dt = (it.date||'').slice(0,10);
    const preview = (it.lyrics||'').slice(0,180).replace(/\s+/g,' ').trim();
    return `
    <div class="library-item">
      <div class="library-header">
        <div class="library-title">${escapeHtml(it.title||'sans titre')}</div>
        <button class="star-btn ${it.favorite?'favorited':''}" data-id="${it.id}" title="favori">★</button>
      </div>
      <div class="library-meta">
        <span>📅 ${escapeHtml(dt)}</span>
        <span>📝 ${it.words||0} mots</span>
      </div>
      <div class="library-preview">${escapeHtml(preview)}...</div>
      <div class="library-actions">
        <button class="btn btn-secondary library-btn" data-act="load" data-id="${it.id}">charger</button>
        <button class="btn btn-secondary library-btn" data-act="edit" data-id="${it.id}">éditer</button>
        <button class="btn btn-secondary library-btn" data-act="copy" data-id="${it.id}">copier</button>
        <button class="btn btn-secondary library-btn" data-act="delete" data-id="${it.id}">supprimer</button>
      </div>
    </div>`;
  }).join('');

  // bind
  list.querySelectorAll('.star-btn').forEach(btn=>{
    btn.onclick = async ()=>{
      const id = Number(btn.dataset.id);
      const items2 = await dbGetAllLyrics();
      const item = items2.find(x=>x.id===id);
      if(!item) return;
      await dbUpdateLyric(id, {favorite: !item.favorite});
      await refreshLibrary();
      await refreshStats();
    };
  });
  list.querySelectorAll('button[data-act]').forEach(btn=>{
    btn.onclick = async ()=>{
      const act = btn.dataset.act;
      const id = Number(btn.dataset.id);
      const items2 = await dbGetAllLyrics();
      const item = items2.find(x=>x.id===id);
      if(!item) return;

      if(act==='load'){
        state.currentTitle = item.title || '';
        state.currentOutput = item.lyrics || '';
        state.currentSunoStyle = item.sunoStyle || '';
        $('output').textContent = state.currentOutput;
        $('sunoContent').textContent = state.currentSunoStyle;
        $('sunoBox').classList.toggle('hidden', !state.currentSunoStyle);
        $('outputActions').classList.remove('hidden');
        switchTab('generator');
        toast('📥 chargé','success');
      }
      if(act==='edit'){
        state.editorItemId = item.id;
        $('editorTitle').value = item.title || '';
        $('editorLyrics').value = item.lyrics || '';
        $('editorSuno').value = item.sunoStyle || '';
        switchTab('editor');
      }
      if(act==='copy'){
        copyText(item.lyrics || '', '📋 copié');
      }
      if(act==='delete'){
        if(confirm('supprimer cette création ?')){
          await dbDeleteLyric(id);
          await refreshLibrary();
          await refreshStats();
          toast('🗑️ supprimé','info');
        }
      }
    };
  });
}

// ---------- Stats ----------
async function trackStats(bundle, lyrics){
  const stat = JSON.parse(localStorage.getItem('v22_stats')||'{}');
  stat.total = (stat.total||0) + 1;
  stat.words = (stat.words||0) + countWords(lyrics||'');
  stat.lastDate = (new Date()).toISOString().slice(0,10);

  const usage = stat.usage || {structure:{}, intensity:{}, genre:{}, style:{}, accent:{}};
  usage.structure[bundle.structureId] = (usage.structure[bundle.structureId]||0)+1;
  usage.intensity[bundle.intensityId] = (usage.intensity[bundle.intensityId]||0)+1;
  usage.genre[bundle.genreId] = (usage.genre[bundle.genreId]||0)+1;
  usage.style[bundle.styleId] = (usage.style[bundle.styleId]||0)+1;
  usage.accent[bundle.accentId] = (usage.accent[bundle.accentId]||0)+1;
  stat.usage = usage;

  localStorage.setItem('v22_stats', JSON.stringify(stat));
  await refreshStats();
}

function topKey(map){
  let best = null; let bestV = -1;
  for(const [k,v] of Object.entries(map||{})){
    if(v>bestV){ bestV=v; best=k; }
  }
  return best;
}

async function refreshStats(){
  const stat = JSON.parse(localStorage.getItem('v22_stats')||'{}');
  $('statTotal').textContent = String(stat.total||0);
  $('statWords').textContent = String(stat.words||0);

  const usage = stat.usage || {structure:{}, intensity:{}, genre:{}, style:{}, accent:{}};
  const s = topKey(usage.structure);
  const i = topKey(usage.intensity);
  const g = topKey(usage.genre);
  $('statTopStructure').textContent = STRUCTURES.find(x=>x.id===s)?.label?.slice(0,18) || '—';
  $('statTopIntensity').textContent = EMOTIONAL_INTENSITIES.find(x=>x.id===i)?.label || '—';
  $('statTopGenre').textContent = MUSIC_GENRES.find(x=>x.id===g)?.label || '—';
}

// ---------- Templates ----------
function loadTemplates(){
  const grid = $('templatesGrid');
  const all = DEFAULT_TEMPLATES;
  grid.innerHTML = all.flatMap(cat => cat.templates.map(t => `
    <div class="template-card" data-title="${escapeHtml(t.title)}" data-desc="${escapeHtml(t.desc)}">
      <div class="template-category">${escapeHtml(cat.category)}</div>
      <div class="template-title">${escapeHtml(t.title)}</div>
      <div class="template-desc">${escapeHtml(t.desc)}</div>
      <div class="template-badge">click to use</div>
    </div>
  `)).join('');

  grid.querySelectorAll('.template-card').forEach(card=>{
    card.onclick = ()=>{
      $('theme').value = `${card.dataset.title} — ${card.dataset.desc}`;
      switchTab('generator');
      toast('✨ template appliqué','success');
    };
  });
}

// ---------- Diagnostics / API tests ----------
async function testProvider(provider){
  saveSettingsFromUI();
  localStorage.setItem(LS_KEYS.provider, provider);

  const status = $('apiStatus');
  status.innerHTML = `<div class="status info">test en cours...</div>`;
  try{
    const txt = await callLLM('réponds uniquement: ok');
    if((txt||'').toLowerCase().includes('ok')){
      status.innerHTML = `<div class="status success">✅ ${provider}: ok</div>`;
    }else{
      status.innerHTML = `<div class="status success">✅ ${provider}: réponse reçue</div>`;
    }
  }catch(e){
    status.innerHTML = `<div class="status error">❌ ${provider}: ${escapeHtml(e.message||String(e))}</div>`;
  }
}

// ---------- Keyboard shortcuts ----------
function initShortcuts(){
  document.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key==='Enter'){
      e.preventDefault(); generateAll();
    }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){
      e.preventDefault();
      if(e.shiftKey) loadToEditor();
      else saveCurrent();
    }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='g'){ e.preventDefault(); switchTab('generator'); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='h'){ e.preventDefault(); switchTab('library'); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='e'){ e.preventDefault(); switchTab('editor'); }
  });
}

// ---------- Init ----------
function initUI(){
  $('appVersion').textContent = APP_VERSION;

  // Fill selects with maximum choice
  fillSelect($('structure'), STRUCTURES, 'choisir une structure…');
  fillSelect($('intensity'), EMOTIONAL_INTENSITIES, 'choisir une intensité…');
  fillSelect($('writingStyle'), WRITING_STYLES, 'choisir un style d’écriture…');
  fillSelect($('accent'), ACCENTS_REGIONS, 'choisir un accent / région…');
  fillSelect($('genre'), MUSIC_GENRES, 'choisir un genre musical…');

  // defaults
  $('structure').value = 'classic_3v_hook';
  $('intensity').value = 'balanced';
  $('writingStyle').value = 'oppresseur_qc_conscious';
  $('accent').value = 'qc_mtl_street';
  $('genre').value = 'cinematic_rap';

  // Explain bindings
  $('btnExplainStructure').onclick = ()=>renderExplain('structure', $('structure').value);
  $('btnExplainIntensity').onclick = ()=>renderExplain('intensity', $('intensity').value);
  $('btnExplainStyle').onclick = ()=>renderExplain('style', $('writingStyle').value);
  $('btnExplainAccent').onclick = ()=>renderExplain('accent', $('accent').value);
  $('btnExplainGenre').onclick = ()=>renderExplain('genre', $('genre').value);
  $('btnExplainClose').onclick = hideExplain;

  // Tabs
  document.querySelectorAll('.tab').forEach(t=>{
    t.onclick = ()=>switchTab(t.dataset.tab);
  });

  // Buttons
  $('generateBtn').onclick = generateAll;
  $('btnCopyLyrics').onclick = ()=>copyText(state.currentOutput, '📋 paroles copiées');
  $('btnCopySuno').onclick = ()=>copyText(state.currentSunoStyle, '🎵 style suno copié');
  $('btnSave').onclick = saveCurrent;
  $('btnToEditor').onclick = loadToEditor;

  $('btnAddA').onclick = ()=>addToCompare('A');
  $('btnAddB').onclick = ()=>addToCompare('B');
  $('btnClearCompare').onclick = clearCompare;

  $('librarySearch').oninput = refreshLibrary;
  $('filterFav').onchange = refreshLibrary;

  $('editorSaveUpdate').onclick = ()=>saveFromEditor('update');
  $('editorSaveNew').onclick = ()=>saveFromEditor('new');

  // Settings modal
  $('openSettings').onclick = ()=>{$('settingsModal').classList.add('active'); loadSettingsToUI(); $('apiStatus').innerHTML='';};
  $('closeSettings').onclick = ()=>{$('settingsModal').classList.remove('active');};
  $('saveSettings').onclick = saveSettingsFromUI;

  $('testGemini').onclick = ()=>testProvider('gemini');
  $('testOpenAI').onclick = ()=>testProvider('openai');
  $('testClaude').onclick = ()=>testProvider('claude');

  // Version label
  $('versionBadge').textContent = APP_VERSION;
}

// Main
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    await initDB();
    initUI();
    initApiTab();
    initShortcuts();
    loadTemplates();
    await refreshLibrary();
    await refreshStats();
    toast(`🔥 chargé ${APP_VERSION}`, 'success');
  }catch(e){
    console.error(e);
    toast('❌ erreur init', 'error');
  }
});


function initApiTab(){
  const elGem = document.getElementById('api_gemini_key');
  const elOai = document.getElementById('api_openai_key');
  const elAnt = document.getElementById('api_anthropic_key');
  if(elGem) elGem.value = getKeyOverride('gemini');
  if(elOai) elOai.value = getKeyOverride('openai');
  if(elAnt) elAnt.value = getKeyOverride('claude');

  const dump = document.getElementById('modelsDump');
  const setDump = (obj)=>{ if(dump) dump.textContent = JSON.stringify(obj,null,2); };

  const statusGem = document.getElementById('api_gemini_status');
  const statusOai = document.getElementById('api_openai_status');
  const statusAnt = document.getElementById('api_anthropic_status');

  async function doTest(provider){
    const key = provider==='gemini' ? (elGem?.value||'') : provider==='openai' ? (elOai?.value||'') : (elAnt?.value||'');
    setKeyOverride(provider, key);
    const statusEl = provider==='gemini' ? statusGem : provider==='openai' ? statusOai : statusAnt;
    if(statusEl) statusEl.textContent = 'test en cours...';
    try{
      const models = await detectModels(provider, key);
      const all = loadDetectedModels();
      all[provider] = models;
      saveDetectedModels(all);
      if(statusEl) statusEl.textContent = `ok: ${models.length} modèle(s) détecté(s)`;
      setDump(all);
      // refresh generator model dropdown if present
      try{ refreshProviderModelsUI(); }catch{}
    }catch(err){
      if(statusEl) statusEl.textContent = 'erreur: '+(err?.message||err);
    }
  }

  document.getElementById('btnTestGemini')?.addEventListener('click', ()=>doTest('gemini'));
  document.getElementById('btnTestOpenAI')?.addEventListener('click', ()=>doTest('openai'));
  document.getElementById('btnTestClaude')?.addEventListener('click', ()=>doTest('claude'));

  // initial dump from storage
  setDump(loadDetectedModels());
}

function refreshProviderModelsUI(){
  // update model dropdown lists using detected models (if any)
  const provider = getActiveProvider();
  const detected = loadDetectedModels();
  const list = detected[provider] || [];
  if(!Array.isArray(list) || list.length===0) return;
  // try update existing custom dropdown option list if IDs exist
  const mapId = { gemini:'modelGemini', openai:'modelOpenAI', claude:'modelClaude' };
  const id = mapId[provider];
  const dd = document.getElementById(id);
  // dd peut ne pas exister (input texte). On met quand même à jour le select runtime.
  if(!dd){ renderRuntimeModels(list); return; }
  // if your UI uses a select element:
  if(dd.tagName==='SELECT'){
    dd.innerHTML = '';
    list.forEach(m=>{
      const opt = document.createElement('option');
      opt.value = m.id || m;
      opt.textContent = m.label || m.id || m;
      dd.appendChild(opt);
    });
  }
}
  // runtime select in generator
  renderRuntimeModels(list);
}

