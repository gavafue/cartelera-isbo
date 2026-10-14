/**
 * ============================================================================
 * Módulo: ui.js
 * Responsabilidad: Renderizado visual de la Pantalla TV y multidispositivo:
 *                   - Visualización excelente en TV 32" de pasillo, desktop,
 *                     tablets y teléfonos móviles sin desbordes ni roturas.
 *                   - Nombre completo de los docentes SIEMPRE visible sin '...'.
 *                   - Disposición en 2 niveles de tarjeta (Docente/Estado arriba,
 *                     chips de grupos abajo).
 *                   - Layout adaptativo dinámico en 3 columnas en TV/Desktop
 *                     y apilado vertical fluido con scroll nativo en mobile/tablet.
 *                   - Cartelera con marquesina vertical y 6 categorías oficiales.
 * ============================================================================
 */

window.UI = (function () {
  let ultimosConteos = { nHoy: 0, nManana: 0, nAvisos: 0 };

  // Renderiza las insignias de grupos normalizados (ej: 2° MK, 1° MM, TODOS LOS GRUPOS)
  function renderGrupos(grupoTexto) {
    const grupos = InasistenciasLogic.extraerGrupos(grupoTexto);
    if (grupos.length === 0) {
      return '<span class="text-slate-400 text-[10px] sm:text-[11px] font-semibold">Sin grupo asignado</span>';
    }

    if (grupos.length === 1 && grupos[0] === 'TODOS LOS GRUPOS') {
      return `
        <span class="inline-flex items-center gap-1 bg-slate-900 text-white font-black text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-700 shadow-xs">
          <span class="material-symbols-outlined text-xs text-[#F8E124]">groups</span>
          <span>TODOS LOS GRUPOS</span>
        </span>
      `;
    }

    const paleta = ['bg-[#00489A]', 'bg-emerald-800', 'bg-indigo-700', 'bg-purple-800', 'bg-teal-700', 'bg-amber-800'];
    return `
      <div class="flex flex-wrap gap-1 sm:gap-1.5">
        ${grupos.map((g, i) => `
          <span class="${paleta[i % paleta.length]} text-white font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded-md shadow-xs border border-white/20 whitespace-nowrap">
            ${g}
          </span>
        `).join('')}
      </div>
    `;
  }

  // Función núcleo reutilizable para renderizar listas de docentes ausentes
  function renderDocentes(contenedorId, contadorId, docentes, fecha, opciones = {}) {
    const contenedor = document.getElementById(contenedorId);
    const contador = contadorId ? document.getElementById(contadorId) : null;
    if (!contenedor) return;

    if (contador) contador.textContent = docentes.length;

    // Caso 1: 0 docentes ausentes
    if (docentes.length === 0) {
      const tituloVacio = opciones.tituloVacio || 'Sin inasistencias registradas';
      const descVacio = opciones.descVacio || 'Todo el cuerpo docente asiste con normalidad.';
      contenedor.className = 'h-full flex items-center justify-center p-4';
      contenedor.innerHTML = `
        <div class="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-5 bg-gradient-to-b from-white to-slate-50/80 rounded-2xl border-2 border-dashed border-emerald-300 shadow-inner">
          <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5 shadow-sm border border-emerald-200">
            <span class="material-symbols-outlined text-3xl sm:text-4xl">verified</span>
          </div>
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider mb-1.5 border border-emerald-300">
            Jornada Normal
          </span>
          <h3 class="text-base sm:text-lg lg:text-xl font-black text-slate-800 tracking-tight">${tituloVacio}</h3>
          <p class="text-xs text-slate-500 font-medium max-w-sm mt-1 leading-relaxed">
            ${descVacio}
          </p>
        </div>
      `;
      return;
    }

    // Caso 2: 1 o más docentes ausentes
    // Disposición en 2 niveles:
    // Nivel 1: Avatar + Nombre Completo (sin truncate, break-words) + Estado
    // Nivel 2: Chips de grupos afectados con divisor sutil
    const hoverBorder = opciones.hoverBorder || 'hover:border-sky-400';
    const cardClase = opciones.cardClase || 'border-2 border-slate-200/90';
    const badgeTemporal = opciones.badgeTemporal || null;

    // Evitar reinicio brusco de animación si la lista de docentes no cambió
    const cacheKey = `${opciones.tipo || ''}_${docentes.map(d => `${d.nombre}_${d.desde}_${d.hasta}_${d.grupo}`).join('|')}`;
    if (contenedor.dataset.cacheKey === cacheKey && contenedor.children.length > 0) {
      return;
    }
    contenedor.dataset.cacheKey = cacheKey;

    const tarjetasHtml = docentes.map(d => {
      const iniciales = InasistenciasLogic.obtenerIniciales(d.nombre);
      const color = InasistenciasLogic.obtenerColor(d.nombre);
      const estado = InasistenciasLogic.calcularEstado(d, fecha);

      const badgeTemporalHtml = badgeTemporal ? `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${badgeTemporal.clase}">
          <span class="material-symbols-outlined text-[12px] sm:text-[13px] leading-none">${badgeTemporal.icono}</span>
          <span>${badgeTemporal.texto}</span>
        </span>
      ` : '';

      return `
        <div class="bg-white rounded-xl p-2.5 sm:p-3 lg:p-3.5 border-2 border-slate-200/90 shadow-xs flex flex-col gap-2 ${cardClase} ${hoverBorder} transition-colors">
          <!-- Nivel 1: Docente y Estado -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              <div class="h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${color} text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-xs shrink-0">
                ${iniciales}
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-xs sm:text-sm lg:text-base font-extrabold text-slate-900 leading-snug break-words">
                  ${d.nombre}
                </h3>
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Docente</span>
              </div>
            </div>
            <div class="shrink-0 ${badgeTemporal ? 'flex flex-col items-end gap-1' : 'text-right'}">
              ${badgeTemporalHtml}
              <span class="text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border shadow-xs inline-block whitespace-nowrap ${estado.clase}">
                ${estado.texto}
              </span>
            </div>
          </div>

          <!-- Nivel 2: Grupos Afectados -->
          <div class="pt-1.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
              <span class="material-symbols-outlined text-[13px] text-slate-400">groups</span> Grupos:
            </span>
            ${renderGrupos(d.grupo)}
          </div>
        </div>
      `;
    }).join('');

    // Comprobar si la columna es ancha (>= 720px en TV/Desktop) y hay al menos 4 docentes para aprovechar grilla de 2 columnas
    const columnaPadre = contenedor.closest('section');
    const esColumnaAncha = window.innerWidth >= 1024 && columnaPadre && columnaPadre.offsetWidth >= 720 && docentes.length >= 4;
    const claseBase = esColumnaAncha ? 'grid-tarjetas-2col' : 'space-y-2.5';

    // Limpiar estilos inline previos de animación
    contenedor.style.animation = '';
    contenedor.style.animationDuration = '';

    // Si hay 4 o más docentes, activar marquesina continua para visualización completa
    if (docentes.length >= 4) {
      const separador = `<div class="border-t-2 border-dashed border-slate-300 my-2 pt-2 ${esColumnaAncha ? 'col-span-2' : ''}"></div>`;
      contenedor.className = `animate-marquee-v ${claseBase}`;
      contenedor.innerHTML = tarjetasHtml + separador + tarjetasHtml;
      const duracion = Math.max(24, Math.round(docentes.length * 6));
      contenedor.style.animationDuration = `${duracion}s`;
    } else {
      contenedor.className = claseBase;
      contenedor.innerHTML = tarjetasHtml;
    }
  }

  // Renderiza las tarjetas de docentes ausentes de HOY
  function renderDocentesDeHoy(contenedorId, docentes, fechaHoy = new Date()) {
    renderDocentes(contenedorId, 'contador-docentes', docentes, fechaHoy, {
      tipo: 'hoy',
      cardClase: 'border-l-[6px] border-l-red-600 bg-gradient-to-r from-rose-50/40 via-white to-white',
      hoverBorder: 'hover:border-rose-400',
      badgeTemporal: null,
      tituloVacio: 'Sin inasistencias docentes para hoy',
      descVacio: 'Todo el cuerpo docente asiste con normalidad. Las clases de todos los grupos y turnos se imparten en sus horarios y aulas correspondientes.'
    });
  }

  // Renderiza las tarjetas de docentes ausentes de MAÑANA
  function renderDocentesDeManana(contenedorId, docentes, fechaManana) {
    const elTitulo = document.getElementById('titulo-header-manana');
    if (elTitulo && InasistenciasLogic.formatearEncabezadoManana) {
      elTitulo.textContent = InasistenciasLogic.formatearEncabezadoManana(fechaManana);
    }
    const elFecha = document.getElementById('fecha-manana');
    if (elFecha) {
      elFecha.textContent = InasistenciasLogic.formatearFecha(fechaManana);
    }
    renderDocentes(contenedorId, 'contador-docentes-manana', docentes, fechaManana, {
      tipo: 'manana',
      cardClase: 'border-l-[6px] border-l-indigo-600 bg-white',
      hoverBorder: 'hover:border-indigo-400',
      badgeTemporal: null,
      tituloVacio: 'Sin inasistencias docentes para mañana',
      descVacio: 'No se registran inasistencias de docentes previstas para la jornada de mañana.'
    });
  }

  const qrCacheOffline = new Map();

  function resolverImagenQR(a) {
    if (a.qrImagen) return a.qrImagen;
    if (!a.qrUrl) return '';
    if (qrCacheOffline.has(a.qrUrl)) return qrCacheOffline.get(a.qrUrl);

    if (typeof QRCode !== 'undefined') {
      try {
        const tempDiv = document.createElement('div');
        new QRCode(tempDiv, {
          text: a.qrUrl,
          width: 320,
          height: 320,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
        const canvas = tempDiv.querySelector('canvas');
        if (canvas) {
          const dataUrl = canvas.toDataURL('image/png');
          qrCacheOffline.set(a.qrUrl, dataUrl);
          return dataUrl;
        }
      } catch (e) {}
    }

    const fallback = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(a.qrUrl)}`;
    qrCacheOffline.set(a.qrUrl, fallback);
    return fallback;
  }

  // Renderiza los avisos institucionales en formato cápsula o feed (desde el formulario o lista explícita)
  function renderAvisosConMarquee(contenedorId, avisosExplicitos = null) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const avisosGuardados = Array.isArray(avisosExplicitos) ? avisosExplicitos : InasistenciasLogic.obtenerAvisosGuardados();
    const avisosActivos = avisosGuardados.filter(a => a.activo !== false);

    const contador = document.getElementById('contador-avisos');
    if (contador) contador.textContent = avisosActivos.length;

    let listaTarjetas = [];

    avisosActivos.forEach(a => {
      const config = InasistenciasLogic.obtenerConfiguracionCategoria(a.prioridad);
      const tieneQR = a.tieneQr && (a.qrImagen || a.qrUrl);
      const imgQR = tieneQR ? resolverImagenQR(a) : '';

      listaTarjetas.push(`
        <div class="${config.cardBg} rounded-xl p-3.5 sm:p-4 shadow-sm relative overflow-hidden flex flex-col justify-between border border-white/20">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="inline-flex items-center gap-1 ${config.colorBadge} text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                ${config.badgeTexto}
              </span>
              ${tieneQR ? `
                <span class="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/30 shrink-0">
                  <span class="material-symbols-outlined text-xs">qr_code_scanner</span> QR Activo
                </span>
              ` : ''}
            </div>
            <h3 class="text-sm sm:text-base lg:text-lg font-black leading-snug ${config.tituloCol}">${a.titulo}</h3>
            <p class="text-xs sm:text-sm ${config.mensajeCol} font-medium mt-1.5 leading-relaxed">${a.mensaje}</p>
          </div>

          ${tieneQR ? `
            <div class="mt-3 p-3 bg-white text-slate-900 rounded-xl flex flex-col items-center gap-2.5 shadow-md border-2 border-slate-900 text-center">
              <div class="w-36 h-36 sm:w-40 sm:h-40 bg-white p-2 rounded-xl border-2 border-slate-900 shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
                <img src="${imgQR}" alt="Código QR institucional" class="w-full h-full object-contain block" style="min-width: 140px; min-height: 140px; image-rendering: pixelated;">
              </div>
              <div class="w-full">
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-900 text-[11px] font-black uppercase tracking-wider mb-1">
                  <span class="material-symbols-outlined text-xs text-sky-700">qr_code_scanner</span>
                  <span>Escaneá con tu celular</span>
                </div>
                <p class="text-[11px] text-slate-700 font-semibold leading-snug">
                  Apunta con la cámara de tu teléfono móvil hacia la pantalla.
                </p>
                ${a.qrUrl ? `
                  <div class="mt-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] font-mono font-bold text-sky-900 truncate border border-slate-300 max-w-full">
                    🔗 ${a.qrUrl}
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `);
    });

    // Caso: No hay avisos en cartelera
    if (listaTarjetas.length === 0) {
      contenedor.className = 'space-y-2.5';
      contenedor.innerHTML = `
        <div class="bg-white rounded-xl p-4 text-center border-2 border-dashed border-slate-200">
          <span class="material-symbols-outlined text-slate-400 text-3xl mb-1">campaign</span>
          <h4 class="text-xs font-bold text-slate-700">Sin avisos en cartelera</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">Las actividades transcurren con normalidad.</p>
        </div>
      `;
      return;
    }

    // Evitar reinicio brusco de la animación si los avisos no cambiaron
    const cacheKeyAvisos = avisosActivos.map(a => `${a.id || a.titulo}_${a.mensaje}_${a.prioridad}_${a.tieneQr}`).join('|');
    if (contenedor.dataset.cacheKey === cacheKeyAvisos && contenedor.children.length > 0) {
      return;
    }
    contenedor.dataset.cacheKey = cacheKeyAvisos;

    // Limpiar estilos inline previos de animación
    contenedor.style.animation = '';
    contenedor.style.animationDuration = '';

    // Si hay 2 o más avisos, activar marquesina vertical continua para visualización rotativa
    const totalHtml = listaTarjetas.join('');
    if (listaTarjetas.length >= 2) {
      contenedor.className = 'animate-marquee-v space-y-2.5';
      const separador = `<div class="border-t-2 border-dashed border-slate-300 my-2 pt-2"></div>`;
      // Si son exactamente 2 avisos, duplicamos el bloque para garantizar un bucle continuo sin huecos
      const bloque = (listaTarjetas.length === 2)
        ? totalHtml + separador + totalHtml
        : totalHtml;
      contenedor.innerHTML = bloque + separador + bloque;
      const duracion = Math.max(22, Math.round(listaTarjetas.length * 12));
      contenedor.style.animationDuration = `${duracion}s`;
    } else {
      contenedor.className = 'space-y-2.5';
      contenedor.innerHTML = totalHtml;
    }
  }

  // Ajusta las proporciones y visibilidad dinámica de las 3 columnas según densidad de información
  function ajustarLayout(nHoy, nManana, nAvisos, opciones = {}) {
    ultimosConteos = { nHoy, nManana, nAvisos };

    const colHoy = document.getElementById('columna-hoy');
    const colManana = document.getElementById('columna-manana');
    const colAvisos = document.getElementById('columna-avisos');
    if (!colHoy) return;

    // 1. REGLA ESTRICTA DE DISPONIBILIDAD INSTITUCIONAL:
    // - Columna Hoy: SIEMPRE ACTIVA (nunca se oculta, ni siquiera con 0 inasistencias).
    // - Columna Mañana: AUTO-OCULTABLE (se oculta si no hay inasistencias para mañana).
    // - Columna Avisos: AUTO-OCULTABLE (se oculta si no hay avisos activos vigentes).
    const tieneManana = nManana > 0;
    const tieneAvisos = nAvisos > 0;

    colHoy.style.display = 'flex';
    colHoy.classList.remove('hidden');

    if (colManana) {
      if (!tieneManana) {
        colManana.style.display = 'none';
        colManana.classList.add('hidden');
      } else {
        colManana.style.display = 'flex';
        colManana.classList.remove('hidden');
      }
    }

    if (colAvisos) {
      if (!tieneAvisos) {
        colAvisos.style.display = 'none';
        colAvisos.classList.add('hidden');
      } else {
        colAvisos.style.display = 'flex';
        colAvisos.classList.remove('hidden');
      }
    }

    // 2. Comportamiento Responsive (Móvil / Tablet < 1024px vs TV / Desktop >= 1024px)
    const esPantallaGrande = window.innerWidth >= 1024;
    if (!esPantallaGrande) {
      colHoy.style.flex = 'none';
      colHoy.style.width = '100%';
      if (colManana && tieneManana) {
        colManana.style.flex = 'none';
        colManana.style.width = '100%';
      }
      if (colAvisos && tieneAvisos) {
        colAvisos.style.flex = 'none';
        colAvisos.style.width = '100%';
      }
      return;
    }

    // Limpiar widths inline en pantallas grandes para delegar en flex-grow/basis
    colHoy.style.width = '';
    if (colManana) colManana.style.width = '';
    if (colAvisos) colAvisos.style.width = '';

    // 3. MOTOR DE DENSIDAD DE INFORMACIÓN (DDE):
    // Ponderación de pesos visuales y cognitivos:
    // - Cada tarjeta de docente: peso base 1.0.
    // - Hoy sin ausencias: peso mínimo de anclaje (0.9).
    // - Avisos con QR: peso 2.5 (por canvas de alta resolución y necesidad de escaneo móvil a distancia).
    // - Avisos sin QR: peso 1.3.
    let nAvisosConQr = 0;
    try {
      const avisosList = opciones.avisosActivos || (typeof InasistenciasLogic !== 'undefined' ? InasistenciasLogic.obtenerAvisosGuardados().filter(a => a.activo !== false) : []);
      nAvisosConQr = avisosList.filter(a => a.tieneQr && (a.qrImagen || a.qrUrl)).length;
    } catch (e) {
      nAvisosConQr = 0;
    }

    const dHoy = nHoy > 0 ? Math.max(1, nHoy) : 0.9;
    const dManana = tieneManana ? Math.max(1, nManana) : 0;
    const dAvisos = tieneAvisos ? ((nAvisos - nAvisosConQr) * 1.3 + nAvisosConQr * 2.5) : 0;

    // CASO 1: Solo 1 Columna activa (Hoy ocupa el 100% de la pantalla)
    if (!tieneManana && !tieneAvisos) {
      colHoy.style.flex = '100 100 0%';
      return;
    }

    // CASO 2: 2 Columnas activas (Hoy + Mañana, sin Avisos)
    // Invariante estricto: Hoy SIEMPRE ha de ser más grande que Mañana (pctHoy > pctManana).
    if (tieneManana && !tieneAvisos) {
      const ratio = dHoy / (dHoy + dManana);
      // Rango de Hoy: desde 55% (cuando Hoy tiene pocos/cero y Mañana muchos) hasta 72% (cuando Hoy tiene alta densidad)
      let hoyPct = Math.round(55 + (ratio * 17));
      hoyPct = Math.max(55, Math.min(72, hoyPct));
      const mananaPct = 100 - hoyPct;

      colHoy.style.flex = `${hoyPct} ${hoyPct} 0%`;
      colManana.style.flex = `${mananaPct} ${mananaPct} 0%`;
      return;
    }

    // CASO 3: 2 Columnas activas (Hoy + Avisos, sin Mañana)
    if (!tieneManana && tieneAvisos) {
      if (nHoy === 0) {
        // Hoy vacío: banner a la izquierda (34%), avisos expandidos (66%)
        colHoy.style.flex = '34 34 0%';
        colAvisos.style.flex = '66 66 0%';
      } else {
        const ratio = dHoy / (dHoy + dAvisos);
        const hoyPct = Math.round(Math.min(72, Math.max(38, ratio * 100)));
        const avisosPct = 100 - hoyPct;
        colHoy.style.flex = `${hoyPct} ${hoyPct} 0%`;
        colAvisos.style.flex = `${avisosPct} ${avisosPct} 0%`;
      }
      return;
    }

    // CASO 4: Las 3 Columnas activas (Hoy + Mañana + Avisos)
    // Invariante estricto: Hoy SIEMPRE ha de ser más grande que Mañana (pctHoy > pctManana),
    // respetando a su vez la variación según la densidad de datos.
    const dTotal = dHoy + dManana + dAvisos;
    const minAvisos = nAvisosConQr > 0 ? 25 : 20;
    const maxAvisos = 34;
    let pctAvisos = Math.round((dAvisos / dTotal) * 100);
    pctAvisos = Math.max(minAvisos, Math.min(maxAvisos, pctAvisos));

    const espacioRestante = 100 - pctAvisos;
    const ratioHM = dHoy / (dHoy + dManana);

    // Hoy recibe entre el 55% y el 72% del espacio disponible restante
    const shareHoy = 0.55 + (ratioHM * 0.17);
    let pctHoy = Math.round(espacioRestante * shareHoy);
    let pctManana = espacioRestante - pctHoy;

    // Salvaguarda matemática estricta: garantizar que pctHoy sea al menos 4 puntos mayor que pctManana
    if (pctHoy <= pctManana) {
      pctHoy = Math.ceil(espacioRestante / 2) + 2;
      pctManana = espacioRestante - pctHoy;
    }

    colHoy.style.flex = `${pctHoy} ${pctHoy} 0%`;
    colManana.style.flex = `${pctManana} ${pctManana} 0%`;
    colAvisos.style.flex = `${pctAvisos} ${pctAvisos} 0%`;
  }

  // Listener global de resize para recalcular layout al rotar pantalla o cambiar tamaño de ventana
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      ajustarLayout(ultimosConteos.nHoy, ultimosConteos.nManana, ultimosConteos.nAvisos);
    });
  }

  // Control del Reloj en tiempo real
  function iniciarReloj(idHora, idFecha) {
    function tick() {
      const ahora = new Date();
      const elHora = document.getElementById(idHora);
      const elFecha = document.getElementById(idFecha);

      if (elHora) {
        const h = String(ahora.getHours()).padStart(2, '0');
        const m = String(ahora.getMinutes()).padStart(2, '0');
        const s = String(ahora.getSeconds()).padStart(2, '0');
        elHora.textContent = `${h}:${m}:${s}`;
      }

      if (elFecha) {
        elFecha.textContent = InasistenciasLogic.formatearFecha(ahora);
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  return {
    renderGrupos,
    renderDocentesDeHoy,
    renderDocentesDeManana,
    renderAvisosConMarquee,
    ajustarLayout,
    iniciarReloj
  };
})();
