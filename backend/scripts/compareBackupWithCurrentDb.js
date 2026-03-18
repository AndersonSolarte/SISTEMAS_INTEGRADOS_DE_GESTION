const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const backupPathArg = process.argv[2];
if (!backupPathArg) {
  console.error('Uso: node scripts/compareBackupWithCurrentDb.js <ruta-backup.sql>');
  process.exit(1);
}

const backupPath = path.resolve(backupPathArg);
if (!fs.existsSync(backupPath)) {
  console.error(`No existe el backup: ${backupPath}`);
  process.exit(1);
}

async function parseBackupRowCounts(sqlPath) {
  const stream = fs.createReadStream(sqlPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const counts = new Map();
  let currentTable = null;

  for await (const line of rl) {
    if (!currentTable) {
      const match = line.match(/^COPY\s+public\.([a-zA-Z0-9_]+)\s+\(.*\)\s+FROM\s+stdin;$/);
      if (match) {
        currentTable = match[1];
        if (!counts.has(currentTable)) counts.set(currentTable, 0);
      }
      continue;
    }

    if (line === '\\.') {
      currentTable = null;
      continue;
    }

    counts.set(currentTable, counts.get(currentTable) + 1);
  }

  return counts;
}

async function queryCurrentDbCounts(client, tables) {
  const result = new Map();
  for (const table of tables) {
    try {
      const query = `SELECT COUNT(*)::bigint AS total FROM public.${table}`;
      const res = await client.query(query);
      result.set(table, Number(res.rows[0].total || 0));
    } catch (error) {
      result.set(table, null);
    }
  }
  return result;
}

async function main() {
  const backupCounts = await parseBackupRowCounts(backupPath);
  const tables = [...backupCounts.keys()].sort();

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  await client.connect();
  const dbCounts = await queryCurrentDbCounts(client, tables);
  await client.end();

  const rows = tables.map((table) => {
    const backupTotal = backupCounts.get(table);
    const currentTotal = dbCounts.get(table);
    const delta = currentTotal === null ? 'N/A' : currentTotal - backupTotal;
    const status =
      currentTotal === null
        ? 'TABLA_NO_EXISTE_EN_DB_ACTUAL'
        : currentTotal < backupTotal
          ? 'FALTAN_DATOS'
          : currentTotal === backupTotal
            ? 'IGUAL'
            : 'DB_ACTUAL_TIENE_MAS';

    return { table, backupTotal, currentTotal, delta, status };
  });

  console.log('');
  console.log('Comparacion backup vs DB actual');
  console.log(`Backup: ${backupPath}`);
  console.log(`DB actual: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.table(rows);

  const missing = rows.filter((r) => r.status === 'FALTAN_DATOS' || r.status === 'TABLA_NO_EXISTE_EN_DB_ACTUAL');
  if (missing.length === 0) {
    console.log('Resultado: no se detectan faltantes respecto al backup.');
  } else {
    console.log(`Resultado: ${missing.length} tabla(s) con faltantes o inexistentes.`);
  }
}

main().catch((err) => {
  console.error('Error en comparacion:', err.message);
  process.exit(1);
});
