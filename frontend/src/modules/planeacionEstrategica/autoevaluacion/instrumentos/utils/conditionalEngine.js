export const evaluateCondition = (rule = {}, answers = {}) => {
  const source = String(rule.source_question_id || rule.source || '');
  const operator = rule.operator || 'equals';
  const expected = rule.value;
  const current = answers[source];
  if (operator === 'not_empty') return current !== undefined && current !== null && String(current).trim() !== '';
  if (operator === 'empty') return current === undefined || current === null || String(current).trim() === '';
  if (operator === 'lte') return Number(current) <= Number(expected);
  if (operator === 'gte') return Number(current) >= Number(expected);
  if (operator === 'contains') return Array.isArray(current) ? current.includes(expected) : String(current || '').includes(String(expected));
  return String(current ?? '') === String(expected ?? '');
};

export const isQuestionVisible = (question, conditions = [], answers = {}) => {
  const related = conditions.filter((condition) => condition.target_type === 'question' && Number(condition.target_id) === Number(question.id));
  if (!related.length) return true;
  return related.some((condition) => {
    const logic = condition.condition_logic || {};
    const rules = Array.isArray(logic.rules) ? logic.rules : [logic];
    const mode = logic.mode === 'OR' ? 'OR' : 'AND';
    const result = mode === 'OR' ? rules.some((rule) => evaluateCondition(rule, answers)) : rules.every((rule) => evaluateCondition(rule, answers));
    return condition.action === 'hide' ? !result : result;
  });
};
