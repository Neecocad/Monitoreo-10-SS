let schema = null;
let currentRecord        = null;
let editingIndividualIdx = null;

async function initApp() {
  try {
    const [schemaData] = await Promise.all([
      fetch('data/schemas.json').then(r => r.json()),
      loadChoices()
    ]);
    schema = schemaData;

    renderFields(schema.header.fields,     document.getElementById('header-fields'));
    renderFields(schema.individual.fields, document.getElementById('individual-fields'));

    _bindEvents();
    await _renderRecordsList();
    _startNewRecord();
    _registerSW();
    initSync();
  } catch (err) {
    showToast('Error al iniciar la app: ' + err.message, 'error');
    console.error(err);
  }
}

// ─── Record lifecycle ────────────────────────────────────────────────────────

function _startNewRecord() {
  currentRecord = {
    id:          generateId(),
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
    sync_status: 'pending',
    header:      {},
    individuos:  []
  };
  editingIndividualIdx = null;
  resetFields(schema.header.fields);
  const fechaEl = document.getElementById('field-fecha');
  if (fechaEl) fechaEl.value = new Date().toISOString().slice(0, 10);
  _updateIndividualsList();
  _showView('form');
  document.getElementById('btn-save').textContent = 'Guardar parcela';
  showToast('Nueva parcela iniciada.', 'info');
}

function _loadRecordForEdit(registro) {
  currentRecord        = JSON.parse(JSON.stringify(registro));
  editingIndividualIdx = null;
  setFieldValues(schema.header.fields, currentRecord.header);
  _updateIndividualsList();
  _showView('form');
  document.getElementById('btn-save').textContent = 'Actualizar parcela';
  showToast(`Editando parcela ${registro.header.codigo_parcela || '—'}.`, 'info');
}

async function _saveCurrentRecord() {
  const headerErrors = validateFields(schema.header.fields);
  if (headerErrors.length) {
    showToast('Campos obligatorios: ' + headerErrors.join(', '), 'error');
    return;
  }
  if (!currentRecord.individuos.length) {
    showToast('Agrega al menos un individuo antes de guardar.', 'error');
    return;
  }

  const headerData = getFieldValues(schema.header.fields);
  headerData.proyecto = schema.metadata.proyecto;
  headerData.huso     = schema.metadata.huso;
  headerData.datum    = schema.metadata.datum;

  currentRecord.header     = headerData;
  currentRecord.updated_at = new Date().toISOString();

  try {
    await dbSave(currentRecord);
    showToast('Parcela guardada correctamente.', 'success');
    await _renderRecordsList();
    syncRecord(currentRecord);
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
    console.error(err);
  }
}

// ─── Individuals ─────────────────────────────────────────────────────────────

function _updateIndividualsList() {
  const list = document.getElementById('individuals-list');
  list.innerHTML = '';
  if (!currentRecord.individuos.length) {
    list.innerHTML = '<p class="empty-msg">Sin individuos registrados.</p>';
    return;
  }
  for (let i = 0; i < currentRecord.individuos.length; i++) {
    const ind  = currentRecord.individuos[i];
    const surv = getLabelForValue('sobrevivencia', ind.sobrevivencia);
    const esp  = getLabelForValue('especie',       ind.especie);
    const item = document.createElement('div');
    item.className = 'individual-item';
    item.innerHTML = `
      <div class="ind-info">
        <span class="ind-number">#${ind.n_individuo}</span>
        <span class="ind-detail">${esp} · ${surv}</span>
      </div>
      <div class="ind-actions">
        <button class="btn-sm btn-edit-ind"   data-idx="${i}">Editar</button>
        <button class="btn-sm btn-delete-ind" data-idx="${i}">Eliminar</button>
      </div>`;
    list.appendChild(item);
  }
}

function _openIndividualForm(idx) {
  editingIndividualIdx = idx;
  resetFields(schema.individual.fields);

  if (idx !== null) {
    const ind = currentRecord.individuos[idx];
    setFieldValues(schema.individual.fields, ind);
    document.getElementById('individual-form-title').textContent =
      `Editar individuo #${ind.n_individuo}`;
  } else {
    const nextNum = currentRecord.individuos.length + 1;
    const numEl   = document.getElementById('field-n_individuo');
    if (numEl) numEl.textContent = nextNum;
    document.getElementById('individual-form-title').textContent = 'Nuevo individuo';
  }
  _showView('individual');
}

