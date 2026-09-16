const ExportImport = (() => {
  const FORMAT = 'FICHA-DE-REFERENCIA';
  const VERSION = 1;

  function slug(name) {
    return (name || 'ficha').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'ficha';
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportFicha(ficha) {
    const data = { format: FORMAT, kind: 'single', version: VERSION, exportedAt: new Date().toISOString(), ficha };
    downloadJson(data, `ficha-${slug(ficha.name)}.json`);
  }

  function exportLibrary(fichas) {
    const data = { format: FORMAT, kind: 'library', version: VERSION, exportedAt: new Date().toISOString(), fichas };
    downloadJson(data, `fichas-de-referencia-backup.json`);
  }

  function reIdFicha(ficha) {
    const now = new Date().toISOString();
    return {
      ...ficha,
      id: crypto.randomUUID(),
      updatedAt: now,
      referenceImages: (ficha.referenceImages || []).map(img => ({ ...img, id: crypto.randomUUID() })),
      promptHistory: (ficha.promptHistory || []).map(p => ({ ...p, id: crypto.randomUUID() })),
      generations: (ficha.generations || []).map(g => ({ ...g, id: crypto.randomUUID() }))
    };
  }

  async function importFile(file) {
    const raw = JSON.parse(await file.text());
    if (raw.format !== FORMAT) throw new Error('Este archivo no es una ficha de referencia compatible.');
    if (raw.kind === 'single') return [reIdFicha(raw.ficha)];
    if (raw.kind === 'library') return (raw.fichas || []).map(reIdFicha);
    throw new Error('Formato de archivo no reconocido.');
  }

  function copyPromptToClipboard(prompt) {
    return navigator.clipboard.writeText(prompt || '');
  }

  function extFromMime(mime) {
    const map = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' };
    return map[mime] || (mime || '').split('/')[1] || 'bin';
  }

  function dataUrlToBlob(dataUrl) {
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    const mime = match?.[1] || 'application/octet-stream';
    const bin = atob(match?.[2] || '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // Deja elegir dónde guardar: diálogo nativo "Guardar como" en desktop
  // (Chrome/Edge), hoja de compartir/guardar en Android. Si ninguno está
  // disponible, cae en la descarga automática de siempre.
  async function saveBlob(blob, filename) {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Archivo', accept: { [blob.type || 'application/octet-stream']: ['.' + extFromMime(blob.type)] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; }
      catch (err) { if (err?.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadImage(dataUrl, filename) {
    return saveBlob(dataUrlToBlob(dataUrl), filename);
  }

  return { exportFicha, exportLibrary, importFile, copyPromptToClipboard, downloadImage, saveBlob, slug };
})();
