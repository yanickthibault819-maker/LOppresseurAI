export default async function handler(req, res) {
  try{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(req.method==='OPTIONS'){ res.status(204).end(); return; }

    if(req.method!=='POST'){ res.status(405).json({ok:false,error:'method not allowed'}); return; }

    const { provider, model, prompt } = req.body || {};
    if(!provider || !model || !prompt){ res.status(400).json({ok:false,error:'missing provider/model/prompt'}); return; }

    const p = String(provider).toLowerCase();
    const m = String(model).trim();
    const textPrompt = String(prompt);

    if(p==='gemini'){
      const key = (process.env.GEMINI_API_KEY||'').trim();
      if(!key){ res.status(400).json({ok:false,error:'missing GEMINI_API_KEY (vercel env)'}); return; }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
      const body = { contents: [{ role:'user', parts:[{ text: textPrompt }]}] };

      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){
        const msg = (j && (j.error?.message || j.message)) || ('gemini error '+r.status);
        res.status(r.status).json({ok:false,error:msg,raw:j}); return;
      }
      const out = j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '';
      res.status(200).json({ok:true,text:out,raw:j}); return;
    }

    if(p==='openai'){
      const key = (process.env.OPENAI_API_KEY||'').trim();
      if(!key){ res.status(400).json({ok:false,error:'missing OPENAI_API_KEY (vercel env)'}); return; }

      const r = await fetch('https://api.openai.com/v1/responses', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
        body: JSON.stringify({ model:m, input:textPrompt })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){
        const msg = (j && (j.error?.message || j.message)) || ('openai error '+r.status);
        res.status(r.status).json({ok:false,error:msg,raw:j}); return;
      }
      // Try multiple possible fields
      let out = '';
      if(typeof j.output_text === 'string') out = j.output_text;
      else if(Array.isArray(j.output)){
        out = j.output.map(o=> (o.content||[]).map(c=>c.text||'').join('')).join('');
      }
      res.status(200).json({ok:true,text:out,raw:j}); return;
    }

    if(p==='claude'){
      const key = (process.env.ANTHROPIC_API_KEY||'').trim();
      if(!key){ res.status(400).json({ok:false,error:'missing ANTHROPIC_API_KEY (vercel env)'}); return; }

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
        body: JSON.stringify({ model:m, max_tokens: 1500, messages:[{role:'user', content:textPrompt}] })
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok){
        const msg = (j && (j.error?.message || j.message)) || ('claude error '+r.status);
        res.status(r.status).json({ok:false,error:msg,raw:j}); return;
      }
      const out = (j.content||[]).map(c=>c.text||'').join('') || '';
      res.status(200).json({ok:true,text:out,raw:j}); return;
    }

    res.status(400).json({ok:false,error:'unknown provider'});
  }catch(err){
    res.status(500).json({ok:false,error:err?.message||String(err)});
  }
}
