export const ACADEMIC_PROGRAMS = [
  { name: 'Arquitectura', snies: '19979', faculty: 'Arquitectura y Bellas Artes', level: 'Pregrado' },
  { name: 'Diseño Gráfico', snies: '19062', faculty: 'Arquitectura y Bellas Artes', level: 'Pregrado' },
  { name: 'Administración de Empresas', snies: '19787', faculty: 'Ciencias Administrativas y Contables', level: 'Pregrado' },
  { name: 'Contaduría Pública', snies: '19788', faculty: 'Ciencias Administrativas y Contables', level: 'Pregrado' },
  { name: 'Tecnología en Marketing Digital', snies: '117522', faculty: 'Ciencias Administrativas y Contables', level: 'Pregrado' },
  { name: 'Fisioterapia', snies: '', faculty: 'Ciencias de la Salud', level: 'Pregrado' },
  { name: 'Derecho', snies: '52939', faculty: 'Ciencias Sociales y Humanas', level: 'Pregrado' },
  { name: 'Psicología', snies: '53874', faculty: 'Ciencias Sociales y Humanas', level: 'Pregrado' },
  { name: 'Licenciatura en Educación Física', snies: '16489', faculty: 'Educación', level: 'Pregrado' },
  { name: 'Licenciatura en Educación Infantil', snies: '106286', faculty: 'Educación', level: 'Pregrado' },
  { name: 'Ingeniería Electrónica', snies: '90715', faculty: 'Ingeniería', level: 'Pregrado' },
  { name: 'Ingeniería Financiera', snies: '118327', faculty: 'Ingeniería', level: 'Pregrado' },
  { name: 'Ingeniería Industrial', snies: '118273', faculty: 'Ingeniería', level: 'Pregrado' },
  { name: 'Ingeniería de Sistemas', snies: '20376', faculty: 'Ingeniería', level: 'Pregrado' },
  { name: 'Especialización en Arquitectura y Urbanismo Bioclimático', snies: '108376', faculty: 'Arquitectura y Bellas Artes', level: 'Posgrado' },
  { name: 'Especialización en Gerencia de Proyectos', snies: '104875', faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado' },
  { name: 'Especialización en Gerencia de la Seguridad y Salud en el Trabajo', snies: '118355', faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado' },
  { name: 'Especialización en Marketing Digital', snies: '118526', faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado' },
  { name: 'Maestría en Gerencia de Proyectos', snies: '118032', faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado' },
  { name: 'Especialización en Derecho Empresarial', snies: '108870', faculty: 'Ciencias Sociales y Humanas', level: 'Posgrado' },
  { name: 'Especialización en Infancia e Interculturalidad', snies: '108325', faculty: 'Educación', level: 'Posgrado' },
  { name: 'Especialización en Pedagogía del Entrenamiento Deportivo', snies: '108324', faculty: 'Educación', level: 'Posgrado' },
  { name: 'Especialización en Big Data', snies: '117642', faculty: 'Ingeniería', level: 'Posgrado' },
  { name: 'Especialización en Seguridad Informática', snies: '117789', faculty: 'Ingeniería', level: 'Posgrado' }
];

export const ACADEMIC_PROGRAM_LEVELS = ['Pregrado', 'Posgrado'];

export const getAcademicProgramPermissionKey = (programName = '') => {
  const slug = String(programName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `vicerrectoria_academica.${slug}`;
};

export const ACADEMIC_PROGRAM_PERMISSION_OPTIONS = ACADEMIC_PROGRAMS.map((program) => ({
  key: getAcademicProgramPermissionKey(program.name),
  label: program.name,
  level: program.level,
  faculty: program.faculty
}));
