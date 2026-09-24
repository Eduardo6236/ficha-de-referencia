// MeiGen — consulta el estado de una generación enviada con generate-meigen-image.js.
const API_BASE = 'https://www.meigen.ai/api';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { id } = req.query || {};
  if (!id || !/^[\w-]+$/.test(id)) {
    res.status(400).json({ error: 'Falta o es inválido el id de la generación.' });
    return;
  }

  const apiKey = process.env.MEIGEN_API_TOKEN;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar MEIGEN_API_TOKEN en Vercel.' });
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/generate/v2/status/${id}`, {
      headers: { authorization: `Bearer ${apiKey}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(response.status).json({ error: `Error de MeiGen: ${data.error || response.status}` });
      return;
    }
    // Sin esto el navegador puede reusar un "processing" viejo (Vercel manda ETag).
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({
      status: data.status,
      imageUrl: data.imageUrl || data.imageUrls?.[0] || null,
      error: data.error || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al consultar MeiGen.' });
  }
};
