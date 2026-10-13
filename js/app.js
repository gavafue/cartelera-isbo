/**
 * ============================================================================
 * Módulo: app.js
 * Responsabilidad: Orquestador de la Pantalla TV de Cartelera Digital:
 *                   - Monitoreo y sincronización frecuente con Google Sheets
 *                     (cada 25 segundos para capturar ingresos manuales de Bedelía).
 *                   - Avisos gestionados exclusivamente desde el formulario.
 *                   - Indicador visual de sincronización en tiempo real.
 * ============================================================================
 */

(function () {
  let datosCargados = { docentes: [] };
  const INTERVALO_SYNC_SHEETS_MS = 25 * 1000; // Revisar Google Sheets cada 25 segundos
  const INTERVALO_SYNC_AVISOS_MS = 20 * 1000; // Revisar avisos en la nube cada 20 segundos

  const CACHE_KEY_DOCENTES = 'isbo_docentes_cache';

  // Carga inmediata de inasistencias previas desde caché local (tolerancia offline)
  function cargarDesdeCache() {
    try {
      const guardado = localStorage.getItem(CACHE_KEY_DOCENTES);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed) && parsed.length > 0) {
          datosCargados.docentes = parsed.map(d => ({
            ...d,
            desde: d.desde ? new Date(d.desde) : null,
            hasta: d.hasta ? new Date(d.hasta) : null
          }));
          actualizarPantalla();
        }
      }
    } catch (e) {
      console.warn('Error al restaurar caché local de docentes:', e);
    }
  }

  // Guarda en caché local los últimos datos válidos obtenidos de Google Sheets
  function guardarEnCache(docentes) {
    try {
      localStorage.setItem(CACHE_KEY_DOCENTES, JSON.stringify(docentes));
    } catch (e) {
      console.warn('Error al guardar caché local de docentes:', e);
    }
  }

  // Refresca la vista completa en pantalla TV
  function actualizarPantalla() {
    // 1. Filtrar únicamente inasistencias de HOY
    const ausentesHoy = InasistenciasLogic.filtrarInasistenciasDeHoy(datosCargados.docentes, new Date());
    UI.renderDocentesDeHoy('lista-docentes', ausentesHoy, new Date());

    // 2. Renderizar avisos institucionales (desde el formulario / LocalStorage / Cloud)
    UI.renderAvisosConMarquee('contenedor-avisos');
  }

  // Sincroniza avisos institucionales con el backend en Vercel KV
  async function sincronizarAvisosServidor(forzarRender = false) {
    try {
      const res = await InasistenciasLogic.sincronizarAvisosConServidor();
      if ((res && res.cambio) || forzarRender) {
        UI.renderAvisosConMarquee('contenedor-avisos');
      }
    } catch (e) {
      console.warn('Advertencia al sincronizar avisos en servidor (usando local):', e);
    }
  }

  // Consulta y sincroniza la planilla de Google Sheets
  async function sincronizarConGoogleSheets() {
    try {
      const resultado = await SheetAPI.obtenerDatos();
      if (resultado && Array.isArray(resultado.docentes)) {
        datosCargados.docentes = resultado.docentes;
        guardarEnCache(resultado.docentes);
        actualizarPantalla();
      }
    } catch (err) {
      console.warn('Advertencia en sincronización periódica con Google Sheets (utilizando caché):', err);
    }
  }

  // Inicialización de la Pantalla TV
  async function iniciar() {
    // 1. Iniciar reloj digital en tiempo real y fecha oficial
    UI.iniciarReloj('reloj-hora', 'reloj-fecha');

    // 2. Control de pantalla completa (F11 / botón)
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
          document.exitFullscreen().catch(err => console.log(err));
        }
      });
    }

    // 3. Escuchar en tiempo real cambios de avisos desde el formulario (avisos.html)
    // Sincronización instantánea de 0 ms entre pestañas
    window.addEventListener('storage', (e) => {
      if (e.key === 'isbo_avisos_manuales') {
        actualizarPantalla();
      }
    });

    // 4. Carga inmediata desde caché para visualización instantánea sin parpadeo
    cargarDesdeCache();

    // 5. Carga y sincronización inicial de avisos con el backend
    await sincronizarAvisosServidor(true);

    // 6. Carga y sincronización inicial con Google Sheets
    await sincronizarConGoogleSheets();

    // 7. Verificación frecuente: cada 25s Sheets, cada 20s Avisos en la nube
    setInterval(sincronizarConGoogleSheets, INTERVALO_SYNC_SHEETS_MS);
    setInterval(() => sincronizarAvisosServidor(false), INTERVALO_SYNC_AVISOS_MS);
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
