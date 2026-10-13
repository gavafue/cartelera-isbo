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
      const avisosKV = await obtenerDeVercelKV();
      if (avisosKV && Array.isArray(avisosKV)) {
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
        return res.status(200).json({
          ok: true,
          fuente: 'vercel-kv',
          avisos: avisosKV
        });
      }

      // Si aún no se guardaron o KV no está configurado, devolver avisos base
      const porDefecto = obtenerAvisosPorDefecto();
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
      return res.status(200).json({
        ok: true,
        fuente: process.env.KV_REST_API_URL ? 'vercel-kv-vacio' : 'archivo-base',
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

      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        return res.status(200).json({
          ok: true,
          alerta: 'KV_NO_ENLAZADO',
          mensaje: 'Avisos recibidos pero Vercel KV aún no está conectado. Recuerda agregar la base de datos KV en Vercel.',
          avisos: sanitizados
        });
      }

      await guardarEnVercelKV(sanitizados);
      return res.status(200).json({
        ok: true,
        fuente: 'vercel-kv',
        avisos: sanitizados
      });
    } catch (err) {
      console.error('Error en POST /api/avisos:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Método no permitido' });
};
