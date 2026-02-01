function getEnvKey(provider){
  if(provider==="gemini") return process.env.GEMINI_API_KEY;
  if(provider==="openai") return process.env.OPENAI_API_KEY;
  if(provider==="claude") return process.env.ANTHROPIC_API_KEY;
  return "";
}
function bad(res, code, message, http=400){ res.status(http).json({ ok:false, error:{ code, message }}); }

async function genGemini(apiKey, model, prompt){
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = { contents: [{ role:"user", parts:[{ text: prompt }]}] };
  const r = await fetch(url, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if(!r.ok) return { ok:false, error:{ code:"GEMINI_GENERATE_ERROR", message: j?.error?.message || "gemini generate error" } };
  const text = j?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("") || "";
  return { ok:true, text };
}

async function genOpenAI(apiKey, model, prompt){
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ "content-type":"application/json", "authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages:[{ role:"user", content: prompt }], temperature: 0.8 })
  });
  const j = await r.json();
  if(!r.ok) return { ok:false, error:{ code:"OPENAI_GENERATE_ERROR", message: j?.error?.message || "openai generate error" } };
  return { ok:true, text: j?.choices?.[0]?.message?.content || "" };
}

async function genClaude(apiKey, model, prompt){
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "content-type":"application/json", "x-api-key": apiKey, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1200, messages:[{ role:"user", content: prompt }] })
  });
  const j = await r.json();
  if(!r.ok) return { ok:false, error:{ code:"CLAUDE_GENERATE_ERROR", message: j?.error?.message || "claude generate error" } };
  const text = (j?.content||[]).map(x=>x.text).join("") || "";
  return { ok:true, text };
}

export default async function handler(req,res){
  if(req.method !== "POST") return bad(res, "METHOD_NOT_ALLOWED", "use POST", 405);
  const { provider, model, prompt, apiKey } = req.body || {};
  if(!provider || !model || !prompt) return bad(res, "MISSING_FIELDS", "provider/model/prompt requis");

  const key = (apiKey && typeof apiKey==="string" && apiKey.trim()) ? apiKey.trim() : getEnvKey(provider);
  if(!key) return bad(res, "MISSING_KEY", "clé manquante — configure env vars sur vercel ou passe apiKey en local");

  let out;
  if(provider==="gemini") out = await genGemini(key, model, prompt);
  else if(provider==="openai") out = await genOpenAI(key, model, prompt);
  else if(provider==="claude") out = await genClaude(key, model, prompt);
  else return bad(res, "UNKNOWN_PROVIDER", "provider inconnu");

  if(!out.ok) return res.status(401).json({ ok:false, provider, error: out.error });
  res.status(200).json({ ok:true, provider, model, text: out.text });
}
