import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, Stack, Grid, TextField, MenuItem, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Tabs, Tab
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import gestionInformacionService from '../../services/gestionInformacionService';
import encabezadoCorreosImg from '../../assets/Encabezado_correos.png';

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
  const [visualStyle, setVisualStyle] = useState('mindmap'); // 'mindmap', 'hex', 'cards'

  // Filters for Oferta Académica
  const [nivelFormacion, setNivelFormacion] = useState('TODOS');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedDepto, setSelectedDepto] = useState('TODOS');
  const [selectedMunicipio, setSelectedMunicipio] = useState('TODOS');

  // Filters for Poblacional
  const [pobPeriodo, setPobPeriodo] = useState('TODOS');
  const [pobDepto, setPobDepto] = useState('TODOS');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
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
      .replace(/[,;]/g, ' ')
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

  // Helper box for metric value input display matching the reference images
  const ValueBox = ({ value, color = '#1e293b' }) => (
    <Box
      sx={{
        minWidth: 54,
        height: 26,
        border: '1.5px solid #94a3b8',
        borderRadius: 1,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 900,
        fontSize: 13,
        color: color,
        bgcolor: '#ffffff',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)'
      }}
    >
      {value}
    </Box>
  );

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
          boxShadow: '0 4px 16px rgba(0, 51, 153, 0.12)'
        }}
      >
        {/* Official UNICESMAG Header Image Banner */}
        <Box
          sx={{
            width: '100%',
            bgcolor: '#0a192f',
            borderBottom: '3px solid #fbbf24',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            maxHeight: 110
          }}
        >
          <img
            src={encabezadoCorreosImg}
            alt="Encabezado Institucional UNICESMAG"
            style={{
              width: '100%',
              maxHeight: 110,
              objectFit: 'cover',
              objectPosition: 'center'
            }}
          />
        </Box>

        {/* Title & Navigation Bar in UNICESMAG Deep Blue */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #002244 0%, #003399 60%, #1e40af 100%)',
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
              <IconButton onClick={onBack} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}>
                <ArrowBackRoundedIcon />
              </IconButton>
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.1, fontSize: { xs: 15, md: 19 }, color: '#ffffff' }}>
                OFERTA REGIONAL DE PROGRAMAS ACADÉMICOS SIMILARES
              </Typography>
              <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 800, fontSize: 12 }}>
                Sistema de Gestión e Inteligencia de Información — UNICESMAG
              </Typography>
            </Box>
          </Stack>
          <Chip
            label="Contexto Externo"
            sx={{
              bgcolor: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              fontWeight: 900,
              px: 1.5,
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          />
        </Box>

        {/* Main Tabs Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#ffffff', px: 2 }}>
          <Tabs value={mainTab} onChange={(_, val) => setMainTab(val)} textColor="primary" indicatorColor="primary">
            <Tab label="1. Oferta Académica" icon={<SchoolRoundedIcon fontSize="small" />} iconPosition="start" sx={{ fontWeight: 800, textTransform: 'none', py: 1.5, fontSize: 14 }} />
            <Tab label="2. Información Poblacional" icon={<GroupsRoundedIcon fontSize="small" />} iconPosition="start" sx={{ fontWeight: 800, textTransform: 'none', py: 1.5, fontSize: 14 }} />
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
                Filtros de Búsqueda de Oferta Académica
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
                  placeholder="Ej: DERECHO, PENAL, ADMINISTRACION..."
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
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#334155' }}>
                Estilo de Visualización del Esquema:
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={visualStyle === 'mindmap' ? 'contained' : 'outlined'}
                  onClick={() => setVisualStyle('mindmap')}
                  startIcon={<HubRoundedIcon />}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                >
                  Mapa Radial (Fiel a tu Imagen Referencia)
                </Button>
                <Button
                  size="small"
                  variant={visualStyle === 'hex' ? 'contained' : 'outlined'}
                  onClick={() => setVisualStyle('hex')}
                  startIcon={<HexagonRoundedIcon />}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                >
                  Diagrama Nodos Hexagonales
                </Button>
                <Button
                  size="small"
                  variant={visualStyle === 'cards' ? 'contained' : 'outlined'}
                  onClick={() => setVisualStyle('cards')}
                  startIcon={<ViewModuleRoundedIcon />}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                >
                  Módulos de Tarjetas
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Search Result Summary Chip */}
          <Paper elevation={0} sx={{ p: 1.5, px: 2.5, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#0369a1' }}>
                Filtro de Programas Activo: {searchKeyword ? `"${searchKeyword}"` : 'Todos los programas'} — Total Coincidentes: <strong>{ofertaMetrics.total}</strong>
              </Typography>
              <Chip size="small" label={`${ofertaMetrics.total} Programas Analizados`} color="primary" sx={{ fontWeight: 900 }} />
            </Stack>
          </Paper>

          {/* ========================================================================= */}
          {/* VARIANTE 1: RADIAL MAP / MINDMAP (RÉPLICA FIEL 1:1 DE TU IMAGEN REFERENCIA) */}
          {/* ========================================================================= */}
          {visualStyle === 'mindmap' && (
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #cbd5e1', borderRadius: 4, bgcolor: '#ffffff', overflow: 'hidden' }}>
              <Box sx={{ width: '100%', minHeight: 640, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                
                {/* SVG Connecting Lines Layer */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                  {/* Top-Left: Reconocimiento MEN (Blue #003399) */}
                  <path d="M 470 320 Q 370 140 280 140" stroke="#003399" strokeWidth="3.5" fill="none" />
                  <circle cx="390" cy="230" r="5" fill="#003399" />
                  <circle cx="280" cy="140" r="5" fill="#003399" />

                  {/* Top-Right: Sector (Green #2e7d32) */}
                  <path d="M 470 320 Q 570 140 660 140" stroke="#2e7d32" strokeWidth="3.5" fill="none" />
                  <circle cx="550" cy="230" r="5" fill="#2e7d32" />
                  <circle cx="660" cy="140" r="5" fill="#2e7d32" />

                  {/* Middle-Left: Modalidades (Purple #6a1b9a) */}
                  <path d="M 470 320 Q 350 320 280 340" stroke="#6a1b9a" strokeWidth="3.5" fill="none" />
                  <circle cx="365" cy="320" r="5" fill="#6a1b9a" />
                  <circle cx="280" cy="340" r="5" fill="#6a1b9a" />

                  {/* Middle-Right: Rango Créditos (Orange #e65100) */}
                  <path d="M 470 320 Q 590 320 660 340" stroke="#e65100" strokeWidth="3.5" fill="none" />
                  <circle cx="575" cy="320" r="5" fill="#e65100" />
                  <circle cx="660" cy="340" r="5" fill="#e65100" />

                  {/* Bottom-Center: N° Semestres (Teal #00838f) */}
                  <path d="M 470 320 L 470 470" stroke="#00838f" strokeWidth="3.5" fill="none" />
                  <circle cx="470" cy="395" r="5" fill="#00838f" />
                  <circle cx="470" cy="470" r="5" fill="#00838f" />
                </svg>

                <Box sx={{ width: 940, height: 620, position: 'relative', zIndex: 2 }}>
                  
                  {/* CENTER NODE: Total programas */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 175,
                      height: 175,
                      borderRadius: '50%',
                      background: '#ffffff',
                      boxShadow: '0 10px 30px rgba(0, 51, 153, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                  >
                    {/* Multi-color arc ring SVG overlay */}
                    <svg style={{ position: 'absolute', top: -8, left: -8, width: 191, height: 191, pointerEvents: 'none' }}>
                      <circle cx="95.5" cy="95.5" r="88" stroke="#003399" strokeWidth="6" fill="none" strokeDasharray="110 440" strokeDashoffset="0" />
                      <circle cx="95.5" cy="95.5" r="88" stroke="#2e7d32" strokeWidth="6" fill="none" strokeDasharray="110 440" strokeDashoffset="-110" />
                      <circle cx="95.5" cy="95.5" r="88" stroke="#e65100" strokeWidth="6" fill="none" strokeDasharray="110 440" strokeDashoffset="-220" />
                      <circle cx="95.5" cy="95.5" r="88" stroke="#00838f" strokeWidth="6" fill="none" strokeDasharray="110 440" strokeDashoffset="-330" />
                      <circle cx="95.5" cy="95.5" r="88" stroke="#6a1b9a" strokeWidth="6" fill="none" strokeDasharray="110 440" strokeDashoffset="-440" />
                    </svg>

                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#002244', textTransform: 'none', lineHeight: 1.1, textAlign: 'center', mb: 1 }}>
                      Total<br />programas
                    </Typography>
                    
                    <ValueBox value={ofertaMetrics.total} color="#003399" />
                  </Box>

                  {/* 1. TOP-LEFT: Reconocimiento MEN (Blue #003399) */}
                  <Box sx={{ position: 'absolute', top: 20, left: 10, width: 270 }}>
                    <Box sx={{ position: 'relative', pt: 2.5 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: '#ffffff',
                          border: '2.5px solid #003399',
                          color: '#003399',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 10px rgba(0, 51, 153, 0.2)',
                          zIndex: 3
                        }}
                      >
                        <AccountBalanceRoundedIcon fontSize="small" />
                      </Box>

                      <Paper elevation={0} sx={{ border: '2px solid #003399', borderRadius: 3, bgcolor: '#ffffff', p: 1.8, pt: 3.2 }}>
                        <Box sx={{ bgcolor: '#003399', color: '#fff', borderRadius: 2, textAlign: 'center', py: 0.6, mb: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: 13 }}>
                            Reconocimiento MEN
                          </Typography>
                        </Box>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Registro calificado
                            </Typography>
                            <ValueBox value={ofertaMetrics.registroCalificado} />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Acreditación de alta calidad
                            </Typography>
                            <ValueBox value={ofertaMetrics.acreditacionAltaCalidad} color="#003399" />
                          </Stack>
                        </Stack>
                      </Paper>
                    </Box>
                  </Box>

                  {/* 2. TOP-RIGHT: Sector (Green #2e7d32) */}
                  <Box sx={{ position: 'absolute', top: 20, right: 10, width: 270 }}>
                    <Box sx={{ position: 'relative', pt: 2.5 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: '#ffffff',
                          border: '2.5px solid #2e7d32',
                          color: '#2e7d32',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 10px rgba(46, 125, 50, 0.2)',
                          zIndex: 3
                        }}
                      >
                        <GroupsRoundedIcon fontSize="small" />
                      </Box>

                      <Paper elevation={0} sx={{ border: '2px solid #2e7d32', borderRadius: 3, bgcolor: '#ffffff', p: 1.8, pt: 3.2 }}>
                        <Box sx={{ bgcolor: '#2e7d32', color: '#fff', borderRadius: 2, textAlign: 'center', py: 0.6, mb: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: 13 }}>
                            Sector
                          </Typography>
                        </Box>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Público
                            </Typography>
                            <ValueBox value={ofertaMetrics.publico} color="#2e7d32" />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Privado
                            </Typography>
                            <ValueBox value={ofertaMetrics.privado} />
                          </Stack>
                        </Stack>
                      </Paper>
                    </Box>
                  </Box>

                  {/* 3. MIDDLE-LEFT: Modalidades (Purple #6a1b9a) */}
                  <Box sx={{ position: 'absolute', top: 230, left: 10, width: 270 }}>
                    <Box sx={{ position: 'relative', pt: 2.5 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: '#ffffff',
                          border: '2.5px solid #6a1b9a',
                          color: '#6a1b9a',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 10px rgba(106, 27, 154, 0.2)',
                          zIndex: 3
                        }}
                      >
                        <DevicesRoundedIcon fontSize="small" />
                      </Box>

                      <Paper elevation={0} sx={{ border: '2px solid #6a1b9a', borderRadius: 3, bgcolor: '#ffffff', p: 1.8, pt: 3.2 }}>
                        <Box sx={{ bgcolor: '#6a1b9a', color: '#fff', borderRadius: 2, textAlign: 'center', py: 0.6, mb: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: 13 }}>
                            Modalidades
                          </Typography>
                        </Box>
                        <Stack spacing={0.8}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Presencial
                            </Typography>
                            <ValueBox value={ofertaMetrics.presencial} color="#6a1b9a" />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Virtual
                            </Typography>
                            <ValueBox value={ofertaMetrics.virtual} />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • A distancia
                            </Typography>
                            <ValueBox value={ofertaMetrics.aDistancia} />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Dual
                            </Typography>
                            <ValueBox value={ofertaMetrics.dual} />
                          </Stack>
                        </Stack>
                      </Paper>
                    </Box>
                  </Box>

                  {/* 4. MIDDLE-RIGHT: Rango Créditos Académicos (Orange #e65100) */}
                  <Box sx={{ position: 'absolute', top: 230, right: 10, width: 270 }}>
                    <Box sx={{ position: 'relative', pt: 2.5 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: '#ffffff',
                          border: '2.5px solid #e65100',
                          color: '#e65100',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 10px rgba(230, 81, 0, 0.2)',
                          zIndex: 3
                        }}
                      >
                        <SchoolRoundedIcon fontSize="small" />
                      </Box>

                      <Paper elevation={0} sx={{ border: '2px solid #e65100', borderRadius: 3, bgcolor: '#ffffff', p: 1.8, pt: 3.2 }}>
                        <Box sx={{ bgcolor: '#e65100', color: '#fff', borderRadius: 2, textAlign: 'center', py: 0.6, mb: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: 13 }}>
                            Rango Créditos Académicos
                          </Typography>
                        </Box>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Nº de créditos mínimo
                            </Typography>
                            <ValueBox value={ofertaMetrics.minCreditos} />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Nº de créditos máximo
                            </Typography>
                            <ValueBox value={ofertaMetrics.maxCreditos} />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                              • Promedio de créditos
                            </Typography>
                            <ValueBox value={ofertaMetrics.avgCreditos} color="#e65100" />
                          </Stack>
                        </Stack>
                      </Paper>
                    </Box>
                  </Box>

                  {/* 5. BOTTOM-CENTER: Nº semestres (Teal #00838f) */}
                  <Box sx={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', width: 290 }}>
                    <Box sx={{ position: 'relative', pt: 2.5 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: '#ffffff',
                          border: '2.5px solid #00838f',
                          color: '#00838f',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 4px 10px rgba(0, 131, 143, 0.2)',
                          zIndex: 3
                        }}
                      >
                        <CalendarMonthRoundedIcon fontSize="small" />
                      </Box>

                      <Paper elevation={0} sx={{ border: '2px solid #00838f', borderRadius: 3, bgcolor: '#ffffff', p: 1.8, pt: 3.2 }}>
                        <Box sx={{ bgcolor: '#00838f', color: '#fff', borderRadius: 2, textAlign: 'center', py: 0.6, mb: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: 13 }}>
                            Nº semestres
                          </Typography>
                        </Box>
                        <Stack spacing={0.8}>
                          {Object.entries(ofertaMetrics.semestresMap).length === 0 ? (
                            <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center' }}>
                              No hay información de semestres
                            </Typography>
                          ) : (
                            Object.entries(ofertaMetrics.semestresMap).slice(0, 4).map(([sem, cnt]) => (
                              <Stack direction="row" justifyContent="space-between" alignItems="center" key={sem}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                                  • {sem}
                                </Typography>
                                <ValueBox value={cnt} color="#00838f" />
                              </Stack>
                            ))
                          )}
                        </Stack>
                      </Paper>
                    </Box>
                  </Box>

                </Box>
              </Box>
            </Paper>
          )}

          {/* ========================================================================= */}
          {/* VARIANTE 2: LINEAR HEXAGON FLOW DIAGRAM CON LÍNEAS DE ENLACE (Imagen 3) */}
          {/* ========================================================================= */}
          {visualStyle === 'hex' && (
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #cbd5e1', borderRadius: 4, bgcolor: '#ffffff', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ overflowX: 'auto', py: 2, position: 'relative' }}>
                {/* Horizontal connecting SVG line */}
                <svg style={{ position: 'absolute', top: 40, left: 0, width: '100%', height: 60, pointerEvents: 'none', zIndex: 1 }}>
                  <line x1="50" y1="28" x2="850" y2="28" stroke="#cbd5e1" strokeWidth="4" />
                </svg>

                <Grid container spacing={2} sx={{ minWidth: 850, position: 'relative', zIndex: 2 }}>
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
                          boxShadow: '0 4px 12px rgba(30,58,138,0.25)'
                        }}
                      >
                        <AccountBalanceRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #1e3a8a', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1e3a8a', mb: 1.5 }}>
                        Reconocimiento MEN
                      </Typography>
                      <Stack spacing={1} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Registro calificado
                          </Typography>
                          <ValueBox value={ofertaMetrics.registroCalificado} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Acreditación alta calidad
                          </Typography>
                          <ValueBox value={ofertaMetrics.acreditacionAltaCalidad} color="#1e3a8a" />
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
                          boxShadow: '0 4px 12px rgba(21,128,61,0.25)'
                        }}
                      >
                        <GroupsRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #15803d', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#15803d', mb: 1.5 }}>
                        Sector
                      </Typography>
                      <Stack spacing={1} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Público / Oficial
                          </Typography>
                          <ValueBox value={ofertaMetrics.publico} color="#15803d" />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Privado
                          </Typography>
                          <ValueBox value={ofertaMetrics.privado} />
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
                          boxShadow: '0 4px 12px rgba(126,34,206,0.25)'
                        }}
                      >
                        <DevicesRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #7e22ce', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#7e22ce', mb: 1.5 }}>
                        Modalidades
                      </Typography>
                      <Stack spacing={0.8} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Presencial
                          </Typography>
                          <ValueBox value={ofertaMetrics.presencial} color="#7e22ce" />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Virtual
                          </Typography>
                          <ValueBox value={ofertaMetrics.virtual} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            A distancia
                          </Typography>
                          <ValueBox value={ofertaMetrics.aDistancia} />
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
                          boxShadow: '0 4px 12px rgba(15,118,110,0.25)'
                        }}
                      >
                        <CalendarMonthRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #0f766e', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f766e', mb: 1.5 }}>
                        N° semestres
                      </Typography>
                      <Stack spacing={0.8} sx={{ textAlign: 'left' }}>
                        {Object.entries(ofertaMetrics.semestresMap)
                          .slice(0, 3)
                          .map(([sem, cnt]) => (
                            <Stack direction="row" justifyContent="space-between" alignItems="center" key={sem}>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                {sem} semestres
                              </Typography>
                              <ValueBox value={cnt} color="#0f766e" />
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
                          boxShadow: '0 4px 12px rgba(194,65,12,0.25)'
                        }}
                      >
                        <SchoolRoundedIcon fontSize="small" />
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ p: 2, border: '2px solid #c2410c', borderRadius: 3, textAlign: 'center', bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#c2410c', mb: 1.5 }}>
                        Rango Créditos
                      </Typography>
                      <Stack spacing={0.8} sx={{ textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Mínimo
                          </Typography>
                          <ValueBox value={ofertaMetrics.minCreditos} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Máximo
                          </Typography>
                          <ValueBox value={ofertaMetrics.maxCreditos} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Promedio
                          </Typography>
                          <ValueBox value={ofertaMetrics.avgCreditos} color="#c2410c" />
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          )}

          {/* ========================================================================= */}
          {/* VARIANTE 3: STRUCTURED EXECUTIVE CARDS (Imagen 4) */}
          {/* ========================================================================= */}
          {visualStyle === 'cards' && (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #cbd5e1', borderRadius: 4, bgcolor: '#f8fafc' }}>
              <Box sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', p: 2, px: 3, borderRadius: 3, mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    TOTAL PROGRAMAS ANALIZADOS
                  </Typography>
                  <ValueBox value={ofertaMetrics.total} color="#0284c7" />
                </Stack>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid #cbd5e1', borderRadius: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#1e3a8a', mb: 1 }}>
                      Reconocimiento MEN
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">Registro calificado</Typography>
                        <ValueBox value={ofertaMetrics.registroCalificado} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">Acreditación de alta calidad</Typography>
                        <ValueBox value={ofertaMetrics.acreditacionAltaCalidad} color="#1d4ed8" />
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid #cbd5e1', borderRadius: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#15803d', mb: 1 }}>
                      Sector IES
                    </Typography>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">Público / Oficial</Typography>
                        <ValueBox value={ofertaMetrics.publico} color="#15803d" />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">Privado</Typography>
                        <ValueBox value={ofertaMetrics.privado} />
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
              <Tab label="Ingreso y Absorción" sx={{ fontWeight: 800, textTransform: 'none' }} />
              <Tab label="Cobertura y Permanencia" sx={{ fontWeight: 800, textTransform: 'none' }} />
              <Tab label="Salida y Graduación" sx={{ fontWeight: 800, textTransform: 'none' }} />
            </Tabs>
          </Paper>

          {/* Table of Poblacional Series */}
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #cbd5e1', borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', mb: 2 }}>
              Series Históricas — {activePoblacionalBase.join(', ')}
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
