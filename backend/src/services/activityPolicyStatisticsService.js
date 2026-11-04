// Shared reporting dimensions. Progress remains in each module's official
// monitoring records; it is deliberately not duplicated in these dimensions.
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const list = (value) => [...new Set((Array.isArray(value) ? value : value ? [value] : []).map(String).map((s) => s.trim()).filter(Boolean))];

function policyDimensions(policyNames, lineNames, catalog, previous = {}) {
  const selected = list(policyNames);
  const lines = list(lineNames);
  return { version: 1, policies: selected.map((name) => {
    const prior = (previous.policies || []).find((entry) => normalize(entry.selectedName) === normalize(name));
    const policy = catalog.find((entry) => normalize(entry.name) === normalize(name))
      || catalog.find((entry) => prior?.policyId && String(entry.id) === String(prior.policyId));
    const ownLines = policy?.actionLines || [];
    return {
      policyId: policy?.id || prior?.policyId || null,
      selectedName: name, catalogName: policy?.name || null,
      key: normalize(name), matched: Boolean(policy),
      lines: lines.filter((line) => selected.length === 1 || ownLines.some((own) => normalize(own) === normalize(line)))
        .map((line) => ({ name: line, key: normalize(line), matched: ownLines.some((own) => normalize(own) === normalize(line)) }))
    };
  }), unassignedLines: lines.filter((line) => !selected.some((name) => catalog.find((policy) => normalize(policy.name) === normalize(name))?.actionLines.some((own) => normalize(own) === normalize(line)))) };
}

async function enrichImprovementPolicyDimensions(content, previous = {}) {
  const catalog = await require('./institutionalPolicyCatalogService').listPolicies();
  const prior = new Map((previous.objetivos || []).flatMap((objective) => objective.actividades || []).map((activity) => [activity.uid, activity.policyStatistics]));
  return { ...content, objetivos: (content.objetivos || []).map((objective) => ({ ...objective,
    actividades: (objective.actividades || []).map((activity) => ({ ...activity,
      policyStatistics: policyDimensions(activity.politicasInstitucionales, activity.lineasAccionPolitica, catalog, prior.get(activity.uid))
    }))
  })) };
}

module.exports = { normalize, policyDimensions, enrichImprovementPolicyDimensions };
