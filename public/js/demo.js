/* =====================================================================
   MODO DEMO (USAR_DEMO = true en config.js)
   Respuestas simuladas en memoria: no hace falta servidor ni SQLite.
   Lo que se envía desde el formulario también entra aquí, así que las
   estadísticas reaccionan igual que con el servidor real.
   ===================================================================== */
const _filas = [];

// Generador pseudoaleatorio con semilla fija: los datos de prueba son los mismos en cada carga.
const _rng = (semilla) => () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296);
const _azar = _rng(2026);
const _elegir = (lista) => lista[Math.floor(_azar() * lista.length)];

/** Misma forma que guarda el servidor: orden del catálogo, separado por comas. */
function _canonica(p, marcadas) {
  return p.opciones.map(([c]) => c).filter((c) => marcadas.includes(c)).join(',');
}

/** Una persona simulada que responde todas las preguntas. */
function _filaAleatoria() {
  const fila = {};
  PREGUNTAS.forEach((p) => {
    const codigos = p.opciones.map(([c]) => c);
    if (p.tipo === 'multiple') {
      const reales = codigos.filter((c) => c !== p.venn.fuera);
      let marcadas = _azar() < 0.2 ? [p.venn.fuera] : reales.filter(() => _azar() < 0.45);
      if (!marcadas.length) marcadas = [_elegir(reales)]; // siempre responde al menos una
      fila[p.id] = _canonica(p, marcadas);
    } else fila[p.id] = _elegir(codigos);
  });
  return fila;
}
for (let i = 0; i < 80; i++) _filas.push(_filaAleatoria());

/** Simula que llega una persona nueva (la llama estadisticas.js cada cierto tiempo). */
function demoSimular() { _filas.push(_filaAleatoria()); }

/** Equivalente a POST /api/respuestas en modo demo. */
async function demoEnviar(datos) {
  await new Promise((r) => setTimeout(r, 400)); // simula la latencia de la red
  const fila = {};
  PREGUNTAS.forEach((p) => { fila[p.id] = p.tipo === 'multiple' ? _canonica(p, datos[p.id]) : datos[p.id]; });
  _filas.push(fila);
}

/** Equivalente a GET /api/estadisticas en modo demo. */
async function demoDatos() {
  await new Promise((r) => setTimeout(r, 500));
  const conteos = {};
  _filas.forEach((f) => PREGUNTAS.forEach((p) => {
    const c = (conteos[p.id] ??= {});
    c[f[p.id]] = (c[f[p.id]] || 0) + 1;
  }));
  return armarEstadisticas(conteos, _filas.length);
}
