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
5. Pulsa **Aplicar todo** para incorporar todas las propuestas encontradas al editor.
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

- `activeTab` y `scripting`: leer y modificar el editor de la pestaña donde pulses la extensión.
- `https://web.archive.org/*`: consultar el índice de Wayback desde el proceso de fondo.
- `core.js` se expone solo a páginas de Wikipedia en español para cargar el módulo desde el script de contenido.

Las URL de las fuentes se envían a **Internet Archive** al revisar. No se envían el artículo completo, las cookies de Wikipedia ni las credenciales. No hay telemetría, servidor propio ni almacenamiento persistente. La caché de consultas repetidas vive únicamente durante la revisión.

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
