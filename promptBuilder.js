const PromptBuilder = (() => {
  const STYLE_PRESETS = {
    'photoreal-cinematic': {
      label: 'Fotorrealista cinematográfico',
      photoreal: true,
      text: 'real-life cinematic photograph, captured with a full-frame camera and 35mm lens, film-still quality, natural skin texture with visible pores and fine imperfections, true-to-life colors, shallow depth of field, professional color grading'
    },
    'fantasy': {
      label: 'Fantasía',
      text: 'epic fantasy digital painting, dramatic atmosphere, intricate detail, painterly rendering, concept-art quality'
    },
    'pixar': {
      label: 'Animación 3D (tipo Pixar)',
      text: 'stylized 3D animated feature film look, Pixar-style character rendering, soft global illumination, expressive stylized proportions'
    },
    'anime': {
      label: 'Anime',
      text: 'anime key visual, cel-shaded, clean line art, vibrant anime color palette, studio-quality anime illustration'
    }
  };

  // Se agrega solo en estilos fotorrealistas: evita que modelos como gpt-image-1
  // o flux-kontext tiendan al look de juguete / plastilina / render 3D.
  const REALISM_GUARD =
    'This must look like an unretouched real photograph of a real person: realistic adult human anatomy, ' +
    'natural head-to-body ratio and true body proportions exactly as in the reference, real fabric and material textures, ' +
    'physically accurate lighting and shadows. Not a 3D render, not CGI, not a cartoon, not a caricature, ' +
    'not a toy, figurine, clay or plasticine model, no oversized head, no smooth plastic or waxy skin, no airbrushing.';

  const PLATFORM_NOTES = {
    'nano-banana': '',
    'fal-image': '',
    'openai-image': '',
    'meigen-image': '',
    'fal-video': 'Describe camera movement and motion explicitly (e.g. slow push-in, orbit, handheld).',
    'kling': 'Describe camera movement and motion explicitly (e.g. slow push-in, orbit, handheld).',
    'higgsfield': '',
    'veo': 'Describe camera movement and motion explicitly (e.g. slow push-in, orbit, handheld).',
    'other': ''
  };

  // Estilo por defecto: fotorrealista, salvo que la ficha pida otro explícitamente.
  function resolveStyle(ficha, styleOverride) {
    const key = styleOverride || ficha.style || 'photoreal-cinematic';
    if (key === 'custom') {
      const custom = (ficha.customStyle || '').trim();
      return custom
        ? { text: custom, photoreal: false }
        : { text: STYLE_PRESETS['photoreal-cinematic'].text, photoreal: true };
    }
    const preset = STYLE_PRESETS[key];
    if (preset) return { text: preset.text, photoreal: !!preset.photoreal };
    return { text: key, photoreal: false };
  }

  function build(ficha, { platform = 'nano-banana', styleOverride } = {}) {
    const style = resolveStyle(ficha, styleOverride);
    const d = ficha.description || {};
    const t = ficha.technical || {};
    const parts = [];

    const name = ficha.name || 'the subject';
    parts.push(
      `Use the reference image(s) as the exact identity of ${name}. Maintain exactly the same face, facial structure, ` +
      `body proportions, body build, skin tone, hairstyle, and distinctive features defined in ${name} Visual Identity Profile. ` +
      `Do not alter the apparent age.`
    );
    parts.push(`Style: ${style.text}.`);
    if (style.photoreal) parts.push(REALISM_GUARD);
    if (d.physicalTraits) parts.push(`${d.physicalTraits}.`);
    if (d.outfit) parts.push(`Wearing ${d.outfit}.`);
    if (d.distinguishingFeatures) parts.push(`${d.distinguishingFeatures}.`);
    if (t.setting) parts.push(`Setting: ${t.setting}.`);
    if (t.lighting) parts.push(`Lighting: ${t.lighting}.`);
    if (t.cameraLens) parts.push(`Camera: ${t.cameraLens}.`);
    if (t.mood) parts.push(`Mood: ${t.mood}.`);
    if (t.colorPalette) parts.push(`Color palette: ${t.colorPalette}.`);
    if (d.freeformNotes) parts.push(d.freeformNotes);
    if (ficha.tags?.length) parts.push(`Style tags: ${ficha.tags.join(', ')}.`);

    const note = PLATFORM_NOTES[platform];
    if (note) parts.push(note);

    return parts.filter(Boolean).join(' ');
  }

  return { STYLE_PRESETS, build };
})();
