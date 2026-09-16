const PromptBuilder = (() => {
  const STYLE_PRESETS = {
    'photoreal-cinematic': {
      label: 'Fotorrealista cinematográfico',
      text: 'ultra-realistic cinematic photography, film-still quality, natural skin texture and pores, shot on 35mm lens, shallow depth of field, professional color grading'
    },
    'fantasy': {
      label: 'Fantasía',
      text: 'epic fantasy digital painting, dramatic atmosphere, intricate detail, painterly rendering, concept-art quality'
    },
    'anime': {
      label: 'Anime',
      text: 'anime key visual, cel-shaded, clean line art, vibrant anime color palette, studio-quality anime illustration'
    }
  };

  const PLATFORM_NOTES = {
    'nano-banana': '',
    'fal-image': '',
    'openai-image': '',
    'fal-video': 'Describe camera movement and motion explicitly (e.g. slow push-in, orbit, handheld).',
    'kling': 'Describe camera movement and motion explicitly (e.g. slow push-in, orbit, handheld).',
    'higgsfield': '',
    'veo': 'Describe camera movement and motion explicitly (e.g. slow push-in, orbit, handheld).',
    'other': ''
  };

  function styleText(style) {
    if (STYLE_PRESETS[style]) return STYLE_PRESETS[style].text;
    return style || '';
  }

  function build(ficha, { platform = 'nano-banana', styleOverride } = {}) {
    const style = styleOverride || ficha.style;
    const d = ficha.description || {};
    const t = ficha.technical || {};
    const parts = [];

    parts.push(`${styleText(style)} of ${ficha.name || 'the subject'}.`);
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
