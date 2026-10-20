# Vía — Encuesta de movilidad ciudadana (formulario + estadísticas)

Una sola página: portada, encuesta de 11 preguntas y sección de **Estadísticas** en tiempo real. Tema oscuro/claro; la portada también cambia con el tema.

## Publicación gratuita con GitHub y Cloudflare

GitHub guarda el código; Cloudflare publica la página y almacena las respuestas en D1, una base de datos SQLite en la nube. La página seguirá disponible con el computador apagado. Cloudflare ofrece una dirección `workers.dev` gratuita; un dominio propio se compra por separado. Las estadísticas se actualizan automáticamente cada minuto y al enviar una respuesta. La fecha mostrada corresponde al momento en que se registró la respuesta más reciente, no a la última consulta de la página.

### Configuración inicial
1. Crea un repositorio en GitHub. Como la encuesta guarda nombres y respuestas personales, es recomendable elegir **Private**.
2. Crea una cuenta gratuita en Cloudflare e instala Node.js 22 o posterior en tu computador.
3. Abre PowerShell en la carpeta del proyecto e instala dependencias e inicia sesión:

   ```powershell
   npm.cmd install
   npx.cmd wrangler login
   npx.cmd wrangler d1 create via-movilidad
   ```

4. El comando de D1 muestra un `database_id`. En `wrangler.jsonc`, reemplaza `REEMPLAZAR_CON_DATABASE_ID` por ese valor.
5. Crea las tablas de la base remota:

   ```powershell
   npx.cmd wrangler d1 migrations apply via-movilidad --remote
   ```

6. En el panel de Cloudflare crea un API Token con permisos para desplegar Workers y administrar D1. En GitHub abre **Settings → Secrets and variables → Actions** y crea los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
7. Sube el proyecto a la rama `main`. GitHub Actions desplegará automáticamente el sitio; la URL `workers.dev` aparecerá en **Workers & Pages** en Cloudflare.

**Importante:** no subas `node_modules`. Esa carpeta contiene miles de archivos y ocupa alrededor de 190 MB; GitHub permite como máximo 100 archivos por carga desde la página web y también limita el tamaño de archivos individuales. Ya está excluida en `.gitignore`. Usa los comandos de Git desde PowerShell para subir solo el código fuente; al instalarlo, `npm.cmd install` reconstruye las dependencias usando `package-lock.json`.

La página web de GitHub no permite importar carpetas ocultas como `.github`; Git sí las incluye. Por eso, usa los comandos de PowerShell de abajo: así se sube también `.github/workflows/deploy.yml`, que activa la publicación automática.

Para subir el proyecto desde PowerShell, después de crear el repositorio vacío en GitHub:

```powershell
git add .
git commit -m "Preparar encuesta para publicación"
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

Este proyecto ya está inicializado en la rama `main`. Reemplaza `USUARIO/REPOSITORIO` por los datos del repositorio. Después de la primera publicación, cada `git push` a `main` actualiza el sitio. No será necesario dejar `npm` abierto en tu PC.

**Prueba local del Worker:** `npm.cmd run dev:cloudflare`. **Servidor local con un archivo SQLite:** `npm.cmd start`; estos modos son independientes de la base D1 online.

**Modo de demostración (sin guardar datos):** pon `USAR_DEMO = true` en `js/config.js`. Los datos serán simulados.

Los campos de nombres y apellidos eliminan números al escribir y el servidor también rechaza envíos que los incluyan.

### Un envío por correo electrónico
El formulario solicita el correo y solo permite una respuesta por dirección, sin distinguir mayúsculas ni espacios al inicio o al final. La base guarda un hash del correo, no la dirección legible; el hash sigue siendo un dato seudonimizado, no anónimo. El correo no se verifica: alguien puede usar una dirección ajena o distinta. Al actualizar una base D1 ya existente, aplica las migraciones con `npx.cmd wrangler d1 migrations apply via-movilidad --remote`. Las respuestas anteriores a este cambio no tienen un correo asociado y no se pueden deduplicar retroactivamente.

Cada respuesta recibe además un identificador interno único generado automáticamente. No se muestra ni se solicita a quien responde; no es un código de verificación del correo ni sustituye la regla de una respuesta por correo.

Los archivos públicos están en la raíz (`index.html`, `css/`, `js/`); el servidor y la base local también están en la raíz (`server.js`, `movilidad.sqlite`). No se usan carpetas `public/` ni `server/`. `.assetsignore` limita los archivos públicos que Cloudflare sirve para no exponer los archivos internos del proyecto.

## Estructura
```
worker/index.mjs        API de Cloudflare Workers: envíos y estadísticas con D1
wrangler.jsonc          configuración del Worker, recursos estáticos y D1
.github/workflows/deploy.yml  despliegue automático al subir cambios a main
index.html              portada + encuesta + estadísticas (HTML5 semántico)
css/styles.css          estilos comentados bloque por bloque
js/preguntas.js         CATÁLOGO ÚNICO: preguntas, opciones e identificadores (formulario, servidor y demo)
js/script.js            menú, tema y formulario
js/estadisticas.js, venn.js, demo.js  sección de estadísticas
server.js               servidor SQLite local para pruebas
movilidad.sqlite        base SQLite local (ignorada por Git)
migrations/              esquema inicial de la base D1
```

## Preguntas e identificadores
| # | Identificador | Tipo | Conjuntos del Venn |
|---|---|---|---|
| 1 | `rango_edad` | una opción (barras) | — |
| 2 | `ocupacion` | múltiple | Trabajo · Estudio (**2 conjuntos**) |
| 3 | `motivo_viaje` | múltiple | Trabajo o estudio · Compras y trámites · Recreación |
| 4 | `medio_principal` | múltiple | Vehículo privado · Transporte público · A pie / bici |
| 5 | `horario_viaje` | múltiple | Mañana · Tarde · Noche |
| 6 | `transbordo` | múltiple | Metro / tranvía · Bus / colectivo · Vehículo propio |
| 7 | `disposicion_vehiculos` | múltiple | Carro · Moto · Bici / monopatín |
| 8 | `percepcion_calidad` | múltiple | Rapidez · Economía · Seguridad y comodidad |
| 9 | `calificacion_vias` | múltiple | Estado de vías · Transporte público · Andenes y ciclorrutas |
| 10 | `problema_movilidad` | múltiple | Tráfico · Transporte público deficiente · Inseguridad |
| 11 | `mejora_movilidad` | múltiple | Transporte público · Vías y tráfico · Andenes / ciclorrutas |

En las preguntas múltiples, la última opción ("Otro", "Ninguno"…) es **excluyente** y representa la región fuera del diagrama. Se guardan como códigos separados por coma (`metro,bus`). Para cambiar una pregunta, edita `preguntas.js` y actualiza el esquema de la base si cambia algún identificador.

## Para producción
Nombres, apellidos y el hash del correo son datos personales: informa a las personas quién administra los datos, para qué se usarán y cómo solicitar su eliminación; si responden menores de edad, se requiere autorización de su representante legal. La API de estadísticas solo devuelve agregados. El Worker valida las respuestas y limita envíos por IP en cada instancia. El archivo de SQLite local está ignorado por Git para no subir respuestas privadas por error. Fotos de Unsplash y tipografía de Google Fonts requieren internet.
