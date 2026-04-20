let _choices = null;

async function loadChoices() {
  if (_choices) return _choices;
  const res = await fetch('data/choices.json');
  if (!res.ok) throw new Error('No se pudo cargar choices.json');
  _choices = await res.json();
  return _choices;
}

function getChoices(key) {
  if (!_choices) throw new Error('Catálogos no cargados');
  return _choices[key] ?? [];
}

function getLabelForValue(key, value) {
  const item = getChoices(key).find(
    c => c.value === value || String(c.value) === String(value)
  );
  if (item) return item.label;
  return (value === '' || value === null || value === undefined) ? '' : String(value);
}
