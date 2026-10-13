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
  // ============================================================================
  // CREDENCIALES DE ACCESO ADMINISTRATIVO (SHA-256)
  // ============================================================================
  const AUTH_CONFIG = {
    userHashes: [
      'f6c1823b9cce392f129737fe2165e55437ce93df1697f4871c84eadf1558d488'
    ],
    passHash: 'aaa3fa97ccc67ad27252511e7066f7787785ecc399b0c494bdb0b84d36a498de',
    salt: 'isbo_cartelera_2026_salt',
    validTokens: [
      'e0fda24bcf3cf6e95c7a214eaa29b1f634debda0ec921b7a4d231542c0eefc36'
    ],
    sessionDurationMs: 8 * 60 * 60 * 1000
  };
  const STORAGE_AUTH_KEY = 'isbo_auth_session';

  /**
   * Cálculo criptográfico SHA-256 estándar.
   * Totalmente compatible en todos los navegadores, entornos seguros (HTTPS) y offline (file://).
   */
  function calcularSHA256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i, j;
    let result = '';
    const words = [];
    const asciiBitLength = ascii.length * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;

    const isPrime = function (candidate) {
      for (let n = 2; n <= Math.sqrt(candidate); n++) {
        if (candidate % n === 0) return false;
      }
      return true;
    };

    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (isPrime(candidate)) {
        if (primeCounter < 8) {
          hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        }
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter++;
      }
    }

    ascii += '\x80';
    while ((ascii.length % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength | 0;

    for (j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);

      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (let i2 = 3; i2 >= 0; i2--) {
        const b = (hash[i] >> (i2 * 8)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  // Elementos de la capa de autenticación (únicos en el DOM inicial)
  const authRoot = document.getElementById('auth-root');
  const adminRoot = document.getElementById('admin-root');
  const templatePanelAdmin = document.getElementById('template-panel-admin');
  const formLogin = document.getElementById('form-login');
  const inputLoginUsuario = document.getElementById('login-usuario');
  const inputLoginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');

  // Variables para elementos del panel administrativo (se enlazan dinámicamente tras autenticación)
  let btnLogout = null;
  let form = null;
  let inputAvisoId = null;
  let inputTitulo = null;
  let inputMensaje = null;
  let inputToggleQr = null;

  let contenedorQrEnlace = null;
  let inputQrUrl = null;
  let qrPreviewBox = null;
  let qrPreviewImg = null;
  let qrPreviewUrlText = null;
  let btnLimpiarQrUrl = null;

  let formTitulo = null;
  let formSubtitulo = null;
  let badgeModoEdicion = null;
  let btnSubmitAviso = null;
  let btnSubmitTexto = null;
  let btnSubmitIcon = null;
  let btnCancelarEdicion = null;
  let btnEliminarForm = null;

  let modalConfirmacion = null;
  let modalConfirmacionBox = null;
  let modalTitulo = null;
  let modalSubtitulo = null;
  let modalMensaje = null;
  let modalIcono = null;
  let modalIconoContainer = null;
  let modalBtnCancelar = null;
  let modalBtnConfirmar = null;
  let modalBtnConfirmarIcon = null;
  let modalBtnConfirmarTexto = null;

  let previewContainer = null;
  let listaAvisosActivos = null;
  let contadorAvisos = null;
  let btnRestaurarBase = null;
  let toastContainer = null;

  let busquedaAvisos = null;
  let btnLimpiarBusqueda = null;
  let contadorTitulo = null;
  let contadorMensaje = null;
  let timerSyncInterval = null;

  // Enlaza los elementos del DOM creados dinámicamente desde el template seguro
  function vincularElementosAdmin() {
    btnLogout = document.getElementById('btn-logout');
    form = document.getElementById('form-aviso');
    inputAvisoId = document.getElementById('aviso-id');
    inputTitulo = document.getElementById('aviso-titulo');
    inputMensaje = document.getElementById('aviso-mensaje');
    inputToggleQr = document.getElementById('aviso-toggle-qr');

    contenedorQrEnlace = document.getElementById('contenedor-qr-enlace');
    inputQrUrl = document.getElementById('aviso-qr-url');
    qrPreviewBox = document.getElementById('qr-preview-box');
    qrPreviewImg = document.getElementById('qr-preview-img');
    qrPreviewUrlText = document.getElementById('qr-preview-url-text');
    btnLimpiarQrUrl = document.getElementById('btn-limpiar-qr-url');

    formTitulo = document.getElementById('form-titulo');
    formSubtitulo = document.getElementById('form-subtitulo');
    badgeModoEdicion = document.getElementById('badge-modo-edicion');
    btnSubmitAviso = document.getElementById('btn-submit-aviso');
    btnSubmitTexto = document.getElementById('btn-submit-texto');
    btnSubmitIcon = document.getElementById('btn-submit-icon');
    btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
    btnEliminarForm = document.getElementById('btn-eliminar-form');

    modalConfirmacion = document.getElementById('modal-confirmacion');
    modalConfirmacionBox = document.getElementById('modal-confirmacion-box');
    modalTitulo = document.getElementById('modal-titulo');
    modalSubtitulo = document.getElementById('modal-subtitulo');
    modalMensaje = document.getElementById('modal-mensaje');
    modalIcono = document.getElementById('modal-icono');
    modalIconoContainer = document.getElementById('modal-icono-container');
    modalBtnCancelar = document.getElementById('modal-btn-cancelar');
    modalBtnConfirmar = document.getElementById('modal-btn-confirmar');
    modalBtnConfirmarIcon = document.getElementById('modal-btn-confirmar-icon');
    modalBtnConfirmarTexto = document.getElementById('modal-btn-confirmar-texto');

    previewContainer = document.getElementById('preview-card-container');
    listaAvisosActivos = document.getElementById('lista-avisos-activos');
    contadorAvisos = document.getElementById('contador-avisos-activos');
    btnRestaurarBase = document.getElementById('btn-restaurar-base');
    toastContainer = document.getElementById('toast-container');

    busquedaAvisos = document.getElementById('busqueda-avisos');
    btnLimpiarBusqueda = document.getElementById('btn-limpiar-busqueda');
    contadorTitulo = document.getElementById('contador-titulo');
    contadorMensaje = document.getElementById('contador-mensaje');
  }

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

  /**
   * Muestra un modal de confirmación interactivo accesible y visualmente integrado.
   * Reemplaza las ventanas emergentes nativas (confirm/alert) del navegador.
   * Retorna una Promesa que resuelve en true (confirmado) o false (cancelado).
   */
  function mostrarModalConfirmacion({
    titulo = '¿Confirmar acción?',
    subtitulo = 'ISBO · Gestión de Cartelera',
    mensaje = '¿Estás seguro de que deseas continuar?',
    tipo = 'info', // 'info' | 'peligro' | 'advertencia' | 'exito'
    icono = null,
    textoConfirmar = 'Confirmar',
    iconoConfirmar = 'check',
    textoCancelar = 'Cancelar'
  } = {}) {
    return new Promise((resolve) => {
      if (!modalConfirmacion || !modalConfirmacionBox) {
        resolve(window.confirm(mensaje.replace(/<[^>]+>/g, '')));
        return;
      }

      if (modalTitulo) modalTitulo.textContent = titulo;
      if (modalSubtitulo) modalSubtitulo.textContent = subtitulo;
      if (modalMensaje) modalMensaje.innerHTML = mensaje;

      // Icono contextual y esquemas de color
      let ic = icono;
      let containerClases = 'bg-sky-100 text-sky-800';
      let btnClases = 'bg-[#00489A] hover:bg-[#003878] text-white';

      if (tipo === 'peligro' || tipo === 'danger') {
        ic = ic || 'delete_forever';
        containerClases = 'bg-red-100 text-red-700';
        btnClases = 'bg-red-600 hover:bg-red-700 text-white';
      } else if (tipo === 'advertencia' || tipo === 'warning') {
        ic = ic || 'warning';
        containerClases = 'bg-amber-100 text-amber-800';
        btnClases = 'bg-amber-600 hover:bg-amber-700 text-white';
      } else if (tipo === 'exito' || tipo === 'success') {
        ic = ic || 'check_circle';
        containerClases = 'bg-emerald-100 text-emerald-800';
        btnClases = 'bg-emerald-600 hover:bg-emerald-700 text-white';
      } else {
        ic = ic || 'help_outline';
      }

      if (modalIcono) modalIcono.textContent = ic;
      if (modalIconoContainer) modalIconoContainer.className = `h-12 w-12 rounded-2xl flex items-center justify-center font-bold shrink-0 ${containerClases}`;

      if (modalBtnConfirmar) {
        modalBtnConfirmar.className = `px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${btnClases}`;
      }
      if (modalBtnConfirmarTexto) modalBtnConfirmarTexto.textContent = textoConfirmar;
      if (modalBtnConfirmarIcon) modalBtnConfirmarIcon.textContent = iconoConfirmar;

      const esAlertaSimple = textoCancelar === null || textoCancelar === false;
      if (modalBtnCancelar) {
        if (esAlertaSimple) {
          modalBtnCancelar.classList.add('hidden');
        } else {
          modalBtnCancelar.classList.remove('hidden');
          modalBtnCancelar.textContent = textoCancelar;
        }
      }

      let resuelto = false;
      const finalizar = (resultado) => {
        if (resuelto) return;
        resuelto = true;
        modalConfirmacionBox.classList.remove('scale-100', 'opacity-100');
        modalConfirmacionBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
          modalConfirmacion.classList.add('hidden');
          limpiarListeners();
          resolve(resultado);
        }, 150);
      };

      const onConfirmar = () => finalizar(true);
      const onCancelar = () => finalizar(false);
      const onBackdrop = (e) => {
        if (e.target === modalConfirmacion) finalizar(false);
      };
      const onKeydown = (e) => {
        if (e.key === 'Escape') finalizar(false);
      };

      const limpiarListeners = () => {
        if (modalBtnConfirmar) modalBtnConfirmar.removeEventListener('click', onConfirmar);
        if (modalBtnCancelar) modalBtnCancelar.removeEventListener('click', onCancelar);
        modalConfirmacion.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeydown);
      };

      if (modalBtnConfirmar) modalBtnConfirmar.addEventListener('click', onConfirmar);
      if (modalBtnCancelar) modalBtnCancelar.addEventListener('click', onCancelar);
      modalConfirmacion.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeydown);

      modalConfirmacion.classList.remove('hidden');
      requestAnimationFrame(() => {
        modalConfirmacionBox.classList.remove('scale-95', 'opacity-0');
        modalConfirmacionBox.classList.add('scale-100', 'opacity-100');
        if (modalBtnConfirmar) modalBtnConfirmar.focus();
      });
    });
  }

  /**
   * Muestra un modal informativo de alerta con un solo botón de confirmación ("Entendido").
   */
  function mostrarModalAlerta({
    titulo = 'Información',
    subtitulo = 'ISBO · Gestión de Cartelera',
    mensaje = '',
    tipo = 'exito',
    icono = 'check_circle',
    textoBoton = 'Entendido'
  } = {}) {
    return mostrarModalConfirmacion({
      titulo,
      subtitulo,
      mensaje,
      tipo,
      icono,
      textoConfirmar: textoBoton,
      iconoConfirmar: 'done',
      textoCancelar: null
    });
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
    if (btnEliminarForm) btnEliminarForm.classList.remove('hidden');

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
    if (btnEliminarForm) btnEliminarForm.classList.add('hidden');

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
          <p class="text-sm font-bold text-slate-700">No hay nuevos avisos</p>
          <p class="text-xs text-slate-400 mt-1">Usa el formulario de la izquierda para publicar tu primer aviso.</p>
        </div>
      `;
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
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const aviso = InasistenciasLogic.conmutarEstadoAvisoLocal(id);
        renderAvisosActivos();
        if (aviso) {
          const estado = aviso.activo !== false ? 'activado en Pantalla TV' : 'pausado y oculto';
          mostrarToast(`Aviso "${aviso.titulo}" ${estado}. Sincronizando...`, 'info');
          const listaActual = InasistenciasLogic.obtenerAvisosGuardados();
          InasistenciasLogic.guardarAvisosEnServidor(listaActual).then(() => {
            mostrarToast('Estado sincronizado con Google Sheets.', 'success');
          }).catch(console.warn);
        }
      });
    });

    // Eventos para Botones Eliminar
    listaAvisosActivos.querySelectorAll('.btn-eliminar-aviso').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const aviso = InasistenciasLogic.obtenerAvisoPorId(id);
        const titulo = aviso ? `"${aviso.titulo}"` : 'este aviso';

        const confirmado = await mostrarModalConfirmacion({
          titulo: 'Eliminar Comunicado',
          mensaje: `¿Deseas eliminar definitivamente el aviso <strong>${titulo}</strong>?<br><br><span class="text-xs text-red-600 font-bold">Se quitará de la Pantalla TV y se borrará de la pestaña Avisos en Google Sheets.</span>`,
          tipo: 'peligro',
          icono: 'delete_forever',
          textoConfirmar: 'Eliminar Comunicado',
          iconoConfirmar: 'delete',
          textoCancelar: 'Cancelar'
        });

        if (!confirmado) return;

        if (inputAvisoId.value === id) {
          cancelarEdicion();
        }

        // 1. Eliminación local inmediata (0 ms)
        const listaActualizada = InasistenciasLogic.eliminarAvisoLocal(id);
        renderAvisosActivos();
        actualizarVistaPrevia();
        mostrarToast('Aviso eliminado de cartelera. Sincronizando con Google Sheets...', 'info');

        // 2. Sincronización en segundo plano con Sheets
        try {
          if (listaActualizada) {
            await InasistenciasLogic.guardarAvisosEnServidor(listaActualizada);
          }
          mostrarToast('Aviso eliminado de Google Sheets.', 'success');
        } catch (errSync) {
          console.warn('Error sincronizando eliminación:', errSync);
        }
      });
    });
  }

  // Sincronización automática periódica en segundo plano con Google Sheets
  async function sincronizarConGoogleSheets() {
    try {
      const resAvisos = await InasistenciasLogic.sincronizarAvisosConServidor();
      if (resAvisos && resAvisos.ok && resAvisos.fuente !== 'local-reciente-protegido') {
        renderAvisosActivos();
      }
      if (typeof SheetAPI !== 'undefined') {
        await SheetAPI.obtenerDatos();
      }
    } catch (err) {
      console.warn('Sincronización en segundo plano:', err);
    }
  }

  // ============================================================================
  // GESTIÓN DE SESIÓN Y AUTENTICACIÓN CRIPTOGRÁFICA
  // ============================================================================

  // Crea una sesión criptográficamente firmada con tiempo de expiración
  function crearSesionSegura(token) {
    const expira = Date.now() + AUTH_CONFIG.sessionDurationMs;
    const firma = calcularSHA256(`${token}:${expira}:${AUTH_CONFIG.salt}`);
    const sesionData = JSON.stringify({ token, expira, firma });
    try {
      sessionStorage.setItem(STORAGE_AUTH_KEY, btoa(sesionData));
    } catch (e) {
      sessionStorage.setItem(STORAGE_AUTH_KEY, sesionData);
    }
  }

  // Verifica la validez, integridad de firma y vigencia temporal de la sesión
  function sesionEsValida() {
    try {
      const raw = sessionStorage.getItem(STORAGE_AUTH_KEY);
      if (!raw) return false;

      let json = raw;
      try {
        json = atob(raw);
      } catch (e) {
        // En caso de estar guardado sin btoa
      }

      const data = JSON.parse(json);
      if (!data || !data.token || !data.expira || !data.firma) {
        return false;
      }

      // 1. Verificar que la sesión no haya caducado (8 horas)
      if (Date.now() > data.expira) {
        cerrarSesionSegura();
        return false;
      }

      // 2. Verificar correspondencia con los tokens institucionales autorizados
      if (!AUTH_CONFIG.validTokens.includes(data.token)) {
        cerrarSesionSegura();
        return false;
      }

      // 3. Verificar la firma criptográfica para evitar alteraciones manuales en DevTools
      const firmaEsperada = calcularSHA256(`${data.token}:${data.expira}:${AUTH_CONFIG.salt}`);
      if (data.firma !== firmaEsperada) {
        cerrarSesionSegura();
        return false;
      }

      return true;
    } catch (e) {
      cerrarSesionSegura();
      return false;
    }
  }

  // Cierra y purga la sesión activa en el navegador
  function cerrarSesionSegura() {
    try {
      sessionStorage.removeItem(STORAGE_AUTH_KEY);
      sessionStorage.removeItem('isbo_admin_auth'); // Purga de compatibilidad
    } catch (e) {}
  }

  // Desmonta por completo el panel administrativo del árbol DOM
  function desmontarPanelAdmin() {
    if (timerSyncInterval) {
      clearInterval(timerSyncInterval);
      timerSyncInterval = null;
    }
    if (adminRoot) {
      adminRoot.innerHTML = '';
      adminRoot.classList.add('hidden');
    }
    if (authRoot) {
      authRoot.classList.remove('hidden');
    }
    if (inputLoginUsuario) {
      setTimeout(() => inputLoginUsuario.focus(), 150);
    }
  }

  // Clona e inserta el template del panel administrativo y vincula controladores
  function montarPanelAdmin() {
    if (authRoot) authRoot.classList.add('hidden');
    if (adminRoot && templatePanelAdmin) {
      adminRoot.innerHTML = '';
      adminRoot.appendChild(templatePanelAdmin.content.cloneNode(true));
      adminRoot.classList.remove('hidden');
    }
    vincularElementosAdmin();
    inicializarEventosAdmin();
  }

  function inicializarFormularioLogin() {
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const usuarioIngresado = (inputLoginUsuario?.value || '').trim().toLowerCase();
        const passwordIngresado = (inputLoginPassword?.value || '').trim();

        // 1. Generar los hashes SHA-256 de las credenciales ingresadas
        const hashUsuario = calcularSHA256(usuarioIngresado);
        const hashPassword = calcularSHA256(passwordIngresado);
        const hashCombinado = calcularSHA256(`${usuarioIngresado}:${passwordIngresado}:${AUTH_CONFIG.salt}`);

        // 2. Comparar de forma estricta contra los hashes prealmacenados
        const usuarioValido = AUTH_CONFIG.userHashes.includes(hashUsuario);
        const passwordValido = hashPassword === AUTH_CONFIG.passHash;
        const tokenValido = AUTH_CONFIG.validTokens.includes(hashCombinado);

        if (usuarioValido && passwordValido && tokenValido) {
          crearSesionSegura(hashCombinado);
          if (loginError) loginError.classList.add('hidden');
          formLogin.reset();
          montarPanelAdmin();
          mostrarToast('Sesión administrativa iniciada correctamente.', 'success');
        } else {
          if (loginError) loginError.classList.remove('hidden');
          if (inputLoginPassword) {
            inputLoginPassword.value = '';
            inputLoginPassword.focus();
          }
        }
      });
    }
  }

  // Inicialización de Eventos y Controladores del Panel de Administración
  function inicializarEventosAdmin() {
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        const confirmado = await mostrarModalConfirmacion({
          titulo: 'Cerrar Sesión Administrativa',
          mensaje: '¿Deseas cerrar la sesión de administración de la cartelera ISBO?',
          tipo: 'advertencia',
          icono: 'logout',
          textoConfirmar: 'Cerrar Sesión',
          iconoConfirmar: 'logout',
          textoCancelar: 'Permanecer conectado'
        });

        if (confirmado) {
          cerrarSesionSegura();
          desmontarPanelAdmin();
          if (formLogin) formLogin.reset();
          if (loginError) loginError.classList.add('hidden');
          mostrarToast('Sesión cerrada.', 'info');
        }
      });
    }

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

    // 5b. Botón Eliminar desde el Formulario (Modo Edición)
    if (btnEliminarForm) {
      btnEliminarForm.addEventListener('click', async () => {
        const id = inputAvisoId.value.trim();
        if (!id) return;
        const aviso = InasistenciasLogic.obtenerAvisoPorId(id);
        const titulo = aviso ? `"${aviso.titulo}"` : 'este aviso';

        const confirmado = await mostrarModalConfirmacion({
          titulo: 'Eliminar Comunicado',
          mensaje: `¿Confirmas que deseas eliminar definitivamente ${titulo}?<br><br><span class="text-xs text-red-600 font-bold">Esta acción borrará el aviso de la Pantalla TV y de la pestaña Avisos en Google Sheets.</span>`,
          tipo: 'peligro',
          icono: 'delete_forever',
          textoConfirmar: 'Sí, Eliminar Definitivamente',
          iconoConfirmar: 'delete',
          textoCancelar: 'Cancelar'
        });

        if (!confirmado) return;

        // 1. Eliminación local inmediata (0 ms)
        const listaActualizada = InasistenciasLogic.eliminarAvisoLocal(id);
        cancelarEdicion();
        renderAvisosActivos();
        actualizarVistaPrevia();

        mostrarToast('Aviso eliminado de cartelera. Sincronizando con Google Sheets...', 'info');

        // 2. Sincronización en segundo plano con Google Sheets
        try {
          if (listaActualizada) {
            await InasistenciasLogic.guardarAvisosEnServidor(listaActualizada);
          }
          mostrarToast('Aviso eliminado de Google Sheets con éxito.', 'success');
        } catch (errSync) {
          console.warn('Error sincronizando eliminación:', errSync);
        }

        await mostrarModalAlerta({
          titulo: 'Comunicado Eliminado',
          mensaje: `El aviso ${titulo} ha sido eliminado con éxito de la Pantalla TV y de la planilla Google Sheets.`,
          tipo: 'exito',
          icono: 'delete_sweep'
        });
      });
    }

    // 6. Botón Vaciar Comunicados
    if (btnRestaurarBase) {
      btnRestaurarBase.addEventListener('click', async () => {
        const confirmado = await mostrarModalConfirmacion({
          titulo: 'Vaciar Todos los Comunicados',
          mensaje: '¿Deseas vaciar <strong>todos los comunicados</strong> de la cartelera?<br><br><span class="text-xs text-red-600 font-bold">Esta acción borrará todos los avisos de la Pantalla TV y dejará la pestaña Avisos en Google Sheets completamente limpia.</span>',
          tipo: 'peligro',
          icono: 'delete_sweep',
          textoConfirmar: 'Sí, Vaciar Todo',
          iconoConfirmar: 'delete_sweep',
          textoCancelar: 'Cancelar'
        });

        if (confirmado) {
          const vacia = InasistenciasLogic.restaurarAvisosPorDefectoLocal();
          cancelarEdicion();
          renderAvisosActivos();
          actualizarVistaPrevia();
          mostrarToast('Vaciando comunicados y sincronizando con Google Sheets...', 'info');
          await InasistenciasLogic.guardarAvisosEnServidor(vacia);
          mostrarToast('Todos los comunicados han sido eliminados de la cartelera y de Google Sheets.', 'success');
        }
      });
    }

    // 7. Envío del Formulario con Actualización Optimista Inmediata (0 ms) y Confirmación Explícita
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

        const esEdicion = !!id;
        const accionTexto = esEdicion ? 'guardar las modificaciones del' : 'publicar el';
        const confirmado = await mostrarModalConfirmacion({
          titulo: esEdicion ? 'Guardar Cambios del Aviso' : 'Publicar Nuevo Aviso',
          mensaje: `¿Confirmas que deseas ${accionTexto} aviso <strong>"${titulo}"</strong> en la Pantalla TV y en la planilla Google Sheets?`,
          tipo: 'info',
          icono: esEdicion ? 'save' : 'send',
          textoConfirmar: esEdicion ? 'Guardar y Publicar' : 'Publicar Aviso',
          iconoConfirmar: esEdicion ? 'save' : 'send',
          textoCancelar: 'Revisar datos'
        });

        if (!confirmado) {
          return;
        }

        // Si tiene QR y aún no se generó o cambió la URL, generarlo ahora mismo
        let qrDataUrl = imagenQRActual;
        if (tieneQr && (!qrDataUrl || urlQRActual !== urlIngresada)) {
          qrDataUrl = await generarQRDataURL(urlIngresada);
        }

        // 1. Guardar de inmediato localmente (Optimistic UI - 0 ms de demora)
        const resultadoLocal = InasistenciasLogic.guardarAvisoLocal({
          id,
          titulo,
          mensaje,
          prioridad,
          tieneQr,
          qrUrl: tieneQr ? urlIngresada : '',
          qrImagen: tieneQr ? qrDataUrl : ''
        });

        if (!resultadoLocal) {
          mostrarToast('Error de autenticación: Sesión no válida.', 'error');
          return;
        }

        // 2. Inmediatamente limpiar formulario y renderizar en pantalla (0 ms)
        cancelarEdicion();
        renderAvisosActivos();
        actualizarVistaPrevia();

        mostrarToast(
          esEdicion
            ? 'Aviso modificado en cartelera. Sincronizando con Google Sheets...'
            : 'Aviso publicado en cartelera. Sincronizando con Google Sheets...',
          'info'
        );

        // 3. Sincronización en segundo plano con Google Sheets y backend
        try {
          await InasistenciasLogic.guardarAvisosEnServidor(resultadoLocal.lista);
          mostrarToast(
            esEdicion
              ? 'Aviso modificado y sincronizado con Google Sheets con éxito.'
              : 'Aviso publicado y sincronizado con Google Sheets con éxito.',
            'success'
          );
        } catch (errSync) {
          console.warn('Error sincronizando con Google Sheets en segundo plano:', errSync);
          mostrarToast('Aviso guardado localmente. La sincronización remota reintentará en segundo plano.', 'warning');
        }

        const textoExito = esEdicion
          ? `El aviso <strong>"${titulo}"</strong> ha sido modificado y sincronizado correctamente con la Pantalla TV y la planilla Google Sheets.`
          : `El aviso <strong>"${titulo}"</strong> fue publicado con éxito en la Pantalla TV y sincronizado en la planilla Google Sheets.`;

        await mostrarModalAlerta({
          titulo: esEdicion ? '¡Aviso Modificado!' : '¡Aviso Publicado con Éxito!',
          mensaje: textoExito,
          tipo: 'exito',
          icono: 'verified'
        });
      });
    }

    // 8. Sincronización multi-pestaña (si se modifica en otra ventana)
    window.addEventListener('storage', (e) => {
      if (e.key === 'isbo_avisos_manuales') {
        renderAvisosActivos();
        actualizarVistaPrevia();
      }
    });

    // 9. Control de Búsqueda de Avisos
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

    // 10. Botones de Filtrado por Estado (Todos, En TV, En Pausa)
    document.querySelectorAll('.filtro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroEstadoActual = btn.getAttribute('data-filtro') || 'todos';
        actualizarBotonesFiltro();
        renderAvisosActivos();
      });
    });

    // 11. Monitoreo frecuente automático en segundo plano (cada 25 s)
    sincronizarConGoogleSheets();
    if (timerSyncInterval) clearInterval(timerSyncInterval);
    timerSyncInterval = setInterval(sincronizarConGoogleSheets, INTERVALO_SYNC_SHEETS_MS);

    // Render inicial
    actualizarContadores();
    actualizarVistaPrevia();
    renderAvisosActivos();
  }

  // Inicialización general
  function inicializar() {
    inicializarFormularioLogin();

    if (sesionEsValida()) {
      montarPanelAdmin();
    } else {
      desmontarPanelAdmin();
    }
  }

  document.addEventListener('DOMContentLoaded', inicializar);
})();
