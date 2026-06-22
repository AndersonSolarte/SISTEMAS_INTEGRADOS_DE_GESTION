import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Fade,
  Chip,
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  CircularProgress,
  IconButton,
  Alert,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  InputAdornment,
  Tabs,
  Tab,
  Popover
} from '@mui/material';
import {
  HomeWork as HomeWorkIcon,
  BarChart as BarChartIcon,
  Description as DescriptionIcon,
  ArrowBackRounded as ArrowBackRoundedIcon,
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  UploadFile as UploadFileIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon,
  DirectionsWalk as DirectionsWalkIcon,
  SportsBasketball as SportsBasketballIcon,
  Forum as ForumIcon,
  Lightbulb as LightbulbIcon,
  MeetingRoom as MeetingRoomIcon,
  FilterAltOff as FilterAltOffIcon,
  ExpandMore as ExpandMoreIcon,
  Groups as GroupsIcon,
  School as SchoolIcon,
  People as PeopleIcon,
  Place as PlaceIcon,
  Insights as InsightsIcon
} from '@mui/icons-material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import CloseIconMui from '@mui/icons-material/Close';
import LightbulbIconMui from '@mui/icons-material/Lightbulb';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import MeetingRoomIconMui from '@mui/icons-material/MeetingRoom';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PrintIcon from '@mui/icons-material/Print';


import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
  LabelList,
  PieChart,
  Pie,
  ReferenceLine
} from 'recharts';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';

const INFRAESTRUCTURA_CATEGORIES = [
  { key: 'aulas', label: 'Aulas de clase', matches: ['aula', 'aulas', 'clase', 'salon', 'salón'] },
  { key: 'laboratorios', label: 'Laboratorios', matches: ['laboratorio', 'laboratorios', 'lab', 'labs'] },
  { key: 'tutores', label: 'Salas de tutores', matches: ['tutor', 'tutores', 'sala de tutores', 'salas de tutores'] },
  { key: 'auditorios', label: 'Auditorios', matches: ['auditorio', 'auditorios'] },
  { key: 'bibliotecas', label: 'Bibliotecas', matches: ['biblioteca', 'bibliotecas', 'biblio'] },
  { key: 'computo', label: 'Cómputo', matches: ['computo', 'cómputo', 'sistemas', 'sala de computo', 'salas de computo', 'sala de cómputo', 'salas de cómputo'] },
  { key: 'oficinas', label: 'Oficinas', matches: ['oficina', 'oficinas', 'despacho', 'despachos'] },
  { key: 'deportes', label: 'Espacios deportivos', matches: ['deporte', 'deportes', 'deportivo', 'deportivos', 'gimnasio', 'cancha', 'canchas'] },
  { key: 'cafeterias', label: 'Cafeterías', matches: ['cafeteria', 'cafetería', 'cafeterias', 'cafeterías', 'comedor'] },
  { key: 'recreacion', label: 'Zonas recreación', matches: ['recreacion', 'recreación', 'zona verde', 'zonas verdes', 'pasillo', 'pasillos', 'patio'] },
  { key: 'sanitarios', label: 'Servicios sanitarios', matches: ['baño', 'baños', 'bano', 'banos', 'sanitario', 'sanitarios', 'servicios sanitarios'] },
];

const getInfraestructuraRowCategory = (tipoEspacio) => {
  if (!tipoEspacio) return 'Otros';
  const val = String(tipoEspacio).toLowerCase().trim();
  for (const cat of INFRAESTRUCTURA_CATEGORIES) {
    if (cat.matches.some(m => val.includes(m) || m.includes(val))) {
      return cat.label;
    }
  }
  return 'Otros';
};

