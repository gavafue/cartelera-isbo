// Revisión visual y de accesibilidad básica. Las capturas quedan en test-results/ (ignorado por git).
const { test, expect } = require('@playwright/test');
const { redVisual, sembrar, enDias } = require('./helpers');

const docentes = Array.from({ length: 5 }, (_, i) => ({
  nombre: ['Ana Pérez', 'Luis Gómez Hernández', 'María del Carmen Rodríguez', 'Juan Silva', 'Paula Núñez'][i],
  grupo: ['2mk', '3ro MG y MF', 'todos', '1 MG, 1MH, 1MI, 1 MK', 'FPB 1'][i],
  desde: enDias(0), hasta: enDias(i)
}));
const avisos = [
  { id: 'a1', titulo: 'Reunión de coordinación', mensaje: 'Jueves 18:00 en sala de profesores.', prioridad: 'avisos', activo: true, tieneQr: false },
  { id: 'a2', titulo: 'Inscripciones a exámenes', mensaje: 'Abiertas hasta el viernes.', prioridad: 'examenes', activo: true, tieneQr: true, qrUrl: 'https://isbo.utu.edu.uy' }
];

const tamanos = [['tv-1920x1080', 1920, 1080], ['laptop-1366x768', 1366, 768], ['movil-390x844', 390, 844]];

for (const [nombre, width, height] of tamanos) {
  test(`pantalla TV sin desborde horizontal ni errores (${nombre})`, async ({ page }, info) => {
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.setViewportSize({ width, height });
    await redVisual(page, avisos);
    await sembrar(page, { docentes, avisos });
    await page.goto('/index.html');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: info.outputPath(`${nombre}.png`) });
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde).toBeLessThanOrEqual(1);
    expect(errores).toEqual([]);
  });
}

test('base de accesibilidad de la pantalla TV y del login', async ({ page }) => {
  await redVisual(page);
  await page.goto('/index.html');
  expect(await page.getAttribute('html', 'lang')).toBe('es');
  expect(await page.locator('img:not([alt])').count()).toBe(0);
  expect(await page.locator('h1').count()).toBe(1);
  await page.goto('/avisos.html');
  expect(await page.getAttribute('html', 'lang')).toBe('es');
  for (const id of ['login-usuario', 'login-password']) {
    await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
  }
  await expect(page.locator('#btn-toggle-password')).toHaveAttribute('aria-label', /contraseña/);
});

test('medición de legibilidad a distancia en 1920x1080 (informativa)', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await redVisual(page, avisos);
  await sembrar(page, { docentes, avisos });
  await page.goto('/index.html');
  await page.waitForTimeout(1500);
  const medidas = await page.evaluate(() => {
    const conteo = {};
    const recorrer = (el) => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          const px = Math.round(parseFloat(cs.fontSize));
          conteo[px] = (conteo[px] || 0) + 1;
        }
      }
      [...el.children].forEach(recorrer);
    };
    recorrer(document.body);
    return conteo;
  });
  await info.attach('tamanos-de-texto.json', { body: JSON.stringify(medidas, null, 2), contentType: 'application/json' });
  console.log('Tamaños de texto en 1920x1080 (px: cantidad de textos):', JSON.stringify(medidas));
});

test('la fecha del encabezado respeta la ortografía del español', async ({ page }) => {
  await redVisual(page);
  await page.goto('/index.html');
  await expect(page.locator('#reloj-fecha')).toHaveText(/^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{1,2} de [a-záéíóú]+$/);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('reloj-fecha')).textTransform)).toBe('none');
});

test('en TV 1920x1080 ningún texto visible baja de 13 px y el contraste sobre fondo claro llega a 4.5:1', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await redVisual(page, avisos);
  await sembrar(page, { docentes, avisos });
  await page.goto('/index.html');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const rgb = (c) => c.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const fondoClaro = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null;
        const c = rgb(cs.backgroundColor);
        if (c.length === 3 || c[3] === 1) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const chicos = new Set(); const pobres = new Set();
    const recorrer = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (propio && !el.classList.contains('material-symbols-outlined')) {
        if (parseFloat(cs.fontSize) < 13) chicos.add(`${el.textContent.trim().slice(0, 24)} (${cs.fontSize})`);
        const bg = fondoClaro(el);
        if (bg) {
          const fg = rgb(cs.color).slice(0, 3);
          const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
          const ratio = (a + 0.05) / (b + 0.05);
          if (ratio < 4.5) pobres.add(`${el.textContent.trim().slice(0, 24)} (${ratio.toFixed(2)})`);
        }
      }
      [...el.children].forEach(recorrer);
    };
    recorrer(document.body);
    return { chicos: [...chicos], pobres: [...pobres] };
  });
  expect(r.chicos).toEqual([]);
  expect(r.pobres).toEqual([]);
});

test('con movimiento reducido no hay desplazamiento automático y la lista no se duplica', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await redVisual(page, avisos);
  await sembrar(page, { docentes, avisos });
  await page.goto('/index.html');
  await page.waitForTimeout(1200);
  expect(await page.locator('.animate-marquee-v, .animate-marquee-h').count()).toBe(0);
  expect(await page.locator('#lista-docentes h3', { hasText: 'Ana Pérez' }).count()).toBe(1);
  const animados = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter((e) => { const a = getComputedStyle(e).animationName; return a !== 'none' && !/pulse|ping|spin/.test(a); }).length);
  expect(animados).toBe(0);
});
