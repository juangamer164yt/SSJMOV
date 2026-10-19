/* =====================================================================
   DIAGRAMA DE VENN EN SVG (2 o 3 conjuntos)
   Recibe regiones EXCLUSIVAS: {A,B,AB} para 2 conjuntos o
   {A,B,C,AB,AC,BC,ABC} para 3. "OUT" = personas fuera de todos los conjuntos.
   ===================================================================== */
const fmt = (n) => n.toLocaleString('es');                                   // 1234 -> "1.234"
const pct = (n, t) => (t ? ((n / t) * 100).toFixed(1) + '%' : '0%');         // porcentaje con 1 decimal

/** Anima un número hasta su nuevo valor y lo "pulsa" solo cuando cambia. */
function animar(el, hasta) {
  const desde = Number(el.dataset.v ?? 0);
  el.dataset.v = hasta;
  if (desde === hasta || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(hasta); return; }
  el.classList.add('pulso'); setTimeout(() => el.classList.remove('pulso'), 900);
  const t0 = performance.now();
  (function paso(t) {
    const k = Math.min((t - t0) / 500, 1);
    el.textContent = fmt(Math.round(desde + (hasta - desde) * k));
    if (k < 1) requestAnimationFrame(paso);
  })(t0);
}

const VENN = (() => {
  const R = 100; // radio de los círculos (el lienzo SVG mide 400 x 360)

  /* Geometría de cada modo.
     circulos: centro de cada círculo · pos: dónde va el número de cada región ·
     nombres: [conjunto, x, y] de su etiqueta · def: para cada región, en qué círculos está (in)
     y de cuáles queda excluida (out). El orden va de menos a más solapamiento: las
     intersecciones se dibujan encima. OUT va primero porque queda debajo de todo. */
  const MODOS = {
    3: {
      circulos: { A: [150, 130], B: [250, 130], C: [200, 215] },
      pos: { A: [105, 108], B: [295, 108], C: [200, 282], AB: [200, 92], AC: [158, 192], BC: [242, 192], ABC: [200, 150], OUT: [358, 332] },
      nombres: [['A', 100, 20], ['B', 300, 20], ['C', 200, 346]],
      def: {
        OUT: { in: [], out: ['A', 'B', 'C'] },
        A: { in: ['A'], out: ['B', 'C'] }, B: { in: ['B'], out: ['A', 'C'] }, C: { in: ['C'], out: ['A', 'B'] },
        AB: { in: ['A', 'B'], out: ['C'] }, AC: { in: ['A', 'C'], out: ['B'] }, BC: { in: ['B', 'C'], out: ['A'] },
        ABC: { in: ['A', 'B', 'C'], out: [] },
      },
    },
    2: {
      circulos: { A: [155, 185], B: [245, 185] },
      pos: { A: [105, 185], B: [295, 185], AB: [200, 185], OUT: [358, 332] },
      nombres: [['A', 105, 70], ['B', 295, 70]],
      def: {
        OUT: { in: [], out: ['A', 'B'] },
        A: { in: ['A'], out: ['B'] }, B: { in: ['B'], out: ['A'] },
        AB: { in: ['A', 'B'], out: [] },
      },
    },
  };

  const corto = (s) => (s.length > 22 ? s.slice(0, 21) + '…' : s); // evita que una etiqueta larga se salga del lienzo

  /** Construye el SVG completo como texto. */
  function svg(uid, cfg, n) {
    const ejes = Object.keys(cfg.circulos), orden = Object.keys(cfg.def);
    const circ = (k, x = '') => `<circle cx="${cfg.circulos[k][0]}" cy="${cfg.circulos[k][1]}" r="${R}" ${x}/>`;

    // clipPath = "recorta a este círculo" (sirve para detectar el cursor); mask = "resta los círculos ajenos" (solo para el resaltado)
    const defs = ejes.map((k) => `<clipPath id="${uid}-c${k}">${circ(k)}</clipPath>`).join('') +
      orden.filter((r) => cfg.def[r].out.length).map((r) =>
        `<mask id="${uid}-m${r}"><rect width="400" height="360" fill="#fff"/>${cfg.def[r].out.map((k) => circ(k, 'fill="#000"')).join('')}</mask>`).join('');

    const sets = '<rect class="uni" x="4" y="4" width="392" height="352" rx="12"/>' +
      ejes.map((k) => circ(k, `class="set" fill="var(--${k.toLowerCase()})"`)).join('');

    // Cada región es un grupo enfocable con teclado; los clipPath anidados = intersección de círculos.
    const regs = orden.map((r) => {
      const d = cfg.def[r], m = d.out.length ? `mask="url(#${uid}-m${r})"` : '';
      return `<g class="reg" data-r="${r}" tabindex="0" role="button">${d.in.map((k) => `<g clip-path="url(#${uid}-c${k})">`).join('')}` +
        `<rect class="hit" width="400" height="360"/><rect class="hl" width="400" height="360" ${m}/>${'</g>'.repeat(d.in.length)}</g>`;
    }).join('');

    const nums = orden.map((r) => `<text class="n" data-n="${r}" x="${cfg.pos[r][0]}" y="${cfg.pos[r][1]}" text-anchor="middle" dominant-baseline="central">0</text>`).join('');
    const names = cfg.nombres.map(([k, x, y]) =>
      `<text class="nm" data-nm="${k}" x="${x}" y="${y}" text-anchor="middle" fill="var(--${k.toLowerCase()}-ink)"></text>`).join('');

    return `<svg class="venn" viewBox="0 0 400 360" role="group" aria-label="Diagrama de Venn de ${n} conjuntos"><defs>${defs}</defs>${sets}${regs}${nums}${names}` +
      `<text class="nm" x="358" y="310" text-anchor="middle" fill="var(--muted)" style="font-size:12px">Fuera</text></svg>`;
  }

  /**
   * Inserta el diagrama dentro de `wrap` y devuelve { actualizar }.
   * @param {HTMLElement} wrap  contenedor (debe incluir un elemento .tip para el tooltip)
   * @param {string} uid        prefijo único para los id del SVG (hay varios diagramas en la página)
   * @param {2|3} n             número de conjuntos
   */
  function montar(wrap, uid, n = 3) {
    const cfg = MODOS[n], ejes = Object.keys(cfg.circulos), orden = Object.keys(cfg.def);
    wrap.insertAdjacentHTML('afterbegin', svg(uid, cfg, n));
    const el = wrap.querySelector('svg'), tip = wrap.querySelector('.tip');
    const s = { labels: ejes.slice(), regions: {}, total: 0, fuera: '' }; // estado actual del diagrama

    /** Nombre legible de una región: "Solo X", "X + Y (solo estas dos)", etc. */
    const nombre = (r) => {
      if (r === 'OUT') return s.fuera || 'Fuera (ninguna, otra o sin respuesta)';
      const l = r.split('').map((k) => s.labels['ABC'.indexOf(k)]);
      return r.length === 1 ? 'Solo ' + l[0] : l.join(' + ') + (r.length === 2 && n === 3 ? ' (solo estas dos)' : '');
    };

    const mostrar = (e, r) => { // tooltip junto al cursor
      const cant = s.regions[r] ?? 0;
      tip.innerHTML = `<b>${nombre(r)}</b>Personas: ${fmt(cant)}<br>Porcentaje: ${pct(cant, s.total)}`;
      tip.hidden = false;
      const b = wrap.getBoundingClientRect();
      const x = Math.min(e.clientX - b.left + 14, b.width - tip.offsetWidth);
      tip.style.left = Math.max(0, x) + 'px'; tip.style.top = e.clientY - b.top + 14 + 'px';
    };

    const sel = (g) => { // al hacer clic se resalta una región y se atenúan las demás
      const on = !g.classList.contains('on');
      el.querySelectorAll('.reg.on, .n.on').forEach((x) => x.classList.remove('on'));
      el.classList.toggle('sel', on);
      if (on) { g.classList.add('on'); el.querySelector(`[data-n="${g.dataset.r}"]`).classList.add('on'); }
    };

    el.addEventListener('mousemove', (e) => { const g = e.target.closest('.reg'); g ? mostrar(e, g.dataset.r) : (tip.hidden = true); });
    el.addEventListener('mouseleave', () => (tip.hidden = true));
    el.addEventListener('click', (e) => { const g = e.target.closest('.reg'); if (g) sel(g); });
    el.addEventListener('keydown', (e) => {
      const g = e.target.closest('.reg');
      if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sel(g); }
    });
    el.addEventListener('focusin', (e) => {
      const g = e.target.closest('.reg'); if (!g) return;
      const b = g.getBoundingClientRect(); mostrar({ clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }, g.dataset.r);
    });
    el.addEventListener('focusout', () => (tip.hidden = true));

    return {
      /** Actualiza etiquetas y números. `fuera` = nombre de la región fuera del diagrama. */
      actualizar(labels, regions, total, fuera) {
        Object.assign(s, { labels, regions, total, fuera });
        ejes.forEach((k, i) => (el.querySelector(`[data-nm="${k}"]`).textContent = corto(labels[i])));
        orden.forEach((r) => {
          const cant = regions[r] ?? 0;
          animar(el.querySelector(`[data-n="${r}"]`), cant);
          // Texto para lectores de pantalla: nombre de la región y su cantidad.
          el.querySelector(`.reg[data-r="${r}"]`).setAttribute('aria-label', `${nombre(r)}: ${fmt(cant)} personas, ${pct(cant, total)}`);
        });
      },
    };
  }
  return { montar };
})();
