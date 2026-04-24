const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'backend', 'node_modules', 'xlsx'));

const HEADERS = [
  'AÑO',
  'PED',
  'OBJETIVOS ESTRATÉGICOS',
  'LINEAMIENTOS ESTRATÉGICOS',
  'MACROACTIVIDADES ESTRATEGICAS',
  'ACTIVIDADES',
  'TIPO DE INDICADOR',
  'FECHA INICIO',
  'FECHA FIN',
  'INDICADOR',
  'META',
  'RESPONSABLE DE EJECUCIÓN',
  'CORRESPONSABLE',
  'PORCENTAJE AVANCE IP',
  'OBSERVACIONES IP',
  'PORCENTAJE AVANCE IIP',
  'OBSERVACIONES IIP',
  'TOTAL EJECUCION'
];

const ESTRUCTURA_ROWS = [
  ['AÑO', 'Año de vigencia del plan (numérico, ej. 2026).'],
  ['PED', 'Plan Estratégico de Desarrollo al que pertenece la actividad.'],
  ['OBJETIVOS ESTRATÉGICOS', 'Objetivo estratégico institucional asociado.'],
  ['LINEAMIENTOS ESTRATÉGICOS', 'Lineamiento estratégico derivado del objetivo.'],
  ['MACROACTIVIDADES ESTRATEGICAS', 'Macroactividad estratégica del lineamiento.'],
  ['ACTIVIDADES', 'Actividad operativa concreta a ejecutar.'],
  ['TIPO DE INDICADOR', 'Tipo de indicador (Gestión / Resultado / Impacto / etc.).'],
  ['FECHA INICIO', 'Fecha planeada de inicio (dd/mm/aaaa).'],
  ['FECHA FIN', 'Fecha planeada de cierre (dd/mm/aaaa).'],
  ['INDICADOR', 'Nombre o fórmula del indicador.'],
  ['META', 'Meta cuantitativa o cualitativa planteada.'],
  ['RESPONSABLE DE EJECUCIÓN', 'Dependencia o cargo responsable principal.'],
  ['CORRESPONSABLE', 'Dependencia o cargo corresponsable (opcional).'],
  ['PORCENTAJE AVANCE IP', 'Avance reportado en el primer periodo (0-100).'],
  ['OBSERVACIONES IP', 'Observaciones cualitativas del primer periodo.'],
  ['PORCENTAJE AVANCE IIP', 'Avance reportado en el segundo periodo (0-100).'],
  ['OBSERVACIONES IIP', 'Observaciones cualitativas del segundo periodo.'],
  ['TOTAL EJECUCION', 'Porcentaje total de ejecución anual (0-100).']
];

const EJEMPLO_ROWS = [
  {
    'AÑO': 2026,
    'PED': 'PED 2022-2030',
    'OBJETIVOS ESTRATÉGICOS': 'Fortalecer la excelencia académica',
    'LINEAMIENTOS ESTRATÉGICOS': 'Calidad y pertinencia curricular',
    'MACROACTIVIDADES ESTRATEGICAS': 'Renovación de registros calificados',
    'ACTIVIDADES': 'Actualización de planes de estudio de pregrado',
    'TIPO DE INDICADOR': 'Gestión',
    'FECHA INICIO': '01/02/2026',
    'FECHA FIN': '30/11/2026',
    'INDICADOR': 'Número de planes actualizados / planes programados',
    'META': '100%',
    'RESPONSABLE DE EJECUCIÓN': 'Vicerrectoría Académica',
    'CORRESPONSABLE': 'Facultades',
    'PORCENTAJE AVANCE IP': 45,
    'OBSERVACIONES IP': 'Se actualizaron 4 de 9 planes previstos.',
    'PORCENTAJE AVANCE IIP': 85,
    'OBSERVACIONES IIP': 'Pendiente cierre de dos programas.',
    'TOTAL EJECUCION': 85
  }
];

const workbook = XLSX.utils.book_new();

const estructura = XLSX.utils.aoa_to_sheet([['Nombre de campo', 'Contenido'], ...ESTRUCTURA_ROWS]);
estructura['!cols'] = [{ wch: 32 }, { wch: 70 }];
XLSX.utils.book_append_sheet(workbook, estructura, 'ESTRUCTURA');

const datos = XLSX.utils.json_to_sheet(EJEMPLO_ROWS, { header: HEADERS });
datos['!cols'] = HEADERS.map((h) => ({ wch: Math.max(16, Math.min(40, h.length + 4)) }));
XLSX.utils.book_append_sheet(workbook, datos, 'PLAN DE ACCION');

const outputPath = path.join(__dirname, '..', 'plantilla_PLAN_DE_ACCION.xlsx');
XLSX.writeFile(workbook, outputPath);
console.log('Plantilla generada en:', outputPath);
