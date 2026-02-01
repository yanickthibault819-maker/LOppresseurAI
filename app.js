
/* L'OppresseurAI Full — Vanilla JS
   - IndexedDB library (illimitée)
   - Templates 30+
   - Editor
   - Comparison
   - Stats + Achievements
   - 3 themes
   - 2-pass generation (strategy -> writing)
*/

const $ = (id) => document.getElementById(id);

const DB_NAME = "oppresseurai_db";
const DB_VERSION = 1;
const STORE = "lyrics";

let db = null;
let selectedId = null;
let editorId = null;
let compareA = null;
let compareB = null;

const ACH = [
  { id:"first_save", name:"premier dépôt", desc:"sauver 1 texte dans la bibliothèque", rule:(s)=>s.total>=1 },
  { id:"ten_saves", name:"bibliothèque 10", desc:"sauver 10 textes", rule:(s)=>s.total>=10 },
  { id:"fifty_saves", name:"bibliothèque 50", desc:"sauver 50 textes", rule:(s)=>s.total>=50 },
  { id:"first_project", name:"session studio", desc:"sauver 1 texte avec un projet", rule:(s)=>s.projects>=1 },
  { id:"five_projects", name:"multi-projets", desc:"avoir 5 projets distincts", rule:(s)=>s.projects>=5 },
  { id:"first_compare", name:"duel de versions", desc:"remplir A et B en comparaison", rule:(s)=>s.hasCompare },
  { id:"exporter", name:"exporteur", desc:"faire 1 export depuis l'app", rule:(s)=>s.exports>=1 },
  { id:"freestyle", name:"freestyle", desc:"générer 3 fois en mode freestyle", rule:(s)=>s.freestyle>=3 },
  { id:"editor", name:"tailleur", desc:"sauver 3 fois via l'éditeur", rule:(s)=>s.editorSaves>=3 },
  { id:"streak", name:"régulier", desc:"utiliser l'app 3 jours distincts", rule:(s)=>s.days>=3 },
];

const STATE_KEY = "opp_state_v2_1";
function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
  }catch{ return {}; }
}
function saveState(patch){
  const s = loadState();
  const next = { ...s, ...patch };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
}

function toast(msg){
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>el.classList.remove("show"), 1400);
}

function setKeyStatus(text, ok=false){
  const el = $("keyStatus");
  el.textContent = text;
  el.style.color = ok ? "var(--ok)" : "";
}

function nowISO(){
  return new Date().toISOString();
}

function wordCount(t){
  const s = (t||"").trim();
  if(!s) return 0;
  return s.split(/\s+/).length;
}

function normalizeModelName(n){
  // API returns name without "models/" already, but keep safe:
  return (n||"").replace(/^models\//,"");
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  saveState({ theme });
}

function tabTo(panelKey){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("is-active", b.dataset.tab===panelKey));
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("is-active"));
  const panel = $("panel-"+panelKey);
  if(panel) panel.classList.add("is-active");

  // refresh panels that need data
  if(panelKey==="lib") refreshLibrary();
  if(panelKey==="stats") refreshStats();
  if(panelKey==="tpl") renderTemplates();
}

function setupTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>tabTo(btn.dataset.tab));
  });
}

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const d = e.target.result;
      const store = d.createObjectStore(STORE, { keyPath:"id" });
      store.createIndex("createdAt", "createdAt");
      store.createIndex("project", "project");
      store.createIndex("title", "title");
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

function tx(mode="readonly"){
  return db.transaction(STORE, mode).objectStore(STORE);
}

function dbAdd(item){
  return new Promise((resolve, reject)=>{
    const r = tx("readwrite").add(item);
    r.onsuccess = ()=>resolve(item);
    r.onerror = ()=>reject(r.error);
  });
}
function dbPut(item){
  return new Promise((resolve, reject)=>{
    const r = tx("readwrite").put(item);
    r.onsuccess = ()=>resolve(item);
    r.onerror = ()=>reject(r.error);
  });
}
function dbGet(id){
  return new Promise((resolve, reject)=>{
    const r = tx().get(id);
    r.onsuccess = ()=>resolve(r.result || null);
    r.onerror = ()=>reject(r.error);
  });
}
function dbDel(id){
  return new Promise((resolve, reject)=>{
    const r = tx("readwrite").delete(id);
    r.onsuccess = ()=>resolve(true);
    r.onerror = ()=>reject(r.error);
  });
}
function dbAll(){
  return new Promise((resolve, reject)=>{
    const r = tx().getAll();
    r.onsuccess = ()=>resolve(r.result || []);
    r.onerror = ()=>reject(r.error);
  });
}

