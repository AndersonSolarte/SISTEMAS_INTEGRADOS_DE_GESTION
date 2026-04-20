import React from 'react';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const COMPETENCIAS = [
  {
    key: 'lectura',
    labelS11: 'Lectura Crítica',
    labelSpr: 'Lectura Crítica',
    entrada: 'lectura_entrada',
    salida: 'lectura_salida',
    va: 'va_lectura'
  },
  {
    key: 'razonamiento',
    labelS11: 'Razonamiento Cuantitativo',
    labelSpr: 'Razonamiento Cuantitativo',
    entrada: 'razonamiento_entrada',
    salida: 'razonamiento_salida',
    va: 'va_razonamiento'
  },
  {
    key: 'ciudadanas',
    labelS11: 'Competencias Ciudadanas',
    labelSpr: 'Competencias Ciudadanas',
    entrada: 'ciudadanas_entrada',
    salida: 'ciudadanas_salida',
    va: 'va_ciudadanas'
  },
  {
    key: 'comunicacion',
    labelS11: 'Comunicación Escrita',
    labelSpr: 'Comunicación Escrita',
    entrada: 'comunicacion_entrada',
    salida: 'comunicacion_salida',
    va: 'va_comunicacion'
  },
  {
    key: 'ingles',
    labelS11: 'Inglés',
    labelSpr: 'Inglés',
    entrada: 'ingles_entrada',
    salida: 'ingles_salida',
    va: 'va_ingles'
  }
];

const pct = (v0_1) => {
  const n = Number(v0_1);
  if (!Number.isFinite(n)) return null;
  return n * 100;
};

const fmtPct = (val) => {
  if (val == null) return '—';
  return `${val.toFixed(2)}%`;
};

const fmtScore = (val) => {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  return Number(val).toFixed(2);
};

const sprPct = (salida) => {
  const n = Number(salida);
  if (!Number.isFinite(n)) return null;
  return (n / 300) * 100;
};

const vaCellSx = (va) => {
  if (va == null) return { color: '#64748b', background: '#f8fafc' };
  return va >= 0
    ? { color: '#16a34a', fontWeight: 900, background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)' }
    : { color: '#dc2626', fontWeight: 900, background: 'linear-gradient(135deg,#fee2e2,#fecaca)' };
};

