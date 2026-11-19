import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Box, Paper, Typography, Stack, Button, Chip,
  CircularProgress, LinearProgress, Alert, IconButton, Tooltip, Fade, Divider,
  useMediaQuery, useTheme
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
  Tooltip as RT, PieChart, Pie, Cell, Sector, LabelList, AreaChart, Area
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
const PERSONA_PAL = [C.amber, C.rose, C.indigo, C.cyan, C.teal];

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

const NONE_FILTER_VALUE = '__NONE__';
const normalizeSearchText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/* ── Counter ────────────────────────────────────────────────────────────── */
function useCounter(target, active) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const prevRef = useRef(0);

  useEffect(() => {
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (!active) {
      prevRef.current = 0;
      setVal(0);
      return undefined;
    }
    const nextTarget = Number(target || 0);
    if (!nextTarget) {
      prevRef.current = 0;
      setVal(0);
      return undefined;
    }
    const startValue = prevRef.current;
    if (startValue === nextTarget) {
      setVal(nextTarget);
      return undefined;
    }
    const t0 = performance.now();
    const dur = 420;
    const run = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(startValue + ((nextTarget - startValue) * eased)));
      if (p < 1) {
        raf.current = requestAnimationFrame(run);
      } else {
        prevRef.current = nextTarget;
        raf.current = null;
      }
    };
    raf.current = requestAnimationFrame(run);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, active]);

  return val;
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
const KPI_SILHOUETTE_SVG_SX = {
  width: { xs: 84, sm: 96, md: 108 },
  height: { xs: 84, sm: 96, md: 108 },
  overflow: 'visible',
  fill: 'rgba(255, 255, 255, 0.25)',
  display: 'block'
};

function KpiTakeoffSilhouette() {
  return (
    <Box component="svg" viewBox="0 0 24 24" sx={KPI_SILHOUETTE_SVG_SX}>
      <path className="kpi-runway" d="M2.5 19h19v2h-19z" />
      <g className="kpi-plane" style={{ transformOrigin: '12px 12px' }}>
        <path d="M22.07 9.64c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49s7.12-1.9 16.57-4.43c.81-.23 1.28-1.05 1.07-1.85" />
      </g>
    </Box>
  );
}

function KpiLandingSilhouette() {
  return (
    <Box component="svg" viewBox="0 0 24 24" sx={KPI_SILHOUETTE_SVG_SX}>
      <path className="kpi-runway" d="M2.5 19h19v2h-19z" />
      <g className="kpi-plane" style={{ transformOrigin: '12px 12px' }}>
        <path d="M19.34 15.85c.8.21 1.62-.26 1.84-1.06.21-.8-.26-1.62-1.06-1.84l-5.31-1.42-2.76-9.02L10.12 2v8.28L5.15 8.95l-.93-2.32-1.45-.39v5.17z" />
      </g>
    </Box>
  );
}

const KPI_MOTION = {
  rise: {
    pos: { right: -4, bottom: -8 },
    idleTransform: 'translate(0, 2px) scale(1)',
    hoverTransform: 'translate(6px, -8px) scale(1.12)',
    silhouetteTransition: 'transform 0.48s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease',
    badgeIconHover: 'translate(2px, -2px) scale(1.08)'
  },
  orbit: {
    pos: { right: -6, bottom: -10 },
    idleTransform: 'rotate(-8deg) scale(1)',
    hoverTransform: 'rotate(24deg) scale(1.1)',
    silhouetteTransition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease',
    badgeIconHover: 'rotate(22deg) scale(1.08)'
  },
  takeoff: {
    pos: { right: 10, bottom: -4 },
    idleTransform: 'none',
    hoverTransform: 'none',
    planeIdle: 'translate(-2.2px, 3.4px) rotate(12deg) scale(0.96)',
    planeHover: 'translate(2.6px, -4.4px) rotate(-6deg) scale(1.06)',
    silhouetteTransition: 'opacity 0.28s ease',
    badgeIconHover: 'translate(3px, -3px) rotate(-6deg) scale(1.08)'
  },
  landing: {
    pos: { right: 10, bottom: -4 },
    idleTransform: 'none',
    hoverTransform: 'none',
    planeIdle: 'translate(-3.8px, -4.6px) rotate(5deg) scale(0.98)',
    planeHover: 'translate(1.2px, 2.2px) rotate(-7deg) scale(1.03)',
    silhouetteTransition: 'opacity 0.28s ease',
    badgeIconHover: 'translate(3px, 3px) rotate(4deg) scale(1.08)'
  }
};

function KPI({ icon: Icon, label, value, sub, bg, sh, delay, active, motion = 'rise' }) {
  const n = useCounter(typeof value === 'number' ? value : 0, active);
  const motionCfg = KPI_MOTION[motion] || KPI_MOTION.rise;
  const isFlightMotion = motion === 'takeoff' || motion === 'landing';

  return (
    <Fade in={active} timeout={500 + delay}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.8, sm: 2, md: 2.4 },
          borderRadius: '18px',
          background: bg,
          minWidth: 0,
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: `0 10px 26px ${sh}, inset 0 1px 0 rgba(255, 255, 255, 0.22)`,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'default',
          transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease, border-color 0.28s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: 'rgba(255, 255, 255, 0.32)',
            boxShadow: `0 18px 36px ${sh}, inset 0 1px 0 rgba(255, 255, 255, 0.34)`
          },
          '&:hover .kpi-silhouette': {
            transform: motionCfg.hoverTransform,
            opacity: 1
          },
          ...(isFlightMotion && {
            '&:hover .kpi-plane': {
              transform: motionCfg.planeHover
            },
            '&:hover .kpi-runway': {
              opacity: 0.95
            }
          }),
          '&:hover .kpi-icon-badge': {
            bgcolor: 'rgba(255, 255, 255, 0.28)'
          },
          '&:hover .kpi-icon-svg': {
            transform: motionCfg.badgeIconHover
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            '&:hover': { transform: 'none' },
            '&:hover .kpi-silhouette': { transform: motionCfg.idleTransform },
            '&:hover .kpi-plane': { transform: motionCfg.planeIdle || 'none' },
            '&:hover .kpi-icon-svg': { transform: 'none' }
          }
        }}
      >
        <Box
          className="kpi-silhouette"
          data-testid="kpi-silhouette"
          data-motion={motion}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            ...motionCfg.pos,
            pointerEvents: 'none',
            zIndex: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isFlightMotion ? 0.84 : 0.65,
            transform: motionCfg.idleTransform,
            transition: motionCfg.silhouetteTransition,
            ...(isFlightMotion && {
              '& .kpi-runway': {
                opacity: 0.55,
                transition: 'opacity 0.36s ease'
              },
              '& .kpi-plane': {
                transform: motionCfg.planeIdle,
                transition: 'transform 0.62s cubic-bezier(0.22, 1, 0.36, 1)'
              }
            })
          }}
        >
          {motion === 'takeoff' ? (
            <KpiTakeoffSilhouette />
          ) : motion === 'landing' ? (
            <KpiLandingSilhouette />
          ) : (
            <Icon sx={{ fontSize: { xs: 78, sm: 88, md: 96 }, color: 'rgba(255, 255, 255, 0.24)' }} />
          )}
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Box
              className="kpi-icon-badge"
              sx={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                bgcolor: 'rgba(255, 255, 255, 0.22)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                transition: 'background-color 0.28s ease'
              }}
            >
              <Icon
                className="kpi-icon-svg"
                sx={{
                  color: '#fff',
                  fontSize: 18,
                  transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.01em', color: 'rgba(255, 255, 255, 0.88)', lineHeight: 1.2, minWidth: 0 }}>
              {label}
            </Typography>
          </Stack>
          <Typography
            sx={{
              fontSize: { xs: 26, sm: 30, md: 34 },
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
              wordBreak: 'break-word'
            }}
          >
            {(typeof value === 'number' ? n : value).toLocaleString('es-CO')}
          </Typography>
          {sub && (
            <Typography sx={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(255, 255, 255, 0.76)', mt: 0.45 }}>
              {sub}
            </Typography>
          )}
        </Box>
      </Paper>
    </Fade>
  );
}

/* ── Tooltip ────────────────────────────────────────────────────────────── */
const safeHexAccent = (color, fallback = C.blue) => (
  /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color) : fallback
);

