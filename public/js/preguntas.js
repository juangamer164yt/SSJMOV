/* =====================================================================
   CATÁLOGO ÚNICO DE LA ENCUESTA
   Lo usan tres piezas, así que cambiar una pregunta aquí basta:
     - script.js     -> dibuja el formulario
     - server.js     -> valida lo recibido y arma las estadísticas
     - demo.js       -> genera datos de prueba
   Convenciones:
     id       = nombre del campo del formulario y de la columna en SQLite
     opciones = [código que se guarda, texto que ve la persona]
     tipo     = 'unica'    -> se elige UNA opción (se muestra en barras)
                'multiple' -> se eligen UNA O MÁS (se muestra en diagrama de Venn)
     venn     = ejes: códigos de los conjuntos (2 o 3) · nombres: etiqueta corta de cada
                conjunto · fuera: código de la opción excluyente (queda fuera del diagrama) ·
                fueraTxt: cómo se llama esa región en las estadísticas
   ===================================================================== */
const BLOQUES = [
  'Perfil demográfico',
  'Hábitos de desplazamiento diario',
  'Intermodalidad y vehículos en el hogar',
  'Percepción y calidad de la movilidad',
];

const AYUDA_VENN = 'Marque todas las que apliquen. La última opción no se combina con las demás.';

const PREGUNTAS = [
  /* ---------- Bloque 1: Perfil demográfico ---------- */
  { n: 1, bloque: 1, id: 'rango_edad', tipo: 'unica', texto: '¿Cuál es su rango de edad?', ayuda: 'Seleccione una opción.',
    opciones: [['menor_18', 'Menor de 18 años'], ['18_25', '18 a 25 años'], ['26_59', '26 a 59 años'], ['mas_60', '60 años o más']] },

  { n: 2, bloque: 1, id: 'ocupacion', tipo: 'multiple', texto: '¿A qué se dedica actualmente?', ayuda: AYUDA_VENN,
    opciones: [['trabajo', 'Trabajo (empleado o independiente)'], ['estudio', 'Estudio'], ['otra', 'Ninguna de las dos (hogar, jubilado, desempleado u otra)']],
    venn: { ejes: ['trabajo', 'estudio'], nombres: ['Trabajo', 'Estudio'], fuera: 'otra', fueraTxt: 'Ninguna de las dos' } }, // Venn de 2 conjuntos

  /* ---------- Bloque 2: Hábitos de desplazamiento diario ---------- */
  { n: 3, bloque: 2, id: 'motivo_viaje', tipo: 'multiple', texto: '¿Para qué realiza sus desplazamientos habituales?', ayuda: AYUDA_VENN,
    opciones: [['obligatorio', 'Trabajo o estudio'], ['hogar_salud', 'Compras, trámites o salud'], ['recreacion', 'Recreación o visitas'], ['otro', 'Otro motivo']],
    venn: { ejes: ['obligatorio', 'hogar_salud', 'recreacion'], nombres: ['Trabajo o estudio', 'Compras y trámites', 'Recreación'], fuera: 'otro', fueraTxt: 'Otro motivo' } },

  { n: 4, bloque: 2, id: 'medio_principal', tipo: 'multiple', texto: '¿Qué medios de transporte usa habitualmente?', ayuda: AYUDA_VENN,
    opciones: [['privado', 'Vehículo privado motorizado (carro o moto)'], ['publico', 'Transporte público (metro, bus, colectivo)'], ['activo', 'A pie o en bicicleta'], ['otro', 'Taxi, apps u otro']],
    venn: { ejes: ['privado', 'publico', 'activo'], nombres: ['Vehículo privado', 'Transp. público', 'A pie / bici'], fuera: 'otro', fueraTxt: 'Taxi, apps u otro' } },

  { n: 5, bloque: 2, id: 'horario_viaje', tipo: 'multiple', texto: '¿En qué horarios se desplaza?', ayuda: AYUDA_VENN,
    opciones: [['manana', 'Mañana (5:00 a.m. – 12:00 p.m.)'], ['tarde', 'Tarde (12:00 – 7:00 p.m.)'], ['noche', 'Noche (después de las 7:00 p.m.)'], ['otro', 'Otro horario o no aplica']],
    venn: { ejes: ['manana', 'tarde', 'noche'], nombres: ['Mañana', 'Tarde', 'Noche'], fuera: 'otro', fueraTxt: 'Otro horario o no aplica' } },

  /* ---------- Bloque 3: Intermodalidad y vehículos en el hogar ---------- */
  // Los conjuntos son los medios: la intersección = medios que combina en un mismo viaje.
  { n: 6, bloque: 3, id: 'transbordo', tipo: 'multiple', texto: '¿Qué medios combina dentro de un mismo viaje?', ayuda: 'Si usa solo uno, marque solo ese. La última opción no se combina con las demás.',
    opciones: [['metro', 'Metro, tren, tranvía o cable'], ['bus', 'Bus o colectivo'], ['propio', 'Vehículo propio (carro, moto, bicicleta o monopatín)'], ['ninguno', 'Ninguno de estos (por ejemplo, solo a pie o taxi)']],
    venn: { ejes: ['metro', 'bus', 'propio'], nombres: ['Metro / tranvía', 'Bus / colectivo', 'Vehículo propio'], fuera: 'ninguno', fueraTxt: 'Ninguno de estos' } },

  { n: 7, bloque: 3, id: 'disposicion_vehiculos', tipo: 'multiple', texto: '¿De qué vehículos dispone su hogar?', ayuda: AYUDA_VENN,
    opciones: [['carro', 'Carro'], ['moto', 'Moto'], ['bicicleta', 'Bicicleta o monopatín'], ['ninguno', 'Ninguno']],
    venn: { ejes: ['carro', 'moto', 'bicicleta'], nombres: ['Carro', 'Moto', 'Bici / Monopatín'], fuera: 'ninguno', fueraTxt: 'Ninguno (hogar sin estos vehículos)' } },

  /* ---------- Bloque 4: Percepción y calidad de la movilidad ---------- */
  { n: 8, bloque: 4, id: 'percepcion_calidad', tipo: 'multiple', texto: '¿Qué factores pesan más al elegir cómo se mueve?', ayuda: AYUDA_VENN,
    opciones: [['rapidez', 'Rapidez (tiempo de viaje)'], ['economia', 'Economía (costo)'], ['seguridad_comodidad', 'Seguridad y comodidad'], ['otro', 'Otro factor']],
    venn: { ejes: ['rapidez', 'economia', 'seguridad_comodidad'], nombres: ['Rapidez', 'Economía', 'Seguridad y comodidad'], fuera: 'otro', fueraTxt: 'Otro factor' } },

  { n: 9, bloque: 4, id: 'calificacion_vias', tipo: 'multiple', texto: '¿Qué aspectos de la movilidad en su ciudad le parecen satisfactorios?', ayuda: AYUDA_VENN,
    opciones: [['vias', 'Estado de las vías'], ['servicio_publico', 'Servicio de transporte público'], ['andenes_ciclorrutas', 'Andenes y ciclorrutas'], ['ninguno', 'Ninguno me parece satisfactorio']],
    venn: { ejes: ['vias', 'servicio_publico', 'andenes_ciclorrutas'], nombres: ['Estado de vías', 'Transp. público', 'Andenes y ciclorrutas'], fuera: 'ninguno', fueraTxt: 'Ninguno me parece satisfactorio' } },

  { n: 10, bloque: 4, id: 'problema_movilidad', tipo: 'multiple', texto: '¿Qué problemas afectan sus desplazamientos?', ayuda: AYUDA_VENN,
    opciones: [['trafico', 'Tráfico y congestión'], ['publico_deficiente', 'Transporte público deficiente (pocas rutas o poca frecuencia)'], ['inseguridad', 'Inseguridad (robos o accidentes)'], ['otro', 'Otro problema o ninguno']],
    venn: { ejes: ['trafico', 'publico_deficiente', 'inseguridad'], nombres: ['Tráfico', 'Transp. deficiente', 'Inseguridad'], fuera: 'otro', fueraTxt: 'Otro problema o ninguno' } },

  { n: 11, bloque: 4, id: 'mejora_movilidad', tipo: 'multiple', texto: '¿Qué cambios mejorarían más su movilidad?', ayuda: AYUDA_VENN,
    opciones: [['transporte_publico', 'Mejor transporte público (más rutas y frecuencia)'], ['vias_trafico', 'Mejores vías y control del tráfico'], ['andenes_ciclorrutas', 'Más andenes y ciclorrutas'], ['otro', 'Otro cambio']],
    venn: { ejes: ['transporte_publico', 'vias_trafico', 'andenes_ciclorrutas'], nombres: ['Transp. público', 'Vías y tráfico', 'Andenes / ciclorrutas'], fuera: 'otro', fueraTxt: 'Otro cambio' } },
];

