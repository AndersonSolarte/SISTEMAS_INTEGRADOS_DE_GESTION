import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Chip,
  CircularProgress, Alert, FormControl, InputLabel, Select,
  MenuItem, IconButton, Tooltip, Fade, Divider, Grid
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshIcon        from '@mui/icons-material/Refresh';
import FilterAltOffIcon   from '@mui/icons-material/FilterAltOff';
import PublicIcon         from '@mui/icons-material/Public';
import FlightTakeoffIcon  from '@mui/icons-material/FlightTakeoff';
import FlightLandIcon     from '@mui/icons-material/FlightLand';
import AutoGraphIcon      from '@mui/icons-material/AutoGraph';
import * as CountryFlags  from 'country-flag-icons/react/3x2';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RT, PieChart, Pie, Cell, LabelList, AreaChart, Area
} from 'recharts';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';
import InternacionalizacionNavSegment from './InternacionalizacionNavSegment';

/* ── paleta ────────────────────────────────────────────────────────────── */
const C = {
  blue:'#1d4ed8', indigo:'#4f46e5', violet:'#7c3aed',
  cyan:'#0891b2', emerald:'#059669', amber:'#d97706',
  rose:'#e11d48', teal:'#0d9488', orange:'#ea580c'
};
const PAL = [C.blue,C.violet,C.cyan,C.emerald,C.amber,C.rose,C.indigo,C.teal,C.orange,'#c026d3'];

/* ── ISO ───────────────────────────────────────────────────────────────── */
const ISO_MAP = {
  COLOMBIA:'CO',BRASIL:'BR',BRAZIL:'BR',ARGENTINA:'AR',CHILE:'CL',
  MEXICO:'MX','MÉXICO':'MX',PERU:'PE','PERÚ':'PE','PERÙ':'PE',ECUADOR:'EC',
  BOLIVIA:'BO',VENEZUELA:'VE',PARAGUAY:'PY',URUGUAY:'UY',
  'ESTADOS UNIDOS':'US',USA:'US',CANADA:'CA','CANADÁ':'CA',
  'ESPAÑA':'ES',ESPANA:'ES',SPAIN:'ES',FRANCIA:'FR',FRANCE:'FR',
  ALEMANIA:'DE',GERMANY:'DE',ITALIA:'IT',ITALY:'IT',
  'REINO UNIDO':'GB',UK:'GB',PORTUGAL:'PT',CHINA:'CN',
  JAPON:'JP','JAPÓN':'JP',JAPAN:'JP','COREA DEL SUR':'KR',
  INDIA:'IN',AUSTRALIA:'AU','NUEVA ZELANDA':'NZ',CUBA:'CU',
  'COSTA RICA':'CR',PANAMA:'PA','PANAMÁ':'PA',NICARAGUA:'NI',
  HONDURAS:'HN',GUATEMALA:'GT','EL SALVADOR':'SV',
  'REPUBLICA DOMINICANA':'DO','PUERTO RICO':'PR',TAIWAN:'TW',
  ISRAEL:'IL',TURQUIA:'TR','TURQUÍA':'TR',RUSIA:'RU',RUSSIA:'RU',
  SUECIA:'SE',NORUEGA:'NO',FINLANDIA:'FI',DINAMARCA:'DK',
  BELGICA:'BE','BÉLGICA':'BE',SUIZA:'CH',AUSTRIA:'AT',
  'PAISES BAJOS':'NL','PAÍSES BAJOS':'NL',HOLANDA:'NL',
  HUNGRIA:'HU',POLONIA:'PL','REPUBLICA CHECA':'CZ',RUMANIA:'RO',
  GRECIA:'GR',SUDAFRICA:'ZA',NIGERIA:'NG',EGIPTO:'EG',
  MARRUECOS:'MA',SENEGAL:'SN',SINGAPUR:'SG',MALASIA:'MY',
  TAILANDIA:'TH',VIETNAM:'VN',INDONESIA:'ID',FILIPINAS:'PH',
  GHANA:'GH',KENYA:'KE',IRLANDA:'IE',LUXEMBURGO:'LU',
  CROACIA:'HR',BULGARIA:'BG',LITUANIA:'LT',LETONIA:'LV',
  ESTONIA:'EE',ESLOVAQUIA:'SK',ALBANIA:'AL',SERBIA:'RS',
  'ARABIA SAUDITA':'SA','EMIRATOS ARABES':'AE',QATAR:'QA',
  KUWAIT:'KW',IRAN:'IR',IRAK:'IQ',PAKISTAN:'PK',
  BANGLADESH:'BD','SRI LANKA':'LK',NEPAL:'NP',
  MYANMAR:'MM',CAMBOYA:'KH',MONGOLIA:'MN',KAZAJSTAN:'KZ'
};
const getISO = (n = '') => {
  const k = n.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9 ]/g,'').trim();
  return ISO_MAP[k] || ISO_MAP[n.toUpperCase()] || null;
};
const isCountry = (n = '') => {
  const t = n.trim();
  if (!t || /^\d+$/.test(t)) return false;
  return !['N/A','NA','SIN DATO','REGIONAL','OTRO','OTROS','NO APLICA'].includes(t.toUpperCase());
};
const sortPer = (arr) =>
  [...arr].sort((a,b) => String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true}));

