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

  function downloadImage(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return { exportFicha, exportLibrary, importFile, copyPromptToClipboard, downloadImage, slug };
})();
