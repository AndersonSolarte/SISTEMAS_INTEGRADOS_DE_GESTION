const DEPENDENCY_EMAILS_RAW = {
  "Area de Acompañamiento Integral": "acompanamiento@unicesmag.edu.co",
  "Area de Deporte y Cultura": "deporte@unicesmag.edu.co",
  "Area de Desarrollo Humano y Salud": "ugsp@unicesmag.edu.co",
  "Consultorío Jurídico": "consultoriojuridico@unicesmag.edu.co",
  "Departamento de Idiomas": "idiomas@unicesmag.edu.co",
  "Deporte Universitario": "deporte@unicesmag.edu.co",
  "Direccion Administrativa Campus San Damian": "gerencia.campus@unicesmag.edu.co",
  "Direccion de Planeacion y Aseguramiento de la Calidad": "planeacion@unicesmag.edu.co",
  "Direccion de Posgrados": "postgrados@unicesmag.edu.co",
  "Gerencia de proyectos": "pmo@unicesmag.edu.co",
  "Oficina de Biblioteca": "biblioteca@unicesmag.edu.co",
  "Oficina de Bienes y Servicios": "comprasysuministros@unicesmag.edu.co",
  "Oficina de Comunicaciones y Mercadeo": "comunicaciones@unicesmag.edu.co",
  "Oficina de Contabilidad": "contabil@unicesmag.edu.co",
  "Oficina de Credito, Cartera y Cobranzas": "creditocartera@unicesmag.edu.co",
  "Oficina de Desarrollo de Sistemas de Informacion": "dsoftware@unicesmag.edu.co",
  "Oficina de Egresados": "egresados@unicesmag.edu.co",
  "Oficina de Gestion del Talento Humano": "gestionhumana@unicesmag.edu.co",
  "Oficina de Infraestructura Tecnologica": "sistemas.internet@unicesmag.edu.co",
  "Oficina de Mantenimiento a la Infraestructura Fisica": "infraestructuraymantenimiento@unicesmag.edu.co",
  "Oficina de Medios Educativos": "medioseducativos@unicesmag.edu.co",
  "Oficina de Practicas Academicas": "jefatura.practicas@unicesmag.edu.co",
  "Oficina de Relaciones Interinstitucionales": "internacionalizacion@unicesmag.edu.co",
  "Oficina de Seguridad y Salud en el Trabajo": "seguridadysalud@unicesmag.edu.co",
  "Oficina de Tesoreria y Pagaduria": "tesoreria1@unicesmag.edu.co",
  "Oficina Juridica": "dpto.juridico@unicesmag.edu.co",
  "Programa Academico - Administracion de Empresas": "admon@unicesmag.edu.co",
  "Programa Academico - Arquitectura": "arquitectura@unicesmag.edu.co",
  "Programa Academico - Contaduria Publica": "contaduria@unicesmag.edu.co",
  "Programa Academico - Derecho": "dir.derecho@unicesmag.edu.co",
  "Programa Academico - Diseño Grafico": "disenografico@unicesmag.edu.co",
  "Programa Academico - Ingenieria de Electronica": "electronica@unicesmag.edu.co",
  "Programa Academico - Ingenieria de Sistemas": "ingenieriadesistemas@unicesmag.edu.co",
  "Programa Academico - Licenciatura en Educacion Infantil": "edupres@unicesmag.edu.co",
  "Programa Academico - Licenciatura en Educacion fisica": "edufisica@unicesmag.edu.co",
  "Programa Academico - Licenciatura en Quimica": "lic.quimica@unicesmag.edu.co",
  "Programa Academico -Psicologia": "psicologia@unicesmag.edu.co",
  "Programa Academico - Fisioterapia": "fisioterapia@unicesmag.edu.co",
  "Departamento de Ciencias Basicas": "ciencias.basicas@unicesmag.edu.co",
  "Departamento de Humanidades": "humanidades@unicesmag.edu.co",
  "Rectoria": "rectoria@unicesmag.edu.co",
  "Secretaria General": "secregen@unicesmag.edu.co",
  "Tecnología En Marketing Digital": "admon@unicesmag.edu.co",
  "Vicerrectoria Academica": "viceacad@unicesmag.edu.co",
  "Vicerrectoria Financiera y de Desarrollo Institucional": "viceadfin@unicesmag.edu.co",
  "Vicerrectoria de Investigacion y Extension": "viceinvestiga@unicesmag.edu.co",
  "Vicerrectoría para la Evangelizacion de las Culturas": "vicebien@unicesmag.edu.co",
  "Área de Pastoral Franciscano Capuchino": "pastoral@unicesmag.edu.co"
};

