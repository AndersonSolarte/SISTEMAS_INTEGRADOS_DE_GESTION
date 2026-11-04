const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sequelize } = require('../config/database');
const InstitutionalPolicy = require('../models/InstitutionalPolicy');
const { parsePolicyWorkbook, importPolicies, listPolicies } = require('../services/institutionalPolicyCatalogService');

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('Indique la ruta del Excel. Agregue --apply para importar.');
  const policies = parsePolicyWorkbook(fs.readFileSync(file));
  console.log(JSON.stringify({ policies: policies.length, actionLines: policies.reduce((sum, p) => sum + p.actionLines.length, 0) }));
  if (process.argv.includes('--apply')) {
    await InstitutionalPolicy.sync();
    console.log(JSON.stringify(await importPolicies(policies, { source: path.basename(file) })));
    const catalog = await listPolicies();
    console.log(JSON.stringify({ savedPolicies: catalog.length, savedLines: catalog.reduce((sum, p) => sum + p.actionLines.length, 0) }));
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => sequelize.close());
