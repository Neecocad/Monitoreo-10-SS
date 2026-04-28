const APPS_SCRIPT_URL = 'https://script.google.com/a/macros/biocys.com/s/AKfycbzcwarfdLr32vYTjrlCkK4YYgZ33wx_yzldjDIn2KyWj7hzJYFOXm3KCoQBkPwIo7UkSQ/exec';

function initSync() {
  window.addEventListener('online', () => {
    showToast('Conexión recuperada. Sincronizando...', 'info');
    syncPending();
  });
  syncPending();
}

async function syncRecord(registro) {
  if (!navigator.onLine) {
    _setStatus(registro, 'pending');
    await dbSave(registro);
    _updateSyncUI();
    return false;
  }

  const rows = _flattenRecord(registro);
  if (!rows.length) return false;

  try {
    await _postViaForm({ record_id: registro.id, rows });
    _setStatus(registro, 'synced');
    await dbSave(registro);
    _updateSyncUI();
    return true;

  } catch (err) {
    _setStatus(registro, 'pending');
    await dbSave(registro);
    _updateSyncUI();
    console.warn('Sync fallido:', err.message);
    return false;
  }
}

function _postViaForm(data) {
  return new Promise((resolve, reject) => {
    const frameId = 'sync-frame-' + Date.now();

    const iframe = document.createElement('iframe');
    iframe.name  = frameId;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = APPS_SCRIPT_URL;
    form.target = frameId;
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type  = 'hidden';
    input.name  = 'data';
    input.value = JSON.stringify(data);
    form.appendChild(input);
    document.body.appendChild(form);

    const cleanup = () => {
      if (document.body.contains(form))   document.body.removeChild(form);
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    };

    const timer = setTimeout(() => { cleanup(); resolve(); }, 8000);

    iframe.addEventListener('load', () => {
      clearTimeout(timer);
      cleanup();
      resolve();
    });

    form.submit();
  });
}

async function syncPending() {
  let registros;
  try { registros = await dbGetAll(); } catch { return; }

  const pendientes = registros.filter(r => r.sync_status !== 'synced');
  if (!pendientes.length) return;

  let ok = 0;
  for (const reg of pendientes) {
    if (await syncRecord(reg)) ok++;
  }
  if (ok > 0) showToast(`${ok} registro(s) sincronizados.`, 'success');
  _updateSyncUI();
}

function _flattenRecord(registro) {
  if (!window.schema) return [];
  return registro.individuos.map(ind => {
    const row = {};
    for (const col of schema.csv_export.columns) {
      if      (col in registro.header) row[col] = registro.header[col];
      else if (col in ind)             row[col] = ind[col];
      else                             row[col] = '';
      if (col === 'observador') row[col] = getLabelForValue('observadores', row[col]);
    }
    return row;
  });
}

function _setStatus(registro, status) {
  registro.sync_status = status;
}

async function _updateSyncUI() {
  let registros;
  try { registros = await dbGetAll(); } catch { return; }

  const pending = registros.filter(r => r.sync_status !== 'synced').length;
  const badge   = document.getElementById('sync-status');
  if (!badge) return;

  if (pending > 0) {
    badge.textContent = `⏳ ${pending} pendiente(s)`;
    badge.className   = 'sync-status sync-pending';
  } else {
    badge.textContent = '✓ Sincronizado';
    badge.className   = 'sync-status sync-ok';
  }
}