function uid(){
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function buildBasePrompt({theme, structure, intensity, style, modeMeta}){
  // Base rules: compatible with Oppresseur vibe, but avoids overfitting to old songs.
  const lines = [
    "Tu écris des paroles de rap québécois propres et naturelles, 100% rappées (pas chantées).",
    "Chaque ligne doit être forte, logique, concrète, et apporter une idée ou une image réelle. Zéro remplissage.",
    "Aucune référence aux réseaux sociaux, aucune référence à la race.",
    "Évite les mots surutilisés et le vocabulaire cliché, reste original et humain.",
    "",
    `Structure: ${structure}`,
    `Intensité: ${intensity}`,
    `Style d'écriture: ${style}`,
    modeMeta ? `Mode: ${modeMeta}` : "",
    "",
    "Thème / message:",
    theme,
    "",
    "Rendu: donne uniquement les paroles structurées avec des tags [Intro], [Verse 1], [Chorus], etc. Pas d'explications."
  ].filter(Boolean);

  return lines.join("\n");
}

function buildStrategyPrompt({theme, structure, intensity, style}){
  // Strategy pass: outlines hook concept + scene anchors, but short.
  const lines = [
    "Tu es un directeur artistique de rap québécois.",
    "Objectif: produire une STRATÉGIE courte pour écrire un morceau puissant, concret, sans remplissage.",
    "Contraintes: pas de réseaux sociaux, pas de race, pas de moralisation.",
    "",
    `Structure: ${structure}`,
    `Intensité: ${intensity}`,
    `Style: ${style}`,
    "",
    "Donne:",
    "1) une phrase-hook (8-12 mots max) qui résume la vérité du morceau",
    "2) 6 ancres de scènes concrètes (actions, lieux, objets, sensations) en puces",
    "3) 4 mots-clés de tonalité (ex: froid, lourd, lucide, serré)",
    "",
    "Thème:",
    theme
  ];
  return lines.join("\n");
}

function pickFreestyleIdea(){
  const ideas = [
    "la patience comme arme, attendre sans se faire avaler",
    "les gens qui te testent quand tu changes sans faire de bruit",
    "les règles invisibles du respect dans les yeux, pas dans les mots",
    "l'homme calme qui refuse le chaos, même quand il a toutes les raisons",
    "le prix de comprendre trop tôt: se taire, observer, avancer",
    "quand t'arrêtes de chercher d'être compris: t'es libre",
    "la fatigue noble: continuer sans se plaindre, juste continuer",
    "être loyal à soi-même quand le monde récompense le contraire",
    "couper les habitudes qui te volent ta force",
    "une nuit où tout aurait pu déraper, mais tu choisis le contrôle"
  ];
  return ideas[Math.floor(Math.random()*ideas.length)];
}

async function apiModels(){
  const res = await fetch("/api/models", { method:"GET" });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error((data && data.error) ? JSON.stringify(data) : ("HTTP " + res.status));
  return data.models || [];
}

async function apiGenerate({model, prompt}){
  const res = await fetch("/api/generate", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model, prompt })
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    const msg = data?.error ? JSON.stringify(data) : ("HTTP " + res.status);
    throw new Error(msg);
  }
  return data.text || "";
}

function getGeneratorInputs(){
  const mode = $("g_mode").value;
  let theme = $("g_theme").value.trim();
  if(mode === "freestyle"){
    theme = theme || pickFreestyleIdea();
    $("g_theme").value = theme;
  }
  return {
    theme,
    structure: $("g_structure").value,
    intensity: $("g_intensity").value,
    style: $("g_style").value,
    mode,
    model: normalizeModelName($("g_model").value),
    project: $("g_project").value.trim(),
    track: $("g_track").value.trim(),
  };
}

function setGeneratorOutput(text){
  $("g_output").textContent = text || "";
}

function getGeneratorOutput(){
  return $("g_output").textContent || "";
}

async function loadModelsIntoSelect(){
  setKeyStatus("clé: test…");
  toast("test clé + modèles…");
  try{
    const models = await apiModels();
    const sel = $("g_model");
    sel.innerHTML = "";
    if(models.length === 0){
      sel.innerHTML = `<option value="">(aucun modèle retourné)</option>`;
      setKeyStatus("clé: ok, liste vide");
      return;
    }
    for(const m of models){
      const opt = document.createElement("option");
      opt.value = normalizeModelName(m.name);
      opt.textContent = `${normalizeModelName(m.name)} — ${m.displayName||""}`.trim();
      sel.appendChild(opt);
    }
    setKeyStatus("clé: ok", true);
    toast(`modèles chargés: ${models.length}`);
  }catch(err){
    setKeyStatus("clé: erreur");
    setGeneratorOutput("erreur modèles:\n" + err.message);
  }
}

