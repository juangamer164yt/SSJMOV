CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  rango_edad TEXT NOT NULL,
  ocupacion TEXT NOT NULL,
  motivo_viaje TEXT NOT NULL,
  medio_principal TEXT NOT NULL,
  horario_viaje TEXT NOT NULL,
  transbordo TEXT NOT NULL,
  disposicion_vehiculos TEXT NOT NULL,
  percepcion_calidad TEXT NOT NULL,
  calificacion_vias TEXT NOT NULL,
  problema_movilidad TEXT NOT NULL,
  mejora_movilidad TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
