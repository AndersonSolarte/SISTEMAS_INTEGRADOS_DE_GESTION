const readCatalogSources = async ({ base, policies, strategic }) => {
  const results = await Promise.allSettled([base, policies, strategic]);
  const names = ['plantilla y tarifas', 'políticas institucionales', 'objetivos y lineamientos del PED'];
  const warnings = results.flatMap((result, index) => result.status === 'rejected' ? [`No se pudo cargar ${names[index]}.`] : []);
  if (results.every((result) => result.status === 'rejected')) throw new Error('No fue posible consultar los catálogos institucionales.');
  const baseData = results[0].status === 'fulfilled' ? { ...results[0].value } : {};
  delete baseData.strategicObjectives;
  delete baseData.objectiveProjects;
  delete baseData.strategicRelations;
  return {
    ...baseData,
    ...(results[1].status === 'fulfilled' ? { institutionalPolicies: results[1].value } : {}),
    // Do not use objectives embedded in the Excel template as a fallback PED.
    ...(results[2].status === 'fulfilled' ? results[2].value : {}),
    catalogWarnings: warnings
  };
};
module.exports = { readCatalogSources };
