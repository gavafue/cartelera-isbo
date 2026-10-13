/**
 * ============================================================================
 * Endpoint Serverless: /api/avisos
 * Responsabilidad:
 *   - Servir y persistir los comunicados institucionales compartidos entre
 *     Adscripción, Administración y la Smart TV del hall en Vercel.
 *   - Almacenamiento en la nube mediante Vercel KV (Upstash Redis REST API).
 *   - Fallback tolerante al archivo estático avisos.json si KV aún no fue enlazado.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

function obtenerAvisosPorDefecto() {
  try {
    const jsonPath = path.join(process.cwd(), 'avisos.json');
    if (fs.existsSync(jsonPath)) {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
  } catch (err) {
    console.warn('Error leyendo avisos.json base:', err);
  }
  return [];
}

async function obtenerDeVercelKV() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return null;

  try {
    const res = await fetch(`${kvUrl}/get/isbo_avisos`, {
      headers: {
        Authorization: `Bearer ${kvToken}`
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result) return null;

    if (typeof data.result === 'string') {
      return JSON.parse(data.result);
    }
    return data.result;
  } catch (err) {
    console.error('Error al consultar Vercel KV:', err);
    return null;
  }
}

async function guardarEnVercelKV(avisos) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    throw new Error('Vercel KV no configurado en variables de entorno');
  }

  const valorStr = JSON.stringify(avisos);

  // 1. Comando oficial Upstash REST API (POST / con ['SET', key, value])
  let res = await fetch(`${kvUrl}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kvToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(['SET', 'isbo_avisos', valorStr])
  });

  // 2. Si la raíz retorna error, intentar endpoint alternativo /set/isbo_avisos
  if (!res.ok) {
    res = await fetch(`${kvUrl}/set/isbo_avisos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json'
      },
      body: valorStr
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error en Vercel KV: ${errText}`);
  }
  return true;
}

async function obtenerDeGoogleSheets() {
  const SPREADSHEET_ID = '1t83h87_A01gSG518nU7QtpCGMNHR7kRbB900l-18TIk';
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=Avisos&tqx=out:json&headers=0`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const texto = await res.text();
    const json = JSON.parse(texto.replace(/^[\s\S]*setResponse\(/, '').replace(/\);?\s*$/, ''));
    const rows = json?.table?.rows || [];
    if (!rows.length) return null;

    let colTitulo = 0, colMensaje = 1, colCategoria = 2, colQr = 3, colActivo = 4, filaInicio = 0;
    const r0 = rows[0];
    if (r0 && r0.c) {
      let esHeader = false;
      r0.c.forEach((cell, idx) => {
        if (!cell) return;
        const val = String(cell.f || cell.v || '').trim().toLowerCase();
        if (val.includes('título') || val.includes('titulo')) { colTitulo = idx; esHeader = true; }
        else if (val.includes('mensaje') || val.includes('texto') || val.includes('detalle')) { colMensaje = idx; esHeader = true; }
        else if (val.includes('categor') || val.includes('prioridad')) { colCategoria = idx; esHeader = true; }
        else if (val.includes('qr') || val.includes('enlace') || val.includes('link')) { colQr = idx; esHeader = true; }
        else if (val.includes('activo') || val.includes('estado')) { colActivo = idx; esHeader = true; }
      });
      if (esHeader) filaInicio = 1;
    }

    const avisos = [];
    for (let i = filaInicio; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.c) continue;
      const getVal = (c) => String(r.c[c]?.f || r.c[c]?.v || '').trim();
      const titulo = getVal(colTitulo);
      const mensaje = getVal(colMensaje);
      if (!titulo && !mensaje) continue;
      const activoRaw = getVal(colActivo).toLowerCase();
      const activo = !['no', 'pausado', 'pausa', 'false', '0', 'inactivo'].includes(activoRaw);
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
    return avisos.length ? avisos : null;
  } catch (err) {
    console.warn('Error leyendo pestaña Avisos en serverless:', err);
    return null;
  }
}

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby7Cqt6FB1km9dH8iN6GV0eATxesGtarrsEBNPx8KzJC2J-3DhTCnYxAbKHezrZp0IDIw/exec';

async function guardarEnGoogleAppsScript(avisos) {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_all', avisos })
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al guardar en Google Apps Script desde backend:', err);
    return false;
  }
}

module.exports = async function handler(req, res) {
  // Configuración de CORS y cabeceras
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // 1. Prioridad: Pestaña Avisos de Google Sheets
      const avisosSheets = await obtenerDeGoogleSheets();
      if (avisosSheets && Array.isArray(avisosSheets) && avisosSheets.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
        return res.status(200).json({
          ok: true,
          fuente: 'google-sheets',
          avisos: avisosSheets
        });
      }

      // 2. Si KV está configurado, consultar KV
      const avisosKV = await obtenerDeVercelKV();
      if (avisosKV && Array.isArray(avisosKV) && avisosKV.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
        return res.status(200).json({
          ok: true,
          fuente: 'vercel-kv',
          avisos: avisosKV
        });
      }

      // 3. Fallback a avisos.json estático base
      const porDefecto = obtenerAvisosPorDefecto();
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
      return res.status(200).json({
        ok: true,
        fuente: 'archivo-base',
        avisos: porDefecto
      });
    } catch (err) {
      console.error('Error en GET /api/avisos:', err);
      return res.status(500).json({ ok: false, error: err.message, avisos: obtenerAvisosPorDefecto() });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      const lista = Array.isArray(body) ? body : (body?.avisos || null);
      if (!Array.isArray(lista)) {
        return res.status(400).json({ ok: false, error: 'Formato inválido. Se esperaba un array de avisos.' });
      }

      // Validar y sanitizar cada aviso
      const sanitizados = lista.map((a, i) => ({
        id: a.id || `aviso-${Date.now()}-${i}`,
        titulo: String(a.titulo || 'Comunicado Institucional').trim().slice(0, 100),
        prioridad: ['urgente', 'atencion', 'avisos', 'informacion', 'tramites', 'examenes'].includes(a.prioridad) ? a.prioridad : 'avisos',
        mensaje: String(a.mensaje || '').trim().slice(0, 500),
        tieneQr: Boolean(a.tieneQr),
        qrUrl: a.qrUrl ? String(a.qrUrl).trim() : '',
        qrImagen: a.qrImagen || '',
        activo: a.activo !== false,
        fechaCreacion: a.fechaCreacion || new Date().toISOString()
      }));

      // 1. Guardar directamente en Google Sheets vía Apps Script
      await guardarEnGoogleAppsScript(sanitizados);

      // 2. Si Vercel KV estuviese enlazado, guardar en KV también
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        await guardarEnVercelKV(sanitizados);
      }

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
