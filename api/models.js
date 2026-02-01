
// Vercel Serverless Function (Node.js)
// GET /api/models
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed", expected: "GET" });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "missing api key",
      hint: "Add GEMINI_API_KEY (or GOOGLE_API_KEY) in Vercel Environment Variables, then redeploy."
    });
  }

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models";

    const r = await fetch(url, {
      method: "GET",
      headers: { "x-goog-api-key": apiKey }
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: "gemini api error",
        status: r.status,
        details: data
      });
    }

    const models = (data.models || [])
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
      .map(m => ({
        name: (m.name || "").replace(/^models\//, ""),
        displayName: m.displayName || "",
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit
      }));

    return res.status(200).json({ ok: true, models });

  } catch (err) {
    return res.status(500).json({ error: "server error", message: err?.message || String(err) });
  }
}
