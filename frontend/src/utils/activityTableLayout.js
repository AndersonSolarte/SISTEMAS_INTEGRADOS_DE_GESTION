export const activityColumnWidth = (field) => {
  const text = `${field.key || ''} ${field.label || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/fecha|starts_on|ends_on/.test(text)) return 150;
  if (/indicador|indicator|meta|target/.test(text)) return /tipo|type/.test(text) ? 170 : 380;
  if (/actividad|activity/.test(text)) return 360;
  if (/objetivo|objective|lineamiento|guideline/.test(text)) return 320;
  if (/responsable|responsible/.test(text)) return 280;
  return 260;
};
