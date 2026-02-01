
// Vercel Serverless Function (Node.js)
// POST /api/generate
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed", expected: "POST" });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "missing api key",
      hint: "Add GEMINI_API_KEY (or GOOGLE_API_KEY) in Vercel Environment Variables, then redeploy."
    });
  }

  try {
    const { model, prompt } = req.body || {};
    if (!model || !prompt) {
      return res.status(400).json({ error: "missing fields", required: ["model", "prompt"] });
    }

    const safeModel = String(model).replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 2048
        }
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: "gemini api error",
        status: r.status,
        details: data
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") ||
      "";

    return res.status(200).json({ ok: true, model: safeModel, text });

  } catch (err) {
    return res.status(500).json({ error: "server error", message: err?.message || String(err) });
  }
}
