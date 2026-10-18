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
