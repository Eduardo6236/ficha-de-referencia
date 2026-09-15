(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

const descFields = [
  ['physicalTraits', 'Rasgos físicos', 'area'],
  ['outfit', 'Vestuario / outfit', 'area'],
  ['distinguishingFeatures', 'Rasgos distintivos', 'area'],
  ['freeformNotes', 'Notas libres', 'area']
];
const techFields = [
  ['lighting', 'Iluminación'],
  ['cameraLens', 'Cámara / lente'],
  ['mood', 'Mood / atmósfera'],
  ['colorPalette', 'Paleta de color'],
  ['setting', 'Escenario / entorno']
];

const state = { fichas: [], fichaId: null, tab: 'ficha', availableTags: [] };

const DEFAULT_TAGS = [
  'cinematic', 'photorealistic', 'anime', 'fantasy', '8k detail', 'film grain',
  'shallow depth of field', 'moody atmosphere', 'volumetric light', 'concept art',
  'epic scale', 'studio lighting', 'golden hour', 'high contrast'
];

function emptyFicha() {
  const t = now();
  return {
    id: uid(), createdAt: t, updatedAt: t, name: 'Nueva ficha', locked: false,
    referenceImages: [],
    description: { physicalTraits: '', outfit: '', distinguishingFeatures: '', freeformNotes: '' },
    style: 'photoreal-cinematic', customStyle: '',
    technical: { lighting: '', cameraLens: '', mood: '', colorPalette: '', setting: '' },
    tags: [],
    promptHistory: [],
    generations: []
  };
}

function ficha() { return state.fichas.find(f => f.id === state.fichaId); }

async function persist(f) {
  f.updatedAt = now();
  await DB.put('fichas', f);
  await refresh();
}

async function load() {
  state.fichas = await DB.all('fichas');
  state.availableTags = await DB.all('tags');
  if (!state.availableTags.length) {
    for (const label of DEFAULT_TAGS) await DB.put('tags', { id: uid(), label });
    state.availableTags = await DB.all('tags');
  }
  renderAll();
}
async function refresh() {
  state.fichas = await DB.all('fichas');
  state.availableTags = await DB.all('tags');
  renderAll();
}

function styleLabel(f) {
  if (f.style === 'custom') return f.customStyle || 'Personalizado';
  return PromptBuilder.STYLE_PRESETS[f.style]?.label || f.style || 'Sin estilo';
}

function renderAll() { renderFichaList(); renderWorkspace(); }

function renderFichaList() {
  const q = $('#fichaSearch').value?.toLowerCase() || '';
  const list = state.fichas.filter(f => f.name.toLowerCase().includes(q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  $('#fichaList').innerHTML = list.map(f => {
    const img = f.referenceImages.find(r => r.isPrimary) || f.referenceImages[0];
    return `<div class="ficha-card ${f.id === state.fichaId ? 'active' : ''}" data-ficha="${f.id}">
      ${img ? `<img src="${img.dataUrl}">` : `<div style="width:40px;height:40px;border-radius:6px;background:var(--panel2);flex:none"></div>`}
      <div class="meta"><b>${esc(f.name)}</b><small>${esc(styleLabel(f))}${f.locked ? ' · <span class="lock-badge">bloqueada</span>' : ''}</small></div>
    </div>`;
  }).join('') || '<p style="color:var(--muted)">Sin fichas aún</p>';
  $$('[data-ficha]').forEach(el => el.onclick = () => { state.fichaId = el.dataset.ficha; state.tab = 'ficha'; renderAll(); });
}

function renderWorkspace() {
  const f = ficha();
  if (!f) {
    $('#workspace').innerHTML = `<div class="empty"><h1>Ficha de Referencia</h1><p>Crea o selecciona una ficha para comenzar.</p></div>`;
    return;
  }
  $('#workspace').innerHTML = `
    <div class="hero">
      <div>
        <h1>${esc(f.name)}${f.locked ? ' <span class="lock-badge">🔒 Bloqueada</span>' : ''}</h1>
        <p>${esc(styleLabel(f))} · ${f.referenceImages.length} imagen(es) de referencia</p>
      </div>
      <div class="toolbar">
        <button data-action="toggle-lock">${f.locked ? 'Desbloquear' : 'Bloquear'}</button>
        <button class="danger" data-action="delete-ficha">Eliminar ficha</button>
      </div>
    </div>
    <nav class="tabs">${[['ficha', 'Ficha'], ['imagenes', 'Imágenes'], ['generar', 'Generar'], ['exportar', 'Exportar']].map(([id, label]) => `<button class="${state.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</nav>
    <div id="tabBody"></div>
  `;
  renderTab();
  bindWorkspaceGlobal();
}

function renderTab() {
  const f = ficha();
  const body = $('#tabBody');
  if (state.tab === 'ficha') body.innerHTML = tabFicha(f);
  if (state.tab === 'imagenes') body.innerHTML = tabImagenes(f);
  if (state.tab === 'generar') body.innerHTML = tabGenerar(f);
  if (state.tab === 'exportar') body.innerHTML = tabExportar(f);
  bindTab();
}

function bindWorkspaceGlobal() {
  $$('[data-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; renderWorkspace(); });
  document.querySelector('[data-action="toggle-lock"]').onclick = async () => {
    const f = ficha();
    f.locked = !f.locked;
    await persist(f);
    toast(f.locked ? 'Ficha bloqueada' : 'Ficha desbloqueada');
  };
  document.querySelector('[data-action="delete-ficha"]').onclick = async () => {
    const f = ficha();
    if (!confirm(`¿Eliminar la ficha "${f.name}"? Esta acción no se puede deshacer.`)) return;
    await DB.del('fichas', f.id);
    state.fichaId = null;
    await refresh();
    toast('Ficha eliminada');
  };
}

function bindTab() {
  const f = ficha();
  if (state.tab === 'ficha') bindFichaTab(f);
  if (state.tab === 'imagenes') bindImagenesTab(f);
  if (state.tab === 'generar') bindGenerarTab(f);
  if (state.tab === 'exportar') bindExportarTab(f);
}

// ---- Tab: Ficha ----
function tabFicha(f) {
  return `<form id="fichaForm">
    <div class="card">
      <h2>Datos básicos</h2>
      <div class="form-grid">
        <label class="field"><span>Nombre</span><input name="name" value="${esc(f.name)}" required></label>
        <label class="field"><span>Estilo</span><select name="style">${Object.entries(PromptBuilder.STYLE_PRESETS).map(([k, v]) => `<option value="${k}" ${f.style === k ? 'selected' : ''}>${v.label}</option>`).join('')}<option value="custom" ${f.style === 'custom' ? 'selected' : ''}>Personalizado...</option></select></label>
        ${f.style === 'custom' ? `<label class="field full"><span>Descripción de estilo personalizado</span><input name="customStyle" value="${esc(f.customStyle || '')}"></label>` : ''}
        <div class="field full">
          <span>Tags</span>
          <div class="tag-picker" id="tagPicker"></div>
          <div class="tag-add-row">
            <input id="newTagInput" placeholder="Agregar tag nuevo...">
            <button type="button" id="addTagBtn">+ Agregar</button>
          </div>
          <input type="hidden" name="tags" id="tagsHidden" value="${esc((f.tags || []).join(','))}">
        </div>
      </div>
    </div>
    <div class="card">
      <h2>Descripción</h2>
      <div class="form-grid">
        ${descFields.map(([k, label, type]) => `<label class="field ${type ? 'full' : ''}"><span>${label}</span><textarea name="desc_${k}">${esc(f.description?.[k] || '')}</textarea></label>`).join('')}
      </div>
    </div>
    <div class="card">
      <h2>Detalles técnicos</h2>
      <div class="form-grid">
        ${techFields.map(([k, label]) => `<label class="field"><span>${label}</span><input name="tech_${k}" value="${esc(f.technical?.[k] || '')}"></label>`).join('')}
      </div>
    </div>
    <div class="toolbar"><button type="submit" class="primary">Guardar cambios</button></div>
  </form>`;
}

function bindTagPicker() {
  const hidden = $('#tagsHidden');
  const getSelected = () => new Set((hidden.value || '').split(',').map(s => s.trim()).filter(Boolean));
  function renderChips() {
    const selected = getSelected();
    $('#tagPicker').innerHTML = state.availableTags.map(t =>
      `<button type="button" class="tag-chip ${selected.has(t.label) ? 'selected' : ''}" data-tag="${esc(t.label)}">${esc(t.label)}</button>`
    ).join('') || '<span style="color:var(--muted);font-size:12px">Sin tags todavía, agrega el primero abajo</span>';
    $$('.tag-chip').forEach(chip => chip.onclick = () => {
      const sel = getSelected();
      const tag = chip.dataset.tag;
      if (sel.has(tag)) sel.delete(tag); else sel.add(tag);
      hidden.value = [...sel].join(',');
      renderChips();
    });
  }
  renderChips();
  $('#addTagBtn').onclick = async () => {
    const input = $('#newTagInput');
    const label = input.value.trim();
    if (!label) return;
    if (!state.availableTags.some(t => t.label.toLowerCase() === label.toLowerCase())) {
      await DB.put('tags', { id: uid(), label });
      state.availableTags = await DB.all('tags');
    }
    const sel = getSelected();
    sel.add(label);
    hidden.value = [...sel].join(',');
    input.value = '';
    renderChips();
  };
}

function bindFichaTab(f) {
  const form = $('#fichaForm');
  bindTagPicker();
  const styleSelect = form.querySelector('[name=style]');
  styleSelect.onchange = () => {
    const existing = form.querySelector('[name=customStyle]');
    if (styleSelect.value === 'custom' && !existing) {
      const label = document.createElement('label');
      label.className = 'field full';
      label.innerHTML = `<span>Descripción de estilo personalizado</span><input name="customStyle" value="">`;
      styleSelect.closest('.form-grid').appendChild(label);
    } else if (styleSelect.value !== 'custom' && existing) {
      existing.closest('label').remove();
    }
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    f.name = fd.get('name') || 'Sin nombre';
    f.style = fd.get('style');
    f.customStyle = fd.get('customStyle') || '';
    f.tags = (fd.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean);
    f.description = {
      physicalTraits: fd.get('desc_physicalTraits') || '', outfit: fd.get('desc_outfit') || '',
      distinguishingFeatures: fd.get('desc_distinguishingFeatures') || '', freeformNotes: fd.get('desc_freeformNotes') || ''
    };
    f.technical = {
      lighting: fd.get('tech_lighting') || '', cameraLens: fd.get('tech_cameraLens') || '', mood: fd.get('tech_mood') || '',
      colorPalette: fd.get('tech_colorPalette') || '', setting: fd.get('tech_setting') || ''
    };
    await persist(f);
    toast('Ficha guardada');
  };
}

// ---- Tab: Imágenes ----
function tabImagenes(f) {
  return `
    <div class="card">
      <h2>Imágenes de referencia</h2>
      <label class="dropzone" id="dropzone"><input type="file" id="imgInput" accept="image/*" multiple>Arrastra imágenes aquí o haz clic para subir</label>
      <div class="images">${f.referenceImages.map(img => `
        <div class="imgcard">
          ${img.isPrimary ? '<span class="primary-badge">Principal</span>' : ''}
          <img src="${img.dataUrl}">
          <div class="body">
            <input data-note="${img.id}" value="${esc(img.note || '')}" placeholder="Nota (opcional)">
            <div class="row">
              <button data-primary="${img.id}" ${img.isPrimary ? 'disabled' : ''}>Marcar principal</button>
              <button class="danger" data-delimg="${img.id}">Eliminar</button>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Las APIs de generación viajan como JSON con la imagen en base64, y Vercel
// rechaza requests de más de ~4.5MB (Error 413) — fotos de celular sin
// redimensionar lo superan fácil. Bajamos a un tamaño razonable antes de
// guardar Y de nuevo justo antes de enviar (por si la imagen ya estaba
// guardada de antes de este fix, o vino de una ficha importada).
const MAX_REFERENCE_DIMENSION = 1600;
const REFERENCE_JPEG_QUALITY = 0.85;
const MAX_REFERENCE_BYTES = 1_200_000;

function resizeDataUrl(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_REFERENCE_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', REFERENCE_JPEG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ensureSendableDataUrl(dataUrl) {
  if (dataUrl.startsWith('data:image/svg+xml') || dataUrl.length * 0.75 < MAX_REFERENCE_BYTES) return Promise.resolve(dataUrl);
  return resizeDataUrl(dataUrl);
}

async function fileToDataUrl(file) {
  return ensureSendableDataUrl(await readAsDataUrl(file));
}

async function importImages(files) {
  const f = ficha();
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    f.referenceImages.push({ id: uid(), dataUrl, note: '', isPrimary: f.referenceImages.length === 0 });
  }
  await persist(f);
  toast('Imágenes agregadas');
}

function bindImagenesTab(f) {
  const dz = $('#dropzone');
  $('#imgInput').onchange = e => importImages([...e.target.files]);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag');
    importImages([...e.dataTransfer.files].filter(file => file.type.startsWith('image/')));
  });
  $$('[data-note]').forEach(inp => inp.onchange = async () => {
    const img = f.referenceImages.find(x => x.id === inp.dataset.note);
    if (img) { img.note = inp.value; await persist(f); }
  });
  $$('[data-primary]').forEach(btn => btn.onclick = async () => {
    f.referenceImages.forEach(img => img.isPrimary = (img.id === btn.dataset.primary));
    await persist(f);
  });
  $$('[data-delimg]').forEach(btn => btn.onclick = async () => {
    f.referenceImages = f.referenceImages.filter(x => x.id !== btn.dataset.delimg);
    if (!f.referenceImages.some(x => x.isPrimary) && f.referenceImages.length) f.referenceImages[0].isPrimary = true;
    await persist(f);
  });
}

// ---- Tab: Generar ----
function latestPromptFor(f, platform) {
  const items = (f.promptHistory || []).filter(p => p.platform === platform);
  return items.length ? items[items.length - 1].prompt : null;
}

function genCard(g) {
  const statusClass = g.status === 'working' ? 'working' : g.status === 'error' ? 'error' : 'done';
  const statusLabel = g.status === 'working' ? 'Generando…' : g.status === 'error' ? 'Error' : 'Listo';
  let media;
  if (g.status === 'done') {
    media = g.kind === 'video' ? `<video src="${g.resultUrl}" controls></video>` : `<img src="${g.resultUrl}">`;
  } else if (g.status === 'error') {
    media = `<div style="height:140px;display:flex;align-items:center;justify-content:center;color:var(--danger);padding:10px;text-align:center;font-size:12px">${esc(g.error || 'Error')}</div>`;
  } else {
    media = `<div style="height:140px;display:flex;align-items:center;justify-content:center;color:var(--muted)">Generando…</div>`;
  }
  return `<div class="gen-card">
    ${media}
    <div class="body">
      <span class="status-pill ${statusClass}">${statusLabel}</span>
      <small>${esc(g.provider)} · ${new Date(g.createdAt).toLocaleString()}</small>
      <div class="row">
        ${g.status === 'done' && g.kind === 'image' ? `<button data-use-ref="${g.id}">Usar como referencia</button>` : ''}
        ${g.status === 'done' ? `<button data-download-gen="${g.id}">Descargar</button>` : ''}
        <button class="danger" data-delete-gen="${g.id}">Eliminar</button>
      </div>
    </div>
  </div>`;
}

function tabGenerar(f) {
  const initialPrompt = latestPromptFor(f, 'nano-banana') || PromptBuilder.build(f, { platform: 'nano-banana' });
  const noRefs = !f.referenceImages.length;
  return `
    <div class="card promptbox">
      <h2>Prompt</h2>
      <div class="form-grid">
        <label class="field"><span>Plantilla para plataforma</span><select id="promptPlatform">
          ${[['nano-banana', 'Nano Banana'], ['fal-image', 'Fal.ai (imagen)'], ['fal-video', 'Fal.ai / Kling (video)'], ['higgsfield', 'Higgsfield'], ['veo', 'Veo'], ['other', 'Otra plataforma']].map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
        </select></label>
        <div class="field" style="align-self:end"><button type="button" id="regenPrompt">↻ Regenerar sugerencia</button></div>
      </div>
      <label class="field full"><span>Prompt (editable)</span><textarea id="promptText">${esc(initialPrompt)}</textarea></label>
    </div>

    <div class="card">
      <h2>Generar imagen / video</h2>
      ${f.locked ? '<p style="color:var(--muted)">Ficha bloqueada — desbloquéala para generar nuevas imágenes.</p>' : ''}
      ${noRefs ? '<p style="color:var(--muted)">Agrega al menos una imagen de referencia en la pestaña "Imágenes" antes de generar.</p>' : ''}
      <div class="gen-providers">
        <button class="provider-btn" data-generate="nano-banana" ${f.locked || noRefs ? 'disabled' : ''}><b>Nano Banana</b><small>Imagen · Gemini</small></button>
        <button class="provider-btn" data-generate="fal-image" ${f.locked || noRefs ? 'disabled' : ''}><b>Fal.ai</b><small>Imagen</small></button>
        <div class="provider-btn" style="gap:8px">
          <b>Fal.ai / Kling</b><small>Video desde imagen</small>
          <label class="field" style="margin-top:4px"><span>Duración (seg)</span><input id="videoDuration" type="number" min="3" max="15" value="5" style="width:70px"></label>
          <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)"><input id="videoAudio" type="checkbox"> Generar audio</label>
          <button data-generate="fal-video" ${f.locked || noRefs ? 'disabled' : ''}>Generar video</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Resultados</h2>
      <div class="generations">${(f.generations || []).slice().reverse().map(genCard).join('') || '<p style="color:var(--muted)">Sin generaciones todavía</p>'}</div>
    </div>
  `;
}

function bindGenerarTab(f) {
  $('#regenPrompt').onclick = () => {
    const platform = $('#promptPlatform').value;
    $('#promptText').value = PromptBuilder.build(f, { platform });
  };
  $$('[data-generate]').forEach(btn => btn.onclick = () => startGeneration(f, btn.dataset.generate));
  $$('[data-use-ref]').forEach(btn => btn.onclick = () => useGenerationAsReference(f, btn.dataset.useRef));
  $$('[data-download-gen]').forEach(btn => btn.onclick = () => downloadGeneration(f, btn.dataset.downloadGen));
  $$('[data-delete-gen]').forEach(btn => btn.onclick = async () => {
    f.generations = f.generations.filter(x => x.id !== btn.dataset.deleteGen);
    await persist(f);
  });
}

async function callApi(path, opts) {
  const res = await fetch(path, opts);
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (res.status === 413) throw new Error('La imagen de referencia es demasiado grande para enviarla. Eliminala y volvé a subirla.');
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
function mimeFromDataUrl(dataUrl) { return (dataUrl.match(/^data:(.*?);base64,/) || [])[1] || 'image/png'; }
function base64FromDataUrl(dataUrl) { return dataUrl.split(',')[1] || ''; }

async function apiNanoBanana(f, prompt) {
  const referenceImages = await Promise.all(f.referenceImages.map(async r => {
    const dataUrl = await ensureSendableDataUrl(r.dataUrl);
    return { data: base64FromDataUrl(dataUrl), mimeType: mimeFromDataUrl(dataUrl) };
  }));
  const data = await callApi('/api/generate-image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, referenceImages }) });
  return `data:${data.mimeType};base64,${data.imageBase64}`;
}
async function apiFalImage(f, prompt) {
  const primary = f.referenceImages.find(r => r.isPrimary) || f.referenceImages[0];
  const imageDataUrl = primary && await ensureSendableDataUrl(primary.dataUrl);
  const data = await callApi('/api/generate-fal-image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, imageDataUrl }) });
  return toLocalDataUrl(data.imageUrl);
}
async function apiFalVideoSubmit(f, prompt, durationSeconds, generateAudio) {
  const primary = f.referenceImages.find(r => r.isPrimary) || f.referenceImages[0];
  const imageDataUrl = primary && await ensureSendableDataUrl(primary.dataUrl);
  const data = await callApi('/api/generate-fal-video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, imageDataUrl, durationSeconds, generateAudio }) });
  return data.requestId;
}

async function finishGeneration(fichaId, genId, patch) {
  const fresh = await DB.get('fichas', fichaId);
  if (!fresh) return;
  const g = fresh.generations.find(x => x.id === genId);
  if (!g) return;
  Object.assign(g, patch);
  fresh.updatedAt = now();
  await DB.put('fichas', fresh);
  if (state.fichaId === fichaId) await refresh();
}

async function pollFalVideo(fichaId, genId, requestId) {
  try {
    const statusData = await callApi(`/api/fal-video-status?requestId=${encodeURIComponent(requestId)}`);
    if (statusData.status === 'COMPLETED') {
      const resultData = await callApi(`/api/fal-video-result?requestId=${encodeURIComponent(requestId)}`);
      const resultUrl = await toLocalDataUrl(resultData.videoUrl);
      await finishGeneration(fichaId, genId, { status: 'done', resultUrl });
      return;
    }
    if (statusData.status === 'ERROR') {
      await finishGeneration(fichaId, genId, { status: 'error', error: 'La generación de video falló en Fal.ai.' });
      return;
    }
    setTimeout(() => pollFalVideo(fichaId, genId, requestId), 5000);
  } catch (err) {
    await finishGeneration(fichaId, genId, { status: 'error', error: err.message });
  }
}

async function startGeneration(f, provider) {
  const prompt = $('#promptText').value.trim();
  if (!prompt) return toast('Escribe un prompt primero');
  const platformTag = provider === 'fal-video' ? 'fal-video' : provider;
  f.promptHistory.push({ id: uid(), platform: platformTag, prompt, createdAt: now() });
  const gen = { id: uid(), provider, prompt, kind: provider === 'fal-video' ? 'video' : 'image', status: 'working', createdAt: now() };
  f.generations.push(gen);
  await persist(f);

  const fichaId = f.id, genId = gen.id;
  try {
    if (provider === 'nano-banana') {
      const resultUrl = await apiNanoBanana(f, prompt);
      await finishGeneration(fichaId, genId, { status: 'done', resultUrl });
    } else if (provider === 'fal-image') {
      const resultUrl = await apiFalImage(f, prompt);
      await finishGeneration(fichaId, genId, { status: 'done', resultUrl });
    } else if (provider === 'fal-video') {
      const duration = +($('#videoDuration')?.value || 5);
      const audio = !!$('#videoAudio')?.checked;
      const requestId = await apiFalVideoSubmit(f, prompt, duration, audio);
      await finishGeneration(fichaId, genId, { requestId });
      pollFalVideo(fichaId, genId, requestId);
    }
  } catch (err) {
    await finishGeneration(fichaId, genId, { status: 'error', error: err.message });
  }
}

async function urlToDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Fal.ai devuelve URLs remotas (expiran y no cachean bien offline); las
// bajamos como data URL apenas terminan para que queden disponibles sin conexión.
async function toLocalDataUrl(url) {
  try { return await urlToDataUrl(url); }
  catch { return url; }
}

async function useGenerationAsReference(f, genId) {
  const g = f.generations.find(x => x.id === genId);
  if (!g || g.kind !== 'image') return;
  let dataUrl = g.resultUrl;
  if (!dataUrl.startsWith('data:')) {
    try { dataUrl = await urlToDataUrl(dataUrl); }
    catch { return toast('No se pudo descargar la imagen generada'); }
  }
  f.referenceImages.push({ id: uid(), dataUrl, note: `Generada: ${g.provider}`, isPrimary: false });
  await persist(f);
  toast('Imagen añadida como referencia');
}

async function downloadGeneration(f, genId) {
  const g = f.generations.find(x => x.id === genId);
  if (!g) return;
  const ext = g.kind === 'video' ? 'mp4' : 'png';
  const filename = `${ExportImport.slug(f.name)}-${g.provider}.${ext}`;
  if (g.resultUrl.startsWith('data:')) {
    ExportImport.downloadImage(g.resultUrl, filename);
    return;
  }
  try {
    const res = await fetch(g.resultUrl);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(g.resultUrl, '_blank');
  }
}

// ---- Tab: Exportar ----
function tabExportar(f) {
  const grouped = {};
  (f.promptHistory || []).slice().reverse().forEach(p => { (grouped[p.platform] ||= []).push(p); });
  return `
    <div class="card">
      <h2>Exportar / mover esta ficha</h2>
      <p style="color:var(--muted)">Descarga esta ficha (datos + imágenes) como archivo para reimportarla en otro dispositivo o navegador.</p>
      <div class="toolbar"><button class="primary" data-action="export-ficha">Descargar ficha (.json)</button></div>
    </div>
    <div class="card">
      <h2>Usar en otras plataformas</h2>
      <p style="color:var(--muted)">Para plataformas sin integración directa (Higgsfield, Veo, Kling web, etc.), copia el prompt y descarga las imágenes de referencia para subirlas manualmente.</p>
      <div class="toolbar">
        <button data-action="copy-current-prompt">Copiar último prompt</button>
        <button data-action="download-all-refs" ${f.referenceImages.length ? '' : 'disabled'}>Descargar imágenes de referencia</button>
      </div>
      ${Object.keys(grouped).length ? `<h3 style="margin-top:18px">Historial de prompts por plataforma</h3><div class="export-list">${Object.entries(grouped).map(([platform, items]) => items.slice(0, 5).map(p => `
        <div class="row"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">[${esc(platform)}] ${esc(p.prompt)}</span><button data-copy-prompt="${p.id}">Copiar</button></div>
      `).join('')).join('')}</div>` : ''}
    </div>
  `;
}

function bindExportarTab(f) {
  document.querySelector('[data-action="export-ficha"]').onclick = () => ExportImport.exportFicha(f);
  document.querySelector('[data-action="copy-current-prompt"]').onclick = async () => {
    const last = f.promptHistory[f.promptHistory.length - 1];
    const text = last?.prompt || PromptBuilder.build(f, { platform: 'nano-banana' });
    await ExportImport.copyPromptToClipboard(text);
    toast('Prompt copiado');
  };
  const dlAll = document.querySelector('[data-action="download-all-refs"]');
  if (dlAll) dlAll.onclick = () => f.referenceImages.forEach((img, i) => ExportImport.downloadImage(img.dataUrl, `${ExportImport.slug(f.name)}-ref-${i + 1}.png`));
  $$('[data-copy-prompt]').forEach(btn => btn.onclick = async () => {
    const p = f.promptHistory.find(x => x.id === btn.dataset.copyPrompt);
    if (p) { await ExportImport.copyPromptToClipboard(p.prompt); toast('Prompt copiado'); }
  });
}

// ---- Global wiring ----
$('#fichaSearch').oninput = renderFichaList;
$('#newFichaBtn').onclick = async () => {
  const f = emptyFicha();
  await DB.put('fichas', f);
  state.fichaId = f.id;
  state.tab = 'ficha';
  await refresh();
};
$('#exportLibraryBtn').onclick = () => {
  if (!state.fichas.length) return toast('No hay fichas para exportar');
  ExportImport.exportLibrary(state.fichas);
};
$('#importLibraryInput').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = await ExportImport.importFile(file);
    for (const f of imported) await DB.put('fichas', f);
    state.fichaId = imported[0]?.id || state.fichaId;
    await refresh();
    toast(`${imported.length} ficha(s) importada(s)`);
  } catch (err) { toast(err.message); }
  e.target.value = '';
};

let installPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#installBtn').hidden = false; });
$('#installBtn').onclick = async () => { await installPrompt?.prompt(); $('#installBtn').hidden = true; };
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));

load().catch(err => {
  console.error(err);
  $('#workspace').innerHTML = `<div class="empty"><h1>Error de almacenamiento</h1><p>${esc(err.message)}</p></div>`;
});
})();
