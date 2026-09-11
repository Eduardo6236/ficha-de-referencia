// Fal.ai / Kling — manda a la cola un video a partir de una imagen de referencia + prompt.
// No espera a que termine: el cliente consulta el estado con fal-video-status.js.
const { fal } = require('@fal-ai/client');

const ENDPOINT_ID = process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v3/pro/image-to-video';

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

  const { prompt, imageDataUrl, durationSeconds, generateAudio } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: 'Falta el prompt.' });
    return;
  }
  if (!imageDataUrl) {
    res.status(400).json({ error: 'Falta la imagen de referencia.' });
    return;
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar FAL_KEY en Vercel.' });
    return;
  }
  fal.config({ credentials: apiKey });

  try {
    const blob = dataUrlToBlob(imageDataUrl);
    const startImageUrl = await fal.storage.upload(blob);

    const clampedDuration = durationSeconds ? Math.min(15, Math.max(3, Math.round(durationSeconds))) : undefined;

    const { request_id } = await fal.queue.submit(ENDPOINT_ID, {
      input: {
        start_image_url: startImageUrl,
        prompt,
        generate_audio: !!generateAudio,
        ...(clampedDuration ? { duration: String(clampedDuration) } : {})
      }
    });

    res.status(200).json({ requestId: request_id, endpointId: ENDPOINT_ID });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al contactar Fal.ai.' });
  }
};
