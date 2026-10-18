const fs = require('fs');
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');
const { aislarRed, sembrar, hoy } = require('./helpers');

const PAYLOAD = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const hoyIso = () => hoy().toISOString();
const AVISO_HOSTIL = { id: 'x1', titulo: PAYLOAD, mensaje: PAYLOAD, prioridad: 'urgente', activo: true,
                       tieneQr: true, qrUrl: PAYLOAD, qrImagen: 'javascript:window.__xss=1' };

test.describe('XSS en la pantalla TV', () => {
  test('nombres, grupos, títulos, mensajes y enlaces se muestran como texto', async ({ page }) => {
    await aislarRed(page, [AVISO_HOSTIL]);
    await sembrar(page, {
      docentes: [{ nombre: PAYLOAD, grupo: PAYLOAD, desde: hoyIso(), hasta: hoyIso() }],
      avisos: [AVISO_HOSTIL]
    });
    await page.goto('/index.html');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('#lista-docentes img[src="x"]').count()).toBe(0);
    await expect(page.locator('#lista-docentes')).toContainText('<img src=x');
    await expect(page.locator('#contenedor-avisos')).toContainText('<img src=x');
  });
});

test.describe('XSS en el panel de administración', () => {
  test('la lista y la vista previa escapan el contenido de los avisos', async ({ page }) => {
    await aislarRed(page, [AVISO_HOSTIL]);
    const js = fs.readFileSync('js/avisos-admin.js', 'utf8');
    const token = /validTokens:\s*\[\s*'([0-9a-f]{64})'/.exec(js)[1];
    const salt = /salt:\s*'([^']+)'/.exec(js)[1];
    const expira = Date.now() + 3600000;
    const firma = crypto.createHash('sha256').update(`${token}:${expira}:${salt}`).digest('hex');
    const sesion = Buffer.from(JSON.stringify({ token, expira, firma })).toString('base64');
    await page.addInitScript(([s]) => sessionStorage.setItem('isbo_auth_session', s), [sesion]);
    await sembrar(page, { avisos: [AVISO_HOSTIL] });
    await page.goto('/avisos.html');
    await page.waitForTimeout(800);
    await expect(page.locator('#lista-avisos-activos, #admin-root').first()).toBeVisible();
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('body')).toContainText('<img src=x');
  });
});

test.describe('Acceso al panel', () => {
  test('sin sesión se muestra el login y no el panel', async ({ page }) => {
    await aislarRed(page);
    await page.goto('/avisos.html');
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#lista-avisos-activos')).toHaveCount(0);
  });

  test('credenciales incorrectas muestran error y no abren sesión', async ({ page }) => {
    await aislarRed(page);
    await page.goto('/avisos.html');
    await page.fill('#login-usuario', 'intruso');
    await page.fill('#login-password', 'incorrecta');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Usuario o contraseña incorrectos.')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('isbo_auth_session'))).toBeNull();
  });

  test('una sesión con firma alterada es rechazada', async ({ page }) => {
    await aislarRed(page);
    const js = fs.readFileSync('js/avisos-admin.js', 'utf8');
    const token = /validTokens:\s*\[\s*'([0-9a-f]{64})'/.exec(js)[1];
    const falsa = Buffer.from(JSON.stringify({ token, expira: Date.now() + 3600000, firma: 'f'.repeat(64) })).toString('base64');
    await page.addInitScript(([s]) => sessionStorage.setItem('isbo_auth_session', s), [falsa]);
    await page.goto('/avisos.html');
    await expect(page.locator('#login-password')).toBeVisible();
  });
});
