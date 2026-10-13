# 🏫 Documentación Funcional · Cartelera Digital ISBO
> **Sistema de Inasistencias Docentes y Avisos Institucionales**  
> **Instituto Superior Brazo Oriental (ISBO) — DGETP / UTU**

---

## 📌 1. Resumen y Arquitectura General

La **Cartelera Digital ISBO** es una aplicación web ligera (Vanilla JS, HTML5 y Tailwind CSS, sin frameworks pesados ni dependencias complejas) diseñada para proyectarse en la pantalla/TV del hall escolar y sincronizar en tiempo real:

1. **Inasistencias Docentes de Hoy:** Se leen automáticamente desde la planilla oficial de Google Sheets que gestiona Bedelía/Adscripción.
2. **Comunicados y Avisos con Códigos QR:** Se cargan desde un panel administrativo protegido con contraseña y se sincronizan bidireccionalmente con Google Sheets mediante un script de Google Apps Script.
3. **Tolerancia a Cortes de Red (Modo Offline):** Si internet se corta en el centro educativo, la pantalla sigue proyectando las últimas inasistencias y avisos válidos gracias al almacenamiento en caché local (`localStorage`).

---

## 🔗 2. Repositorio y Enlaces Clave

| Recurso | Enlace / Ubicación |
| :--- | :--- |
| **Repositorio GitHub** | [https://github.com/gavafue/cartelera-isbo](https://github.com/gavafue/cartelera-isbo) |
| **Ruta Local en el Equipo** | `/home/gavafue/cartelera-isbo` |
| **📺 Pantalla TV (Pública)** | `index.html` (o `https://gavafue.github.io/cartelera-isbo/`) |
| **📝 Panel Administrativo de Avisos** | `avisos.html` (o `https://gavafue.github.io/cartelera-isbo/avisos.html`) |
| **📊 Planilla Google Sheets** | *(Privada - Uso interno exclusivo de Bedelía y Adscripción)* |
| **⚙️ Web App Google Apps Script** | `https://script.google.com/macros/s/AKfycby7Cqt6FB1km9dH8iN6GV0eATxesGtarrsEBNPx8KzJC2J-3DhTCnYxAbKHezrZp0IDIw/exec` |

---

## 🗄️ 3. Almacén de Datos (Google Sheets)

El sistema utiliza **Google Sheets** como base de datos en la nube (sin costos de hosting de base de datos ni mantenimiento de servidores).

* **ID de la Planilla (`SPREADSHEET_ID`):**  
  Configurado en `js/sheet.js`
* **Permiso de Acceso necesario:**  
  La hoja debe tener permiso de lectura configurado como *"Cualquier usuario con el enlace puede ver"*.

### Pestaña 1: Inasistencias Docentes (Hoja Principal)
Gestionada diariamente por Bedelía / Adscripción. El lector (`js/sheet.js`) mapea automáticamente las columnas:
* **Columna Docente:** Nombre y apellido del profesor.
* **Columna Grupo:** Grupos asignados (ej: `3° MF`, `2° MK`, `TODOS`). El sistema normaliza errores de tipeo y variantes comunes.
* **Columna Desde / Inicio:** Fecha de inicio de la inasistencia.
* **Columna Hasta / Fin:** Fecha de finalización. Si está vacía o dice *"hoy"*, toma el día en curso.

### Pestaña 2: `Avisos` (Comunicados Institucionales)
Se crea o actualiza automáticamente cuando se guardan avisos desde `avisos.html`. Sus columnas en la fila 1 son:
1. `Título`: Encabezado del aviso (hasta 100 caracteres).
2. `Mensaje`: Contenido detallado (hasta 500 caracteres).
3. `Categoría`: `urgente`, `atencion`, `avisos`, `informacion`, `tramites` o `examenes`.
4. `Enlace QR`: Enlace web optativo para generar el código QR escaneable desde celulares.
5. `Activo`: `SI` o `NO` (permite pausar un aviso sin borrarlo).
6. `Fecha`: Fecha ISO de creación o última modificación.

---

## ⚡ 4. Google Apps Script (Web App de Guardado)

Para que el formulario de avisos pueda escribir en Google Sheets directamente desde el navegador (sin pedirle a cada adscripto iniciar sesión en Google), se utiliza una **Web App de Google Apps Script** vinculada a la planilla.

* **URL del Script en producción:**  
  `https://script.google.com/macros/s/AKfycby7Cqt6FB1km9dH8iN6GV0eATxesGtarrsEBNPx8KzJC2J-3DhTCnYxAbKHezrZp0IDIw/exec`

### Código del Script en Google Apps Script (`Código.gs`):
```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Avisos") || ss.insertSheet("Avisos");
  var data = JSON.parse(e.postData.contents);
  var avisos = Array.isArray(data) ? data : (data.avisos || [data]);
  
  sheet.clearContents();
  sheet.appendRow(["Título", "Mensaje", "Categoría", "Enlace QR", "Activo", "Fecha"]);
  
  for (var i = 0; i < avisos.length; i++) {
    var a = avisos[i];
    if (!a.titulo && !a.mensaje) continue;
    sheet.appendRow([
      a.titulo || "",
      a.mensaje || "",
      a.prioridad || "avisos",
      a.qrUrl || "",
      a.activo !== false ? "SI" : "NO",
      a.fechaCreacion || new Date().toISOString()
    ]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### ¿Cómo reinstalar o republicar el Apps Script si se crea una planilla nueva?
1. En la nueva planilla de Google Sheets, ve a **Extensiones** ➔ **Apps Script**.
2. Pega el código de arriba en el editor.
3. Arriba a la derecha, haz clic en **Implementar** ➔ **Nueva implementación**.
4. Tipo: **Aplicación web**.
5. Ejecutar como: **Yo** (tu cuenta de Google).
6. Quién tiene acceso: **Cualquiera** (*Anyone*).
7. Haz clic en **Implementar**, autoriza los permisos y copia la URL que termina en `/exec`.
8. En `avisos.html`, pega la nueva URL en el campo *"Conectar Planilla"* y pulsa Guardar.

---

## 🔐 5. Credenciales de Acceso

Para acceder al panel de redacción y edición de avisos (`avisos.html`):

* **Usuario:** `isboadmin`
* **Contraseña:** `avisos1sb0`

### Seguridad y Blindaje:
* Las credenciales **no se comparan en texto plano**: están protegidas con algoritmo criptográfico **SHA-256 con salt** (`isbo_cartelera_2026_salt`) en `js/avisos-admin.js`.
* La sesión dura **8 horas** y se almacena firmada en `sessionStorage`.
* Si no se inicia sesión correctamente, el panel administrativo ni siquiera se inserta en el DOM (permanece inerte dentro de un `<template>` HTML).

---

## 🛠️ 6. ¿Dónde Modificar Cosas si Algo Falla?

### 🚩 Problema A: Se cambió la Planilla de Google Sheets (nuevo enlace / ID)
Si el centro educativo cambia de archivo de planilla de inasistencias:
1. Copia el nuevo ID de la URL de la planilla: `https://docs.google.com/spreadsheets/d/AQUI_ESTA_EL_ID/edit`.
2. Edita el archivo `js/sheet.js` y reemplaza la constante en la línea 12:
   ```javascript
   const SPREADSHEET_ID = 'TU_NUEVO_ID_AQUI';
   ```
3. Si utilizas el backend opcional de Vercel, edita también `api/avisos.js` (línea 14):
   ```javascript
   const SPREADSHEET_ID = 'TU_NUEVO_ID_AQUI';
   ```
4. Asegúrate de que la nueva planilla tenga permisos de lectura: *"Cualquiera con el enlace puede ver"*.

---

### 🚩 Problema B: Se cambió la URL del Apps Script
Si se vuelve a implementar el script en Google y genera una URL nueva:
* **Opción rápida sin tocar código:** Ingresa a `avisos.html`, logueate con `isboadmin`, pega la nueva URL en el campo *"Conectar Planilla"* y haz clic en *"Conectar Planilla"*.
* **Opción permanente en el código:** Edita `js/inasistencias.js` en la línea 329:
   ```javascript
   const URL_APPS_SCRIPT_DEFAULT = 'https://script.google.com/macros/s/TU_NUEVA_URL/exec';
   ```
   Y en `api/avisos.js` (línea 13):
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TU_NUEVA_URL/exec';
   ```

---

### 🚩 Problema C: Cambiar el Usuario o la Contraseña del Administrador
Las credenciales están en `js/avisos-admin.js` dentro del objeto `AUTH_CONFIG`:
* `salt`: `isbo_cartelera_2026_salt`
* `userHashes`: Array con el hash SHA-256 de los usuarios válidos.
* `passHash`: Hash SHA-256 de la contraseña.
* `validTokens`: Hash SHA-256 de `usuario:password:isbo_cartelera_2026_salt`.

Para generar un nuevo usuario y clave, puedes usar la consola del navegador (F12) o cualquier generador SHA-256:
```javascript
// En la consola del navegador:
var u = "nuevo_usuario";
var p = "nueva_clave";
var salt = "isbo_cartelera_2026_salt";

// Hashes resultantes para colocar en AUTH_CONFIG:
// userHashes: [SHA256(u)]
// passHash: SHA256(p)
// validTokens: [SHA256(u + ":" + p + ":" + salt)]
```

---

### 🚩 Problema D: No aparecen las inasistencias en la TV
1. **Verificar la fecha de la planilla:** La pantalla filtra automáticamente las inasistencias correspondientes al día de hoy. Si en la columna "Hasta" figura una fecha pasada, la fila no se muestra.
2. **Verificar nombres de encabezados:** En la fila 1 de la planilla principal de Google Sheets deben existir encabezados reconocibles como:
   * `Docente` o `Profesor` o `Nombre`
   * `Grupo` o `Curso` o `Clase`
   * `Desde` o `Inicio`
   * `Hasta` o `Fin`
3. **Comprobar si el navegador quedó con datos viejos:** En la TV presionar `F5` o `Ctrl + Shift + R` para forzar refresco completo.

---

### 🚩 Problema E: Los avisos no impactan en la pantalla de pasillo
1. **Actualización periódica:** La pantalla TV consulta automáticamente cambios en Google Sheets cada **5 segundos** para avisos y cada **20 segundos** para inasistencias docentes.
2. Si se crearon avisos desde el mismo navegador en otra pestaña, el evento `storage` sincroniza en **0 ms** de forma inmediata.
3. Verificar si el aviso está marcado como *"Pausado"*: en el panel `avisos.html`, los avisos en pausa tienen el botón en gris y no se proyectan en la TV.

---

## 🚀 7. Modos de Despliegue y Ejecución

* **Modo Local / Red Interna:**
  Abrir `index.html` en el navegador del equipo conectado al Smart TV del pasillo. Presionar `F11` para pantalla completa.
* **Despliegue en GitHub Pages:**
  El repositorio ya está configurado en `main`. Disponible en `https://gavafue.github.io/cartelera-isbo/`.
* **Despliegue en Vercel:**
  ```bash
  cd /home/gavafue/cartelera-isbo
  vercel --prod
  ```
