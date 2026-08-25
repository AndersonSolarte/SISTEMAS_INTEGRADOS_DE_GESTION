import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  CircularProgress,
  Tooltip,
  MenuItem,
  Divider,
  Badge,
  Tabs,
  Tab,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UndoIcon from '@mui/icons-material/Undo';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PeopleIcon from '@mui/icons-material/People';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import MapIcon from '@mui/icons-material/Map';
import WarningIcon from '@mui/icons-material/Warning';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/Place';
import PaymentsIcon from '@mui/icons-material/Payments';
import GroupIcon from '@mui/icons-material/Group';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useAuth } from '../../context/AuthContext';
import cronogramaMovilidadService from '../../services/cronogramaMovilidadService';
import MatriculadosSelectorModal from './MatriculadosSelectorModal';
import ResponsablesSelectorModal from './ResponsablesSelectorModal';

const ALCANCE_OPTIONS = ['Regional', 'Nacional', 'Internacional'];

const PAISES_POPULARES = [
  'COLOMBIA', 'ESPAÑA', 'MÉXICO', 'ARGENTINA', 'CHILE', 'BRASIL', 'PERÚ',
  'ECUADOR', 'ESTADOS UNIDOS', 'FRANCIA', 'ALEMANIA', 'ITALIA', 'OTRO'
];

const DEPARTAMENTOS_MUNICIPIOS = {
  'Antioquia': ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Rionegro', 'Apartadó', 'Turbo', 'Caucasia', 'Chigorodó', 'Sabaneta', 'Caldas', 'Copacabana', 'La Estrella', 'Girardota', 'Marinilla', 'Guarne', 'El Carmen de Viboral', 'La Ceja', 'Santa Fe de Antioquia', 'Yarumal', 'OTRO'],
  'Arauca': ['Arauca', 'Arauquita', 'Cravo Norte', 'Fortul', 'Puerto Rondón', 'Saravena', 'Tame', 'OTRO'],
  'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa', 'Puerto Colombia', 'Galapa', 'Santo Tomás', 'Sabanagrande', 'Luruaco', 'Repelón', 'Usiacurí', 'Tubará', 'OTRO'],
  'Bolívar': ['Cartagena de Indias', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar', 'María La Baja', 'Mompox', 'San Jacinto', 'Turbaná', 'Villanueva', 'OTRO'],
  'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Villa de Leyva', 'Moniquirá', 'Puerto Boyacá', 'Guateque', 'Garagoa', 'Samacá', 'OTRO'],
  'Caldas': ['Manizales', 'La Dorada', 'Riosucio', 'Chinchiná', 'Villamaría', 'Anserma', 'Neira', 'Aguadas', 'Pensilvania', 'Supía', 'Salamina', 'OTRO'],
  'Caquetá': ['Florencia', 'Belén de los Andaquíes', 'Cartagena del Chairá', 'Currillo', 'El Doncello', 'El Paujil', 'Morelia', 'Puerto Rico', 'San José del Fraguas', 'San Vicente del Caguán', 'Solano', 'Solita', 'Valparaíso', 'OTRO'],
  'Casanare': ['Yopal', 'Aguazul', 'Tauramena', 'Villanueva', 'Paz de Ariporo', 'Monterrey', 'Maní', 'Hato Corozal', 'Orocué', 'OTRO'],
  'Cauca': ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía', 'Bolívar', 'Miranda', 'Corinto', 'Caloto', 'Cajibío', 'Silvia', 'Piendamó', 'OTRO'],
  'Cesar': ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Bosconia', 'La Paz', 'Curumaní', 'El Copey', 'San Alberto', 'Chiriguaná', 'OTRO'],
  'Chocó': ['Quibdó', 'Istmina', 'Condoto', 'Acandí', 'Bahía Solano', 'Nuquí', 'Riosucio', 'Tadó', 'El Carmen de Atrato', 'Bajo Baudó', 'OTRO'],
  'Córdoba': ['Montería', 'Cereté', 'Sahagún', 'Lorica', 'Montelíbano', 'Planeta Rica', 'Ciénaga de Oro', 'Tierralta', 'Chinú', 'San Andrés de Sotavento', 'OTRO'],
  'Cundinamarca': ['Bogotá D.C.', 'Soacha', 'Facatativá', 'Chía', 'Zipaquirá', 'Fusagasugá', 'Girardot', 'Mosquera', 'Madrid', 'Funza', 'Cajicá', 'Sopó', 'Tocancipá', 'Villeta', 'La Mesa', 'Ubaté', 'OTRO'],
  'Guainía': ['Inírida', 'Barrancominas', 'Mapiripana', 'San Felipe', 'Puerto Colombia', 'Pana Pana', 'OTRO'],
  'Guaviare': ['San José del Guaviare', 'Calamar', 'El Retorno', 'Miraflores', 'OTRO'],
  'Huila': ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre', 'San Agustín', 'Gigante', 'Acevedo', 'Rivera', 'OTRO'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'San Juan del Cesar', 'Fonseca', 'Barrancas', 'Manaure', 'Villanueva', 'Dibulla', 'OTRO'],
  'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato', 'Aracataca', 'Pivijay', 'San Sebastián de Buenavista', 'OTRO'],
  'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'Puerto Gaitán', 'San Martín', 'Cumaral', 'Restrepo', 'OTRO'],
  'Nariño': [
    'San Juan de Pasto', 'Ipiales', 'Tumaco', 'Túquerres', 'Samaniego', 'El Charco', 'Buesaco', 'La Unión', 'Barbacoas', 'Cumbal',
    'Guachucal', 'La Cruz', 'Puerres', 'Contadero', 'Córdoba', 'Cuaspud Carlosama', 'Aldana', 'Funes', 'Iles',
    'Imúes', 'Gualmatán', 'Ospina', 'Sapuyes', 'Yacuanquer', 'Consacá', 'Sandoná', 'Linares', 'Ancuyá', 'La Florida',
    'Chachagüí', 'Tangua', 'Ricaurte', 'Mallama', 'Providencia', 'Guaitarilla', 'El Tambo', 'El Peñol', 'Los Andes Sotomayor',
    'Cumbitara', 'Policarpa', 'El Rosario', 'Leiva', 'Taminango', 'San Lorenzo', 'Arboleda', 'San Bernardo', 'Berruecos',
    'Albán', 'Belén', 'Colón Génova', 'San Pedro de Cartago', 'San Pablo', 'Francisco Pizarro', 'Mosquera', 'Olaya Herrera',
    'La Tola', 'El Tablón de Gómez', 'Magüí Payán', 'Roberto Payán', 'Santa Bárbara', 'Santacruz Guachavés', 'OTRO'
  ],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Pamplona', 'Villa del Rosario', 'Los Patios', 'Tibú', 'Chínacota', 'El Zulia', 'OTRO'],
  'Putumayo': ['Mocoa', 'Orito', 'Puerto Asís', 'Puerto Leguízamo', 'Sibundoy', 'Valle del Guamuez', 'Villagarzón', 'San Francisco', 'OTRO'],
  'Quindío': ['Armenia', 'Calarcá', 'Tebaidá', 'Montenegro', 'Quimbaya', 'Circasia', 'Filandia', 'Salento', 'OTRO'],
  'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia', 'Belén de Umbría', 'Quinchía', 'Santuario', 'OTRO'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia', 'Santa Catalina', 'OTRO'],
  'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro', 'Barbosa', 'Málaga', 'Sabana de Torres', 'OTRO'],
  'Sucre': ['Sincelejo', 'Corozal', 'San Marcos', 'Tolú', 'Sampués', 'San Onofre', 'Morroa', 'OTRO'],
  'Tolima': ['Ibagué', 'Espinal', 'Melgar', 'Mariquita', 'Honda', 'Líbano', 'Chaparral', 'Guamo', 'Flandes', 'OTRO'],
  'Valle del Cauca': ['Cali', 'Buenaventura', 'Palmira', 'Tuluá', 'Cartago', 'Buga', 'Jamundí', 'Yumbo', 'Florida', 'Pradera', 'Zarzal', 'Sevilla', 'Caicedonia', 'OTRO'],
  'Vaupés': ['Mitú', 'Carurú', 'Taraira', 'Papacora', 'Yavaraté', 'OTRO'],
  'Vichada': ['Puerto Carreño', 'La Primavera', 'Santa Rosalía', 'Cumaribo', 'OTRO']
};

