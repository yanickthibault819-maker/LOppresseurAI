async function safeJson(res){
  try{ return await res.json(); }catch{ return null; }
}

export default async function handler(req, res){
  try{
    if(req.method !== "POST"){
      res.status(405).json({ ok:false, error:"method not allowed" });
      return;
    }

    const { provider, model, prompt } = req.body || {};
    if(!provider || !prompt){
      res.status(400).json({ ok:false, error:"missing provider/prompt" });
      return;
    }

    const p = String(provider).toLowerCase();
    const m = (model ? String(model) : "").trim();

    let apiKey = null;
    if(p === "gemini") apiKey = process.env.GEMINI_API_KEY || null;
    if(p === "openai") apiKey = process.env.OPENAI_API_KEY || null;
    if(p === "claude") apiKey = process.env.ANTHROPIC_API_KEY || null;

    if(!apiKey){
      res.status(401).json({ ok:false, error:`missing server env key for provider: ${p}` });
      return;
    }

    // Require a model (UI should provide a validated one)
    if(!m){
      res.status(400).json({ ok:false, error:"missing model" });
      return;
    }

    if(p === "gemini"){
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const rr = await fetch(url, {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify({
          contents:[{ parts:[{ text:String(prompt) }] }],
          generationConfig:{ temperature:0.8 }
        })
      });
      const jj = await safeJson(rr);
      if(!rr.ok){
        res.status(rr.status).json({ ok:false, error: jj?.error?.message || "gemini error" });
        return;
      }
      const text = jj?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("") || "";
      res.status(200).json({ ok:true, text });
      return;
    }

    if(p === "openai"){
      const rr = await fetch("https://api.openai.com/v1/responses", {
        method:"POST",
        headers:{
          "content-type":"application/json",
          "authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: m,
          input: String(prompt),
          temperature: 0.8
        })
      });
      const jj = await safeJson(rr);
      if(!rr.ok){
        res.status(rr.status).json({ ok:false, error: jj?.error?.message || "openai error" });
        return;
      }
      res.status(200).json({ ok:true, text: jj?.output_text || "" });
      return;
    }

    if(p === "claude"){
      const rr = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{
          "content-type":"application/json",
          "x-api-key": apiKey,
          "anthropic-version":"2023-06-01"
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 1800,
          temperature: 0.8,
          messages:[{ role:"user", content:String(prompt) }]
        })
      });
      const jj = await safeJson(rr);
      if(!rr.ok){
        res.status(rr.status).json({ ok:false, error: jj?.error?.message || jj?.error || "claude error" });
        return;
      }
      const text = (jj?.content || []).map(x => x?.text || "").join("") || "";
      res.status(200).json({ ok:true, text });
      return;
    }

    res.status(400).json({ ok:false, error:"unknown provider" });
  }catch(e){
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
