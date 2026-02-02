/**
 * /api/test-gemini.js
 * 
 * Fichier de test simple pour vérifier que ta clé Gemini fonctionne
 * 
 * Utilisation: 
 * 1. Ajoute ce fichier dans ton dossier /api
 * 2. git add api/test-gemini.js
 * 3. git commit -m "test gemini"
 * 4. git push
 * 5. Va sur: https://ton-site.vercel.app/api/test-gemini
 */

export default async function handler(req, res) {
  try {
    // 1. Vérifier que la clé existe
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY not found in Vercel environment variables',
        solution: 'Go to Vercel → Settings → Environment Variables and add GEMINI_API_KEY',
        timestamp: new Date().toISOString()
      });
    }

    // 2. Afficher info sur la clé (masquée pour sécurité)
    const keyPreview = apiKey.substring(0, 6) + '...' + apiKey.substring(apiKey.length - 4);

    // 3. Tester la clé avec un appel simple à l'API Gemini
    const testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Say "Hello World" in one sentence'
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 50
        }
      })
    });

    const data = await response.json();

    // 4. Analyser la réponse
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Gemini API returned an error',
        status: response.status,
        statusText: response.statusText,
        geminiError: data?.error?.message || 'Unknown error',
        details: data,
        possibleCauses: [
          'Invalid API key',
          'API not enabled in Google Cloud Console',
          'Quota exceeded',
          'Billing not set up'
        ],
        solutions: [
          '1. Check your API key at https://aistudio.google.com/apikey',
          '2. Enable "Generative Language API" at https://console.cloud.google.com/apis/library',
          '3. Check quotas at https://console.cloud.google.com/apis/dashboard',
          '4. Make sure you re-deployed after adding the env variable'
        ],
        timestamp: new Date().toISOString()
      });
    }

    // 5. Extraire la réponse générée
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text generated';

    // 6. Succès!
    return res.status(200).json({
      success: true,
      message: '✅ Your Gemini API key is working perfectly!',
      keyPreview: keyPreview,
      testResponse: generatedText,
      availableModels: [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp'
      ],
      nextSteps: [
        '✅ Your API key works',
        '✅ You can now use the generator',
        '✅ Go to your app and click "tester gemini"'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error during test',
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      possibleCauses: [
        'Network connection issue',
        'Vercel timeout',
        'Invalid request format'
      ],
      timestamp: new Date().toISOString()
    });
  }
}
