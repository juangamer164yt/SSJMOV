/* =====================================================================
   VÍA — SECCIÓN DE ESTADÍSTICAS EN TIEMPO REAL
   - Preguntas de selección múltiple -> diagrama de Venn (2 o 3 conjuntos).
   - Preguntas de una sola opción    -> barras.
   Se actualiza sola mediante sondeo periódico y al enviar el formulario.
   Se envuelve en una función anónima para no ensuciar el ámbito global.
   ===================================================================== */
(() => {
const CONFIG = { api: '/api/estadisticas', pollMs: 60000,
  demoMs: 15000 }; // en demo: cada cuántos ms entra una persona simulada (0 = datos fijos)
const $ = (s) => document.querySelector(s);
const estado = { preguntas: [], total: 0, cargadoEn: null }; // última respuesta de la API ya normalizada
const cards = new Map();                                      // id de pregunta -> tarjeta del DOM (se reutilizan)

/**
 * Convierte la respuesta de la API en datos listos para pintar.
 * Venn: calcula también los conteos INCLUSIVOS de cada conjunto y de cada cruce
 * (los que marcaron A, incluyendo a quienes marcaron también B, etc.).
 */
function normalizar(p) {
  if (p.tipo === 'barras') {
    return { id: p.questionId, tipo: 'barras', texto: p.question, opciones: p.opciones, total: p.totalResponses };
  }
  const n = p.labels.length;                                           // 2 o 3 conjuntos
  const claves = n === 3 ? ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'] : ['A', 'B', 'AB'];
  const r = p.regions;                                                 // regiones exclusivas
  const inc = {};
  // Un conjunto "k" incluye toda región exclusiva que contenga todas sus letras.
  claves.forEach((k) => { inc[k] = Object.entries(r).filter(([reg]) => [...k].every((l) => reg.includes(l))).reduce((s, [, v]) => s + v, 0); });
  const dentro = Object.values(r).reduce((a, b) => a + b, 0);
  const total = p.totalResponses ?? dentro + (p.outside ?? 0);
  const out = Math.max(0, p.outside ?? total - dentro);                // fuera de todos los conjuntos
  inc.OUT = out;
  return { id: p.questionId, tipo: 'venn', texto: p.question, labels: p.labels, n, claves, r: { ...r, OUT: out }, inc, total,
    fuera: p.fuera || 'Ninguna, otra o sin respuesta' };
}

/* ---------- Tarjeta con diagrama de Venn ---------- */
function crearCardVenn(q) {
  const el = document.createElement('article');
  el.className = 'stat-card'; el.dataset.id = q.id;
  const ejes = ['A', 'B', 'C'].slice(0, q.n);
  const cruces = q.n === 3 ? ['AB', 'AC', 'BC', 'ABC'] : ['AB'];
  const sets = ejes.map((k) => `<li><span class="dot ${k}"></span><span data-l="${k}"></span><b><span data-k="${k}">0</span> personas — <span data-p="${k}"></span></b></li>`).join('');
  const inter = cruces.map((k) => `<li><span data-l="${k}"></span><b data-k="${k}">0</b></li>`).join('');
  el.innerHTML = `<header><p class="idx"></p><h3></h3></header><figure class="venn-wrap"><span class="tip" role="tooltip" hidden></span></figure>
    <section class="resumen" aria-label="Resumen de respuestas"><p class="t">Total de respuestas: <strong data-k="total">0</strong></p><ul>${sets}</ul>
    <p class="s">${q.n === 3 ? 'Intersecciones' : 'Intersección'} <small>(incluyen a quienes marcaron también la otra opción)</small></p><ul>${inter}</ul>
    <p class="s">Fuera del diagrama</p>
    <ul><li><span class="dot O"></span><span data-l="OUT"></span><b><span data-k="OUT">0</span> personas — <span data-p="OUT"></span></b></li></ul></section>`;
  el._venn = VENN.montar(el.querySelector('.venn-wrap'), 'v' + q.id, q.n);
  return el;
}

function actualizarVenn(el, q) {
  const L = q.labels;
  // Nombre de cada fila: "Carro", "Carro + Moto", "Las tres categorías"…
  const nombres = { OUT: q.fuera };
  q.claves.forEach((k) => { nombres[k] = k.length === 3 ? 'Las tres categorías' : [...k].map((l) => L['ABC'.indexOf(l)]).join(' + '); });
  for (const k in nombres) el.querySelector(`[data-l="${k}"]`).textContent = nombres[k];
  animar(el.querySelector('[data-k="total"]'), q.total);
  for (const k in q.inc) animar(el.querySelector(`[data-k="${k}"]`), q.inc[k]);
  ['A', 'B', 'C', 'OUT'].filter((k) => el.querySelector(`[data-p="${k}"]`))
    .forEach((k) => (el.querySelector(`[data-p="${k}"]`).textContent = pct(q.inc[k], q.total)));
  el._venn.actualizar(q.labels, q.r, q.total, q.fuera);
}

/* ---------- Tarjeta con barras ---------- */
function crearCardBarras(q) {
  const el = document.createElement('article');
  el.className = 'stat-card'; el.dataset.id = q.id;
  const items = q.opciones.map((o) => `<li data-v="${o.valor}"><div class="barra-top"><span class="barra-nombre"></span>
    <b><span data-k="n">0</span> · <span data-p></span></b></div><div class="barra" aria-hidden="true"><span></span></div></li>`).join('');
  el.innerHTML = `<header><p class="idx"></p><h3></h3></header><ul class="barras">${items}</ul>`;
  return el;
}

function actualizarBarras(el, q) {
  const max = Math.max(0, ...q.opciones.map((o) => o.n)); // la barra más larga ocupa el 100 % del ancho
  q.opciones.forEach((o) => {
    const li = el.querySelector(`li[data-v="${o.valor}"]`);
    li.querySelector('.barra-nombre').textContent = o.etiqueta;
    animar(li.querySelector('[data-k="n"]'), o.n);
    li.querySelector('[data-p]').textContent = pct(o.n, q.total);
    li.querySelector('.barra span').style.width = (max ? (o.n / max) * 100 : 0) + '%';
    li.classList.toggle('top', max > 0 && o.n === max); // resalta la opción más elegida
  });
}

const crearCard = (q) => (q.tipo === 'venn' ? crearCardVenn(q) : crearCardBarras(q));

function actualizarCard(el, q, n) {
  el.querySelector('.idx').textContent = 'Pregunta ' + n;
  el.querySelector('h3').textContent = q.texto;
  (q.tipo === 'venn' ? actualizarVenn : actualizarBarras)(el, q);
}

/** Pinta (o actualiza) las tarjetas según el filtro y el buscador. */
function render() {
  quitarEsqueleto();
  animar($('#total'), estado.total);
  const txt = $('#buscar').value.trim().toLowerCase(), sel = $('#selector');

  // El selector solo se reconstruye si cambia la lista de preguntas.
  const ids = estado.preguntas.map((q) => q.id).join();
  if (sel.dataset.ids !== ids) {
    const previo = sel.value;
    sel.innerHTML = `<option value="all">Todas las preguntas (${estado.preguntas.length})</option>` +
      estado.preguntas.map((q, i) => `<option value="${q.id}">${i + 1}. ${q.texto.slice(0, 60)}</option>`).join('');
    sel.value = [...sel.options].some((o) => o.value === previo) ? previo : 'all';
    sel.dataset.ids = ids;
  }
  $('#buscar').hidden = estado.preguntas.length <= 6;

  const visibles = estado.preguntas.map((q, i) => [q, i + 1])
    .filter(([q]) => (sel.value === 'all' || String(q.id) === sel.value) && q.texto.toLowerCase().includes(txt));
  const lista = $('#lista'), vivos = new Set();
  visibles.forEach(([q, n]) => {
    let el = cards.get(q.id);
    if (!el) { el = crearCard(q); cards.set(q.id, el); }
    actualizarCard(el, q, n);
    vivos.add(q.id);
  });
  cards.forEach((el, id) => { if (!vivos.has(id)) { el.remove(); if (!estado.preguntas.some((q) => q.id === id)) cards.delete(id); } });
  // Mantiene el orden de las preguntas aunque una tarjeta vuelva a aparecer tras filtrar.
  const orden = visibles.map(([q]) => cards.get(q.id));
  if (orden.some((el, i) => lista.children[i] !== el)) orden.forEach((el) => lista.appendChild(el));

  const vacio = $('#vacio');
  vacio.hidden = visibles.length > 0;
  vacio.textContent = estado.preguntas.length ? 'Ninguna pregunta coincide con la búsqueda.' : 'Todavía no hay preguntas ni respuestas. Las estadísticas aparecerán aquí cuando se registre la primera.';
}

function quitarEsqueleto() { document.getElementById('cargando')?.remove(); }

/** Indicador de estado: 'ok' | 'carga' | 'error'. */
function setEstado(tipo) {
  const e = $('#estado'); e.dataset.s = tipo;
  e.querySelector('.txt').textContent = { ok: 'Datos actualizados', carga: 'Actualizando…', error: 'Sin conexión con el servidor' }[tipo];
}

// Muestra la fecha y hora fijas de la última carga de datos (no cuenta el tiempo).
function mostrarFecha() {
  $('#hace').textContent = new Date(estado.cargadoEn).toLocaleString('es', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

let enCurso = false, pendiente = false; // evita lanzar dos cargas a la vez
async function cargar() {
  if (enCurso) { pendiente = true; return; }
  enCurso = true; if (!estado.cargadoEn) setEstado('carga'); // las recargas en segundo plano no cambian el estado
  try {
    const d = USAR_DEMO ? await demoDatos()
      : await fetch(CONFIG.api, { headers: { Accept: 'application/json' } }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    estado.preguntas = (d.questions || []).map(normalizar);
    estado.total = d.totalResponses || 0; estado.cargadoEn = Date.now();
    $('#error').hidden = true; setEstado('ok'); render(); mostrarFecha();
  } catch (e) {
    console.error(e); $('#error').hidden = false; setEstado('error'); quitarEsqueleto();
  } finally {
    enCurso = false;
    if (pendiente) { pendiente = false; cargar(); }
  }
}

/** Mantiene los datos al día con sondeo periódico; al enviar, se recargan inmediatamente. */
function tiempoReal() {
  if (USAR_DEMO) return CONFIG.demoMs && setInterval(() => { demoSimular(); cargar(); }, CONFIG.demoMs);
  setInterval(cargar, CONFIG.pollMs);
}

$('#selector').addEventListener('change', render);
$('#buscar').addEventListener('input', render);
$('#todas').addEventListener('click', () => { $('#buscar').value = ''; $('#selector').value = 'all'; render(); });
$('#reintentar').addEventListener('click', cargar);
document.addEventListener('respuesta-enviada', cargar); // al enviar el formulario, refresca de inmediato
cargar(); tiempoReal();
})();
