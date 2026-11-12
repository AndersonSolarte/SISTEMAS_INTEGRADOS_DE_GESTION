const ACTIVITY_CODE = /^(20\d{2})-(R\d+)-(\d{3,})$/;
const plain = (value) => String(value ?? '').trim();
const description = (value) => plain(value).replace(/^(?:(?:[RLI]-)?20\d{2}-R\d+-\d+\s+)+/i, '').trim();
const indicatorCode = (code, kind) => `${kind === 'logro' ? 'L' : kind === 'impacto' ? 'I' : 'R'}-${code}`;
const kindOf = (value) => {
  const type = plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return type.includes('logro') ? 'logro' : type.includes('impacto') ? 'impacto' : 'resultado';
};

const codedValues = (values, code) => {
  const custom = { ...(values.custom_values || {}) };
  const codes = {};
  const make = (text, kind) => description(text) ? `${indicatorCode(code, kind)} ${description(text)}` : text;
  for (const [kind, field] of [['resultado', 'indicadorResultado'], ['logro', 'indicadorLogro'], ['impacto', 'indicadorImpacto']]) {
    if (description(custom[field])) {
      custom[field] = make(custom[field], kind);
      codes[kind] = indicatorCode(code, kind);
    }
  }
  const type = values.indicator_type || custom.indicator_type;
  const oldKind = plain(values.indicator).match(/^([RLI])-20\d{2}-R\d+-\d+\s/i)?.[1]?.toUpperCase();
  const mainKind = type ? kindOf(type) : oldKind === 'L' ? 'logro' : oldKind === 'I' ? 'impacto' : 'resultado';
  const indicator = values.indicator === undefined ? undefined : make(values.indicator, mainKind);
  if (description(values.indicator)) codes.principal = indicatorCode(code, mainKind);
  for (const key of ['indicator', 'indicador']) {
    if (description(custom[key])) custom[key] = make(custom[key], mainKind);
  }
  custom.indicator_codes = codes;
  return { code, ...(indicator !== undefined ? { indicator } : {}), custom_values: custom };
};

const planPrefix = async (planId, transaction, values = {}) => {
  const { StrategicActionPlan, StrategicTerm, StrategicCatalogItem } = require('../models');
  const plan = await StrategicActionPlan.findByPk(planId, {
    transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {})
  });
  if (!plan) throw new Error('No se encontró el Plan de Acción para generar el código.');
  const term = await StrategicTerm.findByPk(plan.term_id, { transaction });
  const unit = await StrategicCatalogItem.findByPk(plan.catalog_item_id, { transaction });
  const unitCode = plain(unit?.code).match(/^(?:LEG-)?(R\d+)(?:$|[_-])/i)?.[1]
    || plain(plan.code).match(/^(?:LEGACY-)?20\d{2}-(?:LEG-)?(R\d+)(?:$|-)/i)?.[1]
    || plain(plan.metadata?.legacy_dependency_scope).match(/:(R\d+)$/i)?.[1]
    || plain(values.custom_values?.responsible).match(/^(R\d+)(?:$|[\s_-])/i)?.[1]
    || plain(unit?.metadata?.legacy_dependency_code).match(/^(R\d+)$/i)?.[1];
  if (!term?.year || !unitCode) throw Object.assign(new Error(`Configure el código oficial Rxx de la dependencia del plan ${plan.code}.`), { statusCode: 422 });
  return `${term.year}-${unitCode.toUpperCase()}`;
};

const nextCode = (prefix, rows) => {
  let maximum = 0;
  for (const row of rows) {
    const match = plain(row.code).match(ACTIVITY_CODE);
    if (match && `${match[1]}-${match[2]}` === prefix) maximum = Math.max(maximum, Number(match[3]));
  }
  return `${prefix}-${String(maximum + 1).padStart(3, '0')}`;
};

