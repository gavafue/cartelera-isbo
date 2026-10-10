/**
 * ============================================================================
 * Módulo: avisos-admin.js
 * Responsabilidad: Gestión administrativa integral de avisos para Bedelía:
 *                   - Generación AUTOMÁTICA en tiempo real de códigos QR a
 *                     partir del enlace web ingresado por el usuario.
 *                   - QR optimizado para legibilidad a distancia desde celulares.
 *                   - Gestión cómoda de avisos (crear, editar, pausar, borrar).
 *                   - Simulador de vista previa en vivo tipo TV.
 *                   - Sincronización frecuente y bidireccional con Google Sheets
 *                     (cada 25 s) y con la Pantalla TV de pasillo (0 ms).
 * ============================================================================
 */

(function () {
  // Elementos del formulario y modo edición
  const form = document.getElementById('form-aviso');
  const inputAvisoId = document.getElementById('aviso-id');
  const inputTitulo = document.getElementById('aviso-titulo');
  const inputMensaje = document.getElementById('aviso-mensaje');
  const inputToggleQr = document.getElementById('aviso-toggle-qr');

  // Elementos de Generación Automática de QR a partir de Enlace URL
  const contenedorQrEnlace = document.getElementById('contenedor-qr-enlace');
  const inputQrUrl = document.getElementById('aviso-qr-url');
  const qrPreviewBox = document.getElementById('qr-preview-box');
  const qrPreviewImg = document.getElementById('qr-preview-img');
  const qrPreviewUrlText = document.getElementById('qr-preview-url-text');
  const btnLimpiarQrUrl = document.getElementById('btn-limpiar-qr-url');

  // Elementos del encabezado y botones del formulario
  const formTitulo = document.getElementById('form-titulo');
  const formSubtitulo = document.getElementById('form-subtitulo');
  const badgeModoEdicion = document.getElementById('badge-modo-edicion');
  const btnSubmitAviso = document.getElementById('btn-submit-aviso');
  const btnSubmitTexto = document.getElementById('btn-submit-texto');
  const btnSubmitIcon = document.getElementById('btn-submit-icon');
  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');

  // Elementos de la columna derecha
  const previewContainer = document.getElementById('preview-card-container');
  const listaAvisosActivos = document.getElementById('lista-avisos-activos');
  const contadorAvisos = document.getElementById('contador-avisos-activos');
  const btnRestaurarBase = document.getElementById('btn-restaurar-base');
  const toastContainer = document.getElementById('toast-container');

  // Herramientas de filtrado y búsqueda
  const busquedaAvisos = document.getElementById('busqueda-avisos');
  const btnLimpiarBusqueda = document.getElementById('btn-limpiar-busqueda');
  const btnExportarJson = document.getElementById('btn-exportar-json');
  const inputArchivoImportar = document.getElementById('input-archivo-importar');
  const contadorTitulo = document.getElementById('contador-titulo');
  const contadorMensaje = document.getElementById('contador-mensaje');

  // Elementos de sincronización con Google Sheets
  const dotSyncAdmin = document.getElementById('dot-sync-admin');
  const txtSyncAdmin = document.getElementById('txt-sync-admin');
  const horaSyncAdmin = document.getElementById('hora-sync-admin');
  const btnSyncAhora = document.getElementById('btn-sync-ahora');

  // Constantes de temporización
  const INTERVALO_SYNC_SHEETS_MS = 25 * 1000; // Revisar planilla cada 25 segundos

  // Estado interno para la URL y la imagen QR generada en Base64
  let imagenQRActual = '';
  let urlQRActual = '';
  let timerDebounceQR = null;

  // Estado de filtros de avisos
  let filtroEstadoActual = 'todos'; // 'todos' | 'activos' | 'pausados'
  let busquedaTextoActual = '';

  // Sistema de notificaciones flotantes (Toast)
  function mostrarToast(mensaje, tipo = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    const esExito = tipo === 'success';
    const esAviso = tipo === 'warning';

    let bgClase = 'bg-emerald-600';
    let icono = 'check_circle';
    if (tipo === 'error') {
      bgClase = 'bg-red-600';
      icono = 'error';
    } else if (esAviso) {
      bgClase = 'bg-amber-600';
      icono = 'warning';
    } else if (tipo === 'info') {
      bgClase = 'bg-sky-700';
      icono = 'info';
    }

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-white font-bold text-xs sm:text-sm transform transition-all duration-300 translate-y-2 opacity-0 ${bgClase}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-lg">${icono}</span>
      <span>${mensaje}</span>
    `;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Paleta de estilos visuales según las 6 categorías educativas oficiales
  function obtenerEstiloPrioridad(prioridad) {
    const config = InasistenciasLogic.obtenerConfiguracionCategoria(prioridad);
    return {
      cardBg: config.cardBg,
      badgeBg: config.colorBadge,
      badgeTexto: config.badgeTexto,
      tituloCol: config.tituloCol,
      mensajeCol: config.mensajeCol
    };
  }

  /**
   * Genera de forma automática e instantánea un código QR en alta definición (Base64)
   * utilizando la biblioteca offline qrcode.min.js con corrección de error H (High - 30%).
   * Esto garantiza máxima legibilidad cuando los estudiantes apuntan con sus teléfonos
   * móviles a la pantalla de televisión desde varios metros de distancia.
   */
  function generarQRDataURL(url, dimension = 300) {
    return new Promise((resolve) => {
      if (!url || !url.trim()) {
        resolve('');
        return;
      }

      let urlLimpia = url.trim();
      // Agregar protocolo HTTPS si el usuario escribió solo un dominio (ej: utu.edu.uy)
      if (!/^https?:\/\//i.test(urlLimpia) && !urlLimpia.startsWith('/') && !urlLimpia.startsWith('data:')) {
        urlLimpia = 'https://' + urlLimpia;
      }

      if (typeof QRCode === 'undefined') {
        // Respaldo de contingencia si la biblioteca no estuviera disponible
        resolve(`https://api.qrserver.com/v1/create-qr-code/?size=${dimension}x${dimension}&data=${encodeURIComponent(urlLimpia)}`);
        return;
      }

      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      try {
        new QRCode(tempDiv, {
          text: urlLimpia,
          width: dimension,
          height: dimension,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });

        // Dar un tick mínimo para asegurar renderizado de canvas
        setTimeout(() => {
          const canvas = tempDiv.querySelector('canvas');
          if (canvas) {
            try {
              const dataUrl = canvas.toDataURL('image/png');
              tempDiv.remove();
              resolve(dataUrl);
              return;
            } catch (e) {}
          }

          const img = tempDiv.querySelector('img');
          if (img && img.src && img.src.startsWith('data:image')) {
            const dataUrl = img.src;
            tempDiv.remove();
            resolve(dataUrl);
            return;
          }

          tempDiv.remove();
          resolve(`https://api.qrserver.com/v1/create-qr-code/?size=${dimension}x${dimension}&data=${encodeURIComponent(urlLimpia)}`);
        }, 30);
      } catch (err) {
        tempDiv.remove();
        resolve(`https://api.qrserver.com/v1/create-qr-code/?size=${dimension}x${dimension}&data=${encodeURIComponent(urlLimpia)}`);
      }
    });
  }

  // Actualiza la vista previa del Simulador TV (columna derecha)
  function actualizarVistaPrevia() {
    if (!previewContainer) return;

    const titulo = inputTitulo.value.trim() || 'Título del Comunicado de Ejemplo';
    const mensaje = inputMensaje.value.trim() || 'Aquí se mostrará el cuerpo del mensaje tal como lo verán los estudiantes y docentes en la pantalla de pasillo.';
    const prioridad = document.querySelector('input[name="prioridad"]:checked')?.value || 'atencion';
    const tieneQr = inputToggleQr.checked;

    const estilo = obtenerEstiloPrioridad(prioridad);

    let htmlQR = '';
    if (tieneQr) {
      if (imagenQRActual) {
        htmlQR = `
          <div class="mt-4 p-3.5 bg-white text-slate-900 border-2 border-slate-900 rounded-2xl flex items-center gap-3.5 sm:gap-4 shadow-md">
            <div class="w-20 h-20 sm:w-24 sm:h-24 bg-white p-1 rounded-xl border-2 border-slate-900 shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
              <img src="${imagenQRActual}" alt="Código QR institucional" class="w-full h-full object-contain">
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1 text-xs font-black uppercase text-slate-900 tracking-wide">
                <span class="material-symbols-outlined text-sm text-sky-700">qr_code_scanner</span>
                <span>Escaneá con tu celular</span>
              </div>
              <p class="text-[11px] text-slate-600 font-medium leading-snug mt-1">Apunta con la cámara de tu móvil hacia la pantalla TV para acceder al enlace.</p>
              ${urlQRActual ? `
                <div class="mt-1.5 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-sky-800 truncate border border-slate-200">
                  ${urlQRActual}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        htmlQR = `
          <div class="mt-4 p-3 bg-white/95 text-slate-700 border-2 border-dashed border-slate-400 rounded-xl flex items-center gap-3">
            <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center shrink-0 border border-slate-300">
              <span class="material-symbols-outlined text-2xl">qr_code_2</span>
            </div>
            <div class="min-w-0">
              <span class="block text-xs font-bold text-slate-800">QR Pendiente de Enlace</span>
              <span class="block text-[11px] text-slate-500 leading-tight">Ingresa el enlace web en el formulario para autogenerar el QR aquí.</span>
            </div>
          </div>
        `;
      }
    }

    previewContainer.innerHTML = `
      <div class="${estilo.cardBg} rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden transition-all duration-300">
        <div class="flex items-center justify-between mb-2">
          <span class="inline-flex items-center gap-1 ${estilo.badgeBg} text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
            ${estilo.badgeTexto}
          </span>
          ${tieneQr && imagenQRActual ? `
            <span class="inline-flex items-center gap-1 bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded border border-white/30">
              <span class="material-symbols-outlined text-xs">qr_code_scanner</span> QR Activo
            </span>
          ` : ''}
        </div>
        <h3 class="text-lg sm:text-xl font-black leading-tight ${estilo.tituloCol}">${titulo}</h3>
        <p class="text-xs sm:text-sm ${estilo.mensajeCol} font-medium mt-2 leading-relaxed">${mensaje}</p>

        ${htmlQR}
      </div>
    `;
  }

  // Genera y actualiza el QR reactivamente al escribir la URL
  async function actualizarQRDesdeUrl(url) {
    const urlLimpia = (url || '').trim();
    if (!urlLimpia) {
      imagenQRActual = '';
      urlQRActual = '';
      if (qrPreviewBox) qrPreviewBox.classList.add('hidden');
      if (qrPreviewImg) qrPreviewImg.src = '';
      if (qrPreviewUrlText) qrPreviewUrlText.textContent = '';
      actualizarVistaPrevia();
      return;
    }

    urlQRActual = urlLimpia;
    const qrDataUrl = await generarQRDataURL(urlLimpia);
    imagenQRActual = qrDataUrl;

    if (qrPreviewImg) qrPreviewImg.src = qrDataUrl;
    if (qrPreviewUrlText) qrPreviewUrlText.textContent = urlLimpia;
    if (qrPreviewBox) qrPreviewBox.classList.remove('hidden');

    actualizarVistaPrevia();
  }

  // Activa el modo de edición cargando los datos del aviso en el formulario
  async function iniciarEdicion(id) {
    const aviso = InasistenciasLogic.obtenerAvisoPorId(id);
    if (!aviso) {
      mostrarToast('No se encontró el aviso solicitado.', 'error');
      return;
    }

    inputAvisoId.value = aviso.id;
    inputTitulo.value = aviso.titulo || '';
    inputMensaje.value = aviso.mensaje || '';

    // Prioridad (normalizada a 1 de las 6 categorías oficiales)
    const catNorm = InasistenciasLogic.normalizarCategoria(aviso.prioridad);
    const radio = document.querySelector(`input[name="prioridad"][value="${catNorm}"]`);
    if (radio) radio.checked = true;

    // Código QR
    inputToggleQr.checked = !!aviso.tieneQr;
    if (aviso.tieneQr) {
      contenedorQrEnlace.classList.remove('hidden');
      const urlGuardada = aviso.qrUrl || '';
      inputQrUrl.value = urlGuardada;

      if (aviso.qrImagen) {
        imagenQRActual = aviso.qrImagen;
        urlQRActual = urlGuardada;
        if (qrPreviewImg) qrPreviewImg.src = imagenQRActual;
        if (qrPreviewUrlText) qrPreviewUrlText.textContent = urlGuardada;
        if (qrPreviewBox) qrPreviewBox.classList.remove('hidden');
        actualizarVistaPrevia();
      } else if (urlGuardada) {
        await actualizarQRDesdeUrl(urlGuardada);
      } else {
        imagenQRActual = '';
        urlQRActual = '';
        if (qrPreviewBox) qrPreviewBox.classList.add('hidden');
        actualizarVistaPrevia();
      }
    } else {
      contenedorQrEnlace.classList.add('hidden');
      inputQrUrl.value = '';
      imagenQRActual = '';
      urlQRActual = '';
      if (qrPreviewBox) qrPreviewBox.classList.add('hidden');
      actualizarVistaPrevia();
    }

    // Actualizar estilo visual a Modo Edición
    formTitulo.textContent = 'Modificar Comunicado';
    formSubtitulo.textContent = 'Actualiza los datos y guarda para aplicar en la pantalla de TV al instante';
    badgeModoEdicion.classList.remove('hidden');
    btnSubmitTexto.textContent = 'Guardar Cambios del Aviso';
    btnSubmitIcon.textContent = 'save';
    btnCancelarEdicion.classList.remove('hidden');

    actualizarVistaPrevia();
    actualizarContadores();

    // Desplazamiento suave al formulario
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    inputTitulo.focus();

    mostrarToast(`Editando: "${aviso.titulo}"`, 'info');
  }

  // Cancela la edición y devuelve el formulario al modo "Nuevo Aviso"
  function cancelarEdicion() {
    inputAvisoId.value = '';
    form.reset();

    const radioAtencion = document.querySelector('input[name="prioridad"][value="atencion"]');
    if (radioAtencion) radioAtencion.checked = true;

    inputToggleQr.checked = false;
    contenedorQrEnlace.classList.add('hidden');
    inputQrUrl.value = '';
    imagenQRActual = '';
    urlQRActual = '';
    if (qrPreviewBox) qrPreviewBox.classList.add('hidden');

    formTitulo.textContent = 'Detalles del Comunicado';
    formSubtitulo.textContent = 'Completa los campos para proyectar en el monitor del hall';
    badgeModoEdicion.classList.add('hidden');
    btnSubmitTexto.textContent = 'Publicar Aviso en Pantalla TV';
    btnSubmitIcon.textContent = 'send';
    btnCancelarEdicion.classList.add('hidden');

    actualizarVistaPrevia();
    actualizarContadores();
  }

  // Renderiza la lista completa de avisos (activos y en pausa) en la cartelera
  function renderAvisosActivos() {
    if (!listaAvisosActivos) return;

    const lista = InasistenciasLogic.obtenerAvisosGuardados();
    const totalActivos = lista.filter(a => a.activo !== false).length;

    if (contadorAvisos) {
      contadorAvisos.textContent = `${totalActivos} de ${lista.length}`;
      contadorAvisos.title = `${totalActivos} visibles en TV de ${lista.length} avisos gestionados`;
    }

    if (lista.length === 0) {
      listaAvisosActivos.innerHTML = `
        <div class="p-6 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
          <span class="material-symbols-outlined text-slate-400 text-4xl mb-1">speaker_notes_off</span>
          <p class="text-sm font-bold text-slate-600">No hay avisos guardados</p>
          <p class="text-xs text-slate-400 mt-1 mb-3">Puedes redactar uno nuevo con el formulario o restaurar los comunicados base institucionales.</p>
          <button type="button" id="btn-restaurar-vacio" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition-colors">
            <span class="material-symbols-outlined text-sm">restart_alt</span>
            <span>Restaurar Avisos Base (ATD, Feriado, Boletos)</span>
          </button>
        </div>
      `;

      const btnVacio = document.getElementById('btn-restaurar-vacio');
      if (btnVacio) {
        btnVacio.addEventListener('click', () => {
          InasistenciasLogic.restaurarAvisosPorDefecto();
          renderAvisosActivos();
          mostrarToast('Avisos base institucionales restaurados.');
        });
      }
      return;
    }

    // Filtrar según estado seleccionado
    let listaFiltrada = lista;
    if (filtroEstadoActual === 'activos') {
      listaFiltrada = listaFiltrada.filter(a => a.activo !== false);
    } else if (filtroEstadoActual === 'pausados') {
      listaFiltrada = listaFiltrada.filter(a => a.activo === false);
    }

    // Filtrar según búsqueda textual
    if (busquedaTextoActual.trim()) {
      const q = busquedaTextoActual.trim().toLowerCase();
      listaFiltrada = listaFiltrada.filter(a =>
        (a.titulo && a.titulo.toLowerCase().includes(q)) ||
        (a.mensaje && a.mensaje.toLowerCase().includes(q)) ||
        (a.prioridad && a.prioridad.toLowerCase().includes(q)) ||
        (a.qrUrl && a.qrUrl.toLowerCase().includes(q))
      );
    }

    if (listaFiltrada.length === 0) {
      listaAvisosActivos.innerHTML = `
        <div class="p-6 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
          <span class="material-symbols-outlined text-slate-400 text-3xl mb-1">search_off</span>
          <p class="text-xs font-bold text-slate-700">Sin resultados para esta búsqueda o filtro</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Prueba con otros términos o restablece el filtro.</p>
          <button type="button" id="btn-limpiar-filtros-vacio" class="mt-2.5 px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors">
            Ver todos los avisos
          </button>
        </div>
      `;

      const btnLimpiar = document.getElementById('btn-limpiar-filtros-vacio');
      if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
          busquedaTextoActual = '';
          if (busquedaAvisos) busquedaAvisos.value = '';
          if (btnLimpiarBusqueda) btnLimpiarBusqueda.classList.add('hidden');
          filtroEstadoActual = 'todos';
          actualizarBotonesFiltro();
          renderAvisosActivos();
        });
      }
      return;
    }

    listaAvisosActivos.innerHTML = listaFiltrada.map(a => {
      const estilo = obtenerEstiloPrioridad(a.prioridad);
      const estaActivo = a.activo !== false;
      const tieneQR = !!(a.tieneQr && (a.qrImagen || a.qrUrl));
      const qrThumb = a.qrImagen || (a.qrUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(a.qrUrl)}` : '');

      return `
        <div class="p-4 rounded-xl bg-white border-2 ${estaActivo ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-75'} shadow-sm hover:border-slate-300 transition-all flex flex-col gap-2.5">
          
          <!-- Fila Superior: Badges y Acciones Rápidas -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="inline-flex items-center gap-1 ${estilo.badgeBg} text-[10px] font-black uppercase px-2 py-0.5 rounded">
                ${estilo.badgeTexto}
              </span>

              ${estaActivo ? `
                <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  En Pantalla TV
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300">
                  <span class="material-symbols-outlined text-xs">pause_circle</span>
                  En Pausa (Oculto)
                </span>
              `}

              ${tieneQR ? `
                <span class="inline-flex items-center gap-1 bg-sky-50 text-sky-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-sky-200">
                  <span class="material-symbols-outlined text-xs">qr_code_2</span> Con QR
                </span>
              ` : ''}
            </div>

            <!-- Botones de Acción -->
            <div class="flex items-center gap-1 shrink-0">
              <!-- Botón Editar -->
              <button type="button" class="btn-editar-aviso p-1.5 rounded-lg text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer" data-id="${a.id}" title="Editar contenido o código QR">
                <span class="material-symbols-outlined text-[19px]">edit</span>
              </button>

              <!-- Botón Pausar / Activar -->
              <button type="button" class="btn-toggle-aviso p-1.5 rounded-lg ${estaActivo ? 'text-amber-700 hover:bg-amber-100' : 'text-emerald-700 hover:bg-emerald-100'} transition-colors cursor-pointer" data-id="${a.id}" title="${estaActivo ? 'Pausar (ocultar de la TV)' : 'Activar (mostrar en la TV)'}">
                <span class="material-symbols-outlined text-[19px]">${estaActivo ? 'visibility_off' : 'visibility'}</span>
              </button>

              <!-- Botón Eliminar -->
              <button type="button" class="btn-eliminar-aviso p-1.5 rounded-lg text-red-600 hover:bg-red-100 transition-colors cursor-pointer" data-id="${a.id}" title="Eliminar aviso definitivamente">
                <span class="material-symbols-outlined text-[19px]">delete</span>
              </button>
            </div>
          </div>

          <!-- Título y Mensaje -->
          <div class="flex items-start gap-3 justify-between">
            <div class="min-w-0 flex-1">
              <h4 class="text-sm font-extrabold text-slate-900 leading-snug">${a.titulo}</h4>
              <p class="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">${a.mensaje}</p>
              ${a.qrUrl ? `
                <span class="inline-block text-[10px] text-sky-800 font-mono font-medium truncate mt-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 max-w-full">
                  🔗 ${a.qrUrl}
                </span>
              ` : ''}
            </div>

            ${tieneQR && qrThumb ? `
              <div class="h-12 w-12 bg-white rounded-lg border-2 border-slate-900 p-0.5 shrink-0 shadow-sm flex items-center justify-center overflow-hidden" title="Código QR adjunto">
                <img src="${qrThumb}" alt="QR" class="w-full h-full object-contain">
              </div>
            ` : ''}
          </div>

        </div>
      `;
    }).join('');

    // Eventos para Botones Editar
    listaAvisosActivos.querySelectorAll('.btn-editar-aviso').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        iniciarEdicion(id);
      });
    });

    // Eventos para Botones Pausar / Activar
    listaAvisosActivos.querySelectorAll('.btn-toggle-aviso').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const aviso = InasistenciasLogic.conmutarEstadoAviso(id);
        renderAvisosActivos();
        if (aviso) {
          const estado = aviso.activo !== false ? 'activado en Pantalla TV' : 'pausado y oculto';
          mostrarToast(`Aviso "${aviso.titulo}" ${estado}.`, 'info');
        }
      });
    });

    // Eventos para Botones Eliminar
    listaAvisosActivos.querySelectorAll('.btn-eliminar-aviso').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const aviso = InasistenciasLogic.obtenerAvisoPorId(id);
        const titulo = aviso ? `"${aviso.titulo}"` : 'este aviso';
        if (confirm(`¿Deseas eliminar definitivamente ${titulo} de la cartelera?`)) {
          if (inputAvisoId.value === id) {
            cancelarEdicion();
          }
          InasistenciasLogic.eliminarAviso(id);
          renderAvisosActivos();
          mostrarToast('Aviso eliminado correctamente.', 'info');
        }
      });
    });
  }

  // Sincronización frecuente y bidireccional con Google Sheets
  async function sincronizarConGoogleSheets(esManual = false) {
    if (btnSyncAhora) btnSyncAhora.classList.add('opacity-50', 'pointer-events-none');

    try {
      if (typeof SheetAPI !== 'undefined') {
        const datos = await SheetAPI.obtenerDatos();
        const ahora = new Date();
        const horaStr = ahora.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (dotSyncAdmin) dotSyncAdmin.className = 'h-2 w-2 rounded-full bg-emerald-400 animate-pulse';
        if (txtSyncAdmin) txtSyncAdmin.textContent = 'Sheets y TV en vivo';
        if (horaSyncAdmin) horaSyncAdmin.textContent = horaStr;

        if (esManual) {
          const totalDocentes = Array.isArray(datos?.docentes) ? datos.docentes.length : 0;
          mostrarToast(`Planilla de Google Sheets sincronizada (${totalDocentes} inasistencias cargadas).`);
        }
      }
    } catch (err) {
      console.warn('Error sincronizando con Google Sheets:', err);
      if (dotSyncAdmin) dotSyncAdmin.className = 'h-2 w-2 rounded-full bg-amber-400';
      if (txtSyncAdmin) txtSyncAdmin.textContent = 'Reconectando Sheets...';
      if (esManual) {
        mostrarToast('No se pudo conectar con la planilla de Google Sheets. Verifica la conexión a internet.', 'warning');
      }
    } finally {
      if (btnSyncAhora) btnSyncAhora.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  // Inicialización de Eventos y Controladores
  function inicializar() {
    // Control y actualización de contadores de caracteres
    function actualizarContadores() {
      if (contadorTitulo && inputTitulo) {
        contadorTitulo.textContent = `${inputTitulo.value.length} / 65`;
      }
      if (contadorMensaje && inputMensaje) {
        contadorMensaje.textContent = `${inputMensaje.value.length} caracteres`;
      }
    }

    // Actualiza el aspecto de los botones de filtro
    function actualizarBotonesFiltro() {
      document.querySelectorAll('.filtro-btn').forEach(btn => {
        const f = btn.getAttribute('data-filtro');
        if (f === filtroEstadoActual) {
          btn.className = 'filtro-btn px-2.5 py-1 rounded-lg font-bold bg-[#00489A] text-white shadow-xs cursor-pointer transition-colors';
        } else {
          btn.className = 'filtro-btn px-2.5 py-1 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors';
        }
      });
    }

    // 1. Vista previa reactiva a escribir texto y contadores en vivo
    if (inputTitulo) {
      inputTitulo.addEventListener('input', () => {
        actualizarContadores();
        actualizarVistaPrevia();
      });
    }
    if (inputMensaje) {
      inputMensaje.addEventListener('input', () => {
        actualizarContadores();
        actualizarVistaPrevia();
      });
    }

    document.querySelectorAll('input[name="prioridad"]').forEach(r => {
      r.addEventListener('change', actualizarVistaPrevia);
    });


    // 2. Control de Toggle Código QR
    if (inputToggleQr && contenedorQrEnlace) {
      inputToggleQr.addEventListener('change', (e) => {
        if (e.target.checked) {
          contenedorQrEnlace.classList.remove('hidden');
          if (inputQrUrl.value.trim()) {
            actualizarQRDesdeUrl(inputQrUrl.value.trim());
          } else {
            inputQrUrl.focus();
          }
        } else {
          contenedorQrEnlace.classList.add('hidden');
        }
        actualizarVistaPrevia();
      });
    }

    // 3. Generación reactiva al escribir o pegar enlace URL
    if (inputQrUrl) {
      inputQrUrl.addEventListener('input', (e) => {
        clearTimeout(timerDebounceQR);
        const valor = e.target.value;
        timerDebounceQR = setTimeout(() => {
          actualizarQRDesdeUrl(valor);
        }, 250);
      });
    }

    // 4. Botón Limpiar Enlace QR
    if (btnLimpiarQrUrl && inputQrUrl) {
      btnLimpiarQrUrl.addEventListener('click', () => {
        inputQrUrl.value = '';
        actualizarQRDesdeUrl('');
        inputQrUrl.focus();
        mostrarToast('Enlace de QR limpiado.', 'info');
      });
    }

    // 5. Botón Cancelar Edición
    if (btnCancelarEdicion) {
      btnCancelarEdicion.addEventListener('click', cancelarEdicion);
    }

    // 6. Botón Restaurar Avisos Institucionales Base
    if (btnRestaurarBase) {
      btnRestaurarBase.addEventListener('click', () => {
        if (confirm('¿Deseas restablecer los comunicados base de la institución (ATD, Feriado y Boletos con QR)?')) {
          InasistenciasLogic.restaurarAvisosPorDefecto();
          cancelarEdicion();
          renderAvisosActivos();
          mostrarToast('Avisos base institucionales restaurados.');
        }
      });
    }

    // 7. Botón Manual de Sincronización con Sheets
    if (btnSyncAhora) {
      btnSyncAhora.addEventListener('click', () => {
        sincronizarConGoogleSheets(true);
      });
    }

    // 8. Envío del Formulario (Creación o Guardado de Edición)
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = inputAvisoId.value.trim() || undefined;
        const titulo = inputTitulo.value.trim();
        const mensaje = inputMensaje.value.trim();
        const prioridad = document.querySelector('input[name="prioridad"]:checked')?.value || 'atencion';
        const tieneQr = inputToggleQr.checked;
        const urlIngresada = inputQrUrl.value.trim();

        if (!titulo || !mensaje) {
          mostrarToast('Por favor completa el título y el mensaje del comunicado.', 'error');
          return;
        }

        if (tieneQr && !urlIngresada) {
          mostrarToast('Has seleccionado incluir código QR. Por favor escribe el enlace web de destino o desmarca la casilla.', 'warning');
          inputQrUrl.focus();
          return;
        }

        // Si tiene QR y aún no se generó o cambió la URL, generarlo ahora mismo
        let qrDataUrl = imagenQRActual;
        if (tieneQr && (!qrDataUrl || urlQRActual !== urlIngresada)) {
          qrDataUrl = await generarQRDataURL(urlIngresada);
        }

        InasistenciasLogic.guardarAviso({
          id,
          titulo,
          mensaje,
          prioridad,
          tieneQr,
          qrUrl: tieneQr ? urlIngresada : '',
          qrImagen: tieneQr ? qrDataUrl : ''
        });

        const fueEdicion = !!id;
        cancelarEdicion();
        renderAvisosActivos();

        if (fueEdicion) {
          mostrarToast('💾 ¡Cambios guardados exitosamente en la Pantalla TV!');
        } else {
          mostrarToast('🎉 ¡Aviso publicado exitosamente en la Pantalla TV!');
        }
      });
    }

    // 9. Sincronización multi-pestaña (si se modifica en otra ventana)
    window.addEventListener('storage', (e) => {
      if (e.key === 'isbo_avisos_manuales') {
        renderAvisosActivos();
        actualizarVistaPrevia();
      }
    });

    // 10. Control de Búsqueda de Avisos
    if (busquedaAvisos) {
      busquedaAvisos.addEventListener('input', (e) => {
        busquedaTextoActual = e.target.value;
        if (btnLimpiarBusqueda) {
          btnLimpiarBusqueda.classList.toggle('hidden', !busquedaTextoActual);
        }
        renderAvisosActivos();
      });
    }

    if (btnLimpiarBusqueda) {
      btnLimpiarBusqueda.addEventListener('click', () => {
        if (busquedaAvisos) busquedaAvisos.value = '';
        busquedaTextoActual = '';
        btnLimpiarBusqueda.classList.add('hidden');
        renderAvisosActivos();
      });
    }

    // 11. Botones de Filtrado por Estado (Todos, En TV, En Pausa)
    document.querySelectorAll('.filtro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroEstadoActual = btn.getAttribute('data-filtro') || 'todos';
        actualizarBotonesFiltro();
        renderAvisosActivos();
      });
    });

    // 12. Exportar Respaldo en Archivo JSON
    if (btnExportarJson) {
      btnExportarJson.addEventListener('click', () => {
        try {
          const json = InasistenciasLogic.exportarAvisosJSON();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const fecha = new Date().toISOString().slice(0, 10);
          const a = document.createElement('a');
          a.href = url;
          a.download = `respaldo_avisos_isbo_${fecha}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          mostrarToast('📥 Respaldo exportado exitosamente.', 'success');
        } catch (err) {
          console.error(err);
          mostrarToast('Error al exportar respaldo.', 'error');
        }
      });
    }

    // 13. Importar Respaldo desde Archivo JSON
    if (inputArchivoImportar) {
      inputArchivoImportar.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            InasistenciasLogic.importarAvisosJSON(evt.target.result);
            renderAvisosActivos();
            actualizarVistaPrevia();
            mostrarToast('📤 ¡Respaldo importado correctamente!');
          } catch (err) {
            mostrarToast('Error: archivo JSON inválido.', 'error');
          }
          inputArchivoImportar.value = '';
        };
        reader.readAsText(file);
      });
    }

    // 14. Monitoreo frecuente de la planilla de Google Sheets (cada 25 s)
    sincronizarConGoogleSheets(false);
    setInterval(() => sincronizarConGoogleSheets(false), INTERVALO_SYNC_SHEETS_MS);

    // Render inicial
    actualizarContadores();
    actualizarVistaPrevia();
    renderAvisosActivos();
  }

  document.addEventListener('DOMContentLoaded', inicializar);
})();
