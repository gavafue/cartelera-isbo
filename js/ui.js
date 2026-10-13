/**
 * ============================================================================
 * Módulo: ui.js
 * Responsabilidad: Renderizado visual de la Pantalla TV:
 *                   - Layout adaptativo dinámico en 3 columnas:
 *                     Hoy | Mañana | Avisos Bedelía (feed/cápsula).
 *                   - Inasistencias de hoy y mañana con normalización de grupos
 *                     y cálculo de estado temporal contextual.
 *                   - Cartelera con marquesina vertical y 6 categorías
 *                     oficiales sin etiquetas genéricas.
 *                   - Códigos QR nítidos y escaneables en alta resolución.
 * ============================================================================
 */

window.UI = (function () {
  // Renderiza las insignias de grupos normalizados (ej: 2° MK, 1° MM, TODOS LOS GRUPOS)
  function renderGrupos(grupoTexto) {
    const grupos = InasistenciasLogic.extraerGrupos(grupoTexto);
    if (grupos.length === 0) {
      return '<span class="text-slate-400 text-[11px] font-semibold">Sin grupo</span>';
    }

    if (grupos.length === 1 && grupos[0] === 'TODOS LOS GRUPOS') {
      return `
        <span class="inline-flex items-center gap-1 bg-slate-900 text-white font-black text-[10px] sm:text-xs px-2.5 py-1 rounded-lg shadow-xs border border-slate-700">
          <span class="material-symbols-outlined text-xs text-[#F8E124]">groups</span>
          <span>TODOS LOS GRUPOS</span>
        </span>
      `;
    }

    if (grupos.length === 1) {
      return `
        <span class="inline-block bg-[#00489A] text-white font-extrabold text-[11px] sm:text-xs px-2.5 py-1 rounded-lg shadow-xs border border-sky-400/30 truncate max-w-full">
          ${grupos[0]}
        </span>
      `;
    }

    const paleta = ['bg-[#00489A]', 'bg-emerald-800', 'bg-indigo-700', 'bg-purple-800', 'bg-teal-700', 'bg-amber-800'];
    return `
      <div class="flex flex-wrap gap-1">
        ${grupos.map((g, i) => `
          <span class="${paleta[i % paleta.length]} text-white font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded-md shadow-xs border border-white/20">
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
        <div class="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-white to-slate-50/80 rounded-2xl border-2 border-dashed border-emerald-300 shadow-inner">
          <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-sm border border-emerald-200">
            <span class="material-symbols-outlined text-4xl">verified</span>
          </div>
          <span class="px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider mb-2 border border-emerald-300">
            Jornada Normal
          </span>
          <h3 class="text-xl font-black text-slate-800 tracking-tight">${tituloVacio}</h3>
          <p class="text-xs text-slate-500 font-medium max-w-sm mt-1.5 leading-relaxed">
            ${descVacio}
          </p>
        </div>
      `;
      return;
    }

    // Caso 2: 1 o más docentes ausentes
    const hoverBorder = opciones.hoverBorder || 'hover:border-sky-400';
    const tarjetasHtml = docentes.map(d => {
      const iniciales = InasistenciasLogic.obtenerIniciales(d.nombre);
      const color = InasistenciasLogic.obtenerColor(d.nombre);
      const estado = InasistenciasLogic.calcularEstado(d, fecha);

      return `
        <div class="bg-white rounded-xl p-2.5 sm:p-3.5 border-2 border-slate-200/90 shadow-sm flex items-center justify-between ${hoverBorder} transition-colors">
          <div class="flex items-center gap-2.5 sm:gap-3 w-5/12 min-w-0">
            <div class="h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${color} text-white flex items-center justify-center font-black text-xs sm:text-sm shadow shrink-0">
              ${iniciales}
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 leading-tight truncate">${d.nombre}</h3>
              <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Docente</span>
            </div>
          </div>
          <div class="w-4/12 px-1.5 min-w-0">
            ${renderGrupos(d.grupo)}
          </div>
          <div class="w-3/12 text-right">
            <span class="text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-lg border shadow-xs inline-block ${estado.clase}">
              ${estado.texto}
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Si hay 4 o más docentes, activar marquesina continua para visualización completa
    if (docentes.length >= 4) {
      contenedor.className = 'animate-marquee-v space-y-3';
      contenedor.innerHTML = tarjetasHtml + `<div class="border-t-2 border-dashed border-slate-300 my-2 pt-2"></div>` + tarjetasHtml;
    } else {
      contenedor.className = 'space-y-3';
      contenedor.innerHTML = tarjetasHtml;
    }
  }

  // Renderiza las tarjetas de docentes ausentes de HOY
  function renderDocentesDeHoy(contenedorId, docentes, fechaHoy = new Date()) {
    renderDocentes(contenedorId, 'contador-docentes', docentes, fechaHoy, {
      tituloVacio: 'Sin inasistencias docentes para hoy',
      descVacio: 'Todo el cuerpo docente asiste con normalidad. Las clases de todos los grupos y turnos se imparten en sus horarios y aulas correspondientes.',
      hoverBorder: 'hover:border-rose-400'
    });
  }

  // Renderiza las tarjetas de docentes ausentes de MAÑANA
  function renderDocentesDeManana(contenedorId, docentes, fechaManana) {
    const elFecha = document.getElementById('fecha-manana');
    if (elFecha) {
      elFecha.textContent = InasistenciasLogic.formatearFecha(fechaManana);
    }
    renderDocentes(contenedorId, 'contador-docentes-manana', docentes, fechaManana, {
      tituloVacio: 'Sin inasistencias docentes para mañana',
      descVacio: 'No se registran inasistencias de docentes previstas para la jornada de mañana.',
      hoverBorder: 'hover:border-indigo-400'
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
          width: 256,
          height: 256,
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

    const fallback = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(a.qrUrl)}`;
    qrCacheOffline.set(a.qrUrl, fallback);
    return fallback;
  }

  // Renderiza los avisos institucionales en formato cápsula o feed (EXCLUSIVAMENTE desde el formulario)
  function renderAvisosConMarquee(contenedorId) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    const avisosGuardados = InasistenciasLogic.obtenerAvisosGuardados();
    const avisosActivos = avisosGuardados.filter(a => a.activo !== false);

    const contador = document.getElementById('contador-avisos');
    if (contador) contador.textContent = avisosActivos.length;

    let listaTarjetas = [];

    avisosActivos.forEach(a => {
      const config = InasistenciasLogic.obtenerConfiguracionCategoria(a.prioridad);
      const tieneQR = a.tieneQr && (a.qrImagen || a.qrUrl);
      const imgQR = tieneQR ? resolverImagenQR(a) : '';

      listaTarjetas.push(`
        <div class="${config.cardBg} rounded-xl p-3 sm:p-4 shadow-sm relative overflow-hidden flex flex-col justify-between border border-white/20">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="inline-flex items-center gap-1 ${config.colorBadge} text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                ${config.badgeTexto}
              </span>
              ${tieneQR ? `
                <span class="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/30 shrink-0">
                  <span class="material-symbols-outlined text-xs">qr_code_scanner</span> QR Activo
                </span>
              ` : ''}
            </div>
            <h3 class="text-xs sm:text-sm md:text-base font-extrabold leading-snug ${config.tituloCol}">${a.titulo}</h3>
            <p class="text-xs ${config.mensajeCol} font-medium mt-1 leading-relaxed">${a.mensaje}</p>
          </div>

          ${tieneQR ? `
            <div class="mt-2.5 p-2 bg-white text-slate-900 rounded-xl flex items-center gap-2.5 shadow-sm border border-slate-300">
              <div class="w-14 h-14 sm:w-16 sm:h-16 bg-white p-1 rounded-lg border-2 border-slate-900 shrink-0 flex items-center justify-center overflow-hidden">
                <img src="${imgQR}" alt="Código QR institucional" class="w-full h-full object-contain">
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1 text-[10px] font-black uppercase text-slate-900 tracking-wide">
                  <span class="material-symbols-outlined text-xs text-sky-700">qr_code_scanner</span>
                  <span>Escaneá con tu celular</span>
                </div>
                <p class="text-[9px] text-slate-600 font-medium leading-tight mt-0.5 truncate">
                  Apunta la cámara para acceder
                </p>
                ${a.qrUrl ? `
                  <div class="mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-mono font-bold text-sky-800 truncate border border-slate-200">
                    ${a.qrUrl}
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
      contenedor.className = 'space-y-3';
      contenedor.innerHTML = `
        <div class="bg-white rounded-xl p-4 text-center border-2 border-dashed border-slate-200">
          <span class="material-symbols-outlined text-slate-400 text-3xl mb-1">campaign</span>
          <h4 class="text-xs font-bold text-slate-700">Sin avisos en cartelera</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">Las actividades transcurren con normalidad.</p>
        </div>
      `;
      return;
    }

    // Si hay 3 o más avisos, activar marquesina vertical continua
    const totalHtml = listaTarjetas.join('');
    if (listaTarjetas.length >= 3) {
      contenedor.className = 'animate-marquee-v space-y-3';
      contenedor.innerHTML = totalHtml + `<div class="border-t-2 border-dashed border-slate-300 my-2 pt-2"></div>` + totalHtml;
    } else {
      contenedor.className = 'space-y-3';
      contenedor.innerHTML = totalHtml;
    }
  }

  // Ajusta las proporciones y visibilidad dinámica de las 3 columnas
  function ajustarLayout(nHoy, nManana, nAvisos) {
    const colHoy = document.getElementById('columna-hoy');
    const colManana = document.getElementById('columna-manana');
    const colAvisos = document.getElementById('columna-avisos');
    if (!colHoy) return;

    const tieneManana = nManana > 0;
    const tieneAvisos = nAvisos > 0;

    // 1. Visibilidad de columna Mañana
    if (colManana) {
      if (!tieneManana) {
        colManana.style.display = 'none';
        colManana.classList.add('hidden');
      } else {
        colManana.style.display = 'flex';
        colManana.classList.remove('hidden');
      }
    }

    // 2. Visibilidad de columna Avisos
    if (colAvisos) {
      if (!tieneAvisos) {
        colAvisos.style.display = 'none';
        colAvisos.classList.add('hidden');
      } else {
        colAvisos.style.display = 'flex';
        colAvisos.classList.remove('hidden');
      }
    }

    // 3. Determinación de proporciones:
    // "Si mañana suele tener casi la misma cantidad de inasistencias que hoy:
    //  38% (Hoy) | 38% (Mañana) | 24% (Avisos Bedelía comprimidos en formato cápsula o feed).
    //  Si casi no hay avisos de mañana (1 o ninguno la mayoría de los días):
    //  50% (Hoy) | 25% (Mañana) | 25% (Avisos Bedelía)."
    const esMananaSimilar = tieneManana && (
      (nManana >= 3 && nManana >= Math.max(1, nHoy) * 0.6) ||
      (nManana >= 2 && Math.abs(nHoy - nManana) <= 1)
    );

    if (tieneManana && tieneAvisos) {
      if (esMananaSimilar) {
        // 38% (Hoy) | 38% (Mañana) | 24% (Avisos Bedelía)
        colHoy.style.flex = '38 38 0%';
        colManana.style.flex = '38 38 0%';
        colAvisos.style.flex = '24 24 0%';
      } else {
        // 50% (Hoy) | 25% (Mañana) | 25% (Avisos Bedelía)
        colHoy.style.flex = '50 50 0%';
        colManana.style.flex = '25 25 0%';
        colAvisos.style.flex = '25 25 0%';
      }
    } else if (!tieneManana && tieneAvisos) {
      // Si mañana no hay aviso, esa columna debe estar oculta y Hoy ocupa su lugar:
      // 75% Hoy | 25% Avisos
      colHoy.style.flex = '75 75 0%';
      colAvisos.style.flex = '25 25 0%';
    } else if (tieneManana && !tieneAvisos) {
      // Si no hay avisos, avisos oculta y Hoy ocupa el espacio libre restante
      if (esMananaSimilar) {
        colHoy.style.flex = '50 50 0%';
        colManana.style.flex = '50 50 0%';
      } else {
        colHoy.style.flex = '75 75 0%';
        colManana.style.flex = '25 25 0%';
      }
    } else {
      // Ambas ocultas (sin mañana y sin avisos): Hoy ocupa el 100%
      colHoy.style.flex = '100 100 0%';
    }
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
