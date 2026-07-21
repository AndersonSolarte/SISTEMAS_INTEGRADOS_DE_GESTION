const DEPENDENCY_EMAILS_RAW = {
  "Administración de Empresas": "admon@unicesmag.edu.co",
  "Area de Acompañamiento Integral": "acompanamiento@unicesmag.edu.co",
  "Area de Deporte y Cultura": "deporte@unicesmag.edu.co",
  "Area de Desarrollo Humano y Salud": "ugsp@unicesmag.edu.co",
  "Arquitectura": "arquitectura@unicesmag.edu.co",
  "Consultorío Jurídico": "consultoriojuridico@unicesmag.edu.co",
  "Contaduría Pública": "contaduria@unicesmag.edu.co",
  "Departamento de Ciencias Básicas": "ciencias.basicas@unicesmag.edu.co",
  "Departamento de Humanidades": "humanidades@unicesmag.edu.co",
  "Departamento de Idiomas": "idiomas@unicesmag.edu.co",
  "Deporte Universitario": "deporte@unicesmag.edu.co",
  "Derecho": "dir.derecho@unicesmag.edu.co",
  "Direccion Administrativa Campus San Damian": "gerencia.campus@unicesmag.edu.co",
  "Direccion de Planeacion y Aseguramiento de la Calidad": "gp.planeacion@unicesmag.edu.co",
  "Direccion de Posgrados": "postgrados@unicesmag.edu.co",
  "Diseño Gráfico": "disenografico@unicesmag.edu.co",
  "Gerencia de proyectos": "pmo@unicesmag.edu.co",
  "Ingeniería de Sistemas": "ingenieriadesistemas@unicesmag.edu.co",
  "Ingeniería Electrónica": "electronica@unicesmag.edu.co",
  "Licenciatura en Educación Infantil": "edupres@unicesmag.edu.co",
  "Licenciatura en Educación Física": "edufisica@unicesmag.edu.co",
  "Licenciatura En Química": "lic.quimica@unicesmag.edu.co",
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
  "Programa Academico - Contaduria Publica": "contaduria@unicesmag.edu.co",
  "Programa Academico - Derecho": "dir.derecho@unicesmag.edu.co",
  "Programa Academico - Diseño Grafico": "disenografico@unicesmag.edu.co",
  "Programa Academico - Ingenieria de Electronica": "electronica@unicesmag.edu.co",
  "Programa Academico - Ingenieria de Sistemas": "ingenieriadesistemas@unicesmag.edu.co",
  "Programa Academico - Licenciatura en Educacion Infantil": "edupres@unicesmag.edu.co",
  "Programa Academico - Licenciatura en Educacion fisica": "edufisica@unicesmag.edu.co",
  "Programa Academico -Psicologia": "psicologia@unicesmag.edu.co",
  "Programa Academico- Departamento de Ciencias Basicas": "ciencias.basicas@unicesmag.edu.co",
  "Programa Academico- Departamento de Humanidades": "humanidades@unicesmag.edu.co",
  "Psicología": "psicologia@unicesmag.edu.co",
  "Rectoria": "rectoria@unicesmag.edu.co",
  "Secretaria General": "secregen@unicesmag.edu.co",
  "Tecnología En Marketing Digital": "admon@unicesmag.edu.co",
  "Vicerrectoria Academica": "viceacad@unicesmag.edu.co",
  "Vicerrectoria Financiera y de Desarrollo Institucional": "viceadfin@unicesmag.edu.co",
  "Vicerrectoria de Investigacion y Extension": "viceinvestiga@unicesmag.edu.co",
  "Vicerrectoría para la Evangelizacion de las Culturas": "vicebien@unicesmag.edu.co"
};

const normalizeKey = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const DEPENDENCY_EMAILS = {};
Object.entries(DEPENDENCY_EMAILS_RAW).forEach(([key, val]) => {
  DEPENDENCY_EMAILS[normalizeKey(key)] = val;
});

const getDependencyEmail = (dependencyName) => {
  if (!dependencyName) return null;
  const normalized = normalizeKey(dependencyName);
  return DEPENDENCY_EMAILS[normalized] || null;
};

module.exports = {
  getDependencyEmail,
  DEPENDENCY_EMAILS_RAW
};