/* ── Flag ───────────────────────────────────────────────────────────────── */
function FlagSVG({ name, size = 20 }) {
  const iso  = getISO(name);
  const Flag = iso ? CountryFlags[iso] : null;
  if (Flag) return (
    <Box sx={{ width:size*1.5, height:size, borderRadius:'3px', overflow:'hidden',
               flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,.2)' }}>
      <Flag style={{ width:'100%', height:'100%', display:'block' }} />
    </Box>
  );
  return (
    <Box sx={{ width:size*1.5, height:size, borderRadius:'3px', bgcolor:'#e2e8f0',
               display:'grid', placeItems:'center', flexShrink:0 }}>
      <PublicIcon sx={{ fontSize:size*.7, color:'#94a3b8' }} />
    </Box>
  );
}

/* ── Counter ────────────────────────────────────────────────────────────── */
function useCounter(target, active) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!active || !target) return;
    const t0 = performance.now(), dur = 1300;
    const run = (now) => {
      const p = Math.min((now-t0)/dur, 1);
      setVal(Math.round(target*(1-Math.pow(1-p,3))));
      if (p < 1) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [target, active]);
  return val;
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
function KPI({ icon:Icon, label, value, sub, bg, sh, delay, active }) {
  const n = useCounter(typeof value==='number'?value:0, active);
  return (
    <Fade in={active} timeout={500+delay}>
      <Paper elevation={0} sx={{
        p:{xs:2,md:2.4}, borderRadius:3, background:bg,
        boxShadow:`0 10px 26px ${sh}`, position:'relative', overflow:'hidden',
        '&::before':{ content:'""', position:'absolute', top:-22, right:-22,
          width:90, height:90, borderRadius:'50%', bgcolor:'rgba(255,255,255,.1)' }
      }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb:.9 }}>
          <Box sx={{ width:34, height:34, borderRadius:1.5, bgcolor:'rgba(255,255,255,.22)',
                     display:'grid', placeItems:'center' }}>
            <Icon sx={{ color:'#fff', fontSize:18 }} />
          </Box>
          <Typography sx={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.82)', lineHeight:1.2 }}>
            {label}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize:{xs:28,md:36}, fontWeight:900, color:'#fff',
                          lineHeight:1, letterSpacing:'-0.04em' }}>
          {(typeof value==='number'?n:value).toLocaleString('es-CO')}
        </Typography>
        {sub && <Typography sx={{ fontSize:10, color:'rgba(255,255,255,.6)', mt:.3 }}>{sub}</Typography>}
      </Paper>
    </Fade>
  );
}

/* ── Tooltip ────────────────────────────────────────────────────────────── */
const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <Paper elevation={6} sx={{ p:1.6, borderRadius:2.5, border:'1px solid #e2e8f0', minWidth:130 }}>
      <Typography sx={{ fontSize:10.5, fontWeight:700, color:'#64748b', mb:.7,
                        textTransform:'uppercase', letterSpacing:.4 }}>
        {String(label||'').slice(0,28)}
      </Typography>
      {payload.map((p,i)=>(
        <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={.8}>
            <Box sx={{ width:7, height:7, borderRadius:'50%', bgcolor:p.color||p.fill||C.blue }} />
            <Typography sx={{ fontSize:10.5, color:'#64748b' }}>{p.name||'Total'}</Typography>
          </Stack>
          <Typography sx={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>
            {Number(p.value||0).toLocaleString('es-CO')}
          </Typography>
        </Stack>
      ))}
    </Paper>
  );
};