const DEPARTAMENTOS_POPULARES = Object.keys(DEPARTAMENTOS_MUNICIPIOS);

const getPdfFullUrl = (pdfPath) => {
  if (!pdfPath) return '#';
  if (pdfPath.startsWith('http')) return `${pdfPath}?t=${Date.now()}`;
  const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
  const url = `${baseUrl}${pdfPath.startsWith('/') ? '' : '/'}${pdfPath}`;
  return `${url}?t=${Date.now()}`;
};

const INITIAL_ACTIVIDAD = {
  fecha_salida: new Date().toISOString().split('T')[0],
  fecha_regreso: new Date().toISOString().split('T')[0],
  hora_salida: '07:00 AM',
  hora_regreso: '04:00 PM',
  requiere_viaticos: true,
  alojamiento: 'No requiere alojamiento',
  transporte: 'Terrestre Intermunicipal',
  funciones: '',
  alcance: 'Regional',
  pais: 'COLOMBIA',
  departamento: 'NARIÑO',
  municipio: 'San Juan de Pasto',
  localidad_texto: 'San Juan de Pasto - Nariño',
  contexto_practica: '',
  responsables: [],
  estudiantes: []
};

const CronogramaMovilidadModule = ({ initialPrograma = null }) => {
  const { user } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [cronogramas, setCronogramas] = useState([]);
  const [misActividades, setMisActividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCronograma, setActiveCronograma] = useState(null);
  const [openModalForm, setOpenModalForm] = useState(false);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [openDevolverDialog, setOpenDevolverDialog] = useState(false);
  const [observacionesDevolver, setObservacionesDevolver] = useState('');

  // Selector modals state
  const [openMatriculadosModal, setOpenMatriculadosModal] = useState(false);
  const [openResponsablesModal, setOpenResponsablesModal] = useState(false);
  const [activeActividadIdx, setActiveActividadIdx] = useState(null);

  // Form State
  const [formPrograma, setFormPrograma] = useState(initialPrograma || '');
  const [formFacultad, setFormFacultad] = useState('FACULTAD DE EDUCACIÓN');
  const [formAsunto, setFormAsunto] = useState('');
  const [formCuerpo, setFormCuerpo] = useState('');
  const [formCoordinador, setFormCoordinador] = useState('');
  const [formEmailCoord, setFormEmailCoord] = useState('');
  const [actividades, setActividades] = useState([{ ...INITIAL_ACTIVIDAD }]);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Filtros por Período Académico (Año e IP / IIP)
  const [filterAnio, setFilterAnio] = useState(new Date().getFullYear().toString());
  const [filterPeriodo, setFilterPeriodo] = useState('todos'); // 'todos', 'IP', 'IIP'
  const [filterSearch, setFilterSearch] = useState('');

  const getCronogramaAcademicMeta = useCallback((cron) => {
    const actDateStr = cron.actividades?.[0]?.fecha_salida || cron.radicado_at || cron.created_at;
    const date = actDateStr ? new Date(actDateStr) : new Date();
    const year = date.getFullYear().toString();
    const month = date.getMonth(); // 0 - 11
    const periodoCode = month <= 5 ? 'IP' : 'IIP';
    return { year, month, periodoCode, tag: `${year}-${periodoCode}` };
  }, []);

  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    cronogramas.forEach((cron) => {
      const meta = getCronogramaAcademicMeta(cron);
      if (meta.year) yearsSet.add(meta.year);
    });
    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear().toString());
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [cronogramas, getCronogramaAcademicMeta]);

  const filteredCronogramas = useMemo(() => {
    return cronogramas.filter((cron) => {
      if (initialPrograma && cron.programa_academico !== initialPrograma) {
        return false;
      }
      const meta = getCronogramaAcademicMeta(cron);

      if (filterAnio !== 'todos' && meta.year !== filterAnio) {
        return false;
      }
      if (filterPeriodo !== 'todos' && meta.periodoCode !== filterPeriodo) {
        return false;
      }
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase().trim();
        const prog = (cron.programa_academico || '').toLowerCase();
        const dir = (cron.nombre_director || '').toLowerCase();
        const idStr = `cron-${cron.id}`.toLowerCase();
        if (!prog.includes(q) && !dir.includes(q) && !idStr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [cronogramas, initialPrograma, filterAnio, filterPeriodo, filterSearch, getCronogramaAcademicMeta]);

  const isDirector = (user?.cargo && /director/i.test(user.cargo)) || (user?.dependencia && /licenciatura|programa/i.test(user.dependencia));
  const isAcademica = (user?.cargo && /academica/i.test(user.cargo)) || (user?.dependencia && /academica/i.test(user.dependencia)) || user?.role === 'administrador';
  const isFinanciera = (user?.cargo && /financier/i.test(user.cargo)) || (user?.dependencia && /financier/i.test(user.dependencia)) || user?.role === 'administrador';

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const resCron = await cronogramaMovilidadService.obtenerCronogramas();
      setCronogramas(resCron.cronogramas || []);
      const resMis = await cronogramaMovilidadService.misActividadesAsignadas();
      setMisActividades(resMis.actividades || []);
    } catch (err) {
      console.error('Error cargando cronogramas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cronId = params.get('cronogramaId') || params.get('id');
    if (cronId) {
      cronogramaMovilidadService.obtenerPorId(cronId)
        .then((res) => {
          if (res.cronograma) {
            setActiveCronograma(res.cronograma);
            setOpenDetailDialog(true);
          }
        })
        .catch((err) => console.error('Error cargando detalle cronograma desde URL:', err));
    }
  }, []);

  useEffect(() => {
    if (initialPrograma) {
      setFormPrograma(initialPrograma);
      if (user) {
        setFormCoordinador(user.nombre || '');
        setFormEmailCoord(user.email || '');
      }
    } else if (user) {
      setFormPrograma(user.dependencia || 'Licenciatura en Educación Infantil');
      setFormCoordinador(user.nombre || '');
      setFormEmailCoord(user.email || '');
    }
  }, [user, initialPrograma]);

  const handleOpenNuevoCronograma = () => {
    setActiveCronograma(null);
    setActividades([{ ...INITIAL_ACTIVIDAD }]);
    setFormAsunto(`Solicitud aprobación de cronograma de salidas práctica integral de movilidad ${formPrograma}`);
    setFormCuerpo('');
    setOpenModalForm(true);
  };

  const handleEditCronograma = (cron) => {
    setActiveCronograma(cron);
    setFormPrograma(cron.programa_academico);
    setFormFacultad(cron.facultad || 'FACULTAD DE EDUCACIÓN');
    setFormAsunto(cron.asunto_oficio || '');
    setFormCuerpo(cron.cuerpo_oficio || '');
    setFormCoordinador(cron.coordinador_practica || '');
    setFormEmailCoord(cron.email_coordinador || '');
    setActividades(cron.actividades && cron.actividades.length > 0 ? cron.actividades : [{ ...INITIAL_ACTIVIDAD }]);
    setOpenModalForm(true);
  };

  // Estado para Modal de Confirmación de Eliminación Institucional
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [cronogramaToDelete, setCronogramaToDelete] = useState(null);

  const handleRequestDeleteCronograma = (cron) => {
    setCronogramaToDelete(cron);
    setOpenDeleteConfirm(true);
  };

  const confirmDeleteCronograma = async () => {
    if (!cronogramaToDelete) return;
    try {
      await cronogramaMovilidadService.eliminarCronograma(cronogramaToDelete.id);
      setStatusMessage({ type: 'success', text: `El cronograma CRON-${cronogramaToDelete.id} fue eliminado exitosamente.` });
      cargarDatos();
    } catch (err) {
      console.error('Error al eliminar cronograma:', err);
      setStatusMessage({ type: 'error', text: err?.response?.data?.error || 'No se pudo eliminar el cronograma.' });
    } finally {
      setOpenDeleteConfirm(false);
      setCronogramaToDelete(null);
    }
  };

  const [expandedActivityIdx, setExpandedActivityIdx] = useState(0);

  const handleAddActividad = () => {
    const newIdx = actividades.length;
    setActividades([...actividades, { ...INITIAL_ACTIVIDAD }]);
    setExpandedActivityIdx(newIdx);
  };

  const handleRemoveActividad = (index) => {
    if (actividades.length === 1) return;
    const update = actividades.filter((_, idx) => idx !== index);
    setActividades(update);
    setExpandedActivityIdx(Math.max(0, index - 1));
  };

  const handleActividadChange = (index, field, value) => {
    const update = [...actividades];
    const act = update[index];
    act[field] = value;

    // Si cambia la fecha de salida, autocompletar automáticamente la fecha de regreso con la misma fecha
    if (field === 'fecha_salida') {
      act.fecha_regreso = value;
    }

    // Actualizar localidad_texto dinámicamente según alcance
    if (field === 'alcance' || field === 'pais' || field === 'departamento' || field === 'municipio') {
      if (act.alcance === 'Regional') {
        act.localidad_texto = `${act.municipio || 'Pasto'} - Nariño`;
      } else if (act.alcance === 'Nacional') {
        act.localidad_texto = `${act.municipio || 'Ciudad'} - ${act.departamento || 'Departamento'}`;
      } else if (act.alcance === 'Internacional') {
        act.localidad_texto = `${act.pais || 'País'}`;
      }
    }

    setActividades(update);
  };

  const handleOpenMatriculadosModal = (index) => {
    setActiveActividadIdx(index);
    setOpenMatriculadosModal(true);
  };

  const handleSelectEstudiantes = (estudiantesSeleccionados) => {
    if (activeActividadIdx !== null) {
      const update = [...actividades];
      update[activeActividadIdx].estudiantes = estudiantesSeleccionados;
      setActividades(update);
    }
  };

  const handleOpenResponsablesModal = (index) => {
    setActiveActividadIdx(index);
    setOpenResponsablesModal(true);
  };

  const handleSelectResponsables = (responsablesSeleccionados) => {
    if (activeActividadIdx !== null) {
      const update = [...actividades];
      update[activeActividadIdx].responsables = responsablesSeleccionados;
      setActividades(update);
    }
  };

  const handleGuardarBorrador = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const payload = {
        programa_academico: formPrograma,
        facultad: formFacultad,
        asunto_oficio: formAsunto,
        cuerpo_oficio: formCuerpo,
        coordinador_practica: formCoordinador,
        email_coordinador: formEmailCoord,
        actividades
      };

      if (activeCronograma?.id) {
        await cronogramaMovilidadService.actualizarCronograma(activeCronograma.id, payload);
      } else {
        await cronogramaMovilidadService.crearOBorrador(payload);
      }

      setStatusMessage({ type: 'success', text: 'Borrador guardado exitosamente' });
      setOpenModalForm(false);
      cargarDatos();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Error al guardar el borrador' });
    } finally {
      setSaving(false);
    }
  };

  const [formValidationErrors, setFormValidationErrors] = useState([]);

  const validateCronogramaParaRadicar = (acts) => {
    const issues = [];
    if (!formPrograma || !formPrograma.trim()) {
      issues.push('Debe indicar el Programa Académico.');
    }
    if (!formCoordinador || !formCoordinador.trim()) {
      issues.push('Debe indicar el Coordinador(a) de Práctica.');
    }
    if (!acts || acts.length === 0) {
      issues.push('Debe tener al menos una (1) Visita a Escenario de Práctica programada.');
      return issues;
    }

    acts.forEach((act, idx) => {
      const num = idx + 1;
      if (!act.entidad_destino || !act.entidad_destino.trim()) {
        issues.push(`Visita #${num}: Debe indicar la Entidad de Destino / Escenario de Práctica.`);
      }
      if (!act.fecha_salida || !act.fecha_regreso) {
        issues.push(`Visita #${num}: Debe seleccionar las fechas de salida y regreso.`);
      }
      if (!act.responsables || !Array.isArray(act.responsables) || act.responsables.length === 0) {
        issues.push(`Visita #${num}: Debe seleccionar al menos un (1) Tutor Responsable.`);
      }
      if (!act.estudiantes || !Array.isArray(act.estudiantes) || act.estudiantes.length === 0) {
        issues.push(`Visita #${num}: Debe asociar al menos un (1) Estudiante en Práctica Formativa.`);
      }
    });

    return issues;
  };

  const handleRadicar = async (cronId) => {
    const valErrors = validateCronogramaParaRadicar(actividades);
    if (valErrors.length > 0) {
      setFormValidationErrors(valErrors);
      return;
    }
    setFormValidationErrors([]);
    setSaving(true);
    setStatusMessage(null);
    try {
      const targetId = cronId || activeCronograma?.id;
      if (!targetId) {
        // Guardar primero y luego radicar
        const payload = {
          programa_academico: formPrograma,
          facultad: formFacultad,
          asunto_oficio: formAsunto,
          cuerpo_oficio: formCuerpo,
          coordinador_practica: formCoordinador,
          email_coordinador: formEmailCoord,
          actividades
        };
        const created = await cronogramaMovilidadService.crearOBorrador(payload);
        await cronogramaMovilidadService.radicarCronograma(created.cronograma.id);
      } else {
        await cronogramaMovilidadService.radicarCronograma(targetId);
      }

      setStatusMessage({ type: 'success', text: 'Cronograma radicado exitosamente. Se ha notificado a la Vicerrectoría Académica.' });
      setOpenModalForm(false);
      setOpenDetailDialog(false);
      cargarDatos();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Error al radicar el cronograma' });
    } finally {
      setSaving(false);
    }
  };

  const handleVistoBuenoAcademica = async (id) => {
    setSaving(true);
    try {
      await cronogramaMovilidadService.vistoBuenoAcademica(id);
      setStatusMessage({ type: 'success', text: 'Visto bueno concedido exitosamente y remitido a Vicerrectoría Financiera.' });
      setOpenDetailDialog(false);
      cargarDatos();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Error otorgando visto bueno' });
    } finally {
      setSaving(false);
    }
  };

  const handleAprobarFinanciera = async (id) => {
    setSaving(true);
    try {
      await cronogramaMovilidadService.aprobarFinanciera(id);
      setStatusMessage({ type: 'success', text: 'Cronograma aprobado satisfactoriamente. Las actividades se han activado.' });
      setOpenDetailDialog(false);
      cargarDatos();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Error aprobando cronograma' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDevolver = async () => {
    if (!observacionesDevolver.trim()) return;
    setSaving(true);
    try {
      await cronogramaMovilidadService.devolverACorreccion(activeCronograma.id, observacionesDevolver);
      setStatusMessage({ type: 'warning', text: 'Cronograma devuelto a corrección del Director de Programa.' });
      setOpenDevolverDialog(false);
      setOpenDetailDialog(false);
      cargarDatos();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.error || 'Error devolviendo a corrección' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarCumplida = async (actId) => {
    try {
      await cronogramaMovilidadService.marcarActividadCumplida(actId);
      setStatusMessage({ type: 'success', text: 'Actividad marcada como cumplida.' });
      cargarDatos();
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Error al marcar actividad como cumplida' });
    }
  };

  const renderStatusChip = (estado) => {
    const configs = {
      borrador: { label: 'Borrador', color: 'default' },
      radicado: { label: 'Radicado', color: 'info' },
      en_revision_academica: { label: 'En Revisión Académica', color: 'primary' },
      en_revision_financiera: { label: 'En Revisión Financiera', color: 'warning' },
      devuelto_correccion: { label: 'Devuelto a Corrección', color: 'error' },
      aprobado: { label: 'Aprobado Institucionalmente', color: 'success' },
      cumplido: { label: 'Cumplido Totalmente', color: 'success' }
    };
    const conf = configs[estado] || { label: estado, color: 'default' };
    return <Chip label={conf.label} color={conf.color} size="small" sx={{ fontWeight: 'bold' }} />;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Banner Titulo */}
      <Card sx={{ mb: 3, borderRadius: 3, background: 'linear-gradient(135deg, #1e3a8a 0%, #0f766e 100%)', color: '#fff', boxShadow: '0 8px 24px rgba(30, 58, 138, 0.25)' }}>
        <CardContent sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.5 }}>
              Cronogramas de Práctica Integral de Movilidad
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Gestión, parametrización de actividades por programa, vinculación con base de matriculados y flujo de visto bueno institucional.
            </Typography>
          </Box>

          {(isDirector || user?.role === 'administrador') && (
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={handleOpenNuevoCronograma}
              sx={{
                bgcolor: '#22c55e',
                color: '#064e3b',
                fontWeight: 800,
                fontSize: '0.95rem',
                px: 3,
                py: 1.2,
                borderRadius: 2.5,
                textTransform: 'none',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
                '&:hover': { bgcolor: '#16a34a', color: '#fff' }
              }}
            >
              CRONOGRAMA DE PRÁCTICA INTEGRAL DE MOVILIDAD
            </Button>
          )}
        </CardContent>
      </Card>

      {statusMessage && (
        <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 3, borderRadius: 2 }}>
          {statusMessage.text}
        </Alert>
      )}

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)} textColor="primary" indicatorColor="primary">
          <Tab icon={<AssignmentIcon />} label="Cronogramas de Programa" iconPosition="start" sx={{ fontWeight: 'bold' }} />
          <Tab icon={<CheckCircleIcon />} label={`Mis Actividades Asignadas (${misActividades.length})`} iconPosition="start" sx={{ fontWeight: 'bold' }} />
        </Tabs>
      </Box>

      {/* Tab 0: Cronogramas Lista */}
      {tabIndex === 0 && (
        <Box>
          {/* BARRA DE FILTROS POR PERÍODO ACADÉMICO */}
          <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#f8fafc' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Año Académico"
                  value={filterAnio}
                  onChange={(e) => setFilterAnio(e.target.value)}
                  sx={{ bgcolor: '#fff' }}
                >
                  <MenuItem value="todos">Todos los Años</MenuItem>
                  {availableYears.map((yr) => (
                    <MenuItem key={yr} value={yr}>
                      Año {yr}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={4} md={3.5}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Período Académico"
                  value={filterPeriodo}
                  onChange={(e) => setFilterPeriodo(e.target.value)}
                  sx={{ bgcolor: '#fff' }}
                >
                  <MenuItem value="todos">Todos los Períodos</MenuItem>
                  <MenuItem value="IP">Periodo IP</MenuItem>
                  <MenuItem value="IIP">Periodo IIP</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={4} md={3.5}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar por programa, director o ID..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{ bgcolor: '#fff' }}
                />
              </Grid>

              <Grid item xs={12} md={2} sx={{ textAlign: { md: 'right' } }}>
                <Chip
                  label={`${filteredCronogramas.length} Cronograma(s)`}
                  color="primary"
                  sx={{ fontWeight: 900, px: 1 }}
                />
              </Grid>
            </Grid>
          </Paper>

          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <CardContent>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
              ) : filteredCronogramas.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <SchoolIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 1 }} />
                  <Typography variant="h6" color="text.secondary">No se encontraron cronogramas para el filtro seleccionado</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Ajusta los filtros de Año / Período Académico o presiona "CRONOGRAMA DE PRÁCTICA INTEGRAL DE MOVILIDAD" para crear uno nuevo.
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} elevation={0}>
                  <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>ID / Programa / Período</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Director Responsable</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Actividades</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Oficio PDF</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCronogramas.map((cron) => {
                        const meta = getCronogramaAcademicMeta(cron);
                        return (
                          <TableRow key={cron.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                                  CRON-{cron.id} | {cron.programa_academico}
                                </Typography>
                                <Chip
                                  label={`Período ${meta.tag}`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ fontWeight: 800, height: 22, fontSize: 11 }}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                Radicado: {new Date(cron.created_at).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{cron.nombre_director}</Typography>
                          <Typography variant="caption" color="text.secondary">{cron.email_director}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={`${(cron.actividades || []).length} Actividad(es)`} size="small" variant="outlined" color="primary" />
                        </TableCell>
                        <TableCell>{renderStatusChip(cron.estado)}</TableCell>
                        <TableCell>
                          {cron.pdf_oficio_path ? (
                            <Button
                              size="small"
                              startIcon={<PictureAsPdfIcon color="error" />}
                              component="a"
                              href={getPdfFullUrl(cron.pdf_oficio_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ver Oficio
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No generado</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip
                              title="Ver detalle y revisión del oficio"
                              arrow
                              placement="top"
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: '#0f172a',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    py: 0.7,
                                    px: 1.4,
                                    borderRadius: 2,
                                    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.25)',
                                    textAlign: 'center'
                                  }
                                },
                                arrow: { sx: { color: '#0f172a' } }
                              }}
                            >
                              <IconButton color="primary" onClick={() => { setActiveCronograma(cron); setOpenDetailDialog(true); }}>
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>

                            {/* BOTÓN EDITAR: Vicerrectoría Académica en cualquier estado | Director solo en Borrador/Devuelto */}
                            {(isAcademica || (isDirector && (cron.estado === 'borrador' || cron.estado === 'devuelto_correccion'))) && (
                              <Tooltip
                                title={isAcademica ? "Editar datos y fechas (Vicerrectoría Académica)" : "Editar y corregir cronograma borrador"}
                                arrow
                                placement="top"
                                componentsProps={{
                                  tooltip: {
                                    sx: {
                                      bgcolor: '#0f172a',
                                      color: '#ffffff',
                                      fontWeight: 700,
                                      fontSize: '0.72rem',
                                      py: 0.7,
                                      px: 1.4,
                                      borderRadius: 2,
                                      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.25)',
                                      textAlign: 'center'
                                    }
                                  },
                                  arrow: { sx: { color: '#0f172a' } }
                                }}
                              >
                                <IconButton color="secondary" onClick={() => handleEditCronograma(cron)}>
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* BOTÓN ELIMINAR: Vicerrectoría Académica en cualquier estado | Director solo si está en Borrador */}
                            {(isAcademica || (isDirector && cron.estado === 'borrador')) && (
                              <Tooltip
                                title={isAcademica ? "Eliminar cronograma (Vicerrectoría Académica)" : "Eliminar borrador"}
                                arrow
                                placement="top"
                                componentsProps={{
                                  tooltip: {
                                    sx: {
                                      bgcolor: '#991b1b',
                                      color: '#ffffff',
                                      fontWeight: 700,
                                      fontSize: '0.72rem',
                                      py: 0.7,
                                      px: 1.4,
                                      borderRadius: 2,
                                      boxShadow: '0 6px 18px rgba(153, 27, 27, 0.3)',
                                      textAlign: 'center'
                                    }
                                  },
                                  arrow: { sx: { color: '#991b1b' } }
                                }}
                              >
                                <IconButton color="error" onClick={() => handleRequestDeleteCronograma(cron)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* BOTÓN RADICAR: Director en Borrador o Devuelto */}
                            {(cron.estado === 'borrador' || cron.estado === 'devuelto_correccion') && (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<SendIcon />}
                                onClick={() => handleRadicar(cron.id)}
                                sx={{ ml: 1, textTransform: 'none', fontWeight: 'bold' }}
                              >
                                Radicar
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
        </Box>
      )}

      {/* Tab 1: Mis Actividades Asignadas */}
      {tabIndex === 1 && (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            {misActividades.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <CheckCircleIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 1 }} />
                <Typography variant="h6" color="text.secondary">No tienes actividades asignadas actualmente</Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {misActividades.map((act) => (
                  <Grid item xs={12} md={6} key={act.id_actividad}>
                    <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: '#cbd5e1', '&:hover': { borderColor: '#2563eb' } }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Chip label={act.alcance || 'Regional'} color="primary" size="small" />
                          <Typography variant="caption" color="text.secondary">
                            {act.fecha_salida} al {act.fecha_regreso}
                          </Typography>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e3a8a', mb: 1 }}>
                          {act.contexto_practica || 'Escenario de Práctica'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Localidad:</strong> {act.localidad_texto}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          <strong>Funciones:</strong> {act.funciones}
                        </Typography>

                        <Divider sx={{ my: 1.5 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Estudiantes en Práctica Formativa: {(act.estudiantes || []).length}
                            </Typography>
                          </Box>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleMarcarCumplida(act.id_actividad)}
                          >
                            Marcar Cumplida
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Formulario de Creación / Edición */}
      <Dialog
        open={openModalForm}
        onClose={() => setOpenModalForm(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, width: '95vw', maxWidth: '1500px', maxHeight: '92vh' }
        }}
      >
        <DialogTitle sx={{ bgcolor: '#1e3a8a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, px: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '0.02em' }}>
            CRONOGRAMA DE PRÁCTICA INTEGRAL DE MOVILIDAD
          </Typography>
          <IconButton onClick={() => setOpenModalForm(false)} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
          {formValidationErrors.length > 0 && (
            <Alert severity="error" onClose={() => setFormValidationErrors([])} sx={{ mb: 2.5, borderRadius: 2, border: '1px solid #fca5a5' }}>
              <AlertTitle sx={{ fontWeight: 800 }}>No se puede radicar el cronograma todavía:</AlertTitle>
              <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                {formValidationErrors.map((err, i) => (
                  <li key={i} style={{ fontWeight: 700, fontSize: '0.85rem' }}>{err}</li>
                ))}
              </ul>
            </Alert>
          )}

          {activeCronograma?.observaciones_correccion && (
            <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
              <AlertTitle sx={{ fontWeight: 800 }}>Observaciones de Corrección Registradas:</AlertTitle>
              {activeCronograma.observaciones_correccion}
            </Alert>
          )}

          {/* DATOS GENERALES DEL OFICIO */}
          <Paper elevation={0} sx={{ p: 1.75, mb: 2, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #cbd5e1', width: '100%' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon sx={{ fontSize: 20, color: '#1e3a8a' }} /> Informes Generales del Programa y Coordinación
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 1.5, width: '100%' }}>
              <TextField
                fullWidth
                size="small"
                label="Programa Académico *"
                value={formPrograma}
                onChange={(e) => setFormPrograma(e.target.value)}
                required
                sx={{ bgcolor: '#fff' }}
              />
              <TextField
                fullWidth
                size="small"
                label="Facultad *"
                value={formFacultad}
                onChange={(e) => setFormFacultad(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              />
              <TextField
                fullWidth
                size="small"
                label="Coordinador(a) de Práctica *"
                value={formCoordinador}
                onChange={(e) => setFormCoordinador(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              />
              <TextField
                fullWidth
                size="small"
                label="Correo del Coordinador(a) *"
                value={formEmailCoord}
                onChange={(e) => setFormEmailCoord(e.target.value)}
                sx={{ bgcolor: '#fff' }}
              />
            </Box>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.75 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon sx={{ color: '#1e3a8a', fontSize: 20 }} /> Visitas a Escenarios de Práctica Programadas ({actividades.length})
            </Typography>
            <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />} onClick={handleAddActividad} sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 1.75, py: 0.75 }}>
              Agregar Otra Visita
            </Button>
          </Box>

          {actividades.map((act, idx) => {
            const isExpanded = expandedActivityIdx === idx;
            return (
              <Accordion
                key={idx}
                expanded={isExpanded}
                onChange={(_, expanded) => setExpandedActivityIdx(expanded ? idx : false)}
                sx={{
                  mb: 1.75,
                  borderRadius: '10px !important',
                  border: isExpanded ? '1.5px solid #2563eb' : '1.5px solid #cbd5e1',
                  boxShadow: isExpanded ? '0 4px 14px rgba(37, 99, 235, 0.08)' : '0 2px 4px rgba(0,0,0,0.02)',
                  '&:before': { display: 'none' },
                  overflow: 'hidden'
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: isExpanded ? '#1e3a8a' : '#64748b' }} />}
                  sx={{
                    bgcolor: isExpanded ? '#eff6ff' : '#ffffff',
                    borderBottom: isExpanded ? '1.5px solid #bfdbfe' : 'none',
                    py: 0.75,
                    px: 2,
                    minHeight: '44px !important',
                    '& .MuiAccordionSummary-content': { my: '6px !important' },
                    '&:hover': { bgcolor: isExpanded ? '#eff6ff' : '#f8fafc' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1, flexWrap: 'wrap', gap: 1.2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                      <Chip
                        label={`VISITA ESCENARIO DE PRÁCTICA #${idx + 1}`}
                        color={isExpanded ? "primary" : "default"}
                        sx={{ fontWeight: 800, fontSize: '0.78rem', height: 26, px: 0.5 }}
                      />

                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.88rem' }}>
                        {act.entidad_destino ? act.entidad_destino : (act.municipio ? `${act.municipio} (${act.alcance || 'Regional'})` : 'Nueva Actividad')}
                      </Typography>

                      <Chip
                        icon={<EventIcon sx={{ fontSize: '0.88rem !important', color: '#1e3a8a' }} />}
                        label={`${act.fecha_salida || 'Sin fecha'} (${act.hora_salida || '07:00 AM'})`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600, bgcolor: '#fff', borderColor: '#cbd5e1', height: 24, fontSize: '0.75rem' }}
                      />

                      {act.requiere_viaticos !== false && (
                        <Chip
                          icon={<PaymentsIcon sx={{ fontSize: '0.88rem !important', color: '#0284c7' }} />}
                          label="Con Viáticos"
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ fontWeight: 700, height: 24, fontSize: '0.75rem' }}
                        />
                      )}
                    </Box>

                    {actividades.length > 1 && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveActividad(idx);
                        }}
                        sx={{ ml: 'auto', p: 0.5 }}
                        title="Eliminar esta actividad"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ p: 2, bgcolor: '#ffffff' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
                    
                    {/* SECCIÓN 1: Fechas y Horarios de la Movilidad */}
                    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', width: '100%' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.88rem' }}>
                        <EventIcon sx={{ fontSize: 18, color: '#1e3a8a' }} /> 1. Fechas y Horarios de la Movilidad
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 1.5, width: '100%' }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="FECHA DE SALIDA *"
                          InputLabelProps={{ shrink: true }}
                          value={act.fecha_salida}
                          onChange={(e) => handleActividadChange(idx, 'fecha_salida', e.target.value)}
                          sx={{ bgcolor: '#fff' }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label="FECHA DE REGRESO *"
                          InputLabelProps={{ shrink: true }}
                          value={act.fecha_regreso}
                          onChange={(e) => handleActividadChange(idx, 'fecha_regreso', e.target.value)}
                          sx={{ bgcolor: '#fff' }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="HORA SALIDA PREVISTA *"
                          placeholder="Ej: 07:00 AM"
                          value={act.hora_salida !== undefined ? act.hora_salida : '07:00 AM'}
                          onChange={(e) => handleActividadChange(idx, 'hora_salida', e.target.value)}
                          sx={{ bgcolor: '#fff' }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="HORA REGRESO PREVISTA *"
                          placeholder="Ej: 04:00 PM"
                          value={act.hora_regreso !== undefined ? act.hora_regreso : '04:00 PM'}
                          onChange={(e) => handleActividadChange(idx, 'hora_regreso', e.target.value)}
                          sx={{ bgcolor: '#fff' }}
                        />
                      </Box>
                    </Paper>

                    {/* SECCIÓN 2: Destino y Entidad Receptora */}
                    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', width: '100%' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.88rem' }}>
                        <PlaceIcon sx={{ fontSize: 18, color: '#1e3a8a' }} /> 2. Destino y Entidad Receptora
                      </Typography>
                      
                      {act.alcance === 'Regional' && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 2fr' }, gap: 1.5, width: '100%' }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Alcance de Movilidad *"
                            value={act.alcance}
                            onChange={(e) => handleActividadChange(idx, 'alcance', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {ALCANCE_OPTIONS.map((opt) => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Municipio (Nariño) *"
                            value={act.municipio || 'San Juan de Pasto'}
                            onChange={(e) => handleActividadChange(idx, 'municipio', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {(DEPARTAMENTOS_MUNICIPIOS['Nariño'] || []).map((muni) => (
                              <MenuItem key={muni} value={muni}>{muni}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            fullWidth
                            size="small"
                            label="ENTIDAD DE DESTINO / ESCENARIO DE PRÁCTICA *"
                            placeholder="Ej: Institución Educativa Rural de Ipiaes, Hospital San Pedro"
                            value={act.entidad_destino || ''}
                            onChange={(e) => handleActividadChange(idx, 'entidad_destino', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          />
                        </Box>
                      )}

                      {act.alcance === 'Nacional' && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr' }, gap: 1.5, width: '100%' }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Alcance de Movilidad *"
                            value={act.alcance}
                            onChange={(e) => handleActividadChange(idx, 'alcance', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {ALCANCE_OPTIONS.map((opt) => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Departamento *"
                            value={act.departamento && act.departamento !== 'Nariño' && act.departamento !== 'NARIÑO' ? act.departamento : 'Cauca'}
                            onChange={(e) => {
                              const newDep = e.target.value;
                              const firstMuni = (DEPARTAMENTOS_MUNICIPIOS[newDep] || [])[0] || 'Ciudad';
                              const update = [...actividades];
                              update[idx].departamento = newDep;
                              update[idx].municipio = firstMuni;
                              update[idx].localidad_texto = `${firstMuni} - ${newDep}`;
                              setActividades(update);
                            }}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {Object.keys(DEPARTAMENTOS_MUNICIPIOS).filter(d => d !== 'Nariño').map((dep) => (
                              <MenuItem key={dep} value={dep}>{dep}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Municipio Destino *"
                            value={act.municipio || ((DEPARTAMENTOS_MUNICIPIOS[act.departamento] || DEPARTAMENTOS_MUNICIPIOS['Cauca'])[0])}
                            onChange={(e) => handleActividadChange(idx, 'municipio', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {(DEPARTAMENTOS_MUNICIPIOS[act.departamento] || DEPARTAMENTOS_MUNICIPIOS['Cauca']).map((muni) => (
                              <MenuItem key={muni} value={muni}>{muni}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            fullWidth
                            size="small"
                            label="ENTIDAD DE DESTINO / ESCENARIO DE PRÁCTICA *"
                            placeholder="Ej: Institución Educativa Rural de Ipiaes, Hospital San Pedro"
                            value={act.entidad_destino || ''}
                            onChange={(e) => handleActividadChange(idx, 'entidad_destino', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          />
                        </Box>
                      )}

                      {act.alcance === 'Internacional' && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr' }, gap: 1.5, width: '100%' }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Alcance de Movilidad *"
                            value={act.alcance}
                            onChange={(e) => handleActividadChange(idx, 'alcance', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {ALCANCE_OPTIONS.map((opt) => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="País Destino *"
                            value={act.pais || 'ECUADOR'}
                            onChange={(e) => handleActividadChange(idx, 'pais', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          >
                            {PAISES_POPULARES.map((p) => (
                              <MenuItem key={p} value={p}>{p}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            fullWidth
                            size="small"
                            label="Ciudad Internacional *"
                            placeholder="Ej: Quito, Lima, Madrid"
                            value={act.municipio || ''}
                            onChange={(e) => handleActividadChange(idx, 'municipio', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          />
                          <TextField
                            fullWidth
                            size="small"
                            label="ENTIDAD DE DESTINO / ESCENARIO DE PRÁCTICA *"
                            placeholder="Ej: Universidad de Barcelona"
                            value={act.entidad_destino || ''}
                            onChange={(e) => handleActividadChange(idx, 'entidad_destino', e.target.value)}
                            sx={{ bgcolor: '#fff' }}
                          />
                        </Box>
                      )}
                    </Paper>

                    {/* SECCIÓN 3: Contexto y Objetivos Misionales */}
                    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', width: '100%' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.88rem' }}>
                        <AssignmentIcon sx={{ fontSize: 18, color: '#1e3a8a' }} /> 3. Contexto y Objetivos Misionales
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, width: '100%' }}>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          size="small"
                          label="CONTEXTO DE LA PRÁCTICA DE MOVILIDAD *"
                          placeholder="Describa el escenario, la justificación académica y el propósito de la visita..."
                          value={act.contexto_practica}
                          onChange={(e) => handleActividadChange(idx, 'contexto_practica', e.target.value)}
                          sx={{ bgcolor: '#fff' }}
                        />
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          size="small"
                          label="FUNCIONES Y OBJETIVOS MISIONALES *"
                          placeholder="Describa las actividades, compromisos y tareas a desarrollar..."
                          value={act.funciones}
                          onChange={(e) => handleActividadChange(idx, 'funciones', e.target.value)}
                          sx={{ bgcolor: '#fff' }}
                        />
                      </Box>
                    </Paper>

                    {/* SECCIÓN 4: Logística y Viáticos Pre-Autorizados */}
                    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f0f9ff', borderRadius: 2, border: '1.5px solid #bae6fd', width: '100%' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0369a1', mb: 1, display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.88rem' }}>
                        <PaymentsIcon sx={{ fontSize: 18, color: '#0369a1' }} /> 4. Logística y Viáticos Pre-Autorizados
                      </Typography>
                      
                      {act.requiere_viaticos === false ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', width: '100%' }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="¿Requiere Viáticos? *"
                            value="no"
                            onChange={(e) => handleActividadChange(idx, 'requiere_viaticos', e.target.value === 'si')}
                            sx={{ bgcolor: '#fff' }}
                          >
                            <MenuItem value="si">Sí (Aplica Viáticos)</MenuItem>
                            <MenuItem value="no">No requiere Viáticos</MenuItem>
                          </TextField>
                        </Box>
                      ) : (() => {
                        const stdTransporte = ['Terrestre Intermunicipal', 'Vehículo Institucional UNICESMAG', 'Aéreo Nacional', 'Aéreo Internacional', 'Urbano / Local'];
                        const isOtroTransporte = !stdTransporte.includes(act.transporte);

                        const gridCols = isOtroTransporte
                          ? { xs: '1fr', md: '1.2fr 2fr 2.4fr' }
                          : { xs: '1fr', md: '1.2fr 3fr' };

                        return (
                          <Box sx={{ display: 'grid', gridTemplateColumns: gridCols, gap: 1.2, width: '100%', alignItems: 'center' }}>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              label="¿Requiere Viáticos? *"
                              value="si"
                              onChange={(e) => handleActividadChange(idx, 'requiere_viaticos', e.target.value === 'si')}
                              sx={{ bgcolor: '#fff' }}
                            >
                              <MenuItem value="si">Sí (Aplica Viáticos)</MenuItem>
                              <MenuItem value="no">No requiere Viáticos</MenuItem>
                            </TextField>

                            <TextField
                              select
                              fullWidth
                              size="small"
                              label="Transporte Pre-Autorizado *"
                              value={isOtroTransporte ? 'Otro' : act.transporte}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleActividadChange(idx, 'transporte', val === 'Otro' ? '' : val);
                              }}
                              sx={{ bgcolor: '#fff' }}
                            >
                              <MenuItem value="Terrestre Intermunicipal">Terrestre Intermunicipal</MenuItem>
                              <MenuItem value="Vehículo Institucional UNICESMAG">Vehículo Institucional UNICESMAG</MenuItem>
                              <MenuItem value="Aéreo Nacional">Aéreo Nacional</MenuItem>
                              <MenuItem value="Aéreo Internacional">Aéreo Internacional</MenuItem>
                              <MenuItem value="Urbano / Local">Urbano / Local</MenuItem>
                              <MenuItem value="Otro">Otro (Especificar)</MenuItem>
                            </TextField>

                            {isOtroTransporte && (
                              <TextField
                                fullWidth
                                size="small"
                                label="Especificar Transporte *"
                                placeholder="Ej: Chiva / Lancha / Colectivo..."
                                value={stdTransporte.includes(act.transporte) ? '' : act.transporte}
                                onChange={(e) => handleActividadChange(idx, 'transporte', e.target.value)}
                                sx={{ bgcolor: '#fff' }}
                              />
                            )}
                          </Box>
                        );
                      })()}
                    </Paper>

                    {/* SECCIÓN 5: Participantes Asignados */}
                    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', width: '100%' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1, display: 'flex', alignItems: 'center', gap: 0.8, fontSize: '0.88rem' }}>
                        <GroupIcon sx={{ fontSize: 18, color: '#1e3a8a' }} /> 5. Asignación de Tutores y Estudiantes
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, width: '100%' }}>
                        <Box sx={{ p: 1.25, border: '1.5px dashed #0f766e', borderRadius: 2, bgcolor: '#f0fdf4' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f766e', fontSize: '0.82rem' }}>
                              Tutor(es) Responsable(s): {(act.responsables || []).length}
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<SupervisorAccountIcon />}
                              onClick={() => handleOpenResponsablesModal(idx)}
                              sx={{ bgcolor: '#0f766e', color: '#fff', '&:hover': { bgcolor: '#0d9488' }, textTransform: 'none', fontWeight: 700, py: 0.25, fontSize: '0.75rem' }}
                            >
                              Seleccionar Tutores
                            </Button>
                          </Box>
                          {(act.responsables || []).length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                              {act.responsables.map((r, rIdx) => (
                                <Chip key={rIdx} label={r.nombre || r.email} size="small" color="success" sx={{ fontWeight: 600, height: 22, fontSize: '0.72rem' }} />
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">Ningún tutor seleccionado aún</Typography>
                          )}
                        </Box>

                        <Box sx={{ p: 1.25, border: '1.5px dashed #1e3a8a', borderRadius: 2, bgcolor: '#eff6ff' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.82rem' }}>
                              Estudiantes en Práctica Formativa: {(act.estudiantes || []).length}
                            </Typography>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<PeopleIcon />}
                              onClick={() => handleOpenMatriculadosModal(idx)}
                              sx={{ bgcolor: '#1e3a8a', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, py: 0.25, fontSize: '0.75rem' }}
                            >
                              Asociar Matriculados
                            </Button>
                          </Box>
                          {(act.estudiantes || []).length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                              {act.estudiantes.map((e, eIdx) => (
                                <Chip key={eIdx} label={`${e.nombre_completo} (${e.codigo_estudiante || e.numero_documento})`} size="small" color="primary" sx={{ fontWeight: 600, height: 22, fontSize: '0.72rem' }} />
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">Ningún estudiante seleccionado aún</Typography>
                          )}
                        </Box>
                      </Box>
                    </Paper>

                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: '#f8fafc' }}>
          <Button onClick={() => setOpenModalForm(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleGuardarBorrador} variant="outlined" color="primary" disabled={saving}>
            Guardar Borrador
          </Button>
          <Button onClick={() => handleRadicar()} variant="contained" color="success" startIcon={<SendIcon />} disabled={saving}>
            Radicar Cronograma
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Detalle y Aprobación Institucional */}
      {activeCronograma && (
        <Dialog
          open={openDetailDialog}
          onClose={() => setOpenDetailDialog(false)}
          maxWidth="lg"
          fullWidth
          scroll="paper"
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.22)',
              overflow: 'hidden'
            }
          }}
        >
          <DialogTitle sx={{ bgcolor: '#1e3a8a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.8, px: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
              Revisión de Cronograma CRON-{activeCronograma.id} | {activeCronograma.programa_academico}
            </Typography>
            <IconButton onClick={() => setOpenDetailDialog(false)} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Estado Actual:</Typography>
              {renderStatusChip(activeCronograma.estado)}
            </Box>

            {activeCronograma.observaciones_correccion && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <AlertTitle>Observaciones de Corrección:</AlertTitle>
                {activeCronograma.observaciones_correccion}
              </Alert>
            )}

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, overflowX: 'auto', borderRadius: 2 }}>
              <Table size="small" sx={{ minWidth: 850 }}>
                <TableHead sx={{ bgcolor: '#1e3a8a' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>Fechas y Horarios</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>Destino / Entidad Receptora</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>Logística y Viáticos</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>Funciones y Objetivos</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>Contexto de Práctica</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>Tutores Responsables</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>Estudiantes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(activeCronograma.actividades || []).map((act, i) => (
                    <TableRow key={i} sx={{ bgcolor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <Box sx={{ fontWeight: 700, color: '#1e3a8a' }}>📅 {act.fecha_salida} a {act.fecha_regreso}</Box>
                        <Box sx={{ fontSize: '0.75rem', color: '#64748b' }}>⏰ {act.hora_salida || '07:00 AM'} - {act.hora_regreso || '04:00 PM'}</Box>
                      </TableCell>

                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        <Box sx={{ fontWeight: 700, color: '#0f172a' }}>{act.entidad_destino || 'No especificada'}</Box>
                        <Box sx={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {act.localidad_texto} ({act.alcance || 'Regional'})</Box>
                      </TableCell>

                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {act.requiere_viaticos === false ? (
                          <Chip label="Sin Viáticos" size="small" variant="outlined" color="default" sx={{ height: 22, fontSize: '0.72rem' }} />
                        ) : (
                          <Box>
                            <Chip icon={<PaymentsIcon sx={{ fontSize: '0.85rem !important' }} />} label="Con Viáticos" size="small" color="info" sx={{ height: 22, fontSize: '0.72rem', mb: 0.5 }} />
                            <Box sx={{ fontSize: '0.72rem', color: '#334155' }}>🏨 {act.alojamiento || 'N/A'}</Box>
                            <Box sx={{ fontSize: '0.72rem', color: '#334155' }}>🚌 {act.transporte || 'N/A'}</Box>
                          </Box>
                        )}
                      </TableCell>

                      <TableCell sx={{ fontSize: '0.8rem' }}>{act.funciones}</TableCell>

                      <TableCell sx={{ fontSize: '0.8rem' }}>{act.contexto_practica}</TableCell>

                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {(act.responsables || []).map((r, rIdx) => (
                          <Chip key={rIdx} label={r.nombre || r.email} size="small" color="success" sx={{ height: 22, fontSize: '0.72rem', mr: 0.5, mb: 0.5 }} />
                        ))}
                      </TableCell>

                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        <Chip label={`${(act.estudiantes || []).length} Estudiantes`} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {activeCronograma.pdf_oficio_path && (
              <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2, textAlign: 'center' }}>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<PictureAsPdfIcon />}
                  component="a"
                  href={getPdfFullUrl(activeCronograma.pdf_oficio_path)}
                  target="_blank"
                >
                  Descargar / Visualizar Oficio PDF Adjunto
                </Button>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1 }}>
            <Button onClick={() => setOpenDetailDialog(false)} color="inherit">
              Cerrar
            </Button>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {/* Botones de Vicerrectoría Académica */}
              {activeCronograma.estado === 'en_revision_academica' && (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<UndoIcon />}
                    onClick={() => setOpenDevolverDialog(true)}
                  >
                    Volver a Corrección
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleVistoBuenoAcademica(activeCronograma.id)}
                    disabled={saving}
                  >
                    Dar Visto Bueno
                  </Button>
                </>
              )}

              {/* Botones de Vicerrectoría Financiera */}
              {activeCronograma.estado === 'en_revision_financiera' && (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<UndoIcon />}
                    onClick={() => setOpenDevolverDialog(true)}
                  >
                    Volver a Corrección
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleAprobarFinanciera(activeCronograma.id)}
                    disabled={saving}
                  >
                    Aprobar Cronograma
                  </Button>
                </>
              )}
            </Box>
          </DialogActions>
        </Dialog>
      )}

      {/* Modal Devolver a Corrección */}
      <Dialog open={openDevolverDialog} onClose={() => setOpenDevolverDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#dc2626', color: '#fff' }}>
          Devolver Cronograma a Corrección
        </DialogTitle>
        <DialogContent sx={{ p: 3, mt: 1 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Ingrese detalladamente las observaciones o correcciones requeridas. El Director de Programa recibirá una notificación con estas instrucciones.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Observaciones Obligatorias"
            value={observacionesDevolver}
            onChange={(e) => setObservacionesDevolver(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDevolverDialog(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleConfirmDevolver} variant="contained" color="error" disabled={!observacionesDevolver.trim() || saving}>
            Confirmar Devolución
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modales de Selección */}
      <MatriculadosSelectorModal
        open={openMatriculadosModal}
        onClose={() => setOpenMatriculadosModal(false)}
        selectedEstudiantes={activeActividadIdx !== null ? actividades[activeActividadIdx]?.estudiantes : []}
        onSelect={handleSelectEstudiantes}
        programaFilter={formPrograma}
      />

      <ResponsablesSelectorModal
        open={openResponsablesModal}
        onClose={() => setOpenResponsablesModal(false)}
        selectedResponsables={activeActividadIdx !== null ? actividades[activeActividadIdx]?.responsables : []}
        onSelect={handleSelectResponsables}
      />

      {/* MODAL INSTITUCIONAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <Dialog
        open={openDeleteConfirm}
        onClose={() => setOpenDeleteConfirm(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3.5, p: 1, boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 3, pb: 1 }}>
          <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
            <WarningIcon sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
            ¿Confirmar Eliminación?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', px: 3, pb: 2 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6, fontSize: '0.92rem' }}>
            ¿Está seguro de que desea eliminar permanentemente el <strong>Cronograma de Práctica Integral de Movilidad (CRON-{cronogramaToDelete?.id})</strong>?
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#dc2626', fontWeight: 700, bgcolor: '#fef2f2', p: 1, borderRadius: 1.5, border: '1px solid #fecaca' }}>
            ⚠️ Esta acción eliminará las actividades asociadas y no se podrá deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, px: 3, gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setOpenDeleteConfirm(false)}
            sx={{ color: '#475569', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 700, borderRadius: 2.5, px: 3, py: 0.8 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteCronograma}
            sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' }, textTransform: 'none', fontWeight: 800, borderRadius: 2.5, px: 3, py: 0.8, boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)' }}
          >
            Sí, Eliminar Cronograma
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CronogramaMovilidadModule;
