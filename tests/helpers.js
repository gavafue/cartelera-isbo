// Utilidades compartidas: aislamiento de red y datos simulados (nunca se toca la planilla real).
const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const enDias = (n) => { const d = hoy(); d.setDate(d.getDate() + n); return d.toISOString(); };

// La API simulada devuelve los mismos avisos sembrados: el servidor es la fuente de verdad de la pantalla.
async function aislarRed(page, avisos = []) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route('**/api/avisos', (route) =>
    route.fulfill({ json: { ok: true, fuente: avisos.length ? 'google-sheets' : 'vacio', avisos } }));
}

async function sembrar(page, { docentes = [], avisos = [] } = {}) {
  await page.addInitScript(({ docentes, avisos }) => {
    localStorage.setItem('isbo_docentes_cache', JSON.stringify(docentes));
    localStorage.setItem('isbo_avisos_manuales', JSON.stringify(avisos));
  }, { docentes, avisos });
}

module.exports = { aislarRed, sembrar, hoy, enDias };

// Red para pruebas visuales: solo recursos de presentación (Tailwind y fuentes), nunca Google Sheets ni la API real.
async function redVisual(page, avisos = []) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|cdn\.tailwindcss\.com|fonts\.(googleapis|gstatic)\.com)/, (route) => route.abort());
  await page.route('**/api/avisos', (route) =>
    route.fulfill({ json: { ok: true, fuente: avisos.length ? 'google-sheets' : 'vacio', avisos } }));
}
module.exports.redVisual = redVisual;
