const path = require('path');
const fs = require('fs');
const { createHash, randomUUID } = require('crypto');
const express = require('express');
const initSqlJs = require('sql.js');
// Mismo catálogo que usa el formulario: una sola fuente de verdad para preguntas y columnas.
const { PREGUNTAS, armarEstadisticas } = require('./js/preguntas.js');

const COLUMNAS = ['codigo_acceso', 'correo_hash', 'nombres', 'apellidos', ...PREGUNTAS.map((p) => p.id)];
const archivoDb = process.env.MOBILITY_DB_PATH || path.join(__dirname, 'movilidad.sqlite');
let SQL;
let db;
const identificadores = COLUMNAS.map((c) => `"${c}"`);
const crearTabla = `CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ${identificadores.map((c) => `${c} TEXT NOT NULL`).join(',\n  ')},
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
function ejecutar(sql, parametros = []) {
  db.run(sql, parametros);
}

function consultar(sql, parametros = []) {
  const statement = db.prepare(sql);
  try {
    if (parametros.length) statement.bind(parametros);
    const filas = [];
    while (statement.step()) filas.push(statement.getAsObject());
    return filas;
  } finally {
    statement.free();
  }
}

function consultarUno(sql, parametros = []) {
  return consultar(sql, parametros)[0] || null;
}

function persistir() {
  const temporal = `${archivoDb}.tmp`;
  try {
    fs.writeFileSync(temporal, Buffer.from(db.export()));
    fs.renameSync(temporal, archivoDb);
  } finally {
    if (fs.existsSync(temporal)) fs.unlinkSync(temporal);
  }
}

/* ---------- Estadísticas (solo agregados: nunca se devuelven nombres) ---------- */
async function calcularEstadisticas() {
  // Los nombres de columna salen del catálogo (no del usuario), por eso se pueden interpolar.
  const sql = PREGUNTAS.map((p) =>
    `SELECT '${p.id}' AS pregunta, "${p.id}" AS valor, COUNT(*) AS personas FROM respuestas GROUP BY "${p.id}"`).join(' UNION ALL ');
  const filas = await consultar(sql);
  const meta = await consultarUno('SELECT COUNT(*) AS total, MAX(creado_en) AS ultima_respuesta FROM respuestas');
  const conteos = {};
  filas.forEach((f) => { (conteos[f.pregunta] ??= {})[String(f.valor)] = Number(f.personas); });
  const estadisticas = armarEstadisticas(conteos, Number(meta.total));
  return {
    ...estadisticas,
    lastResponseAt: meta.ultima_respuesta ? `${meta.ultima_respuesta.replace(' ', 'T')}Z` : null,
  };
}

// Caché corta: varios navegadores pidiendo a la vez no multiplican las consultas.
let cache = { t: 0, datos: null };
async function estadisticas() {
  if (cache.datos && Date.now() - cache.t < 2000) return cache.datos;
  cache = { t: Date.now(), datos: await calcularEstadisticas() };
  return cache.datos;
}

/* ---------- Validación del formulario ---------- */
const limpiar = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

function validar(b = {}) {
  if (!b || typeof b !== 'object' || Array.isArray(b))
    return { error: 'El contenido enviado no es válido.' };
  const correo = typeof b.correo === 'string' ? b.correo.trim().toLowerCase() : '';
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    return { error: 'Escribe un correo electrónico válido.' };
  const nombres = limpiar(b.nombres), apellidos = limpiar(b.apellidos);
  if (/\p{N}/u.test(nombres) || /\p{N}/u.test(apellidos))
    return { error: 'Los nombres y apellidos no pueden contener números.' };
  if (!nombres || !apellidos || nombres.length > 100 || apellidos.length > 100)
    return { error: 'Escribe tus nombres y apellidos (máximo 100 caracteres cada uno).' };
  if (b.consentimiento !== true) return { error: 'Debes aceptar la autorización para continuar.' };

  const fila = {
    codigo_acceso: randomUUID(),
    correo_hash: createHash('sha256').update(correo).digest('hex'),
    nombres,
    apellidos,
  };
  for (const p of PREGUNTAS) {
    const validos = p.opciones.map(([codigo]) => codigo);
    const invalida = { error: `Respuesta no válida en: ${p.texto}` };
    let v = b[p.id];
    if (p.tipo === 'multiple') {
      if (!Array.isArray(v) || !v.length || !v.every((x) => validos.includes(x))) return invalida;
      if (v.includes(p.venn.fuera) && v.length > 1) return invalida; // la opción "fuera del Venn" no se combina
      v = validos.filter((x) => v.includes(x)).join(','); // sin repetidos y en el orden del catálogo
    } else if (typeof v !== 'string' || !validos.includes(v)) return invalida;
    fila[p.id] = v;
  }
  return { fila };
}

// Límite simple por IP para que nadie llene la base con envíos automáticos.
const envios = new Map();
function limitar(req, res, next) {
  const ahora = Date.now();
  const lista = (envios.get(req.ip) || []).filter((t) => ahora - t < 60000);
  if (lista.length >= 20) return res.status(429).json({ error: 'Demasiados envíos seguidos. Inténtalo de nuevo en un minuto.' });
  lista.push(ahora); envios.set(req.ip, lista); next();
}
setInterval(() => envios.clear(), 10 * 60 * 1000);

/* ---------- App ---------- */
const app = express();
app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Server-Sent Events: avisa a los navegadores cuando llegan respuestas nuevas.
const clientes = new Set();
const notificar = () => clientes.forEach((c) => c.write('event: cambio\ndata: {}\n\n'));

app.post('/api/respuestas', express.json({ limit: '10kb' }), limitar, async (req, res) => {
  const { fila, error } = validar(req.body);
  if (error) return res.status(400).json({ error });
  let respaldo;
  try {
    respaldo = db.export();
    db.run('BEGIN IMMEDIATE');
    if (consultarUno('SELECT 1 AS existe FROM respuestas WHERE correo_hash = ?', [fila.correo_hash])) {
      db.run('ROLLBACK');
      return res.status(409).json({ error: 'Este correo electrónico ya fue utilizado para responder la encuesta.' });
    }
    ejecutar(
      `INSERT INTO respuestas (${identificadores.join(', ')}) VALUES (${COLUMNAS.map(() => '?').join(', ')})`,
      COLUMNAS.map((c) => fila[c]));
    db.run('COMMIT');
    persistir();
    cache.datos = null; // la próxima consulta ya incluye esta respuesta
    notificar();
    res.status(201).json({ ok: true });
  } catch (e) {
    if (respaldo) {
      db.close();
      db = new SQL.Database(respaldo);
    }
    const correoDuplicado = e.message.includes('UNIQUE constraint failed: respuestas.correo_hash');
    if (!correoDuplicado) console.error(e);
    res.status(correoDuplicado ? 409 : 500).json({
      error: correoDuplicado
        ? 'Este correo electrónico ya fue utilizado para responder la encuesta.'
        : 'No se pudo guardar tu respuesta. Inténtalo de nuevo.',
    });
  }
});

app.get('/api/estadisticas', async (_req, res) => {
  try { res.json(await estadisticas()); }
  catch (e) { console.error(e); res.status(500).json({ error: 'No se pudieron calcular las estadísticas' }); }
});

app.get('/api/estadisticas/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  clientes.add(res);
  req.on('close', () => clientes.delete(res));
});

// Respaldo: detecta filas insertadas por otros medios (otra app, phpMyAdmin...) y avisa también.
let firma = null;
setInterval(async () => {
  if (!clientes.size) return;
  try {
    const f = await consultarUno('SELECT COUNT(*) AS a, COALESCE(MAX(id), 0) AS b FROM respuestas');
    const nueva = `${f.a}-${f.b}`;
    if (firma !== null && nueva !== firma) notificar();
    firma = nueva;
  } catch (e) { console.error(e); }
}, 3000);

const port = Number(process.env.PORT) || 3000;
(async () => {
  try {
    SQL = await initSqlJs();
    db = fs.existsSync(archivoDb)
      ? new SQL.Database(new Uint8Array(fs.readFileSync(archivoDb)))
      : new SQL.Database();
    db.run(crearTabla);
    const columnasRespuestas = consultar('PRAGMA table_info(respuestas)').map((columna) => columna.name);
    if (!columnasRespuestas.includes('codigo_acceso')) db.run('ALTER TABLE respuestas ADD COLUMN codigo_acceso TEXT');
    if (!columnasRespuestas.includes('correo_hash')) db.run('ALTER TABLE respuestas ADD COLUMN correo_hash TEXT');
    db.run('UPDATE respuestas SET codigo_acceso = lower(hex(randomblob(16))) WHERE codigo_acceso IS NULL');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_respuestas_codigo_acceso ON respuestas(codigo_acceso)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_respuestas_correo_hash ON respuestas(correo_hash) WHERE correo_hash IS NOT NULL');
    persistir();
    app.listen(port, () => console.log(`Vía en http://localhost:${port} (SQLite: ${archivoDb})`));
  } catch (error) {
    console.error('No se pudo inicializar la base de datos SQLite:', error);
    process.exit(1);
  }
})();
