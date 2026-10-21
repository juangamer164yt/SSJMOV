# Vía — guía del proyecto

Vía es una página web para responder una encuesta sobre movilidad y consultar sus resultados. Esta guía explica, en lenguaje sencillo, qué hace cada parte del proyecto. Los nombres entre comillas invertidas son los nombres reales de archivos o elementos del código.

## ¿Qué ocurre cuando alguien responde?

1. La página muestra la encuesta y sus preguntas.
2. La persona escribe sus datos, elige sus respuestas y acepta el aviso de consentimiento.
3. Al enviar, la página manda las respuestas al servicio que las guarda.
4. Si la persona ya había respondido usando el mismo correo, se reemplaza su respuesta anterior en vez de contarla dos veces. El correo no se comprueba: no se confirma que quien lo escribió sea su dueño.
5. La página pide los resultados y los presenta en gráficos. Los gráficos muestran cantidades agrupadas, no la respuesta de cada persona.

El sistema guarda una versión codificada del correo para reconocer si se repite, no el correo escrito tal cual. Esa versión sigue siendo un dato relacionado con la persona y no debe tratarse como información completamente anónima. También guarda un código interno aleatorio para cada respuesta.

## Partes de la página

### `index.html`

Contiene el contenido y la estructura de la página: la portada, la información sobre transportes, la encuesta, los resultados y la información del proyecto. También incluye el menú, los botones y los espacios donde aparecen las preguntas y los gráficos.

La página está preparada para verse en teléfonos y para poder recorrerse con el teclado y herramientas de accesibilidad.

### `css/styles.css`

Decide cómo se ve la página: colores, tamaños, espacios, tarjetas, gráficos y menú. También ajusta la distribución para que funcione en pantallas grandes y pequeñas, y ofrece temas oscuro y claro.

### `js/config.js`

Indica si la página usa respuestas de ejemplo. Con `USAR_DEMO` desactivado, se conecta al servicio que guarda las respuestas. Activado, muestra datos ficticios y no guarda respuestas reales.

### `js/preguntas.js`

Contiene las 11 preguntas, sus opciones y los grupos en que se organizan. La página usa esta misma lista para mostrar la encuesta y preparar los resultados.

| N.º | Nombre interno | Tipo de respuesta |
|---:|---|---|
| 1 | `rango_edad` | Una opción |
| 2 | `ocupacion` | Varias opciones; 2 grupos en el gráfico |
| 3 | `motivo_viaje` | Varias opciones; 3 grupos en el gráfico |
| 4 | `medio_principal` | Varias opciones; 3 grupos en el gráfico |
| 5 | `horario_viaje` | Varias opciones; 3 grupos en el gráfico |
| 6 | `transbordo` | Varias opciones; 3 grupos en el gráfico |
| 7 | `disposicion_vehiculos` | Varias opciones; 3 grupos en el gráfico |
| 8 | `percepcion_calidad` | Varias opciones; 3 grupos en el gráfico |
| 9 | `calificacion_vias` | Varias opciones; 3 grupos en el gráfico |
| 10 | `problema_movilidad` | Varias opciones; 3 grupos en el gráfico |
| 11 | `mejora_movilidad` | Varias opciones; 3 grupos en el gráfico |

En las preguntas de varias opciones, la última opción es excluyente: si se elige, no se puede combinar con las demás. Los nombres internos de las preguntas también se usan para guardar las respuestas; cambiarlos requiere ajustar la base de datos.

### `js/script.js`

Hace que la página responda a las acciones de las personas. Abre y cierra el menú, cambia el tema, muestra las preguntas, revisa que se completen los campos necesarios y envía la respuesta. En los campos de nombres y apellidos solo permite letras (incluidas las acentuadas) y espacios. También informa si hubo un problema o si el envío se completó.

Al empezar otra respuesta con el mismo correo, se actualiza la respuesta ya guardada.

### `js/estadisticas.js`

Pide los resultados y actualiza los gráficos, el total de respuestas y la fecha de la última respuesta. También permite filtrar los resultados y muestra mensajes si no hay datos o si ocurre un problema de conexión.

