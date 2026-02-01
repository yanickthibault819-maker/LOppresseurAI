import fs from "fs";
import path from "path";
const CACHE_PATH = path.join(process.cwd(), "provider-cache.json");

function writeCache(patch){
  let cache = {};
  try{ cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")); }catch{}
  const merged = { ...cache, ...patch };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

function getEnvKey(provider){
  if(provider==="gemini") return process.env.GEMINI_API_KEY;
  if(provider==="openai") return process.env.OPENAI_API_KEY;
  if(provider==="claude") return process.env.ANTHROPIC_API_KEY;
  return "";
}

function bad(res, code, message, http=400){
  res.status(http).json({ ok:false, error:{ code, message }});
}

async function testGemini(apiKey){
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url);
  const j = await r.json();
  if(!r.ok){
    return { ok:false, error:{ code:"GEMINI_API_ERROR", message: j?.error?.message || "gemini error" } };
  }
  const models = (j.models||[])
    .map(m=>({
      id: (m.name||"").replace("models/",""),
      label: m.displayName || (m.name||"").replace("models/",""),
      supports: m.supportedGenerationMethods || []
    }))
    .filter(m=>m.id && m.supports.includes("generateContent"));
  return { ok:true, models };
}

async function testOpenAI(apiKey){
  const shortlist = ["gpt-4o-mini","gpt-4.1-mini","gpt-4o"];
  const usable = [];
  for(const model of shortlist){
    try{
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method:"POST",
        headers:{ "content-type":"application/json", "authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages:[{ role:"user", content:"ping" }], max_tokens: 1 })
      });
      if(r.ok) usable.push({ id:model, label:model, supports:["chat.completions"], recommended: model.includes("mini")?"fast":"quality" });
    }catch{}
  }
  if(!usable.length) return { ok:false, error:{ code:"OPENAI_NO_MODELS", message:"aucun modèle de la shortlist n'a répondu (clé invalide ou accès insuffisant)" } };
  return { ok:true, models: usable };
}

async function testClaude(apiKey){
  const shortlist = ["claude-3-5-haiku-latest","claude-3-5-sonnet-latest"];
  const usable = [];
  for(const model of shortlist){
    try{
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "content-type":"application/json", "x-api-key": apiKey, "anthropic-version":"2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1, messages:[{ role:"user", content:"ping" }] })
      });
      if(r.ok) usable.push({ id:model, label:model, supports:["messages"], recommended: model.includes("haiku")?"fast":"quality" });
    }catch{}
  }
  if(!usable.length) return { ok:false, error:{ code:"CLAUDE_NO_MODELS", message:"aucun modèle de la shortlist n'a répondu (clé invalide ou accès insuffisant)" } };
  return { ok:true, models: usable };
}

export default async function handler(req,res){
  if(req.method !== "POST") return bad(res, "METHOD_NOT_ALLOWED", "use POST", 405);

  const { provider, apiKey } = req.body || {};
  if(!provider) return bad(res, "MISSING_PROVIDER", "provider requis");

  const key = (apiKey && typeof apiKey==="string" && apiKey.trim()) ? apiKey.trim() : getEnvKey(provider);
  if(!key) return bad(res, "MISSING_KEY", "clé manquante — configure les env vars sur vercel ou passe apiKey en local");

  let result;
  if(provider==="gemini") result = await testGemini(key);
  else if(provider==="openai") result = await testOpenAI(key);
  else if(provider==="claude") result = await testClaude(key);
  else return bad(res, "UNKNOWN_PROVIDER", "provider inconnu");

  if(!result.ok) return res.status(401).json({ ok:false, provider, error: result.error });

  const models = result.models || [];
  writeCache({ [provider]: { models, usableCount: models.length, testedAt: new Date().toISOString() } });

  res.status(200).json({ ok:true, provider, models, usableCount: models.length, testedAt: new Date().toISOString() });
}
