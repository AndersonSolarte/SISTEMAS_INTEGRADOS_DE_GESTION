const ACADEMIC_PROGRAM_NAMES = [
  'Arquitectura',
  'Diseño Gráfico',
  'Administración de Empresas',
  'Contaduría Pública',
  'Tecnología en Marketing Digital',
  'Fisioterapia',
  'Derecho',
  'Psicología',
  'Licenciatura en Educación Física',
  'Licenciatura en Educación Infantil',
  'Ingeniería Electrónica',
  'Ingeniería Financiera',
  'Ingeniería Industrial',
  'Ingeniería de Sistemas',
  'Especialización en Arquitectura y Urbanismo Bioclimático',
  'Especialización en Gerencia de Proyectos',
  'Especialización en Gerencia de la Seguridad y Salud en el Trabajo',
  'Especialización en Marketing Digital',
  'Maestría en Gerencia de Proyectos',
  'Especialización en Derecho Empresarial',
  'Especialización en Infancia e Interculturalidad',
  'Especialización en Pedagogía del Entrenamiento Deportivo',
  'Especialización en Big Data',
  'Especialización en Seguridad Informática'
];

const getAcademicProgramPermissionKey = (programName = '') => {
  const slug = String(programName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `vicerrectoria_academica.${slug}`;
};

const ACADEMIC_PROGRAM_PERMISSION_KEYS = ACADEMIC_PROGRAM_NAMES.map(getAcademicProgramPermissionKey);

module.exports = {
  ACADEMIC_PROGRAM_NAMES,
  ACADEMIC_PROGRAM_PERMISSION_KEYS,
  getAcademicProgramPermissionKey
};
