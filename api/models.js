export default async function handler(req, res){
  try{
    const method = (req.method || 'GET').toUpperCase();
    if(method !== 'GET' && method !== 'POST'){
      res.status(405).json({ok:false, error:'method_not_allowed'}); 
      return;
    }

    const body = method === 'POST' ? (req.body || {}) : {};
    const provider = (body.provider || req.query.provider || 'gemini').toString().toLowerCase();

    if(provider !== 'gemini' && provider !== 'openai' && provider !== 'claude'){
      res.status(400).json({ok:false, error:'provider_invalide'});
      return;
    }

    if(provider === 'gemini'){
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      if(!key){
        res.status(400).json({ok:false, error:'GEMINI_API_KEY manquante (Vercel env)'}); 
        return;
      }

      // 1) list models (v1)
      let listed = [];
      try{
        const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`;
        const listRes = await fetch(listUrl, { method:'GET' });
        const listJson = await listRes.json().catch(()=>({}));
        if(listRes.ok && Array.isArray(listJson.models)){
          listed = listJson.models.map(m => ({
            full: m.name || '',
            id: (m.name || '').replace(/^models\//,''),
            display: (m.displayName || '').trim() || (m.name || '').replace(/^models\//,''),
            methods: m.supportedGenerationMethods || []
          })).filter(x => x.id);
        }
      }catch(e){
        // ignore; we'll fallback
      }

      // 2) candidate set: prefer generateContent-capable
      const preferred = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro'
      ];

      let candidates = [];
      if(listed.length){
        // keep only those supporting generateContent
        const gen = listed.filter(m => (m.methods||[]).includes('generateContent'));
        // order by preferred first then alpha
        const map = new Map(gen.map(m => [m.id, m]));
        preferred.forEach(id => { if(map.has(id)) candidates.push(map.get(id)); });
        gen.forEach(m => { if(!candidates.find(x=>x.id===m.id)) candidates.push(m); });
      }else{
        candidates = preferred.map(id => ({id, display:id}));
      }

      // 3) validate by probing generateContent; limit to avoid quota burn
      const maxProbe = 10;
      const toProbe = candidates.slice(0, maxProbe);
      const validated = [];
      for(const m of toProbe){
        const modelId = m.id;
        const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(key)}`;
        try{
          const probeRes = await fetch(url, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              contents:[{role:'user', parts:[{text:'ping'}]}],
              generationConfig:{maxOutputTokens:4, temperature:0}
            })
          });
          const probeJson = await probeRes.json().catch(()=>({}));
          if(probeRes.ok && (probeJson.candidates || probeJson.promptFeedback)){
            validated.push({ id:modelId, label:m.display || modelId });
          }else{
            // some models may return 400 if not allowed; skip
          }
        }catch(e){
          // network error; skip
        }
      }

      res.status(200).json({ok:true, provider:'gemini', models: validated});
      return;
    }

    // OpenAI/Claude placeholders: return empty list if no key set
    if(provider === 'openai'){
      const key = process.env.OPENAI_API_KEY || '';
      if(!key){ res.status(200).json({ok:true, provider:'openai', models: []}); return; }
      // keep simple: offer a safe default list (validation optional)
      res.status(200).json({ok:true, provider:'openai', models: [
        {id:'gpt-4.1-mini', label:'gpt-4.1-mini'},
        {id:'gpt-4o-mini', label:'gpt-4o-mini'}
      ]});
      return;
    }
    if(provider === 'claude'){
      const key = process.env.CLAUDE_API_KEY || '';
      if(!key){ res.status(200).json({ok:true, provider:'claude', models: []}); return; }
      res.status(200).json({ok:true, provider:'claude', models: [
        {id:'claude-3-5-sonnet-latest', label:'claude-3-5-sonnet-latest'},
        {id:'claude-3-5-haiku-latest', label:'claude-3-5-haiku-latest'}
      ]});
      return;
    }

  }catch(err){
    res.status(500).json({ok:false, error: String(err?.message || err)});
  }
}
