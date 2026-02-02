export default async function handler(req, res){
  try{
    if(req.method !== 'POST'){
      res.status(405).json({ok:false, error:'method_not_allowed'});
      return;
    }
    const { provider='gemini', model='', prompt='' } = req.body || {};
    const prov = String(provider).toLowerCase();

    if(!prompt || !String(prompt).trim()){
      res.status(400).json({ok:false, error:'prompt_vide'});
      return;
    }

    if(prov === 'gemini'){
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      if(!key){
        res.status(400).json({ok:false, error:'GEMINI_API_KEY manquante (Vercel env)'}); 
        return;
      }
      const modelId = (model && String(model).trim()) ? String(model).trim() : 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`;
      const r = await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          contents:[{role:'user', parts:[{text: String(prompt)}]}],
          generationConfig:{temperature:0.75, topP:0.9, maxOutputTokens:1024}
        })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){
        const msg = j?.error?.message || j?.message || ('gemini_error_'+r.status);
        res.status(r.status).json({ok:false, error: msg});
        return;
      }
      const text = (j?.candidates?.[0]?.content?.parts || []).map(p=>p?.text||'').join('').trim();
      res.status(200).json({ok:true, text});
      return;
    }

    if(prov === 'openai'){
      const key = process.env.OPENAI_API_KEY || '';
      if(!key){ res.status(400).json({ok:false, error:'OPENAI_API_KEY manquante (Vercel env)'}); return; }
      // Minimal OpenAI Responses API call (best-effort)
      const m = (model && String(model).trim()) ? String(model).trim() : 'gpt-4o-mini';
      const url = 'https://api.openai.com/v1/responses';
      const r = await fetch(url, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${key}`
        },
        body: JSON.stringify({
          model: m,
          input: String(prompt)
        })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){
        res.status(r.status).json({ok:false, error: j?.error?.message || ('openai_error_'+r.status)});
        return;
      }
      // Responses API output
      const out = (j?.output || []).flatMap(o => o?.content || []).map(c => c?.text || '').join('\n').trim();
      res.status(200).json({ok:true, text: out || ''});
      return;
    }

    if(prov === 'claude'){
      const key = process.env.CLAUDE_API_KEY || '';
      if(!key){ res.status(400).json({ok:false, error:'CLAUDE_API_KEY manquante (Vercel env)'}); return; }
      const m = (model && String(model).trim()) ? String(model).trim() : 'claude-3-5-haiku-latest';
      const url = 'https://api.anthropic.com/v1/messages';
      const r = await fetch(url, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-api-key': key,
          'anthropic-version':'2023-06-01'
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 1024,
          messages: [{role:'user', content: String(prompt)}]
        })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){
        res.status(r.status).json({ok:false, error: j?.error?.message || ('claude_error_'+r.status)});
        return;
      }
      const text = (j?.content || []).map(p=>p?.text||'').join('').trim();
      res.status(200).json({ok:true, text});
      return;
    }

    res.status(400).json({ok:false, error:'provider_invalide'});
  }catch(err){
    res.status(500).json({ok:false, error:String(err?.message||err)});
  }
}