const normalizeKey = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/vicerectoria/g, 'vicerrectoria')
    .replace(/\s+/g, ' ')
    .trim();
};

const DEPENDENCY_EMAILS = {};
Object.entries(DEPENDENCY_EMAILS_RAW).forEach(([key, val]) => {
  DEPENDENCY_EMAILS[normalizeKey(key)] = val;
});

// Synonyms / Aliases
const SYNONYMS = {
  "medios educativos": "medioseducativos@unicesmag.edu.co",
  "oficina de medios educativos": "medioseducativos@unicesmag.edu.co",
  "infraestructura tecnologica": "sistemas.internet@unicesmag.edu.co",
  "gestion del talento humano": "gestionhumana@unicesmag.edu.co",
  "talento humano": "gestionhumana@unicesmag.edu.co",
  "seguridad y salud en el trabajo": "seguridadysalud@unicesmag.edu.co",
  "tesoreria y pagaduria": "tesoreria1@unicesmag.edu.co",
  "tesoreria": "tesoreria1@unicesmag.edu.co",
  "contabilidad": "contabil@unicesmag.edu.co",
  "biblioteca": "biblioteca@unicesmag.edu.co",
  "planeacion y aseguramiento de la calidad": "planeacion@unicesmag.edu.co",
  "direccion de planeacion": "planeacion@unicesmag.edu.co",
  "planeacion": "planeacion@unicesmag.edu.co",
  "vicerrectoria financiera": "viceadfin@unicesmag.edu.co",
  "vicerrectoria administrativa y financiera": "viceadfin@unicesmag.edu.co",
  "vicerrectoria financiera y de desarrollo institucional": "viceadfin@unicesmag.edu.co",
  "vicerrectoria de desarrollo institucional": "viceadfin@unicesmag.edu.co",
  "vicerrectoria academica": "viceacad@unicesmag.edu.co",
  "vicerrectoria de investigacion": "viceinvestiga@unicesmag.edu.co",
  "vicerrectoria de investigacion y extension": "viceinvestiga@unicesmag.edu.co",
  "vicerrectoria para la evangelizacion de las culturas": "vicebien@unicesmag.edu.co",
  "vicerrectoria de evangelizacion": "vicebien@unicesmag.edu.co",
  "evangelizacion de las culturas": "vicebien@unicesmag.edu.co"
};

Object.entries(SYNONYMS).forEach(([key, val]) => {
  const norm = normalizeKey(key);
  if (!DEPENDENCY_EMAILS[norm]) {
    DEPENDENCY_EMAILS[norm] = val;
  }
});

const getDependencyEmail = (dependencyName) => {
  if (!dependencyName) return null;
  const normalized = normalizeKey(dependencyName);
  if (DEPENDENCY_EMAILS[normalized]) return DEPENDENCY_EMAILS[normalized];

  // Try partial matches
  if (normalized.includes('financiera') || normalized.includes('desarrollo institucional')) {
    return 'viceadfin@unicesmag.edu.co';
  }
  if (normalized.includes('evangelizacion')) {
    return 'vicebien@unicesmag.edu.co';
  }
  if (normalized.includes('investigacion')) {
    return 'viceinvestiga@unicesmag.edu.co';
  }
  if (normalized.includes('academica') && normalized.includes('vicerrectoria')) {
    return 'viceacad@unicesmag.edu.co';
  }
  if (normalized.includes('medios educativos')) {
    return 'medioseducativos@unicesmag.edu.co';
  }

  return null;
};

module.exports = {
  getDependencyEmail,
  DEPENDENCY_EMAILS_RAW
};
