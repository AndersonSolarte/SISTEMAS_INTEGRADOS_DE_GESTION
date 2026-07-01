import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Box, Paper, Typography, Stack, Button, Chip,
  CircularProgress, Alert, IconButton, Tooltip, Fade, Divider
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
  const k = n.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,'').trim();
  return ISO_MAP[k] || ISO_MAP[n.toUpperCase()] || null;
};
const isCountry = (n = '') => {
  const t = cleanCountryKey(n);
  if (!t || /^\d+$/.test(t)) return false;
  return !['N A','NA','SIN DATO','REGIONAL','OTRO','OTROS','NO APLICA'].includes(t);
};
const sortPer = (arr) =>
  [...arr].sort((a,b) => String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true}));

/* ── Flag ───────────────────────────────────────────────────────────────── */
const cleanCountryKey = (n = '') =>
  String(n || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const COUNTRY_NAMES = {
  AR:'Argentina', BR:'Brasil', CL:'Chile', CO:'Colombia', EC:'Ecuador', MX:'M\u00e9xico',
  PE:'Per\u00fa', SV:'El Salvador', US:'Estados Unidos', CA:'Canad\u00e1', ES:'Espa\u00f1a',
  FR:'Francia', DE:'Alemania', IT:'Italia', GB:'Reino Unido', PT:'Portugal'
};
const canonicalCountryName = (name = '') => {
  const iso = getISO(name);
  if (iso && COUNTRY_NAMES[iso]) return COUNTRY_NAMES[iso];
  return cleanCountryKey(name).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
};
const mergeCountryRows = (rows = []) => Object.values(rows.reduce((acc, row) => {
  if (!isCountry(row.name)) return acc;
  const iso = getISO(row.name);
  const key = iso || cleanCountryKey(row.name);
  if (!acc[key]) acc[key] = { name: canonicalCountryName(row.name), value: 0 };
  acc[key].value += Number(row.value || 0);
  return acc;
}, {})).sort((a,b) => b.value - a.value);

const cleanMobilityTypeKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/^\s*\d+\s*\.?\s*/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();
const MOBILITY_TYPE_NAMES = {
  'ASISTENCIA A EVENTOS': 'Asistencia a eventos',
  'ASISTENCIA EVENTOS': 'Asistencia a eventos',
  'CURSO CORTO': 'Curso corto',
  'PASANTIA O PRACTICA': 'Pasant\u00eda o pr\u00e1ctica',
  PASANTIA: 'Pasant\u00eda',
  MISION: 'Misi\u00f3n',
  'SECTOR EMPRESARIAL': 'Sector empresarial',
  'EDUCACION CONTINUADA': 'Educaci\u00f3n continuada',
  SEMINARIOS: 'Seminarios',
  SIMPOSIOS: 'Simposios',
  CONGRESOS: 'Congresos',
  'GESTION DE CONVENIOS': 'Gesti\u00f3n de convenios',
  'SEMESTRE ACADEMICO DE INTERCAMBIO': 'Semestre acad\u00e9mico de intercambio',
  'PAR ACADEMICO': 'Par acad\u00e9mico',
  PONENCIA: 'Ponencia',
  'VISITA EMPRESARIAL': 'Visita empresarial',
  ACADEMICA: 'Acad\u00e9mica',
  ENTRANTE: 'Entrante',
  SALIENTE: 'Saliente'
};
const normalizeMobilityType = (value = '') => {
  const key = cleanMobilityTypeKey(value);
  if (!key || ['N A', 'NA', 'N/A', 'SIN DATO'].includes(key)) return 'Sin dato';
  return MOBILITY_TYPE_NAMES[key] || key.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
};
const mergeNamedRows = (rows = [], normalizer = (name) => name) => Object.values(rows.reduce((acc, row) => {
  const name = normalizer(row.name);
  if (!acc[name]) acc[name] = { name, value: 0 };
  acc[name].value += Number(row.value || 0);
  return acc;
}, {})).sort((a,b) => b.value - a.value);

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
        {`${(percent * 100).toFixed(1)}%`}
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
      <Typography sx={{ fontSize:11, color:'#64748b', fontWeight:700, width:20, textAlign:'right', flexShrink:0 }}>{rank}</Typography>
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
function ChecklistFilter({ label, options = [], value = [], onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [portalStyle, setPortalStyle] = useState({});
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const selected = Array.isArray(value) ? value.map(String) : [];
  const normalizedOptions = options.map((item) => ({ value: String(item), label: String(item) }));
  const allValues = normalizedOptions.map((item) => item.value);
  const filtered = normalizedOptions.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));
  const allSelected = selected.length === 0 || (normalizedOptions.length > 0 && selected.length === normalizedOptions.length);
  const brand = '#2563eb';

  const computePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPortalStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 296),
      zIndex: 1600
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    computePosition();
    const onScroll = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      computePosition();
    };
    const onResize = () => computePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (triggerRef.current?.contains(event.target) || dropdownRef.current?.contains(event.target)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (normalizedOptions.length > 0 && selected.length === normalizedOptions.length) {
      onChange([]);
    }
  }, [normalizedOptions.length, onChange, selected.length]);

  const toggle = (option) => {
    const next = selected.length === 0
      ? allValues.filter((item) => item !== option)
      : selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];
    onChange(next.length === 0 || next.length === allValues.length ? [] : next);
  };
  const toggleAll = () => onChange([]);
  const displayText = allSelected ? 'TODOS' : selected.length === 1 ? selected[0] : `${selected.length} seleccionados`;
  const checkedFor = (option) => allSelected || selected.includes(option);

  const dropdown = open ? ReactDOM.createPortal(
    <div ref={dropdownRef} style={{ ...portalStyle, background: '#fff', borderRadius: 10, boxShadow: '0 18px 42px rgba(15,23,42,.2)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 6, padding: '5px 8px', border: '1px solid #e2e8f0' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, color: '#334155', minWidth: 0 }} />
        </div>
      </div>
      <div onClick={toggleAll} style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `2px solid ${allSelected ? brand : '#d1d5db'}`, background: allSelected ? brand : '#fff', display: 'grid', placeItems: 'center' }}>
          {allSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: brand }}>SELECCIONAR TODOS ({normalizedOptions.length})</span>
      </div>
      <div onWheel={(event) => event.stopPropagation()} style={{ maxHeight: 238, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '14px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Sin resultados</div>
        ) : filtered.map((option) => (
          <div key={option.value} onClick={() => toggle(option.value)} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `2px solid ${checkedFor(option.value) ? brand : '#d1d5db'}`, background: checkedFor(option.value) ? brand : '#fff', display: 'grid', placeItems: 'center' }}>
              {checkedFor(option.value) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <span style={{ fontSize: 12, color: '#334155' }}>{option.label}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '5px 12px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{allSelected ? `${normalizedOptions.length} opciones` : `${selected.length} de ${normalizedOptions.length} seleccionados`}</span>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <Box ref={triggerRef} sx={{ minWidth: 150, opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <Box onClick={() => !disabled && setOpen((current) => !current)} sx={{ cursor: 'pointer', borderRadius: 2, px: 1.5, py: 0.8, minHeight: 44, bgcolor: !allSelected ? '#eff6ff' : '#fff', border: `1.5px solid ${!allSelected ? brand : '#bfdbfe'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, userSelect: 'none', '&:hover': { borderColor: brand } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 9, fontWeight: 800, color: brand, letterSpacing: .7, textTransform: 'uppercase' }}>{label}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 132 }}>{displayText}</Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
          {!allSelected && (
            <Box onClick={(event) => { event.stopPropagation(); onChange([]); }} sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: brand, display: 'grid', placeItems: 'center' }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Box>
          )}
          <Box sx={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={brand} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </Box>
        </Stack>
      </Box>
      {dropdown}
    </Box>
  );
}

