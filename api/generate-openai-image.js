// OpenAI (gpt-image-1) — genera una imagen, o la edita guiada por una o más
// imágenes de referencia si se envían (para mantener consistencia del sujeto).
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Imagen de referencia inválida.');
  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  return new Blob([buffer], { type: mimeType });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { prompt, referenceImages } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: 'Falta el prompt.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY en Vercel.' });
    return;
  }

  try {
    let response;
    if (referenceImages?.length) {
      const form = new FormData();
      form.append('model', MODEL);
      form.append('prompt', prompt);
      // Por defecto la fidelidad es "low" y el modelo reinterpreta la cara;
      // "high" conserva rasgos y proporciones de la referencia (no existe en -mini).
      if (!MODEL.includes('mini')) form.append('input_fidelity', 'high');
      referenceImages.forEach((dataUrl, i) => {
        const blob = dataUrlToBlob(dataUrl);
        const ext = (blob.type.split('/')[1] || 'png').split('+')[0];
        form.append('image[]', blob, `reference-${i}.${ext}`);
      });
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}` },
        body: form
      });
    } else {
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, prompt })
      });
    }

    if (!response.ok) {
      const errBody = await response.text();
      res.status(response.status).json({ error: `Error de la API de OpenAI: ${errBody.slice(0, 500)}` });
      return;
    }

    const data = await response.json();
    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) {
      res.status(500).json({ error: 'La API no devolvió ninguna imagen.' });
      return;
    }

    res.status(200).json({ imageBase64, mimeType: 'image/png' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al contactar OpenAI.' });
  }
};
