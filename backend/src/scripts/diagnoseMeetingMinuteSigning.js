// Solo SELECT dentro de una transaccion de PostgreSQL de solo lectura.
// No envia correos, no modifica enlaces ni registra firmas.
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const readline = require('node:readline/promises');
const { diagnoseSigningLink } = require('../services/meetingMinuteSigningDiagnosis');

const run = async () => {
  let input = process.argv[2];
  if (!input) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try { input = await prompt.question('Enlace de firma: '); } finally { prompt.close(); }
  }
  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SET TRANSACTION READ ONLY', { transaction });
    const selectOne = async (sql, replacements) => {
      const rows = await sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
      return rows[0] || null;
    };
    return diagnoseSigningLink({
      input,
      findParticipant: (id) => selectOne('SELECT id, minute_id, email, signing_token_hash, signing_token_expires_at FROM digital_meeting_participants WHERE id = :id', { id }),
      findLegacyParticipant: (hash) => selectOne('SELECT minute_id, signing_token_expires_at FROM digital_meeting_participants WHERE signing_token_hash = :hash', { hash }),
      findMinute: (id) => selectOne('SELECT code, status, deleted_at, token_expires_at FROM digital_meeting_minutes WHERE id = :id', { id }),
      findLegacyMinute: (token, hash) => selectOne(`SELECT code, status, deleted_at, token_expires_at
        FROM digital_meeting_minutes
        WHERE public_token_hash = :hash OR content->>'_public_token' = :token
          OR COALESCE(content->'_token_history', '[]'::jsonb) @> CAST(:history AS jsonb)
        ORDER BY (public_token_hash = :hash) DESC NULLS LAST LIMIT 1`, { token, hash, history: JSON.stringify([hash]) })
    });
  });
};

run().then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch(() => { console.error('No se pudo completar el diagnostico. Verifique el enlace y la conexion a la base de datos.'); process.exitCode = 1; })
  .finally(() => sequelize.close());
