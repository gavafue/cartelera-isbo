/**
 * ============================================================================
 * Endpoint Serverless: /api/avisos
 * Responsabilidad:
 *   - Servir y persistir los comunicados institucionales compartidos entre
 *     Adscripción, Administración y la Pantalla TV.
 *   - Consulta directa a la hoja de cálculo de Google Sheets (pestaña 'Avisos').
 *   - Guardado directo en Google Sheets mediante Google Apps Script Web App.
 *   - Sin dependencias de bases de datos externas ni Vercel KV.
 * ============================================================================
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby7Cqt6FB1km9dH8iN6GV0eATxesGtarrsEBNPx8KzJC2J-3DhTCnYxAbKHezrZp0IDIw/exec';
const SPREADSHEET_ID = '1t83h87_A01gSG518nU7QtpCGMNHR7kRbB900l-18TIk';

async function obtenerDeGoogleSheets() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=Avisos&tqx=out:json&headers=0&_t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const texto = await res.text();
    const json = JSON.parse(texto.replace(/^[\s\S]*setResponse\(/, '').replace(/\);?\s*$/, ''));
    const rows = json?.table?.rows || [];

    let colTitulo = 0, colMensaje = 1, colCategoria = 2, colQr = 3, colActivo = 4, filaInicio = 0;
    let tieneHeaderAvisos = false;

    if (rows.length > 0 && rows[0]?.c) {
      rows[0].c.forEach((cell, idx) => {
        if (!cell) return;
        const val = String(cell.f || cell.v || '').trim().toLowerCase();
        if (val.includes('título') || val.includes('titulo')) { colTitulo = idx; tieneHeaderAvisos = true; }
        else if (val.includes('mensaje') || val.includes('texto') || val.includes('detalle')) { colMensaje = idx; tieneHeaderAvisos = true; }
        else if (val.includes('categor') || val.includes('prioridad')) { colCategoria = idx; }
        else if (val.includes('qr') || val.includes('enlace') || val.includes('link')) { colQr = idx; }
        else if (val.includes('activo') || val.includes('estado')) { colActivo = idx; }
      });
      if (tieneHeaderAvisos) filaInicio = 1;
    }

    if (!tieneHeaderAvisos) {
      return null;
    }

    const avisos = [];
    const firmasVistas = new Set();
    for (let i = filaInicio; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.c) continue;
      const getVal = (c) => String(r.c[c]?.f || r.c[c]?.v || '').trim();
      const titulo = getVal(colTitulo);
      const mensaje = getVal(colMensaje);
      if (!titulo && !mensaje) continue;

      const firma = titulo.toLowerCase() + ':::' + mensaje.toLowerCase();
      if (firmasVistas.has(firma)) continue;
      firmasVistas.add(firma);

      const activoRaw = getVal(colActivo).toLowerCase();
      const activo = !['no', 'pausado', 'pausa', 'false', '0', 'inactivo', 'oculto'].includes(activoRaw);
      const catRaw = getVal(colCategoria).toLowerCase();
      const prioridad = ['urgente', 'atencion', 'avisos', 'informacion', 'tramites', 'examenes'].includes(catRaw) ? catRaw : 'avisos';
      const qrUrl = getVal(colQr);

      avisos.push({
        id: `aviso-sheet-${i + 1}`,
        titulo: titulo || 'Aviso Institucional',
        mensaje: mensaje || '',
        prioridad,
        tieneQr: Boolean(qrUrl),
        qrUrl,
        activo,
        fuente: 'google-sheets'
      });
    }
    return avisos;
  } catch (err) {
    console.warn('Error leyendo pestaña Avisos en serverless:', err);
    return null;
  }
}

async function guardarEnGoogleAppsScript(avisos) {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sync_all', avisos })
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al guardar en Google Apps Script desde backend:', err);
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-isbo-token, authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const avisosSheets = await obtenerDeGoogleSheets();
      if (Array.isArray(avisosSheets)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).json({
          ok: true,
          fuente: 'google-sheets',
          avisos: avisosSheets
        });
      }
      return res.status(200).json({
        ok: true,
        fuente: 'vacio',
        avisos: []
      });
    } catch (err) {
      console.error('Error en GET /api/avisos:', err);
      return res.status(500).json({ ok: false, error: err.message, avisos: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      const VALID_TOKENS = [
        'e0fda24bcf3cf6e95c7a214eaa29b1f634debda0ec921b7a4d231542c0eefc36'
      ];
      const clientToken = req.headers['x-isbo-token'] || req.headers['authorization'];
      if (!clientToken || !VALID_TOKENS.includes(clientToken)) {
        return res.status(401).json({ ok: false, error: 'Acceso no autorizado al backend de avisos' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      const lista = Array.isArray(body) ? body : (body?.avisos || null);
      if (!Array.isArray(lista)) {
        return res.status(400).json({ ok: false, error: 'Formato inválido. Se esperaba un array de avisos.' });
      }

      const sanitizados = [];
      const postFirmas = new Set();
      for (let i = 0; i < lista.length; i++) {
        const a = lista[i];
        if (!a) continue;
        const titulo = String(a.titulo || 'Comunicado Institucional').trim().slice(0, 100);
        const mensaje = String(a.mensaje || '').trim().slice(0, 500);
        const firma = titulo.toLowerCase() + ':::' + mensaje.toLowerCase();
        if (postFirmas.has(firma)) continue;
        postFirmas.add(firma);

        sanitizados.push({
          id: a.id || `aviso-${Date.now()}-${i}`,
          titulo,
          prioridad: ['urgente', 'atencion', 'avisos', 'informacion', 'tramites', 'examenes'].includes(a.prioridad) ? a.prioridad : 'avisos',
          mensaje,
          tieneQr: Boolean(a.tieneQr),
          qrUrl: a.qrUrl ? String(a.qrUrl).trim() : '',
          qrImagen: a.qrImagen || '',
          activo: a.activo !== false,
          fechaCreacion: a.fechaCreacion || new Date().toISOString()
        });
      }

      await guardarEnGoogleAppsScript(sanitizados);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({
        ok: true,
        fuente: 'google-sheets',
        avisos: sanitizados
      });
    } catch (err) {
      console.error('Error en POST /api/avisos:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Método no permitido' });
};