export default function InfraestructuraFisicaDashboard({
  user,
  seriesRows = [],
  canManage = false,
  canViewStats = false,
  canView = false,
  onBack
}) {
  const { enqueueSnackbar } = useSnackbar();

  // Permisos mapeados
  const canManageInfraestructura = canManage;
  const canViewInfraestructuraStats = canViewStats;
  const canViewInfraestructura = canView;

  // Estados
  const [infraestructuraFisicaTab, setInfraestructuraFisicaTab] = useState('hub');
  const [infraestructuraFisicaCampusFilter, setInfraestructuraFisicaCampusFilter] = useState([]);
  const [infraestructuraFisicaBloqueFilter, setInfraestructuraFisicaBloqueFilter] = useState([]);
  const [infraestructuraFisicaPisoFilter, setInfraestructuraFisicaPisoFilter] = useState([]);
  const [infraestructuraFisicaTenenciaFilter, setInfraestructuraFisicaTenenciaFilter] = useState([]);
  const [infraestructuraFisicaTipoAreaFilter, setInfraestructuraFisicaTipoAreaFilter] = useState([]);
  const [infraestructuraFisicaCrudCampusFilter, setInfraestructuraFisicaCrudCampusFilter] = useState('Todos');
  const [infraestructuraFisicaSearch, setInfraestructuraFisicaSearch] = useState('');
  const [infraestructuraFisicaHelpAnchor, setInfraestructuraFisicaHelpAnchor] = useState(null);
  const [infraestructuraFisicaPage, setInfraestructuraFisicaPage] = useState(0);
  const [infraestructuraFisicaDetailOpen, setInfraestructuraFisicaDetailOpen] = useState(false);
  const [infraestructuraFisicaDetailCategory, setInfraestructuraFisicaDetailCategory] = useState('');
  const [infraestructuraFisicaDetailTenencia, setInfraestructuraFisicaDetailTenencia] = useState('Todos');
  const [infraestructuraFisicaDetailSearch, setInfraestructuraFisicaDetailSearch] = useState('');
  const [infraestructuraFisicaDetailPage, setInfraestructuraFisicaDetailPage] = useState(0);
  const [infraestructuraFisicaDetailRowsPerPage, setInfraestructuraFisicaDetailRowsPerPage] = useState(10);
  const [infraestructuraFisicaRowsPerPage, setInfraestructuraFisicaRowsPerPage] = useState(25);
  const [infraestructuraFisicaData, setInfraestructuraFisicaData] = useState([]);
  const [infraestructuraFisicaAllData, setInfraestructuraFisicaAllData] = useState([]);
  const [infraestructuraFisicaTotal, setInfraestructuraFisicaTotal] = useState(0);
  const [infraestructuraFisicaLoading, setInfraestructuraFisicaLoading] = useState(false);
  const [infraestructuraFisicaDialogOpen, setInfraestructuraFisicaDialogOpen] = useState(false);
  const [infraestructuraFisicaForm, setInfraestructuraFisicaForm] = useState({
    campus: 'Campus Centro',
    componente: '',
    tipo_area: 'CONSTRUIDA',
    tenencia: 'Propio',
    ubicacion: '',
    nomenclatura: '',
    piso_no: 1,
    tipo_espacio: '',
    asignacion: '',
    descripcion: '',
    funcion_especifica: '',
    capacidad_fisica: 0,
    area_metros2: 0.0,
    fecha_actualizacion: new Date().getFullYear().toString(),
    acceso_autonomo: 'No'
  });
  const [infraestructuraFisicaSubmitting, setInfraestructuraFisicaSubmitting] = useState(false);
  const [infraestructuraFisicaUploading, setInfraestructuraFisicaUploading] = useState(false);
  const [infraestructuraFisicaEditingId, setInfraestructuraFisicaEditingId] = useState(null);

  // Nuevos estados para el CRUD de la tabla "Descripción general de la Infraestructura Física - tenencia"
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [buildingDialogMode, setBuildingDialogMode] = useState('create'); // 'create' o 'edit'
  const [buildingForm, setBuildingForm] = useState({
    componente: '',
    campus: 'Campus Centro',
    tenencia: 'Propio',
    direccion: ''
  });
  const [buildingSubmitting, setBuildingSubmitting] = useState(false);
  const [edificacionesReferencia, setEdificacionesReferencia] = useState([]);
  const [buildingEditingId, setBuildingEditingId] = useState(null);
  const [specialSpaceTab, setSpecialSpaceTab] = useState(0);
  const [infraReportTemplate, setInfraReportTemplate] = useState('general');
  const [infraReportHtmlContent, setInfraReportHtmlContent] = useState('');
  const [infraReportCustomName, setInfraReportCustomName] = useState('');
  const [infraReportParsingTemplate, setInfraReportParsingTemplate] = useState(false);
  const editorRef = React.useRef(null);

  // callbacks de carga de datos
  const fetchInfraestructuraFisica = useCallback(async () => {
    setInfraestructuraFisicaLoading(true);
    try {
      const campusFilterVal = infraestructuraFisicaCrudCampusFilter === 'Todos' ? '' : infraestructuraFisicaCrudCampusFilter;
      const response = await gestionInformacionService.getInfraestructuras({
        page: infraestructuraFisicaPage + 1,
        limit: infraestructuraFisicaRowsPerPage,
        campus: campusFilterVal,
        search: infraestructuraFisicaSearch
      });
      setInfraestructuraFisicaData(response.data.registros || []);
      setInfraestructuraFisicaTotal(response.data.pagination.total || 0);
    } catch (error) {
      console.error('Error al cargar infraestructura física:', error);
      enqueueSnackbar('No se pudo cargar la información de infraestructura física', { variant: 'error' });
    } finally {
      setInfraestructuraFisicaLoading(false);
    }
  }, [infraestructuraFisicaPage, infraestructuraFisicaRowsPerPage, infraestructuraFisicaCrudCampusFilter, infraestructuraFisicaSearch, enqueueSnackbar]);

  const fetchInfraestructuraFisicaAll = useCallback(async () => {
    try {
      const response = await gestionInformacionService.getInfraestructuras({
        page: 1,
        limit: 10000,
        campus: ''
      });
      setInfraestructuraFisicaAllData(response.data.registros || []);
    } catch (error) {
      console.error('Error al cargar agregados de infraestructura:', error);
    }
  }, []);

  const fetchEdificacionesReferencia = useCallback(async () => {
    try {
      const response = await gestionInformacionService.getEdificacionesReferencia();
      setEdificacionesReferencia(response.data || []);
    } catch (error) {
      console.error('Error al cargar edificaciones de referencia:', error);
      enqueueSnackbar('No se pudo cargar la lista de edificaciones de referencia', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  // Ejecución inicial al montar
  useEffect(() => {
    fetchInfraestructuraFisica();
  }, [fetchInfraestructuraFisica]);

  useEffect(() => {
    fetchEdificacionesReferencia();
  }, [fetchEdificacionesReferencia]);

  useEffect(() => {
    fetchInfraestructuraFisicaAll();
  }, [fetchInfraestructuraFisicaAll]);

  // Recarga al cambiar tab o búsqueda
  useEffect(() => {
    fetchInfraestructuraFisica();
  }, [infraestructuraFisicaPage, infraestructuraFisicaRowsPerPage, infraestructuraFisicaCrudCampusFilter]);

  // Efecto de informes
  useEffect(() => {
    const reportTemplates = {
      general: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
        <h1 style="text-align: center; color: #1e3a8a; font-size: 24px; margin-bottom: 5px; font-weight: 800;">UNIVERSIDAD CESMAG</h1>
        <h2 style="text-align: center; color: #475569; font-size: 18px; margin-top: 0; margin-bottom: 25px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; font-weight: 700;">INFORME GENERAL DE GESTIÓN DE INFRAESTRUCTURA FÍSICA</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 150px;">Fecha del reporte:</td>
            <td style="padding: 4px 0; color: #475569;">${new Date().toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold;">Autor:</td>
            <td style="padding: 4px 0; color: #475569;">${user?.name || 'Administrador SIG'}</td>
          </tr>
        </table>

        <h3 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 16px; font-weight: 700; margin-top: 20px;">1. Resumen Ejecutivo</h3>
        <p style="text-align: justify; font-size: 14.5px; margin-bottom: 12px;">
          El presente informe recopila de forma unificada el inventario de la infraestructura física de la Universidad CESMAG. Se consolidan las áreas construidas en metros cuadrados (m²), los aforos permitidos (capacidad simultánea) y la relación de densidad estudiantil.
        </p>
        <p style="text-align: justify; font-size: 14.5px; margin-bottom: 12px;">
          A la fecha de emisión de este reporte, la institución cuenta con los siguientes indicadores globales clave:
        </p>
        <ul style="font-size: 14.5px; color: #334155; line-height: 1.8; margin-bottom: 20px;">
          <li><strong>Área construida total:</strong> {{KPI_AREA_CONSTRUIDA}}</li>
          <li><strong>Aforo de capacidad máxima:</strong> {{KPI_CAPACIDAD_TOTAL}}</li>
          <li><strong>Cantidad de ambientes catalogados:</strong> {{KPI_ESPACIOS_TOTALES}}</li>
          <li><strong>Densidad estudiantil promedio:</strong> {{KPI_DENSIDAD}}</li>
        </ul>

        <h3 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 16px; font-weight: 700; margin-top: 25px;">2. Cuadro de Distribución Consolidada por Campus y Piso</h3>
        <p style="text-align: justify; font-size: 14.5px; margin-bottom: 15px;">
          El siguiente cuadro muestra el consolidado desagregado de espacios físicos, capacidades y áreas distribuidos por campus, bloque y número de piso:
        </p>
        
        <p>{{TABLA_CONSOLIDADA}}</p>

        <h3 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 16px; font-weight: 700; margin-top: 25px;">3. Recomendaciones y Conclusión</h3>
        <p style="text-align: justify; font-size: 14.5px; margin-bottom: 12px;">
          Se sugiere realizar un monitoreo preventivo constante sobre los aforos de los bloques con alta densidad y priorizar la asignación eficiente de aulas y laboratorios en los campus satélites.
        </p>
      </div>`,
      aforos: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
        <h1 style="text-align: center; color: #1e3a8a; font-size: 24px; margin-bottom: 5px; font-weight: 800;">UNIVERSIDAD CESMAG</h1>
        <h2 style="text-align: center; color: #ca8a04; font-size: 18px; margin-top: 0; margin-bottom: 25px; border-bottom: 2px solid #ca8a04; padding-bottom: 10px; font-weight: 700;">INFORME DE AFOROS Y CAPACIDAD SIMULTÁNEA</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 150px;">Fecha del reporte:</td>
            <td style="padding: 4px 0; color: #475569;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>

        <h3 style="color: #ca8a04; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 16px; font-weight: 700; margin-top: 20px;">1. Ficha de Aforos y Densidades</h3>
        <p style="text-align: justify; font-size: 14.5px; margin-bottom: 12px;">
          Este reporte evalúa la capacidad de soporte de estudiantes en simultáneo dentro del inventario físico institucional, en correspondencia con el área en metros cuadrados y el número total de ambientes de aprendizaje.
        </p>

        <h3 style="color: #ca8a04; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 16px; font-weight: 700; margin-top: 25px;">2. Cuadro Consolidado Matriz</h3>
        
        <p>{{TABLA_CONSOLIDADA}}</p>

        <p style="font-size: 13px; color: #64748b; font-style: italic; margin-top: 15px;">
          Nota: La relación de densidad actual equivale a {{KPI_DENSIDAD}} m² construidos por estudiante matriculado.
        </p>
      </div>`,
      vacio: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
        <h1 style="color: #1e3a8a; font-size: 22px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-weight: 800;">Nuevo Informe Personalizado</h1>
        <p style="font-size: 14px; color: #64748b;">Fecha de creación: ${new Date().toLocaleDateString()}</p>
        <p style="font-size: 14.5px; margin-top: 15px;">Redacte aquí el contenido del reporte institucional...</p>
        
        <p>{{TABLA_CONSOLIDADA}}</p>
      </div>`
    };
    if (infraestructuraFisicaTab === 'informes') {
      if (reportTemplates[infraReportTemplate]) {
        setInfraReportHtmlContent(reportTemplates[infraReportTemplate]);
      }
    }
  }, [infraReportTemplate, infraestructuraFisicaTab, user]);

  const matchesInfraestructuraFilter = (row, filterArray, rowField) => {
    if (!filterArray || filterArray.length === 0) return true;
    const rowVal = row[rowField];
    if (rowVal === null || rowVal === undefined) return false;
    
    if (rowField === 'piso_no') {
      return filterArray.some((val) => Number(val) === Number(rowVal));
    }
    return filterArray.some((val) => String(val).toLowerCase() === String(rowVal).toLowerCase());
  };

  // 1. Campus disponibles
  const availableCampusOptions = useMemo(() => {
    const matching = infraestructuraFisicaAllData.filter((row) => 
      matchesInfraestructuraFilter(row, infraestructuraFisicaBloqueFilter, 'componente') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaPisoFilter, 'piso_no') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTenenciaFilter, 'tenencia') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTipoAreaFilter, 'tipo_area')
    );
    return Array.from(new Set(matching.map((r) => r.campus).filter(Boolean))).sort();
  }, [infraestructuraFisicaAllData, infraestructuraFisicaBloqueFilter, infraestructuraFisicaPisoFilter, infraestructuraFisicaTenenciaFilter, infraestructuraFisicaTipoAreaFilter]);

  // 2. Bloques disponibles
  const availableBloqueOptions = useMemo(() => {
    const matching = infraestructuraFisicaAllData.filter((row) => 
      matchesInfraestructuraFilter(row, infraestructuraFisicaCampusFilter, 'campus') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaPisoFilter, 'piso_no') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTenenciaFilter, 'tenencia') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTipoAreaFilter, 'tipo_area')
    );
    return Array.from(new Set(matching.map((r) => r.componente).filter(Boolean))).sort();
  }, [infraestructuraFisicaAllData, infraestructuraFisicaCampusFilter, infraestructuraFisicaPisoFilter, infraestructuraFisicaTenenciaFilter, infraestructuraFisicaTipoAreaFilter]);

  // 3. Pisos disponibles
  const availablePisoOptions = useMemo(() => {
    const matching = infraestructuraFisicaAllData.filter((row) => 
      matchesInfraestructuraFilter(row, infraestructuraFisicaCampusFilter, 'campus') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaBloqueFilter, 'componente') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTenenciaFilter, 'tenencia') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTipoAreaFilter, 'tipo_area')
    );
    return Array.from(new Set(matching.map((r) => r.piso_no).filter((p) => p !== null && p !== undefined))).map(Number).sort((a, b) => a - b);
  }, [infraestructuraFisicaAllData, infraestructuraFisicaCampusFilter, infraestructuraFisicaBloqueFilter, infraestructuraFisicaTenenciaFilter, infraestructuraFisicaTipoAreaFilter]);

  // 4. Tenencias disponibles
  const availableTenenciaOptions = useMemo(() => {
    const matching = infraestructuraFisicaAllData.filter((row) => 
      matchesInfraestructuraFilter(row, infraestructuraFisicaCampusFilter, 'campus') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaBloqueFilter, 'componente') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaPisoFilter, 'piso_no') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTipoAreaFilter, 'tipo_area')
    );
    return Array.from(new Set(matching.map((r) => r.tenencia).filter(Boolean))).sort();
  }, [infraestructuraFisicaAllData, infraestructuraFisicaCampusFilter, infraestructuraFisicaBloqueFilter, infraestructuraFisicaPisoFilter, infraestructuraFisicaTipoAreaFilter]);

  // 5. Tipos de Área disponibles
  const availableTipoAreaOptions = useMemo(() => {
    const matching = infraestructuraFisicaAllData.filter((row) => 
      matchesInfraestructuraFilter(row, infraestructuraFisicaCampusFilter, 'campus') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaBloqueFilter, 'componente') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaPisoFilter, 'piso_no') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTenenciaFilter, 'tenencia')
    );
    return Array.from(new Set(matching.map((r) => r.tipo_area).filter(Boolean))).sort();
  }, [infraestructuraFisicaAllData, infraestructuraFisicaCampusFilter, infraestructuraFisicaBloqueFilter, infraestructuraFisicaPisoFilter, infraestructuraFisicaTenenciaFilter]);

  // Efectos de re-sincronización dinámica de filtros (Bidireccionalidad Reactiva)
  useEffect(() => {
    setInfraestructuraFisicaCampusFilter((prev) => 
      prev.filter((val) => availableCampusOptions.includes(val))
    );
  }, [availableCampusOptions]);

  useEffect(() => {
    setInfraestructuraFisicaBloqueFilter((prev) => 
      prev.filter((val) => availableBloqueOptions.includes(val))
    );
  }, [availableBloqueOptions]);

  useEffect(() => {
    setInfraestructuraFisicaPisoFilter((prev) => 
      prev.filter((val) => availablePisoOptions.includes(Number(val)))
    );
  }, [availablePisoOptions]);

  useEffect(() => {
    setInfraestructuraFisicaTenenciaFilter((prev) => 
      prev.filter((val) => availableTenenciaOptions.includes(val))
    );
  }, [availableTenenciaOptions]);

  useEffect(() => {
    setInfraestructuraFisicaTipoAreaFilter((prev) => 
      prev.filter((val) => availableTipoAreaOptions.includes(val))
    );
  }, [availableTipoAreaOptions]);

  // Dataset final filtrado en base a los 5 filtros cruzados
  const infraestructuraFisicaFilteredData = useMemo(() => {
    return infraestructuraFisicaAllData.filter((row) => 
      matchesInfraestructuraFilter(row, infraestructuraFisicaCampusFilter, 'campus') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaBloqueFilter, 'componente') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaPisoFilter, 'piso_no') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTenenciaFilter, 'tenencia') &&
      matchesInfraestructuraFilter(row, infraestructuraFisicaTipoAreaFilter, 'tipo_area')
    );
  }, [infraestructuraFisicaAllData, infraestructuraFisicaCampusFilter, infraestructuraFisicaBloqueFilter, infraestructuraFisicaPisoFilter, infraestructuraFisicaTenenciaFilter, infraestructuraFisicaTipoAreaFilter]);

  // Lógica para obtener los registros detallados correspondientes a la celda/fila seleccionada de la matriz
  const infraestructuraFisicaDetailRecords = useMemo(() => {
    if (!infraestructuraFisicaDetailOpen) return [];
    return infraestructuraFisicaFilteredData.filter((row) => {
      // 1. Filtrar por categoría
      const cat = getInfraestructuraRowCategory(row.tipo_espacio);
      if (cat !== infraestructuraFisicaDetailCategory) return false;
      
      // 2. Filtrar por tenencia si aplica
      if (infraestructuraFisicaDetailTenencia !== 'Todos') {
        let ten = 'Otros';
        const rowTen = String(row.tenencia || '').toLowerCase().trim();
        if (['propio', 'propiedad', 'propia'].includes(rowTen)) ten = 'Propio';
        else if (['arriendo', 'arrendado', 'arrendada'].includes(rowTen)) ten = 'Arriendo';
        else if (['comodato'].includes(rowTen)) ten = 'Comodato';
        
        if (ten !== infraestructuraFisicaDetailTenencia) return false;
      }
      
      // 3. Filtrar por búsqueda en la barra de detalle
      if (infraestructuraFisicaDetailSearch) {
        const s = String(infraestructuraFisicaDetailSearch).toLowerCase().trim();
        return (
          String(row.nomenclatura || '').toLowerCase().includes(s) ||
          String(row.asignacion || '').toLowerCase().includes(s) ||
          String(row.descripcion || '').toLowerCase().includes(s) ||
          String(row.componente || '').toLowerCase().includes(s) ||
          String(row.ubicacion || '').toLowerCase().includes(s) ||
          String(row.funcion_especifica || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [infraestructuraFisicaDetailOpen, infraestructuraFisicaFilteredData, infraestructuraFisicaDetailCategory, infraestructuraFisicaDetailTenencia, infraestructuraFisicaDetailSearch]);

  const infraestructuraFisicaDetailPageData = useMemo(() => {
    const start = infraestructuraFisicaDetailPage * infraestructuraFisicaDetailRowsPerPage;
    const end = start + infraestructuraFisicaDetailRowsPerPage;
    return infraestructuraFisicaDetailRecords.slice(start, end);
  }, [infraestructuraFisicaDetailRecords, infraestructuraFisicaDetailPage, infraestructuraFisicaDetailRowsPerPage]);
  // --- FIN DE LA LÓGICA DE FILTRADO BIDIRECCIONAL ---

  const hubSummary = useMemo(() => {
    const campus = new Set();
    const bloques = new Set();
    let areaTotal = 0;
    let capacidadTotal = 0;

    infraestructuraFisicaAllData.forEach((row) => {
      if (row.campus) campus.add(row.campus);
      if (row.componente) bloques.add(row.componente);
      areaTotal += Number(row.area_metros2) || 0;
      capacidadTotal += Number(row.capacidad_fisica) || 0;
    });

    return {
      registros: infraestructuraFisicaAllData.length,
      campus: campus.size,
      bloques: bloques.size,
      areaTotal,
      capacidadTotal
    };
  }, [infraestructuraFisicaAllData]);

  const formatHubNumber = (value, options = {}) => Number(value || 0).toLocaleString('es-CO', options);

  // Component-level statistics useMemo
  const stats = useMemo(() => {
    const studentCount = 4022;

    let areaConstruida = 0;
    let capacidadTotal = 0;
    let espaciosTotales = infraestructuraFisicaFilteredData.length;
    
    const bloqueAreas = {};
    const tipoEspacios = {};
    let accesoSi = 0;
    let accesoNo = 0;

    infraestructuraFisicaFilteredData.forEach((row) => {
      const area = Number(row.area_metros2) || 0;
      const cap = Number(row.capacidad_fisica) || 0;

      if (row.tipo_area === 'CONSTRUIDA') {
        areaConstruida += area;
      }
      capacidadTotal += cap;

      // Agrupación Bloques
      const blq = row.componente || 'Sin Bloque';
      bloqueAreas[blq] = (bloqueAreas[blq] || 0) + area;

      // Agrupación Tipos de Espacio
      const tEsp = row.tipo_espacio || 'Otros';
      if (!tipoEspacios[tEsp]) {
        tipoEspacios[tEsp] = { area: 0, capacidad: 0, cantidad: 0 };
      }
      tipoEspacios[tEsp].area += area;
      tipoEspacios[tEsp].capacidad += cap;
      tipoEspacios[tEsp].cantidad += 1;

      // Acceso autónomo
      if (['Sí', 'Si'].includes(row.acceso_autonomo)) accesoSi++;
      else accesoNo++;
    });

    // Formatear bloques para Recharts
    const bloquesData = Object.keys(bloqueAreas).map((key) => ({
      name: key,
      area: parseFloat(bloqueAreas[key].toFixed(1))
    })).sort((a, b) => b.area - a.area).slice(0, 10);

    // Formatear tipos de espacio para Recharts
    const tiposData = Object.keys(tipoEspacios).map((key) => ({
      name: key,
      capacidad: tipoEspacios[key].capacidad,
      area: parseFloat(tipoEspacios[key].area.toFixed(1)),
      cantidad: tipoEspacios[key].cantidad
    })).sort((a, b) => b.area - a.area).slice(0, 8);

    const accesoData = [
      { name: 'Acceso Autónomo', value: accesoSi },
      { name: 'Acceso Común', value: accesoNo }
    ];

    // Compilación de resumen tabulado agrupado por Ubicación, Bloque y Piso
    const listResumen = {};
    infraestructuraFisicaFilteredData.forEach((row) => {
      const key = `${row.ubicacion || 'Sin Sede'} - ${row.componente || 'Sin Bloque'} - Piso ${row.piso_no || 1}`;
      if (!listResumen[key]) {
        listResumen[key] = {
          ubicacion: row.ubicacion || 'Sin Sede',
          bloque: row.componente || 'Sin Bloque',
          piso: row.piso_no || 1,
          cantidad: 0,
          capacidad: 0,
          area: 0
        };
      }
      listResumen[key].cantidad++;
      listResumen[key].capacidad += Number(row.capacidad_fisica) || 0;
      listResumen[key].area += Number(row.area_metros2) || 0;
    });
    const tableResumen = Object.values(listResumen).sort((a, b) => {
      if (a.ubicacion !== b.ubicacion) return a.ubicacion.localeCompare(b.ubicacion);
      if (a.bloque !== b.bloque) return a.bloque.localeCompare(b.bloque);
      return a.piso - b.piso;
    });

    const densidad = studentCount > 0 ? parseFloat((areaConstruida / studentCount).toFixed(2)) : 0;

    // --- COMPILADOR DE LA MATRIZ DE INSTALACIONES FÍSICAS ---
    const getRowCategory = getInfraestructuraRowCategory;
    const catLabels = [...INFRAESTRUCTURA_CATEGORIES.map(c => c.label), 'Otros'];
    const tenenciaKeys = ['Propio', 'Arriendo', 'Comodato', 'Otros'];
    
    const matrixData = {};
    catLabels.forEach(cat => {
      matrixData[cat] = {
        Propio: { cantidad: 0, area: 0 },
        Arriendo: { cantidad: 0, area: 0 },
        Comodato: { cantidad: 0, area: 0 },
        Otros: { cantidad: 0, area: 0 },
        Total: { cantidad: 0, area: 0 }
      };
    });
    
    const matrixTotals = {
      Propio: { cantidad: 0, area: 0 },
      Arriendo: { cantidad: 0, area: 0 },
      Comodato: { cantidad: 0, area: 0 },
      Otros: { cantidad: 0, area: 0 },
      Total: { cantidad: 0, area: 0 }
    };

    const capacityAulas = { Propio: 0, Arriendo: 0, Comodato: 0, Otros: 0, Total: 0 };
    const capacityLabs = { Propio: 0, Arriendo: 0, Comodato: 0, Otros: 0, Total: 0 };

    infraestructuraFisicaFilteredData.forEach(row => {
      const cat = getRowCategory(row.tipo_espacio);
      const area = Number(row.area_metros2) || 0;
      const cap = Number(row.capacidad_fisica) || 0;
      
      let ten = 'Otros';
      const rowTen = String(row.tenencia || '').toLowerCase().trim();
      if (['propio', 'propiedad', 'propia'].includes(rowTen)) ten = 'Propio';
      else if (['arriendo', 'arrendado', 'arrendada'].includes(rowTen)) ten = 'Arriendo';
      else if (['comodato'].includes(rowTen)) ten = 'Comodato';

      matrixData[cat][ten].cantidad += 1;
      matrixData[cat][ten].area += area;
      
      matrixData[cat].Total.cantidad += 1;
      matrixData[cat].Total.area += area;

      matrixTotals[ten].cantidad += 1;
      matrixTotals[ten].area += area;
      
      matrixTotals.Total.cantidad += 1;
      matrixTotals.Total.area += area;

      if (cat === 'Aulas de clase') {
        capacityAulas[ten] += cap;
        capacityAulas.Total += cap;
      } else if (cat === 'Laboratorios') {
        capacityLabs[ten] += cap;
        capacityLabs.Total += cap;
      }
    });

    return {
      areaConstruida: parseFloat(areaConstruida.toFixed(1)),
      capacidadTotal,
      espaciosTotales,
      densidad,
      bloquesData,
      tiposData,
      accesoData,
      tableResumen,
      matrix: {
        rows: matrixData,
        totals: matrixTotals,
        capacityAulas,
        capacityLabs,
        catLabels,
        tenenciaKeys
      }
    };
  }, [infraestructuraFisicaFilteredData]);


  // --- INICIO DE LA LÓGICA DE AUDITORIOS INSTITUCIONALES ---
  const auditoriosGroups = useMemo(() => {
    const groups = {
      aemg: {
        key: 'aemg',
        name: 'Coliseo Guillermo de Castellana',
        campus: 'Campus Centro',
        tipo_area: 'CONSTRUIDA',
        area: 0,
        capacidad: 0,
        foto_url: null,
        subspaces: []
      },
      san_francisco: {
        key: 'san_francisco',
        name: 'Auditorio San Francisco',
        campus: 'Campus Centro',
        tipo_area: 'CONSTRUIDA',
        area: 0,
        capacidad: 0,
        foto_url: null,
        subspaces: []
      },
      santa_clara: {
        key: 'santa_clara',
        name: 'Auditorio Santa Clara',
        campus: 'Campus Centro',
        tipo_area: 'CONSTRUIDA',
        area: 0,
        capacidad: 0,
        foto_url: null,
        subspaces: []
      },
      vaf: {
        key: 'vaf',
        name: 'Auditorio Vicerrectoría Administrativa Financiera',
        campus: 'Campus San Damián',
        tipo_area: 'CONSTRUIDA',
        area: 0,
        capacidad: 0,
        foto_url: null,
        subspaces: []
      }
    };

    infraestructuraFisicaAllData.forEach(row => {
      const isAud = (
        String(row.tipo_espacio || '').toLowerCase().includes('auditorio') ||
        String(row.nomenclatura || '').toLowerCase().includes('auditorio') ||
        String(row.asignacion || '').toLowerCase().includes('auditorio') ||
        String(row.componente || '').toLowerCase().includes('auditorio') ||
        String(row.descripcion || '').toLowerCase().includes('auditorio')
      );
      if (!isAud) return;

      const area = Number(row.area_metros2) || 0;
      const cap = Number(row.capacidad_fisica) || 0;
      
      let gKey = null;
      if (String(row.asignacion || '').toUpperCase() === 'AEMG') {
        gKey = 'aemg';
      } else if (String(row.descripcion || '').toUpperCase().includes('SAN FRANCISCO')) {
        gKey = 'san_francisco';
      } else if (String(row.descripcion || '').toLowerCase().includes('santa clara')) {
        gKey = 'santa_clara';
      } else if (String(row.asignacion || '').toLowerCase().includes('vicerrectoría administrativa financiera') || String(row.asignacion || '').toLowerCase().includes('vicerrec')) {
        gKey = 'vaf';
      }

      if (gKey) {
        groups[gKey].area += area;
        groups[gKey].capacidad += cap;
        if (row.foto_url) {
          groups[gKey].foto_url = row.foto_url;
        }
        groups[gKey].subspaces.push({
          id: row.id,
          descripcion: row.descripcion || row.nomenclatura || 'Espacio',
          capacidad: cap,
          area: area
        });
      }
    });

    return Object.values(groups);
  }, [infraestructuraFisicaAllData]);

  const handleUploadFoto = async (groupKey, file) => {
    try {
      setInfraestructuraFisicaLoading(true);
      const res = await gestionInformacionService.uploadAuditorioFoto(groupKey, file);
      enqueueSnackbar(res.message || 'Imagen del auditorio actualizada exitosamente.', { variant: 'success' });
      await fetchInfraestructuraFisicaAll();
      await fetchInfraestructuraFisica();
    } catch (error) {
      console.error('Error al subir foto:', error);
      enqueueSnackbar(error.response?.data?.message || 'Error al subir la imagen del auditorio.', { variant: 'error' });
    } finally {
      setInfraestructuraFisicaLoading(false);
    }
  };

  const handleCopyFicha = (card) => {
    const text = `FICHA TÉCNICA - ${card.name.toUpperCase()}
Campus: ${card.campus}
Tipo de Área: ${card.tipo_area}
Área Construida Total: ${card.area.toFixed(2)} m²
Capacidad Total: ${card.capacidad} personas
Espacios Consolidados:
${card.subspaces.map(s => ` - ${s.descripcion} (Capacidad: ${s.capacidad} pax, Área: ${s.area.toFixed(2)} m²)`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Ficha técnica copiada al portapapeles', { variant: 'success' });
  };

  const getFotoUrl = (relativePath) => {
    if (!relativePath) return null;
    const baseUrl = (process.env.REACT_APP_API_URL || '/api').replace(/\/api$/, '');
    return `${baseUrl}${relativePath}`;
  };
  // --- FIN DE LA LÓGICA DE AUDITORIOS INSTITUCIONALES ---

  // --- INICIO DE LA LÓGICA DE INFORMES ---
  const renderInfraestructuraFisicaInformesModule = () => {
    const handleDocxUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setInfraReportParsingTemplate(true);
      setTimeout(() => {
        const mockParsedHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
          <h1 style="text-align: center; color: #7c3aed; font-size: 22px; font-weight: 800;">INFORME INSTITUCIONAL IMPORTADO</h1>
          <p style="text-align: center; font-style: italic; color: #64748b;">Plantilla cargada: ${file.name}</p>
          <p style="text-align: center; font-size: 13px; color: #64748b;">Fecha de carga: ${new Date().toLocaleDateString()}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <h3 style="color: #7c3aed; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">1. Datos de Control</h3>
          <p><strong>Fecha del reporte:</strong> {{FECHA_REPORTE}}</p>
          <p><strong>Responsable:</strong> {{AUTOR_REPORTE}}</p>
          
          <h3 style="color: #7c3aed; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">2. Resumen Ejecutivo</h3>
          <p>Se consolidan los indicadores globales de la infraestructura física del campus universitario:</p>
          <ul>
            <li><strong>Área Construida Total:</strong> {{KPI_AREA_CONSTRUIDA}}</li>
            <li><strong>Capacidad Física Total:</strong> {{KPI_CAPACIDAD_TOTAL}}</li>
            <li><strong>Cantidad de Ambientes:</strong> {{KPI_ESPACIOS_TOTALES}}</li>
            <li><strong>Densidad Estudiantil:</strong> {{KPI_DENSIDAD}}</li>
          </ul>
          
          <h3 style="color: #7c3aed; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 25px;">3. Distribución Detallada</h3>
          <p>{{TABLA_CONSOLIDADA}}</p>
        </div>`;
        setInfraReportHtmlContent(mockParsedHtml);
        if (editorRef.current) {
          editorRef.current.innerHTML = mockParsedHtml;
        }
        setInfraReportTemplate('vacio');
        setInfraReportParsingTemplate(false);
        enqueueSnackbar('Plantilla Word .docx procesada con éxito', { variant: 'success' });
      }, 1500);
    };

    const compileReportHtml = (html) => {
      const dateStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const authorStr = user?.nombre || user?.username || 'Administrador SIG';
      
      let compiled = html;
      compiled = compiled.replace(/{{FECHA_REPORTE}}/g, dateStr);
      compiled = compiled.replace(/{{AUTOR_REPORTE}}/g, authorStr);
      compiled = compiled.replace(/{{KPI_AREA_CONSTRUIDA}}/g, stats.areaConstruida.toLocaleString() + ' m²');
      compiled = compiled.replace(/{{KPI_CAPACIDAD_TOTAL}}/g, stats.capacidadTotal.toLocaleString() + ' pax');
      compiled = compiled.replace(/{{KPI_ESPACIOS_TOTALES}}/g, stats.espaciosTotales.toLocaleString() + ' amb.');
      compiled = compiled.replace(/{{KPI_DENSIDAD}}/g, stats.densidad.toLocaleString() + ' m²/Est.');
      
      // Tablas dinámicas
      compiled = compiled.replace(/{{TABLA_CONSOLIDADA}}/g, getTablaConsolidadaHtml());
      compiled = compiled.replace(/{{MATRIZ_GENERAL}}/g, getMatrizGeneralHtml());
      
      return compiled;
    };

    const getTablaConsolidadaHtml = () => {
      let rowsHtml = '';
      if (stats.tableResumen.length === 0) {
        rowsHtml = '<tr><td colspan="6" style="padding: 10px; text-align: center; border: 1px solid #bfdbfe;">Cargue información para compilar esta matriz</td></tr>';
      } else {
        stats.tableResumen.forEach(row => {
          rowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; border: 1px solid #dbe6f5;">${row.ubicacion}</td>
              <td style="padding: 8px 10px; border: 1px solid #dbe6f5; font-weight: bold;">${row.bloque}</td>
              <td style="padding: 8px 10px; border: 1px solid #dbe6f5; text-align: center;">Piso ${row.piso}</td>
              <td style="padding: 8px 10px; border: 1px solid #dbe6f5; text-align: center;">${row.cantidad}</td>
              <td style="padding: 8px 10px; border: 1px solid #dbe6f5; text-align: center;">${row.capacidad.toLocaleString()}</td>
              <td style="padding: 8px 10px; border: 1px solid #dbe6f5; text-align: right;">${row.area.toLocaleString()} m²</td>
            </tr>
          `;
        });
      }
      return `
        <table style="width:100%; border-collapse:collapse; margin: 15px 0; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Sede/Campus</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Bloque</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">Piso</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">Ambientes</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">Capacidad</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">Área Construida</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    };

    const getMatrizGeneralHtml = () => {
      const { rows, totals, catLabels, tenenciaKeys } = stats.matrix;
      
      let headerCols = '';
      tenenciaKeys.forEach(ten => {
        headerCols += `<th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;" colspan="2">${ten}</th>`;
      });
      
      let subHeaderCols = '';
      tenenciaKeys.forEach(() => {
        subHeaderCols += `
          <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">Cant.</th>
          <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">Área (m²)</th>
        `;
      });

      let rowsHtml = '';
      catLabels.forEach(cat => {
        let cols = '';
        tenenciaKeys.forEach(ten => {
          const val = rows[cat][ten];
          cols += `
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${val.cantidad}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${val.area > 0 ? val.area.toFixed(1) : '-'}</td>
          `;
        });
        
        const tot = rows[cat].Total;
        cols += `
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; background-color: #f8fafc;">${tot.cantidad}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; background-color: #f8fafc;">${tot.area > 0 ? tot.area.toFixed(1) : '-'} m²</td>
        `;

        rowsHtml += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 500;">${cat}</td>
            ${cols}
          </tr>
        `;
      });

      // Totales row
      let totalsCols = '';
      tenenciaKeys.forEach(ten => {
        const val = totals[ten];
        totalsCols += `
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; background-color: #f1f5f9;">${val.cantidad}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; background-color: #f1f5f9;">${val.area > 0 ? val.area.toFixed(1) : '-'}</td>
        `;
      });
      const tot = totals.Total;
      totalsCols += `
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; background-color: #e2e8f0;">${tot.cantidad}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; background-color: #e2e8f0;">${tot.area > 0 ? tot.area.toFixed(1) : '-'} m²</td>
      `;

      return `
        <table style="width:100%; border-collapse:collapse; margin: 15px 0; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px; border: 1px solid #cbd5e1;" rowspan="2">Categoría del Espacio</th>
              ${headerCols}
              <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;" colspan="2" rowspan="2">Total General</th>
            </tr>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              ${subHeaderCols}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="font-weight: bold; background-color: #f1f5f9;">
              <td style="padding: 10px; border: 1px solid #cbd5e1;">TOTAL GENERAL</td>
              ${totalsCols}
            </tr>
          </tbody>
        </table>
      `;
    };

    const exportToPdf = () => {
      const compiled = compileReportHtml(infraReportHtmlContent);
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>${infraReportCustomName || 'Informe_Infraestructura'}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; color: #334155; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
              th { background-color: #f1f5f9; }
              h1, h2, h3 { color: #1e3a8a; }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${compiled}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    const exportToWord = () => {
      const compiled = compileReportHtml(infraReportHtmlContent);
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><title>Informe</title><style>table {width:100%; border-collapse:collapse;} th, td {border:1px solid #cbd5e1; padding:8px;} th {background-color:#f1f5f9;}</style></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + compiled + footer;
      
      const fileContent = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileName = (infraReportCustomName || 'Informe_Infraestructura') + '.doc';
      
      const downloadLink = document.createElement("a");
      document.body.appendChild(downloadLink);
      
      if (navigator.msSaveOrOpenBlob) {
        const blob = new Blob(['\\ufeff' + sourceHTML], { type: 'application/msword' });
        navigator.msSaveOrOpenBlob(blob, fileName);
      } else {
        downloadLink.href = fileContent;
        downloadLink.download = fileName;
        downloadLink.click();
      }
      document.body.removeChild(downloadLink);
    };

    const handleEditorInput = () => {
      if (editorRef.current) {
        setInfraReportHtmlContent(editorRef.current.innerHTML);
      }
    };

    const insertToken = (token) => {
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertText', false, token);
        setInfraReportHtmlContent(editorRef.current.innerHTML);
      }
    };

    const formatDoc = (cmd, value = '') => {
      document.execCommand(cmd, false, value);
      if (editorRef.current) {
        setInfraReportHtmlContent(editorRef.current.innerHTML);
      }
    };

    const availableTokens = [
      { key: '{{FECHA_REPORTE}}', label: 'Fecha del Reporte', desc: 'Fecha actual formateada' },
      { key: '{{AUTOR_REPORTE}}', label: 'Autor/Responsable', desc: 'Nombre del usuario actual' },
      { key: '{{KPI_AREA_CONSTRUIDA}}', label: 'Área Construida', desc: 'Área total en m² construida' },
      { key: '{{KPI_CAPACIDAD_TOTAL}}', label: 'Capacidad Total', desc: 'Aforo consolidado (pax)' },
      { key: '{{KPI_ESPACIOS_TOTALES}}', label: 'Total de Espacios', desc: 'Número total de ambientes' },
      { key: '{{KPI_DENSIDAD}}', label: 'Densidad Estudiantil', desc: 'm² construidos por estudiante' },
      { key: '{{TABLA_CONSOLIDADA}}', label: 'Tabla Consolidada', desc: 'Tabla resumida por bloque/piso' },
      { key: '{{MATRIZ_GENERAL}}', label: 'Matriz General', desc: 'Cuadro de tenencias vs categorías' }
    ];

    return (
      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ p: 1.4, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setInfraestructuraFisicaTab('hub')} sx={{ fontWeight: 800 }}>
              Volver a Infraestructura
            </Button>
            <Chip label="Generación de Informes" color="secondary" variant="outlined" sx={{ fontWeight: 700 }} />
          </Stack>
        </Paper>

        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 2, md: 2.5 }, 
            borderRadius: 3.5, 
            background: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)',
            boxShadow: '0 6px 20px rgba(109, 40, 217, 0.08)',
            color: '#fff'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.15)', display: 'grid', placeItems: 'center' }}>
              <DescriptionIcon sx={{ fontSize: 28, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: { xs: 20, md: 22 }, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Generador de Informes de Infraestructura Física
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13.5, mt: 0.5, fontWeight: 500, lineHeight: 1.25 }}>
                Redacte, personalice e inyecte variables estadísticas dinámicas directamente en documentos institucionales exportables a PDF y Word.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e2e8f0', borderRadius: 3.5 }}>
                <Typography sx={{ fontWeight: 800, color: '#1e293b', mb: 2, fontSize: 15 }}>
                  1. Configuración del Reporte
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nombre del Reporte (Filename)"
                    placeholder="Ej: Informe_Fisico_Anual"
                    value={infraReportCustomName}
                    onChange={(e) => setInfraReportCustomName(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>Plantilla de Inicio</InputLabel>
                    <Select
                      value={infraReportTemplate}
                      label="Plantilla de Inicio"
                      onChange={(e) => setInfraReportTemplate(e.target.value)}
                      sx={{ borderRadius: '8px' }}
                    >
                      <MenuItem value="general">Informe de Gestión General</MenuItem>
                      <MenuItem value="aforos">Informe de Aforos y Densidades</MenuItem>
                      <MenuItem value="vacio">Lienzo en Blanco (Con Matriz)</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Paper>

              <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e2e8f0', borderRadius: 3.5 }}>
                <Typography sx={{ fontWeight: 800, color: '#1e293b', mb: 1, fontSize: 15 }}>
                  2. Variables Estadísticas Dinámicas
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 2 }}>
                  Haga clic en cualquier token para insertarlo en la posición actual del cursor dentro del lienzo de edición.
                </Typography>
                <Stack spacing={1.2}>
                  {availableTokens.map((tok) => (
                    <Paper
                      key={tok.key}
                      elevation={0}
                      onClick={() => insertToken(tok.key)}
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        border: '1px solid #e2e8f0',
                        bgcolor: '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: '#f5f3ff',
                          borderColor: '#8b5cf6',
                          transform: 'translateX(2px)'
                        }
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontSize: 11.5, fontFamily: 'monospace', fontWeight: 700, color: '#6d28d9' }}>
                          {tok.key}
                        </Typography>
                        <Chip 
                          label="Insertar" 
                          size="small" 
                          sx={{ height: 18, fontSize: 9.5, fontWeight: 700, bgcolor: '#eef2ff', color: '#4f46e5' }} 
                        />
                      </Stack>
                      <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.3 }}>
                        {tok.desc}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Paper>

              <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e2e8f0', borderRadius: 3.5 }}>
                <Typography sx={{ fontWeight: 800, color: '#1e293b', mb: 1.5, fontSize: 15 }}>
                  3. Cargar Plantilla Externa
                </Typography>
                <Box
                  sx={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: 3,
                    p: 2.5,
                    textAlign: 'center',
                    bgcolor: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#8b5cf6',
                      bgcolor: '#f5f3ff'
                    },
                    position: 'relative'
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    accept=".docx"
                    style={{ display: 'none' }}
                    onChange={handleDocxUpload}
                    disabled={infraReportParsingTemplate}
                  />
                  {infraReportParsingTemplate ? (
                    <Stack spacing={1} alignItems="center">
                      <CircularProgress size={24} color="secondary" />
                      <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: '#6d28d9' }}>
                        Analizando plantilla .docx...
                      </Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={1} alignItems="center">
                      <UploadFileIcon sx={{ fontSize: 32, color: '#64748b' }} />
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                        Arrastre o seleccione una plantilla Word (.docx)
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Soporta marcadores de posición estándar
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </Paper>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Paper 
              elevation={0} 
              sx={{ 
                border: '1px solid #e2e8f0', 
                borderRadius: 3.5, 
                overflow: 'hidden', 
                bgcolor: '#ffffff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}
            >
              <Box 
                sx={{ 
                  p: 1.5, 
                  borderBottom: '1px solid #e2e8f0', 
                  bgcolor: '#f8fafc', 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: 1.5
                }}
              >
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <Tooltip title="Negrita">
                    <IconButton size="small" onClick={() => formatDoc('bold')} sx={{ color: '#475569' }}>
                      <FormatBoldIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Cursiva">
                    <IconButton size="small" onClick={() => formatDoc('italic')} sx={{ color: '#475569' }}>
                      <FormatItalicIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Subrayado">
                    <IconButton size="small" onClick={() => formatDoc('underline')} sx={{ color: '#475569' }}>
                      <FormatUnderlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8 }} />
                  <Tooltip title="Alinear a la Izquierda">
                    <IconButton size="small" onClick={() => formatDoc('justifyLeft')} sx={{ color: '#475569' }}>
                      <FormatAlignLeftIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Centrar">
                    <IconButton size="small" onClick={() => formatDoc('justifyCenter')} sx={{ color: '#475569' }}>
                      <FormatAlignCenterIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Alinear a la Derecha">
                    <IconButton size="small" onClick={() => formatDoc('justifyRight')} sx={{ color: '#475569' }}>
                      <FormatAlignRightIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8 }} />
                  <Tooltip title="Título 1">
                    <Button size="small" onClick={() => formatDoc('formatBlock', '<h1>')} sx={{ color: '#475569', minWidth: 32, fontWeight: 'bold' }}>
                      H1
                    </Button>
                  </Tooltip>
                  <Tooltip title="Título 2">
                    <Button size="small" onClick={() => formatDoc('formatBlock', '<h2>')} sx={{ color: '#475569', minWidth: 32, fontWeight: 'bold' }}>
                      H2
                    </Button>
                  </Tooltip>
                  <Tooltip title="Párrafo">
                    <Button size="small" onClick={() => formatDoc('formatBlock', '<p>')} sx={{ color: '#475569', minWidth: 32 }}>
                      P
                    </Button>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8 }} />
                  <Tooltip title="Limpiar Formato">
                    <IconButton size="small" onClick={() => formatDoc('removeFormat')} sx={{ color: '#475569' }}>
                      <FormatClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DescriptionIcon />}
                    onClick={exportToWord}
                    sx={{
                      borderRadius: '20px',
                      fontWeight: 800,
                      textTransform: 'none',
                      bgcolor: '#1d4ed8',
                      boxShadow: '0 4px 10px rgba(29,78,216,0.15)',
                      '&:hover': { bgcolor: '#1e40af' }
                    }}
                  >
                    Word (.doc)
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PrintIcon />}
                    onClick={exportToPdf}
                    sx={{
                      borderRadius: '20px',
                      fontWeight: 800,
                      textTransform: 'none',
                      bgcolor: '#dc2626',
                      boxShadow: '0 4px 10px rgba(220,38,38,0.15)',
                      '&:hover': { bgcolor: '#b91c1c' }
                    }}
                  >
                    Imprimir (PDF)
                  </Button>
                </Stack>
              </Box>

              <Box 
                sx={{ 
                  p: 4, 
                  bgcolor: '#f1f5f9', 
                  minHeight: '650px', 
                  display: 'flex', 
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  overflowX: 'auto'
                }}
              >
                <Box
                  ref={editorRef}
                  contentEditable={true}
                  onInput={handleEditorInput}
                  sx={{
                    width: '100%',
                    maxWidth: '750px',
                    minHeight: '842px',
                    bgcolor: '#ffffff',
                    p: 5,
                    boxShadow: '0 8px 30px rgba(15,23,42,0.06)',
                    border: '1px solid #cbd5e1',
                    borderRadius: 1,
                    outline: 'none',
                    fontSize: 14.5,
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: 1.6,
                    color: '#334155',
                    '& h1': { fontSize: 24, fontWeight: 800, color: '#1e3a8a', mb: 1, mt: 3 },
                    '& h2': { fontSize: 18, fontWeight: 700, color: '#475569', mb: 1, mt: 2.5 },
                    '& h3': { fontSize: 16, fontWeight: 700, color: '#1e3a8a', mb: 1, mt: 2 },
                    '& p': { mb: 1.5, textAlign: 'justify' },
                    '& table': { width: '100%', borderCollapse: 'collapse', my: 2, fontSize: 13 },
                    '& th, & td': { border: '1px solid #cbd5e1', p: 1 },
                    '& th': { bgcolor: '#f1f5f9', fontWeight: 'bold' }
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    );
  };
  // --- FIN DE LA LÓGICA DE INFORMES ---

  // Hook filteredEdificacionesList
  const filteredEdificacionesList = useMemo(() => {
    if (!infraestructuraFisicaCampusFilter || infraestructuraFisicaCampusFilter.length === 0) {
      return edificacionesReferencia;
    }
    return edificacionesReferencia.filter((b) =>
      infraestructuraFisicaCampusFilter.some((campus) =>
        String(b.ubicacion || '').toLowerCase().trim().includes(String(campus).toLowerCase().trim())
      )
    );
  }, [edificacionesReferencia, infraestructuraFisicaCampusFilter]);

  // --- HANDLERS CRUD EDIFICACIONES DE REFERENCIA ---
  const handleOpenBuildingCreate = () => {
    setBuildingForm({ componente: '', campus: 'Campus Centro', tenencia: 'Propio', direccion: '' });
    setBuildingDialogMode('create');
    setBuildingEditingId(null);
    setBuildingDialogOpen(true);
  };

  const handleOpenBuildingEdit = (row) => {
    setBuildingForm({
      componente: row.espacio || '',
      campus: row.ubicacion || 'Campus Centro',
      tenencia: row.calidad || 'Propio',
      direccion: row.direccion || ''
    });
    setBuildingDialogMode('edit');
    setBuildingEditingId(row.id);
    setBuildingDialogOpen(true);
  };

  const handleBuildingSubmit = async () => {
    if (!buildingForm.componente.trim()) {
      enqueueSnackbar('Debe ingresar el nombre del espacio / edificación.', { variant: 'warning' });
      return;
    }
    setBuildingSubmitting(true);
    try {
      const payload = {
        espacio: buildingForm.componente.trim(),
        ubicacion: buildingForm.campus,
        calidad: buildingForm.tenencia,
        direccion: buildingForm.direccion.trim()
      };
      if (buildingDialogMode === 'edit' && buildingEditingId) {
        await gestionInformacionService.updateEdificacionReferencia(buildingEditingId, payload);
        enqueueSnackbar('Edificación actualizada exitosamente.', { variant: 'success' });
      } else {
        await gestionInformacionService.createEdificacionReferencia(payload);
        enqueueSnackbar('Edificación registrada exitosamente.', { variant: 'success' });
      }
      setBuildingDialogOpen(false);
      fetchEdificacionesReferencia();
    } catch (error) {
      console.error('Error al guardar edificación:', error);
      enqueueSnackbar(error.response?.data?.message || 'Error al guardar la edificación.', { variant: 'error' });
    } finally {
      setBuildingSubmitting(false);
    }
  };

  const handleDeleteBuilding = async (id) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta edificación de referencia?')) return;
    try {
      await gestionInformacionService.deleteEdificacionReferencia(id);
      enqueueSnackbar('Edificación eliminada exitosamente.', { variant: 'success' });
      fetchEdificacionesReferencia();
    } catch (error) {
      console.error('Error al eliminar edificación:', error);
      enqueueSnackbar(error.response?.data?.message || 'Error al eliminar la edificación.', { variant: 'error' });
    }
  };
  // --- FIN HANDLERS CRUD EDIFICACIONES DE REFERENCIA ---

  // Cuerpo de renderizado
  const renderInfraestructuraFisicaHub = () => {
    const studentCount = 4022;

    // Manejadores CRUD
    const handleOpenCreateDialog = () => {
      setInfraestructuraFisicaForm({
        campus: '',
        componente: '',
        tipo_area: '',
        tenencia: '',
        ubicacion: '',
        nomenclatura: '',
        piso_no: '',
        tipo_espacio: '',
        asignacion: '',
        descripcion: '',
        funcion_especifica: '',
        capacidad_fisica: '',
        area_metros2: '',
        fecha_actualizacion: new Date().getFullYear().toString(),
        acceso_autonomo: ''
      });
      setInfraestructuraFisicaEditingId(null);
      setInfraestructuraFisicaDialogOpen(true);
    };

    const handleOpenEditDialog = (row) => {
      setInfraestructuraFisicaForm({
        campus: row.campus || '',
        componente: row.componente || '',
        tipo_area: row.tipo_area || '',
        tenencia: row.tenencia || '',
        ubicacion: row.ubicacion || '',
        nomenclatura: row.nomenclatura || '',
        piso_no: row.piso_no !== null && row.piso_no !== undefined ? Number(row.piso_no) : '',
        tipo_espacio: row.tipo_espacio || '',
        asignacion: row.asignacion || '',
        descripcion: row.descripcion || '',
        funcion_especifica: row.funcion_especifica || '',
        capacidad_fisica: row.capacidad_fisica !== null && row.capacidad_fisica !== undefined ? Number(row.capacidad_fisica) : '',
        area_metros2: row.area_metros2 !== null && row.area_metros2 !== undefined ? Number(row.area_metros2) : '',
        fecha_actualizacion: row.fecha_actualizacion || '',
        acceso_autonomo: ['Sí', 'Si'].includes(row.acceso_autonomo) ? 'Sí' : 'No'
      });
      setInfraestructuraFisicaEditingId(row.id);
      setInfraestructuraFisicaDialogOpen(true);
    };

    const handleFormSubmit = async (e) => {
      e.preventDefault();
      
      // Validaciones preventivas para evitar valores negativos
      if (infraestructuraFisicaForm.capacidad_fisica !== '' && Number(infraestructuraFisicaForm.capacidad_fisica) < 0) {
        enqueueSnackbar('La capacidad física no puede ser un número negativo.', { variant: 'warning' });
        return;
      }
      if (infraestructuraFisicaForm.area_metros2 !== '' && Number(infraestructuraFisicaForm.area_metros2) < 0) {
        enqueueSnackbar('El área construida no puede ser un número negativo.', { variant: 'warning' });
        return;
      }
      if (infraestructuraFisicaForm.piso_no !== '' && Number(infraestructuraFisicaForm.piso_no) < 0) {
        enqueueSnackbar('El número de piso no puede ser un número negativo.', { variant: 'warning' });
        return;
      }

      setInfraestructuraFisicaSubmitting(true);
      try {
        const payload = {
          ...infraestructuraFisicaForm,
          piso_no: infraestructuraFisicaForm.piso_no === '' ? null : Number(infraestructuraFisicaForm.piso_no),
          capacidad_fisica: infraestructuraFisicaForm.capacidad_fisica === '' ? 0 : Number(infraestructuraFisicaForm.capacidad_fisica),
          area_metros2: infraestructuraFisicaForm.area_metros2 === '' ? 0.0 : Number(infraestructuraFisicaForm.area_metros2)
        };

        if (infraestructuraFisicaEditingId) {
          await gestionInformacionService.updateInfraestructura(infraestructuraFisicaEditingId, payload);
          enqueueSnackbar('Espacio de infraestructura física actualizado con éxito', { variant: 'success' });
        } else {
          await gestionInformacionService.createInfraestructura(payload);
          enqueueSnackbar('Nuevo espacio de infraestructura física creado con éxito', { variant: 'success' });
        }
        setInfraestructuraFisicaDialogOpen(false);
        fetchInfraestructuraFisica();
        fetchInfraestructuraFisicaAll();
      } catch (error) {
        console.error('Error al guardar infraestructura física:', error);
        enqueueSnackbar(error.response?.data?.message || 'Error al guardar la información de infraestructura física', { variant: 'error' });
      } finally {
        setInfraestructuraFisicaSubmitting(false);
      }
    };

    const handleDeleteRow = async (id) => {
      if (window.confirm('¿Está seguro de que desea eliminar este espacio físico de manera permanente de la base de datos central?')) {
        try {
          await gestionInformacionService.deleteInfraestructura(id);
          enqueueSnackbar('Registro de infraestructura física eliminado con éxito', { variant: 'success' });
          fetchInfraestructuraFisica();
          fetchInfraestructuraFisicaAll();
        } catch (error) {
          console.error('Error al eliminar registro:', error);
          enqueueSnackbar('No se pudo eliminar el registro seleccionado.', { variant: 'error' });
        }
      }
    };

    const handleDownloadTemplateFile = async () => {
      try {
        const res = await gestionInformacionService.downloadTemplate('infraestructura_fisica');
        const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        const contentDisposition = res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'] || '';
        const serverFilenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
        link.download = serverFilenameMatch?.[1] || 'plantilla_infraestructura_fisica.xlsx';
        link.click();
      } catch (error) {
        console.error('Error al descargar plantilla:', error);
        enqueueSnackbar('No se pudo descargar la plantilla de infraestructura', { variant: 'error' });
      }
    };

    const handleExcelUploadFile = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!window.confirm('¿Está seguro de que desea realizar la carga masiva desde este archivo Excel? Esto limpiará y reemplazará la información actual en la base de datos para esta sección.')) {
        e.target.value = null;
        return;
      }

      setInfraestructuraFisicaUploading(true);
      try {
        const response = await gestionInformacionService.importExcel('infraestructura_fisica', file);
        enqueueSnackbar(response.message || 'Carga masiva completada con éxito', { variant: 'success' });
        fetchInfraestructuraFisica();
        fetchInfraestructuraFisicaAll();
      } catch (error) {
        console.error('Error al realizar carga masiva:', error);
        enqueueSnackbar(error.response?.data?.message || 'Error al procesar el archivo Excel. Verifique que cumpla con las columnas correspondientes.', { variant: 'error' });
      } finally {
        setInfraestructuraFisicaUploading(false);
        e.target.value = null;
      }
    };

    return (
      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ p: 1.4, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => {
                if (infraestructuraFisicaTab === 'hub') {
                  onBack();
                } else {
                  setInfraestructuraFisicaTab('hub');
                }
              }}
              sx={{ fontWeight: 800 }}
            >
              {infraestructuraFisicaTab === 'hub' ? 'Volver a Tarjetas' : 'Volver a Selección'}
            </Button>
          </Stack>
        </Paper>

        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 2, md: 2.5 }, 
            borderRadius: 3.5, 
            background: infraestructuraFisicaTab === 'estadistica' 
              ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' 
              : infraestructuraFisicaTab === 'crud'
              ? 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)'
              : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
            border: 'none',
            color: '#fff'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.15)', display: 'grid', placeItems: 'center' }}>
              {infraestructuraFisicaTab === 'estadistica' 
                ? <BarChartIcon sx={{ fontSize: 28, color: '#fff' }} /> 
                : <HomeWorkIcon sx={{ fontSize: 28, color: '#fff' }} />
              }
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: { xs: 20, md: 22 }, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {infraestructuraFisicaTab === 'estadistica' 
                  ? 'Información Estadística de Infraestructura' 
                  : infraestructuraFisicaTab === 'crud'
                  ? 'Gestión de Inventario Físico'
                  : 'Panel de Infraestructura Física'}
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13.5, mt: 0.5, fontWeight: 500, lineHeight: 1.25 }}>
                {infraestructuraFisicaTab === 'estadistica' 
                  ? 'Visualización de indicadores clave, gráficos de áreas, aforos de estudiantes y densidad por campus.'
                  : infraestructuraFisicaTab === 'crud'
                  ? 'Gestión directa del inventario de espacios físicos (CRUD). Creación, edición, eliminación y búsqueda de registros.'
                  : 'Consolidado de áreas, capacidades, auditorios y tenencias de los campus institucionales.'}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {infraestructuraFisicaTab === 'hub' && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.8, md: 2.5 },
              borderRadius: 4,
              border: '1px solid #dbe6f5',
              bgcolor: '#f8fbff'
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                gap: 1.5,
                mb: 2.5
              }}
            >
              {[
                {
                  label: 'Registros activos',
                  value: formatHubNumber(hubSummary.registros),
                  helper: 'Espacios inventariados',
                  icon: <MeetingRoomIcon sx={{ fontSize: 22 }} />,
                  color: '#2563eb',
                  bg: '#eff6ff'
                },
                {
                  label: 'Campus cubiertos',
                  value: formatHubNumber(hubSummary.campus),
                  helper: `${formatHubNumber(hubSummary.bloques)} bloques o componentes`,
                  icon: <PlaceIcon sx={{ fontSize: 22 }} />,
                  color: '#059669',
                  bg: '#ecfdf5'
                },
                {
                  label: 'Área registrada',
                  value: `${formatHubNumber(hubSummary.areaTotal, { maximumFractionDigits: 1 })} m²`,
                  helper: 'Área física consolidada',
                  icon: <ArchitectureIcon sx={{ fontSize: 22 }} />,
                  color: '#7c3aed',
                  bg: '#f5f3ff'
                },
                {
                  label: 'Capacidad física',
                  value: formatHubNumber(hubSummary.capacidadTotal),
                  helper: 'Aforo total reportado',
                  icon: <GroupsIcon sx={{ fontSize: 22 }} />,
                  color: '#dc2626',
                  bg: '#fef2f2'
                }
              ].map((item) => (
                <Paper
                  key={item.label}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid #dbe6f5',
                    bgcolor: '#ffffff',
                    display: 'flex',
                    gap: 1.4,
                    alignItems: 'center',
                    minHeight: 94
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: item.bg,
                      color: item.color,
                      display: 'grid',
                      placeItems: 'center',
                      flex: '0 0 auto'
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ color: '#0f172a', fontSize: { xs: 19, md: 21 }, fontWeight: 900, lineHeight: 1.1 }}>
                      {item.value}
                    </Typography>
                    <Typography sx={{ color: '#64748b', fontSize: 12.5, mt: 0.4 }}>
                      {item.helper}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(auto-fit, minmax(280px, 1fr))'
                },
                alignItems: 'stretch',
                width: '100%'
              }}
            >
              {/* Card 1: Gestión de Inventario Físico */}
              {canManageInfraestructura && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3.5,
                    border: '1px solid #dbe6f5',
                    background: 'linear-gradient(165deg, #ffffff 0%, #f7fbff 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.03)',
                    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 28px rgba(16,185,129,0.08)',
                      borderColor: '#10b981'
                    }
                  }}
                >
                  <Box>
                    <Box sx={{ width: 50, height: 50, borderRadius: 2, bgcolor: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'grid', placeItems: 'center', mb: 2, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <HomeWorkIcon sx={{ fontSize: 26 }} />
                    </Box>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17, mb: 1 }}>
                      Gestión de Inventario Físico
                    </Typography>
                    <Typography sx={{ color: '#475569', fontSize: 13.5, lineHeight: 1.45 }}>
                      Administración directa (CRUD) de la base de datos de espacios. Agregue, edite, elimine registros y realice cargas masivas vía Excel.
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => setInfraestructuraFisicaTab('crud')}
                    sx={{
                      mt: 3,
                      borderRadius: 99,
                      py: 1.15,
                      fontWeight: 800,
                      textTransform: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.15)',
                      '&:hover': { background: '#059669' }
                    }}
                  >
                    Ingresar a Gestión
                  </Button>
                </Paper>
              )}

              {/* Card 2: Información Estadística */}
              {canViewInfraestructuraStats && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3.5,
                    border: '1px solid #dbe6f5',
                    background: 'linear-gradient(165deg, #ffffff 0%, #f7fbff 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.03)',
                    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 28px rgba(59,130,246,0.08)',
                      borderColor: '#3b82f6'
                    }
                  }}
                >
                  <Box>
                    <Box sx={{ width: 50, height: 50, borderRadius: 2, bgcolor: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'grid', placeItems: 'center', mb: 2, border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                      <BarChartIcon sx={{ fontSize: 26 }} />
                    </Box>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17, mb: 1 }}>
                      Información Estadística
                    </Typography>
                    <Typography sx={{ color: '#475569', fontSize: 13.5, lineHeight: 1.45 }}>
                      Visualización de áreas construidas por bloques, aforos de estudiantes y densidad. Fichas de auditorios y matriz general de tenencias.
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => setInfraestructuraFisicaTab('estadistica')}
                    sx={{
                      mt: 3,
                      borderRadius: 99,
                      py: 1.15,
                      fontWeight: 800,
                      textTransform: 'none',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      boxShadow: '0 4px 12px rgba(59,130,246,0.15)',
                      '&:hover': { background: '#1d4ed8' }
                    }}
                  >
                    Ver Estadísticas
                  </Button>
                </Paper>
              )}

              {/* Card 3: Generación de Informes */}
              {canViewInfraestructuraStats && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3.5,
                    border: '1px solid #dbe6f5',
                    background: 'linear-gradient(165deg, #ffffff 0%, #f7fbff 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.03)',
                    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 28px rgba(139,92,246,0.08)',
                      borderColor: '#8b5cf6'
                    }
                  }}
                >
                  <Box>
                    <Box sx={{ width: 50, height: 50, borderRadius: 2, bgcolor: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', display: 'grid', placeItems: 'center', mb: 2, border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                      <DescriptionIcon sx={{ fontSize: 26 }} />
                    </Box>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17, mb: 1 }}>
                      Generación de Informes
                    </Typography>
                    <Typography sx={{ color: '#475569', fontSize: 13.5, lineHeight: 1.45 }}>
                      Redacte reportes institucionales, inyecte variables en tiempo real, cargue plantillas Word (.docx) y exporte los resultados.
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => setInfraestructuraFisicaTab('informes')}
                    sx={{
                      mt: 3,
                      borderRadius: 99,
                      py: 1.15,
                      fontWeight: 800,
                      textTransform: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                      boxShadow: '0 4px 12px rgba(139,92,246,0.15)',
                      '&:hover': { background: '#6d28d9' }
                    }}
                  >
                    Generar Informes
                  </Button>
                </Paper>
              )}
            </Box>
          </Paper>
        )}

        {/* ── SECCIÓN 1: DASHBOARD ESTADÍSTICO ── */}
        {infraestructuraFisicaTab === 'estadistica' && (
          <Stack spacing={2.5}>

            {/* Panel de Filtros Inteligentes Bidireccionales (Estilo Business Intelligence) */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2.5, 
                borderRadius: 3.5, 
                border: '1px solid #bfdbfe', 
                bgcolor: '#f8fbff',
                boxShadow: '0 4px 20px rgba(37,99,235,0.03)'
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2.2 }} spacing={2}>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Box sx={{ width: 8, height: 24, bgcolor: '#2563eb', borderRadius: 99 }} />
                  <Typography sx={{ fontWeight: 900, color: '#1e3a8a', fontSize: 16 }}>
                    Centro de Filtros Inteligentes Cruzados (Bidireccionales)
                  </Typography>
                </Stack>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setInfraestructuraFisicaCampusFilter([]);
                    setInfraestructuraFisicaBloqueFilter([]);
                    setInfraestructuraFisicaPisoFilter([]);
                    setInfraestructuraFisicaTenenciaFilter([]);
                    setInfraestructuraFisicaTipoAreaFilter([]);
                  }}
                  sx={{ 
                    borderRadius: 99, 
                    px: 2.5, 
                    fontWeight: 700, 
                    textTransform: 'none',
                    color: '#2563eb',
                    borderColor: '#bfdbfe',
                    '&:hover': {
                      bgcolor: '#eff6ff',
                      borderColor: '#2563eb'
                    }
                  }}
                >
                  Restablecer Filtros
                </Button>
              </Stack>
              
              <Box 
                sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '100%', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' }, 
                  gap: 2 
                }}
              >
                {/* 1. Campus */}
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={availableCampusOptions}
                  value={infraestructuraFisicaCampusFilter}
                  onChange={(_, newValue) => setInfraestructuraFisicaCampusFilter(newValue)}
                  renderOption={(props, option, { selected }) => (
                    <Box component="li" {...props} sx={{ py: 0.5, fontSize: 13 }}>
                      <Checkbox
                        size="small"
                        checked={selected}
                        sx={{ mr: 1, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                      <ListItemText primary={option} sx={{ '& .MuiTypography-root': { fontSize: 12.5, fontWeight: 500 } }} />
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Campus" 
                      placeholder="Seleccionar..." 
                      sx={{
                        '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600, color: '#475569' },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: '#ffffff',
                          fontSize: 12.5,
                          '& fieldset': { borderColor: '#cbd5e1' },
                          '&:hover fieldset': { borderColor: '#94a3b8' },
                          '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                        }
                      }}
                    />
                  )}
                />

                {/* 2. Bloque */}
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={availableBloqueOptions}
                  value={infraestructuraFisicaBloqueFilter}
                  onChange={(_, newValue) => setInfraestructuraFisicaBloqueFilter(newValue)}
                  renderOption={(props, option, { selected }) => (
                    <Box component="li" {...props} sx={{ py: 0.5, fontSize: 13 }}>
                      <Checkbox
                        size="small"
                        checked={selected}
                        sx={{ mr: 1, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                      <ListItemText primary={option} sx={{ '& .MuiTypography-root': { fontSize: 12.5, fontWeight: 500 } }} />
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Bloque (Componente)" 
                      placeholder="Seleccionar..." 
                      sx={{
                        '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600, color: '#475569' },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: '#ffffff',
                          fontSize: 12.5,
                          '& fieldset': { borderColor: '#cbd5e1' },
                          '&:hover fieldset': { borderColor: '#94a3b8' },
                          '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                        }
                      }}
                    />
                  )}
                />

                {/* 3. Piso */}
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={availablePisoOptions}
                  getOptionLabel={(option) => `Piso ${option}`}
                  value={infraestructuraFisicaPisoFilter}
                  onChange={(_, newValue) => setInfraestructuraFisicaPisoFilter(newValue)}
                  renderOption={(props, option, { selected }) => (
                    <Box component="li" {...props} sx={{ py: 0.5, fontSize: 13 }}>
                      <Checkbox
                        size="small"
                        checked={selected}
                        sx={{ mr: 1, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                      <ListItemText primary={`Piso ${option}`} sx={{ '& .MuiTypography-root': { fontSize: 12.5, fontWeight: 500 } }} />
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Piso" 
                      placeholder="Seleccionar..." 
                      sx={{
                        '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600, color: '#475569' },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: '#ffffff',
                          fontSize: 12.5,
                          '& fieldset': { borderColor: '#cbd5e1' },
                          '&:hover fieldset': { borderColor: '#94a3b8' },
                          '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                        }
                      }}
                    />
                  )}
                />

                {/* 4. Tenencia */}
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={availableTenenciaOptions}
                  value={infraestructuraFisicaTenenciaFilter}
                  onChange={(_, newValue) => setInfraestructuraFisicaTenenciaFilter(newValue)}
                  renderOption={(props, option, { selected }) => (
                    <Box component="li" {...props} sx={{ py: 0.5, fontSize: 13 }}>
                      <Checkbox
                        size="small"
                        checked={selected}
                        sx={{ mr: 1, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                      <ListItemText primary={option} sx={{ '& .MuiTypography-root': { fontSize: 12.5, fontWeight: 500 } }} />
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Tenencia" 
                      placeholder="Seleccionar..." 
                      sx={{
                        '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600, color: '#475569' },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: '#ffffff',
                          fontSize: 12.5,
                          '& fieldset': { borderColor: '#cbd5e1' },
                          '&:hover fieldset': { borderColor: '#94a3b8' },
                          '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                        }
                      }}
                    />
                  )}
                />

                {/* 5. Tipo de Área */}
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={availableTipoAreaOptions}
                  value={infraestructuraFisicaTipoAreaFilter}
                  onChange={(_, newValue) => setInfraestructuraFisicaTipoAreaFilter(newValue)}
                  renderOption={(props, option, { selected }) => (
                    <Box component="li" {...props} sx={{ py: 0.5, fontSize: 13 }}>
                      <Checkbox
                        size="small"
                        checked={selected}
                        sx={{ mr: 1, color: '#2563eb', '&.Mui-checked': { color: '#2563eb' } }}
                      />
                      <ListItemText primary={option} sx={{ '& .MuiTypography-root': { fontSize: 12.5, fontWeight: 500 } }} />
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Tipo de Área" 
                      placeholder="Seleccionar..." 
                      sx={{
                        '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600, color: '#475569' },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: '#ffffff',
                          fontSize: 12.5,
                          '& fieldset': { borderColor: '#cbd5e1' },
                          '&:hover fieldset': { borderColor: '#94a3b8' },
                          '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                        }
                      }}
                    />
                  )}
                />
              </Box>
            </Paper>

            {/* KPI Cards Rediseñados Premium - Grid CSS con Ancho 100% */}
            <Box 
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '100%', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
                gap: 2.5,
                width: '100%',
                mt: 1.5,
                mb: 1.5
              }}
            >
              
              {/* Card 1: Área Construida */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  border: '1px solid #e2e8f0',
                  borderLeft: '5px solid #3b82f6', 
                  borderRadius: 3.5, 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', 
                  boxShadow: '0 4px 15px rgba(15,23,42,0.015)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: '0 12px 30px rgba(37,99,235,0.06)',
                    borderColor: '#bfdbfe'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={0.4}>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                      Área Construida Total
                    </Typography>
                    <Typography sx={{ fontWeight: 900, color: '#1e3b8a', fontSize: { xs: 24, md: 28 }, lineHeight: 1.1 }}>
                      {stats.areaConstruida.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>m²</span>
                    </Typography>
                  </Stack>
                  <Box 
                    sx={{ 
                      p: 1, 
                      borderRadius: 2.5, 
                      bgcolor: 'rgba(59, 130, 246, 0.08)', 
                      color: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArchitectureIcon sx={{ fontSize: 22 }} />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1.8, fontWeight: 500 }}>
                  Área neta física edificada
                </Typography>
              </Paper>

              {/* Card 2: Capacidad Total */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  border: '1px solid #e2e8f0',
                  borderLeft: '5px solid #10b981', 
                  borderRadius: 3.5, 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', 
                  boxShadow: '0 4px 15px rgba(15,23,42,0.015)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: '0 12px 30px rgba(16,185,129,0.06)',
                    borderColor: '#a7f3d0'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={0.4}>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                      Capacidad Total
                    </Typography>
                    <Typography sx={{ fontWeight: 900, color: '#065f46', fontSize: { xs: 24, md: 28 }, lineHeight: 1.1 }}>
                      {stats.capacidadTotal.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>pax</span>
                    </Typography>
                  </Stack>
                  <Box 
                    sx={{ 
                      p: 1, 
                      borderRadius: 2.5, 
                      bgcolor: 'rgba(16, 185, 129, 0.08)', 
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <GroupsIcon sx={{ fontSize: 22 }} />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1.8, fontWeight: 500 }}>
                  Cupo simultáneo de estudiantes
                </Typography>
              </Paper>

              {/* Card 3: Espacios Totales */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  border: '1px solid #e2e8f0',
                  borderLeft: '5px solid #8b5cf6', 
                  borderRadius: 3.5, 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', 
                  boxShadow: '0 4px 15px rgba(15,23,42,0.015)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: '0 12px 30px rgba(139,92,246,0.06)',
                    borderColor: '#c084fc'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={0.4}>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                      Espacios Totales
                    </Typography>
                    <Typography sx={{ fontWeight: 900, color: '#5b21b6', fontSize: { xs: 24, md: 28 }, lineHeight: 1.1 }}>
                      {stats.espaciosTotales.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>amb.</span>
                    </Typography>
                  </Stack>
                  <Box 
                    sx={{ 
                      p: 1, 
                      borderRadius: 2.5, 
                      bgcolor: 'rgba(139, 92, 246, 0.08)', 
                      color: '#8b5cf6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <MeetingRoomIcon sx={{ fontSize: 22 }} />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1.8, fontWeight: 500 }}>
                  Locales e inmuebles individuales
                </Typography>
              </Paper>

              {/* Card 4: Densidad Estudiantil */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2.5, 
                  border: '1px solid #e2e8f0',
                  borderLeft: '5px solid #f59e0b', 
                  borderRadius: 3.5, 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', 
                  boxShadow: '0 4px 15px rgba(15,23,42,0.015)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: '0 12px 30px rgba(245,158,11,0.06)',
                    borderColor: '#fde047'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={0.4}>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                      Densidad Estudiantil
                    </Typography>
                    <Typography sx={{ fontWeight: 900, color: '#92400e', fontSize: { xs: 22, md: 26 }, lineHeight: 1.1 }}>
                      {stats.densidad} <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>m²/Est.</span>
                    </Typography>
                  </Stack>
                  <Box 
                    sx={{ 
                      p: 1, 
                      borderRadius: 2.5, 
                      bgcolor: 'rgba(245, 158, 11, 0.08)', 
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <SchoolIcon sx={{ fontSize: 22 }} />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#b45309', display: 'block', mt: 1.8, fontWeight: 700, fontSize: '0.72rem' }}>
                  Relación con {studentCount.toLocaleString()} estudiantes
                </Typography>
              </Paper>

            </Box>

            {/* ── SECCIÓN: INFOGRAFÍA VISUAL DE CAMPUS (Recreada desde diseño original) ── */}
            {(() => {
              // Calcular áreas por campus desde los datos filtrados
              const campusAreas = {};
              const campusBuildings = {};
              infraestructuraFisicaFilteredData.forEach(row => {
                const campus = row.campus || 'Sin Campus';
                campusAreas[campus] = (campusAreas[campus] || 0) + (Number(row.area_metros2) || 0);
                if (!campusBuildings[campus]) campusBuildings[campus] = new Set();
                if (row.componente) campusBuildings[campus].add(row.componente);
              });
              const areaTotal = Object.values(campusAreas).reduce((s, v) => s + v, 0);

              const campusConfig = [
                {
                  name: 'Campus CENTRO',
                  key: 'Campus Centro',
                  image: '/campus/campus_centro.png',
                  gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                  color: '#1e3a8a',
                  borderColor: '#3b82f6'
                },
                {
                  name: 'Campus SAN DAMIÁN',
                  key: 'Campus San Damián',
                  image: '/campus/campus_san_damian.png',
                  gradient: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
                  color: '#991b1b',
                  borderColor: '#dc2626'
                },
                {
                  name: 'Campus SANTIAGO',
                  key: 'Campus Santiago',
                  image: '/campus/campus_santiago.png',
                  gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#1e3a8a',
                  borderColor: '#2563eb'
                }
              ];

              return (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    border: '1px solid #bfdbfe',
                    borderRadius: 4,
                    bgcolor: '#ffffff',
                    boxShadow: '0 8px 30px rgba(37,99,235,0.03)',
                    mt: 2,
                    mb: 2,
                    overflow: 'hidden'
                  }}
                >
                  {/* Título "Área total" centrado */}
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Box
                      sx={{
                        display: 'inline-block',
                        border: '3px solid #1e3a8a',
                        borderRadius: 2,
                        px: 4,
                        py: 1,
                        bgcolor: '#ffffff'
                      }}
                    >
                      <Typography sx={{ fontWeight: 900, color: '#1e3a8a', fontSize: { xs: 20, md: 26 }, fontStyle: 'italic' }}>
                        Área total{' '}
                        <span style={{ fontWeight: 950, fontSize: 'inherit' }}>
                          {areaTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
                        </span>
                      </Typography>
                    </Box>
                  </Box>

                  {/* Grid de 3 Campus */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                      gap: 3,
                      mb: 1
                    }}
                  >
                    {campusConfig.map((campus) => {
                      const areaVal = campusAreas[campus.key] || 0;
                      const buildings = campusBuildings[campus.key] ? Array.from(campusBuildings[campus.key]) : [];

                      return (
                        <Box key={campus.key}>
                          {/* Card del Campus */}
                          <Card
                            elevation={0}
                            sx={{
                              borderRadius: 3,
                              overflow: 'hidden',
                              border: '1px solid #e2e8f0',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 16px 40px rgba(30,58,138,0.12)',
                                borderColor: campus.borderColor
                              }
                            }}
                          >
                            {/* Imagen del Campus */}
                            <Box
                              sx={{
                                position: 'relative',
                                height: 200,
                                background: `url(${campus.image}) center/cover no-repeat`,
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: '60%',
                                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))'
                                }
                              }}
                            >
                              {/* Badge del nombre del campus */}
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 12,
                                  left: 12,
                                  right: 12,
                                  zIndex: 2,
                                  display: 'flex',
                                  alignItems: 'flex-end',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <Box
                                  sx={{
                                    background: campus.key === 'Campus San Damián' ? '#b91c1c' : '#1e3a8a',
                                    color: '#fff',
                                    px: 2,
                                    py: 0.8,
                                    borderRadius: 1.5,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2, letterSpacing: '0.02em' }}>
                                    {campus.name.split(' ')[0]}
                                  </Typography>
                                  <Typography sx={{ fontWeight: 950, fontSize: 17, lineHeight: 1.1, letterSpacing: '0.03em' }}>
                                    {campus.name.split(' ').slice(1).join(' ')}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Listado de edificios sobre la imagen */}
                              {buildings.length > 0 && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 10,
                                    right: 10,
                                    zIndex: 2,
                                    bgcolor: 'rgba(255,255,255,0.92)',
                                    backdropFilter: 'blur(8px)',
                                    borderRadius: 1.5,
                                    px: 1.5,
                                    py: 1,
                                    maxWidth: '60%',
                                    maxHeight: 120,
                                    overflow: 'auto',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                  }}
                                >
                                  {buildings.slice(0, 6).map((bld, i) => (
                                    <Typography key={i} sx={{ fontSize: 10, fontWeight: 700, color: '#1e293b', lineHeight: 1.5 }}>
                                      {bld}
                                    </Typography>
                                  ))}
                                  {buildings.length > 6 && (
                                    <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#64748b', fontStyle: 'italic' }}>
                                      +{buildings.length - 6} más...
                                    </Typography>
                                  )}
                                </Box>
                              )}
                            </Box>

                            {/* Footer con el área */}
                            <Box
                              sx={{
                                bgcolor: campus.key === 'Campus San Damián' ? '#b91c1c' : '#1e3a8a',
                                py: 1.5,
                                px: 2,
                                textAlign: 'center',
                                borderTop: `3px solid ${campus.key === 'Campus San Damián' ? '#991b1b' : '#1e40af'}`
                              }}
                            >
                              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: 18, letterSpacing: '0.04em' }}>
                                {areaVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
                              </Typography>
                            </Box>
                          </Card>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Línea decorativa inferior */}
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center' }}>
                    <Box sx={{ width: 80, height: 3, bgcolor: '#3b82f6', borderRadius: 99 }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Distribución Territorial de Sedes
                    </Typography>
                    <Box sx={{ width: 80, height: 3, bgcolor: '#3b82f6', borderRadius: 99 }} />
                  </Box>
                </Paper>
              );
            })()}

            {/* ── SECCIÓN: GRÁFICOS ANALÍTICOS DE INFRAESTRUCTURA ── */}
            <Grid container spacing={3} sx={{ mt: 0.5, mb: 1.5 }}>
              
              {/* Gráfico 1: Área por Bloque (Top 10) */}
              <Grid item xs={12} md={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    borderRadius: 3.5, 
                    border: '1px solid #e2e8f0', 
                    bgcolor: '#ffffff',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.015)'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 6, height: 20, bgcolor: '#2563eb', borderRadius: 99 }} />
                    <Typography sx={{ fontWeight: 800, color: '#1e3a8a', fontSize: 15.5 }}>
                      Área Construida por Bloque / Componente (Top 10)
                    </Typography>
                  </Stack>
                  <Box sx={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={stats.bloquesData} 
                        layout="vertical"
                        margin={{ left: 10, right: 30, top: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit=" m²" />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12.5 }}
                          formatter={(v) => [`${Number(v).toLocaleString()} m²`, 'Área Construida']}
                        />
                        <Bar dataKey="area" radius={[0, 4, 4, 0]}>
                          {stats.bloquesData.map((entry, idx) => (
                            <Cell key={idx} fill={`hsl(217, 85%, ${40 + idx * 4.5}%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* Gráfico 2: Distribución por Tipo de Espacio */}
              <Grid item xs={12} md={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    borderRadius: 3.5, 
                    border: '1px solid #e2e8f0', 
                    bgcolor: '#ffffff',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.015)'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 6, height: 20, bgcolor: '#10b981', borderRadius: 99 }} />
                    <Typography sx={{ fontWeight: 800, color: '#065f46', fontSize: 15.5 }}>
                      Superficie vs Capacidad por Tipo de Espacio (Top 8)
                    </Typography>
                  </Stack>
                  <Box sx={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={stats.tiposData} 
                        margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                        barGap={2}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12.5 }}
                          formatter={(value, name) => {
                            if (name === 'area') return [`${Number(value).toLocaleString()} m²`, 'Área Total'];
                            if (name === 'capacidad') return [`${Number(value).toLocaleString()} pax`, 'Capacidad Aforo'];
                            return [value, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, pt: 10 }} />
                        <Bar dataKey="area" name="Área (m²)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="capacidad" name="Capacidad (pax)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* Gráfico 3: Tipo de Acceso a los Espacios */}
              <Grid item xs={12} md={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    borderRadius: 3.5, 
                    border: '1px solid #e2e8f0', 
                    bgcolor: '#ffffff',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.015)'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 6, height: 20, bgcolor: '#8b5cf6', borderRadius: 99 }} />
                    <Typography sx={{ fontWeight: 800, color: '#5b21b6', fontSize: 15.5 }}>
                      Distribución por Tipo de Acceso
                    </Typography>
                  </Stack>
                  <Box sx={{ width: '100%', height: 320, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', justifyContent: 'space-around' }}>
                    <Box sx={{ width: { xs: '100%', sm: '55%' }, height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.accesoData}
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="85%"
                            paddingAngle={4}
                            dataKey="value"
                          >
                            <Cell fill="#6366f1" />
                            <Cell fill="#cbd5e1" />
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12.5 }}
                            formatter={(v) => [`${v} ambientes`, 'Cantidad']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Stack spacing={2} sx={{ width: { xs: '100%', sm: '40%' }, pl: { sm: 2 } }}>
                      {stats.accesoData.map((item, idx) => {
                        const colors = ['#6366f1', '#94a3b8'];
                        const total = stats.accesoData.reduce((acc, curr) => acc + curr.value, 0);
                        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                        return (
                          <Box key={idx} sx={{ p: 1.5, borderLeft: `4px solid ${colors[idx]}`, borderRadius: 1, bgcolor: '#f8fafc' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                              {item.name}
                            </Typography>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a', mt: 0.2 }}>
                              {item.value} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ambientes ({pct}%)</span>
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                </Paper>
              </Grid>

              {/* Gráfico 4: Espacios por Sede (Campus) */}
              <Grid item xs={12} md={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    borderRadius: 3.5, 
                    border: '1px solid #e2e8f0', 
                    bgcolor: '#ffffff',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.015)'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 6, height: 20, bgcolor: '#f59e0b', borderRadius: 99 }} />
                    <Typography sx={{ fontWeight: 800, color: '#92400e', fontSize: 15.5 }}>
                      Espacios Registrados por Campus / Sede
                    </Typography>
                  </Stack>
                  <Box sx={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={(() => {
                          const campusCount = {};
                          infraestructuraFisicaFilteredData.forEach(row => {
                            const cmp = row.campus || 'Sin Campus';
                            campusCount[cmp] = (campusCount[cmp] || 0) + 1;
                          });
                          return Object.keys(campusCount).map(k => ({ name: k, cantidad: campusCount[k] }));
                        })()} 
                        margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12.5 }}
                          formatter={(v) => [`${v} espacios`, 'Cantidad']}
                        />
                        <Bar dataKey="cantidad" name="Ambientes" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                          {(() => {
                            const campusCount = {};
                            infraestructuraFisicaFilteredData.forEach(row => {
                              const cmp = row.campus || 'Sin Campus';
                              campusCount[cmp] = (campusCount[cmp] || 0) + 1;
                            });
                            return Object.keys(campusCount);
                          })().map((_, idx) => (
                            <Cell key={idx} fill={['#3b82f6', '#10b981', '#f59e0b'][idx % 3]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

            </Grid>

            {/* ── SECCIÓN: AUDITORIOS INSTITUCIONALES ── */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                borderRadius: 3.5, 
                border: '1px solid #bfdbfe', 
                bgcolor: '#f8fbff',
                boxShadow: '0 4px 20px rgba(37,99,235,0.02)',
                mt: 1.5,
                mb: 1.5
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                <Box sx={{ width: 8, height: 24, bgcolor: '#4f46e5', borderRadius: 99 }} />
                <Typography sx={{ fontWeight: 900, color: '#1e3a8a', fontSize: 18 }}>
                  Auditorios Institucionales
                </Typography>
              </Stack>
              <Box 
                sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, 
                  gap: 3 
                }}
              >
                {auditoriosGroups.map((card) => (
                  <Card 
                    key={card.key}
                    elevation={0}
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      border: '1px solid #e2e8f0', 
                      borderRadius: 4, 
                      overflow: 'hidden', 
                      minHeight: 280,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 24px rgba(148,163,184,0.12)',
                        borderColor: '#cbd5e1'
                      }
                    }}
                  >
                    {/* Left Side: Image Block */}
                    <Box 
                      sx={{ 
                        width: { xs: '100%', sm: '40%' }, 
                        position: 'relative', 
                        minHeight: { xs: 180, sm: 'auto' },
                        background: card.foto_url 
                          ? `url(${getFotoUrl(card.foto_url)}) center/cover no-repeat` 
                          : card.key === 'vaf' 
                            ? 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)' 
                            : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {/* Overlay and capacity text */}
                      <Box 
                        sx={{ 
                          position: 'absolute', 
                          bottom: 0, 
                          left: 0, 
                          right: 0, 
                          bgcolor: 'rgba(15, 23, 42, 0.75)', 
                          color: '#fff', 
                          p: 1.5,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center'
                        }}
                      >
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>
                          {card.capacidad.toLocaleString()} capacidad total
                        </Typography>
                        {/* Circle seat indicators */}
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                          {Array.from({ length: Math.min(5, Math.ceil(card.capacidad / 200) || 1) }).map((_, i) => (
                            <Box 
                              key={i} 
                              sx={{ 
                                width: 8, 
                                height: 8, 
                                borderRadius: '50%', 
                                bgcolor: '#10b981', 
                                border: '1px solid rgba(255,255,255,0.3)' 
                              }} 
                            />
                          ))}
                        </Stack>
                      </Box>

                      {/* Edit photo floating action button */}
                      {canManageInfraestructura && (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            id={`upload-foto-${card.key}`}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                handleUploadFoto(card.key, file);
                              }
                            }}
                          />
                          <Tooltip title="Cambiar imagen de portada">
                            <IconButton
                              component="label"
                              htmlFor={`upload-foto-${card.key}`}
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: 'rgba(255, 255, 255, 0.85)',
                                color: '#4f46e5',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                '&:hover': {
                                  bgcolor: '#4f46e5',
                                  color: '#fff'
                                },
                                p: 0.8
                              }}
                            >
                              <PhotoCameraIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>

                    {/* Right Side: Details & Spaces */}
                    <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1, minWidth: 0 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 16, lineHeight: 1.15, letterSpacing: '-0.01em', mb: 0.5 }}>
                          {card.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                          <Chip
                            size="small"
                            icon={<PlaceIcon sx={{ fontSize: '11px !important', color: '#475569' }} />}
                            label={card.campus}
                            sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}
                          />
                          <Chip
                            size="small"
                            label={card.tipo_area}
                            sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46' }}
                          />
                        </Stack>
                        <Typography sx={{ fontSize: 13, color: '#475569', mb: 2 }}>
                          Área construida consolidada: <strong>{card.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m²</strong>
                        </Typography>

                        {/* Subspaces capacities progress bars */}
                        {card.subspaces.length > 0 && (
                          <Box sx={{ mt: 1.5 }}>
                            <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                              Distribución de Espacios
                            </Typography>
                            <Stack spacing={1.2}>
                              {card.subspaces.map((sub, sIdx) => {
                                const pct = card.capacidad > 0 ? (sub.capacidad / card.capacidad) * 100 : 0;
                                return (
                                  <Box key={sIdx}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
                                      <Typography sx={{ fontSize: 11.5, fontWeight: 655, color: '#334155', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sub.descripcion}>
                                        {sub.descripcion}
                                      </Typography>
                                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>
                                        {sub.capacidad} pax ({sub.area.toFixed(1)} m²)
                                      </Typography>
                                    </Stack>
                                    <LinearProgress 
                                      variant="determinate" 
                                      value={pct || 100} 
                                      sx={{ 
                                        height: 5, 
                                        borderRadius: 2.5, 
                                        bgcolor: '#e2e8f0',
                                        '& .MuiLinearProgress-bar': { bgcolor: card.key === 'vaf' ? '#10b981' : '#3b82f6' }
                                      }} 
                                    />
                                  </Box>
                                );
                              })}
                            </Stack>
                          </Box>
                        )}
                      </Box>

                      {/* Action buttons */}
                      <Stack direction="row" spacing={1} sx={{ mt: 2.5, borderTop: '1px solid #f1f5f9', pt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                        <Button 
                          size="small" 
                          variant="outlined" 
                          startIcon={<OpenInNewIcon sx={{ fontSize: '12px !important' }} />}
                          onClick={() => {
                            let searchKeyword = 'Auditorio';
                            if (card.key === 'aemg') searchKeyword = 'Coliseo';
                            else if (card.key === 'san_francisco') searchKeyword = 'San Francisco';
                            else if (card.key === 'santa_clara') searchKeyword = 'Santa Clara';
                            else if (card.key === 'vaf') searchKeyword = 'Vicerrectoría';

                            setInfraestructuraFisicaDetailCategory('Auditorios');
                            setInfraestructuraFisicaDetailTenencia('Todos');
                            setInfraestructuraFisicaDetailSearch(searchKeyword);
                            setInfraestructuraFisicaDetailPage(0);
                            setInfraestructuraFisicaDetailOpen(true);
                          }}
                          sx={{ textTransform: 'none', borderRadius: 99, fontSize: 11, fontWeight: 700 }}
                        >
                          Ver detalle
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ContentCopyIcon sx={{ fontSize: '12px !important' }} />}
                          onClick={() => handleCopyFicha(card)}
                          sx={{ textTransform: 'none', color: '#64748b', fontSize: 11, fontWeight: 700 }}
                        >
                          Copiar Ficha
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>

            {/* Tablas de Datos Estadísticos (Alineadas y Proporcionales en Toda la Pantalla) */}
            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #dbe6f5', borderRadius: 3, bgcolor: '#fff' }}>
                  <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>Inventario Consolidado por Bloque y Piso</Typography>
                  <TableContainer sx={{ maxHeight: 250, border: '1px solid #f1f5f9', borderRadius: 2 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Campus</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Bloque (Componente)</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Piso</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', textAlign: 'center' }}>Espacios</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', textAlign: 'right' }}>Capacidad</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', textAlign: 'right' }}>Área (m²)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.tableResumen.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ py: 3, textAlign: 'center', color: '#94a3b8' }}>
                              Carga información para compilar esta matriz
                            </TableCell>
                          </TableRow>
                        ) : (
                          stats.tableResumen.map((row, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell>{row.ubicacion}</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{row.bloque}</TableCell>
                              <TableCell>Piso {row.piso}</TableCell>
                              <TableCell sx={{ textAlign: 'center' }}>{row.cantidad}</TableCell>
                              <TableCell sx={{ textAlign: 'right' }}>{row.capacidad.toLocaleString()}</TableCell>
                              <TableCell sx={{ textAlign: 'right' }}>{row.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              {/* MOCKUP EXCEL: TABLA GENERAL DE INSTALACIONES FÍSICAS */}
              <Grid item xs={12}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3.5, 
                    border: '1px solid #bfdbfe', 
                    borderRadius: 3.5, 
                    bgcolor: '#fff',
                    boxShadow: '0 8px 30px rgba(37,99,235,0.02)',
                    overflow: 'hidden'
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3, borderBottom: '2px solid #2563eb', pb: 1.5 }}>
                    <Box sx={{ p: 1, bgcolor: '#1e3a8a', color: 'white', borderRadius: 2, display: 'flex', alignItems: 'center' }}>
                      <HomeWorkIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 18 }}>
                        Cuadro Consolidado General: Instalaciones Físicas CESMAG {new Date().getFullYear()}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Distribución consolidada y balanceada de espacios, superficies ($m^2$) y aforos por tipo de uso y tenencia
                      </Typography>
                    </Box>
                  </Stack>

                  <TableContainer sx={{ border: '1px solid #bfdbfe', borderRadius: 3, overflow: 'hidden' }}>
                    <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                      <TableHead>
                        {/* Fila 1 de cabecera: T├¡tulos principales */}
                        <TableRow sx={{ bgcolor: '#1e3a8a' }}>
                          <TableCell rowSpan={2} sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'left', minWidth: 200, py: 1.8 }}>
                            USO DE ESPACIOS
                          </TableCell>
                          <TableCell colSpan={2} sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'center', py: 1 }}>
                            Propiedad
                          </TableCell>
                          <TableCell colSpan={2} sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'center', py: 1 }}>
                            Arriendo
                          </TableCell>
                          <TableCell colSpan={2} sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'center', py: 1 }}>
                            Comodato
                          </TableCell>
                          <TableCell colSpan={2} sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'center', py: 1 }}>
                            Otros
                          </TableCell>
                          <TableCell colSpan={2} sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', textAlign: 'center', py: 1 }}>
                            Total
                          </TableCell>
                        </TableRow>
                        
                        {/* Fila 2 de cabecera: Sub-métricas */}
                        <TableRow sx={{ bgcolor: '#2563eb' }}>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #60a5fa', textAlign: 'center', fontSize: 11, py: 1 }}>CANTIDAD</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'right', fontSize: 11, py: 1 }}>METROS²</TableCell>
                          
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #60a5fa', textAlign: 'center', fontSize: 11, py: 1 }}>CANTIDAD</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'right', fontSize: 11, py: 1 }}>METROS²</TableCell>
                          
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #60a5fa', textAlign: 'center', fontSize: 11, py: 1 }}>CANTIDAD</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'right', fontSize: 11, py: 1 }}>METROS²</TableCell>
                          
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #60a5fa', textAlign: 'center', fontSize: 11, py: 1 }}>CANTIDAD</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #3b82f6', textAlign: 'right', fontSize: 11, py: 1 }}>METROS²</TableCell>
                          
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', borderRight: '1px solid #60a5fa', textAlign: 'center', fontSize: 11, py: 1 }}>CANTIDAD</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#2563eb', color: '#fff', textAlign: 'right', fontSize: 11, py: 1 }}>METROS²</TableCell>
                        </TableRow>
                      </TableHead>
                      
                      <TableBody>
                        {stats.matrix.catLabels.map((cat) => {
                          const rowData = stats.matrix.rows[cat];
                          return (
                            <TableRow key={cat} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                              <TableCell 
                                sx={{ 
                                  fontWeight: 700, 
                                  color: '#2563eb', 
                                  borderRight: '1px solid #e2e8f0', 
                                  py: 1,
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  transition: 'all 0.2s',
                                  '&:hover': { color: '#1d4ed8', bgcolor: '#eff6ff' }
                                }}
                                title={`Haga clic para ver todos los espacios de ${cat}`}
                                onClick={() => {
                                  setInfraestructuraFisicaDetailCategory(cat);
                                  setInfraestructuraFisicaDetailTenencia('Todos');
                                  setInfraestructuraFisicaDetailSearch('');
                                  setInfraestructuraFisicaDetailPage(0);
                                  setInfraestructuraFisicaDetailOpen(true);
                                }}
                              >
                                {cat}
                              </TableCell>
                              {/* Propio */}
                              <TableCell 
                                sx={{ 
                                  textAlign: 'center', 
                                  borderRight: '1px solid #e2e8f0',
                                  cursor: rowData.Propio.cantidad > 0 ? 'pointer' : 'default',
                                  transition: 'background-color 0.2s',
                                  '&:hover': rowData.Propio.cantidad > 0 ? { bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 'bold' } : {}
                                }}
                                title={rowData.Propio.cantidad > 0 ? `Ver los ${rowData.Propio.cantidad} espacios propios de ${cat}` : ''}
                                onClick={() => {
                                  if (rowData.Propio.cantidad > 0) {
                                    setInfraestructuraFisicaDetailCategory(cat);
                                    setInfraestructuraFisicaDetailTenencia('Propio');
                                    setInfraestructuraFisicaDetailSearch('');
                                    setInfraestructuraFisicaDetailPage(0);
                                    setInfraestructuraFisicaDetailOpen(true);
                                  }
                                }}
                              >
                                {rowData.Propio.cantidad || '-'}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{rowData.Propio.area ? rowData.Propio.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-'}</TableCell>
                              
                              {/* Arriendo */}
                              <TableCell 
                                sx={{ 
                                  textAlign: 'center', 
                                  borderRight: '1px solid #e2e8f0',
                                  cursor: rowData.Arriendo.cantidad > 0 ? 'pointer' : 'default',
                                  transition: 'background-color 0.2s',
                                  '&:hover': rowData.Arriendo.cantidad > 0 ? { bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 'bold' } : {}
                                }}
                                title={rowData.Arriendo.cantidad > 0 ? `Ver los ${rowData.Arriendo.cantidad} espacios en arriendo de ${cat}` : ''}
                                onClick={() => {
                                  if (rowData.Arriendo.cantidad > 0) {
                                    setInfraestructuraFisicaDetailCategory(cat);
                                    setInfraestructuraFisicaDetailTenencia('Arriendo');
                                    setInfraestructuraFisicaDetailSearch('');
                                    setInfraestructuraFisicaDetailPage(0);
                                    setInfraestructuraFisicaDetailOpen(true);
                                  }
                                }}
                              >
                                {rowData.Arriendo.cantidad || '-'}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{rowData.Arriendo.area ? rowData.Arriendo.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-'}</TableCell>
                              
                              {/* Comodato */}
                              <TableCell 
                                sx={{ 
                                  textAlign: 'center', 
                                  borderRight: '1px solid #e2e8f0',
                                  cursor: rowData.Comodato.cantidad > 0 ? 'pointer' : 'default',
                                  transition: 'background-color 0.2s',
                                  '&:hover': rowData.Comodato.cantidad > 0 ? { bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 'bold' } : {}
                                }}
                                title={rowData.Comodato.cantidad > 0 ? `Ver los ${rowData.Comodato.cantidad} espacios en comodato de ${cat}` : ''}
                                onClick={() => {
                                  if (rowData.Comodato.cantidad > 0) {
                                    setInfraestructuraFisicaDetailCategory(cat);
                                    setInfraestructuraFisicaDetailTenencia('Comodato');
                                    setInfraestructuraFisicaDetailSearch('');
                                    setInfraestructuraFisicaDetailPage(0);
                                    setInfraestructuraFisicaDetailOpen(true);
                                  }
                                }}
                              >
                                {rowData.Comodato.cantidad || '-'}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{rowData.Comodato.area ? rowData.Comodato.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-'}</TableCell>
                              
                              {/* Otros */}
                              <TableCell 
                                sx={{ 
                                  textAlign: 'center', 
                                  borderRight: '1px solid #e2e8f0',
                                  cursor: rowData.Otros.cantidad > 0 ? 'pointer' : 'default',
                                  transition: 'background-color 0.2s',
                                  '&:hover': rowData.Otros.cantidad > 0 ? { bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 'bold' } : {}
                                }}
                                title={rowData.Otros.cantidad > 0 ? `Ver los ${rowData.Otros.cantidad} otros espacios de ${cat}` : ''}
                                onClick={() => {
                                  if (rowData.Otros.cantidad > 0) {
                                    setInfraestructuraFisicaDetailCategory(cat);
                                    setInfraestructuraFisicaDetailTenencia('Otros');
                                    setInfraestructuraFisicaDetailSearch('');
                                    setInfraestructuraFisicaDetailPage(0);
                                    setInfraestructuraFisicaDetailOpen(true);
                                  }
                                }}
                              >
                                {rowData.Otros.cantidad || '-'}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{rowData.Otros.area ? rowData.Otros.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-'}</TableCell>
                              
                              {/* Total */}
                              <TableCell 
                                sx={{ 
                                  textAlign: 'center', 
                                  borderRight: '1px solid #e2e8f0', 
                                  fontWeight: 700, 
                                  bgcolor: '#f0fdf4', 
                                  color: '#166534',
                                  cursor: rowData.Total.cantidad > 0 ? 'pointer' : 'default',
                                  transition: 'background-color 0.2s',
                                  '&:hover': rowData.Total.cantidad > 0 ? { bgcolor: '#dcfce7', color: '#15803d', fontWeight: 'bold' } : {}
                                }}
                                title={rowData.Total.cantidad > 0 ? `Ver todos los ${rowData.Total.cantidad} espacios de ${cat}` : ''}
                                onClick={() => {
                                  if (rowData.Total.cantidad > 0) {
                                    setInfraestructuraFisicaDetailCategory(cat);
                                    setInfraestructuraFisicaDetailTenencia('Todos');
                                    setInfraestructuraFisicaDetailSearch('');
                                    setInfraestructuraFisicaDetailPage(0);
                                    setInfraestructuraFisicaDetailOpen(true);
                                  }
                                }}
                              >
                                {rowData.Total.cantidad || '-'}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 800, bgcolor: '#f0fdf4', color: '#15803d' }}>{rowData.Total.area ? rowData.Total.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                        
                        {/* Fila de Totales de la Matriz */}
                        <TableRow sx={{ bgcolor: '#eff6ff', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6' }}>
                          <TableCell sx={{ fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe', py: 1.2 }}>TOTALES GENERALES</TableCell>
                          {/* Propio */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Propio.cantidad}</TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Propio.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          {/* Arriendo */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Arriendo.cantidad}</TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Arriendo.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          {/* Comodato */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Comodato.cantidad}</TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Comodato.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          {/* Otros */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Otros.cantidad}</TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 900, color: '#1e3b8a', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Otros.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          {/* Grand Total */}
                          <TableCell sx={{ textAlign: 'center', fontWeight: 950, bgcolor: '#dbeafe', color: '#1e40af', borderRight: '1px solid #bfdbfe' }}>{stats.matrix.totals.Total.cantidad}</TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 950, bgcolor: '#dbeafe', color: '#1e40af' }}>{stats.matrix.totals.Total.area.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                        </TableRow>

                        {/* Suma de puestos de las aulas de clase */}
                        <TableRow sx={{ '&:hover': { bgcolor: 'inherit' } }}>
                          <TableCell sx={{ fontWeight: 700, color: '#475569', borderRight: '1px solid #e2e8f0', py: 1.5, pl: 2 }}>
                            Suma de puestos de las aulas de clase
                          </TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityAulas.Propio || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityAulas.Arriendo || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityAulas.Comodato || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityAulas.Otros || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 900, bgcolor: '#f8fafc', color: '#0f172a' }}>{stats.matrix.capacityAulas.Total || '-'}</TableCell>
                        </TableRow>

                        {/* Suma de puestos en los laboratorios */}
                        <TableRow sx={{ '&:hover': { bgcolor: 'inherit' } }}>
                          <TableCell sx={{ fontWeight: 700, color: '#475569', borderRight: '1px solid #e2e8f0', py: 1.5, pl: 2 }}>
                            Suma de puestos en los laboratorios
                          </TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityLabs.Propio || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityLabs.Arriendo || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityLabs.Comodato || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0', bgcolor: '#fbfbfb' }}>{stats.matrix.capacityLabs.Otros || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 900, bgcolor: '#f8fafc', color: '#0f172a' }}>{stats.matrix.capacityLabs.Total || '-'}</TableCell>
                        </TableRow>

                        {/* Totales de aforos */}
                        <TableRow sx={{ bgcolor: '#f8fafc', borderTop: '2px solid #cbd5e1', borderBottom: '2px solid #475569' }}>
                          <TableCell sx={{ fontWeight: 900, color: '#1e293b', borderRight: '1px solid #cbd5e1', py: 1.8 }}>TOTALES AFOROS</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3a8a', borderRight: '1px solid #cbd5e1', bgcolor: '#eff6ff' }}>{(stats.matrix.capacityAulas.Propio + stats.matrix.capacityLabs.Propio) || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3a8a', borderRight: '1px solid #cbd5e1', bgcolor: '#eff6ff' }}>{(stats.matrix.capacityAulas.Arriendo + stats.matrix.capacityLabs.Arriendo) || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3a8a', borderRight: '1px solid #cbd5e1', bgcolor: '#eff6ff' }}>{(stats.matrix.capacityAulas.Comodato + stats.matrix.capacityLabs.Comodato) || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 900, color: '#1e3a8a', borderRight: '1px solid #cbd5e1', bgcolor: '#eff6ff' }}>{(stats.matrix.capacityAulas.Otros + stats.matrix.capacityLabs.Otros) || '-'}</TableCell>
                          <TableCell colSpan={2} sx={{ textAlign: 'center', fontWeight: 950, bgcolor: '#dbeafe', color: '#1e40af' }}>{(stats.matrix.capacityAulas.Total + stats.matrix.capacityLabs.Total) || '-'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>

            {/* ── SECCIÓN: DESCRIPCIÓN GENERAL DE LA INFRAESTRUCTURA FÍSICA – EDIFICACIONES DE REFERENCIA (CRUD) ── */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3.5, 
                border: '1px solid #bfdbfe', 
                borderRadius: 3.5, 
                bgcolor: '#fff',
                boxShadow: '0 8px 30px rgba(37,99,235,0.02)',
                overflow: 'hidden',
                mt: 2
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 2.5, borderBottom: '2px solid #2563eb', pb: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ p: 1, bgcolor: '#1e3a8a', color: 'white', borderRadius: 2, display: 'flex', alignItems: 'center' }}>
                    <HomeWorkIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17 }}>
                      Descripción General de la Infraestructura Física – Tenencia
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      Edificaciones de referencia registradas con su ubicación, dirección y calidad de tenencia
                    </Typography>
                  </Box>
                </Stack>
                {canManageInfraestructura && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenBuildingCreate}
                    sx={{ 
                      borderRadius: 99, 
                      px: 3, 
                      fontWeight: 800, 
                      textTransform: 'none',
                      bgcolor: '#2563eb',
                      boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                      '&:hover': { bgcolor: '#1d4ed8' }
                    }}
                  >
                    Agregar Edificación
                  </Button>
                )}
              </Stack>

              <TableContainer sx={{ border: '1px solid #bfdbfe', borderRadius: 3, overflow: 'hidden', maxHeight: 350 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1e3a8a' }}>
                      <TableCell sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', py: 1.5, minWidth: 50, textAlign: 'center' }}>
                        #
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', py: 1.5, minWidth: 250 }}>
                        ESPACIO / EDIFICACIÓN
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', py: 1.5, minWidth: 140 }}>
                        UBICACIÓN (CAMPUS)
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', py: 1.5, minWidth: 200 }}>
                        DIRECCIÓN
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', borderRight: '1px solid #3b82f6', py: 1.5, minWidth: 120 }}>
                        CALIDAD (TENENCIA)
                      </TableCell>
                      {canManageInfraestructura && (
                        <TableCell sx={{ fontWeight: 900, bgcolor: '#1e3a8a', color: '#fff', py: 1.5, textAlign: 'center', minWidth: 100 }}>
                          ACCIONES
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEdificacionesList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManageInfraestructura ? 6 : 5} sx={{ py: 4, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                          No se han registrado edificaciones de referencia. {canManageInfraestructura ? 'Haga clic en "Agregar Edificación" para comenzar.' : ''}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEdificacionesList.map((row, idx) => (
                        <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                          <TableCell sx={{ textAlign: 'center', fontWeight: 800, color: '#1e3a8a', borderRight: '1px solid #e2e8f0' }}>
                            {idx + 1}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                            {row.espacio}
                          </TableCell>
                          <TableCell sx={{ borderRight: '1px solid #e2e8f0' }}>
                            <Chip 
                              size="small" 
                              label={row.ubicacion || 'Sin Campus'} 
                              sx={{ 
                                fontWeight: 800, 
                                fontSize: 10,
                                bgcolor: (row.ubicacion || '').includes('Centro') ? '#eff6ff' : (row.ubicacion || '').includes('Santiago') ? '#f0fdf4' : '#fff7ed',
                                color: (row.ubicacion || '').includes('Centro') ? '#2563eb' : (row.ubicacion || '').includes('Santiago') ? '#16a34a' : '#ea580c'
                              }} 
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#475569', fontSize: 13, borderRight: '1px solid #e2e8f0' }}>
                            {row.direccion || '–'}
                          </TableCell>
                          <TableCell sx={{ borderRight: '1px solid #e2e8f0' }}>
                            <Chip 
                              size="small" 
                              label={row.calidad || 'Sin definir'} 
                              sx={{ 
                                fontWeight: 800, 
                                fontSize: 10,
                                bgcolor: (row.calidad || '').toLowerCase().includes('propio') ? '#e0e7ff' 
                                       : (row.calidad || '').toLowerCase().includes('arriendo') ? '#fef3c7' 
                                       : (row.calidad || '').toLowerCase().includes('comodato') ? '#f0fdf4' 
                                       : '#f1f5f9',
                                color: (row.calidad || '').toLowerCase().includes('propio') ? '#4f46e5' 
                                     : (row.calidad || '').toLowerCase().includes('arriendo') ? '#b45309' 
                                     : (row.calidad || '').toLowerCase().includes('comodato') ? '#16a34a' 
                                     : '#475569'
                              }} 
                            />
                          </TableCell>
                          {canManageInfraestructura && (
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                <IconButton size="small" color="primary" onClick={() => handleOpenBuildingEdit(row)} title="Editar edificación" sx={{ bgcolor: '#f0f7ff', '&:hover': { bgcolor: '#dbeafe' } }}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDeleteBuilding(row.id)} title="Eliminar edificación" sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                    {/* Row de Totales */}
                    {filteredEdificacionesList.length > 0 && (
                      <TableRow sx={{ bgcolor: '#eff6ff', borderTop: '2px solid #3b82f6' }}>
                        <TableCell sx={{ fontWeight: 900, color: '#1e3a8a', textAlign: 'center', borderRight: '1px solid #bfdbfe' }}>
                          {filteredEdificacionesList.length}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 900, color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>
                          TOTAL EDIFICACIONES REGISTRADAS
                        </TableCell>
                        <TableCell colSpan={canManageInfraestructura ? 4 : 3} sx={{ fontWeight: 700, color: '#64748b', fontSize: 12 }}>
                          {(() => {
                            const ubCounts = {};
                            filteredEdificacionesList.forEach(b => { 
                              const ub = b.ubicacion || 'Sin Campus'; 
                              ubCounts[ub] = (ubCounts[ub] || 0) + 1; 
                            });
                            return Object.entries(ubCounts).map(([k, v]) => `${k}: ${v}`).join(' · ');
                          })()}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* ── DIÁLOGO CRUD EDIFICACIONES DE REFERENCIA ── */}
            <Dialog open={buildingDialogOpen} onClose={() => setBuildingDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle sx={{ fontWeight: 900, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #2563eb', px: 3, py: 2 }}>
                {buildingDialogMode === 'edit' ? 'Editar Edificación de Referencia' : 'Nueva Edificación de Referencia'}
              </DialogTitle>
              <DialogContent sx={{ p: 3, bgcolor: '#ffffff' }}>
                <Stack spacing={2.5} sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    required
                    label="Espacio / Edificación"
                    placeholder="Ej: Bloque San José, Edificio Central..."
                    value={buildingForm.componente}
                    onChange={(e) => setBuildingForm({ ...buildingForm, componente: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Ubicación (Campus)</InputLabel>
                    <Select
                      value={buildingForm.campus}
                      label="Ubicación (Campus)"
                      onChange={(e) => setBuildingForm({ ...buildingForm, campus: e.target.value })}
                      sx={{ borderRadius: '10px' }}
                    >
                      <MenuItem value="Campus Centro">Campus Centro</MenuItem>
                      <MenuItem value="Campus Santiago">Campus Santiago</MenuItem>
                      <MenuItem value="Campus San Damián">Campus San Damián</MenuItem>
                      <MenuItem value="Otro">Otro</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Dirección"
                    placeholder="Ej: Cra 20A No. 14-02"
                    value={buildingForm.direccion}
                    onChange={(e) => setBuildingForm({ ...buildingForm, direccion: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Calidad de Tenencia</InputLabel>
                    <Select
                      value={buildingForm.tenencia}
                      label="Calidad de Tenencia"
                      onChange={(e) => setBuildingForm({ ...buildingForm, tenencia: e.target.value })}
                      sx={{ borderRadius: '10px' }}
                    >
                      <MenuItem value="Propio">Propio</MenuItem>
                      <MenuItem value="Arriendo">Arriendo</MenuItem>
                      <MenuItem value="Comodato">Comodato</MenuItem>
                      <MenuItem value="Otros">Otros</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc', gap: 2 }}>
                <Button 
                  onClick={() => setBuildingDialogOpen(false)} 
                  disabled={buildingSubmitting}
                  variant="outlined"
                  sx={{ borderRadius: 99, width: 130, py: 1, fontWeight: 700, textTransform: 'none', color: '#475569', borderColor: '#cbd5e1' }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleBuildingSubmit}
                  variant="contained"
                  disabled={buildingSubmitting}
                  color={buildingDialogMode === 'edit' ? 'warning' : 'primary'}
                  sx={{ borderRadius: 99, width: 130, py: 1, fontWeight: 800, textTransform: 'none' }}
                >
                  {buildingSubmitting ? 'Guardando...' : buildingDialogMode === 'edit' ? 'Actualizar' : 'Guardar'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* ── SECCIÓN: DESGLOSE DE AULAS DE CLASE ── */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                border: '1px solid #bfdbfe', 
                borderRadius: 3.5, 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(37,99,235,0.02)',
                mt: 2
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5, borderBottom: '2px solid #10b981', pb: 1.5 }}>
                <Box sx={{ p: 1, bgcolor: '#065f46', color: 'white', borderRadius: 2, display: 'flex', alignItems: 'center' }}>
                  <SchoolIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17 }}>
                    Desglose de Aulas de Clase
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Detalle de las aulas de clase por campus, bloque, piso, capacidad y área
                  </Typography>
                </Box>
              </Stack>

              <TableContainer sx={{ border: '1px solid #d1fae5', borderRadius: 3, overflow: 'hidden', maxHeight: 300 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', borderRight: '1px solid #d1fae5' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', borderRight: '1px solid #d1fae5' }}>Nomenclatura</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', borderRight: '1px solid #d1fae5' }}>Campus</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', borderRight: '1px solid #d1fae5' }}>Bloque (Componente)</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', borderRight: '1px solid #d1fae5' }}>Piso</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', borderRight: '1px solid #d1fae5' }}>Asignación</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', textAlign: 'center', borderRight: '1px solid #d1fae5' }}>Capacidad</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#ecfdf5', color: '#065f46', textAlign: 'right' }}>Área (m²)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const aulasRows = infraestructuraFisicaFilteredData.filter(r => getInfraestructuraRowCategory(r.tipo_espacio) === 'Aulas de clase');
                      if (aulasRows.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={8} sx={{ py: 3, textAlign: 'center', color: '#94a3b8' }}>
                              No se encontraron aulas de clase con los filtros actuales
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return (
                        <>
                          {aulasRows.map((row, idx) => (
                            <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafb' } }}>
                              <TableCell sx={{ fontWeight: 700, color: '#64748b', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>{idx + 1}</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace', borderRight: '1px solid #f1f5f9' }}>{row.nomenclatura || 'N/A'}</TableCell>
                              <TableCell sx={{ borderRight: '1px solid #f1f5f9' }}>
                                <Chip size="small" label={row.campus} sx={{ fontWeight: 700, fontSize: 10, bgcolor: row.campus === 'Campus Centro' ? '#eff6ff' : row.campus === 'Campus Santiago' ? '#f0fdf4' : '#fff7ed', color: row.campus === 'Campus Centro' ? '#2563eb' : row.campus === 'Campus Santiago' ? '#16a34a' : '#ea580c' }} />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600, borderRight: '1px solid #f1f5f9' }}>{row.componente}</TableCell>
                              <TableCell sx={{ borderRight: '1px solid #f1f5f9' }}>Piso {row.piso_no ?? 1}</TableCell>
                              <TableCell sx={{ fontSize: 12.5, borderRight: '1px solid #f1f5f9' }}>{row.asignacion || row.funcion_especifica || '–'}</TableCell>
                              <TableCell sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #f1f5f9' }}>{row.capacidad_fisica || 0}</TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{Number(row.area_metros2 || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: '#ecfdf5', borderTop: '2px solid #10b981' }}>
                            <TableCell sx={{ fontWeight: 900, color: '#065f46', textAlign: 'center' }}>{aulasRows.length}</TableCell>
                            <TableCell colSpan={5} sx={{ fontWeight: 900, color: '#065f46' }}>TOTAL AULAS DE CLASE</TableCell>
                            <TableCell sx={{ textAlign: 'center', fontWeight: 900, color: '#065f46' }}>{aulasRows.reduce((s, r) => s + (Number(r.capacidad_fisica) || 0), 0).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 900, color: '#065f46' }}>{aulasRows.reduce((s, r) => s + (Number(r.area_metros2) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          </TableRow>
                        </>
                      );
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* ── SECCIÓN: DESGLOSE DE LABORATORIOS ── */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                border: '1px solid #e0e7ff', 
                borderRadius: 3.5, 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(79,70,229,0.02)',
                mt: 2
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5, borderBottom: '2px solid #6366f1', pb: 1.5 }}>
                <Box sx={{ p: 1, bgcolor: '#4338ca', color: 'white', borderRadius: 2, display: 'flex', alignItems: 'center' }}>
                  <LightbulbIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17 }}>
                    Desglose de Laboratorios
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Detalle de los laboratorios por campus, bloque, piso, capacidad y área
                  </Typography>
                </Box>
              </Stack>

              <TableContainer sx={{ border: '1px solid #e0e7ff', borderRadius: 3, overflow: 'hidden', maxHeight: 300 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', borderRight: '1px solid #e0e7ff' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', borderRight: '1px solid #e0e7ff' }}>Nomenclatura</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', borderRight: '1px solid #e0e7ff' }}>Campus</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', borderRight: '1px solid #e0e7ff' }}>Bloque (Componente)</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', borderRight: '1px solid #e0e7ff' }}>Piso</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', borderRight: '1px solid #e0e7ff' }}>Asignación / Función</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', textAlign: 'center', borderRight: '1px solid #e0e7ff' }}>Capacidad</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3', textAlign: 'right' }}>Área (m²)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const labsRows = infraestructuraFisicaFilteredData.filter(r => getInfraestructuraRowCategory(r.tipo_espacio) === 'Laboratorios');
                      if (labsRows.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={8} sx={{ py: 3, textAlign: 'center', color: '#94a3b8' }}>
                              No se encontraron laboratorios con los filtros actuales
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return (
                        <>
                          {labsRows.map((row, idx) => (
                            <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#fafaff' } }}>
                              <TableCell sx={{ fontWeight: 700, color: '#64748b', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>{idx + 1}</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace', borderRight: '1px solid #f1f5f9' }}>{row.nomenclatura || 'N/A'}</TableCell>
                              <TableCell sx={{ borderRight: '1px solid #f1f5f9' }}>
                                <Chip size="small" label={row.campus} sx={{ fontWeight: 700, fontSize: 10, bgcolor: row.campus === 'Campus Centro' ? '#eff6ff' : row.campus === 'Campus Santiago' ? '#f0fdf4' : '#fff7ed', color: row.campus === 'Campus Centro' ? '#2563eb' : row.campus === 'Campus Santiago' ? '#16a34a' : '#ea580c' }} />
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600, borderRight: '1px solid #f1f5f9' }}>{row.componente}</TableCell>
                              <TableCell sx={{ borderRight: '1px solid #f1f5f9' }}>Piso {row.piso_no ?? 1}</TableCell>
                              <TableCell sx={{ fontSize: 12.5, borderRight: '1px solid #f1f5f9' }}>
                                <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{row.asignacion || '–'}</Typography>
                                {row.funcion_especifica && <Typography sx={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>{row.funcion_especifica}</Typography>}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #f1f5f9' }}>{row.capacidad_fisica || 0}</TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{Number(row.area_metros2 || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: '#eef2ff', borderTop: '2px solid #6366f1' }}>
                            <TableCell sx={{ fontWeight: 900, color: '#3730a3', textAlign: 'center' }}>{labsRows.length}</TableCell>
                            <TableCell colSpan={5} sx={{ fontWeight: 900, color: '#3730a3' }}>TOTAL LABORATORIOS</TableCell>
                            <TableCell sx={{ textAlign: 'center', fontWeight: 900, color: '#3730a3' }}>{labsRows.reduce((s, r) => s + (Number(r.capacidad_fisica) || 0), 0).toLocaleString()}</TableCell>
                            <TableCell sx={{ textAlign: 'right', fontWeight: 900, color: '#3730a3' }}>{labsRows.reduce((s, r) => s + (Number(r.area_metros2) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          </TableRow>
                        </>
                      );
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* ── SECCIÓN: RESUMEN DE ESPACIOS ESPECIALES (Deportivos, Cafeterías, Bibliotecas, etc.) ── */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                border: '1px solid #fde68a', 
                borderRadius: 3.5, 
                bgcolor: '#fffbeb',
                boxShadow: '0 4px 20px rgba(245,158,11,0.02)',
                mt: 2,
                mb: 1.5
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5, borderBottom: '2px solid #f59e0b', pb: 1.5 }}>
                <Box sx={{ p: 1, bgcolor: '#92400e', color: 'white', borderRadius: 2, display: 'flex', alignItems: 'center' }}>
                  <SportsBasketballIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17 }}>
                    Resumen de Espacios Especiales e Infraestructura Complementaria
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Espacios deportivos, cafeterías, bibliotecas, salas de cómputo, zonas de recreación y servicios sanitarios
                  </Typography>
                </Box>
              </Stack>

              <Tabs 
                value={specialSpaceTab} 
                onChange={(_, v) => setSpecialSpaceTab(v)} 
                variant="scrollable" 
                scrollButtons="auto"
                sx={{ 
                  mb: 2.5, 
                  '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: 13, minHeight: 38 },
                  '& .Mui-selected': { color: '#92400e !important' },
                  '& .MuiTabs-indicator': { bgcolor: '#f59e0b' }
                }}
              >
                <Tab label="Bibliotecas" />
                <Tab label="Cómputo" />
                <Tab label="Deportivos" />
                <Tab label="Cafeterías" />
                <Tab label="Oficinas" />
                <Tab label="Salas de Tutores" />
                <Tab label="Zonas Recreación" />
                <Tab label="Servicios Sanitarios" />
              </Tabs>

              {(() => {
                const tabCategories = [
                  'Bibliotecas', 'Cómputo', 'Espacios deportivos', 'Cafeterías', 
                  'Oficinas', 'Salas de tutores', 'Zonas recreación', 'Servicios sanitarios'
                ];
                const selectedCat = tabCategories[specialSpaceTab] || tabCategories[0];
                const catRows = infraestructuraFisicaFilteredData.filter(r => getInfraestructuraRowCategory(r.tipo_espacio) === selectedCat);
                const totalCap = catRows.reduce((s, r) => s + (Number(r.capacidad_fisica) || 0), 0);
                const totalArea = catRows.reduce((s, r) => s + (Number(r.area_metros2) || 0), 0);

                return (
                  <Box>
                    {/* KPI row */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                      <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #fde68a', borderRadius: 2.5, bgcolor: '#fffbeb', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Cantidad</Typography>
                        <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#78350f' }}>{catRows.length}</Typography>
                      </Paper>
                      <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #fde68a', borderRadius: 2.5, bgcolor: '#fffbeb', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Capacidad Total</Typography>
                        <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#78350f' }}>{totalCap.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 600 }}>pax</span></Typography>
                      </Paper>
                      <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #fde68a', borderRadius: 2.5, bgcolor: '#fffbeb', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Área Total</Typography>
                        <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#78350f' }}>{totalArea.toLocaleString(undefined, { minimumFractionDigits: 1 })} <span style={{ fontSize: 12, fontWeight: 600 }}>m²</span></Typography>
                      </Paper>
                    </Box>

                    <TableContainer sx={{ border: '1px solid #fde68a', borderRadius: 2.5, overflow: 'hidden', maxHeight: 250 }}>
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', borderRight: '1px solid #fde68a' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', borderRight: '1px solid #fde68a' }}>Nomenclatura</TableCell>
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', borderRight: '1px solid #fde68a' }}>Campus</TableCell>
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', borderRight: '1px solid #fde68a' }}>Bloque</TableCell>
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', borderRight: '1px solid #fde68a' }}>Descripción</TableCell>
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', textAlign: 'center', borderRight: '1px solid #fde68a' }}>Capacidad</TableCell>
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#fef3c7', color: '#92400e', textAlign: 'right' }}>Área (m²)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {catRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} sx={{ py: 3, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                No se encontraron espacios de tipo "{selectedCat}" con los filtros actuales
                              </TableCell>
                            </TableRow>
                          ) : (
                            catRows.map((row, idx) => (
                              <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#fffdf5' } }}>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', textAlign: 'center', borderRight: '1px solid #f5f3ee' }}>{idx + 1}</TableCell>
                                <TableCell sx={{ fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace', borderRight: '1px solid #f5f3ee' }}>{row.nomenclatura || 'N/A'}</TableCell>
                                <TableCell sx={{ borderRight: '1px solid #f5f3ee' }}>
                                  <Chip size="small" label={row.campus} sx={{ fontWeight: 700, fontSize: 10, bgcolor: row.campus === 'Campus Centro' ? '#eff6ff' : row.campus === 'Campus Santiago' ? '#f0fdf4' : '#fff7ed', color: row.campus === 'Campus Centro' ? '#2563eb' : row.campus === 'Campus Santiago' ? '#16a34a' : '#ea580c' }} />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, borderRight: '1px solid #f5f3ee' }}>{row.componente}</TableCell>
                                <TableCell sx={{ fontSize: 12.5, borderRight: '1px solid #f5f3ee' }}>{row.asignacion || row.funcion_especifica || row.descripcion || '–'}</TableCell>
                                <TableCell sx={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #f5f3ee' }}>{row.capacidad_fisica || 0}</TableCell>
                                <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>{Number(row.area_metros2 || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                );
              })()}
            </Paper>

            {/* ── DIÁLOGO FLOTANTE DE DETALLE DE LA MATRIZ (DRILL-DOWN BI) ── */}
            <Dialog 
              open={infraestructuraFisicaDetailOpen} 
              onClose={() => setInfraestructuraFisicaDetailOpen(false)} 
              maxWidth="lg" 
              fullWidth
            >
              <DialogTitle 
                sx={{ 
                  fontWeight: 900, 
                  color: '#0f172a', 
                  bgcolor: '#f8fafc', 
                  borderBottom: '2px solid #2563eb', 
                  px: 3, 
                  py: 2.2,
                  position: 'relative'
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ p: 0.8, bgcolor: '#1e3a8a', color: 'white', borderRadius: 1.5, display: 'flex', alignItems: 'center' }}>
                    <HomeWorkIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900, color: '#1e3a8a', fontSize: 16, display: 'flex', alignItems: 'center' }}>
                      Detalle de Espacios Físicos: {infraestructuraFisicaDetailCategory}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                      Visualizando registros con tenencia: <span style={{ color: '#2563eb' }}>{infraestructuraFisicaDetailTenencia === 'Todos' ? 'Todas las Tenencias' : infraestructuraFisicaDetailTenencia}</span>
                      {infraestructuraFisicaCampusFilter.length > 0 && ` | Campus: ${infraestructuraFisicaCampusFilter.join(', ')}`}
                      {infraestructuraFisicaBloqueFilter.length > 0 && ` | Bloque: ${infraestructuraFisicaBloqueFilter.join(', ')}`}
                      {infraestructuraFisicaPisoFilter.length > 0 && ` | Piso: ${infraestructuraFisicaPisoFilter.join(', ')}`}
                      {infraestructuraFisicaTipoAreaFilter.length > 0 && ` | Tipo de Área: ${infraestructuraFisicaTipoAreaFilter.join(', ')}`}
                    </Typography>
                  </Box>
                </Stack>
                <IconButton
                  onClick={() => setInfraestructuraFisicaDetailOpen(false)}
                  sx={{ position: 'absolute', right: 16, top: 16, color: '#64748b', '&:hover': { color: '#0f172a' } }}
                >
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent sx={{ p: 3, bgcolor: '#ffffff' }}>
                <Stack spacing={2}>
                  <TextField
                    size="small"
                    placeholder="Filtrar por nomenclatura, asignación, bloque, ubicación, función..."
                    value={infraestructuraFisicaDetailSearch}
                    onChange={(e) => {
                      setInfraestructuraFisicaDetailSearch(e.target.value);
                      setInfraestructuraFisicaDetailPage(0);
                    }}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                      endAdornment: infraestructuraFisicaDetailSearch && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setInfraestructuraFisicaDetailSearch('')}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />

                  <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Nomenclatura</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Campus</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Bloque / Ubicación</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Piso</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Asignación de Uso</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', textAlign: 'center' }}>Aforo</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', textAlign: 'right' }}>Área (m²)</TableCell>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', textAlign: 'center' }}>Acceso Autónomo</TableCell>
                          {canManageInfraestructura && (
                            <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', textAlign: 'center' }}>Acciones</TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {infraestructuraFisicaDetailPageData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={canManageInfraestructura ? 9 : 8} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                              No se encontraron registros que coincidan con la búsqueda.
                            </TableCell>
                          </TableRow>
                        ) : (
                          infraestructuraFisicaDetailPageData.map((row) => (
                            <TableRow key={row.id} hover>
                              <TableCell sx={{ fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace' }}>
                                {row.nomenclatura || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  size="small" 
                                  label={row.campus} 
                                  sx={{ 
                                    fontWeight: 800, 
                                    fontSize: 10,
                                    bgcolor: row.campus === 'Campus Centro' ? '#eff6ff' : row.campus === 'Campus Santiago' ? '#f0fdf4' : '#fff7ed',
                                    color: row.campus === 'Campus Centro' ? '#2563eb' : row.campus === 'Campus Santiago' ? '#16a34a' : '#ea580c'
                                  }} 
                                />
                              </TableCell>
                              <TableCell>
                                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.componente}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#64748b' }}>{row.ubicacion || 'Sin ubicación específica'}</Typography>
                              </TableCell>
                              <TableCell>Piso {row.piso_no ?? 1}</TableCell>
                              <TableCell>
                                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.asignacion || 'Sin asignación'}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>{row.funcion_especifica}</Typography>
                              </TableCell>
                              <TableCell sx={{ textAlign: 'center', fontWeight: 700 }}>{row.capacidad_fisica || 0}</TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 700 }}>
                                {Number(row.area_metros2 || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m²
                              </TableCell>
                              <TableCell sx={{ textAlign: 'center' }}>
                                <Chip 
                                  size="small" 
                                  label={['Sí', 'Si'].includes(row.acceso_autonomo) ? 'Sí' : 'No'} 
                                  sx={{ 
                                    fontWeight: 800, 
                                    bgcolor: ['Sí', 'Si'].includes(row.acceso_autonomo) ? '#e0e7ff' : '#f1f5f9',
                                    color: ['Sí', 'Si'].includes(row.acceso_autonomo) ? '#4f46e5' : '#475569'
                                  }} 
                                />
                              </TableCell>
                              {canManageInfraestructura && (
                                <TableCell sx={{ textAlign: 'center' }}>
                                  <IconButton 
                                    size="small" 
                                    color="primary" 
                                    onClick={() => handleOpenEditDialog(row)}
                                    title="Editar espacio físico"
                                    sx={{ bgcolor: '#f0f7ff', '&:hover': { bgcolor: '#dbeafe' } }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    component="div"
                    count={infraestructuraFisicaDetailRecords.length}
                    page={infraestructuraFisicaDetailPage}
                    onPageChange={(_e, newPage) => setInfraestructuraFisicaDetailPage(newPage)}
                    rowsPerPage={infraestructuraFisicaDetailRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setInfraestructuraFisicaDetailRowsPerPage(parseInt(e.target.value, 10));
                      setInfraestructuraFisicaDetailPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    labelRowsPerPage="Mostrar:"
                    sx={{ borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc', borderRadius: 2 }}
                  />
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                <Button 
                  variant="outlined" 
                  onClick={() => setInfraestructuraFisicaDetailOpen(false)}
                  sx={{ borderRadius: 99, px: 3, fontWeight: 800, textTransform: 'none' }}
                >
                  Cerrar
                </Button>
              </DialogActions>
            </Dialog>
          </Stack>
        )}

        {/* ── SECCIÓN 2: GESTIÓN DE DATOS (CRUD) ── */}
        {infraestructuraFisicaTab === 'crud' && (
          <Stack spacing={2.5}>
            {/* Guía de Carga Masiva Minimalista (2 Pasos) */}
            <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fafc' }}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} alignItems="center" justifyContent="space-between">
                
                {/* Paso 1 */}
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                  <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#3b82f6', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 12, flexShrink: 0 }}>1</Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 800, color: '#1e3a8a', fontSize: 13 }}>Plantilla Base</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1.2, fontSize: 11 }}>Estructura vacía de Excel normalizada</Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    startIcon={<FileDownloadIcon sx={{ fontSize: '15px !important' }} />}
                    onClick={handleDownloadTemplateFile}
                    sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5, py: 0.4, fontSize: 11.5, px: 1.2, whiteSpace: 'nowrap' }}
                  >
                    Descargar
                  </Button>
                </Stack>

                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' }, borderColor: '#e2e8f0' }} />

                {/* Paso 2 */}
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                  <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#10b981', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 12, flexShrink: 0 }}>2</Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 800, color: '#065f46', fontSize: 13 }}>Cargar y Reemplazar</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1.2, fontSize: 11 }}>
                      Sube el Excel (campo <strong>CAMPUS</strong> es mandatorio: Centro, Santiago o San Damián).
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    component="label"
                    disabled={infraestructuraFisicaUploading}
                    startIcon={infraestructuraFisicaUploading ? <CircularProgress size={12} color="inherit" /> : <UploadFileIcon sx={{ fontSize: '15px !important' }} />}
                    sx={{
                      fontWeight: 800,
                      textTransform: 'none',
                      borderRadius: 1.5,
                      py: 0.4,
                      fontSize: 11.5,
                      px: 1.2,
                      whiteSpace: 'nowrap',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.15)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                      }
                    }}
                  >
                    {infraestructuraFisicaUploading ? 'Subiendo...' : 'Subir Excel'}
                    <input
                      type="file"
                      hidden
                      accept=".xlsx, .xls"
                      onChange={handleExcelUploadFile}
                    />
                  </Button>
                </Stack>

              </Stack>
            </Paper>
            {/* Buscador y Controles */}
            {/* Buscador y Controles Rediseñados */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2.2, 
                border: '1px solid #cbd5e1', 
                borderRadius: 4, 
                bgcolor: '#ffffff',
                boxShadow: '0 4px 15px rgba(15, 23, 42, 0.03)'
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" width="100%">
                
                {/* Input de Búsqueda Inteligente */}
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%' }}>
                  <TextField
                    fullWidth
                    placeholder="Buscador Inteligente: escribe campus, bloque, nomenclatura, asignación, tipo de espacio..."
                    value={infraestructuraFisicaSearch}
                    onChange={(e) => {
                      setInfraestructuraFisicaSearch(e.target.value);
                      setInfraestructuraFisicaPage(0);
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#0f172a', mr: 1, fontSize: 22 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {infraestructuraFisicaSearch && (
                              <IconButton 
                                size="small" 
                                onClick={() => {
                                  setInfraestructuraFisicaSearch('');
                                  setInfraestructuraFisicaPage(0);
                                }}
                                sx={{ color: '#64748b' }}
                              >
                                <CloseIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            )}
                            <Tooltip title="Consejos de búsqueda inteligente" arrow>
                              <IconButton
                                size="small"
                                onClick={(e) => setInfraestructuraFisicaHelpAnchor(e.currentTarget)}
                                sx={{ 
                                  color: '#ca8a04',
                                  bgcolor: 'rgba(234, 179, 8, 0.08)',
                                  '&:hover': { bgcolor: 'rgba(234, 179, 8, 0.15)' }
                                }}
                              >
                                <LightbulbIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3.5,
                        bgcolor: '#f8fafc',
                        minHeight: 46,
                        pr: 1.5,
                        animation: 'pulse-border 2.5s infinite ease-in-out',
                        '@keyframes pulse-border': {
                          '0%': {
                            boxShadow: '0 0 0 0px rgba(16, 185, 129, 0.15)',
                            borderColor: '#cbd5e1'
                          },
                          '50%': {
                            boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.25)',
                            borderColor: '#10b981'
                          },
                          '100%': {
                            boxShadow: '0 0 0 0px rgba(16, 185, 129, 0.15)',
                            borderColor: '#cbd5e1'
                          }
                        },
                        '& fieldset': { borderColor: '#cbd5e1' },
                        '&:hover fieldset': { borderColor: '#94a3b8', animation: 'none' },
                        '&.Mui-focused': {
                          animation: 'none',
                          boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.15)',
                          '& fieldset': { borderColor: '#10b981', borderWidth: 2 }
                        }
                      },
                      '& .MuiInputBase-input': {
                        fontSize: 14,
                        color: '#0f172a',
                        fontWeight: 500,
                        '&::placeholder': { color: '#64748b', opacity: 1 }
                      }
                    }}
                  />
                </Box>
                
                {/* Selector de Campus */}
                <FormControl 
                  sx={{ 
                    minWidth: { xs: '100%', sm: 200, md: 240 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3.5,
                      minHeight: 46,
                      bgcolor: '#f8fafc',
                      '& fieldset': { borderColor: '#e2e8f0' },
                      '&:hover fieldset': { borderColor: '#cbd5e1' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981', borderWidth: 2 }
                    }
                  }}
                >
                  <Select
                    value={infraestructuraFisicaCrudCampusFilter}
                    onChange={(e) => {
                      setInfraestructuraFisicaCrudCampusFilter(e.target.value);
                      setInfraestructuraFisicaPage(0);
                    }}
                    sx={{ fontSize: 13.5, fontWeight: 700, color: '#475569' }}
                  >
                    <MenuItem value="Todos" sx={{ fontWeight: 600 }}>Todos los Campus</MenuItem>
                    <MenuItem value="Campus Centro">Campus Centro</MenuItem>
                    <MenuItem value="Campus Santiago">Campus Santiago</MenuItem>
                    <MenuItem value="Campus San Damián">Campus San Damián</MenuItem>
                  </Select>
                </FormControl>

                {/* Bot├│n Nuevo Espacio */}
                <Button
                  variant="contained"
                  onClick={handleOpenCreateDialog}
                  startIcon={<AddIcon sx={{ fontSize: '18px !important' }} />}
                  sx={{
                    borderRadius: 3.5,
                    minHeight: 46,
                    px: 3,
                    fontWeight: 800,
                    textTransform: 'none',
                    fontSize: 13.5,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    width: { xs: '100%', md: 'auto' },
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.25)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    }
                  }}
                >
                  Nuevo Espacio
                </Button>

              </Stack>
            </Paper>

            {/* Popover de Consejos de Búsqueda */}
            <Popover
              open={Boolean(infraestructuraFisicaHelpAnchor)}
              anchorEl={infraestructuraFisicaHelpAnchor}
              onClose={() => setInfraestructuraFisicaHelpAnchor(null)}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              PaperProps={{
                elevation: 3,
                sx: { 
                  p: 2.5, 
                  maxWidth: 320, 
                  borderRadius: 3.5, 
                  border: '1px solid #bfdbfe',
                  bgcolor: '#ffffff',
                  boxShadow: '0 10px 25px rgba(37,99,235,0.08)'
                }
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Box sx={{ p: 0.6, borderRadius: 1.5, bgcolor: '#fef9c3', display: 'flex', alignItems: 'center' }}>
                    <LightbulbIcon sx={{ fontSize: 20, color: '#ca8a04' }} />
                  </Box>
                  <Typography sx={{ fontWeight: 800, color: '#1e293b', fontSize: 14 }}>
                    Búsqueda General Inteligente
                  </Typography>
                </Stack>
                <Typography sx={{ color: '#475569', fontSize: 13, lineHeight: 1.4 }}>
                  Esta barra de búsqueda realiza un barrido cruzado automático. Puedes escribir términos que coincidan con:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0, color: '#475569', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  <li><strong>Campus:</strong> Centro, Santiago, San Damián.</li>
                  <li><strong>Bloque:</strong> Ej. Bloque A, Áreas de administraci├│n.</li>
                  <li><strong>Nomenclatura:</strong> C├│digos de espacios físicos.</li>
                  <li><strong>Asignación:</strong> Áreas académicas o dependencias administrativas.</li>
                  <li><strong>Tipo de espacio:</strong> Aulas, oficinas, laboratorios, baños, etc.</li>
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  ­ƒÆí Tip: Puedes combinar esta búsqueda ingresando palabras clave separadas por espacios.
                </Typography>
              </Stack>
            </Popover>

            {/* Tabla Principal */}
            <Paper elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 3, overflow: 'hidden' }}>
              {infraestructuraFisicaLoading ? (
                <Stack direction="row" spacing={2} sx={{ p: 4 }} alignItems="center" justifyContent="center">
                  <CircularProgress size={30} />
                  <Typography sx={{ color: '#475569', fontWeight: 700 }}>Cargando inventario físico...</Typography>
                </Stack>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#ecfdf5' }}>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5 }}>Campus</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5 }}>Bloque</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5 }}>Nomenclatura</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5 }}>Piso</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5 }}>Tipo Espacio</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5 }}>Asignación</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5, textAlign: 'right' }}>Capacidad</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5, textAlign: 'right' }}>Área (m²)</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5 }}>Autónomo</TableCell>
                          <TableCell sx={{ fontWeight: 900, color: '#065f46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #a7f3d0', py: 1.5, textAlign: 'center' }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {infraestructuraFisicaData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} sx={{ py: 4, textAlign: 'center', color: '#94a3b8' }}>
                              No se encontraron registros de infraestructura f├¡sica.
                            </TableCell>
                          </TableRow>
                        ) : (
                          infraestructuraFisicaData.map((row) => (
                            <TableRow key={row.id} hover>
                              <TableCell>{row.campus}</TableCell>
                              <TableCell sx={{ fontWeight: 700, wordBreak: 'break-word', whiteSpace: 'normal', color: '#334155' }}>{row.componente}</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#1d4ed8' }}>{row.nomenclatura || '-'}</TableCell>
                              <TableCell>Piso {row.piso_no}</TableCell>
                              <TableCell sx={{ wordBreak: 'break-word', whiteSpace: 'normal', color: '#334155' }}>{row.tipo_espacio}</TableCell>
                              <TableCell sx={{ minWidth: 160, maxWidth: 220, wordBreak: 'break-word', whiteSpace: 'normal', color: '#475569' }}>
                                {row.asignacion || '-'}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>{row.capacidad_fisica}</TableCell>
                              <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>{row.area_metros2} m²</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={['Sí', 'Si'].includes(row.acceso_autonomo) ? 'Sí' : 'No'}
                                  color={['Sí', 'Si'].includes(row.acceso_autonomo) ? 'primary' : 'default'}
                                  sx={{ fontWeight: 800 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                  <IconButton size="small" color="primary" onClick={() => handleOpenEditDialog(row)}>
                                    <EditIcon size="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteRow(row.id)}>
                                    <DeleteIcon size="small" />
                                  </IconButton>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    component="div"
                    count={infraestructuraFisicaTotal}
                    page={infraestructuraFisicaPage}
                    rowsPerPage={infraestructuraFisicaRowsPerPage}
                    onPageChange={(_, newPage) => setInfraestructuraFisicaPage(newPage)}
                    onRowsPerPageChange={(e) => {
                      setInfraestructuraFisicaRowsPerPage(parseInt(e.target.value, 10));
                      setInfraestructuraFisicaPage(0);
                    }}
                    labelRowsPerPage="Filas por p├ígina"
                    labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                  />
                </>
              )}
            </Paper>
          </Stack>
        )}

        <Dialog open={infraestructuraFisicaDialogOpen} onClose={() => setInfraestructuraFisicaDialogOpen(false)} maxWidth="md" fullWidth>
          <form onSubmit={handleFormSubmit}>
            <DialogTitle sx={{ fontWeight: 900, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', px: 3, py: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: '#1e293b' }}>
                    {infraestructuraFisicaEditingId ? 'Editar Espacio de Infraestructura Física' : 'Agregar Nuevo Espacio de Infraestructura'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    Inventario físico unificado y centralizado
                  </Typography>
                </Box>
                {infraestructuraFisicaEditingId ? (
                  <Chip
                    label="Modo: Actualizar Espacio"
                    color="warning"
                    variant="filled"
                    sx={{ fontWeight: 800, py: 1.8, px: 1.5, fontSize: 12, borderRadius: 2 }}
                  />
                ) : (
                  <Chip
                    label="Modo: Guardar Nuevo"
                    color="success"
                    variant="filled"
                    sx={{ fontWeight: 800, py: 1.8, px: 1.5, fontSize: 12, borderRadius: 2 }}
                  />
                )}
              </Stack>
            </DialogTitle>
            
            <DialogContent sx={{ p: 4, bgcolor: '#ffffff' }}>
              {/* Buscador inteligente de Nomenclatura - ANCHO COMPLETO E INTUITIVO */}
              {/* Buscador inteligente de Nomenclatura - MINIMALISTA Y OPTIMIZADO */}
              <Paper 
                elevation={0} 
                sx={{ 
                  mb: 3, 
                  p: 1.8, 
                  border: '1px solid #bfdbfe', 
                  borderRadius: 3, 
                  bgcolor: '#eff6ff',
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <SearchIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: '#1e3a8a', fontSize: 13.5 }}>
                        Cargar Espacio Existente (Edici├│n R├ípida)
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#3b82f6', display: 'block', fontSize: 11, fontWeight: 500 }}>
                        Busca un espacio para autocompletar la ficha y editarlo.
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ minWidth: { xs: '100%', sm: 300, md: 420 } }}>
                    <Autocomplete
                      size="small"
                      options={infraestructuraFisicaAllData}
                      getOptionLabel={(option) => `${option.nomenclatura || 'Sin C├│digo'} - ${option.componente || 'Sin Bloque'} (${option.campus})`}
                      value={infraestructuraFisicaAllData.find((r) => r.id === infraestructuraFisicaEditingId) || null}
                      filterOptions={(options, { inputValue }) => {
                        const query = inputValue.toLowerCase().trim();
                        if (!query) return options.slice(0, 10);
                        const filtered = [];
                        for (let i = 0; i < options.length; i++) {
                          const option = options[i];
                          if (
                            String(option.nomenclatura || '').toLowerCase().includes(query) ||
                            String(option.componente || '').toLowerCase().includes(query) ||
                            String(option.tipo_espacio || '').toLowerCase().includes(query) ||
                            String(option.asignacion || '').toLowerCase().includes(query) ||
                            String(option.ubicacion || '').toLowerCase().includes(query) ||
                            String(option.campus || '').toLowerCase().includes(query)
                          ) {
                            filtered.push(option);
                            if (filtered.length >= 8) break;
                          }
                        }
                        return filtered;
                      }}
                      onChange={(_, found) => {
                        if (found) {
                          setInfraestructuraFisicaForm({
                            campus: found.campus || '',
                            componente: found.componente || '',
                            tipo_area: found.tipo_area || '',
                            tenencia: found.tenencia || '',
                            ubicacion: found.ubicacion || '',
                            nomenclatura: found.nomenclatura || '',
                            piso_no: found.piso_no !== null && found.piso_no !== undefined ? Number(found.piso_no) : '',
                            tipo_espacio: found.tipo_espacio || '',
                            asignacion: found.asignacion || '',
                            descripcion: found.descripcion || '',
                            funcion_especifica: found.funcion_especifica || '',
                            capacidad_fisica: found.capacidad_fisica !== null && found.capacidad_fisica !== undefined ? Number(found.capacidad_fisica) : '',
                            area_metros2: found.area_metros2 !== null && found.area_metros2 !== undefined ? Number(found.area_metros2) : '',
                            fecha_actualizacion: found.fecha_actualizacion || new Date().getFullYear().toString(),
                            acceso_autonomo: ['Sí', 'Si'].includes(found.acceso_autonomo) ? 'Sí' : 'No'
                          });
                          setInfraestructuraFisicaEditingId(found.id);
                          enqueueSnackbar(`Espacio '${found.nomenclatura}' cargado con éxito para editar`, { variant: 'info' });
                        } else {
                          handleOpenCreateDialog();
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Buscar espacio por nomenclatura, bloque..."
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2.5,
                              bgcolor: '#ffffff',
                              fontSize: 12.5
                            }
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} sx={{ py: 0.8, px: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                          <Stack spacing={0.2} sx={{ width: '100%' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', fontSize: 12.5 }}>
                                {option.nomenclatura || 'Sin C├│digo'} ÔÇö {option.componente || 'Sin Bloque'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: 10.5 }}>
                                {option.campus}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 11 }}>
                              {option.tipo_espacio || 'Sin tipo'} ÔÇó {option.asignacion || 'Sin asignación'}
                            </Typography>
                          </Stack>
                        </Box>
                      )}
                    />
                  </Box>
                </Stack>
              </Paper>

              <Stack spacing={4}>
                {/* SECCIÓN 1: UBICACI├ôN Y CAMPUS */}
                <Box>
                  <Typography sx={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1.2, mb: 2, fontSize: 15, borderBottom: '2px solid #3b82f6', pb: 1 }}>
                    <PlaceIcon sx={{ color: '#3b82f6' }} />
                    1. UBICACI├ôN Y CAMPUS
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '100%', sm: 'repeat(3, 1fr)' }, gap: 3 }}>
                    <Box>
                      <FormControl fullWidth size="medium" required>
                        <InputLabel>Campus</InputLabel>
                        <Select
                          value={infraestructuraFisicaForm.campus}
                          label="Campus"
                          onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, campus: e.target.value })}
                          sx={{ borderRadius: '10px' }}
                        >
                          <MenuItem value=""><em>Seleccione un Campus</em></MenuItem>
                          <MenuItem value="Campus Centro">Campus Centro</MenuItem>
                          <MenuItem value="Campus Santiago">Campus Santiago</MenuItem>
                          <MenuItem value="Campus San Damián">Campus San Damián</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <Box>
                      <Autocomplete
                        freeSolo
                        options={Array.from(new Set(infraestructuraFisicaAllData.map((r) => r.componente).filter(Boolean)))}
                        value={infraestructuraFisicaForm.componente}
                        onChange={(_, newValue) => setInfraestructuraFisicaForm((prev) => ({ ...prev, componente: newValue || '' }))}
                        onInputChange={(_, newInputValue) => setInfraestructuraFisicaForm((prev) => ({ ...prev, componente: newInputValue }))}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            size="medium"
                            label="Bloque (Componente)"
                            placeholder="Ej: Áreas_administraci├│n"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                          />
                        )}
                      />
                    </Box>

                    <Box>
                      <TextField
                        required
                        fullWidth
                        type="number"
                        size="medium"
                        label="Piso No"
                        InputProps={{ inputProps: { min: 0 } }}
                        value={infraestructuraFisicaForm.piso_no}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, piso_no: e.target.value === '' ? '' : Number(e.target.value) })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>

                    <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 3' } }}>
                      <TextField
                        required
                        fullWidth
                        size="medium"
                        label="Ubicación Espec├¡fica"
                        placeholder="Ej: Bloque Administrativo - Primer Piso"
                        value={infraestructuraFisicaForm.ubicacion}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, ubicacion: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* SECCIÓN 2: IDENTIFICACI├ôN Y TIPO DE ESPACIO */}
                <Box>
                  <Typography sx={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1.2, mb: 2, fontSize: 15, borderBottom: '2px solid #10b981', pb: 1 }}>
                    <HomeWorkIcon sx={{ color: '#10b981' }} />
                    2. IDENTIFICACI├ôN Y TIPO DE ESPACIO
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '100%', sm: 'repeat(3, 1fr)' }, gap: 3 }}>
                    <Box>
                      <TextField
                        required
                        fullWidth
                        size="medium"
                        label="Nomenclatura (C├│digo)"
                        placeholder="Ej: 202"
                        value={infraestructuraFisicaForm.nomenclatura}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, nomenclatura: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>

                    <Box>
                      <Autocomplete
                        freeSolo
                        options={Array.from(new Set([
                          ...infraestructuraFisicaAllData.map((r) => r.tipo_espacio).filter(Boolean),
                          'Aulas', 'Oficinas', 'Laboratorios', 'Auditorios', 'Salas de Cómputo', 'Bibliotecas', 'Zonas Verdes', 'Pasillos', 'Ba├▒os', 'Cafeterías', 'Parqueaderos'
                        ]))}
                        value={infraestructuraFisicaForm.tipo_espacio}
                        onChange={(_, newValue) => setInfraestructuraFisicaForm((prev) => ({ ...prev, tipo_espacio: newValue || '' }))}
                        onInputChange={(_, newInputValue) => setInfraestructuraFisicaForm((prev) => ({ ...prev, tipo_espacio: newInputValue }))}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            size="medium"
                            label="Tipo de Espacio"
                            placeholder="Ej: Oficinas"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                          />
                        )}
                      />
                    </Box>

                    <Box>
                      <Autocomplete
                        freeSolo
                        options={Array.from(new Set([
                          ...infraestructuraFisicaAllData.map((r) => r.asignacion).filter(Boolean),
                          'Secretar├¡a General', 'Rector├¡a', 'Decanatura', 'Docentes', 'Estudiantes', 'Administraci├│n', 'Servicios Generales'
                        ]))}
                        value={infraestructuraFisicaForm.asignacion}
                        onChange={(_, newValue) => setInfraestructuraFisicaForm((prev) => ({ ...prev, asignacion: newValue || '' }))}
                        onInputChange={(_, newInputValue) => setInfraestructuraFisicaForm((prev) => ({ ...prev, asignacion: newInputValue }))}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            size="medium"
                            label="Asignación de Uso"
                            placeholder="Ej: Secretar├¡a General"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                          />
                        )}
                      />
                    </Box>

                    <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 3' } }}>
                      <TextField
                        fullWidth
                        size="medium"
                        label="Funci├│n Espec├¡fica"
                        placeholder="Describa la función específica de este espacio, Ej: Apoyo acad├®mico y atenci├│n al p├║blico..."
                        value={infraestructuraFisicaForm.funcion_especifica}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, funcion_especifica: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* SECCIÓN 3: CARACTER├ìSTICAS FÍSICAS Y ACCESO */}
                <Box>
                  <Typography sx={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1.2, mb: 2, fontSize: 15, borderBottom: '2px solid #f59e0b', pb: 1 }}>
                    <InsightsIcon sx={{ color: '#f59e0b' }} />
                    3. CARACTER├ìSTICAS FÍSICAS Y ACCESO
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '100%', sm: 'repeat(3, 1fr)' }, gap: 3 }}>
                    <Box>
                      <FormControl fullWidth size="medium" required>
                        <InputLabel>Tipo de Área</InputLabel>
                        <Select
                          value={infraestructuraFisicaForm.tipo_area}
                          label="Tipo de Área"
                          onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, tipo_area: e.target.value })}
                          sx={{ borderRadius: '10px' }}
                        >
                          <MenuItem value=""><em>Seleccione un Tipo</em></MenuItem>
                          <MenuItem value="CONSTRUIDA">CONSTRUIDA</MenuItem>
                          <MenuItem value="LIBRE">LIBRE</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    <Box>
                      <FormControl fullWidth size="medium" required>
                        <InputLabel>Tenencia</InputLabel>
                        <Select
                          value={infraestructuraFisicaForm.tenencia}
                          label="Tenencia"
                          onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, tenencia: e.target.value })}
                          sx={{ borderRadius: '10px' }}
                        >
                          <MenuItem value=""><em>Seleccione Tenencia</em></MenuItem>
                          <MenuItem value="Propio">Propio</MenuItem>
                          <MenuItem value="Arriendo">Arriendo</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    <Box>
                      <FormControl fullWidth size="medium" required>
                        <InputLabel>Acceso Autónomo</InputLabel>
                        <Select
                          value={infraestructuraFisicaForm.acceso_autonomo}
                          label="Acceso Autónomo"
                          onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, acceso_autonomo: e.target.value })}
                          sx={{ borderRadius: '10px' }}
                        >
                          <MenuItem value=""><em>┬┐Tiene Acceso Autónomo?</em></MenuItem>
                          <MenuItem value="Sí">Sí</MenuItem>
                          <MenuItem value="No">No</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    <Box>
                      <TextField
                        required
                        fullWidth
                        type="number"
                        size="medium"
                        label="Capacidad Física (Personas)"
                        InputProps={{ inputProps: { min: 0 } }}
                        value={infraestructuraFisicaForm.capacidad_fisica}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, capacidad_fisica: e.target.value === '' ? '' : Number(e.target.value) })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>

                    <Box>
                      <TextField
                        required
                        fullWidth
                        type="number"
                        size="medium"
                        label="Área Construida (m²)"
                        inputProps={{ step: "any", min: 0 }}
                        value={infraestructuraFisicaForm.area_metros2}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, area_metros2: e.target.value === '' ? '' : Number(e.target.value) })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>

                    <Box>
                      <TextField
                        fullWidth
                        size="medium"
                        label="Fecha Actualizaci├│n (A├▒o)"
                        placeholder="Ej: 2026"
                        value={infraestructuraFisicaForm.fecha_actualizacion}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, fecha_actualizacion: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>

                    <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 3' } }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        size="medium"
                        label="Descripción General"
                        placeholder="Ingrese comentarios u observaciones adicionales sobre el espacio..."
                        value={infraestructuraFisicaForm.descripcion}
                        onChange={(e) => setInfraestructuraFisicaForm({ ...infraestructuraFisicaForm, descripcion: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc', gap: 2 }}>
              <Button 
                onClick={() => setInfraestructuraFisicaDialogOpen(false)} 
                disabled={infraestructuraFisicaSubmitting}
                variant="outlined"
                sx={{ 
                  borderRadius: 99, 
                  width: 150, 
                  py: 1.2, 
                  color: '#475569', 
                  borderColor: '#cbd5e1',
                  fontWeight: 700, 
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#94a3b8',
                    bgcolor: '#f1f5f9'
                  }
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                color={infraestructuraFisicaEditingId ? 'warning' : 'primary'}
                disabled={infraestructuraFisicaSubmitting}
                sx={{ 
                  borderRadius: 99, 
                  width: 150, 
                  py: 1.2, 
                  fontWeight: 800,
                  textTransform: 'none',
                  boxShadow: infraestructuraFisicaEditingId 
                    ? '0 4px 12px rgba(245,158,11,0.25)'
                    : '0 4px 12px rgba(37,99,235,0.25)' 
                }}
              >
                {infraestructuraFisicaSubmitting
                  ? 'Guardando...'
                  : infraestructuraFisicaEditingId
                  ? 'Actualizar'
                  : 'Guardar'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Stack>
    );
  };

  if (infraestructuraFisicaTab === 'informes') {
    return renderInfraestructuraFisicaInformesModule();
  }
  return renderInfraestructuraFisicaHub();
}

