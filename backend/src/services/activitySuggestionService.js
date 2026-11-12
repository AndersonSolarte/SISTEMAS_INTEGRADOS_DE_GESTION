const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { StrategicActionPlan, StrategicActionItem, StrategicCatalogItem, StrategicTerm, PlanAccion } = require('../models');
const { dependencyCode, scopeFromPlanCode } = require('./legacyActionScope');
const { description } = require('./actionItemCodingService');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const wordsOf = value => normalize(String(value || '').slice(0, 240)).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 12);
const accents = 'áàäâãåéèëêíìïîóòöôõúùüûñç';
const ascii = 'aaaaaaeeeeiiiiooooouuuunc';
// SQL and JS use the same folding, without depending on the unaccent extension.
const sqlText = expression => sequelize.fn('regexp_replace', sequelize.fn('lower', sequelize.fn('translate', expression, accents + accents.toUpperCase(), ascii + ascii)), '[\u0300-\u036f]', '', 'g');
const textMatches = (expression, words) => words.map(word => sequelize.where(sqlText(expression), { [Op.like]: '%' + word + '%' }));
const templateCustom = custom => Object.fromEntries(Object.entries(custom || {}).filter(([key]) => {
  const name = normalize(key);
  return !/(legacy|respons|observ|progress|avance|evidenc|firma|signature|source|_id$|codigo|code|fecha|starts_on|ends_on)/.test(name)
    && /(objetiv|objective|lineamiento|guideline|macro|politic|policy|linea|indicador|indicator|meta|target|entregable|deliverable)/.test(name);
}).map(([key, value]) => [key, /indicador|indicator/i.test(key) && typeof value === 'string' ? description(value) : value]));

async function searchActivityTemplates({ planId, query = '' }) {
  const current = planId ? await StrategicActionPlan.findByPk(planId, { include: [{ model: StrategicCatalogItem, as: 'organizationalUnit' }] }) : null;
  if (planId && (!current || current.deleted_at)) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  const words = wordsOf(query);
  if (!words.length && !current) return [];
  const nativeText = sequelize.literal('COALESCE(NULLIF(BTRIM("StrategicActionItem"."activity"), \'\'), "StrategicActionItem"."custom_values"->>\'activity\', "StrategicActionItem"."custom_values"->>\'actividad\', \'\')');
  const nativeWhere = { deleted_at: null, [Op.and]: textMatches(nativeText, words) };
  // Empty input suggests this dependency; typing searches all dependencies and years.
  if (!words.length) nativeWhere['$actionPlan.catalog_item_id$'] = current.catalog_item_id;
  const owner = dependencyCode(current?.organizationalUnit?.code) || dependencyCode(current?.organizationalUnit?.metadata?.legacy_dependency_code) || scopeFromPlanCode(current?.code)?.split(':')[1];
  const historicalWhere = { deleted_at: null, [Op.and]: textMatches(sequelize.fn('coalesce', sequelize.col('actividad'), ''), words) };
  if (!words.length) historicalWhere.responsable = owner ? { [Op.iRegexp]: '^R0*' + owner.slice(1) + '($|[_ -])' } : null;
  const order = [];
  if (current) {
    order.push([sequelize.literal('CASE WHEN "StrategicActionItem"."action_plan_id" = ' + sequelize.escape(current.id) + ' THEN 0 WHEN "actionPlan"."catalog_item_id" = ' + sequelize.escape(current.catalog_item_id) + ' THEN 1 ELSE 2 END'), 'ASC']);
  }
  order.push([{ model: StrategicActionPlan, as: 'actionPlan' }, { model: StrategicTerm, as: 'term' }, 'year', 'DESC'], ['id', 'ASC']);
  const [native, historical] = await Promise.all([
    StrategicActionItem.findAll({ where: nativeWhere,
      attributes: ['id', 'code', 'activity', 'indicator_type', 'indicator', 'target', 'custom_values', 'action_plan_id'],
      include: [{ model: StrategicActionPlan, as: 'actionPlan', required: true, where: { deleted_at: null }, attributes: ['id', 'catalog_item_id', 'code', 'title'], include: [
        { model: StrategicCatalogItem, as: 'organizationalUnit', attributes: ['id', 'name', 'code'] },
        { model: StrategicTerm, as: 'term', attributes: ['id', 'year'] }
      ] }], subQuery: false, order, limit: 80 }),
    PlanAccion.findAll({ where: historicalWhere, attributes: ['id', 'anio', 'actividad', 'tipo_indicador', 'indicador', 'meta', 'macroactividad', 'responsable', 'objetivo_estrategico', 'lineamiento_estrategico'], order: [['anio', 'DESC'], ['id', 'ASC']], limit: 80 })
  ]);
  const options = native.map(row => ({ id: row.id, code: row.code,
    activity: String(row.activity || row.custom_values?.activity || row.custom_values?.actividad || '').trim(),
    indicator_type: row.indicator_type || 'Resultado', indicator: description(row.indicator || ''), target: row.target || '',
    macroactivity: row.custom_values?.macroactivity || row.custom_values?.macroactividad || '', custom_values: templateCustom(row.custom_values),
    is_same_plan: Boolean(current && row.action_plan_id === current.id), is_same_dependency: Boolean(current && row.actionPlan?.catalog_item_id === current.catalog_item_id),
    dependency_name: row.actionPlan?.organizationalUnit?.name || row.actionPlan?.title || '', action_plan_code: row.actionPlan?.code || '', term_year: row.actionPlan?.term?.year || null, source: 'application'
  })).concat(historical.map(row => ({ id: 'historical-' + row.id, code: String(row.indicador || '').match(/^(?:[RLI]-)?(20\d{2}-R\d+-\d+)/i)?.[1] || '',
    activity: String(row.actividad || '').trim(), indicator_type: row.tipo_indicador || 'Resultado', indicator: description(row.indicador || ''), target: row.meta || '',
    macroactivity: row.macroactividad || '', custom_values: { strategic_objective: row.objetivo_estrategico || '', strategic_guideline: row.lineamiento_estrategico || '' },
    is_same_plan: false, is_same_dependency: Boolean(owner && dependencyCode(row.responsable) === owner), dependency_name: row.responsable || '', term_year: row.anio, source: 'historical'
  })));
  options.sort((a, b) => Number(b.is_same_plan) - Number(a.is_same_plan) || Number(b.is_same_dependency) - Number(a.is_same_dependency) || Number(b.term_year || 0) - Number(a.term_year || 0) || Number(b.source === 'application') - Number(a.source === 'application') || a.activity.localeCompare(b.activity));
  const seen = new Set();
  return options.filter(option => {
    if (!option.activity || !words.every(word => normalize(option.activity).includes(word))) return false;
    const key = JSON.stringify([normalize(option.activity), normalize(option.indicator_type), normalize(option.indicator), normalize(option.target)]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 35);
}
module.exports = { searchActivityTemplates, wordsOf, templateCustom };
