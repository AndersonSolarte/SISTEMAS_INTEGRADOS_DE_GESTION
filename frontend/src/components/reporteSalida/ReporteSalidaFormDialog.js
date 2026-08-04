import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Tooltip,
  useMediaQuery,
  useTheme,
  ListSubheader,
  IconButton,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleIcon from '@mui/icons-material/People';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseIcon from '@mui/icons-material/Close';
import reporteSalidaService from '../../services/reporteSalidaService';
import desplazamientoViaticosService from '../../services/desplazamientoViaticosService';
import { DESPLAZAMIENTO_VIATICOS_ENABLED } from '../../config/reporteSalida';
import CategoriaTabs from './CategoriaTabs';
import CamposDuracionSalida, { TimeAutocomplete } from './CamposDuracionSalida';
import DuracionSelector from './DuracionSelector';
import SolicitudViaticosFields, { ViaticosQuestion } from './SolicitudViaticosFields';

const INITIAL_FORM = {
  personal: { nombre: '', documento: '', correo: '' },
  laboral: { dependencia: '', vicerrectoria: '', cargo: '' },
  salida: { 
    tipo: 'cita_eps', 
    alcance: '', 
    pais: '', 
    departamento: '', 
    municipio: '', 
    especialidadMedica: '', 
    terapiasList: [], 
    fecha: '', 
    fechaRegreso: '', 
    horaInicio: '', 
    horaFin: '', 
    motivo: '', 
    campusSalida: '', 
    campusDestino: '', 
    tiempoReponerHoras: '', 
    entidadDestino: '',
    duracionTipo: 'menos_media_jornada',
    duracionDias: 0,
    codigoDependencia: '',
    destinatarioTratamiento: 'Señor',
    destinatarioNombre: '',
    destinatarioCargo: '',
    destinatarioEmpresa: '',
    destinatarioDireccionEmail: '',
    destinatarioTelefono: '',
    destinatarioUbicacion: 'San Juan de Pasto',
    destinatarioPais: '',
    oficioAsunto: '',
    oficioCuerpo: '',
    oficioDespedida: 'Cordialmente,',
    oficioAnexos: '',
    oficioProyecto: ''
  },
  viaticos: {
    requiereViaticos: null,
    lugarVisitar: '',
    fechaEvento: '',
    numeroDiasSolicitados: '',
    objetoComision: '',
    observacionesEspeciales: '',
    centroCosto: '',
    alojamiento: '',
    transporte: '',
    tipoCuenta: '',
    entidadBancariaOpcion: '',
    entidadBancaria: '',
    numeroCuenta: '',
    autorizacionAceptada: false
  },
  reposicion: { fecha: '', fechaFin: '', horaInicio: '', horaFin: '', observacion: '' }
};

const generateOficioTemplate = (solicitanteNombre, tipoLabel, duracionDias, fechaInicio, fechaRegreso, motivo) => {
  const dStr = duracionDias === 1 ? 'un (1) día' : `${duracionDias} días`;
  const fIni = fechaInicio ? fechaInicio : '[Fecha Inicio]';
  const fReg = fechaRegreso ? fechaRegreso : '[Fecha Regreso]';
  const mot = motivo ? motivo.trim() : '[Describa detalladamente el motivo de la salida]';
  return `Por medio del presente oficio, de manera atenta me dirijo a usted con el fin de solicitar formalmente la debida autorización para ausentarme de mis labores institucionales por un término de ${dStr}, a partir del ${fIni} hasta el ${fReg}. Esta solicitud obedece al siguiente motivo/actividad: ${mot}.`;
};

const CARGO_SUBTYPES = [
  { value: 'ponencia', label: 'Ponencia' },
  { value: 'visita_ies', label: 'Visita a otras IES' },
  { value: 'capacitacion', label: 'Capacitación' },
  { value: 'proyecto_investigacion', label: 'Proyecto de investigación' },
  { value: 'asistente_congreso', label: 'Asistente a congreso' },
  { value: 'practica_academica', label: 'Práctica académica' },
  { value: 'torneo_deportivo', label: 'Participante en torneo deportivo' },
  { value: 'salida_campus', label: 'Salida entre campus' },
  { value: 'otra', label: 'Otra, ¿Cuál?:' }
];

const SALUD_SUBTYPES = [
  { value: 'cita_eps', label: 'Cita médica por EPS' },
  { value: 'cita_particular', label: 'Cita médica particular' },
  { value: 'cita_medica_laboral', label: 'Cita médica laboral' },
  { value: 'urgencia_medica', label: 'Urgencias' },
  { value: 'terapias', label: 'Terapias' }
];

const PERSONALES_SUBTYPES = [
  { group: 'Trámites y Compensatorios', value: 'diligencia_personal', label: 'Diligencia personal' },
  { group: 'Trámites y Compensatorios', value: 'compensatorio', label: 'Compensatorio' },
  { group: 'Ejercicio del derecho al sufragio', value: 'sufragante', label: 'Sufragante' },
  { group: 'Cargos oficiales transitorios de forzosa aceptación', value: 'jurado_votacion', label: 'Jurado de votación' },
  { group: 'Cargos oficiales transitorios de forzosa aceptación', value: 'cargos_oficiales_transitorios', label: 'Comparecencias por designación oficial' },
  { group: 'Permisos y Licencias', value: 'calamidad_domestica', label: 'Grave calamidad doméstica' },
  { group: 'Permisos y Licencias', value: 'entierro_companero', label: 'Entierro de compañeras/os de trabajo' },
  { group: 'Permisos y Licencias', value: 'luto_familiares_cercanos', label: 'Licencia por luto de familiares cercanos' },
  { group: 'Permisos y Licencias', value: 'fallecimiento_otros_familiares', label: 'Fallecimiento de otros familiares diferentes a los contemplados en la licencia por luto' },
  { group: 'Permisos y Licencias', value: 'matrimonio_union_marital', label: 'Permiso por matrimonio o unión marital de hecho' },
  { group: 'Permisos y Novedades', value: 'comisiones_sindicales', label: 'Comisiones sindicales' },
  { group: 'Permisos y Licencias', value: 'obligaciones_escolares', label: 'Asistencia a obligaciones escolares' },
  { group: 'Permisos y Licencias', value: 'citaciones_judiciales', label: 'Citaciones judiciales, administrativas o legales' },
  { group: 'Permisos y Novedades', value: 'cuidado_hijo_ley_2174', label: 'Cuidado de hijo(a) - Términos de la Ley 2174 de 2021' },
  { group: 'Permisos y Novedades', value: 'otra', label: 'Otra, ¿cuál?:' }
];

const ESPECIALIDADES_MEDICAS = [
  'Medicina general',
  'Medicina especializada',
  'Odontológica',
  'Optometría',
  'Laboratorios',
  'Psicológica'
];

const ALCANCE_OPTIONS = [
  'Regional',
  'Nacional',
  'Internacional'
];

const VICERRECTORIA_OPTIONS = [
  'Rectoria',
  'Vicerrectoria Academica',
  'Vicerrectoria de Investigacion y Extension',
  'Vicerrectoria Financiera y de Desarrollo Institucional',
  'Vicerrectoria para la Evangelizacion de las Culturas'
];

const PAISES_OPTIONS = [
  'Afganistán', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda', 'Arabia Saudita', 'Argelia', 'Argentina',
  'Armenia', 'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Bangladés', 'Barbados', 'Baréin', 'Bélgica',
  'Belice', 'Benín', 'Bielorrusia', 'Birmania', 'Bolivia', 'Bosnia y Herzegovina', 'Botsuana', 'Brasil',
  'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Bután', 'Cabo Verde', 'Camboya', 'Camerún', 'Canadá',
  'Catar', 'Chad', 'Chile', 'China', 'Chipre', 'Ciudad del Vaticano', 'Comoras', 'Corea del Norte',
  'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia', 'Cuba', 'Dinamarca', 'Dominica', 'Ecuador',
  'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'España',
  'Estados Unidos', 'Estonia', 'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia',
  'Georgia', 'Ghana', 'Granada', 'Grecia', 'Guatemala', 'Guyana', 'Guinea', 'Guinea Ecuatorial', 'Guinea-Bisáu',
  'Haití', 'Honduras', 'Hungría', 'India', 'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall',
  'Islas Salomón', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania', 'Kazajistán', 'Kenia', 'Kirguistán',
  'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Líbano', 'Liberia', 'Libia', 'Liechtenstein', 'Lituania',
  'Luxemburgo', 'Macedonia del Norte', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Malí', 'Malta',
  'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia', 'Mónaco', 'Mongolia', 'Montenegro',
  'Mozambique', 'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Níger', 'Nigeria', 'Noruega', 'Nueva Zelanda', 'Omán',
  'Países Bajos', 'Pakistán', 'Palaos', 'Palestina', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay', 'Perú', 'Polonia',
  'Portugal', 'Reino Unido', 'República Centroafricana', 'República Checa', 'República del Congo',
  'República Democrática del Congo', 'República Dominicana', 'Ruanda', 'Rumanía', 'Rusia', 'Samoa',
  'San Cristóbal y Nieves', 'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia', 'Sri Lanka', 'Suazilandia',
  'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam', 'Tailandia', 'Taiwán', 'Tanzania',
  'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía',
  'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Venezuela', 'Vietnam', 'Yemen', 'Yibuti',
  'Zambia', 'Zimbabue'
];

const TIME_OPTIONS = (() => {
  const options = [];
  // Horario laboral principal primero (06:00 am a 10:00 pm)
  for (let h = 6; h <= 22; h++) {
    const hStr = h.toString().padStart(2, '0');
    options.push(`${hStr}:00`);
    options.push(`${hStr}:30`);
  }
  options.push('22:59');
  options.push('23:00');
  options.push('23:30');
  options.push('23:59');
  // Madrugada al final (00:00 a 05:30)
  for (let h = 0; h <= 5; h++) {
    const hStr = h.toString().padStart(2, '0');
    options.push(`${hStr}:00`);
    options.push(`${hStr}:30`);
  }
  return options;
})();

