const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

async function listGeminiModels(apiKey, validate) {
  const result = { ok: true, models: [], validated: [] };

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(listUrl);
  const j = await safeJson(r);

  if (!r.ok) {
    return { ok: false, error: (j && (j.error?.message || j.message)) || `gemini list http ${r.status}` };
  }

  const models = Array.isArray(j?.models) ? j.models : [];
  const filtered = models
    .filter(m => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map(m => (m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

  result.models = filtered;

  if (!validate) return result;

  // Validate by making a tiny generateContent call. Cap to avoid long runs.
  const cap = Math.min(filtered.length, 20);
  for (let i = 0; i < cap; i++) {
    const id = filtered[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload = { contents: [{ parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 4, temperature: 0 } };
    try {
      const rr = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const jj = await safeJson(rr);
      if (rr.ok && jj) result.validated.push(id);
    } catch {}
    await sleep(80);
  }

  return result;
}

async function listOpenAIModels(apiKey, validate) {
  const result = { ok: true, models: [], validated: [] };

  // List
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { "authorization": `Bearer ${apiKey}` }
  });
  const j = await safeJson(r);
  if (!r.ok) {
    return { ok: false, error: (j && (j.error?.message || j.message)) || `openai list http ${r.status}` };
  }

  const data = Array.isArray(j?.data) ? j.data : [];
  // Keep only chat/reasoning models most likely to work
  const filtered = data
    .map(m => m?.id)
    .filter(id => typeof id === "string")
    .filter(id => /^(gpt|o\d)/.test(id));

  // Some accounts see a lot; cap what we expose (UI can still validate to narrow)
  result.models = filtered.slice(0, 40);

  if (!validate) return result;

  const cap = Math.min(result.models.length, 12);
  for (let i = 0; i < cap; i++) {
    const id = result.models[i];
    try {
      const rr = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: id,
          input: "ping",
          max_output_tokens: 4
        })
      });
      const jj = await safeJson(rr);
      if (rr.ok && jj) result.validated.push(id);
    } catch {}
    await sleep(100);
  }

  return result;
}

async function listAnthropicModels(apiKey, validate) {
  const result = { ok: true, models: [], validated: [] };

  // Anthropic doesn't consistently expose a simple public list; use a curated set.
  const candidates = [
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-opus-latest",
    "claude-3-sonnet-latest",
    "claude-3-haiku-latest"
  ];
  result.models = candidates;

  if (!validate) return result;

  const cap = candidates.length;
  for (let i = 0; i < cap; i++) {
    const id = candidates[i];
    try {
      const rr = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: id,
          max_tokens: 4,
          messages: [{ role: "user", content: "ping" }]
        })
      });
      const jj = await safeJson(rr);
      if (rr.ok && jj) result.validated.push(id);
    } catch {}
    await sleep(120);
  }

  return result;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }

  const validate = String(req.query?.validate || "") === "1";

  const providers = {
    gemini: { available: !!process.env.GEMINI_API_KEY },
    openai: { available: !!process.env.OPENAI_API_KEY },
    claude: { available: !!process.env.ANTHROPIC_API_KEY }
  };

  const byProvider = {};
  const merged = [];

  // GEMINI
  if (providers.gemini.available) {
    const r = await listGeminiModels(process.env.GEMINI_API_KEY, validate);
    providers.gemini = { ...providers.gemini, ...r };
    byProvider.gemini = (validate ? r.validated : r.models) || [];
  } else {
    byProvider.gemini = [];
  }

  // OPENAI
  if (providers.openai.available) {
    const r = await listOpenAIModels(process.env.OPENAI_API_KEY, validate);
    providers.openai = { ...providers.openai, ...r };
    byProvider.openai = (validate ? r.validated : r.models) || [];
  } else {
    byProvider.openai = [];
  }

  // CLAUDE
  if (providers.claude.available) {
    const r = await listAnthropicModels(process.env.ANTHROPIC_API_KEY, validate);
    providers.claude = { ...providers.claude, ...r };
    byProvider.claude = (validate ? r.validated : r.models) || [];
  } else {
    byProvider.claude = [];
  }

  // Build merged list (prefer validated if asked)
  Object.entries(byProvider).forEach(([provider, ids]) => {
    ids.forEach((id) => merged.push({ provider, id }));
  });

  res.status(200).json({
    ok: true,
    validate,
    providers,
    byProvider,
    merged
  });
}
