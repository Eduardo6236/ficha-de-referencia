// Nano Banana (gemini-3.1-flash-image) — genera una imagen a partir de un prompt
// y hasta varias imágenes de referencia, para mantener consistencia del sujeto.
const MODEL = process.env.NANO_BANANA_MODEL || 'gemini-3.1-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { prompt, referenceImages, aspectRatio, imageSize } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: 'Falta el prompt.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
    return;
  }

  const parts = [{ text: prompt }];
  for (const ref of referenceImages || []) {
    if (ref?.data && ref?.mimeType) parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }

  const imageConfig = { aspectRatio: aspectRatio || '1:1' };
  if (imageSize) imageConfig.imageSize = imageSize;

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig }
  };

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body)
      });
    } catch (err) {
      res.status(502).json({ error: err.message || 'Error de red al contactar Nano Banana.' });
      return;
    }

    if (response.status === 503 && attempt < maxAttempts) {
      const backoffMs = attempt * 4000 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, backoffMs));
      continue;
    }

    if (!response.ok) {
      const errBody = await response.text();
      res.status(response.status).json({ error: `Error de la API de Gemini: ${errBody.slice(0, 500)}` });
      return;
    }

    const data = await response.json();
    const responseParts = data?.candidates?.[0]?.content?.parts || [];
    let imageBase64 = null, mimeType = 'image/png', text;
    for (const part of responseParts) {
      if (part.inlineData?.data) { imageBase64 = part.inlineData.data; mimeType = part.inlineData.mimeType || mimeType; }
      if (part.text) text = part.text;
    }

    if (!imageBase64) {
      res.status(500).json({ error: 'La API no devolvió ninguna imagen.' });
      return;
    }

    res.status(200).json({ imageBase64, mimeType, text });
    return;
  }

  res.status(503).json({ error: 'Nano Banana respondió con alta demanda varias veces seguidas. Intenta de nuevo en unos minutos.' });
};
