# 🏫 Cartelera Digital ISBO - Inasistencias Docentes y Comunicados

> **Elaboración oficial para el Instituto Superior Brazo Oriental (ISBO)**  
> **DGETP - UTU (Dirección General de Educación Técnico Profesional) — Montevideo, Uruguay**

Sistema de señalética e información educativa digital de alto impacto visual y tolerancia a fallos, desarrollado con **HTML5, Tailwind CSS y JavaScript Vanilla Modular**, sin dependencias de servidor ni frameworks pesados. Diseñado y elaborado a medida para la comunidad educativa del **Instituto Superior Brazo Oriental (ISBO - DGETP / UTU)**.

Sincroniza y procesa en tiempo real las inasistencias docentes a partir de la planilla interna institucional de Google Sheets gestionada por el personal de Bedelía y Adscripción.

---

## 🏛️ Elaboración y Colaboradores Institucionales

Este proyecto fue concebido, desarrollado y configurado como una herramienta institucional para modernizar la comunicación visual interna, la gestión de inasistencias docentes y la publicación de comunicados del centro escolar.

* **Institución Educativa Destino:** [Instituto Superior Brazo Oriental (ISBO)](https://isbo.utu.edu.uy)
* **Organización Oficial en GitHub:** [@institutosuperiorbrazooriental](https://github.com/institutosuperiorbrazooriental)
* **Colaborador / Repositorio Institucional:** [@isbo-informatica](https://github.com/isbo-informatica) *(Bachillerato de Tecnologías de la Información)*
* **Desarrollo y Autoría:** [@gavafue](https://github.com/gavafue)

---

## 📁 Arquitectura Limpia y Estructura del Proyecto

El proyecto está organizado con arquitectura desacoplada y modular:

```text
cartelera-isbo/
├── index.html          # 📺 VISTA PÚBLICA / PANTALLA TV (100% inmersiva, limpia, sin iconos técnicos ni botones administrativos)
├── avisos.html         # 📝 PANEL DE ADMINISTRACIÓN DE AVISOS (Autenticado para adscriptos y administrativos: redactar, editar, pausar, buscar, QR y sincronización)
├── avisos.json         # 📦 Plantilla base de comunicados institucionales predeterminados (por defecto vacía)
├── logo-isbo.jpg       # 🏛️ Escudo oficial de la institución en alta resolución
├── manifest.json       # 📱 Web App Manifest para instalación como PWA y modo quiosco en Smart TVs / Tablets
├── vercel.json         # 🚀 Configuración para despliegue en Vercel
├── netlify.toml        # 🚀 Configuración para despliegue en Netlify
├── .gitignore          # 🛡️ Exclusión de archivos temporales del sistema
├── api/
│   └── avisos.js       # ⚡ Endpoint serverless para persistencia y respaldo en nube
├── css/
│   └── styles.css      # Animaciones de marquesina vertical con aceleración por hardware (GPU)
└── js/
    ├── qrcode.min.js   # Generador local offline de códigos QR de alta resolución (Error Correction Level H)
    ├── sheet.js        # Conexión tolerante a fallos con Google Sheets (JSONP + Fetch) y parser robusto de fechas
    ├── inasistencias.js# Lógica de ausencias de hoy, normalizador de grupos (3° MF, 2° MK), persistencia y sincronización
    ├── ui.js           # Renderizado visual de docentes, badges de grupos, marquesina y reloj digital
    ├── app.js          # Orquestador de la Pantalla TV con caché local tolerante a cortes de internet
    └── avisos-admin.js # Panel de administración: autenticación SHA-256 aislada, modales, generador de QR y actualización optimista 0 ms
```

---

## ✨ Características Principales

### 1. 📺 Vista Pública de Televisión (`index.html`)
* **100% Limpia para el Hall y Pasillos:**
  * Sin indicadores técnicos, links expuestos ni botones de control innecesarios en la proyección pública.
  * Encabezado institucional con el escudo oficial del ISBO, fecha en español y reloj digital en vivo.
  * Botón discreto de pantalla completa (soporta tecla `F11` estándar en computadoras de pasillo y teclados inalámbricos).
* **Caché Local Offline Resiliente:**
  * Carga inmediata desde almacenamiento local sin parpadeos ni pantallas en blanco.
  * Si el centro educativo sufre un corte temporal de internet, la pantalla continúa proyectando las inasistencias y avisos vigentes.
* **Manejo Dinámico de Inasistencias (0 a N Docentes):**
  * **0 inasistencias:** Muestra banner tranquilizador institucional (*"Sin inasistencias docentes para hoy - Jornada completa y normal"*).
  * **1 a 3 docentes:** Tarjetas estáticas de gran tamaño para lectura cómoda a distancia.
  * **4 o más docentes:** Marquesina vertical continua asistida por GPU sin saltos bruscos.
* **Normalización Tolerante de Grupos y Docentes:**
  * Interpreta abreviaciones administrativas escritas manualmente en Google Sheets (`2mk`, `3~mg`, `3mf`, `1mm`, `FPB 1`) y las unifica en insignias estandarizadas (`3° MG`, `3° MF`, `2° MK`).
  * Todas las variantes de *"todos"* se consolidan en `TODOS LOS GRUPOS`.

### 2. 📝 Panel de Administración de Avisos (`avisos.html`)
* **Acceso Administrativo Seguro (Hasheado con SHA-256):**
  * Acceso protegido con contraseña mediante verificación criptográfica SHA-256 con salting y tokens de sesión firmados.
  * Las credenciales no se exponen en texto plano en el código fuente; se distribuyen exclusivamente de forma interna a adscriptos y administrativos.
  * Interfaz aislada en `<template>` HTML: el DOM administrativo no se monta en el navegador hasta que la sesión es autenticada con éxito.
* **Actualización Optimista Inmediata (0 ms):**
  * Al publicar, modificar o eliminar un aviso, los cambios impactan al instante en la cartelera y en la lista de avisos vigentes.
  * La sincronización con Google Sheets (Google Apps Script) se ejecuta en segundo plano sin congelar la pantalla.
  * Protección de caché: un período de gracia evita que la respuesta retrasada de Google Sheets sobreescriba los cambios locales recientes.
* **Modales de Confirmación y Alerta:**
  * Todos los diálogos de confirmación y mensajes de éxito utilizan modales accesibles con diseño institucional, sin alerts nativos del navegador.
* **Generación Automática de Códigos QR:**
  * Al marcar la opción de QR y pegar un enlace web (formularios, inscripciones, circulares), genera automáticamente un código QR optimizado para escaneo desde celulares a distancia.
* **6 Categorías Educativas Oficiales:**
  1. 🔴 **Urgente:** Suspensiones de clase, emergencias, paros y alertas meteorológicas.
  2. 🟠 **Atención:** Asambleas Técnico Docentes (ATD), salas docentes, elecciones.
  3. 🟣 **Avisos:** Novedades de dirección, secretaría y adscripción.
  4. 🔵 **Información:** Novedades generales, biblioteca y vida estudiantil.
  5. 🟢 **Trámites:** Boletos de transporte, pases, becas y constancias.
  6. 🟡 **Exámenes:** Mesas de examen, tribunales y períodos de prueba.
* **Simulador de TV en Vivo:** Muestra una vista previa idéntica a cómo se apreciará el comunicado en la pantalla del hall.
* **Buscador y Filtros Rápidos:** Búsqueda en tiempo real por texto y filtros por estado (*Todos*, *En Pantalla TV*, *En Pausa*).
* **Pausar / Activar en 1 Clic:** Oculta comunicados temporalmente de la TV sin borrarlos.

---

## 🖥️ Configuración en la Pantalla TV del Hall

1. En el navegador del equipo conectado a la Smart TV o pantalla del pasillo (PC, Raspberry Pi o mini PC), abre `index.html` (o la URL desplegada en internet).
2. Presiona `F11` (o haz clic en el botón de la esquina superior derecha) para activar **Pantalla Completa**.
3. ¡Listo! La pantalla se actualizará automáticamente cada 25 segundos con los datos de Google Sheets y en tiempo real con los comunicados gestionados desde el formulario.

---

## 🌐 Despliegue en Plataformas Online

Al tratarse de una arquitectura modular basada en estándares web, puede alojarse en cualquier servidor estático o plataforma:

### Opción A: Despliegue en Vercel
```bash
cd ~/cartelera-isbo
vercel --prod
```

### Opción B: Despliegue en Netlify
```bash
cd ~/cartelera-isbo
netlify deploy --prod
```

### Opción C: Despliegue en GitHub Pages
1. En GitHub, dirígete a **Settings** -> **Pages**.
2. En la sección **Branch**, selecciona `main` (directorio `/root`) y guarda.
3. La aplicación estará accesible en: `https://gavafue.github.io/cartelera-isbo/`.
