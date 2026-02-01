(function(){
  const $ = (id)=>document.getElementById(id);

  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tabpage").forEach(p=>p.classList.remove("active"));
      document.querySelector("#tab-"+tab).classList.add("active");
    });
  });

  const serverStatus = $("serverStatus");
  async function ping(){
    try{
      const r = await fetch("/api/health");
      const j = await r.json();
      if(j && j.ok){
        serverStatus.textContent = "serveur: ok";
        serverStatus.style.color = "var(--ok)";
      } else {
        serverStatus.textContent = "serveur: problème";
        serverStatus.style.color = "var(--danger)";
      }
    }catch(e){
      serverStatus.textContent = "serveur: offline";
      serverStatus.style.color = "var(--danger)";
    }
  }

  const isLocalhost = ["localhost","127.0.0.1"].includes(location.hostname);
  function applyProdMode(){
    const hint = $("prodHint");
    document.querySelectorAll(".keyInput").forEach(i=>{
      i.style.display = isLocalhost ? "block" : "none";
    });
    hint.innerHTML = isLocalhost
      ? "mode local: colle tes clés ici si tu veux. en vercel, utilise les env vars."
      : "en ligne (vercel), ajoute tes clés dans <b>Project Settings → Environment Variables</b>. " +
        "les champs de clés sont cachés par sécurité. clique “tester” pour détecter les modèles.";
  }

  const providerSelect = $("providerSelect");
  const modelSelect = $("modelSelect");
  const modelsCacheEl = $("modelsCache");

  function setModelOptions(models){
    modelSelect.innerHTML = "";
    if(!models || !models.length){
      const opt = document.createElement("option");
      opt.textContent = "— aucun modèle détecté —";
      modelSelect.appendChild(opt);
      modelSelect.disabled = true;
      return;
    }
    models.forEach(m=>{
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label || m.id;
      modelSelect.appendChild(opt);
    });
    modelSelect.disabled = false;
  }

  async function loadModelsFromServer(provider){
    const r = await fetch(`/api/providers/models?provider=${encodeURIComponent(provider)}`);
    const j = await r.json();
    return (j && j.models) ? j.models : [];
  }
  async function refreshGeneratorModels(){
    const provider = providerSelect.value;
    const models = await loadModelsFromServer(provider);
    setModelOptions(models);
  }
  providerSelect.addEventListener("change", refreshGeneratorModels);

  async function testProvider(provider){
    const keyInput = provider === "gemini" ? $("geminiKey") : provider === "openai" ? $("openaiKey") : $("claudeKey");
    const statusEl = provider === "gemini" ? $("geminiStatus") : provider === "openai" ? $("openaiStatus") : $("claudeStatus");
    const modelsEl = provider === "gemini" ? $("geminiModels") : provider === "openai" ? $("openaiModels") : $("claudeModels");

    statusEl.textContent = "test en cours…";
    statusEl.style.color = "var(--muted)";
    modelsEl.innerHTML = "";

    const body = { provider };
    if(isLocalhost && keyInput && keyInput.value.trim()){
      body.apiKey = keyInput.value.trim();
    }

    const r = await fetch("/api/providers/test", {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json();

    if(!r.ok || !j.ok){
      statusEl.textContent = "❌ " + (j?.error?.message || j?.error || "erreur");
      statusEl.style.color = "var(--danger)";
      return;
    }

    statusEl.textContent = `✅ ok — modèles utilisables: ${j.usableCount}`;
    statusEl.style.color = "var(--ok)";

    (j.models || []).forEach(m=>{
      const pill = document.createElement("div");
      pill.className = "pill ok";
      pill.textContent = m.label || m.id;
      modelsEl.appendChild(pill);
    });

    await renderCache();
    await refreshGeneratorModels();
  }

  document.querySelectorAll(".btnTest").forEach(btn=>{
    btn.addEventListener("click", ()=> testProvider(btn.dataset.provider));
  });

  async function renderCache(){
    try{
      const r = await fetch("/api/providers/cache");
      const j = await r.json();
      modelsCacheEl.textContent = JSON.stringify(j, null, 2);
    }catch(e){
      modelsCacheEl.textContent = "cache inaccessible";
    }
  }
  $("btnRefreshCache").addEventListener("click", renderCache);

  $("btnGenerate").addEventListener("click", async ()=>{
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const prompt = $("prompt").value;

    $("output").textContent = "génération…";
    const body = { provider, model, prompt };

    if(isLocalhost){
      if(provider==="gemini" && $("geminiKey").value.trim()) body.apiKey = $("geminiKey").value.trim();
      if(provider==="openai" && $("openaiKey").value.trim()) body.apiKey = $("openaiKey").value.trim();
      if(provider==="claude" && $("claudeKey").value.trim()) body.apiKey = $("claudeKey").value.trim();
    }

    try{
      const r = await fetch("/api/generate", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if(!r.ok || !j.ok){
        $("output").textContent = "erreur: " + (j?.error?.message || j?.error || "unknown");
        return;
      }
      $("output").textContent = j.text || JSON.stringify(j, null, 2);
    }catch(e){
      $("output").textContent = "erreur fetch: " + e.message;
    }
  });

  $("btnClear").addEventListener("click", ()=> $("output").textContent = "");
  $("btnCopy").addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText($("output").textContent || ""); }catch(e){}
  });

  applyProdMode();
  ping().then(async ()=>{ await renderCache(); await refreshGeneratorModels(); });
})();