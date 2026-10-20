ALTER TABLE respuestas ADD COLUMN codigo_acceso TEXT;

UPDATE respuestas
SET codigo_acceso = lower(hex(randomblob(16)))
WHERE codigo_acceso IS NULL;

CREATE UNIQUE INDEX idx_respuestas_codigo_acceso
ON respuestas(codigo_acceso);
