export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok:false, error:'method not allowed' });
      return;
    }
    const { provider, keyOverride } = req.body || {};
    if (!provider) { res.status(400).json({ok:false, error:'missing provider'}); return; }

    const p = String(provider).toLowerCase();
    const key = (keyOverride || '').trim() || (p==='gemini' ? process.env.GEMINI_API_KEY :
              p==='openai' ? process.env.OPENAI_API_KEY :
              p==='claude' ? process.env.ANTHROPIC_API_KEY : '');

    if (!key) { res.status(400).json({ok:false, error:'aucune clé disponible (env ou saisie)'}); return; }

    if (p === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const r = await fetch(url);
      const js = await r.json();
      if (!r.ok) { res.status(r.status).json({ok:false, error: js?.error?.message || 'gemini error'}); return; }
      const models = (js.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => ({ id: m.name?.replace('models/','') || m.name, label: (m.displayName || m.name), provider:'gemini' }));
      res.status(200).json({ ok:true, models });
      return;
    }

    if (p === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      const js = await r.json();
      if (!r.ok) { res.status(r.status).json({ok:false, error: js?.error?.message || 'openai error'}); return; }
      const models = (js.data || []).map(m => ({ id: m.id, label: m.id, provider:'openai' }));
      res.status(200).json({ ok:true, models });
      return;
    }

    if (p === 'claude') {
      // Anthropic doesn't always expose list models reliably; we test a small curated list
      const candidates = [
        'claude-3-5-sonnet-latest',
        'claude-3-5-haiku-latest',
        'claude-3-opus-latest',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ];
      const okModels = [];
      for (const model of candidates) {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: 4,
            messages:[{ role:'user', content:'ping' }]
          })
        });
        if (r.ok) okModels.push({ id:model, label:model, provider:'claude' });
      }
      res.status(200).json({ ok:true, models: okModels });
      return;
    }

    res.status(400).json({ ok:false, error:'provider inconnu' });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
