# Wikipedia Archivador

Extensión de Chrome (Manifest V3) para añadir archivos de Wayback Machine a referencias de **Wikipedia en español**. Se ejecuta al pulsar su icono, muestra una vista previa y añade los cambios al editor mediante **Aplicar todo**. Tú decides cuándo publicar la edición en Wikipedia.

## Instalación manual

1. Descarga este repositorio como ZIP y descomprímelo.
2. Abre `chrome://extensions` en Chrome.
3. Activa **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta `extension`, que contiene `manifest.json`.
5. Fija el icono de Wikipedia Archivador en la barra de Chrome si quieres tenerlo a mano.

No requiere compilación, servidor, cuenta de Internet Archive ni clave de API.

## Uso

1. Abre un artículo o una página de taller en `https://es.wikipedia.org/`.
2. Entra en **Editar** (editor visual) o **Editar código**.
3. Pulsa el icono de la extensión. Comenzará la revisión de las referencias del contenido abierto en el editor, incluidas las modificaciones aún sin publicar.
4. Revisa el informe y abre las capturas que quieras comprobar. **Detener** permite interrumpir la revisión después de la consulta en curso; las propuestas ya encontradas siguen disponibles.
5. Pulsa **Aplicar referencia** junto a una propuesta para incorporar solo esa referencia. Su botón pasará a **Aplicado**. Puedes continuar con otras referencias o pulsar **Aplicar todo** para incorporar únicamente las pendientes.
6. Comprueba el resultado y publica la edición desde Wikipedia cuando quieras.

Ejemplo de página para probar: <https://es.wikipedia.org/wiki/Usuario:Senormunoz/Taller/github>.

Si editas solo una sección, se revisará únicamente el contenido de esa sección. Si cambias una referencia antes de aplicar, se pedirá revisarla de nuevo para evitar sobrescribirla.

## Qué modifica

Plantillas `Cita web`, `Cita noticia`, `Cita publicación` y `Cita libro`, incluidas las referencias con nombre. En código fuente admite plantillas anidadas, enlaces internos y comentarios, sin interpretar las plantillas que estén dentro de comentarios o bloques nowiki.

Para una plantilla con `url` HTTP/HTTPS sin archivo existente, consulta el índice CDX de Internet Archive y elige la primera captura cronológica con **estado HTTP 200 registrado en el momento de la captura**. Añade:

```wikitext
|urlarchivo=https://web.archive.org/web/20240615192434/https://www.marca.com/balonmano/2024/06/15/666dda80268e3e10668b45d6.html
|fechaarchivo=2024-06-15
```

Conserva la URL original y el resto de los parámetros. Si hay datos no vacíos de URL o fecha de archivo, conserva la referencia completa, incluso si falta el otro campo. Los campos de archivo vacíos se completan sin duplicarlos.

No crea capturas nuevas, no modifica enlaces sin plantilla, no sustituye archivos existentes y no publica automáticamente. No añade parámetros que declaren rota la URL original.

## Límites y errores

- HTTP 200 no garantiza que el contenido sea correcto: algunas webs muestran páginas de error, acceso restringido o avisos con ese estado. La extensión no hace una clasificación semántica de las capturas. Conviene abrirlas antes de publicar.
- El estado 200 procede del índice histórico CDX. No significa que la reproducción de Wayback responda hoy con el mismo estado. La disponibilidad y el contenido pueden cambiar.
- Se usa la coincidencia exacta de URL según la normalización de Wayback. No se buscan versiones alternativas, redirecciones, rutas equivalentes ni otros archivos.
- La captura puede ser anterior a la fecha indicada por la fuente, por ejemplo si una web reutilizó una URL. Se conserva el criterio de captura más antigua solicitado.
- Una respuesta vacía significa que no se encontró captura 200; los fallos de red, límites de uso y respuestas inválidas se muestran como errores. Las consultas tienen un límite de 30 segundos y se realizan secuencialmente.
- Los editores visual y de código de Wikipedia pueden cambiar sus API. La integración usa las API del modelo de VisualEditor y el adaptador `textSelection` de WikiEditor; las personalizaciones y gadgets no estándar pueden requerir adaptación.
- Las URL construidas dinámicamente con otras plantillas no se consultan.

## Permisos y privacidad

- `storage`: caché temporal y pausas compartidas en la sesión de Chrome.
- `activeTab` y `scripting`: leer y modificar el editor de la pestaña donde pulses la extensión.
- `https://web.archive.org/*`: consultar el índice de Wayback desde el proceso de fondo.
- `core.js` se expone solo a páginas de Wikipedia en español para cargar el módulo desde el script de contenido.

Las URL de las fuentes se envían a **Internet Archive** al revisar. No se envían el artículo completo, las cookies de Wikipedia ni las credenciales. No hay telemetría ni servidor propio. Las URL consultadas y sus resultados se guardan en `chrome.storage.session`, compartido entre pestañas y revisiones y borrado al cerrar el navegador. La caché admite hasta 300 URL: las capturas encontradas caducan a las 24 horas y los resultados sin captura a la hora. Los errores no se guardan como resultados. También se conserva en esa sesión la pausa impuesta por Archive.org para respetarla aunque Chrome suspenda y reactive el proceso de fondo.

