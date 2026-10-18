const { test, expect } = require('@playwright/test');
const { aislarRed, sembrar, enDias } = require('./helpers');

test('sin conexión la TV conserva las inasistencias de la última sincronización', async ({ page }) => {
  await aislarRed(page);
  await sembrar(page, { docentes: [{ nombre: 'Ana Pérez', grupo: '2mk', desde: enDias(0), hasta: enDias(0) }] });
  await page.goto('/index.html');
  await page.waitForTimeout(800);
  await expect(page.locator('#lista-docentes')).toContainText('Ana Pérez');
  await expect(page.locator('#lista-docentes')).toContainText('2° MK');
  await expect(page.locator('#lista-docentes')).not.toContainText('Todo el cuerpo docente asiste');
});

test('separa ausentes de hoy y de mañana y muestra los contadores', async ({ page }) => {
  await aislarRed(page);
  await sembrar(page, { docentes: [
    { nombre: 'Ana Pérez', grupo: '2mk', desde: enDias(0), hasta: enDias(0) },
    { nombre: 'Luis Gómez', grupo: 'todos', desde: enDias(1), hasta: enDias(1) }
  ] });
  await page.goto('/index.html');
  await page.waitForTimeout(800);
  await expect(page.locator('#lista-docentes')).toContainText('Ana Pérez');
  await expect(page.locator('#lista-docentes')).not.toContainText('Luis Gómez');
  await expect(page.locator('#lista-docentes-manana')).toContainText('Luis Gómez');
  await expect(page.locator('#lista-docentes-manana')).toContainText('TODOS LOS GRUPOS');
});

test('sin datos muestra el estado vacío', async ({ page }) => {
  await aislarRed(page);
  await page.goto('/index.html');
  await page.waitForTimeout(500);
  await expect(page.locator('#lista-docentes')).toContainText('Sin inasistencias');
});

test('docentes y avisos se desplazan a la misma velocidad (px/s)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await aislarRed(page, [1, 2, 3].map((i) => ({ id: 'a' + i, titulo: 'Aviso ' + i, mensaje: 'Mensaje ' + i, prioridad: 'avisos', activo: true, tieneQr: i === 1, qrUrl: 'https://isbo.utu.edu.uy' })));
  await sembrar(page, {
    docentes: Array.from({ length: 8 }, (_, i) => ({ nombre: 'Docente Número ' + i, grupo: '2mk', desde: enDias(0), hasta: enDias(0) })),
    avisos: [1, 2, 3].map((i) => ({ id: 'a' + i, titulo: 'Aviso ' + i, mensaje: 'Mensaje ' + i, prioridad: 'avisos', activo: true, tieneQr: i === 1, qrUrl: 'https://isbo.utu.edu.uy' }))
  });
  await page.goto('/index.html');
  await page.waitForTimeout(1500);
  const v = await page.evaluate(() => ['lista-docentes', 'contenedor-avisos'].map((id) => {
    const e = document.getElementById(id);
    return e.scrollHeight / 2 / parseFloat(getComputedStyle(e).animationDuration);
  }));
  expect(Math.abs(v[0] - v[1]) / v[1]).toBeLessThan(0.1);
  expect(v[0]).toBeGreaterThan(35);
});
