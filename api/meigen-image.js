// MeiGen — reenvía una imagen generada desde images.meigen.ai.
// Su CDN responde 403 cuando la petición trae un Referer de otro sitio (anti-hotlinking)
// y no manda cabeceras CORS, así que el navegador no puede cargarla directo.
const { Readable } = require('stream');

const ALLOWED_HOST = 'images.meigen.ai';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  let target;
  try {
    target = new URL(req.query?.url || '');
  } catch {
    res.status(400).json({ error: 'URL inválida.' });
    return;
  }
  // Solo el CDN de MeiGen: evita que este endpoint sirva de proxy abierto.
  if (target.protocol !== 'https:' || target.hostname !== ALLOWED_HOST) {
    res.status(400).json({ error: 'Solo se permiten imágenes de MeiGen.' });
    return;
  }

  try {
    const upstream = await fetch(target.href);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `MeiGen respondió ${upstream.status} al descargar la imagen.` });
      return;
    }
    res.setHeader('content-type', upstream.headers.get('content-type') || 'image/png');
    res.setHeader('cache-control', 'private, max-age=3600');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado al descargar la imagen de MeiGen.' });
  }
};