const convert24To12 = (time24) => {
  if (!time24) return '';
  const str = String(time24).trim();
  if (!str) return '';
  if (/am|pm/i.test(str)) return str;

  const [hStr, mStr] = str.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h) || mStr === undefined) return str;
  const mClean = mStr.replace(/[^0-9]/g, '');
  if (!mClean) return str;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mClean.padStart(2, '0')} ${ampm}`;
};

const REQUIRES_ADJUNTO = [
  'cita_eps', 'cita_particular', 'terapias',
  'voto_jurado', 'voto_sufragante',
  'jurado_votacion', 'sufragante', 'cargos_oficiales_transitorios',
  'luto_familiares_cercanos', 'fallecimiento_otros_familiares', 'matrimonio_union_marital',
  'comisiones_sindicales', 'obligaciones_escolares',
  'citaciones_judiciales', 'cuidado_hijo_ley_2174'
];

const DECLARACION_SIN_ADJUNTO_SALUD = 'Declaro que al momento de radicar esta solicitud no cuento con archivos adjuntos o soportes para cargar en el sistema. Entiendo que la Oficina de Gestion del Talento Humano y/o Seguridad y Salud en el Trabajo podran requerir en cualquier momento los soportes correspondientes; por tanto, me comprometo a conservarlos despues de la atencion o tramite y a suministrarlos oportunamente cuando sean solicitados.';
const MAX_ADJUNTO_SIZE = 10 * 1024 * 1024;

const DEPARTAMENTOS_MUNICIPIOS = {
  'Amazonas': ['Leticia', 'El Encanto', 'La Chorrera', 'La Pedrera', 'La Victoria', 'Miriití-Paraná', 'Puerto Alegría', 'Puerto Arica', 'Puerto Nariño', 'Puerto Santander', 'Tarapacá'],
  'Antioquia': ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Rionegro', 'Apartadó', 'Turbo', 'Caucasia', 'Chigorodó', 'Sabaneta', 'Caldas', 'Copacabana', 'La Estrella', 'Girardota', 'Marinilla', 'Guarne', 'El Carmen de Viboral', 'La Ceja', 'Santa Fe de Antioquia', 'Yarumal'],
  'Arauca': ['Arauca', 'Arauquita', 'Cravo Norte', 'Fortul', 'Puerto Rondón', 'Saravena', 'Tame'],
  'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa', 'Puerto Colombia', 'Galapa', 'Santo Tomás', 'Sabanagrande', 'Luruaco', 'Repelón', 'Usiacurí', 'Tubará'],
  'Bolívar': ['Cartagena de Indias', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar', 'María La Baja', 'Mompox', 'San Jacinto', 'Turbaná', 'Villanueva'],
  'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Villa de Leyva', 'Moniquirá', 'Puerto Boyacá', 'Guateque', 'Garagoa', 'Samacá'],
  'Caldas': ['Manizales', 'La Dorada', 'Riosucio', 'Chinchiná', 'Villamaría', 'Anserma', 'Neira', 'Aguadas', 'Pensilvania', 'Supía', 'Salamina'],
  'Caquetá': ['Florencia', 'Belén de los Andaquíes', 'Cartagena del Chairá', 'Currillo', 'El Doncello', 'El Paujil', 'Morelia', 'Puerto Rico', 'San José del Fraguas', 'San Vicente del Caguán', 'Solano', 'Solita', 'Valparaíso'],
  'Casanare': ['Yopal', 'Aguazul', 'Tauramena', 'Villanueva', 'Paz de Ariporo', 'Monterrey', 'Manoa', 'Hato Corozal', 'Orocué'],
  'Cauca': ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía', 'Bolívar', 'Miranda', 'Corinto', 'Caloto', 'Cajibío', 'Silvia', 'Piendamó'],
  'Cesar': ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Bosconia', 'La Paz', 'Curumaní', 'El Copey', 'San Alberto', 'Chiriguaná'],
  'Chocó': ['Quibdó', 'Istmina', 'Condoto', 'Acandí', 'Bahía Solano', 'Nuquí', 'Riosucio', 'Tadó', 'El Carmen de Atrato', 'Bajo Baudó'],
  'Córdoba': ['Montería', 'Cereté', 'Sahagún', 'Lorica', 'Montelíbano', 'Planeta Rica', 'Ciénaga de Oro', 'Tierralta', 'Chinú', 'San Andrés de Sotavento'],
  'Cundinamarca': ['Bogotá', 'Soacha', 'Facatativá', 'Chía', 'Zipaquirá', 'Fusagasugá', 'Girardot', 'Mosquera', 'Madrid', 'Funza', 'Cajicá', 'Sopó', 'Tocancipá', 'Villeta', 'La Mesa', 'Ubaté'],
  'Guainía': ['Inírida', 'Barrancominas', 'Mapiripana', 'San Felipe', 'Puerto Colombia', 'Pana Pana'],
  'Guaviare': ['San José del Guaviare', 'Calamar', 'El Retorno', 'Miraflores'],
  'Huila': ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre', 'San Agustín', 'Gigante', 'Acevedo', 'Rivera'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'San Juan del Cesar', 'Fonseca', 'Barrancas', 'Manaure', 'Villanueva', 'Dibulla'],
  'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato', 'Aracataca', 'Pivijay', 'San Sebastián de Buenavista'],
  'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'Puerto Gaitán', 'San Martín', 'Cumaral', 'Restrepo'],
  'Nariño': [
    'Pasto', 'Ipiales', 'Tumaco', 'Túquerres', 'Samaniego', 'El Charco', 'Buesaco', 'La Unión', 'Barbacoas', 'Cumbal',
    'Guachucal', 'La Cruz', 'Puerres', 'Contadero', 'Córdoba', 'Cuaspud Carlosama', 'Aldana', 'Funes', 'Iles',
    'Imúes', 'Gualmatán', 'Ospina', 'Sapuyes', 'Yacuanquer', 'Consacá', 'Sandoná', 'Linares', 'Ancuyá', 'La Florida',
    'Chachagüí', 'Tangua', 'Ricaurte', 'Mallama', 'Providencia', 'Guaitarilla', 'El Tambo', 'El Peñol', 'Los Andes Sotomayor',
    'Cumbitara', 'Policarpa', 'El Rosario', 'Leiva', 'Taminango', 'San Lorenzo', 'Arboleda', 'San Bernardo', 'Berruecos',
    'Albán', 'Belén', 'Colón Génova', 'San Pedro de Cartago', 'San Pablo', 'Francisco Pizarro', 'Mosquera', 'Olaya Herrera',
    'La Tola', 'El Tablón de Gómez', 'Magüí Payán', 'Roberto Payán', 'Santa Bárbara', 'Santacruz Guachavés'
  ],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario', 'Los Patios', 'Tibú', 'Chínacota', 'El Zulia'],
  'Putumayo': ['Mocoa', 'Orito', 'Puerto Asís', 'Puerto Leguízamo', 'Sibundoy', 'Valle del Guamuez', 'Villagarzón', 'San Francisco'],
  'Quindío': ['Armenia', 'Calarcá', 'Tebaidá', 'Montenegro', 'Quimbaya', 'Circasia', 'Filandia', 'Salento'],
  'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia', 'Belén de Umbría', 'Quinchía', 'Santuario'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia', 'Santa Catalina'],
  'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro', 'Barbosa', 'Málaga', 'Sabana de Torres'],
  'Sucre': ['Sincelejo', 'Corozal', 'San Marcos', 'Tolú', 'Sampués', 'San Onofre', 'Morroa'],
  'Tolima': ['Ibagué', 'Espinal', 'Melgar', 'Mariquita', 'Honda', 'Líbano', 'Chaparral', 'Guamo', 'Flandes'],
  'Valle del Cauca': ['Cali', 'Buenaventura', 'Palmira', 'Tuluá', 'Cartago', 'Buga', 'Jamundí', 'Yumbo', 'Florida', 'Pradera', 'Zarzal', 'Sevilla', 'Caicedonia'],
  'Vaupés': ['Mitú', 'Carurú', 'Taraira', 'Papacora', 'Yavaraté'],
  'Vichada': ['Puerto Carreño', 'La Primavera', 'Santa Rosalía', 'Cumaribo']
};

const TODAS_MUNICIPIOS_COMPLETOS = Object.entries(DEPARTAMENTOS_MUNICIPIOS).reduce((acc, [depto, munis]) => {
  munis.forEach(muni => {
    acc.push({ municipio: muni, departamento: depto, label: `${muni} (${depto})` });
  });
  return acc;
}, []);

const WORK_BLOCKS = [
  { start: '07:00', end: '12:00' },
  { start: '14:00', end: '18:00' }
];

const timeToMinutes = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const parseDateOnly = (date) => {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isBusinessDay = (date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5 && !isColombiaHoliday(date);
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const nextMonday = (date) => {
  const next = new Date(date);
  const diff = (8 - next.getDay()) % 7;
  next.setDate(next.getDate() + diff);
  return next;
};

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

const getColombiaHolidaySet = (year) => {
  const dates = new Set();
  const addFixed = (month, day) => dates.add(toIsoDate(new Date(year, month - 1, day)));
  const addMoved = (month, day) => dates.add(toIsoDate(nextMonday(new Date(year, month - 1, day))));
  addFixed(1, 1);
  addFixed(5, 1);
  addFixed(7, 20);
  addFixed(8, 7);
  addFixed(12, 8);
  addFixed(12, 25);
  addMoved(1, 6);
  addMoved(3, 19);
  addMoved(6, 29);
  addMoved(8, 15);
  addMoved(10, 12);
  addMoved(11, 1);
  addMoved(11, 11);
  const easter = getEasterDate(year);
  [-3, -2, 43, 64, 71].forEach((offset) => dates.add(toIsoDate(addDays(easter, offset))));
  return dates;
};

const holidayCache = new Map();

const isColombiaHoliday = (date) => {
  const year = date.getFullYear();
  if (!holidayCache.has(year)) holidayCache.set(year, getColombiaHolidaySet(year));
  return holidayCache.get(year).has(toIsoDate(date));
};

const countBusinessMinutes = (startDate, endDate, startTime, endTime) => {
  return countElapsedMinutes(startDate, endDate, startTime, endTime);
};

const countElapsedMinutes = (startDate, endDate, startTime, endTime) => {
  const fromDate = parseDateOnly(startDate);
  const toDate = parseDateOnly(endDate || startDate);
  const fromMinutes = timeToMinutes(startTime);
  const toMinutesValue = timeToMinutes(endTime);
  if (!fromDate || !toDate || fromMinutes == null || toMinutesValue == null || toDate < fromDate) return null;
  const from = new Date(fromDate);
  from.setMinutes(fromMinutes);
  const to = new Date(toDate);
  to.setMinutes(toMinutesValue);
  if (to <= from) return null;
  return Math.round((to.getTime() - from.getTime()) / 60000);
};

const getBusinessDateIssue = (date, label) => {
  const parsed = parseDateOnly(date);
  if (!parsed) return '';
  const day = parsed.getDay();
  if (day === 0) return `${label} cae domingo y no cuenta como dia laboral.`;
  if (day === 6) return `${label} cae sabado y no cuenta como dia laboral.`;
  if (isColombiaHoliday(parsed)) return `${label} es festivo en Colombia y no cuenta como dia laboral.`;
  return '';
};

const getRangeIssue = ({ startDate, endDate, startTime, endTime, minutes, label }) => {
  if (startDate) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (startDate < todayStr) {
      return `La fecha inicial de ${label} no puede ser anterior a la fecha actual.`;
    }
    if (startDate === todayStr && startTime) {
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      const [h, m] = String(startTime || '').split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const startMins = h * 60 + m;
        if (startMins < currentMinutes) {
          return `La hora de inicio de ${label} no puede ser anterior a la hora actual.`;
        }
      }
    }
  }

  if (startDate && endDate && startTime && endTime && !minutes) {
    if (startDate === endDate) {
      return `La hora de regreso (${convert24To12(endTime)}) debe ser posterior a la hora de salida (${convert24To12(startTime)}). Seleccione una hora mayor.`;
    }
    return `La fecha u hora de fin de ${label} debe ser posterior a la de inicio.`;
  }
  return '';
};

const formatMinutes = (minutes) => {
  const total = Number(minutes || 0);
  if (!Number.isFinite(total) || total <= 0) return '0h 00m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const normalizeOption = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const uniqueSorted = (values) => {
  const seen = new Set();
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeOption(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'es'));
};

const hasExactOption = (value, options) => {
  const key = normalizeOption(value);
  return Boolean(key) && options.some((option) => normalizeOption(option) === key);
};

const sectionSx = {
  p: { xs: 1.4, md: 1.8 },
  border: '1px solid #dbe6f5',
  borderRadius: 2.5,
  bgcolor: '#ffffff'
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: '#fff',
    minHeight: 44
  },
  '& .MuiInputLabel-root': {
    fontWeight: 800,
    color: '#64748b'
  }
};

const motivoInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    bgcolor: '#f8fafc',
    minHeight: 44,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
    '& fieldset': {
      borderColor: '#3b82f6',
      borderWidth: '2px'
    },
    '&:hover fieldset': {
      borderColor: '#2563eb'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#1d4ed8',
      borderWidth: '2.5px'
    }
  },
  '& .MuiInputLabel-root': {
    fontWeight: 800,
    color: '#1e3a8a'
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#1d4ed8'
  }
};

const duracionDiasFieldSx = {
  ...inputSx,
  width: { xs: '100%', md: 245 },
  flexShrink: 0,
  '& .MuiOutlinedInput-root': {
    ...inputSx['& .MuiOutlinedInput-root'],
    bgcolor: '#eff6ff',
    animation: 'duracionDiasPulse 1.8s ease-in-out infinite',
    '& fieldset': {
      borderColor: '#60a5fa',
      borderWidth: '2px'
    },
    '&:hover fieldset': {
      borderColor: '#2563eb'
    },
    '&.Mui-focused': {
      animation: 'none',
      boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.16)'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#1d4ed8',
      borderWidth: '2px'
    }
  },
  '@keyframes duracionDiasPulse': {
    '0%': { boxShadow: '0 0 0 0 rgba(96, 165, 250, 0.28)' },
    '70%': { boxShadow: '0 0 0 8px rgba(96, 165, 250, 0)' },
    '100%': { boxShadow: '0 0 0 0 rgba(96, 165, 250, 0)' }
  }
};

const autocompleteListSx = {
  maxHeight: 340,
  '& li': {
    whiteSpace: 'normal',
    lineHeight: 1.35,
    py: 1,
    px: 1.5,
    fontSize: 14
  }
};

const autocompletePopperSx = {
  '& .MuiAutocomplete-paper': {
    borderRadius: 2,
    border: '1px solid #bfdbfe',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.18)'
  }
};

const responsiveFieldGrid = (columns) => ({
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: columns
  },
  alignItems: 'start',
  '& > *': {
    minWidth: 0
  }
});

const SectionTitle = ({ title, subtitle }) => (
  <Box sx={{ mb: 1.4 }}>
    <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 15 }}>{title}</Typography>
    {subtitle && <Typography sx={{ color: '#64748b', fontSize: 12.5, mt: 0.2 }}>{subtitle}</Typography>}
  </Box>
);

const isPastTimeError = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dateStr === todayStr) {
    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const [h, m] = String(timeStr).split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return (h * 60 + m) < currentMinutes;
    }
  }
  return false;
};

const filterFutureTimeOptionsForDate = (options, dateStr) => {
  if (!dateStr) return options;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dateStr !== todayStr) return options;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return options.filter((option) => {
    const optionMinutes = timeToMinutes(option);
    return optionMinutes != null && optionMinutes > currentMinutes;
  });
};

function ReporteSalidaFormDialog({ open, documento, user, onClose, onSubmitted }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const todayDate = new Date();
  const todayString = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  
  const handleTimeChange = (val) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);
    if (cleaned.length > 2) {
      return cleaned.slice(0, 2) + ':' + cleaned.slice(2);
    }
    return cleaned;
  };

  const formatTimeOnBlur = (val) => {
    if (!val) return '';
    const parts = val.split(':');
    if (parts.length === 2) {
      let h = parts[0].padStart(2, '0');
      let m = parts[1].padEnd(2, '0').slice(0, 2);
      const hn = parseInt(h, 10);
      const mn = parseInt(m, 10);
      if (hn >= 0 && hn <= 23 && mn >= 0 && mn <= 59) {
        return `${h}:${m}`;
      }
    }
    return val;
  };

  const [showSaludWarning, setShowSaludWarning] = useState(false);
  const [showPersonalesWarning, setShowPersonalesWarning] = useState(false);
  const [showCalamidadWarning, setShowCalamidadWarning] = useState(false);
  const [showPropiasCargoWarning, setShowPropiasCargoWarning] = useState(false);
  const [activeCategory, setActiveCategory] = useState('salud');
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSalidaMultiple, setIsSalidaMultiple] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [jefe, setJefe] = useState(null);
  const [jefes, setJefes] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [laboralRows, setLaboralRows] = useState([]);
  const [catalogYear, setCatalogYear] = useState('');
  const [jefeSearch, setJefeSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingJefes, setLoadingJefes] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [adjuntoFile, setAdjuntoFile] = useState(null);
  const [adjuntoError, setAdjuntoError] = useState('');
  const [adjuntoPreviewUrl, setAdjuntoPreviewUrl] = useState('');
  const [noCuentaAdjuntoSalud, setNoCuentaAdjuntoSalud] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successResponse, setSuccessResponse] = useState(null);

  const setAdjuntoFromFile = (file) => {
    if (!file) {
      setAdjuntoFile(null);
      setAdjuntoError('');
      return false;
    }
    if (file.size > MAX_ADJUNTO_SIZE) {
      setAdjuntoFile(null);
      setAdjuntoError('El archivo supera el tamano maximo permitido de 10 MB');
      return false;
    }
    setAdjuntoFile(file);
    setAdjuntoError('');
    return true;
  };

  const getClipboardImageFile = (clipboardData) => {
    const items = Array.from(clipboardData?.items || []);
    const imageItem = items.find((item) => item.kind === 'file' && String(item.type || '').startsWith('image/'));
    if (!imageItem) return null;
    const blob = imageItem.getAsFile();
    if (!blob) return null;
    const extension = String(blob.type || 'image/png').split('/')[1] || 'png';
    return new File([blob], `captura-adjunta-${Date.now()}.${extension}`, { type: blob.type || 'image/png' });
  };

  useEffect(() => {
    if (!adjuntoFile || !String(adjuntoFile.type || '').startsWith('image/')) {
      setAdjuntoPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(adjuntoFile);
    setAdjuntoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [adjuntoFile]);

  const handleAddParticipant = (colaborador) => {
    if (!colaborador) return;
    if (participantes.some((p) => String(p.documento).trim() === String(colaborador.documento).trim())) {
      return;
    }
    setParticipantes((prev) => [
      ...prev,
      {
        nombre: colaborador.nombre,
        documento: colaborador.documento,
        correo: colaborador.email || '',
        dependencia: colaborador.dependencia,
        cargo: colaborador.cargo
      }
    ]);
  };

  const handleUpdateParticipantEmail = (index, value) => {
    setParticipantes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], correo: value };
      return next;
    });
  };

  const handleRemoveParticipant = (index) => {
    setParticipantes((prev) => prev.filter((_, i) => i !== index));
  };

  const { category, subtype, otraDescripcion } = useMemo(() => {
    const tipo = form.salida.tipo || '';
    if (tipo.startsWith('otra:')) {
      return { category: activeCategory, subtype: 'otra', otraDescripcion: tipo.substring(5) };
    }
    return { category: activeCategory, subtype: tipo, otraDescripcion: '' };
  }, [form.salida.tipo, activeCategory]);

  const shouldAskViaticos = useMemo(() => {
    if (!DESPLAZAMIENTO_VIATICOS_ENABLED) return false;
    if (isSalidaMultiple || category !== 'propias_cargo' || subtype === 'salida_campus') return false;
    const alcance = normalizeOption(form.salida.alcance);
    if (alcance === 'nacional' || alcance === 'internacional') return true;
    return alcance === 'regional' && Boolean(form.salida.municipio) && normalizeOption(form.salida.municipio) !== 'pasto';
  }, [category, form.salida.alcance, form.salida.municipio, isSalidaMultiple, subtype]);

  const requiresViaticosFlow = shouldAskViaticos && form.viaticos?.requiereViaticos === true;

  const lastGeneratedTemplateRef = useRef('');

  useEffect(() => {
    if (form.salida.duracionTipo === 'menos_media_jornada') return;
    
    // Get subtype label
    const allOpts = [...CARGO_SUBTYPES, ...SALUD_SUBTYPES, ...PERSONALES_SUBTYPES];
    const found = allOpts.find(o => o.value === subtype);
    const tipoLabel = found ? found.label : (subtype === 'otra' ? otraDescripcion : subtype);
    
    const solicitanteNombre = form.personal.nombre || user?.nombre || '';
    const temp = generateOficioTemplate(
      solicitanteNombre,
      tipoLabel,
      form.salida.duracionDias || 1,
      form.salida.fecha,
      form.salida.fechaRegreso,
      form.salida.motivo
    );
    
    // If cuerpo is empty or equals the last generated template, update it!
    const currentCuerpo = form.salida.oficioCuerpo || '';
    if (!currentCuerpo.trim() || currentCuerpo === lastGeneratedTemplateRef.current) {
      update('salida', 'oficioCuerpo', temp);
      lastGeneratedTemplateRef.current = temp;
    }
  }, [
    form.salida.duracionTipo,
    form.salida.duracionDias,
    form.salida.fecha,
    form.salida.fechaRegreso,
    form.salida.motivo,
    subtype,
    otraDescripcion,
    form.personal.nombre,
    user?.nombre
  ]);

  useEffect(() => {
    if (form.salida.duracionTipo !== 'menos_media_jornada' && form.salida.tiempoReponerHoras) {
      update('salida', 'tiempoReponerHoras', '');
    }
  }, [form.salida.duracionTipo, form.salida.tiempoReponerHoras]);

  useEffect(() => {
    if (['jurado_votacion', 'sufragante', 'entierro_companero', 'obligaciones_escolares'].includes(form.salida.tipo) && form.salida.duracionTipo !== 'menos_media_jornada') {
      update('salida', 'duracionTipo', 'menos_media_jornada');
      update('salida', 'duracionDias', 0);
    }
  }, [form.salida.tipo, form.salida.duracionTipo]);



  const handleCategoryChange = (newCategory) => {
    setActiveCategory(newCategory);
    update('salida', 'tiempoReponerHoras', '');
    setNoCuentaAdjuntoSalud(false);
    setAdjuntoFile(null);
    setAdjuntoError('');
    if (newCategory === 'propias_cargo') {
      update('salida', 'tipo', 'ponencia');
      setShowPropiasCargoWarning(true);
    } else if (newCategory === 'salud') {
      update('salida', 'tipo', 'cita_eps');
      setShowSaludWarning(true);
    } else if (newCategory === 'personales') {
      update('salida', 'tipo', 'diligencia_personal');
      setShowPersonalesWarning(true);
    }
  };

  const handleSubtypeChange = (newSubtype) => {
    update('salida', 'tiempoReponerHoras', '');
    setNoCuentaAdjuntoSalud(false);
    setAdjuntoFile(null);
    setAdjuntoError('');
    if (newSubtype === 'otra') {
      update('salida', 'tipo', 'otra:');
    } else {
      update('salida', 'tipo', newSubtype);
      if (newSubtype === 'calamidad_domestica') {
        setShowCalamidadWarning(true);
      }
    }
  };

  const handleOtraDescripcionChange = (newDesc) => {
    update('salida', 'tipo', `otra:${newDesc}`);
  };

  const directFormUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams({
      titulo: documento?.codigo || 'THM-DP-FR-002',
      abrir: 'reporte-salida'
    });
    return `${window.location.origin}/dashboard/buscar-documentos?${params.toString()}`;
  }, [documento?.codigo]);

  const qrImageUrl = useMemo(() => (
    directFormUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=14&data=${encodeURIComponent(directFormUrl)}`
      : ''
  ), [directFormUrl]);

  useEffect(() => {
    if (!open) return;
    setActiveCategory('salud');
    setForm({
      ...INITIAL_FORM,
      personal: {
        nombre: user?.nombre || '',
        documento: user?.username || '',
        correo: user?.email || ''
      },
      laboral: {
        dependencia: user?.dependencia || '',
        vicerrectoria: user?.vicerrectoria || '',
        cargo: user?.cargo || ''
      },
      salida: {
        ...INITIAL_FORM.salida,
        oficioProyecto: user?.nombre || ''
      }
    });

    if (user?.jefe_inmediato) {
      setJefe({
        id: `profile-jefe:${normalizeOption(user.jefe_inmediato)}`,
        userId: null,
        nombre: user.jefe_inmediato,
        email: '',
        username: '',
        cargo: '',
        dependencia: '',
        jefe_inmediato: user.jefe_inmediato,
        source: 'users'
      });
    } else {
      setJefe(null);
    }
    
    setJefeSearch('');
    setErrorMessage('');
    setIsSalidaMultiple(false);
    setParticipantes([]);
    setAdjuntoFile(null);
    setAdjuntoError('');
    setNoCuentaAdjuntoSalud(false);
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    if (isSalidaMultiple) {
      setParticipantes([
        {
          nombre: user?.nombre || '',
          documento: user?.username || '',
          correo: user?.email || '',
          dependencia: form.laboral.dependencia || '',
          vicerrectoria: form.laboral.vicerrectoria || '',
          cargo: form.laboral.cargo || ''
        }
      ]);
      if (PERSONALES_SUBTYPES.some(s => s.value === form.salida.tipo)) {
        setForm(prev => ({
          ...prev,
          salida: {
            ...prev.salida,
            tipo: 'ponencia'
          }
        }));
      }
    } else {
      setParticipantes([]);
    }
  }, [isSalidaMultiple, open, user, form.laboral.dependencia, form.laboral.vicerrectoria, form.laboral.cargo, form.salida.tipo]);

  useEffect(() => {
    if (!open) return;
    reporteSalidaService.getCatalogoLaboral()
      .then((response) => {
        const data = response?.data || {};
        setDependencias(data.dependencias || []);
        setCargos(data.cargos || []);
        setLaboralRows(data.relaciones || []);
        setCatalogYear(data.periodoLabel || data.anio || '');
        const nextJefes = data.jefes || [];
        setJefes(nextJefes);
        if (data.currentEmployee) {
          const currentBoss = nextJefes.find((item) =>
            normalizeOption(item.jefe_inmediato || item.nombre) === normalizeOption(data.currentEmployee.jefe_inmediato)
          ) || null;
          setForm((prev) => ({
            ...prev,
            laboral: {
              dependencia: data.currentEmployee.dependencia || prev.laboral.dependencia,
              vicerrectoria: data.currentEmployee.vicerrectoria || prev.laboral.vicerrectoria,
              cargo: data.currentEmployee.cargo || prev.laboral.cargo
            }
          }));
          if (currentBoss) setJefe(currentBoss);
        }
      })
      .catch(() => {
        setDependencias([]);
        setCargos([]);
        setLaboralRows([]);
        setCatalogYear('');
      });
  }, [open]);

  useEffect(() => {
    setLoadingJefes(false);
  }, [jefeSearch, open]);

  const salidaMinutes = useMemo(() => {
    if (subtype === 'terapias') {
      const list = form.salida.terapiasList || [];
      return list.reduce((total, t) => {
        const tMins = countBusinessMinutes(t.fecha, t.fecha, t.horaInicio, t.horaFin) || 0;
        return total + tMins;
      }, 0);
    }
    if (category === 'salud' && subtype !== 'terapias') {
      return countElapsedMinutes(form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio, form.salida.horaFin);
    }
    return countBusinessMinutes(form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio, form.salida.horaFin);
  }, [category, form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio, form.salida.horaFin, form.salida.terapiasList, subtype]);

  const reposicionMinutes = useMemo(
    () => countElapsedMinutes(form.reposicion.fecha, form.reposicion.fechaFin, form.reposicion.horaInicio, form.reposicion.horaFin),
    [form.reposicion.fecha, form.reposicion.fechaFin, form.reposicion.horaInicio, form.reposicion.horaFin]
  );

  const salidaRangeIssue = useMemo(() => {
    if (subtype === 'terapias') {
      const list = form.salida.terapiasList || [];
      for (let i = 0; i < list.length; i++) {
        const issue = getRangeIssue({
          startDate: list[i].fecha,
          endDate: list[i].fecha,
          startTime: list[i].horaInicio,
          endTime: list[i].horaFin,
          minutes: countBusinessMinutes(list[i].fecha, list[i].fecha, list[i].horaInicio, list[i].horaFin),
          label: `terapia #${i + 1}`
        });
        if (issue) return issue;
      }
      return '';
    }
    return getRangeIssue({
      startDate: form.salida.fecha,
      endDate: form.salida.fechaRegreso,
      startTime: form.salida.horaInicio,
      endTime: form.salida.horaFin,
      minutes: salidaMinutes,
      label: 'salida'
    });
  }, [form.salida.fecha, form.salida.fechaRegreso, form.salida.horaFin, form.salida.horaInicio, salidaMinutes, form.salida.terapiasList, subtype]);
  const horaSalidaOptions = useMemo(
    () => filterFutureTimeOptionsForDate(TIME_OPTIONS, form.salida.fecha),
    [form.salida.fecha]
  );
  const horaRegresoOptions = useMemo(() => {
    if (!form.salida.horaInicio) {
      return filterFutureTimeOptionsForDate(TIME_OPTIONS, form.salida.fechaRegreso);
    }
    const shouldFilterByStartTime = !form.salida.fechaRegreso || !form.salida.fecha || form.salida.fecha === form.salida.fechaRegreso;
    const baseOptions = filterFutureTimeOptionsForDate(TIME_OPTIONS, form.salida.fechaRegreso);
    if (!shouldFilterByStartTime) return baseOptions;
    const startMinutes = timeToMinutes(form.salida.horaInicio);
    if (startMinutes == null) return baseOptions;
    return baseOptions.filter((option) => {
      const optionMinutes = timeToMinutes(option);
      return optionMinutes != null && optionMinutes > startMinutes;
    });
  }, [form.salida.fecha, form.salida.fechaRegreso, form.salida.horaInicio]);
  const reposicionHasAnyValue = Boolean(form.reposicion.fecha || form.reposicion.fechaFin || form.reposicion.horaInicio || form.reposicion.horaFin);
  const reposicionPlanComplete = Boolean(form.reposicion.fecha && form.reposicion.fechaFin && form.reposicion.horaInicio && form.reposicion.horaFin);
  const isOficioSolicitud = form.salida.duracionTipo !== 'menos_media_jornada';
  const shouldRequestReposicionHoras = category === 'personales' && subtype === 'diligencia_personal' && !isOficioSolicitud;
  const reposicionRangeIssue = useMemo(() => {
    if (!reposicionHasAnyValue) return '';
    if (!reposicionPlanComplete) {
      return 'Complete todos los campos del plan inicial de reposicion o dejelos vacios para gestionarlo luego en seguimiento.';
    }
    return getRangeIssue({
      startDate: form.reposicion.fecha,
      endDate: form.reposicion.fechaFin,
      startTime: form.reposicion.horaInicio,
      endTime: form.reposicion.horaFin,
      minutes: reposicionMinutes,
      label: 'plan de reposicion'
    });
  }, [reposicionHasAnyValue, reposicionMinutes, reposicionPlanComplete, form.reposicion.fecha, form.reposicion.fechaFin, form.reposicion.horaInicio, form.reposicion.horaFin]);

  const isPersonal = form.salida.tipo === 'diligencia_personal';
  const validationIssues = useMemo(() => {
    const issues = [];
    if (isSalidaMultiple) {
      if (participantes.length < 2) {
        issues.push('Debe agregar al menos un participante adicional a la salida grupal (mínimo 2 personas en total).');
      }
      participantes.forEach((p, idx) => {
        if (!p.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo)) {
          issues.push(`El participante #${idx + 1} (${p.nombre || 'Sin nombre'}) no tiene un correo electronico valido.`);
        }
      });
    } else {
      if (!form.laboral.dependencia) issues.push('Seleccione la dependencia del/de la colaborador(a).');
      if ((isOficioSolicitud || requiresViaticosFlow) && !form.laboral.vicerrectoria) issues.push('Seleccione la Vicerrectoría / Rectoría del/de la colaborador(a).');
      if (!form.laboral.cargo) issues.push('Seleccione el cargo del/de la colaborador(a).');
      if (!jefe) issues.push('Seleccione el jefe inmediato que aprobara la solicitud.');
      else if (!jefe.email) issues.push('El jefe inmediato seleccionado no tiene correo registrado.');
    }

    if (!subtype) {
      issues.push('Seleccione el motivo de la salida.');
    } else if (subtype === 'otra' && !otraDescripcion.trim()) {
      issues.push('Especifique el motivo de la salida para la opcion "Otra, ¿Cual?".');
    } else if (subtype === 'salida_campus') {
      if (!form.salida.campusSalida || !form.salida.campusDestino) {
        issues.push('Debe seleccionar el campus de salida y el campus de destino.');
      } else if (form.salida.campusSalida === form.salida.campusDestino) {
        issues.push('El campus de salida y el campus de destino no pueden ser iguales.');
      }
    } else if (!isOficioSolicitud && ['cita_eps', 'cita_particular'].includes(subtype) && !form.salida.especialidadMedica) {
      issues.push('Seleccione la especialidad medica para la cita.');
    }

    if (category === 'propias_cargo' && subtype !== 'salida_campus') {
      if (!form.salida.entidadDestino || !form.salida.entidadDestino.trim()) {
        issues.push('Debe especificar la entidad de destino.');
      }
      if (!form.salida.alcance) {
        issues.push('Seleccione el alcance de la actividad.');
      } else if (form.salida.alcance === 'Internacional' && !form.salida.pais) {
        issues.push('Debe seleccionar el país de destino para salidas internacionales.');
      } else if (form.salida.alcance === 'Nacional') {
        if (!form.salida.departamento) {
          issues.push('Debe seleccionar el departamento para salidas nacionales.');
        }
        if (!form.salida.municipio) {
          issues.push('Debe seleccionar el municipio para salidas nacionales.');
        }
      } else if (form.salida.alcance === 'Regional' && !form.salida.municipio) {
        issues.push('Debe seleccionar el municipio para salidas regionales.');
      }
    }

    if (shouldAskViaticos && form.viaticos?.requiereViaticos == null) {
      issues.push('Indique si el desplazamiento requiere viáticos.');
    }
    if (requiresViaticosFlow) {
      const requiredViaticosFields = [
        ['lugarVisitar', 'lugar a visitar'],
        ['fechaEvento', 'fecha del evento'],
        ['numeroDiasSolicitados', 'número de días solicitados'],
        ['objetoComision', 'objeto de la comisión'],
        ['centroCosto', 'centro de costos'],
        ['alojamiento', 'alojamiento'],
        ['transporte', 'transporte'],
        ['tipoCuenta', 'tipo de cuenta'],
        ['entidadBancaria', 'entidad bancaria'],
        ['numeroCuenta', 'número de cuenta']
      ];
      requiredViaticosFields.forEach(([field, label]) => {
        if (!String(form.viaticos?.[field] || '').trim()) issues.push(`Complete ${label} para la solicitud de viáticos.`);
      });
      if (!Number.isInteger(Number(form.viaticos?.numeroDiasSolicitados)) || Number(form.viaticos?.numeroDiasSolicitados) < 1) {
        issues.push('Digite una cantidad válida de días solicitados.');
      }
      if (!form.viaticos?.autorizacionAceptada) issues.push('Debe aceptar la autorización de descuento para solicitar viáticos.');
    }

    if (form.salida.duracionTipo === 'menos_media_jornada' && subtype !== 'diligencia_personal' && subtype !== 'otra') {
      if (!form.salida.motivo || !form.salida.motivo.trim()) {
        issues.push('El campo Motivo / observación es obligatorio.');
      }
    }



    if (!requiresViaticosFlow && form.salida.duracionTipo === '1_2_dias' && ![1, 2].includes(Number(form.salida.duracionDias))) {
      issues.push('Seleccione si el permiso será de 1 o 2 días.');
    }

    if (!requiresViaticosFlow && form.salida.duracionTipo === '3_mas_dias') {
      const duracionDias = Number(form.salida.duracionDias);
      if (!Number.isInteger(duracionDias) || duracionDias < 3) {
        issues.push('Digite una cantidad de días igual o mayor a 3.');
      }
    }



    if (subtype === 'terapias') {
      const list = form.salida.terapiasList || [];
      if (list.length === 0) {
        issues.push('Debe indicar la cantidad de terapias y completarlas.');
      } else {
        list.forEach((t, i) => {
          if (!t.fecha || !t.horaInicio || !t.horaFin) {
            issues.push(`Complete fecha, hora inicio y hora fin para la terapia #${i + 1}.`);
          }
        });
      }
      if (salidaRangeIssue) {
        issues.push(salidaRangeIssue);
      } else if (!salidaMinutes) {
        issues.push('El tiempo total de terapias debe ser mayor a cero.');
      }
    } else {
      const isSaludNoTerapias = category === 'salud' && subtype !== 'terapias';
      if (isSaludNoTerapias) {
        if (!form.salida.fecha || !form.salida.horaInicio || !form.salida.fechaRegreso) {
          issues.push('Complete fecha de salida, hora de salida y fecha de regreso.');
        }
      } else {
        if (!form.salida.fecha || !form.salida.horaInicio || !form.salida.fechaRegreso || !form.salida.horaFin) {
          issues.push('Complete fecha de salida, hora de salida, fecha de regreso y hora de regreso.');
        }
      }
      if (form.salida.horaFin) {
        if (salidaRangeIssue) {
          issues.push(salidaRangeIssue);
        } else if (category === 'personales' && !salidaMinutes) {
          issues.push('El tiempo solicitado debe sumar al menos un periodo dentro de la jornada laboral.');
        }
      }
    }

    if (subtype !== 'terapias' && isPastTimeError(form.salida.fecha, form.salida.horaInicio)) {
      issues.push('La hora de salida no puede ser anterior a la hora actual. Seleccione una franja futura.');
    }
    if (subtype !== 'terapias' && form.salida.horaFin && isPastTimeError(form.salida.fechaRegreso, form.salida.horaFin)) {
      issues.push('La hora de regreso no puede ser anterior a la hora actual cuando la fecha de regreso es hoy.');
    }
    
    const healthAttachmentWaived = category === 'salud' && noCuentaAdjuntoSalud;
    const shouldRequireHealthAttachment = category === 'salud' && !healthAttachmentWaived;
    const shouldRequireListedAttachment = REQUIRES_ADJUNTO.includes(subtype);
    if (!isOficioSolicitud && !adjuntoFile && (shouldRequireHealthAttachment || shouldRequireListedAttachment) && !healthAttachmentWaived) {
      issues.push('Debe subir el soporte, certificado o documento obligatorio.');
    }
    
    if (category === 'personales' && subtype === 'diligencia_personal' && form.salida.duracionTipo === 'menos_media_jornada') {
      if (form.salida.tiempoReponerHoras === undefined || form.salida.tiempoReponerHoras === '' || isNaN(Number(form.salida.tiempoReponerHoras))) {
        issues.push('Debe indicar de forma manual el tiempo a reponer en horas (digite 0 si no requiere reposición).');
      } else if (Number(form.salida.tiempoReponerHoras) < 0) {
        issues.push('El tiempo a reponer no puede ser un valor negativo.');
      }
    }

    return issues;
  }, [
    category,
    isSalidaMultiple,
    participantes,
    form.laboral.cargo,
    form.laboral.dependencia,
    form.laboral.vicerrectoria,
    form.viaticos,
    form.salida.fecha,
    form.salida.fechaRegreso,
    form.salida.horaFin,
    form.salida.horaInicio,
    form.salida.campusSalida,
    form.salida.campusDestino,
    subtype,
    otraDescripcion,
    isPersonal,
    isOficioSolicitud,
    jefe,
    reposicionMinutes,
    reposicionRangeIssue,
    reposicionHasAnyValue,
    salidaMinutes,
    salidaRangeIssue,
    adjuntoFile,
    noCuentaAdjuntoSalud,
    requiresViaticosFlow,
    shouldAskViaticos,
    form.salida.motivo,
    form.salida.tiempoReponerHoras,
    form.salida.entidadDestino,
    form.salida.duracionTipo,
    form.salida.duracionDias,
    form.salida.codigoDependencia,
    form.salida.destinatarioTratamiento,
    form.salida.destinatarioNombre,
    form.salida.destinatarioCargo,
    form.salida.destinatarioEmpresa,
    form.salida.destinatarioDireccionEmail,
    form.salida.destinatarioTelefono,
    form.salida.destinatarioUbicacion,
    form.salida.destinatarioPais,
    form.salida.oficioAsunto,
    form.salida.oficioCuerpo,
    form.salida.oficioAnexos,
    form.salida.oficioProyecto,
    form.salida.especialidadMedica,
    form.salida.alcance,
    form.salida.pais,
    form.salida.departamento,
    form.salida.municipio,
    form.salida.terapiasList
  ]);

  const selectedDependenciaIsCatalog = hasExactOption(form.laboral.dependencia, dependencias);
  const selectedCargoIsCatalog = hasExactOption(form.laboral.cargo, cargos);

  const dependenciaOptions = useMemo(() => {
    if (!laboralRows.length) return dependencias;
    if (selectedCargoIsCatalog) {
      const filteredRows = laboralRows.filter(
        (row) => normalizeOption(row.cargo) === normalizeOption(form.laboral.cargo)
      );
      return uniqueSorted(filteredRows.map((row) => row.dependencia));
    }
    return uniqueSorted(laboralRows.map((row) => row.dependencia));
  }, [dependencias, form.laboral.cargo, laboralRows, selectedCargoIsCatalog]);

  const cargoOptions = useMemo(() => {
    if (!laboralRows.length) return cargos;
    if (selectedDependenciaIsCatalog) {
      const filteredRows = laboralRows.filter(
        (row) => normalizeOption(row.dependencia) === normalizeOption(form.laboral.dependencia)
      );
      return uniqueSorted(filteredRows.map((row) => row.cargo));
    }
    return uniqueSorted(laboralRows.map((row) => row.cargo));
  }, [cargos, form.laboral.dependencia, laboralRows, selectedDependenciaIsCatalog]);

  const vicerrectoriaOptions = useMemo(() => uniqueSorted([
    ...VICERRECTORIA_OPTIONS,
    ...laboralRows.map((row) => row.vicerrectoria).filter(Boolean),
    form.laboral.vicerrectoria
  ].filter(Boolean)), [form.laboral.vicerrectoria, laboralRows]);

  useEffect(() => {
    if (!laboralRows.length) return;
    const depNormalized = normalizeOption(form.laboral.dependencia);
    const cargoNormalized = normalizeOption(form.laboral.cargo);

    const matchedRow = laboralRows.find(
      (row) => normalizeOption(row.dependencia) === depNormalized && normalizeOption(row.cargo) === cargoNormalized
    );

    if (matchedRow && matchedRow.jefe_inmediato) {
      if (!form.laboral.vicerrectoria && matchedRow.vicerrectoria) {
        update('laboral', 'vicerrectoria', matchedRow.vicerrectoria);
      }
      const jefeName = matchedRow.jefe_inmediato;
      const matchedBoss = jefes.find(
        (item) => normalizeOption(item.jefe_inmediato || item.nombre) === normalizeOption(jefeName)
      );
      if (matchedBoss) {
        setJefe(matchedBoss);
      } else {
        setJefe({
          id: `profile-jefe:${normalizeOption(jefeName)}`,
          userId: null,
          nombre: jefeName,
          email: '',
          username: '',
          cargo: '',
          dependencia: '',
          jefe_inmediato: jefeName,
          source: 'users'
        });
      }
    }
  }, [form.laboral.dependencia, form.laboral.cargo, form.laboral.vicerrectoria, laboralRows, jefes]);

  useEffect(() => {
    if (jefe && !jefe.email && jefes.length > 0) {
      const matchedBoss = jefes.find(
        (item) => normalizeOption(item.jefe_inmediato || item.nombre) === normalizeOption(jefe.nombre)
      );
      if (matchedBoss) {
        setJefe(matchedBoss);
      }
    }
  }, [jefe, jefes]);

  const displayJefeValue = useMemo(() => {
    if (!jefe) return '';
    const main = [jefe.cargo, jefe.nombre].filter(Boolean).join(' - ');
    const label = main || jefe.jefe_inmediato || '';
    return jefe.email ? `${label} (${jefe.email})` : label;
  }, [jefe]);

  const jefeHelperText = !jefe && (form.laboral.dependencia || form.laboral.cargo)
    ? 'No hay jefe inmediato relacionado con la dependencia y cargo seleccionados.'
    : '';

  const update = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
        ...(section === 'salida' && key === 'fecha' && !prev.salida.fechaRegreso ? { fechaRegreso: value } : {}),
        ...(section === 'reposicion' && key === 'fecha' && !prev.reposicion.fechaFin ? { fechaFin: value } : {})
      }
    }));
  };

  const updateViaticos = (key, value) => {
    setForm((prev) => ({ ...prev, viaticos: { ...prev.viaticos, [key]: value } }));
  };

  const handleViaticosAnswer = (requires) => {
    setForm((prev) => {
      const destino = [prev.salida.entidadDestino, prev.salida.municipio || prev.salida.pais].filter(Boolean).join(' - ');
      return {
        ...prev,
        viaticos: {
          ...prev.viaticos,
          requiereViaticos: requires,
          numeroDiasSolicitados: requires ? (prev.viaticos.numeroDiasSolicitados || '1') : prev.viaticos.numeroDiasSolicitados,
          lugarVisitar: prev.viaticos.lugarVisitar || destino,
          fechaEvento: prev.viaticos.fechaEvento || prev.salida.fecha || '',
          objetoComision: prev.viaticos.objetoComision || prev.salida.motivo || ''
        }
      };
    });
  };

  const copyDirectFormUrl = async () => {
    if (!directFormUrl) return;
    try {
      await navigator.clipboard.writeText(directFormUrl);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 1800);
    } catch (_) {
      setQrCopied(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        documentoId: documento?.id,
        isSalidaMultiple,
        participantes: isSalidaMultiple ? participantes : [],
        jefeInmediatoUserId: isSalidaMultiple ? null : (jefe?.userId || null),
        jefeInmediato: isSalidaMultiple ? null : (jefe ? {
          id: jefe.id,
          userId: jefe.userId || null,
          nombre: jefe.nombre || '',
          email: jefe.email || '',
          username: jefe.username || '',
          cargo: jefe.cargo || '',
          dependencia: jefe.dependencia || '',
          jefe_inmediato: jefe.jefe_inmediato || jefe.nombre || '',
          source: jefe.source || 'recurso_humano_administrativos'
        } : null),
        ...form,
        reposicion_minutos: isOficioSolicitud ? 0 : Math.round(parseFloat(form.salida.tiempoReponerHoras || 0) * 60)
      };
      
      payload.salida = {
        ...payload.salida,
        categoria: category,
        compartirAdjuntoJefe: true,
        noCuentaAdjunto: category === 'salud' ? noCuentaAdjuntoSalud : false,
        declaracionSinAdjunto: category === 'salud' && noCuentaAdjuntoSalud ? DECLARACION_SIN_ADJUNTO_SALUD : ''
      };
      if (!requiresViaticosFlow) delete payload.viaticos;
      
      if (adjuntoFile && !(category === 'salud' && noCuentaAdjuntoSalud)) {
        const formData = new FormData();
        formData.append('adjunto', adjuntoFile);
        const uploadRes = requiresViaticosFlow
          ? await desplazamientoViaticosService.uploadAdjunto(formData)
          : await reporteSalidaService.uploadAdjunto(formData);
        if (uploadRes.success && uploadRes.filename) {
          if (requiresViaticosFlow) {
            payload.viaticos = {
              ...payload.viaticos,
              soporteAdjunto: { filename: uploadRes.filename, originalName: uploadRes.originalName || adjuntoFile.name }
            };
          } else {
            payload.datos_formulario = payload.datos_formulario || {};
            payload.datos_formulario.adjunto_path = uploadRes.filename;
          }
        }
      }
      
      const response = requiresViaticosFlow
        ? await desplazamientoViaticosService.radicarSolicitud(payload)
        : await reporteSalidaService.radicarSolicitud(payload);
      setSuccessResponse(response);
      setShowSuccessModal(true);
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'No se pudo radicar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    try {
      onSubmitted?.(successResponse);
    } finally {
      onClose?.();
    }
  };

  const disableSubmit = submitting || validationIssues.length > 0;
  const shouldShowAdjuntoSection = category === 'propias_cargo' || REQUIRES_ADJUNTO.includes(subtype) || ['urgencia_medica', 'otra'].includes(subtype);
  const isSaludAdjuntoSection = category === 'salud' && shouldShowAdjuntoSection;
  const hideAdjuntoUploadByDeclaration = isSaludAdjuntoSection && noCuentaAdjuntoSalud;
  const canPasteAdjunto = open && shouldShowAdjuntoSection && !hideAdjuntoUploadByDeclaration && !submitting;

  useEffect(() => {
    if (!canPasteAdjunto) return undefined;
    const handlePaste = (event) => {
      const imageFile = getClipboardImageFile(event.clipboardData);
      if (!imageFile) return;
      event.preventDefault();
      setAdjuntoFromFile(imageFile, 'clipboard');
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [canPasteAdjunto]);

  return (
    <>
      <Dialog
        open={open}
        onClose={submitting ? undefined : (event, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
            onClose?.();
          }
        }}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreen}
        PaperProps={{
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            overflow: 'hidden',
            width: fullScreen ? '100%' : 'min(1180px, calc(100vw - 32px))'
          }
        }}
      >
        <DialogTitle sx={{ px: { xs: 2, md: 3 }, py: 2, bgcolor: '#f8fbff', borderBottom: '1px solid #dbe6f5' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#2563eb', display: 'grid', placeItems: 'center' }}>
                <AssignmentTurnedInIcon sx={{ color: '#fff', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Diligenciar reporte de salida</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12 }}>{documento?.codigo} - {documento?.titulo}</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: { sm: 'auto' }, alignSelf: { xs: 'stretch', sm: 'center' } }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<QrCode2Icon />}
                onClick={() => setQrOpen(true)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900, height: 38, alignSelf: { xs: 'flex-start', sm: 'center' } }}
              >
                Generar QR
              </Button>
              <IconButton
                onClick={onClose}
                disabled={submitting}
                sx={{
                  color: '#64748b',
                  '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' },
                  transition: 'all 0.15s ease'
                }}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            bgcolor: '#f6f8fb',
            p: { xs: 2, md: 3 },
            '&::-webkit-scrollbar': {
              width: '10px',
              height: '10px'
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: '#f1f5f9'
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: '#cbd5e1',
              borderRadius: '99px',
              border: '2px solid #f6f8fb',
              '&:hover': {
                bgcolor: '#94a3b8'
              }
            }
          }}
        >
          <Stack spacing={2}>
            {/* New Toggle Group / Individual */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
              <Box
                onClick={() => setIsSalidaMultiple(false)}
                sx={{
                  py: 0.8,
                  px: 3,
                  width: '100%',
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: !isSalidaMultiple ? '#2563eb' : '#e2e8f0',
                  bgcolor: !isSalidaMultiple ? '#eff6ff' : '#ffffff',
                  boxShadow: !isSalidaMultiple ? '0 8px 20px rgba(37, 99, 235, 0.15)' : '0 2px 5px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  gap: 1.5,
                  '&:hover': {
                    borderColor: '#2563eb',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 25px rgba(37, 99, 235, 0.12)'
                  }
                }}
              >
                <PersonIcon sx={{ fontSize: 24, color: !isSalidaMultiple ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: !isSalidaMultiple ? '#1e3a8a' : '#475569', textAlign: 'center' }}>
                  Salida Individual
                </Typography>
              </Box>
              <Box
                onClick={() => setIsSalidaMultiple(true)}
                sx={{
                  py: 0.8,
                  px: 3,
                  width: '100%',
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: isSalidaMultiple ? '#2563eb' : '#e2e8f0',
                  bgcolor: isSalidaMultiple ? '#eff6ff' : '#ffffff',
                  boxShadow: isSalidaMultiple ? '0 8px 20px rgba(37, 99, 235, 0.15)' : '0 2px 5px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  gap: 1.5,
                  '&:hover': {
                    borderColor: '#2563eb',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 25px rgba(37, 99, 235, 0.12)'
                  }
                }}
              >
                <PeopleIcon sx={{ fontSize: 24, color: isSalidaMultiple ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: isSalidaMultiple ? '#1e3a8a' : '#475569', textAlign: 'center' }}>
                  Salida Grupal
                </Typography>
              </Box>
            </Box>

            <Box sx={sectionSx}>
              <SectionTitle title={isSalidaMultiple ? "Datos del líder de la actividad" : "Datos del/de la colaborador(a)"} />
              <Box sx={responsiveFieldGrid('minmax(220px, 1fr) minmax(180px, 0.75fr) minmax(260px, 1.2fr)')}>
                <TextField sx={inputSx} fullWidth size="small" label="Nombre" value={form.personal.nombre} disabled />
                <TextField sx={inputSx} fullWidth size="small" label="Documento" value={form.personal.documento} disabled />
                <TextField sx={inputSx} fullWidth size="small" label="Correo" value={form.personal.correo} disabled />
              </Box>
            </Box>

            <Box sx={sectionSx}>
              <SectionTitle title={isSalidaMultiple ? "Información laboral del líder de la actividad" : "Información laboral"} />
              <Box sx={responsiveFieldGrid('minmax(240px, 0.95fr) minmax(300px, 1.25fr) minmax(240px, 0.9fr)')}>
                <Autocomplete
                  fullWidth
                  openOnFocus
                  options={vicerrectoriaOptions}
                  value={form.laboral.vicerrectoria || ''}
                  onChange={(_, value) => update('laboral', 'vicerrectoria', value || '')}
                  isOptionEqualToValue={(option, value) => normalizeOption(option) === normalizeOption(value)}
                  ListboxProps={{ sx: autocompleteListSx }}
                  componentsProps={{
                    popper: {
                      sx: {
                        ...autocompletePopperSx,
                        width: { xs: 'calc(100vw - 48px) !important', md: '520px !important' },
                        maxWidth: 'calc(100vw - 48px)'
                      }
                    }
                  }}
                  renderInput={(params) => <TextField {...params} sx={inputSx} fullWidth size="small" required={isOficioSolicitud} label="Rectoría / Vicerrectoría" placeholder={isOficioSolicitud ? "Seleccione Rectoría / Vicerrectoría" : "Opcional para media jornada"} />}
                />
                <Autocomplete
                  freeSolo
                  fullWidth
                  openOnFocus
                  options={dependenciaOptions}
                  value={form.laboral.dependencia || ''}
                  onChange={(_, value) => update('laboral', 'dependencia', value || '')}
                  onInputChange={(_, value) => update('laboral', 'dependencia', value || '')}
                  ListboxProps={{ sx: autocompleteListSx }}
                  componentsProps={{
                    popper: {
                      sx: {
                        ...autocompletePopperSx,
                        width: { xs: 'calc(100vw - 48px) !important', md: '720px !important' },
                        maxWidth: 'calc(100vw - 48px)'
                      }
                    }
                  }}
                  renderInput={(params) => <TextField {...params} sx={inputSx} fullWidth size="small" required label="Dependencia" placeholder="Buscar dependencia" />}
                />
                <Autocomplete
                  freeSolo
                  fullWidth
                  openOnFocus
                  options={cargoOptions}
                  value={form.laboral.cargo || ''}
                  onChange={(_, value) => update('laboral', 'cargo', value || '')}
                  onInputChange={(_, value) => update('laboral', 'cargo', value || '')}
                  ListboxProps={{ sx: autocompleteListSx }}
                  componentsProps={{
                    popper: {
                      sx: {
                        ...autocompletePopperSx,
                        width: { xs: 'calc(100vw - 48px) !important', md: '620px !important' },
                        maxWidth: 'calc(100vw - 48px)'
                      }
                    }
                  }}
                  renderInput={(params) => <TextField {...params} sx={inputSx} fullWidth size="small" required label="Cargo" placeholder="Buscar cargo" />}
                />
              </Box>
              {!isSalidaMultiple && (
                <Box sx={{ mt: 1.5 }}>
                  <TextField
                    sx={inputSx}
                    fullWidth
                    InputProps={{ readOnly: true }}
                    size="small"
                    label="Jefe inmediato"
                    value={displayJefeValue}
                    helperText={jefe && !jefe.email ? 'El jefe inmediato asignado no tiene correo registrado en el sistema. Solicite su registro a un administrador.' : jefeHelperText}
                    error={Boolean(jefe && !jefe.email) || Boolean(!jefe && (form.laboral.dependencia || form.laboral.cargo))}
                  />
                </Box>
              )}
            </Box>
            {isSalidaMultiple && (
              <Box sx={sectionSx}>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.5 }}>
                  <PeopleIcon sx={{ color: '#2563eb', fontSize: 24 }} />
                  <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 15.5 }}>
                    Participantes de la salida grupal
                  </Typography>
                </Stack>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Usted es el/la <strong>líder de la actividad</strong>. Agregue a los(as) demás colaboradores(as) que participarán con usted en la salida grupal. Se registrará la salida para todos(as) y pasará directo a aprobación de Gestión del Talento Humano.
                </Alert>

                <Autocomplete
                  openOnFocus
                  options={laboralRows}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return `${option.nombre} - ${option.cargo || ''}`;
                  }}
                  filterOptions={(options, state) => {
                    const query = normalizeOption(state.inputValue);
                    return options.filter(opt => {
                      const nameMatch = normalizeOption(opt.nombre).includes(query);
                      const docMatch = normalizeOption(opt.documento).includes(query);
                      const emailMatch = normalizeOption(opt.email).includes(query);
                      const cargoMatch = normalizeOption(opt.cargo).includes(query);
                      const depMatch = normalizeOption(opt.dependencia).includes(query);
                      return nameMatch || docMatch || emailMatch || cargoMatch || depMatch;
                    });
                  }}
                  onChange={(_, value) => {
                    if (value) {
                      handleAddParticipant(value);
                    }
                  }}
                  ListboxProps={{ sx: autocompleteListSx }}
                  componentsProps={{
                    popper: {
                      sx: {
                        ...autocompletePopperSx,
                        width: { xs: 'calc(100vw - 48px) !important', md: '720px !important' },
                        maxWidth: 'calc(100vw - 48px)'
                      }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      sx={{
                        ...inputSx,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#eff6ff',
                          transition: 'all 0.2s',
                          animation: 'pulseGlow 2s infinite',
                          '@keyframes pulseGlow': {
                            '0%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)' },
                            '70%': { boxShadow: '0 0 0 10px rgba(59, 130, 246, 0)' },
                            '100%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)' }
                          },
                          '& fieldset': { border: '2px solid #3b82f6' },
                          '&:hover fieldset': { border: '2px solid #2563eb' },
                          '&.Mui-focused fieldset': { border: '2px solid #1d4ed8' },
                          '&:hover': { bgcolor: '#dbeafe' },
                          '&.Mui-focused': { bgcolor: '#fff', animation: 'none', boxShadow: '0 0 0 4px rgba(29, 78, 216, 0.2)' }
                        }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <SearchIcon sx={{ color: '#64748b', ml: 1, mr: -0.5 }} />
                            {params.InputProps.startAdornment}
                          </>
                        )
                      }}
                      fullWidth
                      size="medium"
                      label="Buscar colaborador(a) para agregar..."
                      placeholder="Escriba nombre, cargo, dependencia, cedula o correo"
                    />
                  )}
                />

                {participantes.length > 0 ? (
                  <Box sx={{ mt: 2, border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2.5fr 2.5fr 3fr 40px', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', p: 1, fontWeight: 800, fontSize: 12.5, color: '#475569' }}>
                      <Box sx={{ pl: 1 }}>Colaborador(a)</Box>
                      <Box>Cargo / Dependencia</Box>
                      <Box>Correo institucional (editable)</Box>
                      <Box></Box>
                    </Box>
                    <Stack divider={<Box sx={{ borderBottom: '1px solid #f1f5f9' }} />}>
                      {participantes.map((p, idx) => (
                        <Box key={p.documento} sx={{ display: 'grid', gridTemplateColumns: '2.5fr 2.5fr 3fr 40px', alignItems: 'center', p: 1, minHeight: 54 }}>
                          <Box sx={{ pl: 1 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>
                              {p.nombre}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>
                              {p.cargo}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                              {p.dependencia}
                            </Typography>
                          </Box>
                          <Box sx={{ pr: 1 }}>
                            <TextField
                              size="small"
                              fullWidth
                              value={p.correo}
                              placeholder="Ingrese correo institucional"
                              onChange={(e) => handleUpdateParticipantEmail(idx, e.target.value)}
                              error={!p.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo)}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 1.5,
                                  height: 36,
                                  fontSize: 12.5
                                }
                              }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Button
                              onClick={() => handleRemoveParticipant(idx)}
                              sx={{ minWidth: 0, p: 0.5, color: '#ef4444', '&:hover': { bgcolor: '#fef2f2' } }}
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </Button>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <Box sx={{ mt: 2, py: 4, border: '1px dashed #cbd5e1', borderRadius: 2.5, textAlign: 'center', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontSize: 13.5, color: '#64748b', fontWeight: 600 }}>
                      No se han agregado participantes. Use el buscador superior para añadir colaboradores(as).
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            <Box sx={sectionSx}>
              <SectionTitle title="Datos de la salida" />

              <CategoriaTabs
                category={category}
                isSalidaMultiple={isSalidaMultiple}
                onChange={handleCategoryChange}
              />

              {/* Subtype Dropdown & Conditional Custom Description */}
              {category === 'propias_cargo' && subtype !== 'salida_campus' ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1.8 }}>
                  {/* ROW 1: Opción, Alcance, Geo sub-field */}
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr 1.8fr' },
                    gap: 1.5
                  }}>
                    {/* Opción / Motivo */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        sx={{ ...inputSx, '& .MuiSelect-select': { whiteSpace: 'normal !important' } }}
                        select
                        fullWidth
                        size="medium"
                        label="Opción / Motivo de la salida"
                        value={subtype}
                        onChange={(e) => handleSubtypeChange(e.target.value)}
                      >
                        {CARGO_SUBTYPES.reduce((acc, opt, index, arr) => {
                          if (opt.group) {
                            const prevGroup = index > 0 ? arr[index - 1].group : null;
                            if (opt.group !== prevGroup) {
                              acc.push(
                                <ListSubheader key={`group-${opt.group}`} sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#334155', lineHeight: '36px' }}>
                                  {opt.group}
                                </ListSubheader>
                              );
                            }
                          }
                          acc.push(
                            <MenuItem key={opt.value} value={opt.value} sx={{ whiteSpace: 'normal', pl: opt.group ? 3 : 2 }}>
                              {opt.label}
                            </MenuItem>
                          );
                          return acc;
                        }, [])}
                      </TextField>
                    </Box>

                    {/* Alcance de la actividad */}
                    <TextField
                      sx={inputSx}
                      select
                      fullWidth
                      required
                      size="medium"
                      label="Alcance de la actividad"
                      value={form.salida.alcance || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        update('salida', 'alcance', val);
                        if (val !== 'Internacional') update('salida', 'pais', '');
                        if (val !== 'Nacional') update('salida', 'departamento', '');
                        if (val !== 'Nacional' && val !== 'Regional') update('salida', 'municipio', '');
                        if (val === 'Regional') update('salida', 'departamento', 'Nariño');
                      }}
                    >
                      {ALCANCE_OPTIONS.map((opt) => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </TextField>

                    {/* Geo sub-field (col 3): changes based on alcance */}
                    {form.salida.alcance === 'Internacional' && (
                      <Autocomplete
                        sx={inputSx}
                        options={PAISES_OPTIONS}
                        value={form.salida.pais || null}
                        onChange={(event, newValue) => update('salida', 'pais', newValue || '')}
                        renderInput={(params) => (
                          <TextField {...params} sx={inputSx} label="País de destino *" required fullWidth size="medium" />
                        )}
                      />
                    )}

                    {form.salida.alcance === 'Nacional' && (
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                        <Autocomplete
                          options={Object.keys(DEPARTAMENTOS_MUNICIPIOS).filter(d => d !== 'Nariño')}
                          value={form.salida.departamento || null}
                          onChange={(event, newValue) => {
                            update('salida', 'departamento', newValue || '');
                            update('salida', 'municipio', '');
                          }}
                          renderInput={(params) => (
                            <TextField {...params} sx={inputSx} label="Departamento *" required fullWidth size="medium" />
                          )}
                        />
                        <Autocomplete
                          options={
                            form.salida.departamento
                              ? TODAS_MUNICIPIOS_COMPLETOS.filter(item => item.departamento === form.salida.departamento)
                              : TODAS_MUNICIPIOS_COMPLETOS.filter(item => item.departamento !== 'Nariño')
                          }
                          getOptionLabel={(option) => typeof option === 'string' ? option : (form.salida.departamento ? option.municipio : option.label)}
                          value={
                            form.salida.municipio
                              ? (TODAS_MUNICIPIOS_COMPLETOS.find(item => item.municipio === form.salida.municipio && item.departamento === (form.salida.departamento || item.departamento)) || null)
                              : null
                          }
                          onChange={(event, newValue) => {
                            if (newValue) {
                              update('salida', 'departamento', newValue.departamento);
                              update('salida', 'municipio', newValue.municipio);
                            } else {
                              update('salida', 'municipio', '');
                            }
                          }}
                          renderInput={(params) => (
                            <TextField {...params} sx={inputSx} label="Municipio *" required fullWidth size="medium" />
                          )}
                        />
                      </Box>
                    )}

                    {form.salida.alcance === 'Regional' && (
                      <Autocomplete
                        sx={inputSx}
                        options={DEPARTAMENTOS_MUNICIPIOS['Nariño']}
                        value={form.salida.municipio || null}
                        onChange={(event, newValue) => {
                          update('salida', 'municipio', newValue || '');
                          update('salida', 'departamento', 'Nariño');
                        }}
                        renderInput={(params) => (
                          <TextField {...params} sx={inputSx} label="Municipio de Nariño *" required fullWidth size="medium" />
                        )}
                      />
                    )}

                    {/* Placeholder when no alcance selected to maintain grid height */}
                    {!form.salida.alcance && <Box />}
                  </Box>

                  {/* ROW 2: Entidad de destino — full width */}
                  <TextField
                    sx={inputSx}
                    fullWidth
                    required
                    size="medium"
                    label="Entidad de destino *"
                    placeholder="Escriba el nombre de la entidad o institución de destino"
                    value={form.salida.entidadDestino || ''}
                    onChange={(e) => update('salida', 'entidadDestino', e.target.value)}
                  />

                  {/* Especifique motivo si es 'otra' */}
                  {subtype === 'otra' && (
                    <TextField
                      sx={motivoInputSx}
                      fullWidth
                      required
                      size="medium"
                      label="Especifique el motivo (¿Cuál?)"
                      placeholder="Ej: Visita técnica a laboratorios"
                      value={otraDescripcion}
                      onChange={(e) => handleOtraDescripcionChange(e.target.value)}
                    />
                  )}
                </Box>
              ) : (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: subtype === 'salida_campus' ? '1.2fr 1fr 1fr' :
                    subtype === 'otra' ? (category === 'propias_cargo' ? '1.2fr 1.5fr 1fr 1.5fr' : '1fr 2fr') :
                      ['cita_eps', 'cita_particular'].includes(subtype) ? '1fr 1fr' :
                        category === 'propias_cargo' ? '1.2fr 1fr 1.8fr' : '1fr'
                },
                gap: 1.5,
                mb: 1.8
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    sx={{
                      ...inputSx,
                      '& .MuiSelect-select': { whiteSpace: 'normal !important' }
                    }}
                    select
                    fullWidth
                    size="medium"
                    label="Opción / Motivo de la salida"
                    value={subtype}
                    onChange={(e) => handleSubtypeChange(e.target.value)}
                  >
                    {(category === 'propias_cargo'
                      ? CARGO_SUBTYPES
                      : category === 'salud'
                        ? (isSalidaMultiple ? SALUD_SUBTYPES.filter(opt => opt.value === 'urgencia_medica') : SALUD_SUBTYPES)
                        : PERSONALES_SUBTYPES
                    ).reduce((acc, opt, index, arr) => {
                      if (opt.group) {
                        const prevGroup = index > 0 ? arr[index - 1].group : null;
                        if (opt.group !== prevGroup) {
                          acc.push(
                            <ListSubheader key={`group-${opt.group}`} sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#334155', lineHeight: '36px' }}>
                              {opt.group}
                            </ListSubheader>
                          );
                        }
                      }
                      acc.push(
                        <MenuItem key={opt.value} value={opt.value} sx={{ whiteSpace: 'normal', pl: opt.group ? 3 : 2 }}>
                          {opt.label}
                        </MenuItem>
                      );
                      return acc;
                    }, [])}
                  </TextField>
                  {category === 'salud' && (
                    <Tooltip
                      title="El permiso por motivo de salud se otorga exclusivamente para la atención médica del/de la colaborador(a) (consultas, procedimientos, terapias, exámenes). El acompañamiento a citas médicas de familiares (hijos, padres, cónyuge) debe registrarse en la categoría de 'Trámites, Permisos y Licencias'"
                      arrow
                      placement="top"
                    >
                      <InfoIcon sx={{ color: '#0284c7', cursor: 'help' }} />
                    </Tooltip>
                  )}
                </Box>

                {['cita_eps', 'cita_particular'].includes(subtype) && (
                  <TextField
                    sx={inputSx}
                    select
                    fullWidth
                    required={!isOficioSolicitud}
                    size="medium"
                    label="Especialidad médica"
                    value={form.salida.especialidadMedica || ''}
                    onChange={(e) => update('salida', 'especialidadMedica', e.target.value)}
                  >
                    {ESPECIALIDADES_MEDICAS.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </TextField>
                )}

                {subtype === 'otra' && (
                  <TextField
                    sx={motivoInputSx}
                    fullWidth
                    required
                    size="medium"
                    label="Especifique el motivo (¿Cuál?)"
                    placeholder="Ej: Visita técnica a laboratorios"
                    value={otraDescripcion}
                    onChange={(e) => handleOtraDescripcionChange(e.target.value)}
                  />
                )}



                {subtype === 'salida_campus' && (() => {
                  const hasCampusError = form.salida.campusSalida && form.salida.campusDestino && form.salida.campusSalida === form.salida.campusDestino;
                  return (
                    <>
                      <TextField
                        sx={inputSx}
                        select
                        fullWidth
                        required
                        size="medium"
                        label="Campus salida"
                        error={hasCampusError}
                        value={form.salida.campusSalida || ''}
                        onChange={(e) => update('salida', 'campusSalida', e.target.value)}
                      >
                        {['Campus Centro', 'Campus Santiago', 'Campus San Damián'].map((opt) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        sx={inputSx}
                        select
                        fullWidth
                        required
                        size="medium"
                        label="Campus destino"
                        error={hasCampusError}
                        helperText={hasCampusError ? 'Los campus de salida y destino no pueden ser iguales' : ''}
                        value={form.salida.campusDestino || ''}
                        onChange={(e) => update('salida', 'campusDestino', e.target.value)}
                      >
                        {['Campus Centro', 'Campus Santiago', 'Campus San Damián'].map((opt) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </TextField>
                    </>
                  );
                })()}

                {subtype === 'terapias' && (
                  <TextField
                    sx={inputSx}
                    fullWidth
                    required
                    type="number"
                    size="medium"
                    label="¿Cuántas terapias le van a realizar?"
                    InputProps={{ inputProps: { min: 1, max: 20 } }}
                    onKeyDown={(e) => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault(); }}
                    value={form.salida.terapiasList?.length || ''}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      if (count < 0 || count > 30) return;
                      const newList = [...(form.salida.terapiasList || [])];
                      if (count > newList.length) {
                        for (let i = newList.length; i < count; i++) {
                          newList.push({ fecha: '', horaInicio: '', horaFin: '' });
                        }
                      } else {
                        newList.splice(count);
                      }
                      update('salida', 'terapiasList', newList);
                    }}
                  />
                )}
              </Box>
              )}

              {subtype === 'terapias' && form.salida.terapiasList?.length > 0 && (
                <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {form.salida.terapiasList.map((terapia, idx) => {
                    const tMins = countBusinessMinutes(terapia.fecha, terapia.fecha, terapia.horaInicio, terapia.horaFin) || 0;
                    return (
                      <Box key={idx} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#334155', mb: 1 }}>
                          Terapia {idx + 1}
                        </Typography>
                        <Box sx={responsiveFieldGrid(category === 'personales' ? 'minmax(160px, 1fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(100px, 0.5fr)' : 'minmax(160px, 1fr) minmax(140px, 1fr) minmax(140px, 1fr)')}>
                          <TextField sx={inputSx} fullWidth size="small" required type="date" label="Fecha de la terapia" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={terapia.fecha} onChange={(e) => { const n = [...form.salida.terapiasList]; n[idx].fecha = e.target.value; update('salida', 'terapiasList', n); }} />
                          <TimeAutocomplete
                            options={TIME_OPTIONS}
                            value={terapia.horaInicio || ''}
                            onChange={(value) => {
                              const n = [...form.salida.terapiasList];
                              n[idx].horaInicio = value;
                              update('salida', 'terapiasList', n);
                            }}
                            convert24To12={convert24To12}
                            inputSx={inputSx}
                            required
                            label="Hora de salida a la terapia"
                            placeholder="hh:mm am/pm"
                            error={isPastTimeError(terapia.fecha, terapia.horaInicio)}
                          />
                          <TimeAutocomplete
                            options={TIME_OPTIONS}
                            value={terapia.horaFin || ''}
                            onChange={(value) => {
                              const n = [...form.salida.terapiasList];
                              n[idx].horaFin = value;
                              update('salida', 'terapiasList', n);
                            }}
                            convert24To12={convert24To12}
                            inputSx={inputSx}
                            required
                            label="Hora de reintegro a labores"
                            placeholder="hh:mm am/pm"
                            error={isPastTimeError(terapia.fecha, terapia.horaFin)}
                          />
                          {category === 'personales' && (
                            <Box sx={{ minHeight: 40, px: 1.5, borderRadius: 1.5, bgcolor: tMins ? '#ecfdf5' : '#fff7ed', border: `1px solid ${tMins ? '#bbf7d0' : '#fed7aa'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography sx={{ color: tMins ? '#166534' : '#c2410c', fontSize: 12, fontWeight: 800 }}>
                                {formatMinutes(tMins)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                  })}

                  {category === 'personales' && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mt: 1.5, pr: 0.5 }}>
                      <TextField
                        sx={{ ...inputSx, width: 220 }}
                        required
                        type="number"
                        size="small"
                        label="Tiempo a reponer (horas)"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ min: 0, step: 1 }}
                        value={form.salida.tiempoReponerHoras || ''}
                        onChange={(e) => update('salida', 'tiempoReponerHoras', e.target.value.replace(/[^0-9]/g, ''))}
                      />
                      <Box sx={{ minHeight: 40, px: 2, borderRadius: 1.5, bgcolor: salidaMinutes ? '#ecfdf5' : '#fff7ed', border: `1px solid ${salidaMinutes ? '#bbf7d0' : '#fed7aa'}`, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                          TOTAL GENERAL:
                        </Typography>
                        <Typography sx={{ color: salidaMinutes ? '#166534' : '#c2410c', fontSize: 14, fontWeight: 900 }}>
                          {formatMinutes(salidaMinutes)}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {shouldAskViaticos && (
                <ViaticosQuestion value={form.viaticos?.requiereViaticos} onChange={handleViaticosAnswer} />
              )}

              {requiresViaticosFlow && (
                <SolicitudViaticosFields
                  viaticos={form.viaticos || INITIAL_FORM.viaticos}
                  salida={form.salida}
                  onChange={updateViaticos}
                  onSalidaChange={(field, value) => update('salida', field, value)}
                  onObjetoChange={(value) => {
                    updateViaticos('objetoComision', value);
                    update('salida', 'motivo', value);
                  }}
                  inputSx={inputSx}
                  todayString={todayString}
                  TimeFieldComponent={TimeAutocomplete}
                  horaSalidaOptions={horaSalidaOptions}
                  horaRegresoOptions={horaRegresoOptions}
                  convert24To12={convert24To12}
                  isPastTimeError={isPastTimeError}
                  salidaRangeIssue={salidaRangeIssue}
                />
              )}

              {!requiresViaticosFlow && (
                <DuracionSelector
                  salida={form.salida}
                  fieldSx={duracionDiasFieldSx}
                  onChange={(field, value) => update('salida', field, value)}
                />
              )}



              {!requiresViaticosFlow && (
                <CamposDuracionSalida
                  category={category}
                  convert24To12={convert24To12}
                  form={form}
                  horaRegresoOptions={horaRegresoOptions}
                  horaSalidaOptions={horaSalidaOptions}
                  inputSx={inputSx}
                  isPastTimeError={isPastTimeError}
                  responsiveFieldGrid={responsiveFieldGrid}
                  salidaRangeIssue={salidaRangeIssue}
                  shouldRequestReposicionHoras={shouldRequestReposicionHoras}
                  subtype={subtype}
                  todayString={todayString}
                  update={update}
                />
              )}

              {subtype === 'urgencia_medica' && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                  Para urgencias medicas debe adjuntar el soporte si cuenta con el documento. Si aun no lo tiene, marque la opcion "No cuento con archivos adjuntos en este momento" y conserve los soportes para entregarlos cuando sean requeridos.
                </Alert>
              )}

              {isSaludAdjuntoSection && (
                <Box sx={{ mt: 1.5 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={noCuentaAdjuntoSalud}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNoCuentaAdjuntoSalud(checked);
                          if (checked) {
                            setAdjuntoFile(null);
                            setAdjuntoError('');
                          }
                        }}
                        color="primary"
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', textAlign: 'left' }}>
                        No cuento con archivos adjuntos en este momento
                      </Typography>
                    }
                    sx={{ mb: noCuentaAdjuntoSalud ? 1 : 0, display: 'flex', alignItems: 'center', textAlign: 'left' }}
                  />
                  {noCuentaAdjuntoSalud && (
                    <Alert severity="info" sx={{ borderRadius: 2, border: '1px solid #93c5fd', bgcolor: '#eff6ff', color: '#1e3a8a' }}>
                      {DECLARACION_SIN_ADJUNTO_SALUD}
                    </Alert>
                  )}
                </Box>
              )}

              {shouldShowAdjuntoSection && !hideAdjuntoUploadByDeclaration && (
                <Box>
                  <Box
                    component="label"
                    sx={{
                      mt: 2,
                      p: 3,
                      borderRadius: 2,
                      border: adjuntoFile ? '2px solid #22c55e' : (adjuntoError ? '2px solid #ef4444' : '2px dashed #93c5fd'),
                      bgcolor: adjuntoFile ? '#f0fdf4' : (adjuntoError ? '#fef2f2' : '#eff6ff'),
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: adjuntoFile ? '#dcfce7' : (adjuntoError ? '#fee2e2' : '#dbeafe'),
                        borderColor: adjuntoFile ? '#16a34a' : (adjuntoError ? '#dc2626' : '#3b82f6')
                      }
                    }}
                  >
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAdjuntoFromFile(file);
                      }}
                    />
                    {adjuntoFile ? (
                      <>
                        {adjuntoPreviewUrl ? (
                          <Box
                            component="img"
                            src={adjuntoPreviewUrl}
                            alt="Vista previa del adjunto"
                            sx={{
                              width: 'min(100%, 360px)',
                              maxHeight: 180,
                              objectFit: 'contain',
                              borderRadius: 1.5,
                              border: '1px solid #86efac',
                              bgcolor: '#ffffff',
                              p: 0.5,
                              mb: 1.5
                            }}
                          />
                        ) : (
                          <CheckCircleOutlineIcon sx={{ fontSize: 40, color: '#16a34a', mb: 1 }} />
                        )}
                        <Typography sx={{ fontWeight: 700, color: '#166534', textAlign: 'center' }}>
                          Archivo adjuntado correctamente
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: '#15803d', textAlign: 'center', mt: 0.5, wordBreak: 'break-all' }}>
                          {adjuntoFile.name}
                        </Typography>
                        <Button component="span" size="small" variant="text" color="success" sx={{ mt: 1, textTransform: 'none', fontWeight: 600 }}>
                          Cambiar archivo
                        </Button>
                      </>
                    ) : (
                      <>
                        <UploadFileIcon sx={{ fontSize: 48, color: adjuntoError ? '#ef4444' : '#3b82f6', mb: 1 }} />
                        <Typography sx={{ fontWeight: 700, color: adjuntoError ? '#991b1b' : '#1e3a8a', textAlign: 'center', mb: 0.5 }}>
                          {category === 'salud'
                            ? 'Subir soporte / constancia obligatorio'
                            : form.salida.duracionTipo !== 'menos_media_jornada'
                            ? 'Subir soporte / constancia (Opcional)'
                            : (['voto_jurado', 'voto_sufragante', 'jurado_votacion', 'sufragante'].includes(subtype)
                              ? 'Subir certificado obligatorio'
                              : (['urgencia_medica', 'otra'].includes(subtype) ? 'Subir soporte / constancia (Opcional)' : 'Subir soporte obligatorio'))}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: adjuntoError ? '#b91c1c' : '#475569', textAlign: 'center' }}>
                          {category === 'salud'
                            ? 'Adjunte PDF, imagen o pegue una captura con Ctrl+V. Si no cuenta con soporte en este momento, marque la declaracion anterior.'
                            : form.salida.duracionTipo !== 'menos_media_jornada'
                            ? 'Haga clic para adjuntar PDF, imagen o pegue una captura con Ctrl+V'
                            : (['voto_jurado', 'voto_sufragante', 'jurado_votacion', 'sufragante'].includes(subtype)
                              ? 'Haga clic para adjuntar su certificado electoral (PDF o imagen) o pegue una captura con Ctrl+V'
                              : (['urgencia_medica', 'otra'].includes(subtype)
                                  ? 'Haga clic para adjuntar soporte si ya lo tiene, o pegue una captura con Ctrl+V'
                                  : 'Haga clic para adjuntar PDF, imagen o pegue una captura con Ctrl+V'))}
                        </Typography>
                        <Button component="span" variant="contained" size="small" sx={{ mt: 2, textTransform: 'none', bgcolor: adjuntoError ? '#dc2626' : '#2563eb', boxShadow: 'none', fontWeight: 600 }}>
                          Seleccionar archivo
                        </Button>
                      </>
                    )}
                  </Box>
                  {adjuntoError && (
                    <Typography sx={{ color: '#d32f2f', fontSize: 13, fontWeight: 700, mt: 1, textAlign: 'center' }}>
                      {adjuntoError}
                    </Typography>
                  )}
                </Box>
              )}
              {!requiresViaticosFlow && form.salida.duracionTipo === 'menos_media_jornada' && subtype !== 'otra' && (
                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    sx={motivoInputSx}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    label={
                      subtype === 'terapias'
                        ? 'Diagnóstico de las terapias *'
                        : (subtype === 'diligencia_personal' ? 'Motivo / observación' : 'Motivo / observación *')
                    }
                    placeholder="Por favor describa de manera clara y detallada el motivo de su solicitud..."
                    value={form.salida.motivo}
                    onChange={(e) => update('salida', 'motivo', e.target.value)}
                  />
                  {form.salida.tipo === 'terapias' && (
                    <Tooltip
                      title="Registre el diagnóstico o condición de salud que origina el tratamiento terapéutico, de acuerdo con la información consignada por el profesional tratante o en la orden médica correspondiente."
                      arrow
                      placement="top"
                    >
                      <InfoIcon sx={{ color: '#0284c7', cursor: 'help' }} />
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>

            {shouldRequestReposicionHoras && (
              <Alert severity={form.salida.tiempoReponerHoras ? 'success' : 'warning'}>
                Tiempo solicitado: {parseInt(form.salida.tiempoReponerHoras || 0, 10)}h 00m
              </Alert>
            )}
            {salidaRangeIssue && <Alert severity="warning">{salidaRangeIssue}</Alert>}



            <Alert severity="info" icon={false} sx={{ mt: 1, '& .MuiAlert-message': { width: '100%' } }}>
              <Typography sx={{ fontSize: 13, color: '#0f172a', textAlign: 'center' }}>
                Al registrar esta solicitud, autoriza el tratamiento de sus datos de acuerdo a la <a href="https://www.unicesmag.edu.co/documentos/DATOS-UNICESMAG.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>Política de Tratamiento de Datos de UNICESMAG</a>.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', gap: 1, flexWrap: 'wrap' }}>
          {errorMessage && (
            <Alert severity="error" sx={{ width: '100%', mb: 1 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 13.5 }}>Error interno</Typography>
              {errorMessage}
            </Alert>
          )}
          {validationIssues.length > 0 && (
            <Alert severity="warning" sx={{ mr: 'auto', textAlign: 'left', alignItems: 'flex-start', maxWidth: { xs: '100%', md: 620 } }}>
              <Typography sx={{ fontWeight: 900, fontSize: 13, mb: 0.4 }}>No se puede registrar todavía</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {validationIssues.slice(0, 3).map((issue) => (
                  <Box component="li" key={issue} sx={{ fontSize: 12.5 }}>{issue}</Box>
                ))}
              </Box>
            </Alert>
          )}
          <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button variant="contained" onClick={submit} disabled={disableSubmit}>
            {submitting ? 'Radicando...' : 'Registrar solicitud'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 950, pb: 1 }}>Codigo QR del reporte de salida</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            El QR abre directamente este formato. Si la persona no ha iniciado sesion, primero ingresara con Google institucional y luego volvera al formulario.
          </Alert>
          <Box sx={{ display: 'grid', placeItems: 'center', p: 2, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
            {qrImageUrl && (
              <Box
                component="img"
                src={qrImageUrl}
                alt="Codigo QR para reporte de salida"
                sx={{ width: 260, height: 260, bgcolor: '#fff', borderRadius: 1.5 }}
              />
            )}
          </Box>
          <TextField
            fullWidth
            size="small"
            label="Enlace directo"
            value={directFormUrl}
            InputProps={{ readOnly: true }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button startIcon={<ContentCopyIcon />} onClick={copyDirectFormUrl}>
            {qrCopied ? 'Copiado' : 'Copiar enlace'}
          </Button>
          <Button
            component="a"
            href={qrImageUrl}
            target="_blank"
            rel="noreferrer"
            startIcon={<DownloadIcon />}
            variant="contained"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}
          >
            Exportar QR
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showSaludWarning} onClose={() => setShowSaludWarning(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#1e3a8a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LocalHospitalIcon sx={{ color: '#2563eb' }} />
          Importante: Condiciones de permisos por salud
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155', lineHeight: 1.6, fontSize: 14.5, mt: 1 }}>
            La información registrada en la categoría de <strong>Salud y Bienestar</strong> debe ser fidedigna.
            En cualquier momento, las áreas encargadas podrán realizar seguimiento y usted deberá aportar
            los documentos médicos que soporten esta solicitud.
            <br /><br />
            En caso de no poder verificar esta actuación, las áreas encargadas procederán de acuerdo a lo
            estipulado en el Reglamento Interno de Trabajo.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
          <Button onClick={() => setShowSaludWarning(false)} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 4, py: 1 }}>
            Entendido, continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showCalamidadWarning} onClose={() => setShowCalamidadWarning(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#7f1d1d', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InfoIcon sx={{ color: '#dc2626' }} />
          Grave calamidad doméstica
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155', lineHeight: 1.65, fontSize: 14.5, mt: 1 }}>
            Informar, por cualquier medio, al tiempo de ocurrir la situación que lo constituye, según lo permitan las circunstancias.
            <br /><br />
            Justificar con soportes hasta los dos (2) días hábiles siguientes a su reincorporación.
            <br /><br />
            La duración del permiso se determinará teniendo en cuenta el tiempo necesario para superar la calamidad.
            <br /><br />
            <strong>Reglamento Interno de Trabajo, artículo 37, numeral 3.</strong>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
          <Button onClick={() => setShowCalamidadWarning(false)} variant="contained" color="error" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 4, py: 1 }}>
            Entendido, continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showPersonalesWarning} onClose={() => setShowPersonalesWarning(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#1e3a8a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DirectionsWalkIcon sx={{ color: '#2563eb' }} />
          Importante: Reposición de tiempo
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155', lineHeight: 1.6, fontSize: 14.5, mt: 1 }}>
            Tenga en cuenta que los permisos otorgados bajo el motivo de <strong>Diligencia personal</strong> requieren plan de reposición de tiempo obligatorio.
            <br /><br />
            Usted deberá registrar un plan inicial de reposición en la parte inferior de este formulario, el cual será evaluado por su jefe inmediato para su respectiva aprobación y seguimiento.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
          <Button onClick={() => setShowPersonalesWarning(false)} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 4, py: 1 }}>
            Entendido, continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showPropiasCargoWarning} onClose={() => setShowPropiasCargoWarning(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#1e3a8a', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BusinessCenterIcon sx={{ color: '#2563eb' }} />
          Importante: Actividades propias del cargo
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155', lineHeight: 1.6, fontSize: 14.5, mt: 1 }}>
            Tenga en cuenta que esta categoría es exclusivamente para salidas relacionadas con funciones 
            inherentes a su rol, así como para el cumplimiento de labores <strong>académico-administrativas</strong>.
            <br /><br />
            Esta solicitud debe contar con la validación y autorización previa de su jefe inmediato.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
          <Button onClick={() => setShowPropiasCargoWarning(false)} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 4, py: 1 }}>
            Entendido, continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showSuccessModal} onClose={handleSuccessClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 3, textAlign: 'center' } }}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 100, mb: 2 }} />
          <Typography variant="h5" fontWeight="800" color="success.main" gutterBottom>
            ¡Solicitud Radicada con Éxito!
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: 16, mb: 3 }}>
            El reporte ha sido guardado correctamente y se enviará una notificación a su jefe inmediato para aprobación.
          </Typography>
          <Button onClick={handleSuccessClose} variant="contained" color="success" fullWidth sx={{ borderRadius: 2, fontWeight: 700, py: 1.5, fontSize: 16 }}>
            Cerrar y continuar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReporteSalidaFormDialog;