### `js/venn.js`

Crea los gráficos de círculos superpuestos que muestran opciones compartidas entre varios grupos. Permite explorar las cantidades con el ratón o el teclado.

### `js/demo.js`

Proporciona datos inventados para probar la página sin usar respuestas reales. Los datos se pierden al recargar la página, así que esta opción no sirve para guardar resultados de una encuesta real.

## Dónde se guardan las respuestas

La aplicación puede guardar los datos de dos maneras:

- **En la versión publicada:** usa una base de datos de Cloudflare.
- **En una computadora para pruebas:** usa una base local llamada `movilidad.sqlite`.

### `worker/index.mjs`

Es la parte que recibe y procesa las solicitudes en la versión publicada. Revisa que los datos tengan el formato esperado, guarda o actualiza las respuestas y prepara los resultados agrupados. También limita la cantidad de envíos desde una misma dirección de internet en un periodo corto.

### `server.js`

Es el servicio para ejecutar la aplicación en una computadora durante el desarrollo. Ofrece las mismas funciones básicas que la versión publicada y guarda los datos en `movilidad.sqlite`.

Si se cambia algo en la base de datos, avisa a las páginas que estén abiertas para que puedan actualizar sus resultados.

### `movilidad.sqlite`

Es el archivo local que contiene las respuestas cuando se usa `server.js`. No es un documento de texto y no se debe editar manualmente. Puede contener datos personales; por eso el proyecto evita incluirlo en las copias que se publican en Git.

## Cambios en la base de datos publicada

Los archivos de `migrations/` describen cambios que se aplican a la base de datos publicada. Se conservan en orden para que una instalación existente pueda actualizarse sin empezar de cero.

| Archivo | En palabras sencillas |
|---|---|
| `migrations/0001_create_respuestas.sql` | Crea el espacio donde se guardan los datos personales básicos, las respuestas y la fecha de creación. |
| `migrations/0002_create_codigos_acceso.sql` | Añadió una tabla para códigos de invitación de un solo uso. La encuesta actual no la utiliza. |
| `migrations/0003_unique_email_hash.sql` | Añade el dato codificado del correo y evita guardar más de una respuesta actual por cada correo. |
| `migrations/0004_add_internal_access_code.sql` | Añade un identificador aleatorio para cada respuesta. |
| `migrations/0005_add_response_update_time.sql` | Añade la fecha en que se actualizó cada respuesta por última vez. |

La versión local hace los cambios necesarios al iniciar. Las respuestas antiguas que se guardaron antes de registrar el correo no se pueden asociar automáticamente a una persona.

## Archivos de configuración y publicación

### `wrangler.jsonc`

Indica a Cloudflare qué archivos y servicios necesita para publicar y ejecutar la aplicación.

### `package.json`

Lista las herramientas que necesita el proyecto y los comandos disponibles. Por ejemplo, `start` inicia la versión local, `dev:cloudflare` inicia una prueba con Cloudflare y `deploy` publica la aplicación.

### `package-lock.json`

Guarda las versiones exactas de las herramientas instaladas para que las instalaciones del proyecto sean consistentes. No contiene las funciones de la encuesta.

### `.github/workflows/deploy.yml`

Automatiza la publicación cuando se actualiza la rama `main` del proyecto o cuando alguien la inicia manualmente desde GitHub. Usa credenciales guardadas de forma privada en la configuración de GitHub.

### `.assetsignore`

Indica qué archivos no deben enviarse como parte de los recursos públicos de la página.

### `.gitignore`

Indica qué archivos deben quedarse fuera del historial compartido del proyecto, como herramientas instaladas, configuraciones privadas y bases de datos que podrían contener información personal.

## Carpetas creadas automáticamente

- `node_modules/` contiene las herramientas que necesita el proyecto; npm puede volver a instalarlas a partir de los archivos de configuración.
- `.wrangler/` guarda archivos temporales de las pruebas locales con Cloudflare.
- `.git/` contiene el historial y la información de seguimiento del proyecto.