const prepareItem = async (item, options) => {
  const previousCode = item.previous('code');
  const previousValid = ACTIVITY_CODE.test(plain(previousCode));
  // Technical moves of old imported rows must finish reconciliation before
  // receiving a visible number; archived import copies must not consume 001.
  if (!item.isNewRecord && item.changed('action_plan_id') && !previousValid) return;
  let code = item.code;
  if (item.isNewRecord || item.changed('action_plan_id')) {
    if (!item._allocatedOfficialCode || item._allocatedOfficialPlanId !== item.action_plan_id) {
      if (!options.transaction) throw new Error('La asignación de códigos requiere una transacción.');
      const prefix = await planPrefix(item.action_plan_id, options.transaction, item);
      const rows = await require('../models').StrategicActionItem.findAll({
        where: { action_plan_id: item.action_plan_id }, attributes: ['code'], transaction: options.transaction
      });
      code = nextCode(prefix, rows);
      item._allocatedOfficialCode = code;
      item._allocatedOfficialPlanId = item.action_plan_id;
    } else code = item._allocatedOfficialCode;
  } else if (previousValid && !options.officialCodeMigration) code = previousCode;
  if (!ACTIVITY_CODE.test(plain(code))) return;
  const values = codedValues(item, code);
  if ((item.isNewRecord && !item.custom_values?.legacy_plan_accion_id) || /^ACT-/i.test(previousCode || '')) {
    values.custom_values.application_created = true;
  }
  if (previousCode && previousCode !== code) values.custom_values.previous_activity_codes = [...new Set([
    ...(values.custom_values.previous_activity_codes || []), previousCode
  ])];
  const changed = [];
  for (const [key, value] of Object.entries(values)) {
    if (JSON.stringify(item.get(key)) !== JSON.stringify(value)) { item.set(key, value); changed.push(key); }
  }
  if (options.fields) options.fields = [...new Set([...options.fields, ...changed])];
};

const backfillOfficialActivityCodes = async () => {
  const { sequelize } = require('../config/database');
  const { StrategicActionPlan, StrategicActionItem } = require('../models');
  const plans = await StrategicActionPlan.findAll({ where: { deleted_at: null }, order: [['id', 'ASC']] });
  let changed = 0;
  const pending = [];
  for (const plan of plans) {
    await sequelize.transaction(async (transaction) => {
      const items = await StrategicActionItem.findAll({ where: { action_plan_id: plan.id },
        order: [['created_at', 'ASC'], ['id', 'ASC']], transaction });
      const active = items.filter((item) => !item.deleted_at);
      if (!active.length) return;
      let prefix;
      try { prefix = await planPrefix(plan.id, transaction, active[0]); }
      catch (error) { if (error.statusCode === 422) { pending.push(plan.code); return; } throw error; }
      active.sort((a, b) => Number(a.custom_values?.legacy_plan_accion_id || Number.MAX_SAFE_INTEGER)
        - Number(b.custom_values?.legacy_plan_accion_id || Number.MAX_SAFE_INTEGER));
      for (const item of active) {
        const existing = plain(item.code).match(ACTIVITY_CODE);
        const code = existing && `${existing[1]}-${existing[2]}` === prefix ? item.code : nextCode(prefix, items);
        const values = codedValues(item, code);
        if (/^ACT-/i.test(item.code || '')) values.custom_values.application_created = true;
        if (item.code !== code) values.custom_values.previous_activity_codes = [...new Set([
          ...(item.custom_values?.previous_activity_codes || []), item.code
        ])];
        if (Object.entries(values).some(([key, value]) => JSON.stringify(item.get(key)) !== JSON.stringify(value))) {
          await item.update(values, { transaction, officialCodeMigration: true });
          changed++;
        }
      }
    });
  }
  return { changed, pending };
};

module.exports = { ACTIVITY_CODE, description, kindOf, indicatorCode, codedValues, nextCode, planPrefix, prepareItem, backfillOfficialActivityCodes };
