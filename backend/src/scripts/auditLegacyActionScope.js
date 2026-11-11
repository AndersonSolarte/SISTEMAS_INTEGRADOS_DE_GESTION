const { sequelize } = require('../config/database');
const { auditLegacyActionScope } = require('../services/legacyActionScopeAudit');
const args = process.argv.slice(2);
auditLegacyActionScope({ workbookPath: args[0] || null }).then((result) => {
  console.log(JSON.stringify(result, null, 2));
  if (result.misplaced.length || result.differences.length || result.futureImported
    || result.workbook?.mismatchedIdentities || result.workbook?.invalidYears) process.exitCode = 2;
}).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => sequelize.close());
