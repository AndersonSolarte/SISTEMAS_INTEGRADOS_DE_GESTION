import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Card, Paper, Typography, Stack, Grid, TextField, MenuItem, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, IconButton, Tabs, Tab
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import gestionInformacionService from '../../services/gestionInformacionService';

const normalizeStr = (str = '') =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

export default function ContextoExternoDashboardPanel({ onBack }) {
  const [mainTab, setMainTab] = useState(0); // 0: Oferta Académica, 1: Información Poblacional
  const [poblacionalSubTab, setPoblacionalSubTab] = useState(0); // 0: Ingreso, 1: Cobertura, 2: Salida

  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState([]);
  const [visualStyle, setVisualStyle] = useState('mindmap'); // 'hex', 'mindmap', 'cards'

  // Filters for Oferta Académica
  const [nivelFormacion, setNivelFormacion] = useState('TODOS');
  const [searchKeyword, setSearchKeyword] = useState('DERECHO');
  const [selectedDepto, setSelectedDepto] = useState('TODOS');
  const [selectedMunicipio, setSelectedMunicipio] = useState('TODOS');

  // Filters for Poblacional
  const [pobPeriodo, setPobPeriodo] = useState('TODOS');
  const [pobDepto, setPobDepto] = useState('TODOS');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch normalized rows for Contexto Externo
      const response = await gestionInformacionService.getNormalizadosContextoExterno();
      const rows = response?.data || response?.records || [];
      setRawRows(rows);
    } catch (err) {
      console.error('Error cargando datos de Contexto Externo:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Parse and extract normalized data
  const parsedOfertaRows = useMemo(() => {
    return rawRows
      .filter((r) => String(r.base_indicador || r.baseIndicador || '').toUpperCase() === 'OFERTA' || r.tipo_registro === 'oferta')
      .map((r) => {
        let norm = {};
        try {
          const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data || {};
          norm = raw?.normalizado || raw?.original || {};
        } catch (_) {}

        return {
          id: r.id,
          ies: r.ies || norm.NOMBRE_INSTITUCION || '',
          programa: r.programa_comparado || norm.NOMBRE_DEL_PROGRAMA || '',
          nivelAcademico: normalizeStr(norm.NIVEL_ACADEMICO || (norm.NIVEL_DE_FORMACION === 'UNIVERSITARIO' ? 'PREGRADO' : 'POSGRADO')),
          nivelFormacion: normalizeStr(norm.NIVEL_DE_FORMACION || norm.NIVEL_ACADEMICO || ''),
          caracter: normalizeStr(norm.CARACTER_ACADEMICO || ''),
          sector: normalizeStr(norm.SECTOR || (r.ies?.toLowerCase().includes('universidad del tolima') || r.ies?.toLowerCase().includes('nacional') ? 'OFICIAL' : 'PRIVADO')),
          modalidad: normalizeStr(r.modalidad || norm.MODALIDAD || 'PRESENCIAL'),
          reconocimiento: normalizeStr(norm.RECONOCIMIENTO_DEL_MINISTERIO || 'REGISTRO CALIFICADO'),
          creditos: Number(r.creditos || norm.NUMERO_CREDITOS || 0),
          semestres: Number(r.semestres || norm.NUMERO_PERIODOS_DE_DURACION || 0),
          costoMatricula: Number(r.costo_matricula || norm.COSTO_MATRICULA_ESTUD_NUEVOS || 0),
          departamento: normalizeStr(r.departamento || norm.DEPARTAMENTO_OFERTA_PROGRAMA || ''),
          municipio: normalizeStr(r.municipio || norm.MUNICIPIO_OFERTA_PROGRAMA || '')
        };
      });
  }, [rawRows]);

  // Filtered Oferta rows by keywords & Nivel
  const filteredOferta = useMemo(() => {
    const keywords = searchKeyword
      .split(/\s+/)
      .map(normalizeStr)
      .filter((k) => k.length > 1);

    return parsedOfertaRows.filter((r) => {
      // Nivel filter
      if (nivelFormacion !== 'TODOS') {
        if (nivelFormacion === 'PREGRADO' && !r.nivelAcademico.includes('PREGRADO') && !r.nivelFormacion.includes('UNIVERSITARIO')) return false;
        if (nivelFormacion === 'POSGRADO' && !r.nivelAcademico.includes('POSGRADO') && r.nivelFormacion.includes('UNIVERSITARIO')) return false;
        if (['ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO'].includes(nivelFormacion) && !r.nivelFormacion.includes(nivelFormacion)) return false;
      }

      // Depto & Municipio filter
      if (selectedDepto !== 'TODOS' && r.departamento !== selectedDepto) return false;
      if (selectedMunicipio !== 'TODOS' && r.municipio !== selectedMunicipio) return false;

      // Keywords match
      if (keywords.length === 0) return true;
      const progName = normalizeStr(r.programa);
      return keywords.some((kw) => progName.includes(kw));
    });
  }, [parsedOfertaRows, nivelFormacion, searchKeyword, selectedDepto, selectedMunicipio]);

  // Options for Dropdowns
  const deptoOptions = useMemo(() => {
    return ['TODOS', ...Array.from(new Set(parsedOfertaRows.map((r) => r.departamento).filter(Boolean))).sort()];
  }, [parsedOfertaRows]);

  const municipioOptions = useMemo(() => {
    const subset = selectedDepto === 'TODOS' ? parsedOfertaRows : parsedOfertaRows.filter((r) => r.departamento === selectedDepto);
    return ['TODOS', ...Array.from(new Set(subset.map((r) => r.municipio).filter(Boolean))).sort()];
  }, [parsedOfertaRows, selectedDepto]);

  // Computed Metrics for Oferta Académica
  const ofertaMetrics = useMemo(() => {
    const total = filteredOferta.length;
    let acreditacionAltaCalidad = 0;
    let registroCalificado = 0;
    let publico = 0;
    let privado = 0;

    let presencial = 0;
    let virtual = 0;
    let aDistancia = 0;
    let dual = 0;

    const creditosList = [];
    const semestresMap = {};

    filteredOferta.forEach((r) => {
      const rec = r.reconocimiento;
      if (rec.includes('ALTA CALIDAD') || rec.includes('ACREDITAC')) acreditacionAltaCalidad++;
      else registroCalificado++;

      const sec = r.sector;
      if (sec.includes('OFICIAL') || sec.includes('PUBLIC')) publico++;
      else privado++;

      const mod = r.modalidad;
      if (mod.includes('PRESENCIAL')) presencial++;
      else if (mod.includes('VIRTUAL')) virtual++;
      else if (mod.includes('DISTANCIA')) aDistancia++;
      else if (mod.includes('DUAL')) dual++;
      else presencial++;

      if (r.creditos > 0) creditosList.push(r.creditos);
      if (r.semestres > 0) {
        semestresMap[r.semestres] = (semestresMap[r.semestres] || 0) + 1;
      }
    });

    const minCreditos = creditosList.length ? Math.min(...creditosList) : 0;
    const maxCreditos = creditosList.length ? Math.max(...creditosList) : 0;
    const avgCreditos = creditosList.length ? Math.round(creditosList.reduce((a, b) => a + b, 0) / creditosList.length) : 0;

    return {
      total,
      acreditacionAltaCalidad,
      registroCalificado,
      publico,
      privado,
      presencial,
      virtual,
      aDistancia,
      dual,
      minCreditos,
      maxCreditos,
      avgCreditos,
      semestresMap
    };
  }, [filteredOferta]);

  // Municipio summary table
  const municipioSummary = useMemo(() => {
    const map = {};
    filteredOferta.forEach((r) => {
      const mun = r.municipio || 'NO ESPECIFICADO';
      map[mun] = (map[mun] || 0) + 1;
    });
    return Object.entries(map)
      .map(([municipio, total]) => ({ municipio, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredOferta]);

  // Data processing for Poblacional Sub-segments
  const parsedPoblacionalRows = useMemo(() => {
    return rawRows
      .filter((r) => String(r.base_indicador || r.baseIndicador || '').toUpperCase() !== 'OFERTA' && r.tipo_registro === 'serie')
      .map((r) => {
        let norm = {};
        try {
          const raw = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data || {};
          norm = raw?.normalizado || raw?.original || {};
        } catch (_) {}
        return {
          ...r,
          base: normalizeStr(r.base_indicador || r.baseIndicador || ''),
          valorNum: Number(r.valor || norm.VALOR || 0),
          periodo: String(r.periodo_referencia || r.anio || '').trim(),
          ies: r.ies || norm.NOMBRE_INSTITUCION || '',
          programa: r.programa_comparado || norm.NOMBRE_DEL_PROGRAMA || '',
          departamento: normalizeStr(r.departamento || norm.DEPARTAMENTO_OFERTA_PROGRAMA || ''),
          municipio: normalizeStr(r.municipio || norm.MUNICIPIO_OFERTA_PROGRAMA || '')
        };
      });
  }, [rawRows]);

  const activePoblacionalBase = poblacionalSubTab === 0 ? ['INSCRITOS', 'ADMITIDOS', 'PRIMER CURSO'] : poblacionalSubTab === 1 ? ['MATRICULADOS'] : ['GRADUADOS'];

  const filteredPoblacional = useMemo(() => {
    return parsedPoblacionalRows.filter((r) => {
      if (!activePoblacionalBase.some((b) => r.base.includes(b))) return false;
      if (pobPeriodo !== 'TODOS' && r.periodo !== pobPeriodo) return false;
      if (pobDepto !== 'TODOS' && r.departamento !== pobDepto) return false;
      return true;
    });
  }, [parsedPoblacionalRows, activePoblacionalBase, pobPeriodo, pobDepto]);

  return (
    <Stack spacing={2.5} sx={{ width: '100%', pb: 6 }}>
      {/* Top Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 0,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)'
        }}
      >
        <Box
          sx={{
            background: 'linear-gradient(135deg, #881337 0%, #be123c 50%, #9f1239 100%)',
            color: '#fff',
            py: 1.8,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {onBack && (
              <IconButton onClick={onBack} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                <ArrowBackRoundedIcon />
              </IconButton>
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: { xs: 15, md: 18 } }}>
                OFERTA REGIONAL DE PROGRAMAS ACADÉMICOS SIMILARES
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                Sistema de Gestión de Información del Contexto Externo — UNICESMAG
              </Typography>
            </Box>
          </Stack>
          <Chip label="Contexto Externo" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 800, px: 1 }} />
        </Box>

        {/* Main Tabs Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8fafc', px: 2 }}>
          <Tabs value={mainTab} onChange={(_, val) => setMainTab(val)} textColor="primary" indicatorColor="primary">
            <Tab label="1. Oferta Académica (Programas)" icon={<SchoolRoundedIcon fontSize="small" />} iconPosition="start" sx={{ fontWeight: 800, textTransform: 'none', py: 1.5 }} />
            <Tab label="2. Información Poblacional Contexto" icon={<GroupsRoundedIcon fontSize="small" />} iconPosition="start" sx={{ fontWeight: 800, textTransform: 'none', py: 1.5 }} />
          </Tabs>
        </Box>
      </Paper>

      {/* ==================== SECCIÓN 1: OFERTA ACADÉMICA ==================== */}
      {mainTab === 0 && (
        <Stack spacing={2.5}>
          {/* Controls & Keyword Filters */}
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #cbd5e1', borderRadius: 3, bgcolor: '#ffffff' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <FilterAltRoundedIcon sx={{ color: '#0284c7' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0f172a' }}>
                Filtros Inteligentes de Programas Académicos Similares
              </Typography>
            </Stack>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Nivel de Formación"
                  value={nivelFormacion}
                  onChange={(e) => setNivelFormacion(e.target.value)}
                >
                  <MenuItem value="TODOS">Todos los niveles</MenuItem>
                  <MenuItem value="PREGRADO">Pregrado (Universitario / Tecnológico)</MenuItem>
                  <MenuItem value="POSGRADO">Posgrado (Todos)</MenuItem>
                  <MenuItem value="ESPECIALIZACION">Especialización</MenuItem>
                  <MenuItem value="MAESTRIA">Maestría</MenuItem>
                  <MenuItem value="DOCTORADO">Doctorado</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Búsqueda por Nombre / Palabras Clave"
                  placeholder="Ej: DERECHO PENAL, ADMINISTRACION..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchRoundedIcon fontSize="small" sx={{ color: '#64748b', mr: 1 }} />
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Departamento"
                  value={selectedDepto}
                  onChange={(e) => {
                    setSelectedDepto(e.target.value);
                    setSelectedMunicipio('TODOS');
                  }}
                >
                  {deptoOptions.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Municipio Oferta"
                  value={selectedMunicipio}
                  onChange={(e) => setSelectedMunicipio(e.target.value)}
                >
                  {municipioOptions.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            {/* Visual Style Selector Toolbar */}
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mt: 2.5, pt: 2, borderTop: '1px dashed #cbd5e1' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StyleRoundedIcon sx={{ color: '#0f766e', fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#334155' }}>
                  Diseño Visual del Tablero:
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={visualStyle === 'mindmap' ? 'contained' : 'outlined'}
                  onClick={() => setVisualStyle('mindmap')}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                >
                  🧠 Estilo 1: Mapa Radial (Mindmap)
                </Button>
                <Button
                  size="small"
                  variant={visualStyle === 'hex' ? 'contained' : 'outlined'}
                  onClick={() => setVisualStyle('hex')}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                >
                  ⬢ Estilo 2: Nodos Hexagonales
                </Button>
                <Button
                  size="small"
                  variant={visualStyle === 'cards' ? 'contained' : 'outlined'}
                  onClick={() => setVisualStyle('cards')}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                >
                  📊 Estilo 3: Tarjetas Módulo
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Keyword Search Summary Chip */}
          <Paper elevation={0} sx={{ p: 1.5, px: 2.5, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#0369a1' }}>
                Programas Académicos Analizados con coincidecia: <strong>"{searchKeyword}"</strong> — Total Encontrados: <strong>{ofertaMetrics.total}</strong>
              </Typography>
              <Chip size="small" label={`${ofertaMetrics.total} Programas Coincidentes`} color="primary" sx={{ fontWeight: 900 }} />
            </Stack>
          </Paper>

          {/* ========================================================================= */}
          {/* VARIANTE 1: RADIAL MAP / MINDMAP DESIGN (Imagen 2 de la solicitud) */}
          {/* ========================================================================= */}
          {visualStyle === 'mindmap' && (
            <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, border: '1px solid #cbd5e1', borderRadius: 4, bgcolor: '#fafafa', position: 'relative' }}>
              <Box sx={{ maxWidth: 900, mx: 'auto', position: 'relative' }}>
                {/* Central Circle Node */}
                <Box
                  sx={{
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                    border: '8px solid #0284c7',
                    boxShadow: '0 10px 30px rgba(2, 132, 199, 0.25)',
                    mx: 'auto',
                    my: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total programas
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: '#0284c7', my: 0.5 }}>
                    {ofertaMetrics.total}
                  </Typography>
                  <Chip size="small" label="Programas Coincidentes" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: 11 }} />
                </Box>

                {/* 5 Surrounding Radial Metric Cards */}
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  {/* Reconocimiento MEN */}
                  <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={0} sx={{ border: '2px solid #1d4ed8', borderRadius: 3, bgcolor: '#fff', p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, pb: 1, borderBottom: '2px solid #1d4ed8' }}>
                        <AccountBalanceRoundedIcon sx={{ color: '#1d4ed8' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1d4ed8' }}>
                          Reconocimiento MEN
                        </Typography>
                      </Stack>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            • Registro calificado
                          </Typography>
                          <Chip size="small" label={ofertaMetrics.registroCalificado} sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            • Acreditación alta calidad
                          </Typography>
                          <Chip size="small" label={ofertaMetrics.acreditacionAltaCalidad} color="primary" sx={{ fontWeight: 900 }} />
                        </Stack>
                      </Stack>
                    </Card>
                  </Grid>

                  {/* Sector */}
                  <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={0} sx={{ border: '2px solid #15803d', borderRadius: 3, bgcolor: '#fff', p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, pb: 1, borderBottom: '2px solid #15803d' }}>
                        <GroupsRoundedIcon sx={{ color: '#15803d' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#15803d' }}>
                          Sector
                        </Typography>
                      </Stack>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            • Público / Oficial
                          </Typography>
                          <Chip size="small" label={ofertaMetrics.publico} color="success" sx={{ fontWeight: 900 }} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            • Privado
                          </Typography>
                          <Chip size="small" label={ofertaMetrics.privado} sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }} />
                        </Stack>
                      </Stack>
                    </Card>
                  </Grid>

                  {/* Rango Créditos Académicos */}
                  <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={0} sx={{ border: '2px solid #c2410c', borderRadius: 3, bgcolor: '#fff', p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, pb: 1, borderBottom: '2px solid #c2410c' }}>
                        <SchoolRoundedIcon sx={{ color: '#c2410c' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#c2410c' }}>
                          Rango Créditos Académicos
                        </Typography>
                      </Stack>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            • N° créditos mínimo
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f172a' }}>
                            {ofertaMetrics.minCreditos}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            • N° créditos máximo
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f172a' }}>
                            {ofertaMetrics.maxCreditos}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                            • Promedio de créditos
                          </Typography>
                          <Chip size="small" label={ofertaMetrics.avgCreditos} color="warning" sx={{ fontWeight: 900 }} />
                        </Stack>
                      </Stack>
                    </Card>
                  </Grid>

                  {/* Modalidades */}
                  <Grid item xs={12} sm={6} md={6}>
                    <Card elevation={0} sx={{ border: '2px solid #7e22ce', borderRadius: 3, bgcolor: '#fff', p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, pb: 1, borderBottom: '2px solid #7e22ce' }}>
                        <DevicesRoundedIcon sx={{ color: '#7e22ce' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#7e22ce' }}>
                          Modalidades
                        </Typography>
                      </Stack>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                              • Presencial
                            </Typography>
                            <Chip size="small" label={ofertaMetrics.presencial} color="secondary" sx={{ fontWeight: 900 }} />
                          </Stack>
                        </Grid>
                        <Grid item xs={6}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                              • Virtual
                            </Typography>
                            <Chip size="small" label={ofertaMetrics.virtual} sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }} />
                          </Stack>
                        </Grid>
                        <Grid item xs={6}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                              • A distancia
                            </Typography>
                            <Chip size="small" label={ofertaMetrics.aDistancia} sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }} />
                          </Stack>
                        </Grid>
                        <Grid item xs={6}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                              • Dual
                            </Typography>
                            <Chip size="small" label={ofertaMetrics.dual} sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }} />
                          </Stack>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>

                  {/* N° Semestres */}
                  <Grid item xs={12} sm={6} md={6}>
                    <Card elevation={0} sx={{ border: '2px solid #0f766e', borderRadius: 3, bgcolor: '#fff', p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, pb: 1, borderBottom: '2px solid #0f766e' }}>
                        <CalendarMonthRoundedIcon sx={{ color: '#0f766e' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f766e' }}>
                          N° Semestres (Duración)
                        </Typography>
                      </Stack>
                      <Grid container spacing={1}>
                        {Object.entries(ofertaMetrics.semestresMap).length === 0 ? (
                          <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', px: 1 }}>
                            No hay información de semestres
                          </Typography>
                        ) : (
                          Object.entries(ofertaMetrics.semestresMap).map(([sem, cnt]) => (
                            <Grid item xs={6} key={sem}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                                  • {sem} semestres
                                </Typography>
                                <Chip size="small" label={cnt} sx={{ fontWeight: 900, bgcolor: '#ccfbf1', color: '#0f766e' }} />
                              </Stack>
                            </Grid>
                          ))
                        )}
                      </Grid>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          )}

          {/* ========================================================================= */}
          {/* VARIANTE 2: LINEAR HEXAGON FLOW DIAGRAM (Imagen 3 de la solicitud) */}
          {/* ========================================================================= */}
          {visualStyle === 'hex' && (
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #cbd5e1', borderRadius: 4, bgcolor: '#ffffff' }}>
              <Box sx={{ overflowX: 'auto', py: 2 }}>
                <Grid container spacing={2} sx={{ minWidth: 850 }}>
                  {/* Reconocimiento MEN */}
                  <Grid item xs={2.4}>
                    <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          mx: 'auto',
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 12px rgba(30,58,138,0.25)',
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                        }}
                      >
                        <AccountBalanceRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #1e3a8a', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1e3a8a', mb: 1 }}>
                        Reconocimiento MEN
                      </Typography>
                      <Stack spacing={1} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Registro calificado
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900 }}>
                            {ofertaMetrics.registroCalificado}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Acreditación alta calidad
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900, color: '#1e3a8a' }}>
                            {ofertaMetrics.acreditacionAltaCalidad}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>

                  {/* Sector */}
                  <Grid item xs={2.4}>
                    <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          mx: 'auto',
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 12px rgba(21,128,61,0.25)',
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                        }}
                      >
                        <GroupsRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #15803d', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#15803d', mb: 1 }}>
                        Sector
                      </Typography>
                      <Stack spacing={1} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Público / Oficial
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900, color: '#15803d' }}>
                            {ofertaMetrics.publico}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Privado
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900 }}>
                            {ofertaMetrics.privado}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>

                  {/* Modalidades */}
                  <Grid item xs={2.4}>
                    <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          mx: 'auto',
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 12px rgba(126,34,206,0.25)',
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                        }}
                      >
                        <DevicesRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #7e22ce', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#7e22ce', mb: 1 }}>
                        Modalidades
                      </Typography>
                      <Stack spacing={0.8} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Presencial
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900 }}>
                            {ofertaMetrics.presencial}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Virtual
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900 }}>
                            {ofertaMetrics.virtual}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            A distancia
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900 }}>
                            {ofertaMetrics.aDistancia}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>

                  {/* N° semestres */}
                  <Grid item xs={2.4}>
                    <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          mx: 'auto',
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 12px rgba(15,118,110,0.25)',
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                        }}
                      >
                        <CalendarMonthRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #0f766e', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f766e', mb: 1 }}>
                        N° semestres
                      </Typography>
                      <Stack spacing={0.8} sx={{ textAlign: 'left' }}>
                        {Object.entries(ofertaMetrics.semestresMap)
                          .slice(0, 3)
                          .map(([sem, cnt]) => (
                            <Stack direction="row" justifyContent="space-between" key={sem}>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                {sem} semestres
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                                {cnt}
                              </Typography>
                            </Stack>
                          ))}
                      </Stack>
                    </Paper>
                  </Grid>

                  {/* Rango Créditos */}
                  <Grid item xs={2.4}>
                    <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          mx: 'auto',
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 12px rgba(194,65,12,0.25)',
                          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                        }}
                      >
                        <SchoolRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #c2410c', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#c2410c', mb: 1 }}>
                        Rango Créditos
                      </Typography>
                      <Stack spacing={0.8} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Mínimo
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900 }}>
                            {ofertaMetrics.minCreditos}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Máximo
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900 }}>
                            {ofertaMetrics.maxCreditos}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Promedio
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900, color: '#c2410c' }}>
                            {ofertaMetrics.avgCreditos}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          )}

          {/* ========================================================================= */}
          {/* VARIANTE 3: STRUCTURED CARDS DESIGN (Imagen 4 de la solicitud) */}
          {/* ========================================================================= */}
          {visualStyle === 'cards' && (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #cbd5e1', borderRadius: 4, bgcolor: '#f8fafc' }}>
              <Box sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', p: 2, px: 3, borderRadius: 3, mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    TOTAL PROGRAMAS ANALIZADOS
                  </Typography>
                  <Chip size="medium" label={ofertaMetrics.total} color="primary" sx={{ fontWeight: 900, fontSize: 16, height: 32 }} />
                </Stack>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid #cbd5e1', borderRadius: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1e3a8a', mb: 1 }}>
                      🏛️ Reconocimiento MEN
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Registro calificado</Typography>
                        <Chip size="small" label={ofertaMetrics.registroCalificado} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Acreditación de alta calidad</Typography>
                        <Chip size="small" label={ofertaMetrics.acreditacionAltaCalidad} color="primary" />
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid #cbd5e1', borderRadius: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#15803d', mb: 1 }}>
                      👥 Sector IES
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Público / Oficial</Typography>
                        <Chip size="small" label={ofertaMetrics.publico} color="success" />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Privado</Typography>
                        <Chip size="small" label={ofertaMetrics.privado} />
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Municipality Summary & Detailed Table */}
          <Grid container spacing={2.5}>
            {/* Municipality breakdown table */}
            <Grid item xs={12} md={4}>
              <Paper elevation={0} sx={{ p: 2, border: '1px solid #cbd5e1', borderRadius: 3, height: '100%' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <LocationOnRoundedIcon sx={{ color: '#0369a1' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f172a' }}>
                    MUNICIPIO OFERTA PROGRAMA
                  </Typography>
                </Stack>

                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        <TableCell sx={{ fontWeight: 800 }}>Municipio</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          Total Programas
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {municipioSummary.map((m) => (
                        <TableRow key={m.municipio} hover>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12.5 }}>{m.municipio}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 900, color: '#0369a1' }}>
                            {m.total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {/* Program details table */}
            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{ p: 2, border: '1px solid #cbd5e1', borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f172a' }}>
                    Listado Detallado de Programas Coincidentes ({filteredOferta.length})
                  </Typography>
                  <Button size="small" startIcon={<DownloadRoundedIcon />} variant="outlined" sx={{ textTransform: 'none', fontWeight: 800 }}>
                    Exportar Lista
                  </Button>
                </Stack>

                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        <TableCell sx={{ fontWeight: 800 }}>Institución (IES)</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Programa Académico</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Municipio</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Modalidad</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                          Créditos
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredOferta.slice(0, 50).map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.ies}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: 12, color: '#0369a1' }}>{r.programa}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{r.municipio}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>
                            <Chip size="small" label={r.modalidad} sx={{ fontSize: 10, height: 20 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12 }}>
                            {r.creditos || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      )}

      {/* ==================== SECCIÓN 2: INFORMACIÓN POBLACIONAL CONTEXTO ==================== */}
      {mainTab === 1 && (
        <Stack spacing={2.5}>
          {/* Sub-segment Tabs */}
          <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 3, p: 1, bgcolor: '#f8fafc' }}>
            <Tabs value={poblacionalSubTab} onChange={(_, val) => setPoblacionalSubTab(val)} indicatorColor="secondary" textColor="secondary">
              <Tab label="🔹 Sub-segmento A: Ingreso y Absorción (Inscritos, Admitidos, Primer Curso)" sx={{ fontWeight: 800, textTransform: 'none' }} />
              <Tab label="🔹 Sub-segmento B: Cobertura y Permanencia (Matriculados)" sx={{ fontWeight: 800, textTransform: 'none' }} />
              <Tab label="🔹 Sub-segmento C: Salida y Graduación (Graduados)" sx={{ fontWeight: 800, textTransform: 'none' }} />
            </Tabs>
          </Paper>

          {/* Table of Poblacional Series */}
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #cbd5e1', borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', mb: 2 }}>
              Series Históricas del Contexto Externo — {activePoblacionalBase.join(', ')}
            </Typography>

            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                    <TableCell sx={{ fontWeight: 800 }}>Subbase / Indicador</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Periodo / Año</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Institución (IES)</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Programa</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      Valor / Conteo
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPoblacional.slice(0, 100).map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Chip size="small" color="primary" label={r.base} sx={{ fontWeight: 800 }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>{r.periodo}</TableCell>
                      <TableCell sx={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.ies}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#0284c7', fontWeight: 700 }}>{r.programa}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, fontSize: 13, color: '#0f766e' }}>
                        {r.valorNum.toLocaleString('es-CO')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