/* ── Título sección ─────────────────────────────────────────────────────── */
const ST = ({ t, s, color=C.blue }) => (
  <Box sx={{ mb:2 }}>
    <Stack direction="row" alignItems="center" spacing={1.2}>
      <Box sx={{ width:4, height:20, borderRadius:2, bgcolor:color, flexShrink:0 }} />
      <Typography sx={{ fontWeight:800, fontSize:14.5, color:'#0f172a', letterSpacing:'-0.01em' }}>{t}</Typography>
    </Stack>
    {s && <Typography sx={{ fontSize:11, color:'#94a3b8', mt:.3, pl:1.4 }}>{s}</Typography>}
  </Box>
);

/* ── Pie label ──────────────────────────────────────────────────────────── */
const PR = Math.PI/180;
const PL = ({ cx, cy, midAngle, outerRadius, percent }) => {
  if (!percent || percent <= 0) return null;
  const edgeR = outerRadius + 4;
  const labelR = outerRadius + 24;
  const sx = cx + edgeR * Math.cos(-midAngle * PR);
  const sy = cy + edgeR * Math.sin(-midAngle * PR);
  const x = cx + labelR * Math.cos(-midAngle * PR);
  const y = cy + labelR * Math.sin(-midAngle * PR);
  const anchor = x > cx ? 'start' : 'end';
  return (
    <g>
      <line x1={sx} y1={sy} x2={x} y2={y} stroke="#94a3b8" strokeWidth={1} />
      <text
        x={x + (anchor === 'start' ? 4 : -4)}
        y={y}
        fill="#0f172a"
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={900}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
};

/* ── País row ───────────────────────────────────────────────────────────── */
function PaisRow({ name, value, max, color, rank, total }) {
  const pct   = max>0?(value/max)*100:0;
  const share = total>0?((value/total)*100).toFixed(1):'0.0';
  return (
    <Stack direction="row" alignItems="center" spacing={1.4} sx={{ py:.7 }}>
      <Typography sx={{ fontSize:11, color:'#cbd5e1', fontWeight:700, width:20, textAlign:'right', flexShrink:0 }}>{rank}</Typography>
      <FlagSVG name={name} size={18} />
      <Typography sx={{ fontSize:12.5, color:'#1e293b', fontWeight:600, flex:1, minWidth:0 }} noWrap>{name}</Typography>
      <Box sx={{ width:90, height:6, borderRadius:2, bgcolor:'#f1f5f9', flexShrink:0, overflow:'hidden' }}>
        <Box sx={{ width:`${pct}%`, height:'100%', borderRadius:2, bgcolor:color, transition:'width 1.1s ease' }} />
      </Box>
      <Typography sx={{ fontSize:10.5, color:'#94a3b8', width:34, textAlign:'right', flexShrink:0 }}>{share}%</Typography>
      <Typography sx={{ fontSize:12.5, fontWeight:800, color:'#0f172a', width:50, textAlign:'right', flexShrink:0 }}>
        {value.toLocaleString('es-CO')}
      </Typography>
    </Stack>
  );
}

/* ── ProgBar ────────────────────────────────────────────────────────────── */
function ProgBar({ name, value, total, max, color }) {
  const pct   = Math.max(1,(value/(max||1))*100);
  const share = total>0?((value/total)*100).toFixed(1):'0.0';
  return (
    <Box sx={{ py:.55 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:.3 }}>
        <Typography sx={{ fontSize:11.5, color:'#475569', fontWeight:600, flex:1, minWidth:0 }} noWrap>{name}</Typography>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink:0, pl:1 }}>
          <Typography sx={{ fontSize:10.5, color:'#94a3b8' }}>{share}%</Typography>
          <Typography sx={{ fontSize:11.5, fontWeight:800, color:'#0f172a', width:48, textAlign:'right' }}>
            {value.toLocaleString('es-CO')}
          </Typography>
        </Stack>
      </Stack>
      <Box sx={{ height:5, borderRadius:2, bgcolor:'#f1f5f9', overflow:'hidden' }}>
        <Box sx={{ width:`${pct}%`, height:'100%', borderRadius:2, bgcolor:color, transition:'width 1.1s ease' }} />
      </Box>
    </Box>
  );
}