const TD = ({ children, sx = {}, ...rest }) => (
  <Box
    component="td"
    sx={{ px: 1.5, py: 1.2, fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0', ...sx }}
    {...rest}
  >
    {children}
  </Box>
);

const TH = ({ children, sx = {}, ...rest }) => (
  <Box
    component="th"
    sx={{ px: 1.5, py: 1.2, fontSize: 11, fontWeight: 900, color: '#fff', textTransform: 'uppercase', textAlign: 'center', borderBottom: 'none', whiteSpace: 'nowrap', bgcolor: '#1e3a5f', ...sx }}
    {...rest}
  >
    {children}
  </Box>
);

export default function TablaComparativaEstudiante({ student, onClose }) {
  if (!student) return null;

  const hasS11 = COMPETENCIAS.some((c) => student[c.entrada] != null);

  const validEntradas = COMPETENCIAS.map((c) => pct(student[c.entrada])).filter((v) => v != null);
  const validSalidas = COMPETENCIAS.map((c) => sprPct(student[c.salida])).filter((v) => v != null);
  const validVas = COMPETENCIAS.map((c) => pct(student[c.va])).filter((v) => v != null);

  const promedioS11 = validEntradas.length ? validEntradas.reduce((a, b) => a + b, 0) / validEntradas.length : null;
  const promedioSpr = validSalidas.length ? validSalidas.reduce((a, b) => a + b, 0) / validSalidas.length : null;
  const promedioVa = pct(student.va_global) ?? (validVas.length ? validVas.reduce((a, b) => a + b, 0) / validVas.length : null);

  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: 3, border: '1px solid #bfdbfe', overflow: 'hidden', bgcolor: '#fff' }}
    >
      {/* Header */}
      <Box sx={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Tabla Comparativa Saber 11 vs Saber Pro
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', textTransform: 'uppercase', mt: 0.3, fontWeight: 600 }}>
            {String(student.nombre || student.documento || '').toUpperCase()}
            {student.programa ? ` · ${student.programa}` : ''}
            {student.anio ? ` · ${student.anio}` : ''}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Table */}
      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <Box component="thead">
            <Box component="tr">
              <TH colSpan={3} sx={{ borderRight: '3px solid #fff', fontSize: 13, py: 1.5 }}>
                Saber 11
              </TH>
              <TH colSpan={3} sx={{ borderRight: '3px solid #fff', fontSize: 13, py: 1.5 }}>
                Saber Pro
              </TH>
              <TH sx={{ fontSize: 13, py: 1.5, bgcolor: '#0f172a' }}>
                Resultado
              </TH>
            </Box>
            <Box component="tr" sx={{ bgcolor: '#2d4a6b' }}>
              <TH sx={{ textAlign: 'left', bgcolor: '#2d4a6b' }}>Competencia S11</TH>
              <TH sx={{ bgcolor: '#2d4a6b' }}>Puntaje</TH>
              <TH sx={{ borderRight: '3px solid #fff', bgcolor: '#2d4a6b' }}>%</TH>
              <TH sx={{ textAlign: 'left', bgcolor: '#2d4a6b' }}>Competencia SPR</TH>
              <TH sx={{ bgcolor: '#2d4a6b' }}>Puntaje</TH>
              <TH sx={{ borderRight: '3px solid #fff', bgcolor: '#2d4a6b' }}>%</TH>
              <TH sx={{ bgcolor: '#0f172a' }}>Valor Agregado</TH>
            </Box>
          </Box>
          <Box component="tbody">
            {COMPETENCIAS.map((c, idx) => {
              const entradaRaw = student[c.entrada];
              const salidaRaw = student[c.salida];
              const vaRaw = student[c.va];

              const s11Score = pct(entradaRaw);
              const s11PctVal = s11Score;
              const sprScore = salidaRaw != null && Number.isFinite(Number(salidaRaw)) ? Number(salidaRaw) : null;
              const sprPctVal = sprPct(salidaRaw);
              const vaVal = pct(vaRaw);

              const vaStyle = vaCellSx(vaVal);

              return (
                <Box
                  key={c.key}
                  component="tr"
                  sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8fafc', '&:hover': { bgcolor: '#eff6ff' } }}
                >
                  <TD sx={{ fontWeight: 700, color: '#0f172a', textAlign: 'left', color: '#0369a1' }}>
                    {c.labelS11}
                  </TD>
                  <TD sx={{ textAlign: 'center', color: '#0369a1', fontWeight: 700 }}>
                    {s11Score != null ? s11Score.toFixed(2) : '—'}
                  </TD>
                  <TD sx={{ textAlign: 'center', fontWeight: 800, color: '#0369a1', background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', borderRight: '3px solid #0369a1' }}>
                    {fmtPct(s11PctVal)}
                  </TD>
                  <TD sx={{ fontWeight: 700, color: '#0f172a', textAlign: 'left', color: '#15803d' }}>
                    {c.labelSpr}
                  </TD>
                  <TD sx={{ textAlign: 'center', color: '#15803d', fontWeight: 700 }}>
                    {sprScore != null ? sprScore.toFixed(0) : '—'}
                  </TD>
                  <TD sx={{ textAlign: 'center', fontWeight: 800, color: '#15803d', background: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', borderRight: '3px solid #0369a1' }}>
                    {fmtPct(sprPctVal)}
                  </TD>
                  <TD sx={{ textAlign: 'center', fontSize: 14, ...vaStyle }}>
                    {vaVal != null ? `${vaVal >= 0 ? '+' : ''}${vaVal.toFixed(2)}%` : 'N/A'}
                  </TD>
                </Box>
              );
            })}

            {/* Promedio row */}
            <Box component="tr" sx={{ background: 'linear-gradient(135deg, #1e3a5f, #0f172a)' }}>
              <Box component="td" colSpan={2} sx={{ px: 1.5, py: 1.6, fontSize: 13, fontWeight: 900, color: '#fff', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Promedio S11
              </Box>
              <Box component="td" sx={{ px: 1.5, py: 1.6, textAlign: 'center', fontSize: 14, fontWeight: 900, color: '#fff', borderRight: '3px solid rgba(255,255,255,0.4)' }}>
                {fmtPct(promedioS11)}
              </Box>
              <Box component="td" sx={{ px: 1.5, py: 1.6, fontSize: 13, fontWeight: 900, color: '#fff', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Promedio SPR
              </Box>
              <Box component="td" sx={{ px: 1.5, py: 1.6, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {student.puntaje_global != null ? Number(student.puntaje_global).toFixed(0) : '—'}
              </Box>
              <Box component="td" sx={{ px: 1.5, py: 1.6, textAlign: 'center', fontSize: 14, fontWeight: 900, color: '#fff', borderRight: '3px solid rgba(255,255,255,0.4)' }}>
                {fmtPct(promedioSpr)}
              </Box>
              <Box
                component="td"
                sx={{
                  px: 1.5, py: 1.6, textAlign: 'center', fontSize: 16, fontWeight: 900,
                  background: promedioVa == null ? 'rgba(255,255,255,0.1)' : promedioVa >= 0 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#dc2626,#ef4444)',
                  color: '#fff'
                }}
              >
                {promedioVa != null ? `${promedioVa >= 0 ? '+' : ''}${promedioVa.toFixed(2)}%` : '—'}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Nota fórmulas */}
      <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f0f7ff', borderTop: '1px solid #bfdbfe' }}>
        <Typography sx={{ fontSize: 11.5, color: '#1e40af', fontWeight: 600, lineHeight: 1.7 }}>
          <strong>📐 FÓRMULAS:</strong>
          {' '}% S11 = promedio ponderado de columnas equivalentes / 100 × 100
          {' · '}% SPR = puntaje módulo / 300 × 100
          {' · '}Valor Agregado = % SPR − % S11
          {!hasS11 && ' · ⚠️ Este estudiante no tiene registro Saber 11 para cruzar.'}
        </Typography>
      </Box>
    </Paper>
  );
}