async function generateNow(){
  const g = getGeneratorInputs();
  if(!g.model){
    toast("charge les modèles d'abord");
    setGeneratorOutput("choisis un modèle (clique “charger modèles”).");
    return;
  }
  if(!g.theme){
    toast("écris un thème");
    setGeneratorOutput("écris un thème / message avant de générer.");
    return;
  }

  const state = loadState();
  const modeMeta = g.mode === "two-pass" ? "2 passes" : (g.mode==="one-pass" ? "1 passe" : "freestyle");
  const basePrompt = buildBasePrompt({ ...g, modeMeta });

  setGeneratorOutput("génération en cours…");
  toast("génération…");

  try{
    let strategy = "";
    if(g.mode === "two-pass"){
      const sp = buildStrategyPrompt(g);
      strategy = await apiGenerate({ model: g.model, prompt: sp });
    }
    const finalPrompt = (strategy ? (strategy + "\n\n---\n\n") : "") + basePrompt;
    const text = await apiGenerate({ model: g.model, prompt: finalPrompt });

    setGeneratorOutput(text);
    markUsage({ generated:true, freestyle: g.mode==="freestyle" });

    // achievements refresh
    await refreshAchievements();

  }catch(err){
    setGeneratorOutput("erreur:\n" + err.message);
  }
}

async function saveDraftFromGenerator(){
  const g = getGeneratorInputs();
  const text = getGeneratorOutput().trim();
  if(!text || text==="prêt." || text.startsWith("génération en cours")){
    toast("rien à sauver");
    return;
  }
  const title = suggestTitleFromText(text);
  const item = {
    id: uid(),
    title,
    project: g.project || "",
    track: g.track || "",
    model: g.model || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    text,
    meta: {
      structure: g.structure,
      intensity: g.intensity,
      style: g.style,
      mode: g.mode,
      theme: g.theme
    }
  };
  await dbAdd(item);
  selectedId = item.id;
  editorId = item.id;
  toast("sauvé");
  markUsage({ saved:true, project: !!item.project });
  await refreshAchievements();
}

