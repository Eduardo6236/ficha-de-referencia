const { fal } = require('@fal-ai/client');

const ENDPOINT_ID = process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v3/pro/image-to-video';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { requestId } = req.query || {};
  if (!requestId) {
    res.status(400).json({ error: 'Falta el requestId.' });
    return;
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar FAL_KEY en Vercel.' });
    return;
  }
  fal.config({ credentials: apiKey });

  try {
    const result = await fal.queue.result(ENDPOINT_ID, { requestId });
    const videoUrl = result?.data?.video?.url;
    if (!videoUrl) {
      res.status(500).json({ error: 'El resultado de Fal.ai no incluyó un video.' });
      return;
    }
    res.status(200).json({ videoUrl });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al obtener el resultado del video.' });
  }
};
