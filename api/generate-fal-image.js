// Fal.ai — genera una imagen a partir de un prompt + una imagen de referencia
// (edición/variación guiada por imagen, ej. flux-pro/kontext).
const { fal } = require('@fal-ai/client');

const ENDPOINT_ID = process.env.FAL_IMAGE_MODEL || 'fal-ai/flux-pro/kontext';

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

  const { prompt, imageDataUrl } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: 'Falta el prompt.' });
    return;
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar FAL_KEY en Vercel.' });
    return;
  }
  fal.config({ credentials: apiKey });

  try {
    const input = { prompt };
    if (imageDataUrl) {
      const blob = dataUrlToBlob(imageDataUrl);
      input.image_url = await fal.storage.upload(blob);
    }

    const result = await fal.subscribe(ENDPOINT_ID, { input, logs: false });
    const imageUrl = result?.data?.images?.[0]?.url || result?.data?.image?.url;
    if (!imageUrl) {
      res.status(500).json({ error: 'Fal.ai no devolvió ninguna imagen.' });
      return;
    }
    res.status(200).json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al contactar Fal.ai.' });
  }
};
