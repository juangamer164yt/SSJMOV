ALTER TABLE respuestas ADD COLUMN correo_hash TEXT;

CREATE UNIQUE INDEX idx_respuestas_correo_hash
ON respuestas(correo_hash)
WHERE correo_hash IS NOT NULL;