const Tip = ({ active, payload, label, total = 0, accentColor = C.blue }) => {
  if (!active || !payload?.length) return null;
  const title = label || payload[0]?.name || payload[0]?.payload?.name || '';
  return (
    <Paper
      elevation={6}
      sx={{
        p: 1.5,
        borderRadius: '12px',
        border: '1px solid rgba(203, 213, 225, 0.95)',
        bgcolor: 'rgba(255, 255, 255, 0.97)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 14px 32px rgba(15, 23, 42, 0.14)',
        minWidth: 155,
        maxWidth: 260
      }}
    >
      {title && (
        <Typography
          sx={{
            fontSize: 10.5,
            fontWeight: 800,
            color: '#475569',
            mb: 0.75,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            lineHeight: 1.25
          }}
        >
          {String(title)}
        </Typography>
      )}
      <Stack spacing={0.55}>
        {payload.map((p, i) => {
          const val = Number(p.value || 0);
          const accent = safeHexAccent(p.color || p.fill || p.payload?.fill, accentColor);
          const pct = total > 0 && Number.isFinite(val) ? ((val / total) * 100).toFixed(1) : null;
          const seriesLabel = payload.length === 1 && (!p.name || p.name === title || p.name === 'value')
            ? 'Movilidades'
            : (p.name || 'Total');
          return (
            <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" spacing={1.8}>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accent, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748b' }} noWrap>
                  {seriesLabel}
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ flexShrink: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                  {val.toLocaleString('es-CO')}
                </Typography>
                {pct !== null && (
                  <Box
                    component="span"
                    sx={{
                      px: 0.65,
                      py: 0.15,
                      borderRadius: '6px',
                      fontSize: 10,
                      fontWeight: 800,
                      bgcolor: `${accent}18`,
                      color: accent
                    }}
                  >
                    {pct}%
                  </Box>
                )}
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
};

/* ── Título sección ─────────────────────────────────────────────────────── */
const ST = ({ t, s, color = C.blue, activeBadge = null }) => (
  <Stack
    direction="row"
    alignItems="center"
    justifyContent="space-between"
    spacing={1.2}
    sx={{ mb: 2, minHeight: 28, flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1 }}
  >
    <Box sx={{ minWidth: 0, flex: '1 1 180px' }}>
      <Stack direction="row" alignItems="center" spacing={1.2}>
        <Box sx={{ width: 4, height: 20, borderRadius: '999px', bgcolor: color, flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.01em' }} noWrap>{t}</Typography>
      </Stack>
      {s && <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.3, pl: 1.4 }}>{s}</Typography>}
    </Box>
    {activeBadge && (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.8,
          height: 26,
          px: 1.1,
          borderRadius: '10px',
          bgcolor: `${activeBadge.color || color}12`,
          border: `1px solid ${activeBadge.color || color}40`,
          flexShrink: 1,
          minWidth: 0,
          maxWidth: { xs: '100%', sm: '55%' }
        }}
      >
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: activeBadge.color || color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#0f172a', minWidth: 0 }} noWrap>
          {activeBadge.label}
        </Typography>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 900,
            color: activeBadge.color || color,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0
          }}
        >
          {Number(activeBadge.value || 0).toLocaleString('es-CO')}
          {activeBadge.pct ? ` · ${activeBadge.pct}%` : ''}
        </Typography>
      </Box>
    )}
  </Stack>
);

/* ── Helpers interactivos para donas y barras ───────────────────────────── */
const PR = Math.PI / 180;

const createDonutSectorRenderer = (hoveredName) => (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, name } = props;
  const sliceName = payload?.name || name;
  const isHighlighted = Boolean(hoveredName && sliceName === hoveredName);
  const isDimmed = Boolean(hoveredName && sliceName !== hoveredName);

  return (
    <g style={{ cursor: 'pointer' }}>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={isHighlighted ? Math.max(0, innerRadius - 3) : innerRadius}
        outerRadius={isHighlighted ? outerRadius + 7 : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        fillOpacity={isDimmed ? 0.28 : 1}
        cornerRadius={isHighlighted ? 6 : 3}
        stroke="#ffffff"
        strokeWidth={isHighlighted ? 2.5 : 1.5}
      />
      {isHighlighted && (
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 10}
          outerRadius={outerRadius + 13}
          fill={fill}
          cornerRadius={4}
        />
      )}
    </g>
  );
};

