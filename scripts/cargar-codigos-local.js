const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const archivoDb = process.env.MOBILITY_DB_PATH || path.join(__dirname, '..', 'movilidad.sqlite');
const archivoSql = path.join(process.cwd(), 'codigos-acceso.sql');
const archivoTemporal = `${archivoDb}.tmp`;

async function cargar() {
  if (!fs.existsSync(archivoSql)) {
    throw new Error('No se encontró codigos-acceso.sql en la carpeta actual.');
  }
  const SQL = await initSqlJs();
  const db = fs.existsSync(archivoDb)
    ? new SQL.Database(new Uint8Array(fs.readFileSync(archivoDb)))
    : new SQL.Database();
  let transaccion = false;
  try {
    db.run(fs.readFileSync(path.join(__dirname, '..', 'migrations', '0002_create_codigos_acceso.sql'), 'utf8'));
    db.run('BEGIN IMMEDIATE');
    transaccion = true;
    db.run(fs.readFileSync(archivoSql, 'utf8'));
    db.run('COMMIT');
    transaccion = false;
    fs.writeFileSync(archivoTemporal, Buffer.from(db.export()));
    fs.renameSync(archivoTemporal, archivoDb);
    console.log('Códigos cargados en movilidad.sqlite.');
  } catch (error) {
    if (transaccion) db.run('ROLLBACK');
    throw error;
  } finally {
    db.close();
    if (fs.existsSync(archivoTemporal)) fs.unlinkSync(archivoTemporal);
  }
}

cargar().catch((error) => {
  console.error(`No se pudieron cargar los códigos: ${error.message}`);
  process.exitCode = 1;
});
