/**
 * ============================================================================
 * Módulo: sheet.js
 * Responsabilidad: Conexión tolerante a fallos con Google Sheets:
 *                   - Mapeo dinámico de columnas (detecta nombres, grupos, fechas y avisos).
 *                   - Parser ultra-robusto de fechas y rangos escritos a mano.
 *                   - Extracción limpia de docentes y comunicados.
 * ============================================================================
 */

window.SheetAPI = (function () {
  const SPREADSHEET_ID = '1t83h87_A01gSG518nU7QtpCGMNHR7kRbB900l-18TIk';

  // Diccionario completo de meses en español (incluye variantes rioplatenses como 'setiembre')
  const MESES = {
    ene: 0, enero: 0,
    feb: 1, febrero: 1,
    mar: 2, marzo: 2,
    abr: 3, abril: 3,
    may: 4, mayo: 4,
    jun: 5, junio: 5,
    jul: 6, julio: 6,
    ago: 7, agosto: 7,
    set: 8, sep: 8, sept: 8, setiembre: 8, septiembre: 8,
    oct: 9, octubre: 9,
    nov: 10, noviembre: 10,
    dic: 11, diciembre: 11
  };

  /**
   * Parser ultra-robusto de fechas:
   * Capaz de interpretar cualquier formato ingresado por el personal administrativo:
   * - Seriales de Excel/Sheets (ej: 46303)
   * - Google Sheets: Date(2026, 9, 8)
   * - Numéricos: 08/10/2026, 8/10/2026, 08-10-2026, 8.10.26, 8/10
   * - Escritos: '8 de octubre', '08 de oct', 'jueves 8 de octubre', '8 oct 26'
   * - Palabras clave: 'hoy', 'solo hoy', 'por hoy', 'mañana'
   * - ISO: 2026-10-08
   */
  function parsearFechaToken(val, refDate = new Date()) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;

    // Números seriales de Excel/Sheets (días desde 1899-12-30)
    if (typeof val === 'number') {
      if (val > 30000 && val < 60000) {
        return new Date((val - 25569) * 86400 * 1000);
      }
      return new Date(val);
    }

    let str = String(val).trim().toLowerCase();
    if (!str) return null;

    // Quitar nombres de días en español que suelen agregar (ej: 'jueves 8 de octubre')
    str = str.replace(/^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+/i, '');

    // Palabras clave relativas
    if (str.includes('hoy')) {
      const hoy = new Date(refDate);
      hoy.setHours(0, 0, 0, 0);
      return hoy;
    }
    if (str.includes('mañana')) {
      const manana = new Date(refDate);
      manana.setDate(manana.getDate() + 1);
      manana.setHours(0, 0, 0, 0);
      return manana;
    }

    // Caso 1: Objeto Google Sheets Date(y, m, d)
    const gvizMatch = str.match(/date\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (gvizMatch) {
      return new Date(parseInt(gvizMatch[1], 10), parseInt(gvizMatch[2], 10), parseInt(gvizMatch[3], 10));
    }

    const anioActual = refDate.getFullYear();

    // Caso 2: Texto con nombre de mes: '8 de octubre', '8 oct', '08-oct-2026', '8 de setiembre'
    const textoMesMatch = str.match(/(\d{1,2})\s*(?:de|\/|-|\.)?\s*([a-záéíóú]{3,10})\s*(?:de|\/|-|\.)?\s*(\d{2,4})?/i);
    if (textoMesMatch) {
      const dia = parseInt(textoMesMatch[1], 10);
      const mesLimpio = textoMesMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let mesIdx = -1;
      for (const [clave, idx] of Object.entries(MESES)) {
        if (mesLimpio.startsWith(clave)) {
          mesIdx = idx;
          break;
        }
      }
      if (mesIdx !== -1) {
        let anio = anioActual;
        if (textoMesMatch[3]) {
          anio = parseInt(textoMesMatch[3], 10);
          if (anio < 100) anio += 2000;
        }
        return new Date(anio, mesIdx, dia);
      }
    }

    // Caso 3: Formato numérico separado por /, -, ., o espacios
    const partes = str.replace(/[^0-9\/\-\.]/g, ' ').split(/[\/\-\.\s]+/).filter(Boolean);
    if (partes.length >= 2) {
      // Formato ISO: AAAA-MM-DD
      if (partes[0].length === 4) {
        const y = parseInt(partes[0], 10);
        const m = parseInt(partes[1], 10) - 1;
        const d = parseInt(partes[2], 10);
        return new Date(y, m, d);
      }

      // Formato día / mes / año
      const dia = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1;
      let anio = anioActual;

      if (partes.length >= 3) {
        anio = parseInt(partes[2], 10);
        if (anio < 100) anio += 2000; // '26' -> 2026
      }

      if (!isNaN(dia) && !isNaN(mes) && dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
        return new Date(anio, mes, dia);
      }
    }

    return null;
  }

  /**
   * Extrae fechas desde dos celdas o desde una celda que contiene un rango escrito:
   * Ejemplo: Celda 'Desde' contiene "del 5 al 8 de octubre" y 'Hasta' está vacía.
   */
  function parsearRangoFechas(celdaDesde, celdaHasta, refDate = new Date()) {
    let desde = parsearFechaToken(celdaDesde, refDate);
    let hasta = parsearFechaToken(celdaHasta, refDate);

    // Si 'hasta' está vacía pero 'desde' contiene un rango textual completo
    if (!hasta && celdaDesde && typeof celdaDesde === 'string') {
      const s = celdaDesde.trim().toLowerCase();
      // Detectar expresiones como "del 5 al 8/10", "5/10 al 14/10", "5 a 8 de oct"
      const matchRango = s.match(/(?:del?\s+)?(.+?)\s+(?:al?|-)\s+(.+)/i);
      if (matchRango) {
        const d1 = parsearFechaToken(matchRango[1], refDate);
        const d2 = parsearFechaToken(matchRango[2], refDate);
        if (d1 || d2) {
          desde = d1 || desde;
          hasta = d2 || hasta;
        }
      }
    }

    return { desde, hasta };
  }

  /**
   * Detección dinámica y tolerante del encabezado y mapeo de columnas:
   * Evita fallos si Bedelía inserta o mueve columnas en la planilla.
   */
  function detectarMapeoColumnas(rows) {
    let colNombre = 0;
    let colGrupo = 1;
    let colDesde = 2;
    let colHasta = 3;
    let colAvisos = 5;
    let filaInicioDatos = 1;

    for (let rIdx = 0; rIdx < Math.min(rows.length, 4); rIdx++) {
      const row = rows[rIdx];
      if (!row || !row.c) continue;

      let coincidencias = 0;
      row.c.forEach((cell, cIdx) => {
        if (!cell) return;
        const val = String(cell.f || cell.v || '').trim().toLowerCase();
        // Los encabezados son etiquetas breves (menos de 25 caracteres)
        if (!val || val.length > 25) return;

        if (val.includes('nombre') || val.includes('docente') || val.includes('profesor') || val.includes('prof.')) {
          colNombre = cIdx;
          coincidencias++;
        } else if ((val.includes('grupo') || val.includes('curso') || val === 'clase' || val === 'clases') && !val.includes('no hay')) {
          colGrupo = cIdx;
          coincidencias++;
        } else if (val.includes('desde') || val.includes('inicio') || val === 'del') {
          colDesde = cIdx;
          coincidencias++;
        } else if (val.includes('hasta') || val.includes('fin') || val === 'al') {
          colHasta = cIdx;
          coincidencias++;
        } else if (val.includes('aviso') || val.includes('comunicado') || val.includes('atenci') || val.includes('novedad')) {
          colAvisos = cIdx;
        }
      });

      if (coincidencias >= 2) {
        filaInicioDatos = rIdx + 1;
        break;
      }
    }

    return { colNombre, colGrupo, colDesde, colHasta, colAvisos, filaInicioDatos };
  }

  // Procesa las filas crudas descargadas de Google Sheets
  function procesarFilas(rows) {
    const docentes = [];
    const avisosSet = new Set();
    let fechaTexto = '';

    if (!Array.isArray(rows) || rows.length === 0) {
      return { fechaTexto, docentes, avisos: [] };
    }

    // 1. Detección inteligente de columnas
    const mapeo = detectarMapeoColumnas(rows);

    // 2. Extraer fecha oficial si la planilla tiene celda "Hoy es..."
    rows.forEach(r => {
      if (!r || !r.c) return;
      r.c.forEach(cell => {
        if (!cell) return;
        const v = String(cell.f || cell.v || '').trim();
        if (v.toLowerCase().includes('hoy es')) {
          fechaTexto = v;
        }
      });
    });

    // 3. Procesar filas de docentes y avisos
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.c) continue;

      // Obtener valores de texto crudo de las celdas
      const obtenerVal = (col) => {
        const cell = r.c[col];
        if (!cell) return '';
        return String(cell.f || cell.v || '').trim();
      };

      const rawNombre = obtenerVal(mapeo.colNombre);
      const rawGrupo = obtenerVal(mapeo.colGrupo);
      const rawDesde = obtenerVal(mapeo.colDesde);
      const rawHasta = obtenerVal(mapeo.colHasta);

      // Solo procesar como docente si la fila está dentro del rango de datos
      if (i < mapeo.filaInicioDatos) continue;

      // Filtrar filas inválidas o de encabezado
      const lowerNom = rawNombre.toLowerCase();
      const esInvalido = !rawNombre ||
        rawNombre.length < 3 ||
        lowerNom.includes('nombre') ||
        lowerNom.includes('apellido') ||
        lowerNom.includes('docente') ||
        lowerNom.includes('profesor') ||
        lowerNom.includes('fecha') ||
        lowerNom.includes('hoy es') ||
        lowerNom.includes('total') ||
        lowerNom.includes('firma');

      if (esInvalido) continue;

      // Parsear fechas y posibles rangos
      const { desde, hasta } = parsearRangoFechas(rawDesde, rawHasta);

      docentes.push({
        id: i,
        nombre: rawNombre,
        grupo: rawGrupo || 'TODOS',
        desde,
        hasta,
        rawDesde,
        rawHasta
      });
    }

    // Los avisos institucionales ahora se gestionan exclusivamente desde el formulario
    return {
      fechaTexto,
      docentes,
      avisos: []
    };
  }

  // Procesa las filas de la pestaña Avisos en Google Sheets
  function procesarFilasAvisos(rows) {
    if (rows === null) {
      return null;
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    let colTitulo = 0;
    let colMensaje = 1;
    let colCategoria = 2;
    let colQr = 3;
    let colActivo = 4;
    let colFecha = 5;
    let filaInicio = 0;
    let tieneHeaderAvisos = false;

    // Detectar si la primera fila es encabezado
    const r0 = rows[0];
    if (r0 && r0.c) {
      r0.c.forEach((cell, cIdx) => {
        if (!cell) return;
        const val = String(cell.f || cell.v || '').trim().toLowerCase();
        if (val.includes('título') || val.includes('titulo') || val.includes('asunto') || val.includes('tema')) {
          colTitulo = cIdx;
          tieneHeaderAvisos = true;
        } else if (val.includes('mensaje') || val.includes('texto') || val.includes('detalle') || val.includes('descripci') || val.includes('comunicado')) {
          colMensaje = cIdx;
          tieneHeaderAvisos = true;
        } else if (val.includes('categor') || val.includes('prioridad') || val.includes('tipo')) {
          colCategoria = cIdx;
        } else if (val.includes('qr') || val.includes('enlace') || val.includes('link') || val.includes('url')) {
          colQr = cIdx;
        } else if (val.includes('activo') || val.includes('estado') || val.includes('publicado') || val.includes('visible')) {
          colActivo = cIdx;
        } else if (val.includes('fecha') || val.includes('cread') || val.includes('date') || val.includes('time')) {
          colFecha = cIdx;
        }
      });
      if (tieneHeaderAvisos) {
        filaInicio = 1;
      }
    }

    // Si la hoja no tiene las columnas esperadas de Avisos, no sobreescribir
    if (!tieneHeaderAvisos) {
      return null;
    }

    const avisos = [];
    const firmasVistas = new Set();
    for (let i = filaInicio; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.c) continue;

      const obtenerVal = (col) => {
        if (col === -1 || col === undefined) return '';
        const cell = r.c[col];
        if (!cell) return '';
        return String(cell.f || cell.v || '').trim();
      };

      const titulo = obtenerVal(colTitulo);
      const mensaje = obtenerVal(colMensaje);
      const categoriaRaw = obtenerVal(colCategoria);
      const qrUrl = obtenerVal(colQr);
      const activoRaw = obtenerVal(colActivo).toLowerCase();
      const fechaCreacion = obtenerVal(colFecha);

      // Si no hay ni título ni mensaje, ignorar fila vacía
      if (!titulo && !mensaje) continue;

      // Descartar filas duplicadas por contenido
      const firma = titulo.toLowerCase() + ':::' + mensaje.toLowerCase();
      if (firmasVistas.has(firma)) {
        continue;
      }
      firmasVistas.add(firma);

      // Determinar si está activo (por defecto activo salvo que diga no, pausa, oculto, etc.)
      let activo = true;
      if (activoRaw && ['no', 'pausado', 'pausa', 'false', '0', 'inactivo', 'oculto'].includes(activoRaw)) {
        activo = false;
      }

      // Normalizar categoría
      let categoria = 'avisos';
      if (categoriaRaw) {
        if (typeof InasistenciasLogic !== 'undefined' && InasistenciasLogic.normalizarCategoria) {
          categoria = InasistenciasLogic.normalizarCategoria(categoriaRaw);
        } else {
          const c = categoriaRaw.toLowerCase();
          if (['urgente', 'atencion', 'avisos', 'informacion', 'tramites', 'examenes'].includes(c)) {
            categoria = c;
          }
        }
      } else if (mensaje && typeof InasistenciasLogic !== 'undefined' && InasistenciasLogic.clasificarAvisoTexto) {
        categoria = InasistenciasLogic.clasificarAvisoTexto(titulo + ' ' + mensaje);
      }

      avisos.push({
        id: 'aviso-sheet-' + (i + 1),
        titulo: titulo || 'Aviso Institucional',
        mensaje: mensaje || '',
        prioridad: categoria,
        tieneQr: Boolean(qrUrl),
        qrUrl: qrUrl || '',
        activo: activo,
        fechaCreacion: fechaCreacion || new Date().toISOString(),
        fuente: 'google-sheets'
      });
    }

    return avisos;
  }

  // Descarga las filas crudas de una hoja de Google Sheets vía JSONP con fallback a fetch
  function cargarFilas(sheetId, sheetName = '') {
    return new Promise((resolve) => {
      const nombreCallback = 'callback_sheets_' + Math.floor(Math.random() * 1000000);
      const script = document.createElement('script');
      const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
      const nonce = Date.now() + '_' + Math.random().toString(36).substring(2, 8);

      let resuelto = false;
      let timerTimeout = null;

      const fallbackFetch = async () => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(timerTimeout);
        script.remove();
        delete window[nombreCallback];
        try {
          const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=0${sheetParam}&_t=${Date.now()}&_nocache=${nonce}`;
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) {
            resolve(null);
            return;
          }
          const texto = await res.text();
          const json = JSON.parse(texto.replace(/^[\s\S]*setResponse\(/, '').replace(/\);?\s*$/, ''));
          if (json && json.status === 'ok' && json.table) {
            resolve(json.table.rows || []);
          } else {
            resolve(null);
          }
        } catch (err) {
          resolve(null);
        }
      };

      window[nombreCallback] = function (respuesta) {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(timerTimeout);
        script.remove();
        delete window[nombreCallback];
        if (respuesta && respuesta.status === 'ok' && respuesta.table) {
          resolve(respuesta.table.rows || []);
        } else {
          resolve(null);
        }
      };

      script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${nombreCallback}&headers=0${sheetParam}&_t=${Date.now()}&_nocache=${nonce}`;
      script.onerror = () => {
        if (!resuelto) fallbackFetch();
      };

      // Tolerancia generosa de 12 segundos para redes móviles y wifi escolar antes de fallback
      timerTimeout = setTimeout(() => {
        if (!resuelto) fallbackFetch();
      }, 12000);

      document.head.appendChild(script);
    });
  }

  // Obtiene las inasistencias docentes (primera hoja)
  async function obtenerDatos() {
    const rows = await cargarFilas(SPREADSHEET_ID, '');
    if (rows === null) return { docentes: [] };
    return procesarFilas(rows);
  }

  // Obtiene los comunicados institucionales desde la pestaña 'Avisos'
  async function obtenerAvisos() {
    const rows = await cargarFilas(SPREADSHEET_ID, 'Avisos');
    if (rows === null) return null;
    return procesarFilasAvisos(rows);
  }

  return {
    obtenerDatos,
    obtenerAvisos,
    parsearFecha: parsearFechaToken,
    parsearRangoFechas
  };
})();
