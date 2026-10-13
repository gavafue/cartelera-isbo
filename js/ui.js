/**
 * ============================================================================
 * Módulo: ui.js
 * Responsabilidad: Renderizado visual de la Pantalla TV:
 *                   - Inasistencias de hoy con normalización de grupos y
 *                     manejo integral de 0 a N docentes.
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
      return '<span class="text-slate-400 text-xs font-semibold">Sin grupo asignado</span>';
    }

    if (grupos.length === 1 && grupos[0] === 'TODOS LOS GRUPOS') {
      return `
        <span class="inline-flex items-center gap-1.5 bg-slate-900 text-white font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-lg shadow-sm border border-slate-700">
          <span class="material-symbols-outlined text-sm text-[#F8E124]">groups</span>
          <span>TODOS LOS GRUPOS</span>
        </span>
      `;
    }

    if (grupos.length === 1) {
      return `
        <span class="inline-block bg-[#00489A] text-white font-extrabold text-xs sm:text-sm px-3 py-1.5 rounded-lg shadow-sm border border-sky-400/30">
          ${grupos[0]}
        </span>
      `;
    }

    const paleta = ['bg-[#00489A]', 'bg-emerald-800', 'bg-indigo-700', 'bg-purple-800', 'bg-teal-700', 'bg-amber-800'];
    return `
      <div class="flex flex-wrap gap-1.5">
        ${grupos.map((g, i) => `
          <span class="${paleta[i % paleta.length]} text-white font-bold text-xs px-2.5 py-1 rounded-md shadow-xs border border-white/20">
            ${g}
          </span>
        `).join('')}
      </div>
    `;
  }

  // Renderiza las tarjetas de docentes ausentes exclusivamente de HOY
  function renderDocentesDeHoy(contenedorId, docentes, fechaHoy = new Date()) {
    const contenedor = document.getElementById(contenedorId);
    const contador = document.getElementById('contador-docentes');
    if (!contenedor) return;

    if (contador) contador.textContent = docentes.length;

    // Caso 1: 0 docentes ausentes (Jornada normal sin inasistencias)
    if (docentes.length === 0) {
      contenedor.className = 'h-full flex items-center justify-center p-4';
      contenedor.innerHTML = `
        <div class="w-full h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-white to-slate-50/80 rounded-2xl border-2 border-dashed border-emerald-300 shadow-inner">
          <div class="w-20 h-20 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm border border-emerald-200">
            <span class="material-symbols-outlined text-5xl">verified</span>
          </div>
          <span class="px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2 border border-emerald-300">
            Jornada Completa y Normal
          </span>
          <h3 class="text-2xl font-black text-slate-800 tracking-tight">Sin inasistencias docentes para hoy</h3>
          <p class="text-sm text-slate-500 font-medium max-w-md mt-2 leading-relaxed">
            Todo el cuerpo docente asiste con normalidad. Las clases de todos los grupos y turnos se imparten en sus horarios y aulas correspondientes.
          </p>
        </div>
      `;
      return;
    }

    // Caso 2: 1 o más docentes ausentes
    const tarjetasHtml = docentes.map(d => {
      const iniciales = InasistenciasLogic.obtenerIniciales(d.nombre);
      const color = InasistenciasLogic.obtenerColor(d.nombre);
      const estado = InasistenciasLogic.calcularEstado(d, fechaHoy);

      return `
        <div class="bg-white rounded-xl p-3.5 sm:p-4 border-2 border-slate-200/90 shadow-sm flex items-center justify-between hover:border-sky-400 transition-colors">
          <div class="flex items-center gap-3.5 w-5/12">
            <div class="h-11 w-11 sm:h-12 sm:w-12 rounded-xl ${color} text-white flex items-center justify-center font-black text-base shadow shrink-0">
              ${iniciales}
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900 leading-tight truncate">${d.nombre}</h3>
              <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Docente</span>
            </div>
          </div>
          <div class="w-4/12 px-2">
            ${renderGrupos(d.grupo)}
          </div>
          <div class="w-3/12 text-right">
            <span class="text-xs font-bold px-3 py-1.5 rounded-lg border shadow-xs ${estado.clase}">
              ${estado.texto}
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Si hay 4 o más docentes, activar marquesina continua para visualización completa
    if (docentes.length >= 4) {
      contenedor.className = 'animate-marquee-v space-y-3.5';
      contenedor.innerHTML = tarjetasHtml + `<div class="border-t-2 border-dashed border-slate-300 my-2 pt-2"></div>` + tarjetasHtml;
    } else {
      contenedor.className = 'space-y-3.5';
      contenedor.innerHTML = tarjetasHtml;
    }
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

  // Renderiza los avisos institucionales con las 6 categorías oficiales (EXCLUSIVAMENTE desde el formulario)
  function renderAvisosConMarquee(contenedorId) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    // Los avisos institucionales provienen exclusivamente de la gestión administrativa del formulario
    const avisosGuardados = InasistenciasLogic.obtenerAvisosGuardados();
    const avisosActivos = avisosGuardados.filter(a => a.activo !== false);
    let listaTarjetas = [];

    avisosActivos.forEach(a => {
      const config = InasistenciasLogic.obtenerConfiguracionCategoria(a.prioridad);
      const tieneQR = a.tieneQr && (a.qrImagen || a.qrUrl);
      const imgQR = tieneQR ? resolverImagenQR(a) : '';

      listaTarjetas.push(`
        <div class="${config.cardBg} rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="inline-flex items-center gap-1 ${config.colorBadge} text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                ${config.badgeTexto}
              </span>
              ${tieneQR ? `
                <span class="inline-flex items-center gap-1 bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded border border-white/30">
                  <span class="material-symbols-outlined text-xs">qr_code_scanner</span> QR Activo
                </span>
              ` : ''}
            </div>
            <h3 class="text-lg sm:text-xl font-black leading-tight ${config.tituloCol}">${a.titulo}</h3>
            <p class="text-xs sm:text-sm ${config.mensajeCol} font-medium mt-2 leading-relaxed">${a.mensaje}</p>
          </div>

          ${tieneQR ? `
            <div class="mt-4 p-3.5 bg-white text-slate-900 border-2 border-slate-900 rounded-2xl flex items-center gap-4 shadow-md">
              <!-- QR de gran tamaño y máximo contraste para cámara de celular apuntando a la TV -->
              <div class="w-28 h-28 sm:w-32 sm:h-32 bg-white p-2 rounded-2xl border-2 border-slate-900 shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
                <img src="${imgQR}" alt="Código QR institucional" class="w-full h-full object-contain">
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 text-xs font-black uppercase text-slate-900 tracking-wide">
                  <span class="material-symbols-outlined text-base text-sky-700">qr_code_scanner</span>
                  <span>Escaneá con tu celular</span>
                </div>
                <p class="text-[11px] text-slate-600 font-medium leading-snug mt-1">
                  Apunta con la cámara de tu teléfono móvil hacia la pantalla para acceder al trámite.
                </p>
                ${a.qrUrl ? `
                  <div class="mt-1.5 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-sky-800 truncate border border-slate-200">
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
      contenedor.className = 'space-y-4';
      contenedor.innerHTML = `
        <div class="bg-white rounded-2xl p-6 text-center border-2 border-dashed border-slate-200">
          <span class="material-symbols-outlined text-slate-400 text-4xl mb-2">campaign</span>
          <h4 class="text-sm font-bold text-slate-700">No hay nuevos avisos</h4>
          <p class="text-xs text-slate-400 mt-1">Las clases y actividades transcurren con normalidad.</p>
        </div>
      `;
      return;
    }

    // Si hay 3 o más avisos, activar marquesina vertical rotativa continua
    const totalHtml = listaTarjetas.join('');
    if (listaTarjetas.length >= 3) {
      contenedor.className = 'animate-marquee-v space-y-4';
      contenedor.innerHTML = totalHtml + `<div class="border-t-2 border-dashed border-slate-300 my-2 pt-2"></div>` + totalHtml;
    } else {
      contenedor.className = 'space-y-4';
      contenedor.innerHTML = totalHtml;
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
    renderAvisosConMarquee,
    iniciarReloj
  };
})();
