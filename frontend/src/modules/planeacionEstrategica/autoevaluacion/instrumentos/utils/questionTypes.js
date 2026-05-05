export const QUESTION_TYPES = [
  { value: 'texto_corto', label: 'Texto corto' },
  { value: 'texto_largo', label: 'Texto largo' },
  { value: 'numero', label: 'Numero' },
  { value: 'correo', label: 'Correo electronico' },
  { value: 'telefono', label: 'Telefono' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'hora', label: 'Hora' },
  { value: 'seleccion_unica', label: 'Seleccion unica' },
  { value: 'seleccion_multiple', label: 'Seleccion multiple' },
  { value: 'lista_desplegable', label: 'Lista desplegable' },
  { value: 'likert', label: 'Escala Likert' },
  { value: 'escala_lineal', label: 'Escala lineal' },
  { value: 'escala_numerica', label: 'Escala numerica' },
  { value: 'satisfaccion', label: 'Satisfaccion' },
  { value: 'caritas', label: 'Caritas/emociones' },
  { value: 'estrellas', label: 'Estrellas' },
  { value: 'nps', label: 'NPS' },
  { value: 'matriz', label: 'Matriz' },
  { value: 'matriz_likert', label: 'Matriz Likert' },
  { value: 'si_no', label: 'Si/No' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'carga_archivo', label: 'Carga de archivo' },
  { value: 'url_archivo', label: 'URL de archivo externo' },
  { value: 'separador', label: 'Separador/seccion' },
  { value: 'texto_informativo', label: 'Texto informativo' }
];

export const OPTION_QUESTION_TYPES = ['seleccion_unica', 'seleccion_multiple', 'lista_desplegable', 'likert', 'satisfaccion', 'caritas', 'estrellas', 'nps', 'si_no', 'ranking'];

export const defaultOptionsByType = {
  seleccion_unica: ['Opcion 1'],
  seleccion_multiple: ['Opcion 1'],
  lista_desplegable: ['Opcion 1'],
  likert: ['Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo'],
  satisfaccion: ['Muy insatisfecho', 'Insatisfecho', 'Neutral', 'Satisfecho', 'Muy satisfecho'],
  caritas: ['Muy triste', 'Triste', 'Neutral', 'Feliz', 'Muy feliz'],
  estrellas: ['1', '2', '3', '4', '5'],
  nps: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  si_no: ['Si', 'No'],
  escala_numerica: ['1', '2', '3', '4', '5'],
  ranking: ['Opcion 1', 'Opcion 2']
};

export const normalizeOptions = (options = [], type = 'texto_corto') => {
  const source = Array.isArray(options) && options.length ? options : (defaultOptionsByType[type] || []);
  return source
    .flatMap((option) => {
      const value = typeof option === 'string' ? option : option?.label || option?.value || '';
      if (String(value).includes(',')) {
        return String(value).split(',').map((item) => item.trim()).filter(Boolean);
      }
      return [String(value).trim()].filter(Boolean);
    })
    .filter(Boolean);
};

export const needsOptions = (type) => OPTION_QUESTION_TYPES.includes(type);

export const withDefaultOptions = (question, { forceDefaults = false } = {}) => {
  const type = question.question_type || 'texto_corto';
  if (!needsOptions(type)) return { ...question, options: [] };
  if (forceDefaults || type === 'si_no') {
    return { ...question, options: [...(defaultOptionsByType[type] || [])] };
  }
  return { ...question, options: normalizeOptions(question.options, type) };
};

export const createEmptyQuestion = (index = 0) => ({
  question_text: '',
  question_description: '',
  question_type: 'texto_corto',
  is_required: false,
  order_index: index,
  options: [],
  config: {},
  validation_rules: {}
});

export const themePresets = [
  { name: 'Institucional azul', primary: '#1d4ed8', accent: '#0f766e' },
  { name: 'Calidad verde', primary: '#047857', accent: '#1d4ed8' },
  { name: 'Planeacion dorado', primary: '#b45309', accent: '#0f766e' },
  { name: 'Sobrio grafito', primary: '#334155', accent: '#2563eb' },
  { name: 'Academico vino', primary: '#9f1239', accent: '#1d4ed8' },
  { name: 'Investigacion teal', primary: '#0f766e', accent: '#7c3aed' },
  { name: 'Bienestar coral', primary: '#be123c', accent: '#f59e0b' },
  { name: 'Innovacion indigo', primary: '#4338ca', accent: '#0891b2' },
  { name: 'Gestion oliva', primary: '#4d7c0f', accent: '#0369a1' },
  { name: 'Neutro CESMAG', primary: '#0f172a', accent: '#1d4ed8' }
];
