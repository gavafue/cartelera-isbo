const { test, expect } = require('@playwright/test');
const { aislarRed } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await aislarRed(page);
  await page.goto('/index.html');
});

const ref = '2026-10-18T12:00:00';

test.describe('SheetAPI.parsearFecha', () => {
  const casos = [
    ['8 de octubre', [2026, 9, 8]],
    ['jueves 8 de octubre', [2026, 9, 8]],
    ['08/10/2026', [2026, 9, 8]],
    ['8/10/26', [2026, 9, 8]],
    ['2026-10-08', [2026, 9, 8]],
    ['8 oct 26', [2026, 9, 8]],
    ['solo hoy', [2026, 9, 18]],
    ['mañana', [2026, 9, 19]]
  ];
  for (const [entrada, [y, m, d]] of casos) {
    test(`interpreta "${entrada}"`, async ({ page }) => {
      const r = await page.evaluate(([e, r]) => {
        const f = window.SheetAPI.parsearFecha(e, new Date(r));
        return f && [f.getFullYear(), f.getMonth(), f.getDate()];
      }, [entrada, ref]);
      expect(r).toEqual([y, m, d]);
    });
  }

  for (const invalida of ['2026-13-40', '31/02/2026', '45/13/2026', 'texto sin fecha', '']) {
    test(`rechaza fecha inválida "${invalida}"`, async ({ page }) => {
      const r = await page.evaluate(([e, r]) => {
        const f = window.SheetAPI.parsearFecha(e, new Date(r));
        return f === null ? null : f.toISOString();
      }, [invalida, ref]);
      expect(r).toBeNull();
    });
  }

  test('rango "del 5 al 8 de octubre"', async ({ page }) => {
    const r = await page.evaluate((r) => {
      const { desde, hasta } = window.SheetAPI.parsearRangoFechas('del 5 al 8 de octubre', '', new Date(r));
      return [desde.getDate(), hasta.getDate(), hasta.getMonth()];
    }, ref);
    expect(r).toEqual([5, 8, 9]);
  });
});

test.describe('InasistenciasLogic', () => {
  test('estaAusente respeta los límites del rango', async ({ page }) => {
    const r = await page.evaluate(() => {
      const L = window.InasistenciasLogic;
      const d = (s) => new Date(s + 'T00:00:00');
      const doc = { desde: d('2026-10-10'), hasta: d('2026-10-12') };
      return [
        L.estaAusente(doc, d('2026-10-09')), L.estaAusente(doc, d('2026-10-10')),
        L.estaAusente(doc, d('2026-10-12')), L.estaAusente(doc, d('2026-10-13')),
        L.estaAusente({ desde: null, hasta: null }, d('2026-10-13')),
        L.estaAusente(null, d('2026-10-13'))
      ];
    });
    expect(r).toEqual([false, true, true, false, true, false]);
  });

  test('filtrarInasistenciasDeHoy tolera entradas que no son arreglos', async ({ page }) => {
    const r = await page.evaluate(() => [null, undefined, {}, 'x'].map((v) => window.InasistenciasLogic.filtrarInasistenciasDeHoy(v).length));
    expect(r).toEqual([0, 0, 0, 0]);
  });

  const grupos = [
    ['2mk', ['2° MK']], ['2°mk', ['2° MK']], ['2º mk', ['2° MK']], ['2-mk', ['2° MK']],
    ['1ero mm', ['1° MM']], ['3ro MG y MF', ['3° MG', '3° MF']],
    ['1 MG, 1MH, 1MI, 1 MK', ['1° MG', '1° MH', '1° MI', '1° MK']],
    ['3º MA 3º MB 3º MC', ['3° MA', '3° MB', '3° MC']],
    ['2mk / 3mk', ['2° MK', '3° MK']], ['FPB 1', ['FPB 1°']],
    ['Todos', ['TODOS LOS GRUPOS']], ['toda la escuela', ['TODOS LOS GRUPOS']], ['*', ['TODOS LOS GRUPOS']],
    ['', []]
  ];
  for (const [entrada, esperado] of grupos) {
    test(`extraerGrupos("${entrada}")`, async ({ page }) => {
      const r = await page.evaluate((e) => window.InasistenciasLogic.extraerGrupos(e), entrada);
      expect(r).toEqual(esperado);
    });
  }

  test('calcularEstado cubre los estados del período', async ({ page }) => {
    const r = await page.evaluate(() => {
      const L = window.InasistenciasLogic;
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const mas = (n) => { const x = new Date(hoy); x.setDate(x.getDate() + n); return x; };
      return [
        L.calcularEstado({ desde: null, hasta: null }, hoy).texto,
        L.calcularEstado({ desde: hoy, hasta: hoy }, hoy).texto,
        L.calcularEstado({ desde: mas(-2), hasta: hoy }, hoy).texto,
        L.calcularEstado({ desde: hoy, hasta: mas(1) }, hoy).texto,
        L.calcularEstado({ desde: hoy, hasta: mas(5) }, hoy).texto,
        L.calcularEstado({ desde: mas(-9), hasta: mas(-3) }, hoy).texto
      ];
    });
    expect(r).toEqual(['Período en curso', 'Solo por hoy', 'Último día', 'Hasta mañana', '5 días restantes', 'Finalizado']);
  });

  test('obtenerIniciales con nombres atípicos', async ({ page }) => {
    const r = await page.evaluate(() => ['Natalia Hernandez', 'Prince', '  ', '', null].map((n) => window.InasistenciasLogic.obtenerIniciales(n)));
    expect(r[0]).toBe('NH');
    expect(r[1]).toBe('PR');
    expect(r[3]).toBe('??');
    expect(r[4]).toBe('??');
  });
});
