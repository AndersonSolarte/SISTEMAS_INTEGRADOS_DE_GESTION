const buildPedSchedule = ({ startsOn, durationYears }) => {
  const start = String(startsOn || '');
  const startYear = Number(start.slice(0, 4));
  const duration = Number(durationYears);
  const parsedStart = new Date(`${start}T00:00:00Z`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(startYear)
    || Number.isNaN(parsedStart.getTime()) || parsedStart.toISOString().slice(0, 10) !== start) {
    throw Object.assign(new Error('Seleccione una fecha inicial válida.'), { statusCode: 422 });
  }
  if (!Number.isInteger(duration) || duration < 1 || duration > 30) {
    throw Object.assign(new Error('La duración del PED debe estar entre 1 y 30 años.'), { statusCode: 422 });
  }

  // Regla solicitada: inicio 2030 + duración 7 = PED 2030–2037.
  const endYear = startYear + duration;
  const years = Array.from({ length: duration + 1 }, (_, index) => startYear + index);
  const terms = years.map((year, index) => ({
    year,
    name: `Año ${year}`,
    starts_on: index === 0 ? start : `${year}-01-01`,
    ends_on: `${year}-12-31`,
    status: index === 0 ? 'active' : 'planned',
    periods: [
      { code: 'S1', name: 'Informe de gestión · Semestre 1', starts_on: `${year}-01-01`, ends_on: `${year}-06-30`, position: 1, weight: 0.5, status: index === 0 ? 'active' : 'planned' },
      { code: 'S2', name: 'Informe de gestión · Semestre 2', starts_on: `${year}-07-01`, ends_on: `${year}-12-31`, position: 2, weight: 0.5, status: index === 0 ? 'active' : 'planned' }
    ]
  }));

  return {
    startYear,
    endYear,
    code: `PED-${startYear}-${endYear}`,
    name: `Plan Estratégico de Desarrollo ${startYear}–${endYear}`,
    endsOn: `${endYear}-12-31`,
    terms
  };
};

const reconcilePlanTerms = async (plan, transaction = null) => {
  const { StrategicTerm, StrategicMonitoringPeriod, StrategicActionPlan } = require('../models');
  const startYear = Number(String(plan?.starts_on || '').slice(0, 4));
  const endYear = Number(String(plan?.ends_on || '').slice(0, 4));
  if (!startYear || !endYear || endYear < startYear) return [];

  const existingTerms = await StrategicTerm.findAll({
    where: { strategic_plan_id: plan.id },
    transaction
  });

  const existingByYear = new Map();
  for (const term of existingTerms) {
    existingByYear.set(Number(term.year), term);
  }

  // 1. Garantiza que todos los años dentro de [startYear, endYear] existan y estén activos/programados.
  for (let year = startYear; year <= endYear; year += 1) {
    const existing = existingByYear.get(year);
    if (existing) {
      if (['inactive', 'archived'].includes(existing.status)) {
        await existing.update({ status: 'planned' }, { transaction });
      }
    } else {
      const term = await StrategicTerm.create({
        strategic_plan_id: plan.id,
        year,
        name: `Vigencia ${year}`,
        starts_on: year === startYear ? plan.starts_on : `${year}-01-01`,
        ends_on: year === endYear ? plan.ends_on : `${year}-12-31`,
        status: 'planned'
      }, { transaction });
      await StrategicMonitoringPeriod.bulkCreate([
        { term_id: term.id, code: 'S1', name: 'Informe de gestión · Semestre 1', starts_on: `${year}-01-01`, ends_on: `${year}-06-30`, position: 1, weight: 0.5, status: 'planned' },
        { term_id: term.id, code: 'S2', name: 'Informe de gestión · Semestre 2', starts_on: `${year}-07-01`, ends_on: `${year}-12-31`, position: 2, weight: 0.5, status: 'planned' }
      ], { transaction });
    }
  }

  // 2. Reconcilia los años fuera de [startYear, endYear]: archiva si tienen datos históricos, inactiva si no tienen planes.
  for (const term of existingTerms) {
    const year = Number(term.year);
    if (year < startYear || year > endYear) {
      const plansCount = await StrategicActionPlan.count({
        where: { term_id: term.id, deleted_at: null },
        transaction
      });
      if (plansCount > 0) {
        if (term.status !== 'archived') {
          await term.update({ status: 'archived' }, { transaction });
        }
      } else {
        if (term.status !== 'inactive') {
          await term.update({ status: 'inactive' }, { transaction });
        }
      }
    }
  }

  return StrategicTerm.findAll({
    where: { strategic_plan_id: plan.id },
    transaction
  });
};

module.exports = { buildPedSchedule, reconcilePlanTerms };

