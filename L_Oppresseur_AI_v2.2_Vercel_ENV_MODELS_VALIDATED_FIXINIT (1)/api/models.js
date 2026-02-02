export default async function handler(req, res) {
  try {
    // CORS / preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    if (req.method !== 'GET') {
      res.status(405).json({ ok:false, error:'method not allowed' });
      return;
    }

    const provider = String((req.query && req.query.provider) || '').toLowerCase();
    if (!provider) { res.status(400).json({ ok:false, error:'missing provider' }); return; }

    if (provider === 'gemini') {
      const key = (process.env.GEMINI_API_KEY || '').trim();
      if (!key) { res.status(400).json({ ok:false, error:'missing GEMINI_API_KEY (vercel env)' }); return; }

      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const listResp = await fetch(listUrl, { method:'GET' });
      const listJson = await listResp.json().catch(()=>({}));
      if (!listResp.ok) {
        res.status(listResp.status).json({ ok:false, error: (listJson && (listJson.error?.message)) || 'gemini list models failed' });
        return;
      }

      const candidates = (listJson.models || [])
        .map(m => (m && m.name ? String(m.name).replace('models/','') : ''))
        .filter(Boolean)
        // prefer common generateContent-capable models
        .sort((a,b)=>{
          const score = (s)=> (s.includes('gemini-1.5')?10:0) + (s.includes('flash')?3:0) + (s.includes('pro')?2:0);
          return score(b)-score(a);
        });

      const usable = [];
      const maxToTest = 30;

      for (const model of candidates.slice(0, maxToTest)) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
        const body = { contents: [{ role:'user', parts:[{ text:'ping' }]}] };

        try {
          const r = await fetch(url, {
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify(body)
          });
          if (r.ok) {
            usable.push({ id: model, label: model });
          }
        } catch(e) { /* ignore */ }
      }

      res.status(200).json({ ok:true, provider:'gemini', models: usable });
      return;
    }

    if (provider === 'openai') {
      const key = (process.env.OPENAI_API_KEY || '').trim();
      if (!key) { res.status(400).json({ ok:false, error:'missing OPENAI_API_KEY (vercel env)' }); return; }

      const shortlist = [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-4.1-mini',
        'gpt-4.1'
      ];

      const usable = [];
      for (const model of shortlist) {
        try {
          const r = await fetch('https://api.openai.com/v1/responses', {
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({ model, input: 'ping', max_output_tokens: 8 })
          });
          if (r.ok) usable.push({ id:model, label:model });
        } catch(e) {}
      }

      res.status(200).json({ ok:true, provider:'openai', models: usable });
      return;
    }

    if (provider === 'claude') {
      const key = (process.env.ANTHROPIC_API_KEY || '').trim();
      if (!key) { res.status(400).json({ ok:false, error:'missing ANTHROPIC_API_KEY (vercel env)' }); return; }

      const shortlist = [
        'claude-3-5-haiku-latest',
        'claude-3-5-sonnet-latest'
      ];

      const usable = [];
      for (const model of shortlist) {
        try {
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'x-api-key': key,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model,
              max_tokens: 8,
              messages: [{ role:'user', content:'ping' }]
            })
          });
          if (r.ok) usable.push({ id:model, label:model });
        } catch(e) {}
      }

      res.status(200).json({ ok:true, provider:'claude', models: usable });
      return;
    }

    res.status(400).json({ ok:false, error:'unknown provider' });
  } catch (err) {
    res.status(500).json({ ok:false, error: err?.message || String(err) });
  }
}