function HeatCell({ value, max, period, group }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = value > 0
    ? `linear-gradient(135deg, rgba(29,78,216,${0.12 + (intensity * 0.72)}), rgba(8,145,178,${0.08 + (intensity * 0.36)}))`
    : '#f8fafc';
  const border = value > 0 ? `rgba(29,78,216,${0.12 + (intensity * 0.22)})` : '#e8eef8';
  const color = '#0f172a';

  return (
    <Tooltip title={`${group} / ${period}: ${value.toLocaleString('es-CO')} movilidades`} arrow>
      <Box
        sx={{
          minWidth: 74,
          height: 58,
          borderRadius: 1.6,
          background: bg,
          border: `1px solid ${border}`,
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: value > 0 ? `inset 0 -12px 28px rgba(15,23,42,${0.03 + (intensity * 0.04)})` : 'none',
          transition: 'transform .18s ease, box-shadow .18s ease',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: value > 0 ? `rgba(29,78,216,${0.35 + (intensity * 0.5)})` : '#e2e8f0'
          },
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 14px 28px rgba(15,23,42,.12)'
          }
        }}
      >
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 900,
            color,
            lineHeight: 1
          }}
        >
          {value ? value.toLocaleString('es-CO') : '-'}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function InternacionalizacionMovilidadDashboard({ onBack, onNavigateConvenios }) {
  const { enqueueSnackbar } = useSnackbar();
  const [data,    setData]    = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready,   setReady]   = useState(false);
  const emptyFilters = { periodo:[], alcance:[], direccion:[], tipo_persona:[], pais:[] };
  const [filters, setFilters] = useState(emptyFilters);

  // Filtros locales para el gráfico de tendencia
  const [localDesdePeriodo, setLocalDesdePeriodo] = useState('');
  const [localHastaPeriodo, setLocalHastaPeriodo] = useState('');

  const load = useCallback(async () => {
    setReady(false); setLoading(true);
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([,v])=>Array.isArray(v) ? v.length > 0 : Boolean(v)));
      
      const trendFilters = { ...activeFilters };
      delete trendFilters.periodo;

      if (filters.periodo.length > 0) {
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
    setFilters(emptyFilters);
    setLocalDesdePeriodo('');
    setLocalHastaPeriodo('');
  };
  const hasFil = Object.values(filters).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  const cat    = trendData?.catalogos || data?.catalogos || {};
  const allPeriods = cat.periodos || [];
  const countryFilterOptions = mergeCountryRows((cat.paises || []).map((name) => ({ name, value: 1 }))).map((row) => row.name);
  const desdeOptions = allPeriods.filter(p => !localHastaPeriodo || p <= localHastaPeriodo);
  const hastaOptions = allPeriods.filter(p => !localDesdePeriodo || p >= localDesdePeriodo);

  /* ── derivados ──────────────────────────────────────────────────────── */
  const salientes = (data?.byDireccion||[]).find(r=>/saliente/i.test(r.name))?.value || 0;
  const entrantes = (data?.byDireccion||[]).find(r=>/entrante/i.test(r.name))?.value || 0;
  const paises    = mergeCountryRows(data?.byPais || []);
  const paisesDestino = paises;
  const maxPais   = paisesDestino[0]?.value || 1;

  // Datos históricos para el gráfico de tendencia
  const periodDataset = filters.periodo.length > 0 ? data : (trendData || data);
  const allPeriodData = sortPer(periodDataset?.byPeriodo || []);
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
  const tipoMov   = mergeNamedRows(data?.byTipoMovilidad || [], normalizeMobilityType).filter(r=>r.name!=='Sin dato').slice(0,9);
  const modalidad = (data?.byModalidad  ||[]).filter(r=>r.name!=='Sin dato').slice(0,8);
  const programas = (data?.byPrograma   ||[]).slice(0,10);
  const heatDataset = filters.periodo.length > 0 ? data : (trendData || data);
  const heatSource = heatDataset?.heatmapPeriodoDireccion || {};
  const heatPeriodBase = sortPer(heatDataset?.byPeriodo || []);
  const heatPeriods = heatPeriodBase.map(r => r.name);
  const heatRows = Object.entries(heatSource)
    .map(([name, values]) => ({
      name,
      values: heatPeriods.map(period => Number(values?.[period] || 0))
    }))
    .filter(row => row.values.some(Boolean))
    .sort((a,b) => b.values.reduce((s,v)=>s+v,0) - a.values.reduce((s,v)=>s+v,0));
  const heatMax = Math.max(1, ...heatRows.flatMap(row => row.values));
  const heatPeriodTotals = heatPeriods.map((period, index) => ({
    period,
    value: heatRows.reduce((sum, row) => sum + (row.values[index] || 0), 0)
  }));
  const heatPeriodMax = Math.max(1, ...heatPeriodTotals.map(r => r.value));
  const heatTotal = heatRows.reduce((sum, row) => sum + row.values.reduce((rowSum, value) => rowSum + value, 0), 0);

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
            { label:'Pa\u00eds',    key:'pais',         opts: countryFilterOptions.slice(0,80) }
          ].map(({ label, key, opts }) => (
            <ChecklistFilter
              key={key}
              label={label}
              options={opts}
              value={filters[key]}
              onChange={(value) => setF(key, value)}
              placeholder={`Buscar ${label.toLowerCase()}...`}
              disabled={loading}
            />
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
          {heatRows.length > 0 && (
            <Box sx={{ mb: 2.6 }}>
              <Card delay={160} active={ready} sx={{ p: { xs: 2, md: 3 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{ mb: 2 }}
                >
                  <ST
                    t="Mapa de calor de movilidad"
                    color={C.blue}
                  />
                  <Stack direction="row" alignItems="center" spacing={1.2} sx={{ flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700 }}>Menor</Typography>
                    <Box sx={{
                      width: 132,
                      height: 10,
                      borderRadius: 999,
                      background: `linear-gradient(90deg, rgba(29,78,216,.12), rgba(29,78,216,.58), ${C.blue})`,
                      border: '1px solid rgba(29,78,216,.12)'
                    }} />
                    <Typography sx={{ fontSize: 10.5, color: '#64748b', fontWeight: 800 }}>Mayor</Typography>
                  </Stack>
                </Stack>

                <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: `minmax(130px, 170px) repeat(${heatPeriods.length}, minmax(74px, 1fr)) minmax(86px, 100px)`,
                      gap: 0.9,
                      minWidth: 270 + (heatPeriods.length * 82),
                      alignItems: 'center'
                    }}
                  >
                    <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>
                      {'Direcci\u00f3n'}
                    </Typography>
                    {heatPeriodTotals.map(({ period, value }) => (
                      <Box key={period} sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 11, color: '#475569', fontWeight: 900 }}>
                          {period}
                        </Typography>
                        <Box sx={{ height: 4, borderRadius: 2, bgcolor: '#e2e8f0', mt: 0.8, overflow: 'hidden' }}>
                          <Box
                            sx={{
                              height: '100%',
                              width: `${Math.max(8, (value / heatPeriodMax) * 100)}%`,
                              bgcolor: C.blue,
                              borderRadius: 2
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 800, mt: 0.5 }}>
                          {value.toLocaleString('es-CO')}
                        </Typography>
                      </Box>
                    ))}
                    <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 900, textAlign: 'right', textTransform: 'uppercase' }}>
                      Total
                    </Typography>

                    {heatRows.map((row, rowIndex) => {
                      const rowTotal = row.values.reduce((sum, value) => sum + value, 0);
                      return (
                        <React.Fragment key={row.name}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: rowIndex === 0 ? C.emerald : C.violet,
                                flexShrink: 0
                              }}
                            />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 12.5, color: '#0f172a', fontWeight: 900 }} noWrap>
                                {row.name}
                              </Typography>
                              <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700 }}>
                                {heatTotal > 0 ? ((rowTotal / heatTotal) * 100).toFixed(1) : '0.0'}% del total
                              </Typography>
                            </Box>
                          </Stack>
                          {row.values.map((value, index) => (
                            <HeatCell
                              key={`${row.name}-${heatPeriods[index]}`}
                              value={value}
                              max={heatMax}
                              period={heatPeriods[index]}
                              group={row.name}
                            />
                          ))}
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography sx={{ fontSize: 14, color: '#0f172a', fontWeight: 900 }}>
                              {rowTotal.toLocaleString('es-CO')}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>
                              registros
                            </Typography>
                          </Box>
                        </React.Fragment>
                      );
                    })}
                  </Box>
                </Box>
              </Card>
            </Box>
          )}

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
                  <Box
                    component="select"
                    value={localDesdePeriodo}
                    onChange={(event) => setLocalDesdePeriodo(event.target.value)}
                    sx={{
                      minWidth: 105,
                      height: 32,
                      border: '1px solid #cbd5e1',
                      borderRadius: 1.5,
                      bgcolor: '#fff',
                      color: '#334155',
                      fontSize: 11.5,
                      px: 1.2,
                      outline: 'none'
                    }}
                  >
                    <option value="">Inicio</option>
                    {desdeOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Box>
                  <Box
                    component="select"
                    value={localHastaPeriodo}
                    onChange={(event) => setLocalHastaPeriodo(event.target.value)}
                    sx={{
                      minWidth: 105,
                      height: 32,
                      border: '1px solid #cbd5e1',
                      borderRadius: 1.5,
                      bgcolor: '#fff',
                      color: '#334155',
                      fontSize: 11.5,
                      px: 1.2,
                      outline: 'none'
                    }}
                  >
                    <option value="">Fin</option>
                    {hastaOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Box>
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
                <AreaChart data={areaData} margin={{ top:16, right:20, left:0, bottom:20 }}>
                  <defs>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={.22}/>
                      <stop offset="95%" stopColor={C.blue} stopOpacity={.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize:11, fill:'#64748b', fontWeight:700 }}
                    tickLine={false}
                    axisLine={{ stroke:'#e2e8f0' }}
                    tickMargin={12}
                    interval={0}
                    minTickGap={8}
                    padding={{ left: 20, right: 20 }}
                  />
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
                          paddingAngle={4} label={false} labelLine={false}
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

            {/* -- 5. Pa�ses destino � span 2 columnas ----------------------- */}
            {paisesDestino.length>0 && (
              <Box sx={{ gridColumn:'1 / -1' }}>
                <Card delay={520} active={ready}>
                  <ST t={`Pa\u00edses destino (${paisesDestino.length})`}
                    s="Distribución porcentual del total de movilidades" color={C.emerald}/>
                  <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', md:'1fr 1fr' }, columnGap:5 }}>
                    {paisesDestino.map((r,i)=>(
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


