CREATE TABLE IF NOT EXISTS codigos_acceso (
  codigo_hash TEXT PRIMARY KEY,
  consumo_id TEXT UNIQUE
);