/* Índice = máscara de bits (A=1, B=2, C=4). Cada persona cae en UNA sola región del Venn:
   por ejemplo, quien marcó A y C tiene máscara 1+4 = 5 -> REGIONES[5] = 'AC'. */
const REGIONES = [null, 'A', 'B', 'AB', 'C', 'AC', 'BC', 'ABC'];

/**
 * Convierte conteos {pregunta: {valor: personas}} en la respuesta de la API de estadísticas.
 * - Preguntas Venn  -> regiones EXCLUSIVAS (nadie se cuenta dos veces) + los que quedan fuera.
 * - Preguntas únicas -> cada opción con su número de personas.
 * Para selección múltiple, `valor` es una lista de códigos separada por comas (ej. 'metro,bus').
 * @param {Object<string, Object<string, number>>} conteos
 * @param {number} total  personas que respondieron la encuesta
 */
function armarEstadisticas(conteos, total) {
  const questions = PREGUNTAS.map((p) => {
    const c = conteos[p.id] || {};
    const base = { questionId: p.n, key: p.id, question: p.texto, totalResponses: total };

    if (p.venn) {
      const n = p.venn.ejes.length; // 2 o 3 conjuntos
      const regions = {};
      REGIONES.slice(1, 1 << n).forEach((k) => { regions[k] = 0; }); // A,B,AB  o  A,B,AB,C,AC,BC,ABC
      let outside = 0;
      for (const [valor, personas] of Object.entries(c)) {
        const marcadas = valor.split(',');
        const mascara = p.venn.ejes.reduce((m, eje, i) => m + (marcadas.includes(eje) ? 1 << i : 0), 0);
        if (mascara) regions[REGIONES[mascara]] += Number(personas); // cayó dentro de algún conjunto
        else outside += Number(personas);                            // solo marcó la opción excluyente
      }
      return { ...base, tipo: 'venn', labels: p.venn.nombres, regions, outside, fuera: p.venn.fueraTxt };
    }

    return { ...base, tipo: 'barras',
      opciones: p.opciones.map(([valor, etiqueta]) => ({ valor, etiqueta, n: Number(c[valor] || 0) })) };
  });
  return { totalResponses: total, questions };
}

// En Node (servidor) se exporta; en el navegador estas constantes quedan como globales.
if (typeof module !== 'undefined') module.exports = { BLOQUES, PREGUNTAS, armarEstadisticas };