function _saveIndividual() {
  const errors = validateFields(schema.individual.fields);
  if (errors.length) {
    showToast('Campos obligatorios: ' + errors.join(', '), 'error');
    return;
  }
  const data = getFieldValues(schema.individual.fields);

  if (editingIndividualIdx !== null) {
    data.n_individuo = currentRecord.individuos[editingIndividualIdx].n_individuo;
    currentRecord.individuos[editingIndividualIdx] = data;
    showToast(`Individuo #${data.n_individuo} actualizado.`, 'success');
  } else {
    data.n_individuo = currentRecord.individuos.length + 1;
    currentRecord.individuos.push(data);
    showToast(`Individuo #${data.n_individuo} agregado.`, 'success');
  }

  editingIndividualIdx = null;
  _updateIndividualsList();
  _showView('form');
}

function _deleteIndividual(idx) {
  const ind = currentRecord.individuos[idx];
  if (!confirm(`¿Eliminar individuo #${ind.n_individuo}?`)) return;
  currentRecord.individuos.splice(idx, 1);
  currentRecord.individuos.forEach((v, i) => { v.n_individuo = i + 1; });
  _updateIndividualsList();
  showToast('Individuo eliminado.', 'info');
}

// ─── Records list ─────────────────────────────────────────────────────────────

async function _renderRecordsList() {
  const container = document.getElementById('records-list');
  let registros;
  try {
    registros = await dbGetAll();
  } catch (err) {
    container.innerHTML = '<p class="error-msg">Error al cargar registros.</p>';
    return;
  }

  const badge = document.getElementById('records-badge');
  if (badge) badge.textContent = registros.length || '';

  if (!registros.length) {
    container.innerHTML = '<p class="empty-msg">No hay registros guardados.</p>';
    return;
  }

  registros.sort((a, b) => b.created_at.localeCompare(a.created_at));
  container.innerHTML = '';

  for (const reg of registros) {
    const obs  = getLabelForValue('observadores', reg.header.observador);
    const item = document.createElement('div');
    item.className = 'record-item';
    item.innerHTML = `
      <div class="record-info">
        <strong>${reg.header.codigo_parcela || '—'}</strong>
        <span>${reg.header.fecha || '—'} · ${reg.individuos.length} ind.</span>
        <span class="record-obs">${obs}</span>
      </div>
      <div class="record-actions">
        <button class="btn-sm btn-edit-rec"   data-id="${reg.id}">Editar</button>
        <button class="btn-sm btn-delete-rec" data-id="${reg.id}">Eliminar</button>
      </div>`;
    container.appendChild(item);
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function _bindEvents() {
  document.getElementById('btn-save').addEventListener('click', _saveCurrentRecord);

  document.getElementById('btn-new').addEventListener('click', () => {
    if (confirm('¿Iniciar nueva parcela? Los cambios no guardados se perderán.'))
      _startNewRecord();
  });

  document.getElementById('btn-export').addEventListener('click',
    () => exportCSV(schema));

  document.getElementById('btn-add-individual').addEventListener('click', () => {
    const errors = validateFields(schema.header.fields);
    if (errors.length) {
      showToast('Completa los datos de la parcela antes de agregar individuos.', 'error');
      return;
    }
    _openIndividualForm(null);
  });

  document.getElementById('btn-save-individual').addEventListener('click', _saveIndividual);

  document.getElementById('btn-cancel-individual').addEventListener('click',
    () => _showView('form'));

  document.getElementById('btn-show-records').addEventListener('click', async () => {
    await _renderRecordsList();
    _showView('records');
  });

  document.getElementById('btn-back-from-records').addEventListener('click',
    () => _showView('form'));

  document.getElementById('individuals-list').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    if (btn.classList.contains('btn-edit-ind'))   _openIndividualForm(idx);
    if (btn.classList.contains('btn-delete-ind')) _deleteIndividual(idx);
  });

  document.getElementById('records-list').addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-edit-rec')) {
      const reg = await dbGet(id);
      if (reg) _loadRecordForEdit(reg);
    }
    if (btn.classList.contains('btn-delete-rec')) {
      if (confirm('¿Eliminar este registro permanentemente?')) {
        await dbDelete(id);
        showToast('Registro eliminado.', 'info');
        await _renderRecordsList();
      }
    }
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function _showView(view) {
  document.getElementById('view-form').hidden       = (view !== 'form');
  document.getElementById('view-individual').hidden = (view !== 'individual');
  document.getElementById('view-records').hidden    = (view !== 'records');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => { if (toast.parentNode) container.removeChild(toast); }, 400);
  }, 3200);
}

// ─── Service Worker & version ─────────────────────────────────────────────────

function _registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Muestra banner solo cuando el SW detecta una nueva versión esperando
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          const banner = document.getElementById('update-banner');
          if (banner) banner.hidden = false;
          document.getElementById('btn-update').addEventListener('click', () => {
            newSW.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          });
        }
      });
    });
  }).catch(err => console.warn('SW no registrado:', err));
}

document.addEventListener('DOMContentLoaded', initApp);