function suggestTitleFromText(text){
  // Extract first non-tag line and shorten.
  const lines = text.split("\n").map(l=>l.trim()).filter(Boolean);
  let cand = lines.find(l => !l.startsWith("[") && l.length>3) || "nouveau texte";
  cand = cand.replace(/[^\p{L}\p{N}\s'-]/gu,"").trim();
  if(cand.length > 26) cand = cand.slice(0, 26).trim();
  return cand || "nouveau texte";
}

function downloadFile(filename, content, mime="text/plain"){
  const blob = new Blob([content], { type:mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyToClipboard(text){
  navigator.clipboard.writeText(text).then(()=>toast("copié")).catch(()=>toast("copie impossible"));
}

function setEditorFromItem(item){
  if(!item) return;
  editorId = item.id;
  $("e_title").value = item.title || "";
  $("e_project").value = item.project || "";
  $("e_track").value = item.track || "";
  $("e_text").value = item.text || "";
}

async function openEditorFromCurrent(){
  const id = selectedId || editorId;
  if(!id){
    // fallback from generator output
    const text = getGeneratorOutput().trim();
    if(text && text!=="prêt."){
      $("e_title").value = suggestTitleFromText(text);
      $("e_project").value = $("g_project").value.trim();
      $("e_track").value = $("g_track").value.trim();
      $("e_text").value = text;
      editorId = null;
      tabTo("edit");
      toast("éditeur ouvert");
    }else{
      toast("rien à éditer");
    }
    return;
  }
  const item = await dbGet(id);
  setEditorFromItem(item);
  tabTo("edit");
  toast("éditeur ouvert");
}

async function editorSave(){
  const title = $("e_title").value.trim() || "sans titre";
  const project = $("e_project").value.trim();
  const track = $("e_track").value.trim();
  const text = $("e_text").value || "";

  if(editorId){
    const item = await dbGet(editorId);
    if(!item){ toast("item introuvable"); return; }
    const updated = { ...item, title, project, track, text, updatedAt: nowISO() };
    await dbPut(updated);
    toast("sauvé");
  }else{
    const item = {
      id: uid(),
      title, project, track, text,
      model: normalizeModelName($("g_model").value),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      meta: { importedFrom:"editor" }
    };
    await dbAdd(item);
    editorId = item.id;
    selectedId = item.id;
    toast("créé + sauvé");
  }
  markUsage({ editorSave:true, project: !!project });
  await refreshAchievements();
}

async function editorDuplicate(){
  const title = ($("e_title").value.trim() || "sans titre") + " (copy)";
  const project = $("e_project").value.trim();
  const track = $("e_track").value.trim();
  const text = $("e_text").value || "";
  const item = {
    id: uid(),
    title, project, track, text,
    model: normalizeModelName($("g_model").value),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    meta: { duplicated:true }
  };
  await dbAdd(item);
  editorId = item.id;
  selectedId = item.id;
  toast("dupliqué");
  await refreshLibrary();
  await refreshStats();
}

function renderTemplates(){
  const grid = $("tplGrid");
  if(!grid) return;
  grid.innerHTML = "";

  const tpls = getTemplates();
  for(const t of tpls){
    const div = document.createElement("div");
    div.className = "tpl";
    div.innerHTML = `
      <div class="tname">${escapeHtml(t.name)}</div>
      <div class="tdesc">${escapeHtml(t.desc)}</div>
      <div class="tmeta">
        <span class="badge">${escapeHtml(t.structure)}</span>
        <span class="badge">${escapeHtml(t.intensity)}</span>
        <span class="badge">${escapeHtml(t.style)}</span>
      </div>
      <button class="btn small primary">utiliser</button>
    `;
    div.querySelector("button").addEventListener("click", ()=>{
      $("g_theme").value = t.seed;
      $("g_structure").value = t.structureKey;
      $("g_intensity").value = t.intensityKey;
      $("g_style").value = t.styleKey;
      tabTo("gen");
      toast("template appliqué");
    });
    grid.appendChild(div);
  }
}

function getTemplates(){
  // 30+ fresh concept seeds — not derived from existing songs; aligned with vibe.
  const base = [
    ["l'homme qui n'explose pas","un morceau sur la maîtrise froide: tu pourrais déraper, tu choisis le contrôle.","classic","cold / lucide","lucid",
     "raconte une situation précise où tout te pousse à péter une coche, mais tu restes droit, et c'est ça qui fait peur"],
    ["les règles non écrites","inventaire des codes invisibles du respect, du timing, des regards.","story","balanced","cinematic",
     "décris 6 règles invisibles qui t'ont sauvé des ennuis, avec scènes concrètes et conséquences"],
    ["j'ai compris trop tôt","la lucidité précoce comme fardeau, pas comme trophée.","story","balanced","lucid",
     "tu comprends les patterns humains avant les autres, et tu dois apprendre à te taire pour survivre"],
    ["ça coûte d'être cohérent","payer le prix de rester aligné quand le monde récompense le contraire.","classic","heavy / viscéral","street-clean",
     "décris ce que tu perds quand tu refuses de mentir: jobs, relations, confort — mais tu gardes ta colonne"],
    ["mon silence parle","le silence comme stratégie: tu laisses les gens se dévoiler seuls.","classic","cold / lucide","lucid",
     "scènes: table de cuisine, stationnement, chantier, escalier — tu dis rien, tu vois tout"],
    ["l'habitude qui me vole","tu attaques une habitude précise qui te gruge la force.","classic","heavy / viscéral","cinematic",
     "une journée typique, minute par minute, et comment tu reprends le volant"],
    ["pas besoin d'être aimé","liberté après le besoin de plaire.","minimal","balanced","lucid",
     "tu fais la liste des moments où tu cherchais l'approbation, puis le moment où t'as décroché"],
    ["les gens testent le calme","plus tu es stable, plus certains essaient de te provoquer.","classic","heavy / viscéral","street-clean",
     "mise en scène: quelqu'un te pousse, te pique, te rabaisse — et toi tu restes impassible, ça les rend fous"],
    ["la fatigue noble","pas cassé: juste usé, mais debout.","classic","balanced","cinematic",
     "décris des détails physiques (yeux lourds, mains, souffle), mais ton mental reste solide"],
    ["je ne suis pas en retard","refus de la timeline sociale, ton rythme à toi.","story","uplift / résilience","lucid",
     "une lettre à toi-même: pourquoi ton chemin devait être non-linéaire"],
    ["les faux gentils","démasquer la gentillesse comme arme sociale.","classic","heavy / viscéral","attack-narc",
     "sans menaces: punchlines sur la manipulation douce, les phrases enrobées, les faveurs avec facture"],
    ["l'endroit où je respire","un lieu précis qui te remet d'aplomb (pas cliché).","story","balanced","cinematic",
     "décris ce lieu par sons, odeurs, objets, sensations — et pourquoi t'y redeviens toi"],
    ["le respect sans théâtre","pas besoin de jouer dur: tu l'imposes par cohérence.","classic","cold / lucide","street-clean",
     "raconte un moment où tu n'élèves pas la voix, et pourtant tout le monde comprend"],
    ["je coupe ce qui me coûte","mettre fin à des liens/habitudes sans drame, juste propre.","classic","balanced","lucid",
     "tu expliques le 'pourquoi', mais sans justification émotionnelle — juste vérité"],
    ["l'œil qui voit tout","hyper-observation: tu captes micro-signaux, incohérences.","cypher","cold / lucide","lucid",
     "enchaîne des constats courts et précis, comme une caméra qui zoom"],
    ["la victoire en dedans","gagner sans témoin: la vraie victoire.","classic","uplift / résilience","cinematic",
     "une bataille intérieure, détail par détail: tu surmontes sans le dire à personne"],
    ["trop de bruit, pas de vérité","le vacarme d'opinions étouffe le réel.","classic","balanced","lucid",
     "tu fais le tri: ce qui vaut une parole, ce qui vaut le silence"],
    ["l'erreur qui m'a réveillé","un faux pas précis qui a tout changé.","story","heavy / viscéral","cinematic",
     "scène principale: un instant, une phrase, une réaction; puis l'après"],
    ["je refuse la facilité","la tentation de tricher avec soi-même.","classic","heavy / viscéral","street-clean",
     "décris l'offre facile et le choix difficile, sans jouer au saint"],
    ["quand le masque tombe","moment où quelqu'un révèle sa vraie face.","story","heavy / viscéral","cinematic",
     "décris la bascule: ton corps comprend avant ta tête"],
    ["le prix de dire non","dire non: ça crée des ennemis, mais ça sauve ta paix.","classic","balanced","lucid",
     "scènes: téléphone, porte, stationnement; chaque 'non' te libère"],
    ["les promesses qu'on se fait","promesses privées, pas pour impressionner.","minimal","uplift / résilience","lucid",
     "tu listes 5 promesses réalistes, concrètes, que tu tiens une par une"],
    ["le monde aime les faibles","certains préfèrent que tu restes petit.","classic","heavy / viscéral","attack-narc",
     "tu exposes la dynamique: quand tu grandis, on te 'rappelle' à l'ordre"],
    ["je ne négocie pas ma paix","ta paix intérieure n'est pas à vendre.","classic","cold / lucide","lucid",
     "refrain simple: tu poses une frontière nette, sans agressivité"],
    ["la minute avant le dérapage","suspense: tout est sur le point d'exploser.","story","heavy / viscéral","cinematic",
     "décris au ralenti: mains, voix, bruit de fond, décision finale"],
    ["l'énergie des vrais","les gens authentiques: pas nombreux, mais solides.","classic","balanced","street-clean",
     "tu décris comment tu reconnais les vrais: détails, gestes, absence de spectacle"],
    ["je marche sans témoin","avancer sans applaudissements.","classic","uplift / résilience","cinematic",
     "images: neige, lampadaires, respiration, pas lourds; progression intérieure"],
    ["le respect se mérite pas, il se prouve","pas de discours: actes.","cypher","balanced","street-clean",
     "enchaîne des exemples d'actes concrets qui prouvent la valeur"],
    ["quand la tête est trop pleine","sur-analyse: comment tu reprends le contrôle.","classic","balanced","lucid",
     "tu montres ton système: écrire, marcher, respirer, couper le bruit"],
    ["ça se voit dans les yeux","la vérité non dite se lit dans le regard.","classic","cold / lucide","cinematic",
     "mise en scène: une conversation courte; tes yeux captent tout"]
  ];

  return base.map((t, idx)=>({
    id: "tpl_"+idx,
    name: t[0],
    desc: t[1],
    structure: t[2],
    intensity: t[3],
    style: t[4],
    seed: t[5],
    structureKey: t[2]==="classic"?"classic":(t[2]==="story"?"story":(t[2]==="minimal"?"minimal":"cypher")),
    intensityKey: t[3].startsWith("cold")?"cold":(t[3].startsWith("heavy")?"heavy":(t[3].startsWith("uplift")?"uplift":"balanced")),
    styleKey: t[4]
  }));
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

async function refreshLibrary(){
  const items = await dbAll();
  const search = ($("libSearch")?.value || "").trim().toLowerCase();
  const proj = $("libFilterProject")?.value || "__all";
  const sort = $("libSort")?.value || "new";

  // projects filter list
  const projects = Array.from(new Set(items.map(i=>i.project).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const sel = $("libFilterProject");
  if(sel){
    const cur = sel.value || "__all";
    sel.innerHTML = `<option value="__all">tous projets</option>` + projects.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
    sel.value = projects.includes(cur) ? cur : "__all";
  }

  let filtered = items;
  if(proj !== "__all") filtered = filtered.filter(i => (i.project||"") === proj);

  if(search){
    filtered = filtered.filter(i => {
      const hay = ((i.title||"") + " " + (i.project||"") + " " + (i.track||"") + " " + (i.text||"")).toLowerCase();
      return hay.includes(search);
    });
  }

  filtered.sort((a,b)=>{
    if(sort==="new") return (b.createdAt||"").localeCompare(a.createdAt||"");
    if(sort==="old") return (a.createdAt||"").localeCompare(b.createdAt||"");
    if(sort==="az") return (a.title||"").localeCompare(b.title||"");
    if(sort==="za") return (b.title||"").localeCompare(a.title||"");
    return 0;
  });

  const list = $("libList");
  if(!list) return;
  list.innerHTML = "";

  for(const it of filtered){
    const div = document.createElement("div");
    div.className = "item" + (it.id===selectedId ? " is-active" : "");
    const wc = wordCount(it.text);
    div.innerHTML = `
      <div class="ititle">${escapeHtml(it.title || "sans titre")}</div>
      <div class="imeta">
        ${it.project ? `<span class="badge">${escapeHtml(it.project)}</span>` : ""}
        ${it.track ? `<span class="badge">${escapeHtml(it.track)}</span>` : ""}
        <span class="badge">${wc} mots</span>
      </div>
    `;
    div.addEventListener("click", async ()=>{
      selectedId = it.id;
      document.querySelectorAll(".item").forEach(x=>x.classList.remove("is-active"));
      div.classList.add("is-active");
      await showLibraryDetail(it.id);
    });
    list.appendChild(div);
  }

  if(selectedId && filtered.some(i=>i.id===selectedId)){
    await showLibraryDetail(selectedId);
  }else{
    selectedId = filtered[0]?.id || null;
    if(selectedId) await showLibraryDetail(selectedId);
    else clearLibraryDetail();
  }
}

function clearLibraryDetail(){
  $("libTitle").textContent = "sélectionne un item";
  $("libMeta").textContent = "";
  $("libText").textContent = "...";
}

async function showLibraryDetail(id){
  const it = await dbGet(id);
  if(!it){ clearLibraryDetail(); return; }
  $("libTitle").textContent = it.title || "sans titre";
  const parts = [];
  if(it.project) parts.push("projet: " + it.project);
  if(it.track) parts.push("track: " + it.track);
  if(it.createdAt) parts.push("créé: " + it.createdAt.slice(0,19).replace("T"," "));
  if(it.model) parts.push("model: " + it.model);
  $("libMeta").textContent = parts.join(" • ");
  $("libText").textContent = it.text || "";
}

async function deleteSelected(){
  if(!selectedId){ toast("rien à supprimer"); return; }
  if(!confirm("supprimer cet item ?")) return;
  await dbDel(selectedId);
  toast("supprimé");
  selectedId = null;
  await refreshLibrary();
  await refreshStats();
}

function markUsage({generated=false, saved=false, project=false, freestyle=false, editorSave=false}){
  const s = loadState();
  const today = new Date().toISOString().slice(0,10);
  const daysSet = new Set(s.daysList || []);
  daysSet.add(today);

  const next = {
    exports: s.exports || 0,
    freestyle: (s.freestyle || 0) + (freestyle ? 1 : 0),
    editorSaves: (s.editorSaves || 0) + (editorSave ? 1 : 0),
    daysList: Array.from(daysSet),
    days: daysSet.size,
  };
  saveState(next);
}

function markExport(){
  const s = loadState();
  saveState({ exports: (s.exports||0)+1 });
}

async function refreshStats(){
  const items = await dbAll();
  const total = items.length;
  const words = items.reduce((a,i)=>a + wordCount(i.text), 0);
  const projects = new Set(items.map(i=>i.project).filter(Boolean)).size;
  const last = items.map(i=>i.updatedAt||i.createdAt||"").sort().pop() || "";
  const s = loadState();
  const exports = s.exports || 0;
  const days = s.days || 0;

  const sg = $("statGrid");
  if(sg){
    sg.innerHTML = "";
    const stats = [
      ["textes", total],
      ["mots total", words],
      ["projets", projects],
      ["exports", exports],
      ["jours actifs", days],
      ["dernier update", last ? last.slice(0,10) : "—"],
    ];
    for(const [lab,val] of stats){
      const div = document.createElement("div");
      div.className = "stat";
      div.innerHTML = `<div class="slabel">${escapeHtml(lab)}</div><div class="svalue">${escapeHtml(String(val))}</div>`;
      sg.appendChild(div);
    }
  }

  // projects list
  const pl = $("projectsList");
  if(pl){
    pl.innerHTML = "";
    const byProject = {};
    for(const it of items){
      const p = it.project || "";
      if(!p) continue;
      byProject[p] = byProject[p] || { count:0, words:0, last:"" };
      byProject[p].count++;
      byProject[p].words += wordCount(it.text);
      byProject[p].last = [byProject[p].last, it.updatedAt||it.createdAt||""].sort().pop();
    }
    const entries = Object.entries(byProject).sort((a,b)=>b[1].count - a[1].count);
    if(entries.length===0){
      pl.innerHTML = `<div class="muted">aucun projet pour l'instant.</div>`;
    }else{
      for(const [name, info] of entries){
        const div = document.createElement("div");
        div.className = "proj";
        div.innerHTML = `
          <div class="pname">${escapeHtml(name)}</div>
          <div class="pmeta">${info.count} tracks • ${info.words} mots • last ${escapeHtml((info.last||"").slice(0,10))}</div>
        `;
        pl.appendChild(div);
      }
    }
  }

  await refreshAchievements();
}

async function refreshAchievements(){
  const items = await dbAll();
  const total = items.length;
  const projects = new Set(items.map(i=>i.project).filter(Boolean)).size;
  const s = loadState();
  const status = {
    total,
    projects,
    hasCompare: !!(compareA && compareB),
    exports: s.exports || 0,
    freestyle: s.freestyle || 0,
    editorSaves: s.editorSaves || 0,
    days: s.days || 0,
  };

  const unlocked = new Set((s.unlocked || []));
  let newly = 0;
  for(const a of ACH){
    if(!unlocked.has(a.id) && a.rule(status)){
      unlocked.add(a.id);
      newly++;
    }
  }
  if(newly>0){
    saveState({ unlocked: Array.from(unlocked) });
    toast(`achievement +${newly}`);
  }

  const render = (rootId)=>{
    const root = $(rootId);
    if(!root) return;
    root.innerHTML = "";
    for(const a of ACH){
      const div = document.createElement("div");
      const isU = unlocked.has(a.id);
      div.className = "ach" + (isU ? " unlocked" : "");
      div.innerHTML = `
        <div class="aname">${escapeHtml(a.name)} ${isU ? "• unlocked" : ""}</div>
        <div class="adesc">${escapeHtml(a.desc)}</div>
      `;
      root.appendChild(div);
    }
  };
  render("achList");
  render("achList2");

  const cnt = $("achCount");
  if(cnt) cnt.textContent = `${unlocked.size}/${ACH.length}`;
}

async function setCompare(slot, id){
  const it = await dbGet(id);
  if(!it){ toast("item introuvable"); return; }
  if(slot==="A"){ compareA = id; $("cmpTitleA").textContent = "A: " + (it.title||"sans titre"); $("cmpTextA").textContent = it.text||""; }
  if(slot==="B"){ compareB = id; $("cmpTitleB").textContent = "B: " + (it.title||"sans titre"); $("cmpTextB").textContent = it.text||""; }
  markUsage({});
  await refreshAchievements();
}

function swapCompare(){
  const a = compareA; compareA = compareB; compareB = a;
  const ta = $("cmpTitleA").textContent; $("cmpTitleA").textContent = $("cmpTitleB").textContent; $("cmpTitleB").textContent = ta;
  const xa = $("cmpTextA").textContent; $("cmpTextA").textContent = $("cmpTextB").textContent; $("cmpTextB").textContent = xa;
}

function clearCompare(){
  compareA = null; compareB = null;
  $("cmpTitleA").textContent = "A: vide";
  $("cmpTitleB").textContent = "B: vide";
  $("cmpTextA").textContent = "...";
  $("cmpTextB").textContent = "...";
}

async function exportCurrentText(asJson=false, from="generator"){
  let title = "export";
  let payload = "";
  let obj = null;

  if(from==="generator"){
    payload = getGeneratorOutput().trim();
    title = suggestTitleFromText(payload);
    obj = {
      title,
      createdAt: nowISO(),
      text: payload,
      meta: getGeneratorInputs()
    };
  }else if(from==="editor"){
    payload = ($("e_text").value || "");
    title = ($("e_title").value || "export").trim();
    obj = {
      title,
      project: ($("e_project").value||"").trim(),
      track: ($("e_track").value||"").trim(),
      updatedAt: nowISO(),
      text: payload
    };
  }else if(from==="library"){
    if(!selectedId){ toast("rien à exporter"); return; }
    const it = await dbGet(selectedId);
    if(!it){ toast("introuvable"); return; }
    payload = it.text || "";
    title = it.title || "export";
    obj = it;
  }

  if(!payload){ toast("rien à exporter"); return; }

  const safe = title.replace(/[^\p{L}\p{N}\s_-]/gu,"").trim().replace(/\s+/g,"_").slice(0,40) || "export";

  if(asJson){
    downloadFile(`${safe}.json`, JSON.stringify(obj, null, 2), "application/json");
  }else{
    downloadFile(`${safe}.txt`, payload, "text/plain");
  }

  markExport();
  await refreshAchievements();
}

async function exportSelection(){
  // export filtered list as JSON bundle
  const items = await dbAll();
  const search = ($("libSearch")?.value || "").trim().toLowerCase();
  const proj = $("libFilterProject")?.value || "__all";

  let filtered = items;
  if(proj !== "__all") filtered = filtered.filter(i => (i.project||"") === proj);
  if(search){
    filtered = filtered.filter(i => ((i.title||"")+" "+(i.text||"")).toLowerCase().includes(search));
  }
  if(filtered.length===0){ toast("aucun item"); return; }

  const bundle = {
    exportedAt: nowISO(),
    count: filtered.length,
    items: filtered
  };
  downloadFile(`oppresseurai_export_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(bundle, null, 2), "application/json");
  markExport();
  toast("export ok");
  await refreshAchievements();
}

function setupShortcuts(){
  window.addEventListener("keydown", (e)=>{
    // ctrl+enter => generate (if on generator panel)
    if(e.ctrlKey && e.key === "Enter"){
      const genActive = $("panel-gen").classList.contains("is-active");
      if(genActive){ e.preventDefault(); generateNow(); }
    }
    // ctrl+s => editor save
    if(e.ctrlKey && (e.key === "s" || e.key === "S")){
      const editActive = $("panel-edit").classList.contains("is-active");
      if(editActive){ e.preventDefault(); editorSave(); }
    }
    // ctrl+k => focus library search (works anywhere)
    if(e.ctrlKey && (e.key === "k" || e.key === "K")){
      e.preventDefault();
      tabTo("lib");
      setTimeout(()=> $("libSearch")?.focus(), 50);
    }
  });
}

function setupUI(){
  // theme
  const st = loadState();
  const theme = st.theme || "classic";
  $("themeSelect").value = theme;
  applyTheme(theme);
  $("themeSelect").addEventListener("change", (e)=>applyTheme(e.target.value));

  // models
  $("btnModels").addEventListener("click", loadModelsIntoSelect);

  // generator actions
  $("btnGenerate").addEventListener("click", generateNow);
  $("btnSaveDraft").addEventListener("click", saveDraftFromGenerator);
  $("btnCopy").addEventListener("click", ()=>copyToClipboard(getGeneratorOutput()));
  $("btnToEditor").addEventListener("click", openEditorFromCurrent);
  $("btnExportTxt").addEventListener("click", ()=>exportCurrentText(false, "generator"));
  $("btnExportJson").addEventListener("click", ()=>exportCurrentText(true, "generator"));

  // library controls
  $("libSearch").addEventListener("input", ()=>refreshLibrary());
  $("libFilterProject").addEventListener("change", ()=>refreshLibrary());
  $("libSort").addEventListener("change", ()=>refreshLibrary());
  $("btnDeleteItem").addEventListener("click", deleteSelected);
  $("btnOpenEditor").addEventListener("click", async ()=>{
    if(!selectedId){ toast("sélectionne un item"); return; }
    const it = await dbGet(selectedId);
    setEditorFromItem(it);
    tabTo("edit");
  });
  $("btnAddCompareA").addEventListener("click", async ()=>{
    if(!selectedId){ toast("sélectionne un item"); return; }
    await setCompare("A", selectedId);
    tabTo("cmp");
  });
  $("btnAddCompareB").addEventListener("click", async ()=>{
    if(!selectedId){ toast("sélectionne un item"); return; }
    await setCompare("B", selectedId);
    tabTo("cmp");
  });
  $("btnLibExport").addEventListener("click", exportSelection);

  // editor actions
  $("btnEditorSave").addEventListener("click", editorSave);
  $("btnEditorDup").addEventListener("click", editorDuplicate);
  $("btnEditorExportTxt").addEventListener("click", ()=>exportCurrentText(false, "editor"));
  $("btnEditorExportJson").addEventListener("click", ()=>exportCurrentText(true, "editor"));

  // comparison
  $("btnSwap").addEventListener("click", swapCompare);
  $("btnClearCompare").addEventListener("click", clearCompare);
}

async function bootstrap(){
  setupTabs();
  setupShortcuts();
  setupUI();
  db = await openDB();

  // init project filter select options
  $("libFilterProject").innerHTML = `<option value="__all">tous projets</option>`;

  // initial stats + achievements
  await refreshStats();
  await refreshLibrary();
  renderTemplates();

  // record day usage
  markUsage({});
  await refreshAchievements();
}

bootstrap().catch(err=>{
  console.error(err);
  alert("Erreur init: " + err.message);
});
