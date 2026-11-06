import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  AccountTree as AccountTreeIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Close as CloseIcon,
  CorporateFare as CorporateFareIcon,
  Dataset as DatasetIcon,
  Download as DownloadIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAltOff as FilterAltOffIcon,
  Search as SearchIcon,
  Storage as StorageIcon,
  ViewColumn as ViewColumnIcon
} from '@mui/icons-material';
import XLSXStyle from 'xlsx-js-style';
import { useSnackbar } from 'notistack';

const FIELD_TYPE_LABEL = {
  text: 'Texto corto',
  textarea: 'Texto largo',
  number: 'Número',
  percentage: 'Porcentaje (%)',
  currency: 'Moneda ($)',
  date: 'Fecha',
  boolean: 'Sí / No',
  list: 'Lista desplegable',
  catalog: 'Lista desplegable (Catálogo)',
  catalog_multi: 'Selección múltiple (Catálogo)',
  formula: 'Fórmula calculada',
  url: 'Enlace / URL',
  email: 'Correo electrónico'
};

const PLAN_STATUS_LABELS = {
  active: { label: 'Activo / En ejecución', bg: '#dbeafe', color: '#1e40af' },
  draft: { label: 'En formulación (Borrador)', bg: '#f1f5f9', color: '#475569' },
  in_review: { label: 'En revisión', bg: '#fef3c7', color: '#b45309' },
  approved: { label: 'Aprobado / Concertado', bg: '#e0f2fe', color: '#0369a1' },
  in_execution: { label: 'En ejecución', bg: '#dbeafe', color: '#1d4ed8' },
  closed: { label: 'Vigencia cerrada', bg: '#e2e8f0', color: '#334155' },
  pending: { label: 'Pendiente por crear', bg: '#fee2e2', color: '#b91c1c' }
};

