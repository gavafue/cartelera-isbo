/**
 * ============================================================================
 * Módulo: inasistencias.js
 * Responsabilidad: Lógica de inasistencias de hoy, normalizador tolerante de
 *                   grupos, clasificador de avisos en 6 categorías educativas
 *                   y persistencia en LocalStorage.
 * ============================================================================
 */

window.InasistenciasLogic = (function () {
  const STORAGE_AVISOS = 'isbo_avisos_manuales';

  // Normaliza fecha a medianoche para comparación limpia
  function normalizar(d) {
    if (!d) return null;
    const copia = new Date(d);
    copia.setHours(0, 0, 0, 0);
    return copia;
  }

  // Comprueba si un docente está ausente hoy (o en una fecha dada)
  function estaAusente(docente, fechaObjetivo = new Date()) {
    if (!docente) return false;
    const hoy = normalizar(fechaObjetivo);
    const d = normalizar(docente.desde);
    const h = normalizar(docente.hasta);

    // Si no tiene fechas especificadas pero está en la lista de inasistencias, se asume ausente
    if (!d && !h) return true;

    // Si tiene fecha de inicio y aún no comenzó
    if (d && hoy < d) return false;

    // Si tiene fecha de fin y ya terminó
    if (h && hoy > h) return false;

    // Si solo tiene 'hasta' y la fecha es hoy o posterior
    if (!d && h && hoy <= h) return true;

    // Si solo tiene 'desde' y la fecha es hoy o posterior
    if (d && !h && hoy >= d) return true;

    return true;
  }

  // Filtra únicamente los docentes ausentes en el día de hoy
  function filtrarInasistenciasDeHoy(listaDocentes, fecha = new Date()) {
    if (!Array.isArray(listaDocentes)) return [];
    return listaDocentes.filter(d => estaAusente(d, fecha));
  }

  /**
   * Normalización y extracción ultra-robusta de grupos:
   * Interpreta todas las formas posibles de ingreso por el personal:
   * - 'Todos', 'TODOS ', 'todos los grupos', 'toda la escuela', '*' -> ['TODOS LOS GRUPOS']
   * - '2mk', '2°mk', '2ºmk', '2º mk', '2-mk' -> ['2° MK']
   * - '1ero mm', '2do mk', '3ero mb' -> ['1° MM', '2° MK', '3° MB']
   * - '1 MG, 1MH, 1MI, 1 MK' -> ['1° MG', '1° MH', '1° MI', '1° MK']
   * - '3º MA 3º MB 3º MC' -> ['3° MA', '3° MB', '3° MC']
   * - '1°A y 1°B' / '2mk / 3mk' -> ['1° A', '1° B'] / ['2° MK', '3° MK']
   * - 'FPB 1', 'EMP 2' -> ['FPB 1°', 'EMP 2°']
   */
  function esTodosLosGrupos(texto) {
    if (!texto) return false;
    const s = String(texto).trim().toLowerCase();
    return (
      s === '*' ||
      s.includes('todo') ||
      s.includes('toda') ||
      s.includes('gral') ||
      s.includes('general') ||
      s.includes('institucional') ||
      s.includes('completo')
    );
  }

  function extraerGrupos(texto) {
    if (!texto) return [];
    const raw = String(texto).trim();
    if (!raw) return [];

    if (esTodosLosGrupos(raw)) {
      return ['TODOS LOS GRUPOS'];
    }

    // 1. Limpieza y normalización previa
    let limpio = raw
      // Tildes y caracteres de teclado alternativos para ordinales (~, ^, *)
      .replace(/(\d+)\s*[\~|\^|\*]\s*/g, '$1° ')
      // Palabras de ruido: año, ano, anio, grado, curso, nivel
      .replace(/\b(?:año|anio|ano|grado|curso|nivel)s?\b\.?/gi, ' ')
      // Ordinales en letras: 1ero, 1er, 2do, 3ro, 4to, 5to, 6to (con o sin punto)
      .replace(/(\d+)\s*(?:ero|er|ro|do|to)\b\.?/gi, '$1° ')
      // Normalizar signos de grado
      .replace(/(\d+)\s*[º°]\s*/g, '$1° ')
      // Separar números pegados a letras si no hay espacio (ej: 3mg -> 3° MG, 3mf -> 3° MF)
      .replace(/(^|[\s,;\/\+\-])(\d+)\s*([a-zA-Z]{1,4})(?=[,\s;\/\+\-]|$)/g, '$1$2° $3');

    // 2. Separar en segmentos por separadores habituales: comas, punto y coma, barras, signos más, 'y', 'e', guiones entre espacios
    const segmentos = limpio
      .split(/[,;\/\+\n]|\s+[ye]\s+|\s+-\s+/i)
      .map(t => t.trim())
      .filter(Boolean);

    const resultado = [];
    let ultimoAnio = null;

    segmentos.forEach(seg => {
      // Caso A: Tiene número de año explícito + letras: ej '3° MG', '1° MI', '2° MF'
      const matchConAnio = seg.match(/^(\d+)\s*(?:°)?\s*([a-zA-Z0-9]+)$/);
      if (matchConAnio) {
        ultimoAnio = matchConAnio[1];
        resultado.push(`${ultimoAnio}° ${matchConAnio[2].toUpperCase()}`);
        return;
      }

      // Caso B: Múltiples grupos juntos en un mismo segmento: ej '3° MG 3° MF'
      const matchesMulti = [...seg.matchAll(/(\d+)\s*(?:°)?\s*([a-zA-Z0-9]+)/g)];
      if (matchesMulti.length > 0) {
        matchesMulti.forEach(m => {
          ultimoAnio = m[1];
          resultado.push(`${m[1]}° ${m[2].toUpperCase()}`);
        });
        return;
      }

      // Caso C: Cursos especiales con siglas iniciales como 'FPB 1', 'EMP 2', 'EMT 3'
      const matchEspecial = seg.match(/^([a-zA-Z\.\s]+?)\s*(\d+)$/);
      if (matchEspecial && !['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].includes(matchEspecial[1].trim().toUpperCase())) {
        resultado.push(`${matchEspecial[1].trim().toUpperCase()} ${matchEspecial[2]}°`);
        return;
      }

      // Caso D: Letras solas (ej 'MF', 'B', 'MG', 'C') que heredan el año del grupo anterior (ej: '3ro MG y MF' -> '3° MG' y '3° MF')
      const matchSoloLetras = seg.match(/^([a-zA-Z0-9]+)$/);
      if (matchSoloLetras && ultimoAnio) {
        resultado.push(`${ultimoAnio}° ${matchSoloLetras[1].toUpperCase()}`);
        return;
      }

      // Caso E: Si no calza pero tiene contenido, agregarlo limpio en mayúsculas
      if (seg) {
        resultado.push(seg.toUpperCase());
      }
    });

    // Eliminar duplicados si los hubiera preservando el orden
    const unicos = [...new Set(resultado)];
    return unicos.length > 0 ? unicos : [raw.toUpperCase()];
  }

  // Calcula la duración o badge para mostrar (ej: "Solo por hoy", "Solo por mañana", "Último día", etc.)
  function calcularEstado(docente, fechaObjetivo = new Date()) {
    if (!docente.hasta) {
      return { texto: 'Período en curso', clase: 'bg-slate-100 text-slate-700 border-slate-200' };
    }

    const hoy = normalizar(fechaObjetivo);
    const d = normalizar(docente.desde);
    const h = normalizar(docente.hasta);
    const fechaActual = normalizar(new Date());
    const esHoy = fechaActual && hoy && (fechaActual.getTime() === hoy.getTime());

    const diferenciaDias = Math.round((h.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diferenciaDias === 0) {
      if (d && d.getTime() === h.getTime()) {
        return { 
          texto: esHoy ? 'Solo por hoy' : 'Solo por mañana', 
          clase: esHoy ? 'bg-red-50 text-red-700 border-red-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200' 
        };
      }
      return { texto: 'Último día', clase: 'bg-amber-100 text-amber-800 border-amber-300' };
    } else if (diferenciaDias === 1) {
      return { 
        texto: esHoy ? 'Hasta mañana' : '1 día restante', 
        clase: 'bg-amber-50 text-amber-800 border-amber-200' 
      };
    } else if (diferenciaDias > 1) {
      return { texto: `${diferenciaDias} días restantes`, clase: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    return { texto: 'Finalizado', clase: 'bg-gray-100 text-gray-400 border-gray-200' };
  }

  // Genera iniciales (ej: "Natalia Hernandez" -> "NH")
  function obtenerIniciales(nombre) {
    if (!nombre) return '??';
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  const COLORES_AVATAR = [
    'bg-indigo-600', 'bg-purple-600', 'bg-blue-600',
    'bg-pink-600', 'bg-emerald-600', 'bg-teal-600'
  ];

  function obtenerColor(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORES_AVATAR[Math.abs(hash) % COLORES_AVATAR.length];
  }

  // Formateo de fecha en español
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  function formatearFecha(fecha = new Date()) {
    const d = new Date(fecha);
    const diaNom = DIAS[d.getDay()];
    const diaNum = d.getDate();
    const mesNom = MESES[d.getMonth()];
    return `${diaNom} ${diaNum} de ${mesNom}`;
  }

  // Formato uruguayo para encabezado dinámico de la próxima jornada: "Inasistencias Mañana · [día] [d/m]"
  function formatearEncabezadoManana(fecha = new Date()) {
    const d = new Date(fecha);
    const diasMin = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const diaNom = diasMin[d.getDay()];
    const diaNum = d.getDate();
    const mesNum = (d.getMonth() + 1).toString().padStart(2, '0');
    return `Inasistencias Mañana · ${diaNom} ${diaNum}/${mesNum}`;
  }

  // Formato compacto para subtítulo de próxima jornada: "Jueves 15/10 · Previsión"
  function formatearFechaCortaConDia(fecha = new Date()) {
    const d = new Date(fecha);
    const diaNom = DIAS[d.getDay()];
    const diaNum = d.getDate();
    const mesNum = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${diaNom} ${diaNum}/${mesNum} · Previsión`;
  }

  /**
   * ==========================================================================
   * 6 CATEGORÍAS EDUCATIVAS OFICIALES (Cada una con un color distintivo)
   * ==========================================================================
   * 1. 🔴 Urgente (Rojo)       -> Suspensiones, paros, corte de luz/agua, alertas
   * 2. 🟠 Atención (Naranja)   -> Salas docentes, ATD institucional, elecciones
   * 3. 🟣 Avisos (Púrpura)     -> Comunicados generales de dirección y adscripción
   * 4. 🔵 Información (Azul)   -> Vida estudiantil, normas, conectividad, biblioteca
   * 5. 🟢 Trámites (Verde)     -> Boletos de transporte, pases, becas, constancias
   * 6. 🟡 Exámenes (Amarillo)  -> Mesas de examen, tribunales, períodos de prueba
   */
  const CATEGORIAS_AVISO = {
    urgente: {
      id: 'urgente',
      nombre: 'Urgente',
      colorBadge: 'bg-black/30 text-white',
      badgeTexto: '🔴 URGENTE',
      cardBg: 'bg-gradient-to-br from-red-600 to-rose-700 text-white border-2 border-red-700',
      tituloCol: 'text-white',
      mensajeCol: 'text-white/95',
      descripcion: 'Suspensiones, paros y emergencias'
    },
    atencion: {
      id: 'atencion',
      nombre: 'Atención',
      colorBadge: 'bg-black/25 text-amber-100',
      badgeTexto: '🟠 ATENCIÓN',
      cardBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-2 border-amber-600',
      tituloCol: 'text-white',
      mensajeCol: 'text-white/95',
      descripcion: 'ATD, salas docentes y horarios'
    },
    avisos: {
      id: 'avisos',
      nombre: 'Avisos',
      colorBadge: 'bg-black/25 text-purple-100',
      badgeTexto: '🟣 AVISOS',
      cardBg: 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-2 border-purple-700',
      tituloCol: 'text-white',
      mensajeCol: 'text-white/95',
      descripcion: 'Comunicados de adscripción y dirección'
    },
    informacion: {
      id: 'informacion',
      nombre: 'Información',
      colorBadge: 'bg-black/25 text-blue-100',
      badgeTexto: '🔵 INFORMACIÓN',
      cardBg: 'bg-gradient-to-br from-[#00489A] to-[#003878] text-white border-2 border-[#00489A]',
      tituloCol: 'text-white',
      mensajeCol: 'text-white/95',
      descripcion: 'Información general y biblioteca'
    },
    tramites: {
      id: 'tramites',
      nombre: 'Trámites',
      colorBadge: 'bg-black/25 text-emerald-100',
      badgeTexto: '🟢 TRÁMITES',
      cardBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-2 border-emerald-700',
      tituloCol: 'text-white',
      mensajeCol: 'text-white/95',
      descripcion: 'Boletos, becas y constancias'
    },
    examenes: {
      id: 'examenes',
      nombre: 'Exámenes',
      colorBadge: 'bg-black/20 text-slate-900',
      badgeTexto: '🟡 EXÁMENES',
      cardBg: 'bg-gradient-to-br from-yellow-400 via-amber-400 to-amber-500 text-slate-900 border-2 border-amber-500',
      tituloCol: 'text-slate-900',
      mensajeCol: 'text-slate-800',
      descripcion: 'Mesas de examen y tribunales'
    }
  };

  // Normaliza identificadores de categoría y admite compatibilidad retrospectiva
  function normalizarCategoria(cat) {
    if (!cat) return 'informacion';
    const c = String(cat).toLowerCase().trim();
    if (c === 'critica' || c === 'urgente' || c === 'urgencias') return 'urgente';
    if (c === 'alta' || c === 'atencion' || c === 'atención') return 'atencion';
    if (c === 'aviso' || c === 'avisos' || c === 'comunicado' || c === 'comunicados') return 'avisos';
    if (c === 'media' || c === 'tramites' || c === 'trámites' || c === 'tramite') return 'tramites';
    if (c === 'examenes' || c === 'exámenes' || c === 'examen' || c === 'evaluaciones') return 'examenes';
    if (c === 'baja' || c === 'informacion' || c === 'información' || c === 'general') return 'informacion';
    return 'informacion';
  }

  function obtenerConfiguracionCategoria(cat) {
    const id = normalizarCategoria(cat);
    return CATEGORIAS_AVISO[id] || CATEGORIAS_AVISO.informacion;
  }

  // Clasifica automáticamente textos libres (ej: avisos de Google Sheets) en una categoría
  function clasificarAvisoTexto(texto) {
    const t = String(texto || '').toLowerCase();
    if (t.includes('urgente') || t.includes('suspensi') || t.includes('alerta') || t.includes('paro') || t.includes('emergencia')) {
      return 'urgente';
    }
    if (t.includes('atenci') || t.includes('atd') || t.includes('no hay clases') || t.includes('asamblea') || t.includes('sala docente')) {
      return 'atencion';
    }
    if (t.includes('examen') || t.includes('mesa') || t.includes('tribunal') || t.includes('evaluaci') || t.includes('prueba')) {
      return 'examenes';
    }
    if (t.includes('boleto') || t.includes('formulario') || t.includes('beca') || t.includes('constancia') || t.includes('trámite') || t.includes('tramite') || t.includes('inscripci')) {
      return 'tramites';
    }
    if (t.includes('aviso') || t.includes('recordatorio') || t.includes('comunicado') || t.includes('feriado') || t.includes('día de')) {
      return 'avisos';
    }
    return 'informacion';
  }

  // Sin avisos mock por defecto (la cartelera solo muestra comunicados reales cargados)
  const AVISOS_POR_DEFECTO = [];
  const STORAGE_APPS_SCRIPT = 'isbo_apps_script_url';
  const URL_APPS_SCRIPT_DEFAULT = 'https://script.google.com/macros/s/AKfycby7Cqt6FB1km9dH8iN6GV0eATxesGtarrsEBNPx8KzJC2J-3DhTCnYxAbKHezrZp0IDIw/exec';

  function obtenerUrlAppsScript() {
    return localStorage.getItem(STORAGE_APPS_SCRIPT) || URL_APPS_SCRIPT_DEFAULT;
  }

  function guardarUrlAppsScript(url) {
    localStorage.setItem(STORAGE_APPS_SCRIPT, (url || '').trim());
  }

  let hayCambiosPendientesRemotos = false;

  // Guarda la lista completa en Google Sheets mediante Google Apps Script Web App con timeout estricto
  async function guardarAvisosEnGoogleSheets(lista, timeoutMs = 5000) {
    const url = obtenerUrlAppsScript();
    if (!url) return { ok: false, error: 'sin_url_script' };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timerId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          action: 'sync_all',
          avisos: lista
        })
      });
      if (timerId) clearTimeout(timerId);
      hayCambiosPendientesRemotos = false;
      return { ok: true };
    } catch (err) {
      if (timerId) clearTimeout(timerId);
      hayCambiosPendientesRemotos = true;
      const esTimeout = err && (err.name === 'AbortError' || String(err).includes('abort'));
      const errorMsg = esTimeout
        ? 'Tiempo de espera agotado con Google Sheets'
        : (err.message || 'Error de conexión');
      console.warn('Error al guardar en Google Apps Script:', errorMsg);
      return { ok: false, error: errorMsg, timeout: esTimeout };
    }
  }

  function obtenerAvisosGuardados() {
    try {
      const data = localStorage.getItem(STORAGE_AVISOS);
      if (!data || data === '[]' || data === 'null') {
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [];
      }
      // Limpiar avisos obsoletos de prueba y garantizar unicidad estricta (sin duplicados)
      let huboReparacion = false;
      const idsVistos = new Set();
      const firmasVistas = new Set();
      const sanitizados = [];

      for (let i = 0; i < parsed.length; i++) {
        const a = parsed[i];
        if (!a || typeof a !== 'object') continue;
        if (['aviso-atd', 'aviso-feriado', 'aviso-boletos'].includes(a.id)) {
          huboReparacion = true;
          continue;
        }

        const idActual = String(a.id || '').trim();
        const firma = ((a.titulo || '').trim().toLowerCase()) + ':::' + ((a.mensaje || '').trim().toLowerCase());

        // Si el ID ya fue visto o el contenido es exactamente idéntico, descartar duplicado
        if ((idActual && idsVistos.has(idActual)) || firmasVistas.has(firma)) {
          huboReparacion = true;
          continue;
        }

        let item = { ...a };
        if (!idActual) {
          item.id = 'aviso-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substring(2, 7);
          huboReparacion = true;
        } else {
          item.id = idActual;
        }

        idsVistos.add(item.id);
        firmasVistas.add(firma);
        sanitizados.push(item);
      }

      if (huboReparacion) {
        localStorage.setItem(STORAGE_AVISOS, JSON.stringify(sanitizados));
      }
      return sanitizados;
    } catch (e) {
      return [];
    }
  }

  function obtenerAvisoPorId(id) {
    if (!id) return null;
    const idBuscado = String(id).trim();
    const lista = obtenerAvisosGuardados();
    return lista.find(a => String(a.id || '').trim() === idBuscado) || null;
  }

  // Período de gracia tras modificación local en este dispositivo
  // (15 segundos para dar tiempo a que Apps Script escriba en la planilla)
  const COOLDOWN_MODIFICACION_LOCAL_MS = 15000;
  let timestampUltimaModificacion = 0;

  function registrarModificacionLocal() {
    timestampUltimaModificacion = Date.now();
  }

  function modificacionLocalReciente() {
    return (Date.now() - timestampUltimaModificacion) < COOLDOWN_MODIFICACION_LOCAL_MS;
  }

  // Sincroniza avisos con Google Sheets (pestaña 'Avisos') o backend
  async function sincronizarAvisosConServidor() {
    // Si tenemos cambios locales pendientes de enviar a Google Sheets, reintentar primero
    if (hayCambiosPendientesRemotos && verificarSesionAdmin()) {
      try {
        const pendientes = obtenerAvisosGuardados();
        const resSync = await guardarAvisosEnGoogleSheets(pendientes, 5000);
        if (resSync && resSync.ok) {
          hayCambiosPendientesRemotos = false;
          console.info('Sincronización pendiente con Google Sheets completada con éxito.');
        }
      } catch (errSync) {
        console.warn('Reintento de sincronización pendiente pospuesto:', errSync);
      }
    }

    // Si hubo una modificación local reciente en este mismo dispositivo (últimos 15s),
    // protegemos la memoria local contra sobreescrituras remotas prematuras.
    if (modificacionLocalReciente()) {
      return { ok: true, avisos: obtenerAvisosGuardados(), cambio: false, fuente: 'local-reciente-protegido' };
    }

    try {
      // 1. Prioridad: Pestaña 'Avisos' de la planilla Google Sheets institucional
      if (typeof SheetAPI !== 'undefined' && typeof SheetAPI.obtenerAvisos === 'function') {
        const avisosSheet = await SheetAPI.obtenerAvisos();
        if (Array.isArray(avisosSheet)) {
          // Re-chequear que no haya ocurrido una modificación local mientras se descargaba
          if (modificacionLocalReciente()) {
            return { ok: true, avisos: obtenerAvisosGuardados(), cambio: false, fuente: 'local-reciente-protegido' };
          }

          const anteriorStr = localStorage.getItem(STORAGE_AVISOS) || '[]';
          let listaLocal = [];
          try { listaLocal = JSON.parse(anteriorStr); } catch (e) { listaLocal = []; }

          // Filtrar filas duplicadas que pudieran venir de Google Sheets
          const avisosUnicosSheet = [];
          const firmasRemotas = new Set();
          for (const r of avisosSheet) {
            if (!r) continue;
            const f = ((r.titulo || '').trim().toLowerCase()) + ':::' + ((r.mensaje || '').trim().toLowerCase());
            if (firmasRemotas.has(f)) continue;
            firmasRemotas.add(f);
            avisosUnicosSheet.push(r);
          }

          // Reconciliar avisos de Google Sheets preservando ID y QR Base64 local si coincide
          const avisosReconciliados = avisosUnicosSheet.map((remoto) => {
            const coincidente = Array.isArray(listaLocal) ? listaLocal.find(l =>
              (l && l.id && l.id === remoto.id) ||
              (l && (l.titulo || '').trim().toLowerCase() === (remoto.titulo || '').trim().toLowerCase() &&
                    (l.mensaje || '').trim().toLowerCase() === (remoto.mensaje || '').trim().toLowerCase())
            ) : null;

            return {
              ...remoto,
              id: (coincidente && coincidente.id) ? coincidente.id : remoto.id,
              qrImagen: (coincidente && coincidente.qrImagen) ? coincidente.qrImagen : (remoto.qrImagen || ''),
              fechaCreacion: (coincidente && coincidente.fechaCreacion) ? coincidente.fechaCreacion : (remoto.fechaCreacion || new Date().toISOString())
            };
          });

          const nuevoStr = JSON.stringify(avisosReconciliados);
          const huboCambio = anteriorStr !== nuevoStr;

          if (huboCambio) {
            localStorage.setItem(STORAGE_AVISOS, nuevoStr);
          }

          return { ok: true, avisos: avisosReconciliados, cambio: huboCambio, fuente: 'google-sheets' };
        }
      }

      // 2. Respaldo: endpoint local o avisos.json
      try {
        const res = await fetch('/api/avisos', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.avisos)) {
            if (modificacionLocalReciente()) {
              return { ok: true, avisos: obtenerAvisosGuardados(), cambio: false, fuente: 'local-reciente-protegido' };
            }
            const anteriorStr = localStorage.getItem(STORAGE_AVISOS) || '[]';
            const nuevoStr = JSON.stringify(data.avisos);
            const huboCambio = anteriorStr !== nuevoStr;
            if (huboCambio) {
              localStorage.setItem(STORAGE_AVISOS, nuevoStr);
            }
            return { ok: true, avisos: data.avisos, cambio: huboCambio, fuente: data.fuente || 'api' };
          }
        }
      } catch (errApi) {}
    } catch (e) {
      // Sin conexión o corriendo bajo protocolo file://
    }
    return { ok: false, avisos: obtenerAvisosGuardados(), cambio: false, fuente: 'local' };
  }

  const AUTH_STORAGE_KEY = 'isbo_auth_session';
  const VALID_AUTH_TOKENS = [
    'e0fda24bcf3cf6e95c7a214eaa29b1f634debda0ec921b7a4d231542c0eefc36'
  ];

  function obtenerTokenSesion() {
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return '';
      let json = raw;
      try { json = atob(raw); } catch (e) {}
      const data = JSON.parse(json);
      if (!data || !data.token || !data.expira) return '';
      if (Date.now() > data.expira) return '';
      if (!VALID_AUTH_TOKENS.includes(data.token)) return '';
      return data.token;
    } catch (e) {
      return '';
    }
  }

  function verificarSesionAdmin() {
    return Boolean(obtenerTokenSesion());
  }

  // Persiste la lista completa de avisos en Google Sheets (Apps Script) exclusivamente (sin doble POST)
  async function guardarAvisosEnServidor(lista) {
    if (!verificarSesionAdmin()) {
      console.warn('Operación bloqueada: Requiere sesión administrativa activa.');
      return { ok: false, error: 'no_autorizado' };
    }

    // Deduplicación estricta por contenido y por ID antes de persistir
    const vistos = new Set();
    const listaLimpia = [];
    for (const a of (lista || [])) {
      if (!a) continue;
      const firma = ((a.titulo || '').trim().toLowerCase()) + ':::' + ((a.mensaje || '').trim().toLowerCase());
      if (vistos.has(firma)) continue;
      vistos.add(firma);
      listaLimpia.push(a);
    }

    try {
      const res = await guardarAvisosEnGoogleSheets(listaLimpia);
      return res;
    } catch (e) {
      console.warn('Error al guardar avisos en servidor:', e);
      return { ok: false, error: e.message || 'Error de conexión con Google Sheets' };
    }
  }

  // Guardado optimista síncrono local (0 ms de demora, actualización instantánea)
  function guardarAvisoLocal(aviso) {
    if (!verificarSesionAdmin()) {
      console.warn('Operación bloqueada: Requiere sesión administrativa activa.');
      return null;
    }

    const lista = obtenerAvisosGuardados();
    const prioridadNormalizada = normalizarCategoria(aviso.prioridad);
    let avisoModificado = null;

    if (aviso.id) {
      // Edición de aviso existente por ID
      const index = lista.findIndex(a => a.id === aviso.id);
      if (index !== -1) {
        lista[index] = {
          ...lista[index],
          titulo: aviso.titulo || lista[index].titulo,
          prioridad: prioridadNormalizada,
          mensaje: aviso.mensaje || lista[index].mensaje,
          tieneQr: !!aviso.tieneQr,
          qrUrl: aviso.qrUrl !== undefined ? aviso.qrUrl : (lista[index].qrUrl || ''),
          qrImagen: aviso.qrImagen !== undefined ? aviso.qrImagen : (lista[index].qrImagen || ''),
          activo: aviso.activo !== undefined ? aviso.activo : lista[index].activo
        };
        avisoModificado = lista[index];
      }
    }

    if (!avisoModificado) {
      // Verificar si ya existe un aviso con idéntico título y mensaje para evitar duplicación accidental
      const tituloTrim = (aviso.titulo || '').trim().toLowerCase();
      const mensajeTrim = (aviso.mensaje || '').trim().toLowerCase();
      const indexExistente = lista.findIndex(a =>
        (a.titulo || '').trim().toLowerCase() === tituloTrim &&
        (a.mensaje || '').trim().toLowerCase() === mensajeTrim
      );

      if (indexExistente !== -1) {
        lista[indexExistente] = {
          ...lista[indexExistente],
          prioridad: prioridadNormalizada,
          tieneQr: !!aviso.tieneQr,
          qrUrl: aviso.qrUrl !== undefined ? aviso.qrUrl : (lista[indexExistente].qrUrl || ''),
          qrImagen: aviso.qrImagen !== undefined ? aviso.qrImagen : (lista[indexExistente].qrImagen || ''),
          activo: true
        };
        avisoModificado = lista[indexExistente];
      } else {
        // Creación de nuevo aviso con ID único garantizado (timestamp + random entropy)
        const nuevo = {
          id: 'aviso-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
          titulo: aviso.titulo || 'Aviso Institucional',
          prioridad: prioridadNormalizada,
          mensaje: aviso.mensaje || '',
          tieneQr: !!aviso.tieneQr,
          qrUrl: aviso.qrUrl || '',
          qrImagen: aviso.qrImagen || '',
          activo: true,
          fechaCreacion: new Date().toISOString()
        };
        lista.unshift(nuevo);
        avisoModificado = nuevo;
      }
    }

    localStorage.setItem(STORAGE_AVISOS, JSON.stringify(lista));
    registrarModificacionLocal();
    return { aviso: avisoModificado, lista };
  }

  // Conmutación optimista síncrona local de estado activo/pausado
  function conmutarEstadoAvisoLocal(id) {
    if (!verificarSesionAdmin()) {
      console.warn('Operación bloqueada: Requiere sesión administrativa activa.');
      return null;
    }

    if (!id || typeof id !== 'string') {
      console.warn('conmutarEstadoAvisoLocal: ID inválido');
      return null;
    }

    const idLimpio = id.trim();
    let lista = obtenerAvisosGuardados();
    const aviso = lista.find(a => String(a.id || '').trim() === idLimpio);
    if (aviso) {
      aviso.activo = aviso.activo === false ? true : false;
      localStorage.setItem(STORAGE_AVISOS, JSON.stringify(lista));
      registrarModificacionLocal();
    }
    return aviso;
  }

  // Eliminación optimista síncrona local (0 ms de demora)
  function eliminarAvisoLocal(id) {
    if (!verificarSesionAdmin()) {
      console.warn('Operación bloqueada: Requiere sesión administrativa activa.');
      return null;
    }

    if (!id || typeof id !== 'string') {
      console.warn('eliminarAvisoLocal: ID inválido o vacío');
      return obtenerAvisosGuardados();
    }

    const idLimpio = id.trim();
    let lista = obtenerAvisosGuardados();
    // Filtro estricto: solo se elimina el elemento con coincidencia exacta de ID
    lista = lista.filter(a => String(a.id || '').trim() !== idLimpio);
    localStorage.setItem(STORAGE_AVISOS, JSON.stringify(lista));
    registrarModificacionLocal();
    return lista;
  }

  // Vaciado optimista síncrono local
  function restaurarAvisosPorDefectoLocal() {
    if (!verificarSesionAdmin()) {
      console.warn('Operación bloqueada: Requiere sesión administrativa activa.');
      return [];
    }

    localStorage.setItem(STORAGE_AVISOS, JSON.stringify([]));
    registrarModificacionLocal();
    return [];
  }

  // Versiones asíncronas con guardado remoto (compatibilidad)
  async function guardarAviso(aviso) {
    const res = guardarAvisoLocal(aviso);
    if (!res) return null;
    await guardarAvisosEnServidor(res.lista);
    return res.aviso;
  }

  async function conmutarEstadoAviso(id) {
    const aviso = conmutarEstadoAvisoLocal(id);
    if (!aviso) return null;
    const lista = obtenerAvisosGuardados();
    await guardarAvisosEnServidor(lista);
    return aviso;
  }

  async function eliminarAviso(id) {
    const lista = eliminarAvisoLocal(id);
    if (!lista) return null;
    await guardarAvisosEnServidor(lista);
    return lista;
  }

  async function restaurarAvisosPorDefecto() {
    const lista = restaurarAvisosPorDefectoLocal();
    await guardarAvisosEnServidor(lista);
    return lista;
  }

  // Exporta los avisos actuales como cadena JSON para respaldo institucional
  function exportarAvisosJSON() {
    const lista = obtenerAvisosGuardados();
    return JSON.stringify(lista, null, 2);
  }

  // Importa y valida avisos desde un archivo o cadena JSON
  function importarAvisosJSON(jsonString) {
    try {
      const datos = JSON.parse(jsonString);
      if (!Array.isArray(datos)) {
        throw new Error('El archivo no contiene un formato de lista válido.');
      }
      const sanitizados = datos.map((a, i) => ({
        id: a.id || ('aviso-' + Date.now() + '-' + i),
        titulo: String(a.titulo || 'Comunicado Institucional').trim(),
        prioridad: normalizarCategoria(a.prioridad),
        mensaje: String(a.mensaje || '').trim(),
        tieneQr: !!a.tieneQr,
        qrUrl: a.qrUrl || '',
        qrImagen: a.qrImagen || '',
        activo: a.activo !== false,
        fechaCreacion: a.fechaCreacion || new Date().toISOString()
      }));
      localStorage.setItem(STORAGE_AVISOS, JSON.stringify(sanitizados));
      registrarModificacionLocal();
      guardarAvisosEnServidor(sanitizados);
      return sanitizados;
    } catch (err) {
      throw err;
    }
  }

  return {
    estaAusente,
    filtrarInasistenciasDeHoy,
    extraerGrupos,
    calcularEstado,
    obtenerIniciales,
    obtenerColor,
    formatearFecha,
    formatearFechaCortaConDia,
    formatearEncabezadoManana,
    CATEGORIAS_AVISO,
    normalizarCategoria,
    obtenerConfiguracionCategoria,
    clasificarAvisoTexto,
    obtenerAvisosGuardados,
    obtenerAvisoPorId,
    sincronizarAvisosConServidor,
    guardarAvisosEnServidor,
    obtenerUrlAppsScript,
    guardarUrlAppsScript,
    guardarAvisosEnGoogleSheets,
    guardarAvisoLocal,
    conmutarEstadoAvisoLocal,
    eliminarAvisoLocal,
    restaurarAvisosPorDefectoLocal,
    registrarModificacionLocal,
    modificacionLocalReciente,
    guardarAviso,
    conmutarEstadoAviso,
    eliminarAviso,
    restaurarAvisosPorDefecto,
    exportarAvisosJSON,
    importarAvisosJSON,
    verificarSesionAdmin,
    obtenerTokenSesion
  };
})();
