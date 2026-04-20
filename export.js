async function exportCSV(schema) {
  let registros;
  try {
    registros = await dbGetAll();
  } catch (err) {
    showToast('Error al leer registros: ' + err.message, 'error');
    return;
  }

  if (!registros.length) {
    showToast('No hay registros para exportar.', 'warn');
    return;
  }

  const sep     = schema.csv_export.separator;
  const columns = schema.csv_export.columns;

  const allFields = [...schema.header.fields, ...schema.individual.fields];

  const headerRow = columns.join(sep);
  const rows = [];

  for (const reg of registros) {
    if (!reg.individuos || !reg.individuos.length) continue;
    for (const ind of reg.individuos) {
      const row = columns.map(col => {
        let val;
        if      (col in reg.header) val = reg.header[col];
        else if (col in ind)        val = ind[col];
        else                        val = '';

        if (col === 'observador') {
          val = getLabelForValue('observadores', val);
        }

        val = (val === null || val === undefined) ? '' : String(val);
        if (val.includes(sep) || val.includes('"') || val.includes('\n')) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      });
      rows.push(row.join(sep));
    }
  }

  if (!rows.length) {
    showToast('Los registros no tienen individuos para exportar.', 'warn');
    return;
  }

  const bom     = '\ufeff';
  const sepHint = schema.csv_export.sep_hint ? `sep=${sep}\n` : '';
  const content = bom + sepHint + headerRow + '\n' + rows.join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `monitoreo_10ss_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`CSV exportado: ${rows.length} fila(s).`, 'success');
}
