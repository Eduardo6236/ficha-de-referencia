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
    const status = await fal.queue.status(ENDPOINT_ID, { requestId, logs: false });
    res.status(200).json({ status: status.status });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al consultar el estado del video.' });
  }
};
