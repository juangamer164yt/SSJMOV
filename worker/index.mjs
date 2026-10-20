import catalog from '../js/preguntas.js';

const { PREGUNTAS, armarEstadisticas } = catalog;
const COLUMNAS = ['nombres', 'apellidos', ...PREGUNTAS.map((p) => p.id)];
const identificadores = COLUMNAS.map((c) => `"${c}"`);
const enviosPorIp = new Map();
const MAX_CUERPO = 10 * 1024;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const limpiar = (valor) => (typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '');

async function validar(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El contenido enviado no es válido.' };
  }
  const codigo = typeof body.codigo === 'string' ? body.codigo.replace(/[\s-]/g, '').toUpperCase() : '';
  if (!/^[A-F0-9]{20}$/.test(codigo)) {
    return { error: 'Escribe un código de invitación válido.' };
  }
  const nombres = limpiar(body?.nombres);
  const apellidos = limpiar(body?.apellidos);
  if (/\p{N}/u.test(nombres) || /\p{N}/u.test(apellidos)) {
    return { error: 'Los nombres y apellidos no pueden contener números.' };
  }
  if (!nombres || !apellidos || nombres.length > 100 || apellidos.length > 100) {
    return { error: 'Escribe tus nombres y apellidos (máximo 100 caracteres cada uno).' };
  }
  if (body.consentimiento !== true) return { error: 'Debes aceptar la autorización para continuar.' };

  const fila = { nombres, apellidos };
  for (const pregunta of PREGUNTAS) {
    const validos = pregunta.opciones.map(([codigo]) => codigo);
    const invalida = { error: `Respuesta no válida en: ${pregunta.texto}` };
    let valor = body[pregunta.id];
    if (pregunta.tipo === 'multiple') {
      if (!Array.isArray(valor) || !valor.length || !valor.every((x) => validos.includes(x))) return invalida;
      if (valor.includes(pregunta.venn.fuera) && valor.length > 1) return invalida;
      valor = validos.filter((x) => valor.includes(x)).join(',');
    } else if (typeof valor !== 'string' || !validos.includes(valor)) {
      return invalida;
    }
    fila[pregunta.id] = valor;
  }
  const codigoHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo)))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return { fila, codigoHash };
}

function permitirEnvio(ip) {
  const ahora = Date.now();
  const envios = (enviosPorIp.get(ip) || []).filter((instante) => ahora - instante < 60000);
  if (envios.length >= 20) return false;
  envios.push(ahora);
  enviosPorIp.set(ip, envios);
  return true;
}

async function leerBody(request) {
  const longitud = Number(request.headers.get('content-length'));
  if (longitud > MAX_CUERPO) return { error: 'La solicitud es demasiado grande.' };
  const texto = await request.text();
  if (new TextEncoder().encode(texto).byteLength > MAX_CUERPO) return { error: 'La solicitud es demasiado grande.' };
  try {
    return { body: JSON.parse(texto) };
  } catch {
    return { error: 'El contenido enviado no es un JSON válido.' };
  }
}

async function obtenerEstadisticas(db) {
  const resultados = await db.batch(PREGUNTAS.map((p) => db.prepare(
    `SELECT '${p.id}' AS pregunta, "${p.id}" AS valor, COUNT(*) AS personas FROM respuestas GROUP BY "${p.id}"`,
  )));
  const filas = resultados.flatMap((resultado) => resultado.results);
  const meta = await db.prepare('SELECT COUNT(*) AS total, MAX(creado_en) AS ultima_respuesta FROM respuestas').first();
  const conteos = {};
  for (const fila of filas) {
    (conteos[fila.pregunta] ??= {})[String(fila.valor)] = Number(fila.personas);
  }
  const estadisticas = armarEstadisticas(conteos, Number(meta.total));
  return {
    ...estadisticas,
    lastResponseAt: meta.ultima_respuesta ? `${meta.ultima_respuesta.replace(' ', 'T')}Z` : null,
  };
}

async function manejarApi(request, env) {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/estadisticas' && request.method === 'GET') {
    try {
      return json(await obtenerEstadisticas(env.DB));
    } catch (error) {
      console.error('No se pudieron calcular las estadísticas:', error);
      return json({ error: 'No se pudieron calcular las estadísticas' }, 500);
    }
  }

  if (pathname === '/api/respuestas' && request.method === 'POST') {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
      return json({ error: 'El contenido debe enviarse como JSON.' }, 415);
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
    if (!permitirEnvio(ip)) {
      return json({ error: 'Demasiados envíos seguidos. Inténtalo de nuevo en un minuto.' }, 429);
    }
    const { body, error: errorBody } = await leerBody(request);
    if (errorBody) return json({ error: errorBody }, errorBody.includes('grande') ? 413 : 400);
    const { fila, codigoHash, error } = await validar(body);
    if (error) return json({ error }, 400);

    try {
      const consumoId = crypto.randomUUID();
      const resultados = await env.DB.batch([
        env.DB.prepare(
          'UPDATE codigos_acceso SET consumo_id = ? WHERE codigo_hash = ? AND consumo_id IS NULL',
        ).bind(consumoId, codigoHash),
        env.DB.prepare(
          `INSERT INTO respuestas (${identificadores.join(', ')}) SELECT ${COLUMNAS.map(() => '?').join(', ')} ` +
          'WHERE EXISTS (SELECT 1 FROM codigos_acceso WHERE consumo_id = ?)',
        ).bind(...COLUMNAS.map((columna) => fila[columna]), consumoId),
      ]);
      if (Number(resultados[1].meta.changes) !== 1) {
        return json({ error: 'El código no es válido o ya fue utilizado.' }, 409);
      }
      return json({ ok: true }, 201);
    } catch (dbError) {
      console.error('No se pudo guardar la respuesta:', dbError);
      return json({ error: 'No se pudo guardar tu respuesta. Inténtalo de nuevo.' }, 500);
    }
  }

  return json({ error: 'Ruta de API no encontrada.' }, 404);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return manejarApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
