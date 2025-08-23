// src/utils/csv.js

/**
 * Convierte un array de objetos a CSV.
 * @param {Array<Object>} rows - Filas a exportar.
 * @param {Array<{key:string,label:string}>} [columns] - Define orden y etiquetas de cabecera.
 * @param {{delimiter?: string, eol?: string, includeHeader?: boolean}} [opts]
 * @returns {string} CSV como string (sin BOM).
 */
export function toCSV(rows, columns, opts = {}) {
    const delimiter = opts.delimiter ?? ",";
    const eol = opts.eol ?? "\r\n";
    const includeHeader = opts.includeHeader ?? true;
  
    const safe = (val) => {
      if (val === null || val === undefined) return "";
      let s = String(val);
      // Duplicar comillas
      s = s.replace(/"/g, '""');
      // Si contiene comillas, separadores, saltos de línea o espacios extremos: envolver en comillas
      if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
        s = `"${s}"`;
      }
      return s;
    };
  
    const normalized = Array.isArray(rows) ? rows : [];
    // Si no pasan columnas, inferir del primer registro
    const cols =
      Array.isArray(columns) && columns.length
        ? columns
        : normalized.length
        ? Object.keys(normalized[0]).map((k) => ({ key: k, label: k }))
        : [];
  
    const lines = [];
    if (includeHeader && cols.length) {
      lines.push(cols.map((c) => safe(c.label)).join(delimiter));
    }
    for (const r of normalized) {
      const line = cols.map((c) => safe(r?.[c.key]));
      lines.push(line.join(delimiter));
    }
  
    return lines.join(eol);
  }
  
  /**
   * Dispara la descarga de un CSV en el navegador.
   * Añade BOM para compatibilidad con Excel.
   * @param {string} filename
   * @param {string} csvString - CSV (puede salir de toCSV).
   */
  export function downloadCSV(filename, csvString) {
    if (typeof window === "undefined") return;
  
    // BOM para UTF-8
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + (csvString ?? "")], {
      type: "text/csv;charset=utf-8;",
    });
  
    // IE/Edge antiguo
    if (window.navigator && window.navigator.msSaveBlob) {
      window.navigator.msSaveBlob(blob, filename);
      return;
    }
  
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  