const createDonutLabelRenderer = (hoveredName, palette) => ({
  cx, cy, midAngle, outerRadius, percent, index, name, payload
}) => {
  if (!percent || percent <= 0) return null;
  const sliceName = payload?.name || name;
  const isHighlighted = Boolean(hoveredName && sliceName === hoveredName);
  const isDimmed = Boolean(hoveredName && sliceName !== hoveredName);
  const sliceColor = palette[index % palette.length];
  const edgeR = outerRadius + (isHighlighted ? 15 : 6);
  const labelR = outerRadius + (isHighlighted ? 26 : 19);
  const sx = cx + edgeR * Math.cos(-midAngle * PR);
  const sy = cy + edgeR * Math.sin(-midAngle * PR);
  const x = cx + labelR * Math.cos(-midAngle * PR);
  const y = cy + labelR * Math.sin(-midAngle * PR);
  const anchor = x > cx ? 'start' : 'end';

  return (
    <g style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.16s ease' }}>
      <line
        x1={sx}
        y1={sy}
        x2={x}
        y2={y}
        stroke={isHighlighted ? sliceColor : '#94a3b8'}
        strokeWidth={isHighlighted ? 1.8 : 1}
      />
      <text
        x={x + (anchor === 'start' ? 4 : -4)}
        y={y}
        fill={isHighlighted ? sliceColor : '#0f172a'}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={isHighlighted ? 12 : 10.5}
        fontWeight={900}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

function DonutCenterStat({ activeItem, total = 0, defaultLabel = 'Total', testId, compact = false }) {
  const displayCount = Number(activeItem ? activeItem.value : total || 0).toLocaleString('es-CO');
  return (
    <Box
      data-testid={testId}
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none'
      }}
    >
      <Box sx={{ textAlign: 'center', maxWidth: compact ? 86 : 104, px: 0.5 }}>
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: compact ? 18 : 22,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: activeItem ? activeItem.color : '#0f172a',
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.16s ease'
          }}
        >
          {displayCount}
        </Typography>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: compact ? 10 : 11,
            lineHeight: 1.2,
            color: activeItem ? '#334155' : '#64748b',
            mt: 0.25
          }}
          noWrap
        >
          {activeItem ? activeItem.name : defaultLabel}
        </Typography>
        {activeItem ? (
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              mt: 0.35,
              px: 0.75,
              py: 0.15,
              borderRadius: '999px',
              bgcolor: `${activeItem.color}18`,
              color: activeItem.color,
              fontSize: compact ? 10 : 10.5,
              fontWeight: 900,
              lineHeight: 1.2
            }}
          >
            {compact ? `${activeItem.pct}%` : `${activeItem.pct}% del total`}
          </Box>
        ) : (
          <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', mt: 0.2 }}>
            registros
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function InteractiveMetricRow({
  name,
  value,
  total,
  color,
  isHighlighted = false,
  isDimmed = false,
  onHoverStart,
  onHoverEnd,
  testId,
  showBar = true
}) {
  const numVal = Number(value || 0);
  const shareNum = total > 0 ? (numVal / total) * 100 : 0;
  const shareLabel = shareNum.toFixed(1);

  return (
    <Box
      role="button"
      tabIndex={0}
      data-testid={testId}
      data-active={isHighlighted ? 'true' : 'false'}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      sx={{
        px: 1.4,
        py: 1,
        borderRadius: '12px',
        cursor: 'pointer',
        userSelect: 'none',
        outline: 'none',
        bgcolor: isHighlighted ? '#ffffff' : 'rgba(248, 250, 252, 0.78)',
        border: isHighlighted
          ? `1.5px solid ${color}`
          : '1.5px solid rgba(226, 232, 240, 0.9)',
        boxShadow: isHighlighted ? `0 8px 20px ${color}28` : 'none',
        transform: isHighlighted ? 'translateX(4px)' : 'translateX(0)',
        opacity: isDimmed ? 0.46 : 1,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, background-color 0.18s ease'
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: isHighlighted ? 11 : 9,
              height: isHighlighted ? 11 : 9,
              borderRadius: '50%',
              bgcolor: color,
              boxShadow: isHighlighted ? `0 0 0 4px ${color}24` : 'none',
              flexShrink: 0,
              transition: 'all 0.16s ease'
            }}
          />
          <Typography
            sx={{
              fontSize: 12.5,
              color: isHighlighted ? '#0f172a' : '#475569',
              fontWeight: isHighlighted ? 800 : 600
            }}
            noWrap
          >
            {name}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 900,
              color: '#0f172a',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {numVal.toLocaleString('es-CO')}
          </Typography>
          <Box
            component="span"
            sx={{
              px: 0.8,
              py: 0.25,
              borderRadius: '8px',
              fontSize: 10.5,
              fontWeight: 800,
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
              bgcolor: isHighlighted ? color : `${color}16`,
              color: isHighlighted ? '#ffffff' : color,
              transition: 'background-color 0.16s ease, color 0.16s ease'
            }}
          >
            {shareLabel}%
          </Box>
        </Stack>
      </Stack>
      {showBar && (
        <Box sx={{ mt: 0.75, height: 4, borderRadius: '999px', bgcolor: '#e2e8f0', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${Math.max(2, Math.min(100, shareNum))}%`,
              borderRadius: '999px',
              bgcolor: color,
              opacity: isHighlighted ? 1 : 0.82,
              transition: 'width 0.45s ease, opacity 0.16s ease'
            }}
          />
        </Box>
      )}
    </Box>
  );
}

const createInteractiveYAxisTick = ({ hoveredName, accentColor, maxChars, fontSize, onHover }) => ({
  x = 0, y = 0, payload
}) => {
  const raw = String(payload?.value || '');
  const truncated = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw;
  const isActive = Boolean(hoveredName && raw === hoveredName);
  const isDimmed = Boolean(hoveredName && raw !== hoveredName);

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(raw)}
      onMouseLeave={() => onHover(null)}
    >
      <title>{raw}</title>
      <text
        x={-6}
        y={0}
        dy={4}
        textAnchor="end"
        fill={isActive ? accentColor : isDimmed ? '#94a3b8' : '#475569'}
        fontSize={fontSize}
        fontWeight={isActive ? 800 : 600}
        opacity={isDimmed ? 0.48 : 1}
      >
        {truncated}
      </text>
    </g>
  );
};

/* ── País row ───────────────────────────────────────────────────────────── */
function PaisRow({
  name,
  value,
  max,
  color,
  rank,
  total,
  isHighlighted = false,
  isDimmed = false,
  onHoverStart,
  onHoverEnd
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={{ xs: 0.9, sm: 1.4 }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      sx={{
        px: 1,
        py: 0.85,
        minWidth: 0,
        borderRadius: '10px',
        cursor: 'pointer',
        bgcolor: isHighlighted ? '#ffffff' : 'transparent',
        border: isHighlighted ? `1px solid ${color}66` : '1px solid transparent',
        boxShadow: isHighlighted ? `0 6px 16px ${color}20` : 'none',
        transform: isHighlighted ? 'translateX(3px)' : 'translateX(0)',
        opacity: isDimmed ? 0.52 : 1,
        transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background-color 0.16s ease, opacity 0.16s ease'
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          color: isHighlighted ? color : '#64748b',
          fontWeight: isHighlighted ? 900 : 700,
          width: 20,
          textAlign: 'right',
          flexShrink: 0
        }}
      >
        {rank}
      </Typography>
      <FlagSVG name={name} size={18} />
      <Typography
        sx={{
          fontSize: 12.5,
          color: isHighlighted ? '#0f172a' : '#1e293b',
          fontWeight: isHighlighted ? 800 : 600,
          flex: 1,
          minWidth: 0
        }}
        noWrap
      >
        {name}
      </Typography>
      <Box sx={{ width: { xs: 44, sm: 76, md: 90 }, height: isHighlighted ? 7 : 6, borderRadius: '999px', bgcolor: '#f1f5f9', flexShrink: 0, overflow: 'hidden', transition: 'height 0.16s ease' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: '999px', bgcolor: color, transition: 'width 0.45s ease' }} />
      </Box>
      <Typography sx={{ fontSize: 10.5, color: isHighlighted ? color : '#94a3b8', fontWeight: isHighlighted ? 800 : 600, width: { xs: 34, sm: 38 }, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {share}%
      </Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: '#0f172a', width: { xs: 42, sm: 50 }, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('es-CO')}
      </Typography>
    </Stack>
  );
}

/* ── ProgBar ────────────────────────────────────────────────────────────── */
function ProgBar({
  name,
  value,
  total,
  max,
  color,
  isHighlighted = false,
  isDimmed = false,
  onHoverStart,
  onHoverEnd
}) {
  const pct = Math.max(1, (value / (max || 1)) * 100);
  const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <Box
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      sx={{
        px: 1.1,
        py: 0.8,
        borderRadius: '10px',
        cursor: 'pointer',
        bgcolor: isHighlighted ? '#ffffff' : 'transparent',
        border: isHighlighted ? `1px solid ${color}66` : '1px solid transparent',
        boxShadow: isHighlighted ? `0 6px 16px ${color}20` : 'none',
        transform: isHighlighted ? 'translateX(3px)' : 'translateX(0)',
        opacity: isDimmed ? 0.52 : 1,
        transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background-color 0.16s ease, opacity 0.16s ease'
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.45 }}>
        <Typography sx={{ fontSize: 11.8, color: isHighlighted ? '#0f172a' : '#475569', fontWeight: isHighlighted ? 800 : 600, flex: 1, minWidth: 0 }} noWrap>
          {name}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0, pl: 1 }}>
          <Typography sx={{ fontSize: 10.5, color: isHighlighted ? color : '#94a3b8', fontWeight: isHighlighted ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>
            {share}%
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#0f172a', width: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {value.toLocaleString('es-CO')}
          </Typography>
        </Stack>
      </Stack>
      <Box sx={{ height: isHighlighted ? 6.5 : 5, borderRadius: '999px', bgcolor: '#f1f5f9', overflow: 'hidden', transition: 'height 0.16s ease' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: '999px', bgcolor: color, transition: 'width 1.1s ease' }} />
      </Box>
    </Box>
  );
}

/* ── Card wrapper ───────────────────────────────────────────────────────── */
function Card({ children, delay, active, sx={} }) {
  return (
    <Fade in={active} timeout={400+delay}>
      <Paper elevation={0}
        sx={{ p:{ xs:2, sm:2.5, md:3 }, borderRadius:3.5, border:'1px solid rgba(219, 230, 245, 0.9)',
              bgcolor:'rgba(255, 255, 255, 0.78)', backdropFilter:'blur(4px)',
              boxShadow:'0 10px 28px rgba(15, 23, 42, 0.045)',
              overflow:'hidden', height:'100%', minWidth:0, ...sx }}>
        {children}
      </Paper>
    </Fade>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════════════════ */
const ChecklistFilter = React.memo(function ChecklistFilter({
  label,
  options = [],
  optionCounts = null,
  totalMasterCount = null,
  value = [],
  onChange,
  placeholder,
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [portalStyle, setPortalStyle] = useState({});
  const [maxBodyHeight, setMaxBodyHeight] = useState(238);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const brand = '#2563eb';
  const warnBrand = '#d97706';

  const selected = useMemo(
    () => (Array.isArray(value) ? value.map(String) : []),
    [value]
  );
  const baseValues = useMemo(
    () => options.map((item) => String(item)),
    [options]
  );
  const baseValueSet = useMemo(
    () => new Set(baseValues),
    [baseValues]
  );
  const isExplicitNone = selected.length === 1 && selected[0] === NONE_FILTER_VALUE;
  const extraSelected = useMemo(() => {
    if (isExplicitNone || selected.length === 0) return [];
    return selected.filter((item) => item !== NONE_FILTER_VALUE && !baseValueSet.has(item));
  }, [isExplicitNone, selected, baseValueSet]);

  const normalizedOptions = useMemo(() => ([
    ...baseValues.map((item) => ({
      value: item,
      label: item,
      unavailable: false,
      count: optionCounts && Object.prototype.hasOwnProperty.call(optionCounts, item)
        ? Number(optionCounts[item] || 0)
        : null
    })),
    ...extraSelected.map((item) => ({
      value: item,
      label: item,
      unavailable: true,
      count: 0
    }))
  ]), [baseValues, extraSelected, optionCounts]);

  const isAllSelected = !isExplicitNone && extraSelected.length === 0 && (
    selected.length === 0 || (baseValues.length > 0 && baseValues.every((item) => selected.includes(item)))
  );
  const isPartial = !isAllSelected && !isExplicitNone;
  const isReduced = Boolean(totalMasterCount && totalMasterCount > 0 && baseValues.length < totalMasterCount);

  const selectedSet = useMemo(() => {
    if (isAllSelected) return new Set(baseValues);
    if (isExplicitNone) return new Set();
    return new Set(selected);
  }, [isAllSelected, isExplicitNone, baseValues, selected]);

  const filtered = useMemo(() => {
    const term = normalizeSearchText(search);
    if (!term) return normalizedOptions;
    return normalizedOptions.filter((item) => normalizeSearchText(item.label).includes(term));
  }, [normalizedOptions, search]);

  const computePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const width = Math.min(Math.max(rect.width, 280), Math.max(220, viewportWidth - 16));
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const openUpward = spaceBelow < 240 && spaceAbove > spaceBelow;
    const availableHeight = openUpward ? spaceAbove : spaceBelow;

    setMaxBodyHeight(Math.max(140, Math.min(240, availableHeight - 120)));
    setPortalStyle(
      openUpward
        ? { position: 'fixed', left, width, bottom: viewportHeight - rect.top + 6, zIndex: 1600 }
        : { position: 'fixed', left, width, top: rect.bottom + 6, zIndex: 1600 }
    );
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
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  const toggle = (option) => {
    if (isAllSelected) {
      const next = baseValues.filter((item) => item !== option);
      onChange(next.length > 0 ? next : [NONE_FILTER_VALUE]);
      return;
    }
    if (isExplicitNone) {
      onChange([option]);
      return;
    }
    const next = selectedSet.has(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];

    if (next.length === 0) {
      onChange([NONE_FILTER_VALUE]);
    } else if (
      baseValues.length > 0 &&
      next.every((item) => baseValueSet.has(item)) &&
      baseValues.every((item) => next.includes(item))
    ) {
      onChange([]);
    } else {
      onChange(next);
    }
  };

  const toggleAll = () => {
    if (isAllSelected) {
      onChange([NONE_FILTER_VALUE]);
    } else {
      onChange([]);
    }
  };

  const displayText = isAllSelected
    ? 'TODOS'
    : isExplicitNone
      ? 'Ninguno'
      : selectedSet.size === 1
        ? Array.from(selectedSet)[0]
        : `${selectedSet.size} seleccionados`;

  const triggerAccent = isExplicitNone ? warnBrand : brand;
  const triggerBg = isExplicitNone ? '#fff7ed' : isPartial ? '#eff6ff' : '#ffffff';
  const triggerBorder = isExplicitNone ? '#f59e0b' : isPartial ? brand : '#bfdbfe';
  const triggerTextColor = isExplicitNone ? '#92400e' : '#1e3a5f';

  const dropdown = open ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label={`Opciones de ${label}`}
      style={{
        ...portalStyle,
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 18px 42px rgba(15,23,42,.2)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden'
      }}
    >
      <style>{`.mov-filter-row:hover { background-color: #eff6ff !important; }`}</style>
      <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 8, padding: '6px 9px', border: '1px solid #cbd5e1' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={placeholder}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, color: '#1e293b', minWidth: 0 }}
          />
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={toggleAll}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleAll();
          }
        }}
        className="mov-filter-row"
        style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', userSelect: 'none' }}
      >
        <div
          style={{
            width: 15,
            height: 15,
            flexShrink: 0,
            borderRadius: 4,
            border: `2px solid ${isAllSelected || isPartial ? brand : '#cbd5e1'}`,
            background: isAllSelected ? brand : isPartial ? '#dbeafe' : '#fff',
            display: 'grid',
            placeItems: 'center'
          }}
        >
          {isAllSelected && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2"><polyline points="20 6 9 17 4 12"/></svg>
          )}
          {isPartial && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={brand} strokeWidth="3.2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: brand }}>
          {isAllSelected
            ? `DESELECCIONAR TODOS (${baseValues.length})`
            : `SELECCIONAR TODOS (${baseValues.length})`}
        </span>
      </div>
      <div onWheel={(event) => event.stopPropagation()} style={{ maxHeight: maxBodyHeight, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '14px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Sin resultados</div>
        ) : filtered.map((option) => {
          const isChecked = selectedSet.has(option.value);
          return (
            <div
              key={option.value}
              role="option"
              aria-selected={isChecked}
              onClick={() => toggle(option.value)}
              className="mov-filter-row"
              style={{
                padding: '7px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isChecked ? (option.unavailable ? '#fff7ed' : '#f8fbff') : 'transparent',
                userSelect: 'none'
              }}
            >
              <div
                style={{
                  width: 15,
                  height: 15,
                  flexShrink: 0,
                  borderRadius: 4,
                  border: `2px solid ${isChecked ? (option.unavailable ? warnBrand : brand) : '#cbd5e1'}`,
                  background: isChecked ? (option.unavailable ? warnBrand : brand) : '#fff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                {isChecked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span
                title={option.label}
                style={{
                  fontSize: 12,
                  color: option.unavailable ? '#9a3412' : '#1e293b',
                  fontWeight: isChecked ? 600 : 400,
                  fontStyle: option.unavailable ? 'italic' : 'normal',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {option.label}
              </span>
              {option.count !== null && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: option.unavailable ? '#fef2f2' : '#f1f5f9',
                    color: option.unavailable ? '#b91c1c' : '#475569',
                    flexShrink: 0
                  }}
                >
                  {option.count.toLocaleString('es-CO')}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
          {isAllSelected
            ? `${baseValues.length} opciones`
            : isExplicitNone
              ? `0 de ${baseValues.length} seleccionados`
              : `${selectedSet.size} de ${baseValues.length} seleccionados`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 10.5, fontWeight: 800, color: brand }}
          >
            Todos
          </button>
          <span style={{ fontSize: 10, color: '#cbd5e1' }}>|</span>
          <button
            type="button"
            onClick={() => onChange([NONE_FILTER_VALUE])}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 10.5, fontWeight: 800, color: '#64748b' }}
          >
            Ninguno
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <Box ref={triggerRef} sx={{ width: '100%', minWidth: 0, opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
        <Box
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={`Filtro ${label}: ${displayText}`}
          onClick={() => !disabled && setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              setOpen((current) => !current);
            }
          }}
          sx={{
            cursor: 'pointer',
            borderRadius: '12px',
            px: 1.6,
            py: 0.9,
            minHeight: 54,
            width: '100%',
            bgcolor: triggerBg,
            border: `1.5px solid ${triggerBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            userSelect: 'none',
            transition: 'border-color .15s, background-color .15s',
            '&:hover': { borderColor: triggerAccent }
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 9.5, fontWeight: 800, color: triggerAccent, letterSpacing: .7, textTransform: 'uppercase', lineHeight: 1.2 }}>
                {label}
              </Typography>
              {isReduced && (
                <Box
                  component="span"
                  data-testid={`filter-ratio-${label}`}
                  sx={{
                    px: 0.65,
                    py: 0.15,
                    borderRadius: '999px',
                    fontSize: 9,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    bgcolor: '#dbeafe',
                    color: '#1d4ed8',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {baseValues.length}/{totalMasterCount}
                </Box>
              )}
            </Stack>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: triggerTextColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', mt: 0.15 }}>
              {displayText}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
            {!isAllSelected && (
              <Box
                role="button"
                aria-label={`Restaurar ${label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange([]);
                }}
                sx={{ width: 17, height: 17, borderRadius: '50%', bgcolor: triggerAccent, display: 'grid', placeItems: 'center', '&:hover': { filter: 'brightness(0.92)' } }}
              >
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Box>
            )}
            <Box sx={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', display: 'grid', placeItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={triggerAccent} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </Box>
          </Stack>
        </Box>
      </Box>
      {dropdown}
    </>
  );
});

function HeatCell({ value, max, period, group, isHighlighted = false, isDimmed = false, onHoverStart, onHoverEnd }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = value > 0
    ? `linear-gradient(135deg, rgba(29,78,216,${0.12 + (intensity * 0.72)}), rgba(8,145,178,${0.08 + (intensity * 0.36)}))`
    : 'rgba(248, 250, 252, 0.75)';
  const border = isHighlighted
    ? C.blue
    : (value > 0 ? `rgba(29,78,216,${0.12 + (intensity * 0.22)})` : '#e8eef8');
  const color = '#0f172a';

  return (
    <Tooltip title={`${group} / ${period}: ${value.toLocaleString('es-CO')} movilidades`} arrow>
      <Box
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        sx={{
          minWidth: { xs: 64, md: 74 },
          height: { xs: 50, md: 58 },
          borderRadius: '10px',
          background: bg,
          border: `1px solid ${border}`,
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          boxShadow: isHighlighted
            ? `0 0 0 2px ${C.blue}, 0 10px 24px rgba(29, 78, 216, 0.22)`
            : (value > 0 ? `inset 0 -12px 28px rgba(15,23,42,${0.03 + (intensity * 0.04)})` : 'none'),
          transform: isHighlighted ? 'translateY(-2px) scale(1.03)' : 'none',
          opacity: isDimmed ? 0.62 : 1,
          transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease, opacity .18s ease',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: isHighlighted ? C.blue : (value > 0 ? `rgba(29,78,216,${0.35 + (intensity * 0.5)})` : '#e2e8f0')
          }
        }}
      >
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 900,
            color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
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
  const enqueueSnackbarRef = useRef(enqueueSnackbar);
  enqueueSnackbarRef.current = enqueueSnackbar;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const emptyFilters = useMemo(
    () => ({ periodo: [], alcance: [], direccion: [], tipo_persona: [], pais: [], programa: [] }),
    []
  );
  const [filters, setFilters] = useState(emptyFilters);

  const masterCatalogosRef = useRef({});
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  // Filtros locales para el gráfico de tendencia
  const [localDesdePeriodo, setLocalDesdePeriodo] = useState('');
  const [localHastaPeriodo, setLocalHastaPeriodo] = useState('');

  // Estados de hover bidireccional para gráficas y listas de datos
  const [hoveredAlcance, setHoveredAlcance] = useState(null);
  const [hoveredDireccion, setHoveredDireccion] = useState(null);
  const [hoveredPersona, setHoveredPersona] = useState(null);
  const [hoveredPais, setHoveredPais] = useState(null);
  const [hoveredActividad, setHoveredActividad] = useState(null);
  const [hoveredTipoMov, setHoveredTipoMov] = useState(null);
  const [hoveredModalidad, setHoveredModalidad] = useState(null);
  const [hoveredPrograma, setHoveredPrograma] = useState(null);
  const [hoveredHeat, setHoveredHeat] = useState(null);

  const hasExplicitNoneFilter = useMemo(
    () => Object.values(filters).some((value) => Array.isArray(value) && value.includes(NONE_FILTER_VALUE)),
    [filters]
  );

  const fetchDashboard = useCallback(async ({ forceRefresh = false } = {}) => {
    if (hasExplicitNoneFilter) {
      requestIdRef.current += 1;
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    if (!hasLoadedOnceRef.current) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value)))
      );
      if (forceRefresh) {
        activeFilters.force_refresh = '1';
      }

      const resData = await gestionInformacionService.getMovilidadDashboard(activeFilters);
      if (requestId !== requestIdRef.current) return;

      const payload = resData?.data || null;
      if (payload?.masterCatalogos) {
        masterCatalogosRef.current = payload.masterCatalogos;
      } else if (payload?.catalogos && !hasLoadedOnceRef.current) {
        masterCatalogosRef.current = payload.catalogos;
      }

      setData(payload);
      hasLoadedOnceRef.current = true;
      setReady(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error(err);
      enqueueSnackbarRef.current('Error cargando datos', { variant: 'error' });
    } finally {
      if (requestId === requestIdRef.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters, hasExplicitNoneFilter]);

  useEffect(() => {
    if (hasExplicitNoneFilter || !hasLoadedOnceRef.current) {
      fetchDashboard();
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchDashboard();
    }, 120);
    return () => clearTimeout(timer);
  }, [fetchDashboard, hasExplicitNoneFilter]);

  const setF = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setFilters(emptyFilters);
    setLocalDesdePeriodo('');
    setLocalHastaPeriodo('');
  }, [emptyFilters]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value))).length,
    [filters]
  );
  const hasFil = activeFilterCount > 0;

  const masterCat = useMemo(() => (
    data?.masterCatalogos || masterCatalogosRef.current || {}
  ), [data]);
  const cat = useMemo(() => (
    data?.catalogos || masterCat || {}
  ), [data, masterCat]);
  const catCounts = useMemo(() => (
    data?.catalogosCounts || {}
  ), [data]);

  const allPeriods = useMemo(() => cat.periodos || [], [cat.periodos]);
  const alcanceOptions = useMemo(() => cat.alcances || [], [cat.alcances]);
  const direccionOptions = useMemo(() => cat.direcciones || [], [cat.direcciones]);
  const tipoPersonaOptions = useMemo(() => cat.tiposPersona || [], [cat.tiposPersona]);
  const countryFilterOptions = useMemo(() => (cat.paises || []).slice(0, 80), [cat.paises]);
  const programaOptions = useMemo(() => cat.programas || [], [cat.programas]);

  useEffect(() => {
    if (localDesdePeriodo && !allPeriods.includes(localDesdePeriodo)) {
      setLocalDesdePeriodo('');
    }
    if (localHastaPeriodo && !allPeriods.includes(localHastaPeriodo)) {
      setLocalHastaPeriodo('');
    }
  }, [allPeriods, localDesdePeriodo, localHastaPeriodo]);

  const filterConfigs = useMemo(() => [
    {
      label: 'Programa o dependencia',
      key: 'programa',
      opts: programaOptions,
      counts: catCounts.programas || null,
      totalMaster: (masterCat.programas || []).length
    },
    {
      label: 'Período',
      key: 'periodo',
      opts: allPeriods,
      counts: catCounts.periodos || null,
      totalMaster: (masterCat.periodos || []).length
    },
    {
      label: 'Alcance',
      key: 'alcance',
      opts: alcanceOptions,
      counts: catCounts.alcances || null,
      totalMaster: (masterCat.alcances || []).length
    },
    {
      label: 'Dirección',
      key: 'direccion',
      opts: direccionOptions,
      counts: catCounts.direcciones || null,
      totalMaster: (masterCat.direcciones || []).length
    },
    {
      label: 'Tipo persona',
      key: 'tipo_persona',
      opts: tipoPersonaOptions,
      counts: catCounts.tiposPersona || null,
      totalMaster: (masterCat.tiposPersona || []).length
    },
    {
      label: 'País',
      key: 'pais',
      opts: countryFilterOptions,
      counts: catCounts.paises || null,
      totalMaster: (masterCat.paises || []).slice(0, 80).length
    }
  ], [
    programaOptions,
    allPeriods,
    alcanceOptions,
    direccionOptions,
    tipoPersonaOptions,
    countryFilterOptions,
    catCounts,
    masterCat
  ]);

  const activeFilterChips = useMemo(() => filterConfigs
    .filter(({ key }) => Array.isArray(filters[key]) && filters[key].length > 0)
    .map(({ label, key }) => {
      const vals = filters[key];
      const isNone = vals.length === 1 && vals[0] === NONE_FILTER_VALUE;
      const summary = isNone
        ? 'Ninguno'
        : vals.length === 1
          ? vals[0]
          : `${vals.length} seleccionados`;
      return { key, label, summary, isNone };
    }), [filterConfigs, filters]);

  const noneFilterLabels = useMemo(
    () => activeFilterChips.filter((chip) => chip.isNone).map((chip) => chip.label),
    [activeFilterChips]
  );

  const desdeOptions = allPeriods.filter((p) => !localHastaPeriodo || p <= localHastaPeriodo);
  const hastaOptions = allPeriods.filter((p) => !localDesdePeriodo || p >= localDesdePeriodo);

  /* ── derivados memoizados ───────────────────────────────────────────── */
  const salientes = useMemo(
    () => (data?.byDireccion || []).find((r) => /saliente/i.test(r.name))?.value || 0,
    [data]
  );
  const entrantes = useMemo(
    () => (data?.byDireccion || []).find((r) => /entrante/i.test(r.name))?.value || 0,
    [data]
  );
  const paises = useMemo(() => mergeCountryRows(data?.byPais || []), [data]);
  const paisesDestino = paises;
  const maxPais = paisesDestino[0]?.value || 1;

  // Datos históricos para el gráfico de tendencia
  const areaData = useMemo(() => {
    const allPeriodData = sortPer(data?.byPeriodo || []);
    let filtered = allPeriodData;
    if (localDesdePeriodo) {
      filtered = filtered.filter((r) => r.name >= localDesdePeriodo);
    }
    if (localHastaPeriodo) {
      filtered = filtered.filter((r) => r.name <= localHastaPeriodo);
    }
    return filtered.map((r) => ({ name: r.name, Movilidades: r.value }));
  }, [data, localDesdePeriodo, localHastaPeriodo]);

  const alcance = useMemo(() => data?.byAlcance || [], [data]);
  const direccion = useMemo(() => data?.byDireccion || [], [data]);
  const persona = useMemo(() => data?.byTipoPersona || [], [data]);
  const activ = useMemo(() => (data?.byActividad || []).slice(0, 10), [data]);
  const tipoMov = useMemo(
    () => mergeNamedRows(data?.byTipoMovilidad || [], normalizeMobilityType)
      .filter((r) => r.name !== 'Sin dato')
      .slice(0, 9),
    [data]
  );
  const modalidad = useMemo(
    () => (data?.byModalidad || []).filter((r) => r.name !== 'Sin dato').slice(0, 8),
    [data]
  );
  const programas = useMemo(() => (data?.byPrograma || []).slice(0, 10), [data]);

  const { heatPeriods, heatRows, heatMax, heatPeriodTotals, heatPeriodMax, heatTotal } = useMemo(() => {
    const heatSource = data?.heatmapPeriodoDireccion || {};
    const periods = sortPer(data?.byPeriodo || []).map((r) => r.name);
    const rows = Object.entries(heatSource)
      .map(([name, values]) => ({
        name,
        values: periods.map((period) => Number(values?.[period] || 0))
      }))
      .filter((row) => row.values.some(Boolean))
      .sort((a, b) => b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0));
    const maxVal = Math.max(1, ...rows.flatMap((row) => row.values));
    const periodTotals = periods.map((period, index) => ({
      period,
      value: rows.reduce((sum, row) => sum + (row.values[index] || 0), 0)
    }));
    const periodMax = Math.max(1, ...periodTotals.map((r) => r.value));
    const totalCount = rows.reduce((sum, row) => sum + row.values.reduce((rowSum, value) => rowSum + value, 0), 0);
    return {
      heatPeriods: periods,
      heatRows: rows,
      heatMax: maxVal,
      heatPeriodTotals: periodTotals,
      heatPeriodMax: periodMax,
      heatTotal: totalCount
    };
  }, [data]);

  const totalRecords = data?.total || 0;

  const findActiveMeta = useCallback((rows, hoveredName, palette, fallbackColor) => {
    if (!hoveredName || !rows.length) return null;
    const idx = rows.findIndex((r) => r.name === hoveredName);
    if (idx < 0) return null;
    const row = rows[idx];
    const pct = totalRecords > 0 ? ((Number(row.value || 0) / totalRecords) * 100).toFixed(1) : '0.0';
    return {
      name: row.name,
      label: row.name,
      value: Number(row.value || 0),
      pct,
      color: Array.isArray(palette) ? palette[idx % palette.length] : (fallbackColor || C.blue)
    };
  }, [totalRecords]);

  const activeAlcanceMeta = useMemo(
    () => findActiveMeta(alcance, hoveredAlcance, PAL, C.cyan),
    [findActiveMeta, alcance, hoveredAlcance]
  );
  const activePersonaMeta = useMemo(
    () => findActiveMeta(persona, hoveredPersona, PERSONA_PAL, C.amber),
    [findActiveMeta, persona, hoveredPersona]
  );
  const activeDireccionMeta = useMemo(
    () => findActiveMeta(direccion, hoveredDireccion, [C.emerald, C.violet], C.emerald),
    [findActiveMeta, direccion, hoveredDireccion]
  );
  const activeActividadMeta = useMemo(
    () => findActiveMeta(activ, hoveredActividad, null, C.indigo),
    [findActiveMeta, activ, hoveredActividad]
  );
  const activeModalidadMeta = useMemo(
    () => findActiveMeta(modalidad, hoveredModalidad, null, C.teal),
    [findActiveMeta, modalidad, hoveredModalidad]
  );
  const activeProgramaMeta = useMemo(
    () => findActiveMeta(programas, hoveredPrograma, null, C.cyan),
    [findActiveMeta, programas, hoveredPrograma]
  );

  const renderAlcanceSector = useMemo(() => createDonutSectorRenderer(hoveredAlcance), [hoveredAlcance]);
  const renderAlcanceLabel = useMemo(() => createDonutLabelRenderer(hoveredAlcance, PAL), [hoveredAlcance]);
  const renderPersonaSector = useMemo(() => createDonutSectorRenderer(hoveredPersona), [hoveredPersona]);

  const renderDireccionYAxisTick = useMemo(
    () => createInteractiveYAxisTick({
      hoveredName: hoveredDireccion,
      accentColor: activeDireccionMeta?.color || C.emerald,
      maxChars: 18,
      fontSize: isMobile ? 12 : 13.5,
      onHover: setHoveredDireccion
    }),
    [hoveredDireccion, activeDireccionMeta, isMobile]
  );
  const renderActividadYAxisTick = useMemo(
    () => createInteractiveYAxisTick({
      hoveredName: hoveredActividad,
      accentColor: C.indigo,
      maxChars: isMobile ? 16 : 26,
      fontSize: isMobile ? 10 : 10.5,
      onHover: setHoveredActividad
    }),
    [hoveredActividad, isMobile]
  );
  const renderModalidadYAxisTick = useMemo(
    () => createInteractiveYAxisTick({
      hoveredName: hoveredModalidad,
      accentColor: C.teal,
      maxChars: isMobile ? 15 : 22,
      fontSize: isMobile ? 10 : 10.5,
      onHover: setHoveredModalidad
    }),
    [hoveredModalidad, isMobile]
  );
  const renderProgramaYAxisTick = useMemo(
    () => createInteractiveYAxisTick({
      hoveredName: hoveredPrograma,
      accentColor: C.cyan,
      maxChars: isMobile ? 16 : 26,
      fontSize: isMobile ? 10 : 10.5,
      onHover: setHoveredPrograma
    }),
    [hoveredPrograma, isMobile]
  );

  const KPIS = [
    { icon:AutoGraphIcon,    label:'Total movilidades',        value:data?.total,    sub:'registros históricos',       bg:`linear-gradient(135deg,${C.blue},#1e40af)`,    sh:'rgba(29,78,216,.28)',   motion:'rise'    },
    { icon:PublicIcon,       label:'Países destino',           value:paises.length,  sub:'países únicos identificados', bg:`linear-gradient(135deg,${C.cyan},#0e7490)`,    sh:'rgba(8,145,178,.28)',   motion:'orbit'   },
    { icon:FlightTakeoffIcon,label:'Salientes',                value:salientes,      sub:'movilidades al exterior',    bg:`linear-gradient(135deg,${C.emerald},#047857)`, sh:'rgba(5,150,105,.28)',   motion:'takeoff' },
    { icon:FlightLandIcon,   label:'Entrantes',                value:entrantes,      sub:'movilidades recibidas',      bg:`linear-gradient(135deg,${C.violet},#6d28d9)`,  sh:'rgba(124,58,237,.28)',  motion:'landing' },
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 4,
        minHeight: 'calc(100vh - 110px)',
        p: { xs: 1.5, sm: 2, md: 2.5 },
        pb: 6,
        overflow: 'clip',
        background: 'linear-gradient(180deg, #f6faff 0%, #eef5ff 42%, #f8fbff 100%)',
        border: '1px solid #dce8f8',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)'
      }}
    >
      {/* ── Marca de agua institucional ORI ───────────────────────────── */}
      <Box
        aria-hidden="true"
        data-testid="movilidad-watermark-backdrop"
        sx={{
          position: 'sticky',
          top: { xs: 68, md: 76 },
          height: 0,
          overflow: 'visible',
          zIndex: 0,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: { xs: 'calc(100vh - 120px)', md: 'calc(100vh - 108px)' },
            minHeight: 540,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: { xs: 360, sm: 620, md: 820, lg: 960 },
              height: { xs: 360, sm: 620, md: 820, lg: 960 },
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.10) 0%, rgba(8,145,178,0.06) 38%, rgba(255,255,255,0) 70%)'
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: { xs: 300, sm: 520, md: 700, lg: 820 },
              height: { xs: 300, sm: 520, md: 700, lg: 820 },
              borderRadius: '50%',
              border: '1.5px dashed rgba(29, 78, 216, 0.11)'
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: { xs: 350, sm: 620, md: 820, lg: 950 },
              height: { xs: 350, sm: 620, md: 820, lg: 950 },
              borderRadius: '50%',
              border: '1px solid rgba(8, 145, 178, 0.08)'
            }}
          />
          <Box
            component="img"
            src="/internacionalizacion-mapa.png"
            alt=""
            sx={{
              position: 'relative',
              width: { xs: 280, sm: 480, md: 660, lg: 780, xl: 840 },
              maxWidth: '90%',
              height: 'auto',
              objectFit: 'contain',
              opacity: 0.24,
              mixBlendMode: 'multiply',
              filter: 'saturate(0.95) contrast(1.04)',
              WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 51%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 76%, rgba(0,0,0,0.82) 86%, rgba(0,0,0,0) 99%)',
              maskImage: 'radial-gradient(ellipse 50% 50% at 50% 51%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 76%, rgba(0,0,0,0.82) 86%, rgba(0,0,0,0) 99%)'
            }}
          />
        </Box>
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p:{ xs:1.3, sm:1.6 },
          mb:2,
          border:'1px solid rgba(219, 230, 245, 0.92)',
          borderRadius:2.5,
          bgcolor:'rgba(248, 251, 255, 0.84)',
          backdropFilter:'blur(8px)'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.2} flexWrap="wrap" gap={1}>
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
            <span>
              <IconButton size="small" onClick={() => fetchDashboard({ forceRefresh: true })} disabled={initialLoading || refreshing}>
                <RefreshIcon fontSize="small"/>
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      <InternacionalizacionNavSegment activeView="movilidad" onNavigateMovilidad={onBack} onNavigateConvenios={onNavigateConvenios}/>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p:{ xs:1.5, sm:1.8 },
          mb:{ xs:2.2, md:3 },
          border:'1px solid rgba(226, 232, 240, 0.9)',
          borderRadius:2.5,
          bgcolor:'rgba(255, 255, 255, 0.80)',
          backdropFilter:'blur(8px)',
          boxShadow:'0 6px 20px rgba(15, 23, 42, 0.035)',
          position:'relative',
          overflow:'hidden'
        }}
      >
        {refreshing && (
          <LinearProgress
            sx={{
              position:'absolute',
              top:0,
              left:0,
              right:0,
              height:2.5
            }}
          />
        )}
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap" gap={1} sx={{ mb:1.2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontSize:12, fontWeight:800, color:'#475569' }}>Filtros:</Typography>
            {activeFilterCount > 0 && (
              <Chip
                size="small"
                label={`${activeFilterCount} activo${activeFilterCount === 1 ? '' : 's'}`}
                sx={{ height:20, fontSize:10.5, fontWeight:800, bgcolor:'#eff6ff', color:C.blue, border:'1px solid #bfdbfe' }}
              />
            )}
          </Stack>
          {hasFil && (
            <Button
              size="small"
              variant="text"
              color="error"
              startIcon={<FilterAltOffIcon fontSize="small" />}
              onClick={reset}
              sx={{ fontSize:11.5, fontWeight:700, py:0.25, px:1, minHeight:28, textTransform:'none' }}
            >
              Limpiar filtros
            </Button>
          )}
        </Stack>
        <Box
          sx={{
            display:'grid',
            gridTemplateColumns:{
              xs:'1fr',
              sm:'repeat(2, minmax(0, 1fr))',
              md:'repeat(3, minmax(0, 1fr))'
            },
            gap:1.4,
            alignItems:'stretch'
          }}
        >
          {filterConfigs.map(({ label, key, opts, counts, totalMaster }) => (
            <ChecklistFilter
              key={key}
              label={label}
              options={opts}
              optionCounts={counts}
              totalMasterCount={totalMaster}
              value={filters[key]}
              onChange={(value) => setF(key, value)}
              placeholder={`Buscar ${label.toLowerCase()}...`}
            />
          ))}
        </Box>
        {activeFilterChips.length > 0 && (
          <Stack
            direction="row"
            spacing={0.8}
            flexWrap="wrap"
            alignItems="center"
            useFlexGap
            sx={{ mt: 1.4 }}
          >
            {activeFilterChips.map((chip) => (
              <Chip
                key={chip.key}
                size="small"
                label={`${chip.label}: ${chip.summary}`}
                onDelete={() => setF(chip.key, [])}
                sx={{
                  height: 24,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: chip.isNone ? '#fff7ed' : '#eff6ff',
                  color: chip.isNone ? '#9a3412' : '#1e40af',
                  border: `1px solid ${chip.isNone ? '#fdba74' : '#bfdbfe'}`,
                  '& .MuiChip-deleteIcon': {
                    fontSize: 15,
                    color: chip.isNone ? '#d97706' : '#3b82f6'
                  }
                }}
              />
            ))}
          </Stack>
        )}
      </Paper>

      {initialLoading && (
        <Box sx={{ py:12, textAlign:'center' }}>
          <CircularProgress size={48} thickness={3.5}/>
          <Typography sx={{ mt:2, color:'#94a3b8', fontSize:13 }}>Cargando datos…</Typography>
        </Box>
      )}

      {!initialLoading && hasExplicitNoneFilter && (
        <Alert
          severity="info"
          sx={{ borderRadius:2.5, alignItems:'center' }}
          action={(
            <Button size="small" variant="outlined" color="inherit" onClick={reset} sx={{ fontWeight:700, textTransform:'none' }}>
              Restaurar filtros (Todos)
            </Button>
          )}
        >
          {`Hay filtros sin opciones seleccionadas (${noneFilterLabels.join(', ')}). Marca al menos una opción o restaura todos los filtros para ver los indicadores.`}
        </Alert>
      )}

      {!initialLoading && !hasExplicitNoneFilter && data && data.total===0 && (
        <Alert
          severity="info"
          sx={{ borderRadius:2.5, alignItems:'center' }}
          action={hasFil ? (
            <Button size="small" variant="outlined" color="inherit" onClick={reset} sx={{ fontWeight:700, textTransform:'none' }}>
              Limpiar filtros
            </Button>
          ) : null}
        >
          No hay registros con los filtros seleccionados.
        </Alert>
      )}

      {!initialLoading && !hasExplicitNoneFilter && data && data.total>0 && (
        <Box sx={{ opacity: refreshing ? 0.88 : 1, transition: 'opacity .15s ease' }}>

          {/* ══ FILA 0: KPIs responsivos ═══════════════════════════════════ */}
          <Box
            sx={{
              display:'grid',
              gridTemplateColumns:{
                xs:'1fr',
                sm:'repeat(2, minmax(0, 1fr))',
                lg:'repeat(4, minmax(0, 1fr))'
              },
              gap:{ xs:1.5, sm:2, md:2.2 },
              mb:2.6
            }}
          >
            {KPIS.map((kpi,i)=>(
              <KPI key={i} {...kpi} delay={i*70} active={ready}/>
            ))}
          </Box>

          {/* ══ CUADRÍCULA 2 × n ══════════════════════════════════════════ */}
          {heatRows.length > 0 && (
            <Box sx={{ mb: 2.6 }}>
              <Card delay={160} active={ready}>
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
                      width: { xs: 96, sm: 132 },
                      height: 10,
                      borderRadius: 999,
                      background: `linear-gradient(90deg, rgba(29,78,216,.12), rgba(29,78,216,.58), ${C.blue})`,
                      border: '1px solid rgba(29,78,216,.12)'
                    }} />
                    <Typography sx={{ fontSize: 10.5, color: '#64748b', fontWeight: 800 }}>Mayor</Typography>
                  </Stack>
                </Stack>

                <Box
                  onMouseLeave={() => setHoveredHeat(null)}
                  sx={{ minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', pb: 0.5 }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: `minmax(108px, 150px) repeat(${heatPeriods.length}, minmax(64px, 1fr)) minmax(72px, 90px)`,
                        md: `minmax(130px, 170px) repeat(${heatPeriods.length}, minmax(74px, 1fr)) minmax(86px, 100px)`
                      },
                      gap: 0.9,
                      minWidth: (isMobile ? 210 : 270) + (heatPeriods.length * (isMobile ? 68 : 82)),
                      alignItems: 'center'
                    }}
                  >
                    <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>
                      {'Direcci\u00f3n'}
                    </Typography>
                    {heatPeriodTotals.map(({ period, value }) => {
                      const isColActive = Boolean(hoveredHeat && hoveredHeat.period === period);
                      return (
                        <Box
                          key={period}
                          sx={{
                            textAlign: 'center',
                            px: 0.5,
                            py: 0.45,
                            borderRadius: '8px',
                            bgcolor: isColActive ? 'rgba(29, 78, 216, 0.09)' : 'transparent',
                            transition: 'background-color 0.16s ease'
                          }}
                        >
                          <Typography sx={{ fontSize: 11, color: isColActive ? C.blue : '#475569', fontWeight: 900 }}>
                            {period}
                          </Typography>
                          <Box sx={{ height: 4, borderRadius: '999px', bgcolor: '#e2e8f0', mt: 0.8, overflow: 'hidden' }}>
                            <Box
                              sx={{
                                height: '100%',
                                width: `${Math.max(8, (value / heatPeriodMax) * 100)}%`,
                                bgcolor: C.blue,
                                borderRadius: '999px'
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: 10, color: isColActive ? C.blue : '#94a3b8', fontWeight: 800, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                            {value.toLocaleString('es-CO')}
                          </Typography>
                        </Box>
                      );
                    })}
                    <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 900, textAlign: 'right', textTransform: 'uppercase' }}>
                      Total
                    </Typography>

                    {heatRows.map((row, rowIndex) => {
                      const rowTotal = row.values.reduce((sum, value) => sum + value, 0);
                      const isRowActive = Boolean(hoveredHeat && hoveredHeat.row === row.name);
                      const isRowDimmed = Boolean(hoveredHeat && hoveredHeat.row !== row.name);
                      const rowColor = rowIndex === 0 ? C.emerald : C.violet;
                      return (
                        <React.Fragment key={row.name}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            onMouseEnter={() => setHoveredHeat({ row: row.name, period: null })}
                            onMouseLeave={() => setHoveredHeat(null)}
                            sx={{
                              minWidth: 0,
                              px: 0.9,
                              py: 0.65,
                              borderRadius: '10px',
                              cursor: 'pointer',
                              bgcolor: isRowActive ? `${rowColor}12` : 'transparent',
                              opacity: isRowDimmed ? 0.55 : 1,
                              transition: 'background-color 0.16s ease, opacity 0.16s ease'
                            }}
                          >
                            <Box
                              sx={{
                                width: isRowActive ? 12 : 10,
                                height: isRowActive ? 12 : 10,
                                borderRadius: '50%',
                                bgcolor: rowColor,
                                boxShadow: isRowActive ? `0 0 0 4px ${rowColor}22` : 'none',
                                flexShrink: 0,
                                transition: 'all 0.16s ease'
                              }}
                            />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 12.5, color: '#0f172a', fontWeight: 900 }} noWrap>
                                {row.name}
                              </Typography>
                              <Typography sx={{ fontSize: 10.5, color: isRowActive ? rowColor : '#94a3b8', fontWeight: 700 }}>
                                {heatTotal > 0 ? ((rowTotal / heatTotal) * 100).toFixed(1) : '0.0'}% del total
                              </Typography>
                            </Box>
                          </Stack>
                          {row.values.map((value, index) => {
                            const cellPeriod = heatPeriods[index];
                            const isCellHighlighted = Boolean(
                              hoveredHeat && hoveredHeat.row === row.name && (!hoveredHeat.period || hoveredHeat.period === cellPeriod)
                            );
                            const isCellDimmed = Boolean(
                              hoveredHeat && (
                                hoveredHeat.row !== row.name || (hoveredHeat.period && hoveredHeat.period !== cellPeriod)
                              )
                            );
                            return (
                              <HeatCell
                                key={`${row.name}-${cellPeriod}`}
                                value={value}
                                max={heatMax}
                                period={cellPeriod}
                                group={row.name}
                                isHighlighted={isCellHighlighted}
                                isDimmed={isCellDimmed}
                                onHoverStart={() => setHoveredHeat({ row: row.name, period: cellPeriod })}
                                onHoverEnd={() => setHoveredHeat(null)}
                              />
                            );
                          })}
                          <Box
                            sx={{
                              textAlign: 'right',
                              opacity: isRowDimmed ? 0.55 : 1,
                              transition: 'opacity 0.16s ease'
                            }}
                          >
                            <Typography sx={{ fontSize: 14, color: isRowActive ? rowColor : '#0f172a', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
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

          <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'minmax(0, 1fr)', lg:'repeat(2, minmax(0, 1fr))' }, gap:{ xs:2, md:2.6 }, alignItems:'start' }}>

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
                      minWidth: { xs: 92, sm: 105 },
                      flex: { xs: '1 1 92px', sm: '0 0 auto' },
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
                      minWidth: { xs: 92, sm: 105 },
                      flex: { xs: '1 1 92px', sm: '0 0 auto' },
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

              <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
                <AreaChart data={areaData} margin={{ top:16, right:isMobile ? 10 : 20, left:isMobile ? -12 : 0, bottom:20 }}>
                  <defs>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={.24}/>
                      <stop offset="95%" stopColor={C.blue} stopOpacity={.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize:isMobile ? 10 : 11, fill:'#64748b', fontWeight:700 }}
                    tickLine={false}
                    axisLine={{ stroke:'#e2e8f0' }}
                    tickMargin={12}
                    interval={isMobile ? 'preserveStartEnd' : 0}
                    minTickGap={8}
                    padding={{ left: isMobile ? 10 : 20, right: isMobile ? 10 : 20 }}
                  />
                  <YAxis tick={{ fontSize:10.5, fill:'#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <RT
                    content={<Tip total={totalRecords} accentColor={C.blue} />}
                    cursor={{ stroke: C.blue, strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  />
                  <Area type="linear" dataKey="Movilidades" stroke={C.blue} strokeWidth={2.5}
                    fill="url(#gB)"
                    dot={{ r:isMobile ? 3.5 : 4.5, fill:C.blue, stroke:'#fff', strokeWidth:2 }}
                    activeDot={{ r:7.5, fill:C.blue, stroke:'#dbeafe', strokeWidth:4 }}
                    isAnimationActive animationDuration={800}>
                    <LabelList dataKey="Movilidades" position="top" offset={10}
                      style={{ fontSize:isMobile ? 9 : 10, fontWeight:700, fill:'#475569' }}
                      formatter={v=>v.toLocaleString('es-CO')}/>
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* ── 2. Alcance donut ─────────────────────────────────────── */}
            <Card delay={280} active={ready}>
              <ST
                t="Alcance de movilidad"
                s="Nacional · Internacional · Regional"
                color={C.cyan}
                activeBadge={activeAlcanceMeta}
              />
              {alcance.length>0 && (
                <>
                  <Box sx={{ position:'relative', width:'100%', height:isMobile ? 255 : 284 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart
                        margin={{ top: 24, right: 28, bottom: 24, left: 28 }}
                        onMouseLeave={() => setHoveredAlcance(null)}
                      >
                        <Pie
                          data={alcance}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 46 : 56}
                          outerRadius={isMobile ? 66 : 78}
                          paddingAngle={4}
                          shape={renderAlcanceSector}
                          label={renderAlcanceLabel}
                          labelLine={false}
                          onMouseEnter={(entry) => setHoveredAlcance(entry?.name || entry?.payload?.name || null)}
                          onMouseLeave={() => setHoveredAlcance(null)}
                          isAnimationActive
                          animationBegin={100}
                          animationDuration={700}
                        >
                          {alcance.map((_,i)=><Cell key={i} fill={PAL[i%PAL.length]} stroke="none"/>)}
                        </Pie>
                        <RT content={<Tip total={totalRecords} accentColor={C.cyan} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <DonutCenterStat
                      activeItem={activeAlcanceMeta}
                      total={totalRecords}
                      defaultLabel="Total"
                      testId="alcance-donut-center"
                    />
                  </Box>
                  <Divider sx={{ my:1.5, borderStyle:'dashed' }}/>
                  <Stack spacing={1} onMouseLeave={() => setHoveredAlcance(null)}>
                    {alcance.map((r,i)=>{
                      const sliceColor = PAL[i%PAL.length];
                      const isHighlighted = hoveredAlcance === r.name;
                      const isDimmed = Boolean(hoveredAlcance && !isHighlighted);
                      return (
                        <InteractiveMetricRow
                          key={r.name}
                          name={r.name}
                          value={r.value}
                          total={totalRecords}
                          color={sliceColor}
                          isHighlighted={isHighlighted}
                          isDimmed={isDimmed}
                          onHoverStart={() => setHoveredAlcance(r.name)}
                          onHoverEnd={() => setHoveredAlcance(null)}
                          testId={`alcance-row-${r.name}`}
                        />
                      );
                    })}
                  </Stack>
                </>
              )}
            </Card>

            {/* ── 3. Dirección de movilidad ────────────────────────────── */}
            {direccion.length>0 && (
              <Card delay={360} active={ready}>
                <ST
                  t="Dirección de movilidad"
                  color={C.emerald}
                  activeBadge={activeDireccionMeta}
                />
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart
                    data={direccion}
                    layout="vertical"
                    margin={{ left:0, right:isMobile ? 54 : 72, top:8, bottom:8 }}
                    onMouseMove={(state) => {
                      if (state?.isTooltipActive && state?.activeLabel) {
                        setHoveredDireccion(String(state.activeLabel));
                      }
                    }}
                    onMouseLeave={() => setHoveredDireccion(null)}
                  >
                    <XAxis type="number" hide/>
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={isMobile ? 74 : 90}
                      axisLine={false}
                      tickLine={false}
                      tick={renderDireccionYAxisTick}
                    />
                    <RT
                      content={<Tip total={totalRecords} accentColor={activeDireccionMeta?.color || C.emerald} />}
                      cursor={{ fill:'rgba(15, 23, 42, 0.04)', radius:8 }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0,10,10,0]}
                      maxBarSize={46}
                      isAnimationActive
                      animationDuration={700}
                      onMouseEnter={(entry) => setHoveredDireccion(entry?.payload?.name || entry?.name || null)}
                      onMouseLeave={() => setHoveredDireccion(null)}
                    >
                      {direccion.map((r,i)=>{
                        const barColor = i===0?C.emerald:C.violet;
                        const isActive = hoveredDireccion === r.name;
                        const isDimmed = Boolean(hoveredDireccion && !isActive);
                        return (
                          <Cell
                            key={r.name}
                            fill={barColor}
                            fillOpacity={isDimmed ? 0.30 : 1}
                            stroke={isActive ? barColor : 'none'}
                            strokeWidth={isActive ? 2 : 0}
                            style={{ cursor:'pointer', transition:'fill-opacity 0.16s ease' }}
                          />
                        );
                      })}
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:isMobile ? 12 : 14, fontWeight:800, fill:'#0f172a' }}
                        formatter={v=>v.toLocaleString('es-CO')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <Divider sx={{ my:1.5, borderStyle:'dashed' }}/>
                <Box
                  onMouseLeave={() => setHoveredDireccion(null)}
                  sx={{
                    display:'grid',
                    gridTemplateColumns:{ xs:'1fr', sm:'repeat(2, minmax(0, 1fr))' },
                    gap:1.1
                  }}
                >
                  {direccion.map((r,i)=>{
                    const rowColor = i===0?C.emerald:C.violet;
                    const isHighlighted = hoveredDireccion === r.name;
                    const isDimmed = Boolean(hoveredDireccion && !isHighlighted);
                    return (
                      <InteractiveMetricRow
                        key={r.name}
                        name={r.name}
                        value={r.value}
                        total={totalRecords}
                        color={rowColor}
                        isHighlighted={isHighlighted}
                        isDimmed={isDimmed}
                        onHoverStart={() => setHoveredDireccion(r.name)}
                        onHoverEnd={() => setHoveredDireccion(null)}
                        testId={`direccion-row-${r.name}`}
                      />
                    );
                  })}
                </Box>
              </Card>
            )}

            {/* ── 4. Tipo de persona ───────────────────────────────────── */}
            {persona.length>0 && (
              <Card delay={440} active={ready}>
                <ST
                  t="Tipo de persona"
                  color={C.amber}
                  activeBadge={activePersonaMeta}
                />
                <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'220px minmax(0, 1fr)' }, gap:2.2, alignItems:'center' }}>
                  <Box sx={{ position:'relative', height:isMobile ? 210 : 230, minWidth:0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart
                        margin={{ top:16, right:16, bottom:16, left:16 }}
                        onMouseLeave={() => setHoveredPersona(null)}
                      >
                        <Pie
                          data={persona}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={70}
                          paddingAngle={4}
                          shape={renderPersonaSector}
                          label={false}
                          labelLine={false}
                          onMouseEnter={(entry) => setHoveredPersona(entry?.name || entry?.payload?.name || null)}
                          onMouseLeave={() => setHoveredPersona(null)}
                          isAnimationActive
                          animationDuration={700}
                        >
                          {persona.map((_,i)=>(
                            <Cell key={i} fill={PERSONA_PAL[i%PERSONA_PAL.length]} stroke="none"/>
                          ))}
                        </Pie>
                        <RT content={<Tip total={totalRecords} accentColor={C.amber} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <DonutCenterStat
                      activeItem={activePersonaMeta}
                      total={totalRecords}
                      defaultLabel="Total"
                      compact
                      testId="persona-donut-center"
                    />
                  </Box>
                  <Stack spacing={1} sx={{ minWidth:0 }} onMouseLeave={() => setHoveredPersona(null)}>
                    {persona.map((r,i)=>{
                      const rowColor = PERSONA_PAL[i%PERSONA_PAL.length];
                      const isHighlighted = hoveredPersona === r.name;
                      const isDimmed = Boolean(hoveredPersona && !isHighlighted);
                      return (
                        <InteractiveMetricRow
                          key={r.name}
                          name={r.name}
                          value={r.value}
                          total={totalRecords}
                          color={rowColor}
                          isHighlighted={isHighlighted}
                          isDimmed={isDimmed}
                          onHoverStart={() => setHoveredPersona(r.name)}
                          onHoverEnd={() => setHoveredPersona(null)}
                          testId={`persona-row-${r.name}`}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              </Card>
            )}

            {/* ── 5. Países destino · span 2 columnas ─────────────────────── */}
            {paisesDestino.length>0 && (
              <Box sx={{ gridColumn:'1 / -1', minWidth:0 }}>
                <Card delay={520} active={ready}>
                  <ST t={`Pa\u00edses destino (${paisesDestino.length})`}
                    s="Distribución porcentual del total de movilidades" color={C.emerald}/>
                  <Box
                    onMouseLeave={() => setHoveredPais(null)}
                    sx={{ display:'grid', gridTemplateColumns:{ xs:'minmax(0, 1fr)', lg:'repeat(2, minmax(0, 1fr))' }, columnGap:{ xs:0, lg:5 } }}
                  >
                    {paisesDestino.map((r,i)=>{
                      const isHighlighted = hoveredPais === r.name;
                      const isDimmed = Boolean(hoveredPais && !isHighlighted);
                      return (
                        <Box key={r.name} sx={{ minWidth:0 }}>
                          <PaisRow
                            name={r.name}
                            value={r.value}
                            max={maxPais}
                            color={PAL[i%PAL.length]}
                            rank={i+1}
                            total={totalRecords}
                            isHighlighted={isHighlighted}
                            isDimmed={isDimmed}
                            onHoverStart={() => setHoveredPais(r.name)}
                            onHoverEnd={() => setHoveredPais(null)}
                          />
                          <Divider sx={{ borderColor:'#f8fafc' }}/>
                        </Box>
                      );
                    })}
                  </Box>
                </Card>
              </Box>
            )}

            {/* ── 6. Actividades ───────────────────────────────────────── */}
            {activ.length>0 && (
              <Card delay={600} active={ready}>
                <ST
                  t="Actividades de movilidad"
                  s="Top 10 actividades más frecuentes"
                  color={C.indigo}
                  activeBadge={activeActividadMeta}
                />
                <ResponsiveContainer width="100%" height={isMobile ? 290 : 320}>
                  <BarChart
                    data={activ}
                    layout="vertical"
                    margin={{ left:isMobile ? 0 : 8, right:isMobile ? 46 : 62, top:4, bottom:4 }}
                    onMouseMove={(state) => {
                      if (state?.isTooltipActive && state?.activeLabel) {
                        setHoveredActividad(String(state.activeLabel));
                      }
                    }}
                    onMouseLeave={() => setHoveredActividad(null)}
                  >
                    <defs>
                      <linearGradient id="gInd" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.indigo}/>
                        <stop offset="100%" stopColor={C.violet}/>
                      </linearGradient>
                    </defs>
                    <XAxis type="number" tick={{ fontSize:10 }} axisLine={false} tickLine={false}
                      tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={isMobile ? 110 : 150}
                      axisLine={false}
                      tickLine={false}
                      tick={renderActividadYAxisTick}
                    />
                    <RT
                      content={<Tip total={totalRecords} accentColor={C.indigo} />}
                      cursor={{ fill:'rgba(79, 70, 229, 0.05)', radius:6 }}
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#gInd)"
                      radius={[0,8,8,0]}
                      isAnimationActive
                      animationDuration={750}
                      maxBarSize={26}
                      onMouseEnter={(entry) => setHoveredActividad(entry?.payload?.name || entry?.name || null)}
                      onMouseLeave={() => setHoveredActividad(null)}
                    >
                      {activ.map((r) => {
                        const isActive = hoveredActividad === r.name;
                        const isDimmed = Boolean(hoveredActividad && !isActive);
                        return (
                          <Cell
                            key={r.name}
                            fill="url(#gInd)"
                            fillOpacity={isDimmed ? 0.34 : 1}
                            stroke={isActive ? C.indigo : 'none'}
                            strokeWidth={isActive ? 1.5 : 0}
                            style={{ cursor:'pointer', transition:'fill-opacity 0.16s ease' }}
                          />
                        );
                      })}
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:isMobile ? 10 : 11, fontWeight:800, fill:'#0f172a' }}
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
                <Stack spacing={0.8} sx={{ mt:.5 }} onMouseLeave={() => setHoveredTipoMov(null)}>
                  {tipoMov.map((r,i)=>{
                    const isHighlighted = hoveredTipoMov === r.name;
                    const isDimmed = Boolean(hoveredTipoMov && !isHighlighted);
                    return (
                      <ProgBar
                        key={r.name}
                        name={r.name}
                        value={r.value}
                        total={totalRecords}
                        max={tipoMov[0]?.value||1}
                        color={PAL[i%PAL.length]}
                        isHighlighted={isHighlighted}
                        isDimmed={isDimmed}
                        onHoverStart={() => setHoveredTipoMov(r.name)}
                        onHoverEnd={() => setHoveredTipoMov(null)}
                      />
                    );
                  })}
                </Stack>
              </Card>
            )}

            {/* ── 8. Modalidad ─────────────────────────────────────────── */}
            {modalidad.length>0 && (
              <Card delay={760} active={ready}>
                <ST
                  t="Modalidad de movilidad"
                  color={C.teal}
                  activeBadge={activeModalidadMeta}
                />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={modalidad}
                    layout="vertical"
                    margin={{ left:isMobile ? 0 : 8, right:isMobile ? 46 : 60, top:4, bottom:4 }}
                    onMouseMove={(state) => {
                      if (state?.isTooltipActive && state?.activeLabel) {
                        setHoveredModalidad(String(state.activeLabel));
                      }
                    }}
                    onMouseLeave={() => setHoveredModalidad(null)}
                  >
                    <defs>
                      <linearGradient id="gT" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.teal}/>
                        <stop offset="100%" stopColor="#0e7490"/>
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide/>
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={isMobile ? 100 : 130}
                      axisLine={false}
                      tickLine={false}
                      tick={renderModalidadYAxisTick}
                    />
                    <RT
                      content={<Tip total={totalRecords} accentColor={C.teal} />}
                      cursor={{ fill:'rgba(13, 148, 136, 0.05)', radius:6 }}
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#gT)"
                      radius={[0,8,8,0]}
                      isAnimationActive
                      animationDuration={750}
                      maxBarSize={22}
                      onMouseEnter={(entry) => setHoveredModalidad(entry?.payload?.name || entry?.name || null)}
                      onMouseLeave={() => setHoveredModalidad(null)}
                    >
                      {modalidad.map((r) => {
                        const isActive = hoveredModalidad === r.name;
                        const isDimmed = Boolean(hoveredModalidad && !isActive);
                        return (
                          <Cell
                            key={r.name}
                            fill="url(#gT)"
                            fillOpacity={isDimmed ? 0.34 : 1}
                            stroke={isActive ? C.teal : 'none'}
                            strokeWidth={isActive ? 1.5 : 0}
                            style={{ cursor:'pointer', transition:'fill-opacity 0.16s ease' }}
                          />
                        );
                      })}
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:isMobile ? 10 : 11, fontWeight:800, fill:'#0f172a' }}
                        formatter={v=>v.toLocaleString('es-CO')}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* ── 9. Top programas ─────────────────────────────────────── */}
            {programas.length>0 && (
              <Card delay={840} active={ready}>
                <ST
                  t="Top programas y dependencias"
                  s="Mayor número de movilidades"
                  color={C.cyan}
                  activeBadge={activeProgramaMeta}
                />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={programas}
                    layout="vertical"
                    margin={{ left:isMobile ? 0 : 8, right:isMobile ? 46 : 60, top:4, bottom:4 }}
                    onMouseMove={(state) => {
                      if (state?.isTooltipActive && state?.activeLabel) {
                        setHoveredPrograma(String(state.activeLabel));
                      }
                    }}
                    onMouseLeave={() => setHoveredPrograma(null)}
                  >
                    <defs>
                      <linearGradient id="gC" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={C.cyan}/>
                        <stop offset="100%" stopColor="#0e7490"/>
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide/>
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={isMobile ? 110 : 150}
                      axisLine={false}
                      tickLine={false}
                      tick={renderProgramaYAxisTick}
                    />
                    <RT
                      content={<Tip total={totalRecords} accentColor={C.cyan} />}
                      cursor={{ fill:'rgba(8, 145, 178, 0.05)', radius:6 }}
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#gC)"
                      radius={[0,8,8,0]}
                      isAnimationActive
                      animationDuration={750}
                      maxBarSize={22}
                      onMouseEnter={(entry) => setHoveredPrograma(entry?.payload?.name || entry?.name || null)}
                      onMouseLeave={() => setHoveredPrograma(null)}
                    >
                      {programas.map((r) => {
                        const isActive = hoveredPrograma === r.name;
                        const isDimmed = Boolean(hoveredPrograma && !isActive);
                        return (
                          <Cell
                            key={r.name}
                            fill="url(#gC)"
                            fillOpacity={isDimmed ? 0.34 : 1}
                            stroke={isActive ? C.cyan : 'none'}
                            strokeWidth={isActive ? 1.5 : 0}
                            style={{ cursor:'pointer', transition:'fill-opacity 0.16s ease' }}
                          />
                        );
                      })}
                      <LabelList dataKey="value" position="right"
                        style={{ fontSize:isMobile ? 10 : 11, fontWeight:800, fill:'#0f172a' }}
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
    </Box>
  );
}

export default InternacionalizacionMovilidadDashboard;