const formatNumber = (value) => Number(value || 0).toLocaleString('es-CO');
const formatPercent = (value) =>
  `${Number(value || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const headerCellStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
  fill: { fgColor: { rgb: '1E3A8A' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  }
};

const titleCellStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
  fill: { fgColor: { rgb: '0F172A' } },
  alignment: { horizontal: 'left', vertical: 'center' }
};

const applySheetHeaderStyle = (ws, headerRowIndex, colCount) => {
  if (!ws['!ref']) return;
  for (let c = 0; c < colCount; c += 1) {
    const cellRef = XLSXStyle.utils.encode_cell({ r: headerRowIndex, c });
    if (ws[cellRef]) {
      ws[cellRef].s = headerCellStyle;
    }
    const titleRef = XLSXStyle.utils.encode_cell({ r: 0, c });
    if (ws[titleRef]) {
      ws[titleRef].s = titleCellStyle;
    }
  }
};

const resolveFieldCellValue = (row, field) => {
  if (!row || !field) return '';
  const key = field.key;
  const customVal = row.campos_dinamicos?.[key];
  if (customVal !== undefined && customVal !== null && customVal !== '') {
    if (Array.isArray(customVal)) return customVal.join('; ');
    if (typeof customVal === 'object') return customVal.label || customVal.name || customVal.value || JSON.stringify(customVal);
    return String(customVal);
  }
  const directMap = {
    objetivos_estrategicos: row.objetivo_estrategico,
    strategic_objective: row.objetivo_estrategico,
    lineamientos_estrategicos: row.lineamiento_estrategico,
    strategic_guideline: row.lineamiento_estrategico,
    guideline: row.lineamiento_estrategico,
    macroactividad: row.macroactividad,
    macroactivity: row.macroactividad,
    activity: row.actividad,
    actividad: row.actividad,
    indicator_type: row.tipo_indicador,
    tipo_indicador: row.tipo_indicador,
    indicator: row.indicador,
    indicador: row.indicador,
    target: row.meta,
    meta: row.meta,
    progress_s1: row.avance_ip,
    avance_ip: row.avance_ip,
    progress_s2: row.avance_iip,
    avance_iip: row.avance_iip,
    total_progress: row.avance_total,
    avance_total: row.avance_total,
    responsible: row.responsable,
    responsable: row.responsable
  };
  const fallback = directMap[key];
  if (fallback !== undefined && fallback !== null && fallback !== '' && fallback !== '—') {
    return String(fallback);
  }
  return '';
};

const BASE_COVERED_FIELD_KEYS = new Set([
  'objetivos_estrategicos',
  'strategic_objective',
  'lineamientos_estrategicos',
  'strategic_guideline',
  'guideline',
  'macroactividad',
  'macroactivity',
  'activity',
  'actividad',
  'indicator',
  'indicador',
  'target',
  'meta',
  'progress_s1',
  'avance_ip',
  'progress_s2',
  'avance_iip',
  'total_progress',
  'avance_total',
  'responsible',
  'responsable'
]);

function PedDataReferenceTables({ statsData }) {
  const { enqueueSnackbar } = useSnackbar();

  const [activeTable, setActiveTable] = useState('ped_info');
  const [expandedFieldId, setExpandedFieldId] = useState(null);

  // Filtros Tabla 2: Campos creados
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldTypeFilter, setFieldTypeFilter] = useState('all');

  // Filtros Tabla 3: Dependencias
  const [depYearFilter, setDepYearFilter] = useState('all');
  const [depSearch, setDepSearch] = useState('');
  const [depLimit, setDepLimit] = useState(50);

  // Filtros Tabla 4: Planes de Acción
  const [planYearFilter, setPlanYearFilter] = useState('all');
  const [planStatusFilter, setPlanStatusFilter] = useState('all');
  const [planSearch, setPlanSearch] = useState('');
  const [planLimit, setPlanLimit] = useState(50);

  // Filtros Tabla 5: Datos de Plan de Acción Completa
  const [dataYearFilter, setDataYearFilter] = useState('all');
  const [dataDepFilter, setDataDepFilter] = useState('');
  const [dataEstadoFilter, setDataEstadoFilter] = useState('all');
  const [dataSearch, setDataSearch] = useState('');
  const [dataLimit, setDataLimit] = useState(35);

  const plan = statsData?.plan || {};
  const terms = useMemo(() => statsData?.terms || [], [statsData?.terms]);
  const termsProgress = useMemo(() => statsData?.termsProgress || [], [statsData?.termsProgress]);
  const rawFields = useMemo(() => statsData?.fieldDefinitions || [], [statsData?.fieldDefinitions]);
  const termDependencies = useMemo(() => statsData?.termDependencies || [], [statsData?.termDependencies]);
  const actionPlansList = useMemo(() => statsData?.actionPlansList || [], [statsData?.actionPlansList]);
  const allRows = useMemo(() => statsData?.rows || [], [statsData?.rows]);
  const kpis = statsData?.kpis || {};

  // Aprovechar estadísticas de campo precalculadas en el backend (O(1) por campo)
  const enrichedFields = useMemo(() => {
    return rawFields.map((field, index) => {
      const configuredOptions = Array.isArray(field.option_labels) ? field.option_labels : [];
      const isChoice = ['list', 'catalog', 'catalog_multi'].includes(field.data_type);

      if (field.filled_count !== undefined) {
        return {
          ...field,
          displayIndex: field.position || index + 1,
          typeLabel: FIELD_TYPE_LABEL[field.data_type] || field.data_type,
          isChoice,
          configuredOptions,
          allOptionNames: Array.isArray(field.all_option_names) ? field.all_option_names : configuredOptions,
          observedValues: Array.isArray(field.observed_values) ? field.observed_values : [],
          filledCount: field.filled_count || 0,
          emptyCount: field.empty_count || 0,
          coveragePct: field.coverage_pct || 0
        };
      }

      const observedMap = new Map();
      let filledCount = 0;
      allRows.forEach((row) => {
        const val = resolveFieldCellValue(row, field);
        if (val !== '') {
          filledCount += 1;
          observedMap.set(val, (observedMap.get(val) || 0) + 1);
        }
      });

      const observedValues = Array.from(observedMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count }));

      const allOptionNames = configuredOptions.length
        ? configuredOptions
        : isChoice
          ? observedValues.map((item) => item.label)
          : [];

      const coveragePct = allRows.length ? Number(((filledCount / allRows.length) * 100).toFixed(2)) : 0;

      return {
        ...field,
        displayIndex: field.position || index + 1,
        typeLabel: FIELD_TYPE_LABEL[field.data_type] || field.data_type,
        isChoice,
        configuredOptions,
        allOptionNames,
        observedValues,
        filledCount,
        emptyCount: Math.max(0, allRows.length - filledCount),
        coveragePct
      };
    });
  }, [rawFields, allRows]);

  const extraDynamicFields = useMemo(
    () => enrichedFields.filter((f) => !BASE_COVERED_FIELD_KEYS.has(f.key)),
    [enrichedFields]
  );

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    return enrichedFields.filter((f) => {
      if (fieldTypeFilter === 'choice' && !f.isChoice) return false;
      if (fieldTypeFilter === 'required' && !f.required) return false;
      if (fieldTypeFilter === 'optional' && f.required) return false;
      if (!q) return true;
      const inBasic =
        f.label?.toLowerCase().includes(q) ||
        f.key?.toLowerCase().includes(q) ||
        f.typeLabel?.toLowerCase().includes(q);
      const inOptions = f.allOptionNames.some((opt) => String(opt).toLowerCase().includes(q));
      return inBasic || inOptions;
    });
  }, [enrichedFields, fieldSearch, fieldTypeFilter]);

  const availableDepYears = useMemo(() => {
    const set = new Set([
      ...terms.map((t) => Number(t.year)).filter(Boolean),
      ...termDependencies.map((d) => Number(d.year)).filter(Boolean)
    ]);
    return Array.from(set).sort((a, b) => a - b);
  }, [terms, termDependencies]);

  const filteredDependencies = useMemo(() => {
    const q = depSearch.trim().toLowerCase();
    if (depYearFilter === 'all' && !q) return termDependencies;
    return termDependencies.filter((dep) => {
      if (depYearFilter !== 'all' && String(dep.year) !== String(depYearFilter)) return false;
      if (!q) return true;
      return (
        dep.dependency_name?.toLowerCase().includes(q) ||
        dep.dependency_code?.toLowerCase().includes(q) ||
        dep.responsible_name?.toLowerCase().includes(q) ||
        dep.responsible_document?.toLowerCase().includes(q) ||
        dep.responsible_unit_siac?.toLowerCase().includes(q) ||
        dep.responsible_position?.toLowerCase().includes(q) ||
        dep.responsible_email?.toLowerCase().includes(q) ||
        dep.action_plan_code?.toLowerCase().includes(q)
      );
    });
  }, [termDependencies, depYearFilter, depSearch]);

  const filteredActionPlans = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    if (planYearFilter === 'all' && planStatusFilter === 'all' && !q) return actionPlansList;
    return actionPlansList.filter((ap) => {
      if (planYearFilter !== 'all' && String(ap.year) !== String(planYearFilter)) return false;
      if (planStatusFilter !== 'all' && ap.status !== planStatusFilter) return false;
      if (!q) return true;
      return (
        ap.code?.toLowerCase().includes(q) ||
        ap.title?.toLowerCase().includes(q) ||
        ap.dependency_name?.toLowerCase().includes(q) ||
        ap.dependency_code?.toLowerCase().includes(q) ||
        ap.responsible_name?.toLowerCase().includes(q) ||
        ap.responsible_document?.toLowerCase().includes(q) ||
        ap.responsible_position?.toLowerCase().includes(q) ||
        ap.responsible_unit_siac?.toLowerCase().includes(q) ||
        ap.responsible_email?.toLowerCase().includes(q)
      );
    });
  }, [actionPlansList, planYearFilter, planStatusFilter, planSearch]);

  const availableDataDependencies = useMemo(() => {
    const depsProgress = statsData?.dependenciesProgress;
    if (Array.isArray(depsProgress) && depsProgress.length) {
      const set = new Set(depsProgress.map((d) => d.name).filter(Boolean));
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    }
    const set = new Set(allRows.map((r) => r.dependencia).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [statsData?.dependenciesProgress, allRows]);

  const filteredDataRows = useMemo(() => {
    const q = dataSearch.trim().toLowerCase();
    if (dataYearFilter === 'all' && !dataDepFilter && dataEstadoFilter === 'all' && !q) {
      return allRows;
    }
    return allRows.filter((row) => {
      if (dataYearFilter !== 'all' && String(row.anio) !== String(dataYearFilter)) return false;
      if (dataDepFilter && row.dependencia !== dataDepFilter) return false;
      if (dataEstadoFilter !== 'all' && row.estado !== dataEstadoFilter) return false;
      if (!q) return true;
      const baseMatch =
        row.dependencia?.toLowerCase().includes(q) ||
        row.responsable?.toLowerCase().includes(q) ||
        row.responsable_cedula?.toLowerCase().includes(q) ||
        row.plan_code?.toLowerCase().includes(q) ||
        row.objetivo_estrategico?.toLowerCase().includes(q) ||
        row.lineamiento_estrategico?.toLowerCase().includes(q) ||
        row.macroactividad?.toLowerCase().includes(q) ||
        row.actividad?.toLowerCase().includes(q) ||
        row.indicador?.toLowerCase().includes(q) ||
        row.meta?.toLowerCase().includes(q);
      if (baseMatch) return true;
      return Object.values(row.campos_dinamicos || {}).some((v) =>
        String(v || '').toLowerCase().includes(q)
      );
    });
  }, [allRows, dataYearFilter, dataDepFilter, dataEstadoFilter, dataSearch]);

  // ============================================================================
  // FUNCIONES DE EXPORTACIÓN A EXCEL (INDIVIDUALES Y LIBRO MAESTRO COMPLETO)
  // ============================================================================

  const buildPedInfoSheets = (wb) => {
    const pedRows = [
      [`1. FICHA TÉCNICA Y VIGENCIAS DEL PLAN ESTRATÉGICO DE DESARROLLO — ${plan.code || 'PED'}`],
      ['Fecha de generación', new Date().toLocaleString('es-CO')],
      [],
      ['CAMPO DE CONFIGURACIÓN DEL PED', 'VALOR REGISTRADO'],
      ['Código Oficial del PED', plan.code || '—'],
      ['Nombre del Plan Estratégico', plan.name || '—'],
      ['Descripción / Alcance', plan.description || 'Monitoreo estratégico institucional'],
      ['Fecha de Inicio', plan.starts_on || '—'],
      ['Fecha de Finalización', plan.ends_on || '—'],
      ['Estado Actual', PLAN_STATUS_LABELS[plan.status]?.label || plan.status || 'Activo'],
      ['Documento de Aprobación', plan.approval_document || '—'],
      ['Acto Administrativo', plan.administrative_act || '—'],
      ['Fecha de Aprobación', plan.approved_on || '—'],
      ['Presupuesto Global', plan.global_budget ? `$ ${formatNumber(plan.global_budget)}` : '—'],
      ['Versión de Configuración', plan.configuration_version || 1],
      ['Total Vigencias Configuradas', terms.length],
      ['Total Campos / Columnas Configuradas', enrichedFields.length],
      ['Total Asignaciones de Dependencias', termDependencies.length],
      ['Total Planes de Acción Creados', actionPlansList.length],
      ['Total Actividades / Registros PED', allRows.length],
      ['Ejecución General Promedio', formatPercent(kpis.ejecucionGeneral || 0)],
      [],
      ['VIGENCIA / AÑO', 'NOMBRE VIGENCIA', 'FECHA INICIO', 'FECHA FIN', 'ESTADO', 'DEPENDENCIAS CONFIGURADAS', 'PLANES DE ACCIÓN', 'ACTIVIDADES / REGISTROS', 'AVANCE PROMEDIO (%)']
    ];

    terms.forEach((term) => {
      const tp = termsProgress.find((t) => Number(t.year) === Number(term.year)) || {};
      pedRows.push([
        term.year,
        term.name || `Vigencia ${term.year}`,
        term.starts_on || '—',
        term.ends_on || '—',
        PLAN_STATUS_LABELS[term.status]?.label || term.status || '—',
        tp.dependenciesCount ?? termDependencies.filter((d) => Number(d.year) === Number(term.year)).length,
        tp.plansCount || 0,
        tp.activitiesCount || 0,
        formatPercent(tp.avgProgress || 0)
      ]);
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(pedRows);
    ws['!cols'] = [
      { wch: 36 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
      { wch: 26 },
      { wch: 20 },
      { wch: 24 },
      { wch: 20 }
    ];
    applySheetHeaderStyle(ws, 3, 2);
    applySheetHeaderStyle(ws, 22, 9);
    XLSXStyle.utils.book_append_sheet(wb, ws, '1_DATOS_PED_Y_VIGENCIAS');
  };

  const buildFieldsSheets = (wb, sourceFields = enrichedFields) => {
    const fieldRows = [
      [`2. TABLA DE CAMPOS CREADOS Y ESTRUCTURA DINÁMICA — ${plan.code || 'PED'}`],
      ['Total columnas configuradas', sourceFields.length, 'Total registros evaluados', allRows.length],
      [],
      [
        '# POSICIÓN',
        'NOMBRE VISIBLE DE LA COLUMNA',
        'IDENTIFICADOR TÉCNICO (KEY)',
        'TIPO DE INFORMACIÓN',
        'OBLIGATORIO',
        'ESTADO',
        'FÓRMULA / REGLA DE VALIDACIÓN',
        'CANT. OPCIONES DE LISTA',
        'LISTADO COMPLETO DE OPCIONES / VALORES CONFIGURADOS',
        'REGISTROS DILIGENCIADOS',
        'REGISTROS SIN DATO',
        'COBERTURA (%)'
      ]
    ];

    const optionDetailRows = [
      [`DETALLE COMPLETO DE OPCIONES POR CAMPO DE LISTA — ${plan.code || 'PED'}`],
      ['Cada fila representa una opción o valor perteneciente a las columnas de selección del PED.'],
      [],
      ['# CAMPO', 'NOMBRE DEL CAMPO', 'IDENTIFICADOR (KEY)', 'TIPO DE INFORMACIÓN', '# OPCIÓN', 'VALOR / OPCIÓN DE LA LISTA DESPLEGABLE', 'ORIGEN', 'FRECUENCIA EN REGISTROS']
    ];

    sourceFields.forEach((field) => {
      const ruleText = field.formula
        ? `Fórmula: ${field.formula}`
        : field.validation_rules?.shared_catalog === 'institutional_policies'
          ? 'Catálogo institucional dinámico (Políticas)'
          : field.catalog_type
            ? `Catálogo: ${field.catalog_type}`
            : field.validation_rules?.min !== undefined || field.validation_rules?.max !== undefined
              ? `Rango: ${field.validation_rules?.min ?? 0} a ${field.validation_rules?.max ?? 100}`
              : 'Estándar';

      const optionsJoined = field.allOptionNames.length
        ? field.allOptionNames.join(' | ')
        : field.observedValues.length
          ? field.observedValues.slice(0, 15).map((v) => `${v.label} (${v.count})`).join(' | ')
          : 'Campo abierto / Sin lista fija';

      fieldRows.push([
        field.displayIndex,
        field.label,
        field.key,
        field.typeLabel,
        field.required ? 'Obligatorio' : 'Opcional',
        field.active === false ? 'Histórico / Inactivo' : 'Activo',
        ruleText,
        field.allOptionNames.length,
        optionsJoined,
        field.filledCount,
        field.emptyCount,
        formatPercent(field.coveragePct)
      ]);

      if (field.allOptionNames.length > 0) {
        const obsMap = new Map(field.observedValues.map((o) => [o.label, o.count]));
        field.allOptionNames.forEach((optLabel, idx) => {
          optionDetailRows.push([
            field.displayIndex,
            field.label,
            field.key,
            field.typeLabel,
            idx + 1,
            optLabel,
            field.configuredOptions.includes(optLabel) ? 'Configurada en el campo' : 'Registrada en planes',
            obsMap.get(optLabel) || 0
          ]);
        });
      } else if (field.observedValues.length > 0) {
        field.observedValues.forEach((obs, idx) => {
          optionDetailRows.push([
            field.displayIndex,
            field.label,
            field.key,
            field.typeLabel,
            idx + 1,
            obs.label,
            'Valor registrado en planes',
            obs.count
          ]);
        });
      }
    });

    const wsFields = XLSXStyle.utils.aoa_to_sheet(fieldRows);
    wsFields['!cols'] = [
      { wch: 12 },
      { wch: 34 },
      { wch: 28 },
      { wch: 26 },
      { wch: 15 },
      { wch: 18 },
      { wch: 30 },
      { wch: 18 },
      { wch: 65 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 }
    ];
    applySheetHeaderStyle(wsFields, 3, 12);
    XLSXStyle.utils.book_append_sheet(wb, wsFields, '2_CAMPOS_CREADOS_PED');

    const wsOpts = XLSXStyle.utils.aoa_to_sheet(optionDetailRows);
    wsOpts['!cols'] = [
      { wch: 10 },
      { wch: 32 },
      { wch: 26 },
      { wch: 24 },
      { wch: 10 },
      { wch: 68 },
      { wch: 24 },
      { wch: 22 }
    ];
    applySheetHeaderStyle(wsOpts, 3, 8);
    XLSXStyle.utils.book_append_sheet(wb, wsOpts, '2B_OPCIONES_DE_CAMPOS');
  };

  const buildDependenciesSheet = (wb, sourceDeps = filteredDependencies) => {
    const rows = [
      [`3. TABLA COMPLETA DE DEPENDENCIAS POR VIGENCIA — ${plan.code || 'PED'}`],
      ['Total registros exportados', sourceDeps.length, 'Filtro vigencia', depYearFilter === 'all' ? 'Todas las vigencias' : depYearFilter],
      [],
      [
        '#',
        'VIGENCIA / AÑO',
        'CÓDIGO DEPENDENCIA',
        'DEPENDENCIA',
        'RESPONSABLE ASIGNADO',
        'CÉDULA',
        'UNIDAD EN SIAC',
        'CARGO',
        'CORREO ELECTRÓNICO',
        'CÓDIGO PLAN DE ACCIÓN',
        'ESTADO DEL PLAN',
        'REGISTROS CARGADOS',
        'AVANCE PROMEDIO (%)'
      ]
    ];

    sourceDeps.forEach((dep, idx) => {
      rows.push([
        idx + 1,
        dep.year || '—',
        dep.dependency_code || '—',
        dep.dependency_name || '—',
        dep.responsible_name || '—',
        dep.responsible_document || '—',
        dep.responsible_unit_siac || '—',
        dep.responsible_position || '—',
        dep.responsible_email || '—',
        dep.action_plan_code || 'Sin plan',
        PLAN_STATUS_LABELS[dep.action_plan_status]?.label || dep.action_plan_status || '—',
        dep.items_count || 0,
        formatPercent(dep.avg_progress || 0)
      ]);
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 22 },
      { wch: 38 },
      { wch: 34 },
      { wch: 16 },
      { wch: 36 },
      { wch: 32 },
      { wch: 32 },
      { wch: 26 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 }
    ];
    applySheetHeaderStyle(ws, 3, 13);
    XLSXStyle.utils.book_append_sheet(wb, ws, '3_DEPENDENCIAS_COMPLETA');
  };

  const buildActionPlansSheet = (wb, sourcePlans = filteredActionPlans) => {
    const rows = [
      [`4. TABLA DE PLANES DE ACCIÓN POR DEPENDENCIA Y VIGENCIA — ${plan.code || 'PED'}`],
      ['Total planes exportados', sourcePlans.length, 'Fecha', new Date().toLocaleString('es-CO')],
      [],
      [
        '#',
        'VIGENCIA / AÑO',
        'CÓDIGO DEL PLAN',
        'TÍTULO DEL PLAN DE ACCIÓN',
        'CÓDIGO DEPENDENCIA',
        'DEPENDENCIA',
        'RESPONSABLE / LÍDER',
        'CÉDULA',
        'CARGO',
        'UNIDAD EN SIAC',
        'CORREO ELECTRÓNICO',
        'ESTADO DEL PLAN',
        'VERSIÓN INSTRUMENTO',
        'TOTAL REGISTROS',
        'SIN INICIAR',
        'EN EJECUCIÓN',
        'COMPLETADOS',
        'AVANCE PROMEDIO (%)'
      ]
    ];

    sourcePlans.forEach((ap, idx) => {
      rows.push([
        idx + 1,
        ap.year || '—',
        ap.code || '—',
        ap.title || '—',
        ap.dependency_code || '—',
        ap.dependency_name || '—',
        ap.responsible_name || '—',
        ap.responsible_document || '—',
        ap.responsible_position || '—',
        ap.responsible_unit_siac || '—',
        ap.responsible_email || '—',
        PLAN_STATUS_LABELS[ap.status]?.label || ap.status || '—',
        `v${ap.instrument_version || 1}`,
        ap.items_count || 0,
        ap.sin_iniciar || 0,
        ap.en_ejecucion || 0,
        ap.completadas || 0,
        formatPercent(ap.avg_progress || 0)
      ]);
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 36 },
      { wch: 20 },
      { wch: 36 },
      { wch: 34 },
      { wch: 16 },
      { wch: 30 },
      { wch: 34 },
      { wch: 32 },
      { wch: 24 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 }
    ];
    applySheetHeaderStyle(ws, 3, 18);
    XLSXStyle.utils.book_append_sheet(wb, ws, '4_PLANES_DE_ACCION');
  };

  const buildFullActionPlanDataSheet = (wb, sourceRows = filteredDataRows) => {
    const dynamicHeaders = enrichedFields.map((f) => `${f.label} (${f.key})`);
    const baseHeaders = [
      '#',
      'VIGENCIA / AÑO',
      'CÓDIGO PLAN',
      'DEPENDENCIA',
      'CÓDIGO DEPENDENCIA',
      'RESPONSABLE',
      'CÉDULA RESPONSABLE',
      'CARGO RESPONSABLE',
      'UNIDAD EN SIAC',
      'CORREO RESPONSABLE',
      'CÓDIGO ACTIVIDAD',
      'OBJETIVO ESTRATÉGICO',
      'LINEAMIENTO ESTRATÉGICO',
      'MACROACTIVIDAD',
      'ACTIVIDAD',
      'TIPO DE INDICADOR',
      'INDICADOR',
      'META',
      'AVANCE IP (%)',
      'AVANCE IIP (%)',
      'AVANCE TOTAL (%)',
      'ESTADO'
    ];

    const allHeaders = [...baseHeaders, ...dynamicHeaders];

    const sheetRows = [
      [`5. TABLA DE DATOS DE PLAN DE ACCIÓN COMPLETA — ${plan.code || 'PED'}`],
      ['Total registros exportados', sourceRows.length, 'Columnas dinámicas incluidas', enrichedFields.length],
      [],
      allHeaders
    ];

    sourceRows.forEach((row, idx) => {
      const baseValues = [
        idx + 1,
        row.anio || '—',
        row.plan_code || '—',
        row.dependencia || '—',
        row.dependencia_codigo || '—',
        row.responsable || '—',
        row.responsable_cedula || '—',
        row.responsable_cargo || '—',
        row.responsable_unidad_siac || '—',
        row.responsable_correo || '—',
        row.code || '—',
        row.objetivo_estrategico || '—',
        row.lineamiento_estrategico || '—',
        row.macroactividad || '—',
        row.actividad || '—',
        row.tipo_indicador || '—',
        row.indicador || '—',
        row.meta || '—',
        row.avance_ip !== null && row.avance_ip !== undefined ? `${row.avance_ip}%` : '—',
        row.avance_iip !== null && row.avance_iip !== undefined ? `${row.avance_iip}%` : '—',
        formatPercent(row.avance_total || 0),
        row.estado || '—'
      ];
      const dynamicValues = enrichedFields.map((field) => resolveFieldCellValue(row, field) || '—');
      sheetRows.push([...baseValues, ...dynamicValues]);
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 7 },
      { wch: 12 },
      { wch: 24 },
      { wch: 34 },
      { wch: 18 },
      { wch: 32 },
      { wch: 16 },
      { wch: 28 },
      { wch: 30 },
      { wch: 30 },
      { wch: 16 },
      { wch: 34 },
      { wch: 34 },
      { wch: 24 },
      { wch: 42 },
      { wch: 20 },
      { wch: 38 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      ...enrichedFields.map(() => ({ wch: 30 }))
    ];
    applySheetHeaderStyle(ws, 3, allHeaders.length);
    XLSXStyle.utils.book_append_sheet(wb, ws, '5_DATOS_PLAN_ACCION_COMPLETA');
  };

  const handleExportSingleTable = (tableKey) => {
    try {
      const wb = XLSXStyle.utils.book_new();
      const code = plan.code || 'PED';
      let fileName = `${code}_REFERENCIA.xlsx`;

      if (tableKey === 'ped_info') {
        buildPedInfoSheets(wb);
        fileName = `1_DATOS_Y_VIGENCIAS_${code}.xlsx`;
      } else if (tableKey === 'fields') {
        buildFieldsSheets(wb, filteredFields);
        fileName = `2_TABLA_DE_CAMPOS_Y_OPCIONES_${code}.xlsx`;
      } else if (tableKey === 'dependencies') {
        buildDependenciesSheet(wb, filteredDependencies);
        fileName = `3_TABLA_DEPENDENCIAS_COMPLETA_${code}.xlsx`;
      } else if (tableKey === 'action_plans') {
        buildActionPlansSheet(wb, filteredActionPlans);
        fileName = `4_TABLA_PLANES_DE_ACCION_${code}.xlsx`;
      } else if (tableKey === 'full_data') {
        buildFullActionPlanDataSheet(wb, filteredDataRows);
        fileName = `5_DATOS_PLAN_ACCION_COMPLETA_${code}.xlsx`;
      }

      XLSXStyle.writeFile(wb, fileName);
      enqueueSnackbar(`Tabla exportada correctamente (${fileName})`, { variant: 'success' });
    } catch (err) {
      console.error('Error exporting table:', err);
      enqueueSnackbar('No fue posible exportar la tabla a Excel.', { variant: 'error' });
    }
  };

  const handleExportMasterWorkbook = () => {
    try {
      const wb = XLSXStyle.utils.book_new();
      buildPedInfoSheets(wb);
      buildFieldsSheets(wb, enrichedFields);
      buildDependenciesSheet(wb, termDependencies);
      buildActionPlansSheet(wb, actionPlansList);
      buildFullActionPlanDataSheet(wb, allRows);

      const fileName = `LIBRO_MAESTRO_DATOS_Y_REFERENCIA_${plan.code || 'PED'}.xlsx`;
      XLSXStyle.writeFile(wb, fileName);
      enqueueSnackbar(`Libro maestro con todas las tablas exportado (${fileName})`, { variant: 'success' });
    } catch (err) {
      console.error('Error exporting master workbook:', err);
      enqueueSnackbar('No fue posible generar el libro maestro de Excel.', { variant: 'error' });
    }
  };

  const TABLE_CARDS = [
    {
      key: 'ped_info',
      step: '1',
      title: 'Datos del PED y Vigencias',
      countLabel: `${terms.length} vigencias`,
      color: '#1e40af',
      bgLight: '#eff6ff',
      borderColor: '#bfdbfe',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      icon: <AccountTreeIcon sx={{ fontSize: 22 }} />
    },
    {
      key: 'fields',
      step: '2',
      title: 'Tabla de Campos Creados',
      countLabel: `${enrichedFields.length} columnas`,
      color: '#4338ca',
      bgLight: '#eef2ff',
      borderColor: '#c7d2fe',
      gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
      icon: <ViewColumnIcon sx={{ fontSize: 22 }} />
    },
    {
      key: 'dependencies',
      step: '3',
      title: 'Tabla de Dependencias Completa',
      countLabel: `${termDependencies.length} registros`,
      color: '#0369a1',
      bgLight: '#f0f9ff',
      borderColor: '#bae6fd',
      gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
      icon: <CorporateFareIcon sx={{ fontSize: 22 }} />
    },
    {
      key: 'action_plans',
      step: '4',
      title: 'Tabla de Planes de Acción',
      countLabel: `${actionPlansList.length} planes`,
      color: '#0f766e',
      bgLight: '#f0fdfa',
      borderColor: '#99f6e4',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)',
      icon: <AssignmentTurnedInIcon sx={{ fontSize: 22 }} />
    },
    {
      key: 'full_data',
      step: '5',
      title: 'Datos de Plan de Acción Completa',
      countLabel: `${formatNumber(allRows.length)} registros`,
      color: '#1d4ed8',
      bgLight: '#eff6ff',
      borderColor: '#93c5fd',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
      icon: <DatasetIcon sx={{ fontSize: 22 }} />
    }
  ];

  return (
    <Stack spacing={2.5}>
      {/* CABECERA COMPACTA DEL CENTRO DE TABLAS Y EXPORTACIÓN */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.4 },
          borderRadius: 3.5,
          border: '1.5px solid #bfdbfe',
          background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 60%, #e0f2fe 100%)',
          boxShadow: '0 12px 30px rgba(30, 58, 138, 0.06)'
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 60%, #0284c7 100%)',
                color: 'white',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 8px 18px rgba(30, 64, 175, 0.22)',
                flexShrink: 0
              }}
            >
              <StorageIcon sx={{ fontSize: 24 }} />
            </Box>
            <Typography sx={{ fontSize: { xs: 17, md: 19.5 }, fontWeight: 900, color: '#0f172a', letterSpacing: -0.3 }}>
              Tablas de Datos y Referencia
            </Typography>
            <Chip
              label="EXPORTACIÓN DE DATOS"
              size="small"
              sx={{
                bgcolor: '#dbeafe',
                color: '#1e40af',
                border: '1px solid #93c5fd',
                fontWeight: 900,
                fontSize: 10,
                letterSpacing: 0.4
              }}
            />
          </Stack>

          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportMasterWorkbook}
            sx={{
              textTransform: 'none',
              fontWeight: 900,
              fontSize: 13,
              borderRadius: 2.5,
              px: 2.5,
              py: 1.1,
              whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 55%, #0284c7 100%)',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.2)',
              '&:hover': {
                background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            Exportar Todas las Tablas (.xlsx)
          </Button>
        </Stack>

        {/* TARJETAS INTERACTIVAS DE SELECCIÓN DE TABLA */}
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gap: 1.4,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(5, minmax(0, 1fr))'
            }
          }}
        >
          {TABLE_CARDS.map((card) => {
            const isSelected = activeTable === card.key;
            return (
              <Paper
                key={card.key}
                elevation={0}
                onClick={() => setActiveTable(card.key)}
                sx={{
                  p: 1.6,
                  borderRadius: 2.8,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isSelected ? `2px solid ${card.color}` : '1.5px solid #dbeafe',
                  background: isSelected
                    ? `linear-gradient(145deg, #ffffff 0%, ${card.bgLight} 100%)`
                    : '#ffffff',
                  boxShadow: isSelected
                    ? '0 12px 24px rgba(30, 64, 175, 0.13)'
                    : '0 4px 10px rgba(15, 23, 42, 0.03)',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: card.color,
                    boxShadow: '0 12px 24px rgba(30, 64, 175, 0.11)'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      background: isSelected ? card.gradient : card.bgLight,
                      color: isSelected ? '#ffffff' : card.color,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Tooltip title="Exportar a Excel">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportSingleTable(card.key);
                      }}
                      sx={{
                        bgcolor: '#f1f5f9',
                        color: '#1e3a8a',
                        border: '1px solid #cbd5e1',
                        '&:hover': { bgcolor: '#dbeafe', color: '#1d4ed8' }
                      }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Chip
                  label={`TABLA ${card.step} · ${card.countLabel}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: 9.5,
                    fontWeight: 900,
                    bgcolor: card.bgLight,
                    color: card.color,
                    mb: 0.6
                  }}
                />
                <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>
                  {card.title}
                </Typography>
              </Paper>
            );
          })}
        </Box>
      </Paper>

      {/* ==========================================================================
          TABLA 1: DATOS DEL PED Y VIGENCIAS
         ========================================================================== */}
      {activeTable === 'ped_info' && (
        <Paper elevation={0} sx={{ borderRadius: 3.5, border: '1px solid #dbeafe', overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ p: { xs: 2, md: 2.2 }, bgcolor: '#f8fbff', borderBottom: '1px solid #dbeafe' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: '#1e3a8a' }}>
                  1. Datos del Plan Estratégico de Desarrollo (PED) y Vigencias
                </Typography>
                <Chip
                  label={`${terms.length} vigencias`}
                  size="small"
                  sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 900, fontSize: 11 }}
                />
              </Stack>
              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportSingleTable('ped_info')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: 2,
                  px: 2.2,
                  py: 0.9,
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
                }}
              >
                Exportar Datos del PED (.xlsx)
              </Button>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                mb: 3
              }}
            >
              {[
                ['Código Oficial', plan.code || '—', '#1e40af'],
                ['Nombre del PED', plan.name || '—', '#0f172a'],
                ['Periodo de Vigencia', `${plan.starts_on || '—'} a ${plan.ends_on || '—'}`, '#0369a1'],
                ['Estado del Plan', PLAN_STATUS_LABELS[plan.status]?.label || plan.status || 'Activo', '#1d4ed8'],
                ['Columnas Configuradas', `${enrichedFields.length} campos (${enrichedFields.filter((f) => f.active !== false).length} activos)`, '#4338ca'],
                ['Dependencias Asignadas', `${formatNumber(termDependencies.length)} registros en vigencias`, '#0284c7'],
                ['Planes de Acción Creados', `${formatNumber(actionPlansList.length)} planes institucionales`, '#1e3a8a'],
                ['Total Registros / Avance', `${formatNumber(allRows.length)} ítems · ${formatPercent(kpis.ejecucionGeneral || 0)}`, '#1e40af']
              ].map(([label, value, color]) => (
                <Paper
                  key={label}
                  elevation={0}
                  sx={{
                    p: 1.8,
                    borderRadius: 2.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#f8fafc'
                  }}
                >
                  <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 900, color, mt: 0.5, overflowWrap: 'anywhere' }}>
                    {value}
                  </Typography>
                </Paper>
              ))}
            </Box>

            <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: '#1e3a8a', mb: 1.2 }}>
              Tabla de Vigencias Configuradas en el PED ({terms.length})
            </Typography>

            <TableContainer sx={{ border: '1px solid #dbeafe', borderRadius: 2.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Vigencia / Año</TableCell>
                    <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Nombre</TableCell>
                    <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Fecha Inicio</TableCell>
                    <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Fecha Fin</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Estado</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Dependencias Configuradas</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Planes de Acción</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Total Registros</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Avance Promedio</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {terms.map((term) => {
                    const tp = termsProgress.find((t) => Number(t.year) === Number(term.year)) || {};
                    const depsCount = tp.dependenciesCount ?? termDependencies.filter((d) => Number(d.year) === Number(term.year)).length;
                    const statusMeta = PLAN_STATUS_LABELS[term.status] || { label: term.status, bg: '#f1f5f9', color: '#475569' };
                    return (
                      <TableRow key={term.id || term.year} hover>
                        <TableCell sx={{ fontWeight: 900, color: '#1e3a8a', fontSize: 14 }}>{term.year}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>{term.name || `Vigencia ${term.year}`}</TableCell>
                        <TableCell sx={{ color: '#475569' }}>{term.starts_on || '—'}</TableCell>
                        <TableCell sx={{ color: '#475569' }}>{term.ends_on || '—'}</TableCell>
                        <TableCell align="center">
                          <Chip label={statusMeta.label} size="small" sx={{ bgcolor: statusMeta.bg, color: statusMeta.color, fontWeight: 800, fontSize: 11 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#0369a1' }}>{formatNumber(depsCount)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#1e40af' }}>{formatNumber(tp.plansCount || 0)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>{formatNumber(tp.activitiesCount || 0)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 900, color: '#1e3a8a' }}>{formatPercent(tp.avgProgress || 0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}

      {/* ==========================================================================
          TABLA 2: TABLA DE CAMPOS CREADOS (CON TODOS LOS DATOS Y OPCIONES)
         ========================================================================== */}
      {activeTable === 'fields' && (
        <Paper elevation={0} sx={{ borderRadius: 3.5, border: '1px solid #dbeafe', overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ p: { xs: 2, md: 2.2 }, bgcolor: '#f8fbff', borderBottom: '1px solid #dbeafe' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: '#1e3a8a' }}>
                  2. Tabla de Campos Creados del PED ({filteredFields.length} de {enrichedFields.length} columnas)
                </Typography>
                <Chip
                  label={`${enrichedFields.length} columnas configuradas`}
                  size="small"
                  sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 900, fontSize: 11 }}
                />
              </Stack>

              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportSingleTable('fields')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: 2,
                  px: 2.2,
                  py: 0.9,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)'
                }}
              >
                Exportar Campos y Opciones (.xlsx)
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mt: 2 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar por nombre de campo, identificador (key), tipo de información o cualquier opción de lista..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#64748b', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: fieldSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setFieldSearch('')}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }}
                sx={{ bgcolor: '#fff' }}
              />

              <Stack direction="row" spacing={0.8} flexShrink={0} flexWrap="wrap">
                {[
                  ['all', 'Todos los campos'],
                  ['choice', 'Listas desplegables'],
                  ['required', 'Obligatorios'],
                  ['optional', 'Opcionales']
                ].map(([val, label]) => (
                  <Chip
                    key={val}
                    label={label}
                    clickable
                    onClick={() => setFieldTypeFilter(val)}
                    sx={{
                      fontWeight: 800,
                      fontSize: 11.5,
                      bgcolor: fieldTypeFilter === val ? '#1e40af' : '#ffffff',
                      color: fieldTypeFilter === val ? '#ffffff' : '#475569',
                      border: '1px solid',
                      borderColor: fieldTypeFilter === val ? '#1e40af' : '#cbd5e1'
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 680 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ width: 60, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>#</TableCell>
                  <TableCell sx={{ minWidth: 220, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Nombre Visible / Identificador</TableCell>
                  <TableCell sx={{ minWidth: 165, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Tipo de Información</TableCell>
                  <TableCell align="center" sx={{ width: 120, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Obligatorio</TableCell>
                  <TableCell align="center" sx={{ width: 110, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Estado</TableCell>
                  <TableCell sx={{ minWidth: 380, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>
                    Opciones / Lista Desplegable y Valores Completos
                  </TableCell>
                  <TableCell align="right" sx={{ width: 130, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Diligenciados</TableCell>
                  <TableCell align="right" sx={{ width: 120, bgcolor: '#1e3a8a', color: 'white', fontWeight: 900 }}>Cobertura</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFields.map((field) => {
                  const isExpanded = expandedFieldId === (field.id || field.key);
                  const hasOptions = field.allOptionNames.length > 0;
                  const previewOptions = isExpanded ? field.allOptionNames : field.allOptionNames.slice(0, 4);

                  return (
                    <React.Fragment key={field.id || field.key}>
                      <TableRow hover sx={{ verticalAlign: 'top' }}>
                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <Chip
                            size="small"
                            label={field.displayIndex}
                            sx={{ fontWeight: 900, bgcolor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}
                          />
                        </TableCell>

                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#0f172a' }}>
                            {field.label}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#475569', bgcolor: '#f1f5f9', px: 0.7, py: 0.15, borderRadius: 1 }}>
                            {field.key}
                          </Typography>
                          {field.formula && (
                            <Typography variant="caption" display="block" sx={{ color: '#0369a1', fontWeight: 700, mt: 0.4 }}>
                              Fórmula: {field.formula}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={field.typeLabel}
                            sx={{ fontWeight: 800, fontSize: 11.5, borderColor: '#94a3b8', color: '#1e293b' }}
                          />
                        </TableCell>

                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <Chip
                            size="small"
                            label={field.required ? 'Obligatorio' : 'Opcional'}
                            sx={{
                              fontWeight: 900,
                              fontSize: 11,
                              bgcolor: field.required ? '#1d4ed8' : '#f8fafc',
                              color: field.required ? '#ffffff' : '#475569',
                              border: field.required ? 'none' : '1px solid #cbd5e1'
                            }}
                          />
                        </TableCell>

                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <Chip
                            size="small"
                            label={field.active === false ? 'Histórico' : 'Activo'}
                            sx={{
                              fontWeight: 800,
                              fontSize: 11,
                              bgcolor: field.active === false ? '#f1f5f9' : '#dbeafe',
                              color: field.active === false ? '#64748b' : '#1e40af'
                            }}
                          />
                        </TableCell>

                        <TableCell sx={{ py: 1.5 }}>
                          {hasOptions ? (
                            <Box>
                              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
                                <Chip
                                  size="small"
                                  label={`${field.allOptionNames.length} opciones configuradas`}
                                  sx={{ bgcolor: '#e0e7ff', color: '#3730a3', fontWeight: 900, fontSize: 11 }}
                                />
                                {field.allOptionNames.length > 4 && (
                                  <Button
                                    size="small"
                                    endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    onClick={() => setExpandedFieldId(isExpanded ? null : (field.id || field.key))}
                                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11.5, py: 0 }}
                                  >
                                    {isExpanded ? 'Ocultar lista' : `Ver las ${field.allOptionNames.length} opciones`}
                                  </Button>
                                )}
                              </Stack>

                              <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                                {previewOptions.map((opt, i) => (
                                  <Chip
                                    key={`${field.key}-opt-${i}`}
                                    size="small"
                                    label={`${i + 1}. ${opt}`}
                                    sx={{
                                      height: 'auto',
                                      py: 0.35,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      bgcolor: '#f8fafc',
                                      color: '#1e293b',
                                      border: '1px solid #e2e8f0',
                                      '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.3 }
                                    }}
                                  />
                                ))}
                              </Stack>
                            </Box>
                          ) : field.isChoice ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                size="small"
                                label="0 opciones fijas"
                                sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {field.validation_rules?.shared_catalog === 'institutional_policies'
                                  ? 'Catálogo institucional dinámico'
                                  : 'Sin opciones precargadas en lista'}
                              </Typography>
                            </Stack>
                          ) : (
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>
                                Estándar (Captura abierta)
                              </Typography>
                              {field.observedValues.length > 0 && (
                                <Typography variant="caption" sx={{ color: '#475569' }}>
                                  Ejemplos frecuentes: {field.observedValues.slice(0, 3).map((v) => `${v.label} (${v.count})`).join(' · ')}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </TableCell>

                        <TableCell align="right" sx={{ py: 1.5, fontWeight: 900, color: '#0f172a' }}>
                          {formatNumber(field.filledCount)}
                          <Typography variant="caption" display="block" color="text.secondary">
                            Sin dato: {formatNumber(field.emptyCount)}
                          </Typography>
                        </TableCell>

                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography sx={{ fontWeight: 900, fontSize: 13, color: field.coveragePct >= 80 ? '#1e40af' : '#475569' }}>
                            {formatPercent(field.coveragePct)}
                          </Typography>
                          <Box sx={{ mt: 0.5, height: 5, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.min(field.coveragePct, 100)}%`, height: '100%', bgcolor: '#2563eb' }} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ==========================================================================
          TABLA 3: TABLA DE DEPENDENCIAS COMPLETA
         ========================================================================== */}
      {activeTable === 'dependencies' && (
        <Paper elevation={0} sx={{ borderRadius: 3.5, border: '1px solid #dbeafe', overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ p: { xs: 2, md: 2.2 }, bgcolor: '#f8fbff', borderBottom: '1px solid #dbeafe' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: '#1e3a8a' }}>
                  3. Tabla de Dependencias Completa ({filteredDependencies.length} registros)
                </Typography>
                <Chip
                  label={depYearFilter === 'all' ? 'Todas las vigencias' : `Vigencia ${depYearFilter}`}
                  size="small"
                  sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 900, fontSize: 11 }}
                />
              </Stack>

              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportSingleTable('dependencies')}
                disabled={!filteredDependencies.length}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: 2,
                  px: 2.2,
                  py: 0.9,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)'
                }}
              >
                Exportar Dependencias (.xlsx)
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mt: 2 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar por dependencia, nombre de responsable, cédula, unidad en SIAC, cargo o correo..."
                value={depSearch}
                onChange={(e) => setDepSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: depSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setDepSearch('')}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }}
                sx={{ bgcolor: '#fff' }}
              />

              <Stack direction="row" spacing={0.7} flexShrink={0} flexWrap="wrap">
                <Chip
                  label="Todas las vigencias"
                  clickable
                  onClick={() => setDepYearFilter('all')}
                  sx={{
                    fontWeight: 800,
                    fontSize: 11.5,
                    bgcolor: depYearFilter === 'all' ? '#0284c7' : '#ffffff',
                    color: depYearFilter === 'all' ? '#ffffff' : '#475569',
                    border: '1px solid',
                    borderColor: depYearFilter === 'all' ? '#0284c7' : '#cbd5e1'
                  }}
                />
                {availableDepYears.map((yr) => (
                  <Chip
                    key={yr}
                    label={yr}
                    clickable
                    onClick={() => setDepYearFilter(String(yr))}
                    sx={{
                      fontWeight: 800,
                      fontSize: 11.5,
                      bgcolor: String(depYearFilter) === String(yr) ? '#0284c7' : '#ffffff',
                      color: String(depYearFilter) === String(yr) ? '#ffffff' : '#475569',
                      border: '1px solid',
                      borderColor: String(depYearFilter) === String(yr) ? '#0284c7' : '#cbd5e1'
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 650 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 55 }}>#</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 90 }}>Vigencia</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 220 }}>Dependencia</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 210 }}>Responsable</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 120 }}>Cédula</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 220 }}>Unidad en SIAC</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 200 }}>Cargo</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 210 }}>Correo</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 160 }}>Plan de Acción</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 100 }}>Registros</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 120 }}>Avance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDependencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 5, color: '#64748b' }}>
                      No se encontraron dependencias para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDependencies.slice(0, depLimit).map((dep, idx) => (
                    <TableRow key={dep.id || `${dep.year}-${dep.dependency_name}-${idx}`} hover>
                      <TableCell align="center" sx={{ color: '#64748b', fontWeight: 700 }}>{idx + 1}</TableCell>
                      <TableCell align="center">
                        <Chip label={dep.year || '—'} size="small" sx={{ fontWeight: 900, bgcolor: '#eff6ff', color: '#1e40af' }} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 900, fontSize: 13, color: '#0f172a' }}>{dep.dependency_name}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>{dep.dependency_code}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 12.5 }}>{dep.responsible_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>{dep.responsible_document}</TableCell>
                      <TableCell sx={{ color: '#475569', fontSize: 12.5 }}>{dep.responsible_unit_siac}</TableCell>
                      <TableCell sx={{ color: '#475569', fontSize: 12.5 }}>{dep.responsible_position}</TableCell>
                      <TableCell sx={{ color: '#0369a1', fontSize: 12.5 }}>{dep.responsible_email}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={dep.action_plan_code || 'Sin plan'}
                          sx={{
                            fontWeight: 800,
                            fontSize: 11,
                            bgcolor: dep.has_action_plan ? '#dbeafe' : '#f1f5f9',
                            color: dep.has_action_plan ? '#1e40af' : '#64748b'
                          }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900, color: '#0f172a' }}>{formatNumber(dep.items_count || 0)}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900, color: '#1e3a8a' }}>{formatPercent(dep.avg_progress || 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filteredDependencies.length > depLimit && (
            <Box sx={{ p: 1.5, bgcolor: '#f8fbff', borderTop: '1px solid #dbeafe', textAlign: 'center' }}>
              <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  Mostrando {depLimit} de {filteredDependencies.length} registros
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setDepLimit((prev) => prev + 100)}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 999 }}
                >
                  Mostrar 100 más
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      )}

      {/* ==========================================================================
          TABLA 4: TABLA DE PLANES DE ACCIÓN
         ========================================================================== */}
      {activeTable === 'action_plans' && (
        <Paper elevation={0} sx={{ borderRadius: 3.5, border: '1px solid #dbeafe', overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ p: { xs: 2, md: 2.2 }, bgcolor: '#f8fbff', borderBottom: '1px solid #dbeafe' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: '#1e3a8a' }}>
                  4. Tabla de Planes de Acción por Dependencia ({filteredActionPlans.length} planes)
                </Typography>
                <Chip
                  label={`${formatNumber(filteredActionPlans.reduce((acc, p) => acc + (p.items_count || 0), 0))} registros`}
                  size="small"
                  sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 900, fontSize: 11 }}
                />
              </Stack>

              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportSingleTable('action_plans')}
                disabled={!filteredActionPlans.length}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: 2,
                  px: 2.2,
                  py: 0.9,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)'
                }}
              >
                Exportar Planes de Acción (.xlsx)
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mt: 2 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar por código de plan, dependencia, responsable, cédula, cargo o correo..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#1e40af', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: planSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setPlanSearch('')}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }}
                sx={{ bgcolor: '#fff' }}
              />

              <Stack direction="row" spacing={0.7} flexShrink={0} flexWrap="wrap">
                <Chip
                  label="Todos los años"
                  clickable
                  onClick={() => setPlanYearFilter('all')}
                  sx={{
                    fontWeight: 800,
                    fontSize: 11.5,
                    bgcolor: planYearFilter === 'all' ? '#1e40af' : '#ffffff',
                    color: planYearFilter === 'all' ? '#ffffff' : '#475569',
                    border: '1px solid',
                    borderColor: planYearFilter === 'all' ? '#1e40af' : '#cbd5e1'
                  }}
                />
                {availableDepYears.map((yr) => (
                  <Chip
                    key={yr}
                    label={yr}
                    clickable
                    onClick={() => setPlanYearFilter(String(yr))}
                    sx={{
                      fontWeight: 800,
                      fontSize: 11.5,
                      bgcolor: String(planYearFilter) === String(yr) ? '#1e40af' : '#ffffff',
                      color: String(planYearFilter) === String(yr) ? '#ffffff' : '#475569',
                      border: '1px solid',
                      borderColor: String(planYearFilter) === String(yr) ? '#1e40af' : '#cbd5e1'
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 650 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 55 }}>#</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 90 }}>Vigencia</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 210 }}>Código Plan</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 230 }}>Dependencia</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 210 }}>Responsable</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 120 }}>Cédula</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 200 }}>Cargo / Unidad SIAC</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 200 }}>Correo</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 150 }}>Estado</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 100 }}>Registros</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 150 }}>Avance Promedio</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredActionPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 5, color: '#64748b' }}>
                      No se encontraron planes de acción para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActionPlans.slice(0, planLimit).map((ap, idx) => {
                    const statusMeta = PLAN_STATUS_LABELS[ap.status] || { label: ap.status, bg: '#dbeafe', color: '#1e40af' };
                    return (
                      <TableRow key={ap.id} hover>
                        <TableCell align="center" sx={{ color: '#64748b', fontWeight: 700 }}>{idx + 1}</TableCell>
                        <TableCell align="center">
                          <Chip label={ap.year || '—'} size="small" sx={{ fontWeight: 900, bgcolor: '#eff6ff', color: '#1e40af' }} />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 900, fontSize: 12.5, color: '#1e3a8a', fontFamily: 'monospace' }}>
                            {ap.code}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            Versión v{ap.instrument_version || 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 900, fontSize: 13, color: '#0f172a' }}>{ap.dependency_name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>{ap.dependency_code}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 12.5 }}>{ap.responsible_name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>{ap.responsible_document}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{ap.responsible_position}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>{ap.responsible_unit_siac}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#0369a1', fontSize: 12.5 }}>{ap.responsible_email}</TableCell>
                        <TableCell align="center">
                          <Chip label={statusMeta.label} size="small" sx={{ bgcolor: statusMeta.bg, color: statusMeta.color, fontWeight: 800, fontSize: 11 }} />
                        </TableCell>
                        <TableCell align="center">
                          <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>{formatNumber(ap.items_count || 0)}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ap.completadas || 0} cumpl.
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#1e3a8a' }}>
                            {formatPercent(ap.avg_progress || 0)}
                          </Typography>
                          <Box sx={{ mt: 0.4, height: 5, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.min(ap.avg_progress || 0, 100)}%`, height: '100%', bgcolor: '#2563eb' }} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filteredActionPlans.length > planLimit && (
            <Box sx={{ p: 1.5, bgcolor: '#f8fbff', borderTop: '1px solid #dbeafe', textAlign: 'center' }}>
              <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  Mostrando {planLimit} de {filteredActionPlans.length} planes
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setPlanLimit((prev) => prev + 100)}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 999 }}
                >
                  Mostrar 100 más
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      )}

      {/* ==========================================================================
          TABLA 5: TABLA DE DATOS DE PLAN DE ACCIÓN COMPLETA (SÁBANA MAESTRA)
         ========================================================================== */}
      {activeTable === 'full_data' && (
        <Paper elevation={0} sx={{ borderRadius: 3.5, border: '1px solid #dbeafe', overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ p: { xs: 2, md: 2.2 }, bgcolor: '#f8fbff', borderBottom: '1px solid #dbeafe' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: '#1e3a8a' }}>
                  5. Tabla de Datos de Plan de Acción Completa ({formatNumber(filteredDataRows.length)} registros)
                </Typography>
                <Chip
                  label={`${enrichedFields.length} columnas`}
                  size="small"
                  sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 900, fontSize: 11 }}
                />
              </Stack>

              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportSingleTable('full_data')}
                disabled={!filteredDataRows.length}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: 2,
                  px: 2.2,
                  py: 0.9,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)'
                }}
              >
                Exportar Sabana Completa ({formatNumber(filteredDataRows.length)}) (.xlsx)
              </Button>
            </Stack>

            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gap: 1.2,
                gridTemplateColumns: { xs: '1fr', md: '1.4fr 1.1fr 0.7fr 0.8fr auto' },
                alignItems: 'center'
              }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar en cualquier columna (objetivo, lineamiento, actividad, indicador, responsable, cédula...)"
                value={dataSearch}
                onChange={(e) => {
                  setDataSearch(e.target.value);
                  setDataLimit(60);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#1e40af', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: dataSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setDataSearch('')}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }}
                sx={{ bgcolor: '#fff' }}
              />

              <Autocomplete
                size="small"
                options={availableDataDependencies}
                value={dataDepFilter || null}
                onChange={(_, val) => {
                  setDataDepFilter(val || '');
                  setDataLimit(60);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Dependencia" placeholder="Todas" sx={{ bgcolor: '#fff' }} />
                )}
              />

              <TextField
                select
                size="small"
                label="Vigencia"
                value={dataYearFilter}
                onChange={(e) => {
                  setDataYearFilter(e.target.value);
                  setDataLimit(60);
                }}
                SelectProps={{ native: true }}
                sx={{ bgcolor: '#fff' }}
              >
                <option value="all">Todas</option>
                {availableDepYears.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Estado"
                value={dataEstadoFilter}
                onChange={(e) => {
                  setDataEstadoFilter(e.target.value);
                  setDataLimit(60);
                }}
                SelectProps={{ native: true }}
                sx={{ bgcolor: '#fff' }}
              >
                <option value="all">Todos</option>
                <option value="Completado">Completado</option>
                <option value="En ejecución">En ejecución</option>
                <option value="Sin iniciar">Sin iniciar</option>
              </TextField>

              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterAltOffIcon />}
                onClick={() => {
                  setDataSearch('');
                  setDataDepFilter('');
                  setDataYearFilter('all');
                  setDataEstadoFilter('all');
                  setDataLimit(60);
                }}
                sx={{ textTransform: 'none', fontWeight: 800, height: 40, borderRadius: 2 }}
              >
                Limpiar
              </Button>
            </Box>
          </Box>

          <TableContainer sx={{ maxHeight: 680 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 2200 }}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ bgcolor: '#0f172a', color: 'white', fontWeight: 900, width: 55 }}>#</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#0f172a', color: 'white', fontWeight: 900, width: 85 }}>Año</TableCell>
                  <TableCell sx={{ bgcolor: '#0f172a', color: 'white', fontWeight: 900, minWidth: 170 }}>Código Plan</TableCell>
                  <TableCell sx={{ bgcolor: '#0f172a', color: 'white', fontWeight: 900, minWidth: 220 }}>Dependencia</TableCell>
                  <TableCell sx={{ bgcolor: '#0f172a', color: 'white', fontWeight: 900, minWidth: 200 }}>Responsable / Cédula</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 240 }}>Objetivo Estratégico</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 240 }}>Lineamiento Estratégico</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 200 }}>Macroactividad</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 280 }}>Actividad</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 240 }}>Indicador</TableCell>
                  <TableCell sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, minWidth: 160 }}>Meta</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 110 }}>Avance IP</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 110 }}>Avance IIP</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 120 }}>Avance Total</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#1e3a8a', color: 'white', fontWeight: 900, width: 120 }}>Estado</TableCell>
                  {extraDynamicFields.map((field) => (
                    <TableCell
                      key={`dyn-col-${field.id || field.key}`}
                      sx={{ bgcolor: '#1e40af', color: 'white', fontWeight: 900, minWidth: 210 }}
                    >
                      <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
                        {field.label}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: '#bfdbfe', fontFamily: 'monospace' }}>
                        {field.key}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDataRows.slice(0, dataLimit).map((row, idx) => (
                  <TableRow key={row.id || idx} hover sx={{ verticalAlign: 'top' }}>
                    <TableCell align="center" sx={{ fontWeight: 700, color: '#64748b' }}>{idx + 1}</TableCell>
                    <TableCell align="center">
                      <Chip label={row.anio || '—'} size="small" sx={{ fontWeight: 900, bgcolor: '#eff6ff', color: '#1e40af' }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#1e3a8a', fontSize: 12 }}>
                      {row.plan_code || '—'}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a' }}>{row.dependencia}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>{row.dependencia_codigo}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b' }}>{row.responsable}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                        CC: {row.responsable_cedula || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#334155' }}>{row.objetivo_estrategico}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#334155' }}>{row.lineamiento_estrategico}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>{row.macroactividad}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#0f172a' }}>{row.actividad}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#1e3a8a', fontWeight: 700 }}>{row.indicador}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>{row.meta}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>
                      {row.avance_ip !== null && row.avance_ip !== undefined ? formatPercent(row.avance_ip) : '—'}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>
                      {row.avance_iip !== null && row.avance_iip !== undefined ? formatPercent(row.avance_iip) : '—'}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 900, color: '#1e3a8a' }}>
                      {formatPercent(row.avance_total || 0)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={row.estado}
                        sx={{
                          fontWeight: 800,
                          fontSize: 10.5,
                          bgcolor:
                            row.estado === 'Completado'
                              ? '#dbeafe'
                              : row.estado === 'En ejecución'
                                ? '#fef3c7'
                                : '#fee2e2',
                          color:
                            row.estado === 'Completado'
                              ? '#1e40af'
                              : row.estado === 'En ejecución'
                                ? '#b45309'
                                : '#b91c1c'
                        }}
                      />
                    </TableCell>
                    {extraDynamicFields.map((field) => {
                      const val = resolveFieldCellValue(row, field);
                      return (
                        <TableCell key={`cell-${row.id}-${field.key}`} sx={{ fontSize: 12, color: '#334155' }}>
                          {val || '—'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredDataRows.length > dataLimit && (
            <Box sx={{ p: 2, bgcolor: '#f8fbff', borderTop: '1px solid #dbeafe', textAlign: 'center' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" alignItems="center">
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                  Mostrando {formatNumber(dataLimit)} de {formatNumber(filteredDataRows.length)} registros en pantalla (la exportación a Excel incluye los {formatNumber(filteredDataRows.length)} registros completos).
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setDataLimit((prev) => prev + 100)}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 999 }}
                >
                  Mostrar 100 registros más
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      )}
    </Stack>
  );
}

export default React.memo(PedDataReferenceTables);
