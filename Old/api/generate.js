export default async function handler(req, res) {
  try{
    if(req.method!=='POST'){ res.status(405).json({ok:false,error:'method not allowed'}); return; }
    const { provider, model, prompt, keyOverride } = req.body || {};
    if(!provider || !model || !prompt){ res.status(400).json({ok:false,error:'missing provider/model/prompt'}); return; }

    const p = String(provider).toLowerCase();
    const key = (keyOverride||'').trim() || (p==='gemini' ? process.env.GEMINI_API_KEY :
              p==='openai' ? process.env.OPENAI_API_KEY :
              p==='claude' ? process.env.ANTHROPIC_API_KEY : '');

    if(!key){ res.status(400).json({ok:false,error:'aucune clé disponible (env ou saisie)'}); return; }

    if(p==='gemini'){
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const r = await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          contents:[{parts:[{text:String(prompt)}]}],
          generationConfig:{ temperature:0.8 }
        })
      });
      const js = await r.json();
      if(!r.ok){ res.status(r.status).json({ok:false,error: js?.error?.message || 'gemini error'}); return; }
      const text = js?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || '';
      res.status(200).json({ok:true, text});
      return;
    }

    if(p==='openai'){
      const r = await fetch('https://api.openai.com/v1/responses', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ model, input: String(prompt), temperature:0.8 })
      });
      const js = await r.json();
      if(!r.ok){ res.status(r.status).json({ok:false,error: js?.error?.message || 'openai error'}); return; }
      const text = js?.output_text || '';
      res.status(200).json({ok:true, text});
      return;
    }

    if(p==='claude'){
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-api-key': key,
          'anthropic-version':'2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 1800,
          temperature: 0.8,
          messages:[{ role:'user', content:String(prompt) }]
        })
      });
      const js = await r.json();
      if(!r.ok){ res.status(r.status).json({ok:false,error: js?.error?.message || js?.error || 'claude error'}); return; }
      const text = (js?.content||[]).map(x=>x.text||'').join('') || '';
      res.status(200).json({ok:true, text});
      return;
    }

    res.status(400).json({ok:false,error:'provider inconnu'});
  }catch(e){
    res.status(500).json({ok:false,error:e?.message||String(e)});
  }
}