## Desarrollo y validación

Con Node.js 20 o posterior:

```sh
npm test
npm run check
```

Las pruebas unitarias cubren las cuatro plantillas, estructuras anidadas, conservación de archivos, parámetros vacíos, sustituciones múltiples, conflictos de texto y respuestas CDX. El test del panel de navegador usa respuestas simuladas, sin escribir en Wikipedia. Las pruebas manuales automatizadas del puente se realizaron sobre el taller indicado, con el editor visual real y el editor de código real, sin publicar.

Para ejecutar la prueba del panel con Playwright (probado con 1.62.1) y Chromium instalados:

```sh
npm run test:browser
```

La comprobación opcional contra Wikipedia real se ejecuta con `npm run test:live`. Solo altera el editor de la sesión de prueba: no pulsa Publicar. Requiere red y puede fallar si la página de taller cambia. Puedes indicar la ruta del navegador con `CHROMIUM_PATH`.

## Estructura

- `extension/`: extensión lista para cargar en Chrome.
- `tests/`: pruebas unitarias y del panel.
- `scripts/check.mjs`: comprobación del manifiesto y sintaxis.

Versión inicial privada. Sin publicación en Chrome Web Store.

### Resultado de esta validación

- 7 pruebas unitarias superadas; manifiesto y sintaxis comprobados.
- Panel probado en Chromium: vista previa, Aplicar todo, conservación de archivos, segunda ejecución y protección de cambios sin guardar.
- Puente probado sobre el taller real: lectura, modificación local, serialización y deshacer en el editor visual; lectura y modificación local en el editor de código. Modelo de código de VisualEditor comprobado con líneas en blanco y salto final.
- Consulta CDX real realizada con una referencia de MARCA del taller: captura 200 más antigua devuelta, 2024-06-15 19:24:34 UTC.
- No se publicó ninguna edición de Wikipedia.
- La carga completa de la extensión no pudo validarse en el Chromium gestionado del entorno: su política `ExtensionInstallBlocklist: ["*"]` bloquea extensiones nuevas. Las pruebas del panel y del puente se ejecutaron sin instalarla.

## Cambios en 0.2.0

- Botón **Aplicar referencia** por cada propuesta; permite aplicar varias referencias sucesivamente y combinarlo con **Aplicar todo**.
- Las referencias ya aplicadas quedan identificadas y sus botones desactivados.
- Corregido el cierre del panel con la X, también después de aplicar cambios. Se puede reabrir desde el icono conservando el informe.
- Pruebas de navegador añadidas para aplicaciones individuales fuera de orden, aplicación de las restantes y cierre/reapertura del panel.

Para actualizar una instalación manual, sustituye los archivos por los de esta versión, pulsa **Recargar** en la tarjeta de la extensión en `chrome://extensions` y recarga también la pestaña de Wikipedia. Si tienes cambios sin publicar, guárdalos o cópialos antes de recargar la página.

## Cambios en 0.3.0

Antes de consultar se cuentan las referencias y las URL únicas válidas sin archivo. Las consultas se realizan de una en una entre todas las pestañas, con una separación de 1,5–2,5 segundos; si hay más de 25 URL únicas pendientes, la separación aumenta a 3–5 segundos. Tras recibir limitaciones también aumenta la separación de las consultas posteriores. No se altera el orden de las referencias.

Si Archive.org devuelve **HTTP 429**, la revisión muestra:

> Archive.org ha limitado las consultas. ¿Quieres reanudar en … o prefieres aplicar las referencias ya encontradas y volver en otro momento?

- **Esperar y reanudar** conserva el panel y reintenta la URL limitada al terminar la cuenta atrás. Nunca reintenta antes del plazo indicado por `Retry-After`; si no hay un plazo válido, espera 1 minuto, después 2, 4, 8 y hasta 15 minutos en limitaciones sucesivas, con una pequeña variación adicional. Cada nueva limitación requiere elegir otra vez.
- **Aplicar las encontradas y terminar** incorpora al editor solo las propuestas pendientes ya encontradas y termina las consultas. Las aplicadas anteriormente se conservan y no se duplican. Si no hay propuestas pendientes, simplemente termina.
- Los botones individuales y **Aplicar todo** siguen disponibles durante las consultas y las pausas. **Detener** cancela la espera de inmediato. Cerrar con la X oculta el panel, que se puede volver a abrir desde el icono.

No se publica ninguna edición. Si el contenido del editor entra en conflicto con la revisión, se detiene la aplicación de cambios y se solicita revisar de nuevo.

La caché de sesión reduce las peticiones repetidas; una respuesta 429 pausa también las consultas de otras pestañas. No garantiza que Archive.org deje de limitar solicitudes: respeta las señales del servicio y permite terminar sin perder el trabajo encontrado.

Esta versión añade el permiso `storage` para la caché y las pausas de sesión. La validación incluye pruebas unitarias de plazos, caché, concurrencia y recuperación del proceso de fondo, además de pruebas del panel con un 429 simulado, aplicación durante la pausa, reanudación explícita y finalización anticipada.
