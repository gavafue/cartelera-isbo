// Pruebas del endpoint serverless sin red: fetch se reemplaza por un doble.
const { test, expect } = require('@playwright/test');
const handler = require('../api/avisos.js');

// Token institucional de pruebas leído del propio endpoint no se duplica: se obtiene de la fuente de verdad.
const fs = require('fs');
const TOKEN = /VALID_TOKENS = \[\s*'([0-9a-f]{64})'/.exec(fs.readFileSync(require.resolve('../api/avisos.js'), 'utf8'))[1];

function respuesta() {
  const r = { headers: {}, code: 200, cuerpo: undefined };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.cuerpo = b; return r; };
  r.end = () => r;
  return r;
}

test.beforeEach(() => {
  global.__guardado = null;
  global.fetch = async (url, init) => {
    if (init && init.method === 'POST') { global.__guardado = JSON.parse(init.body); return { ok: true }; }
    return { ok: false };
  };
});

test('OPTIONS responde 200 y 405 para otros métodos', async () => {
  const a = respuesta(); await handler({ method: 'OPTIONS', headers: {} }, a); expect(a.code).toBe(200);
  const b = respuesta(); await handler({ method: 'DELETE', headers: {} }, b); expect(b.code).toBe(405);
});

test('POST sin token o con token inválido responde 401 y no guarda', async () => {
  for (const headers of [{}, { 'x-isbo-token': 'cualquiera' }]) {
    const r = respuesta();
    await handler({ method: 'POST', headers, body: { avisos: [{ titulo: 'x' }] } }, r);
    expect(r.code).toBe(401);
  }
  expect(global.__guardado).toBeNull();
});

test('POST con formato inválido responde 400', async () => {
  const h = { 'x-isbo-token': TOKEN };
  const a = respuesta(); await handler({ method: 'POST', headers: h, body: '{no es json' }, a); expect(a.code).toBe(400);
  const b = respuesta(); await handler({ method: 'POST', headers: h, body: { avisos: 'no' } }, b); expect(b.code).toBe(400);
});

test('POST sanea enlaces, imágenes, ids y tamaños', async () => {
  const r = respuesta();
  await handler({
    method: 'POST', headers: { 'x-isbo-token': TOKEN },
    body: { avisos: [
      { id: 'a"><script>', titulo: 'T'.repeat(300), mensaje: 'M'.repeat(900), prioridad: 'inventada',
        tieneQr: true, qrUrl: 'javascript:alert(1)', qrImagen: 'javascript:alert(1)', fechaCreacion: 'no-fecha' },
      { id: 'ok-1', titulo: 'Válido', mensaje: 'x', tieneQr: true, qrUrl: 'https://isbo.utu.edu.uy/horarios',
        qrImagen: 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=x' },
      { id: 'dup', titulo: 'Válido', mensaje: 'x' }
    ] }
  }, r);
  expect(r.code).toBe(200);
  const [a, b] = r.cuerpo.avisos;
  expect(r.cuerpo.avisos).toHaveLength(2);
  expect(a.id).toBe('ascript');
  expect(a.titulo).toHaveLength(100);
  expect(a.mensaje).toHaveLength(500);
  expect(a.prioridad).toBe('avisos');
  expect(a.qrUrl).toBe('');
  expect(a.qrImagen).toBe('');
  expect(a.tieneQr).toBe(false);
  expect(Number.isNaN(Date.parse(a.fechaCreacion))).toBe(false);
  expect(b.qrUrl).toBe('https://isbo.utu.edu.uy/horarios');
  expect(b.tieneQr).toBe(true);
});

test('POST rechaza listas desmedidas', async () => {
  const r = respuesta();
  await handler({ method: 'POST', headers: { 'x-isbo-token': TOKEN }, body: { avisos: Array.from({ length: 101 }, (_, i) => ({ titulo: 't' + i })) } }, r);
  expect(r.code).toBe(413);
});

test('los errores internos no filtran detalles', async () => {
  global.fetch = async () => { throw new Error('detalle-secreto'); };
  const g = respuesta(); await handler({ method: 'GET', headers: {} }, g);
  expect(JSON.stringify(g.cuerpo)).not.toContain('detalle-secreto');
});