/* ── Card wrapper ───────────────────────────────────────────────────────── */
function Card({ children, delay, active, sx={} }) {
  return (
    <Fade in={active} timeout={600+delay}>
      <Paper elevation={0}
        sx={{ p:3, borderRadius:3.5, border:'1px solid #e8eef8',
              overflow:'hidden', height:'100%', ...sx }}>
        {children}
      </Paper>
    </Fade>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════════════════ */
function InternacionalizacionMovilidadDashboard({ onBack, onNavigateConvenios }) {
  const { enqueueSnackbar } = useSnackbar();
  const [data,    setData]    = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready,   setReady]   = useState(false);
  const [filters, setFilters] = useState({ periodo:'', alcance:'', direccion:'', tipo_persona:'', pais:'' });

  // Filtros locales para el gráfico de tendencia
  const [localDesdePeriodo, setLocalDesdePeriodo] = useState('');
  const [localHastaPeriodo, setLocalHastaPeriodo] = useState('');

  const load = useCallback(async () => {
    setReady(false); setLoading(true);
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([,v])=>v));
      
      const trendFilters = { ...activeFilters };
      delete trendFilters.periodo;

      if (filters.periodo) {
        const [resData, resTrend] = await Promise.all([
          gestionInformacionService.getMovilidadDashboard(activeFilters),
          gestionInformacionService.getMovilidadDashboard(trendFilters)
        ]);
        setData(resData.data);
        setTrendData(resTrend.data);
      } else {
        const resData = await gestionInformacionService.getMovilidadDashboard(activeFilters);
        setData(resData.data);
        setTrendData(resData.data);
      }
      setTimeout(()=>setReady(true), 80);
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Error cargando datos', { variant:'error' });
    }
    finally   { setLoading(false); }
  }, [filters, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const setF  = (k,v) => setFilters(p=>({...p,[k]:v}));
  const reset = () => {
    setFilters({ periodo:'', alcance:'', direccion:'', tipo_persona:'', pais:'' });
    setLocalDesdePeriodo('');
    setLocalHastaPeriodo('');
  };
  const hasFil = Object.values(filters).some(Boolean);
  const cat    = trendData?.catalogos || data?.catalogos || {};
  const allPeriods = cat.periodos || [];
  const desdeOptions = allPeriods.filter(p => !localHastaPeriodo || p <= localHastaPeriodo);
  const hastaOptions = allPeriods.filter(p => !localDesdePeriodo || p >= localDesdePeriodo);

  /* ── derivados ──────────────────────────────────────────────────────── */
  const salientes = (data?.byDireccion||[]).find(r=>/saliente/i.test(r.name))?.value || 0;
  const entrantes = (data?.byDireccion||[]).find(r=>/entrante/i.test(r.name))?.value || 0;
  const paises    = (data?.byPais||[]).filter(r=>isCountry(r.name));
  const topPaises = paises.slice(0,12);
  const maxPais   = topPaises[0]?.value || 1;

  // Datos históricos para el gráfico de tendencia
  const allPeriodData = sortPer(trendData?.byPeriodo || data?.byPeriodo || []);
  let filteredPeriodData = allPeriodData;
  if (localDesdePeriodo) {
    filteredPeriodData = filteredPeriodData.filter(r => r.name >= localDesdePeriodo);
  }
  if (localHastaPeriodo) {
    filteredPeriodData = filteredPeriodData.filter(r => r.name <= localHastaPeriodo);
  }
  const areaData  = filteredPeriodData.map(r=>({ name:r.name, Movilidades:r.value }));
  const alcance   = data?.byAlcance     || [];
  const direccion = data?.byDireccion   || [];
  const persona   = data?.byTipoPersona || [];
  const activ     = (data?.byActividad  || []).slice(0,10);
  const tipoMov   = (data?.byTipoMovilidad||[]).slice(0,9);
  const modalidad = (data?.byModalidad  ||[]).filter(r=>r.name!=='Sin dato').slice(0,8);
  const programas = (data?.byPrograma   ||[]).slice(0,10);

  const KPIS = [
    { icon:AutoGraphIcon,    label:'Total movilidades',        value:data?.total,    sub:'registros históricos',       bg:`linear-gradient(135deg,${C.blue},#1e40af)`,    sh:'rgba(29,78,216,.28)'    },
    { icon:PublicIcon,       label:'Países destino',           value:paises.length,  sub:'países únicos identificados', bg:`linear-gradient(135deg,${C.cyan},#0e7490)`,    sh:'rgba(8,145,178,.28)'    },
    { icon:FlightTakeoffIcon,label:'Salientes',                value:salientes,      sub:'movilidades al exterior',    bg:`linear-gradient(135deg,${C.emerald},#047857)`, sh:'rgba(5,150,105,.28)'    },
    { icon:FlightLandIcon,   label:'Entrantes',                value:entrantes,      sub:'movilidades recibidas',      bg:`linear-gradient(135deg,${C.violet},#6d28d9)`,  sh:'rgba(124,58,237,.28)'   },
  ];

  return (
    <Box sx={{ pb:6 }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p:1.6, mb:2, border:'1px solid #dbe6f5', borderRadius:2.5, bgcolor:'#f8fbff' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" gap={1}>
          <Button variant="outlined" size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>
            Internacionalización
          </Button>
          <Chip label="Estadística de Movilidad" size="small" sx={{ bgcolor:C.blue, color:'#fff', fontWeight:700 }} />
          <Box flex={1}/>
          <Tooltip title="Limpiar filtros"><span>
            <IconButton size="small" onClick={reset} disabled={!hasFil} color={hasFil?'error':'default'}>
              <FilterAltOffIcon fontSize="small"/>
            </IconButton>
          </span></Tooltip>
          <Tooltip title="Actualizar">
            <IconButton size="small" onClick={load} disabled={loading}><RefreshIcon fontSize="small"/></IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      <InternacionalizacionNavSegment activeView="movilidad" onNavigateMovilidad={onBack} onNavigateConvenios={onNavigateConvenios}/>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p:1.8, mb:3, border:'1px solid #e2e8f0', borderRadius:2.5, bgcolor:'#fafafa' }}>
        <Stack direction="row" spacing={1.2} flexWrap="wrap" alignItems="center" gap={1}>
          <Typography sx={{ fontSize:12, fontWeight:700, color:'#64748b' }}>Filtros:</Typography>
          {[
            { label:'Período',      key:'periodo',      opts: cat.periodos     || [] },
            { label:'Alcance',      key:'alcance',      opts: cat.alcances     || [] },
            { label:'Dirección',    key:'direccion',    opts: cat.direcciones  || [] },
            { label:'Tipo persona', key:'tipo_persona', opts: cat.tiposPersona || [] },
            { label:'País',         key:'pais',         opts: (cat.paises||[]).filter(isCountry).slice(0,80) }
          ].map(({ label, key, opts }) => (
            <FormControl key={key} size="small" sx={{ minWidth:135 }}>
              <InputLabel sx={{ fontSize:12 }}>{label}</InputLabel>
              <Select value={filters[key]} label={label} onChange={e=>setF(key,e.target.value)} sx={{ fontSize:12 }}>
                <MenuItem value=""><em>Todos</em></MenuItem>
                {opts.map(o=><MenuItem key={o} value={o} sx={{ fontSize:12 }}>{o}</MenuItem>)}
              </Select>
            </FormControl>
          ))}
        </Stack>
      </Paper>

      {loading && (
        <Box sx={{ py:12, textAlign:'center' }}>
          <CircularProgress size={48} thickness={3.5}/>
          <Typography sx={{ mt:2, color:'#94a3b8', fontSize:13 }}>Cargando datos…</Typography>
        </Box>
      )}
      {!loading && data && data.total===0 && (
        <Alert severity="info" sx={{ borderRadius:2.5 }}>No hay registros con los filtros seleccionados.</Alert>
      )}

      {!loading && data && data.total>0 && (
        <Box>

          {/* ══ FILA 0: 4 KPIs en una sola fila ═══════════════════════════ */}
          <Box sx={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:2.2, mb:2.6 }}>
            {KPIS.map((kpi,i)=>(
              <KPI key={i} {...kpi} delay={i*70} active={ready}/>
            ))}
          </Box>

          {/* ══ CUADRÍCULA 2 × n ══════════════════════════════════════════ */}
          <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', md:'1fr 1fr' }, gap:2.6, alignItems:'start' }}>

            {/* ── 1. Tendencia histórica ───────────────────────────────── */}
            <Card delay={200} active={ready}>
              <ST t="Tendencia histórica de movilidad" s="Evolución cronológica por período académico" color={C.blue}/>
              
              {/* Selector de período local */}
              {allPeriods.length > 0 && (
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2, mt: -0.5, flexWrap: 'wrap', gap: 1 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Rango:
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 105 }}>
                    <InputLabel sx={{ fontSize: 11.5 }}>Desde</InputLabel>
                    <Select
                      value={localDesdePeriodo}
                      label="Desde"
                      onChange={e => setLocalDesdePeriodo(e.target.value)}
                      sx={{ fontSize: 11.5, height: 30 }}
                    >
                      <MenuItem value="" sx={{ fontSize: 11.5 }}><em>Inicio</em></MenuItem>
                      {desdeOptions.map(p => (
                        <MenuItem key={p} value={p} sx={{ fontSize: 11.5 }}>{p}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 105 }}>
                    <InputLabel sx={{ fontSize: 11.5 }}>Hasta</InputLabel>
                    <Select
                      value={localHastaPeriodo}
                      label="Hasta"
                      onChange={e => setLocalHastaPeriodo(e.target.value)}
                      sx={{ fontSize: 11.5, height: 30 }}
                    >
                      <MenuItem value="" sx={{ fontSize: 11.5 }}><em>Fin</em></MenuItem>
                      {hastaOptions.map(p => (
                        <MenuItem key={p} value={p} sx={{ fontSize: 11.5 }}>{p}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {(localDesdePeriodo || localHastaPeriodo) && (
                    <Tooltip title="Limpiar rango de períodos">
                      <IconButton
                        size="small"
                        onClick={() => { setLocalDesdePeriodo(''); setLocalHastaPeriodo(''); }}
                        color="error"
                        sx={{ width: 30, height: 30 }}
                      >
                        <FilterAltOffIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              )}

              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={areaData} margin={{ top:16, right:20, left:0, bottom:48 }}>
                  <defs>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={.22}/>
                      <stop offset="95%" stopColor={C.blue} stopOpacity={.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }} angle={-35} textAnchor="end" interval={0} padding={{ left: 20, right: 20 }}/>
                  <YAxis tick={{ fontSize:10.5, fill:'#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <RT content={<Tip/>}/>
                  <Area type="linear" dataKey="Movilidades" stroke={C.blue} strokeWidth={2.5}
                    fill="url(#gB)"
                    dot={{ r:4.5, fill:C.blue, stroke:'#fff', strokeWidth:2 }}
                    activeDot={{ r:7, fill:C.blue, stroke:'#fff', strokeWidth:2 }}
                    isAnimationActive animationDuration={1200}>
                    <LabelList dataKey="Movilidades" position="top" offset={10}
                      style={{ fontSize:10, fontWeight:700, fill:'#475569' }}
                      formatter={v=>v.toLocaleString('es-CO')}/>
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* ── 2. Alcance donut ─────────────────────────────────────── */}
            <Card delay={280} active={ready}>
              <ST t="Alcance de movilidad" s="Nacional · Internacional · Regional" color={C.cyan}/>
              {alcance.length>0 && (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={alcance} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={58} outerRadius={88}
                        paddingAngle={4} label={PL} labelLine={false}
                        isAnimationActive animationBegin={200} animationDuration={1000}>
                        {alcance.map((_,i)=><Cell key={i} fill={PAL[i%PAL.length]} stroke="none"/>)}
                      </Pie>
                      <RT content={<Tip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <Divider sx={{ my:1.5, borderStyle:'dashed' }}/>
                  <Stack spacing={1}>
                    {alcance.map((r,i)=>(
                      <Stack key={r.name} direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width:10, height:10, borderRadius:'50%', bgcolor:PAL[i%PAL.length] }}/>
                          <Typography sx={{ fontSize:13, color:'#475569', fontWeight:600 }}>{r.name}</Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1.2}>
                          <Typography sx={{ fontSize:13.5, fontWeight:800, color:'#0f172a' }}>
                            {r.value.toLocaleString('es-CO')}
                          </Typography>
                          <Chip size="small" label={`${((r.value/data.total)*100).toFixed(1)}%`}
                            sx={{ height:20, fontSize:10.5, fontWeight:700,
                              bgcolor:`${PAL[i%PAL.length]}18`, color:PAL[i%PAL.length] }}/>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </Card>

            {/* ── 3. Dirección de movilidad ────────────────────────────── */}
            {direccion.length>0 && (
              <Card delay={360} active={ready}>
                <ST t="Dirección de movilidad" color={C.emerald}/>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={direccion} layout="vertical" margin={{ left:0, right:68, top:8, bottom:8 }}>
                    <XAxis type="number" hide/>
                    <YAxis type="category" dataKey="name" width={84} axisLine={false} tickLine={false}
                      tick={{ fontSize:14, fill:'#475569', fontWeight:700 }}/>
                    <RT content={<Tip/>}/>
                    <Bar dataKey="value" radius={[0,10,10,0]} maxBarSize={46} isAnimationActive animationDuration={1000}>
                      {direccion.map((_,i)=><Cell key={i} fill={i===0?C.emerald:C.violet}/>)}
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:14, fontWeight:800, fill:'#0f172a' }}
                        formatter={v=>v.toLocaleString('es-CO')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <Divider sx={{ my:1.5, borderStyle:'dashed' }}/>
                <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" gap={1}>
                  {direccion.map((r,i)=>(
                    <Chip key={r.name} size="small"
                      label={`${r.name} · ${((r.value/data.total)*100).toFixed(1)}%`}
                      sx={{ fontWeight:700, fontSize:11.5,
                        bgcolor:i===0?'#f0fdf4':'#faf5ff',
                        color:i===0?C.emerald:C.violet,
                        border:`1px solid ${i===0?'#bbf7d0':'#ddd6fe'}` }}/>
                  ))}
                </Stack>
              </Card>
            )}

            {/* ── 4. Tipo de persona ───────────────────────────────────── */}
            {persona.length>0 && (
              <Card delay={440} active={ready}>
                <ST t="Tipo de persona" color={C.amber}/>
                <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'230px 1fr' }, gap:2, alignItems:'center' }}>
                  <Box sx={{ height:220, minWidth:0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={persona} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={42} outerRadius={64}
                          paddingAngle={4} label={PL} labelLine={false}
                          isAnimationActive animationDuration={900}>
                          {persona.map((_,i)=>(
                            <Cell key={i} fill={[C.amber,C.rose,C.indigo,C.cyan,C.teal][i%5]} stroke="none"/>
                          ))}
                        </Pie>
                        <RT content={<Tip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Stack spacing={1}>
                    {persona.map((r,i)=>(
                      <Stack key={r.name} direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={.8}>
                          <Box sx={{ width:10, height:10, borderRadius:'50%',
                            bgcolor:[C.amber,C.rose,C.indigo,C.cyan,C.teal][i%5], flexShrink:0 }}/>
                          <Typography sx={{ fontSize:12.5, color:'#475569', fontWeight:600 }} noWrap>{r.name}</Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.8}>
                          <Typography sx={{ fontSize:12.5, fontWeight:800, color:'#0f172a' }}>
                            {r.value.toLocaleString('es-CO')}
                          </Typography>
                          <Chip size="small" label={`${((r.value/data.total)*100).toFixed(0)}%`}
                            sx={{ height:20, fontSize:10.5, fontWeight:700, bgcolor:'#f8fafc' }}/>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Card>
            )}

            {/* ── 5. Top países — span 2 columnas ─────────────────────── */}
            {topPaises.length>0 && (
              <Box sx={{ gridColumn:'1 / -1' }}>
                <Card delay={520} active={ready}>
                  <ST t={`Top ${topPaises.length} países destino`}
                    s="Distribución porcentual del total de movilidades" color={C.emerald}/>
                  <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', md:'1fr 1fr' }, columnGap:5 }}>
                    {topPaises.map((r,i)=>(
                      <Box key={r.name}>
                        <PaisRow name={r.name} value={r.value}
                          max={maxPais} color={PAL[i%PAL.length]} rank={i+1} total={data.total}/>
                        <Divider sx={{ borderColor:'#f8fafc' }}/>
                      </Box>
                    ))}
                  </Box>
                </Card>
              </Box>
            )}

            {/* ── 6. Actividades ───────────────────────────────────────── */}
            {activ.length>0 && (
              <Card delay={600} active={ready}>
                <ST t="Actividades de movilidad" s="Top 10 actividades más frecuentes" color={C.indigo}/>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={activ} layout="vertical" margin={{ left:8, right:62, top:4, bottom:4 }}>
                    <defs>
                      <linearGradient id="gInd" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.indigo}/>
                        <stop offset="100%" stopColor={C.violet}/>
                      </linearGradient>
                    </defs>
                    <XAxis type="number" tick={{ fontSize:10 }} axisLine={false} tickLine={false}
                      tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                    <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false}
                      tick={{ fontSize:10.5, fill:'#475569' }}
                      tickFormatter={v=>v.length>26?v.slice(0,26)+'…':v}/>
                    <RT content={<Tip/>}/>
                    <Bar dataKey="value" fill="url(#gInd)" radius={[0,8,8,0]}
                      isAnimationActive animationDuration={1100} maxBarSize={26}>
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:11, fontWeight:800, fill:'#0f172a' }}
                        formatter={v=>v.toLocaleString('es-CO')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* ── 7. Tipo de movilidad ─────────────────────────────────── */}
            {tipoMov.length>0 && (
              <Card delay={680} active={ready}>
                <ST t="Tipo de movilidad" color={C.rose}/>
                <Stack spacing={1.4} sx={{ mt:.5 }}>
                  {tipoMov.map((r,i)=>(
                    <ProgBar key={r.name} name={r.name} value={r.value}
                      total={data.total} max={tipoMov[0]?.value||1} color={PAL[i%PAL.length]}/>
                  ))}
                </Stack>
              </Card>
            )}

            {/* ── 8. Modalidad ─────────────────────────────────────────── */}
            {modalidad.length>0 && (
              <Card delay={760} active={ready}>
                <ST t="Modalidad de movilidad" color={C.teal}/>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={modalidad} layout="vertical" margin={{ left:8, right:60, top:4, bottom:4 }}>
                    <defs>
                      <linearGradient id="gT" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.teal}/>
                        <stop offset="100%" stopColor="#0e7490"/>
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide/>
                    <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false}
                      tick={{ fontSize:10.5, fill:'#475569' }}
                      tickFormatter={v=>v.length>22?v.slice(0,22)+'…':v}/>
                    <RT content={<Tip/>}/>
                    <Bar dataKey="value" fill="url(#gT)" radius={[0,8,8,0]} isAnimationActive animationDuration={1000} maxBarSize={22}>
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:11, fontWeight:800, fill:'#0f172a' }}
                        formatter={v=>v.toLocaleString('es-CO')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* ── 9. Top programas ─────────────────────────────────────── */}
            {programas.length>0 && (
              <Card delay={840} active={ready}>
                <ST t="Top programas y dependencias" s="Mayor número de movilidades" color={C.cyan}/>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={programas} layout="vertical" margin={{ left:8, right:60, top:4, bottom:4 }}>
                    <defs>
                      <linearGradient id="gC" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.cyan}/>
                        <stop offset="100%" stopColor="#0e7490"/>
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide/>
                    <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false}
                      tick={{ fontSize:10.5, fill:'#475569' }}
                      tickFormatter={v=>v.length>26?v.slice(0,26)+'…':v}/>
                    <RT content={<Tip/>}/>
                    <Bar dataKey="value" fill="url(#gC)" radius={[0,8,8,0]}
                      isAnimationActive animationDuration={1100} maxBarSize={22}>
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:11, fontWeight:800, fill:'#0f172a' }}
                        formatter={v=>v.toLocaleString('es-CO')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

          </Box>
        </Box>
      )}
    </Box>
  );
}

export default InternacionalizacionMovilidadDashboard;
