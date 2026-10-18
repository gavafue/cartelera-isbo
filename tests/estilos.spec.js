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
