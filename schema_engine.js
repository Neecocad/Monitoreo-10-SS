function renderFields(fields, container) {
  container.innerHTML = '';
  for (const field of fields) {
    const wrap = document.createElement('div');
    wrap.className = 'field-group';
    wrap.dataset.fieldId = field.id;

    const label = document.createElement('label');
    label.htmlFor = `field-${field.id}`;
    label.textContent = field.label;
    if (field.required) {
      const star = document.createElement('span');
      star.className = 'required';
      star.textContent = ' *';
      label.appendChild(star);
    }
    wrap.appendChild(label);

    if (field.auto && field.readonly) {
      const display = document.createElement('span');
      display.id = `field-${field.id}`;
      display.className = 'field-display';
      display.textContent = '—';
      wrap.appendChild(display);
      container.appendChild(wrap);
      continue;
    }

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— seleccionar —';
      input.appendChild(blank);
      for (const c of getChoices(field.choices_key)) {
        const opt = document.createElement('option');
        opt.value = c.value;
        opt.textContent = c.label;
        input.appendChild(opt);
      }
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = field.type === 'number' ? 'number'
                 : field.type === 'date'   ? 'date'
                 : 'text';
    }

    input.id   = `field-${field.id}`;
    input.name = field.id;
    if (field.required) input.required = true;

    if (field.triggers) {
      input.addEventListener('change', () => _applyTriggers(field.triggers, input.value));
    }

    wrap.appendChild(input);
    container.appendChild(wrap);
  }
}

function _applyTriggers(triggers, rawValue) {
  const numVal = rawValue === '' ? rawValue : (isNaN(rawValue) ? rawValue : Number(rawValue));
  for (const trigger of triggers) {
    const tw = trigger.when.value;
    const match = tw === numVal || String(tw) === String(rawValue);
    if (!match) continue;
    for (const action of trigger.actions) {
      const el = document.getElementById(`field-${action.target}`);
      if (!el) continue;
      switch (action.type) {
        case 'set':     el.value    = action.value; break;
        case 'disable': el.disabled = true;         break;
        case 'enable':  el.disabled = false;        break;
        case 'clear':   el.value    = '';           break;
      }
    }
  }
}

function getFieldValues(fields) {
  const data = {};
  for (const field of fields) {
    if (field.auto && field.readonly) continue;
    const el = document.getElementById(`field-${field.id}`);
    if (!el) continue;
    let val = el.value;
    if ((field.type === 'number' || field.type === 'integer') && val !== '') {
      val = Number(val);
    } else if (field.type === 'select' && val !== '') {
      const choices = getChoices(field.choices_key);
      if (choices.length && typeof choices[0].value === 'number') val = Number(val);
    }
    data[field.id] = val === '' ? '' : val;
  }
  return data;
}

function setFieldValues(fields, data) {
  for (const field of fields) {
    const val = data[field.id];
    if (field.auto && field.readonly) {
      const el = document.getElementById(`field-${field.id}`);
      if (el) el.textContent = val ?? '—';
      continue;
    }
    const el = document.getElementById(`field-${field.id}`);
    if (!el) continue;
    el.value    = (val === null || val === undefined) ? '' : val;
    el.disabled = false;
    if (field.triggers) _applyTriggers(field.triggers, el.value);
  }
}

function validateFields(fields) {
  const missing = [];
  for (const field of fields) {
    if (!field.required || (field.auto && field.readonly)) continue;
    const el = document.getElementById(`field-${field.id}`);
    if (!el || el.disabled) continue;
    if (el.value === '' || el.value === null || el.value === undefined) {
      missing.push(field.label);
    }
  }
  return missing;
}

function resetFields(fields) {
  for (const field of fields) {
    if (field.auto && field.readonly) {
      const el = document.getElementById(`field-${field.id}`);
      if (el) el.textContent = '—';
      continue;
    }
    const el = document.getElementById(`field-${field.id}`);
    if (!el) continue;
    el.value    = '';
    el.disabled = false;
  }
}
