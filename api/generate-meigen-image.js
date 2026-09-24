// MeiGen — manda a la cola una imagen a partir de un prompt + imágenes de referencia.
// No espera a que termine: el cliente consulta el estado con meigen-status.js.
const { randomUUID } = require('crypto');

const API_BASE = 'https://www.meigen.ai/api';
const DEFAULT_MODEL = process.env.MEIGEN_IMAGE_MODEL || 'seedream-5.0-pro';

// Solo aceptamos modelos que conocemos para no reenviar cualquier string a la API.
const ALLOWED_MODELS = new Set([
  'seedream-5.0-pro', 'gpt-image-2.5', 'gemini-3-pro-image-preview', 'nanobanana-2', 'midjourney-v8.1', 'grok-image'
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { prompt, referenceImages, modelId } = req.body || {};
  if (!prompt) {
    res.status(400).json({ error: 'Falta el prompt.' });
    return;
  }
  if (modelId && !ALLOWED_MODELS.has(modelId)) {
    res.status(400).json({ error: `Modelo de MeiGen no soportado: ${modelId}` });
    return;
  }
  const refs = Array.isArray(referenceImages) ? referenceImages : [];
  if (refs.some(r => typeof r !== 'string' || !r.startsWith('data:image/'))) {
    res.status(400).json({ error: 'Imagen de referencia inválida.' });
    return;
  }

  const apiKey = process.env.MEIGEN_API_TOKEN;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar MEIGEN_API_TOKEN en Vercel.' });
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/generate/v2`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        modelId: modelId || DEFAULT_MODEL,
        ...(refs.length ? { referenceImages: refs } : {}),
        idempotencyKey: randomUUID()
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.generationId) {
      const detail = data.code ? ` (${data.code})` : '';
      res.status(response.ok ? 500 : response.status).json({ error: `Error de MeiGen${detail}: ${data.error || 'no devolvió generationId'}` });
      return;
    }

    res.status(200).json({ generationId: data.generationId, modelId: data.modelId, creditsUsed: data.creditsUsed });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al contactar MeiGen.' });
  }
};
