# 🏫 Cartelera Digital ISBO - Inasistencias Docentes y Comunicados

Sistema de señalética e información educativa digital de alto impacto visual y tolerancia a fallos, desarrollado con **HTML5, Tailwind CSS y JavaScript Vanilla Modular**, sin dependencias de servidor ni frameworks pesados. Diseñado para el **Instituto Superior Brazo Oriental (ISBO - DGETP / UTU)**.

Conecta en tiempo real con la planilla oficial de Google Sheets:
[Planilla Oficial de Inasistencias ISBO](https://docs.google.com/spreadsheets/d/1t83h87_A01gSG518nU7QtpCGMNHR7kRbB900l-18TIk/edit?usp=sharing)

---

## 📁 Arquitectura Limpia y Estructura del Proyecto

El proyecto está organizado en la ruta directa `~/cartelera-isbo` con arquitectura desacoplada:

```text
cartelera-isbo/
├── index.html          # 📺 VISTA PÚBLICA / PANTALLA TV (100% inmersiva, limpia, sin iconos técnicos ni botones administrativos)
├── avisos.html         # 📝 PORTAL DE BEDELÍA (Panel administrativo: redactar, editar, pausar, buscar, QR y respaldos)
├── avisos.json         # 📦 Plantilla base de comunicados institucionales predeterminados
├── logo-isbo.jpg       # 🏛️ Escudo oficial de la institución en alta resolución
├── manifest.json       # 📱 Web App Manifest para instalación como PWA y modo quiosco en Smart TVs / Tablets
├── vercel.json         # 🚀 Configuración para despliegue instantáneo en Vercel
├── netlify.toml        # 🚀 Configuración para despliegue instantáneo en Netlify
├── .gitignore          # 🛡️ Exclusión de archivos temporales del sistema
├── css/
│   └── styles.css      # Animaciones de marquesina vertical con aceleración por hardware (GPU)
└── js/
    ├── qrcode.min.js   # Generador local offline de códigos QR de alta resolución (Error Correction Level H)
    ├── sheet.js        # Conexión tolerante a fallos con Google Sheets (JSONP + Fetch) y parser de fechas
    ├── inasistencias.js# Lógica de ausencias de hoy, normalizador de grupos (2mk -> 2° MK) y persistencia
    ├── ui.js           # Renderizado visual de docentes, badges de grupos, marquesina y reloj digital
    ├── app.js          # Orquestador de la Pantalla TV con caché local tolerante a cortes de internet
    └── avisos-admin.js # Lógica del panel de Bedelía: generador de QR, buscador, filtros y respaldos JSON
```

---

## ✨ Características Principales

### 1. 📺 Vista Pública de Televisión (`index.html`)
* **100% Limpia para el Hall / Pasillos:**
  * Se eliminaron todos los indicadores técnicos y de desarrollo (el icono de Google Sheets no se muestra en la pantalla pública).
  * Encabezado institucional con escudo del ISBO, fecha oficial en español y reloj digital en vivo.
  * Botón discreto de pantalla completa (soporta tecla `F11` estándar en quioscos y teclados inalámbricos).
* **Caché Local Offline Resiliente:**
  * Al iniciar o recargar la página, carga inmediatamente los últimos datos en caché sin pantalla blanca ni parpadeos.
  * Si el centro educativo sufre un corte temporal de internet, la pantalla continúa proyectando la información vigente.
* **Manejo Total de Inasistencias (0 a N Docentes):**
  * **0 inasistencias:** Muestra banner tranquilizador (*"Sin inasistencias docentes para hoy - Jornada completa y normal"*).
  * **1 a 3 docentes:** Tarjetas estáticas de gran tamaño para lectura a distancia.
  * **4 o más docentes:** Marquesina vertical continua asistida por GPU sin saltos bruscos.
* **Normalización Tolerante de Grupos:**
  * Interpreta abreviaciones administrativas (`2mk`, `2°mk`, `1mm`, `FPB 1`, `3 ma`) y las transforma en insignias estandarizadas (`2° MK`, `1° MM`). Todas las variantes de *"todos"* se unifican en `TODOS LOS GRUPOS`.

### 2. 📝 Portal de Gestión de Bedelía (`avisos.html`)
* **Super Intuitivo y Diseñado para Funcionarios Escolares:**
  * **Contador de caracteres en tiempo real:** Control visual del título (máx. 65 caracteres) y cuerpo del mensaje.
  * **Generación Automática de Códigos QR:** Escribe o pega cualquier enlace web (trámite, inscripción, circular) y el QR se genera al instante con contraste óptimo para cámaras de teléfonos móviles apuntando a la TV.
  * **6 Categorías Educativas Oficiales:**
    1. 🔴 **Urgente:** Suspensiones de clase, emergencias, paros y alertas meteorológicas.
    2. 🟠 **Atención:** Asambleas Técnico Docentes (ATD), salas docentes, elecciones.
    3. 🟣 **Avisos:** Novedades de dirección, secretaría y adscripción.
    4. 🔵 **Información:** Novedades generales, biblioteca y vida estudiantil.
    5. 🟢 **Trámites:** Boletos de transporte, pases, becas y constancias.
    6. 🟡 **Exámenes:** Mesas de examen, tribunales y períodos de prueba.
  * **Simulador de TV en Vivo:** Muestra exactamente cómo se verá el aviso antes de publicarlo.
  * **Buscador y Filtros Rápidos:** Permite buscar avisos por título o contenido, y filtrarlos por estado (*Todos*, *En Pantalla TV*, *En Pausa*).
  * **Pausar / Activar en 1 Clic:** Oculta comunicados temporalmente sin necesidad de borrarlos.
  * **Copia de Respaldo y Restauración (JSON):**
    * **Exportar Respaldo:** Descarga un archivo `.json` para guardar en un pendrive o compartir entre computadoras de secretaría.
    * **Importar Respaldo:** Carga un archivo JSON en cualquier equipo o navegador en segundos.
    * **Restaurar Base:** Reestablece los comunicados base (ATD, Feriado y Boletos).
  * **Sincronización en Tiempo Real (0 ms):** Los cambios se reflejan inmediatamente en la TV mediante eventos del navegador (`storage`).

---

## 🌐 Despliegue en Plataformas Online (1 Clic)

Al tratarse de una arquitectura estática sin base de datos ni servidor backend, se puede subir de forma gratuita y en minutos a cualquier servicio:

### Opción A: Despliegue en Vercel
1. Instala la CLI de Vercel (`npm i -g vercel`) o vincula el repositorio en [vercel.com](https://vercel.com).
2. Ejecuta desde la carpeta del proyecto:
   ```bash
   cd ~/cartelera-isbo
   vercel
   ```
3. Vercel detectará automáticamente el archivo [`vercel.json`](file:///home/gavafue/cartelera-isbo/vercel.json) y generará una URL pública segura con HTTPS (ej: `https://cartelera-isbo.vercel.app`).

### Opción B: Despliegue en Netlify
1. Instala Netlify CLI (`npm i -g netlify-cli`) o arrastra la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop).
2. O ejecuta por terminal:
   ```bash
   cd ~/cartelera-isbo
   netlify deploy --prod
   ```
3. Netlify utilizará las directivas de [`netlify.toml`](file:///home/gavafue/cartelera-isbo/netlify.toml).

### Opción C: Despliegue en GitHub Pages
1. Inicializa el repositorio Git y súbelo a tu cuenta de GitHub:
   ```bash
   cd ~/cartelera-isbo
   git init
   git add .
   git commit -m "Cartelera Digital ISBO - Versión Producción"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/cartelera-isbo.git
   git push -u origin main
   ```
2. En GitHub, ve a **Settings** -> **Pages** -> En *Branch* selecciona `main` y guarda.
3. En menos de un minuto tu aplicación estará disponible en `https://TU_USUARIO.github.io/cartelera-isbo/`.

---

## 🖥️ Configuración en la Pantalla TV del Pasillo
1. En el navegador del equipo conectado a la TV (PC pasillo, Raspberry Pi o Smart TV), abre `index.html` (o la URL desplegada en internet).
2. Presiona `F11` (o el botón en pantalla) para activar **Pantalla Completa**.
3. ¡Listo! La pantalla se actualizará automáticamente cada 25 segundos con los datos de Google Sheets y en tiempo real con los avisos cargados desde Bedelía.
