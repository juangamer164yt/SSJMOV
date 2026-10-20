const fs = require('fs');
const path = require('path');
const { createHash, randomBytes } = require('crypto');

const cantidad = Number(process.argv[2]);
if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 10000) {
  console.error('Uso: npm run generar-codigos -- <cantidad entre 1 y 10000>');
  process.exit(1);
}

const formatCode = (code) => code.match(/.{1,4}/g).join('-');
const codigos = Array.from({ length: cantidad }, () => randomBytes(10).toString('hex').toUpperCase());
const values = codigos.map((code) => {
  const hash = createHash('sha256').update(code).digest('hex');
  return `('${hash}', NULL)`;
});
const sql = `INSERT INTO codigos_acceso (codigo_hash, consumo_id) VALUES\n${values.join(',\n')};\n`;
const archivo = path.resolve(process.cwd(), 'codigos-acceso.sql');
if (fs.existsSync(archivo)) {
  console.error(`No se sobrescribió ${archivo}: ya existe. Muévelo o elimínalo antes de generar otros códigos.`);
  process.exit(1);
}
fs.writeFileSync(archivo, sql, { flag: 'wx', mode: 0o600 });

console.log(`Archivo SQL creado: ${archivo}`);
console.log('Códigos de un solo uso (entrégalos por separado; no se pueden recuperar):');
codigos.forEach((code) => console.log(formatCode(code)));
