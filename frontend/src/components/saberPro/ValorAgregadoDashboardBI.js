import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';
import BadgeEstado from './valueAdded/BadgeEstado';
import CardKPI from './valueAdded/CardKPI';
import GraficoBar from './valueAdded/GraficoBar';
import ResumenCobertura from './valueAdded/ResumenCobertura';
import TablaDinamica from './valueAdded/TablaDinamica';

const BASE_FILTERS = { programas: [], anios: [], periodos: [], gruposReferencia: [] };
const SELECT_MENU_PROPS = { PaperProps: { style: { maxHeight: 360 } } };

const SPR_MODULE_ORDER = [
  { key: 'lectura_critica',           label: 'Lectura Crítica' },
  { key: 'razonamiento_cuantitativo', label: 'Razonamiento Cuantitativo' },
  { key: 'competencias_ciudadanas',   label: 'Competencias Ciudadanas' },
  { key: 'comunicacion_escrita',      label: 'Comunicación Escrita' },
  { key: 'ingles',                    label: 'Inglés' }
];

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const buildEmptyCoverage = () => ({
  total_estudiantes: 0,
  estudiantes_con_match: 0,
  porcentaje_cobertura: 0,
  estado_cobertura: 'CRITICO',
  etiqueta_cobertura: 'NO REPRESENTATIVO',
  es_valido_valor_agregado: false,
  mensaje_cobertura: 'Cobertura insuficiente'
});

function CoverageBlocked({ coverage }) {
  return (
    <Alert severity="warning" sx={{ borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 800 }}>Cobertura insuficiente para análisis</Typography>
      <Typography variant="body2">
        La cobertura actual es {formatNumber(coverage?.porcentaje_cobertura || 0)}%. El sistema bloquea visualizaciones hasta superar el 30%.
      </Typography>
    </Alert>
  );
}

function BoxplotCard({ boxplot }) {
  const items = [
    ['Min', boxplot?.min],
    ['Q1', boxplot?.q1],
    ['Mediana', boxplot?.mediana],
    ['Q3', boxplot?.q3],
    ['Max', boxplot?.max]
  ];
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', minHeight: 220 }}>
      <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5 }}>Boxplot VA Global</Typography>
      <Stack spacing={1}>
        {items.map(([label, value]) => (
          <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 0.5, borderBottom: '1px solid #eef2ff' }}>
            <Typography sx={{ color: '#64748b', fontWeight: 700 }}>{label}</Typography>
            <Typography sx={{ color: '#1e293b', fontWeight: 800 }}>{formatNumber(value, 3)}</Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function StudentGeneralCard({ row }) {
  if (!row) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #dbe6f5', textAlign: 'center', color: '#64748b' }}>
        Selecciona un estudiante para ver el resultado general.
      </Paper>
    );
  }

  const saber11Rows = [
    ['Lectura Critica', row.lectura_entrada, row.lectura_salida],
    ['Razonamiento', row.razonamiento_entrada, row.razonamiento_salida],
    ['Ciudadanas', row.ciudadanas_entrada, row.ciudadanas_salida],
    ['Comunicacion', row.comunicacion_entrada, row.comunicacion_salida],
    ['Ingles', row.ingles_entrada, row.ingles_salida]
  ];

  const finalPositive = Number(row.va_global || 0) >= 0;

  return (
    <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
      <Box sx={{ p: 2.4, color: '#fff', background: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)' }}>
        <Typography sx={{ fontSize: 24, fontWeight: 900 }}>Comparativa Saber 11 vs Saber Pro</Typography>
        <Typography sx={{ mt: 0.8, fontWeight: 800 }}>{row.nombre || row.documento}</Typography>
        <Typography sx={{ fontSize: 13, opacity: 0.92 }}>{row.programa || 'Sin programa'} · {row.anio || '—'}</Typography>
        <Typography sx={{ fontSize: 11, mt: 0.8, opacity: 0.85 }}>
          Documento: {row.documento || '—'} · Registro: {row.numero_registro || '—'}
        </Typography>
      </Box>

      <Grid container>
        <Grid item xs={12} md={6} sx={{ borderRight: { md: '1px solid #e2e8f0' } }}>
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 900, color: '#1d4ed8', mb: 1.2 }}>Saber 11</Typography>
            <Stack spacing={1}>
              {saber11Rows.map(([label, entrada, salida]) => {
                const va = salida == null || entrada == null ? null : Number(salida) - Number(entrada);
                return (
                  <Stack key={label} direction="row" justifyContent="space-between" sx={{ p: 1.2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography sx={{ fontWeight: 700, color: '#334155' }}>{label}</Typography>
                    <Stack direction="row" spacing={1.6}>
                      <Typography sx={{ color: '#2563eb', fontWeight: 800 }}>{formatNumber(entrada, 3)}</Typography>
                      <Typography sx={{ color: '#0f172a', fontWeight: 800 }}>{formatNumber(salida, 3)}</Typography>
                      <Typography sx={{ color: va >= 0 ? '#10b981' : '#ef4444', fontWeight: 900 }}>{formatNumber(va, 3)}</Typography>
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 900, color: '#1d4ed8', mb: 1.2 }}>Resultado General</Typography>
            <Grid container spacing={1.2}>
              <Grid item xs={12} sm={6}>
                <CardKPI label="Lectura Salida" value={formatNumber(row.lectura_salida, 3)} tone="#2563eb" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <CardKPI label="Razonamiento Salida" value={formatNumber(row.razonamiento_salida, 3)} tone="#2563eb" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <CardKPI label="Ciudadanas Salida" value={formatNumber(row.ciudadanas_salida, 3)} tone="#2563eb" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <CardKPI label="Comunicacion Salida" value={formatNumber(row.comunicacion_salida, 3)} tone="#2563eb" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <CardKPI label="Ingles Salida" value={formatNumber(row.ingles_salida, 3)} tone="#2563eb" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <CardKPI label="VA Global" value={formatNumber(row.va_global, 3)} tone={finalPositive ? '#10b981' : '#ef4444'} />
              </Grid>
            </Grid>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ p: 2.2, bgcolor: finalPositive ? '#ecfdf5' : '#fef2f2', borderTop: `2px solid ${finalPositive ? '#10b981' : '#ef4444'}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: finalPositive ? '#047857' : '#b91c1c', textTransform: 'uppercase' }}>
              Resultado Final
            </Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: finalPositive ? '#059669' : '#dc2626' }}>
              {finalPositive ? 'Valor Agregado Positivo' : 'Valor Agregado Negativo'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>
              Diferencia promedio entre salida Saber Pro y entrada Saber 11.
            </Typography>
          </Box>
          <Box sx={{ px: 2.4, py: 1.4, borderRadius: 3, bgcolor: '#fff', border: `1px solid ${finalPositive ? '#6ee7b7' : '#fca5a5'}` }}>
            <Typography sx={{ fontSize: 30, fontWeight: 900, color: finalPositive ? '#10b981' : '#ef4444' }}>
              {`${finalPositive ? '+' : ''}${formatNumber(Number(row.va_global || 0) * 100, 2)}%`}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

function ProgramAnalysisCard({ programRow, competencyRows, quintilMeta, yearLabel }) {
  if (!programRow) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #dbe6f5', textAlign: 'center', color: '#64748b' }}>
        Selecciona un programa para ver el análisis.
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
      <Box sx={{ p: 2.2, color: '#fff', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 24 }}>Analisis por Programa Academico</Typography>
            <Typography sx={{ fontSize: 13, opacity: 0.92 }}>{programRow.programa}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <CardKPI label="Año" value={yearLabel} tone="#fff" />
            <CardKPI label="Evaluados" value={programRow.estudiantes || 0} tone="#fff" />
            <CardKPI label="Quintil" value={programRow.quintil} tone={quintilMeta.color} />
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        <Grid container spacing={1.4}>
          {competencyRows.map((item) => (
            <Grid item xs={12} md={6} lg={2.4} key={item.key}>
              <CardKPI
                label={item.label}
                value={formatNumber(item.value, 1)}
                tone="#1d4ed8"
                helper={`${formatNumber(item.percent, 1)}%`}
              />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0.2 }}>
          <Grid item xs={12} lg={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 320 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1.2 }}>Comparativa de Puntajes</Typography>
              <Stack spacing={1.4}>
                {competencyRows.map((item) => (
                  <Box key={item.key}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 12, color: '#334155' }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#d97706' }}>{formatNumber(item.value, 1)}</Typography>
                    </Stack>
                    <Box sx={{ mt: 0.5, height: 10, borderRadius: 999, bgcolor: '#eef2ff', overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max(0, Math.min(100, item.percent))}%`, height: '100%', bgcolor: '#d97706', borderRadius: 999 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
              <Box sx={{ mt: 2, p: 1.4, borderRadius: 2, bgcolor: '#2563eb', color: '#fff' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800 }}>Promedio General</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{formatNumber(programRow.puntajeGeneral, 1)}</Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 320 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1.2 }}>Percentil por Competencia</Typography>
              <TablaDinamica
                columns={[
                  { key: 'label', label: 'Competencia' },
                  { key: 'percent', label: 'Porcentaje', render: (v) => `${formatNumber(v, 1)}%` },
                  { key: 'quintil', label: 'Quintil' }
                ]}
                rows={competencyRows.map((item) => ({
                  label: item.label,
                  percent: item.percent,
                  quintil: item.quintil
                }))}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 320 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1.2 }}>Distribución por Nivel</Typography>
              <Stack spacing={1.2}>
                {[
                  ['N1', 37, '#ef4444'],
                  ['N2', 45, '#f97316'],
                  ['N3', 17, '#d97706'],
                  ['N4', 1, '#22c55e']
                ].map(([label, value, color]) => (
                  <Box key={label}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 12 }}>{label}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color }}>{`${value}%`}</Typography>
                    </Stack>
                    <Box sx={{ mt: 0.4, height: 10, borderRadius: 999, bgcolor: '#eef2ff', overflow: 'hidden' }}>
                      <Box sx={{ width: `${value}%`, height: '100%', bgcolor: color, borderRadius: 999 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 3, border: '1px solid #fbbf24', background: 'linear-gradient(135deg, #fff7ed 0%, #eff6ff 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                Clasificación General
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#d97706' }}>
                {`${programRow.quintil} - ${quintilMeta.label}`}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <CardKPI label="Puntaje" value={formatNumber(programRow.puntajeGeneral, 1)} tone="#1d4ed8" />
              <CardKPI label="Percentil" value={`${formatNumber(programRow.percentilGeneral, 1)}%`} tone="#7c3aed" />
              <CardKPI label="Quintil" value={programRow.quintil} tone={quintilMeta.color} />
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Paper>
  );
}

function InstitutionalAnalysisCard({ summary, competencyRows, quintilMeta, yearLabel, coverage }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
      <Box sx={{ p: 2.2, color: '#fff', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 24 }}>Analisis Institucional Saber Pro</Typography>
            <Typography sx={{ fontSize: 13, opacity: 0.92 }}>Universidad CESMAG · Competencias Genericas</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <CardKPI label="Periodo" value={yearLabel} tone="#fff" />
            <CardKPI label="Evaluados" value={summary.evaluados} tone="#fff" />
            <CardKPI label="Programas" value={summary.programas} tone="#fff" />
            <CardKPI label="Quintil" value={summary.quintil} tone={quintilMeta.color} />
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        <Grid container spacing={1.4}>
          {competencyRows.map((item) => (
            <Grid item xs={12} md={6} lg={2.4} key={item.key}>
              <CardKPI label={item.label} value={formatNumber(item.value, 1)} tone="#1d4ed8" helper={`${formatNumber(item.percent, 1)}%`} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0.2 }}>
          <Grid item xs={12} lg={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 320 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1.2 }}>Comparativa de Puntajes</Typography>
              <Stack spacing={1.4}>
                {competencyRows.map((item) => (
                  <Box key={item.key}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 12, color: '#334155' }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#d97706' }}>{formatNumber(item.value, 1)}</Typography>
                    </Stack>
                    <Box sx={{ mt: 0.5, height: 10, borderRadius: 999, bgcolor: '#eef2ff', overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max(0, Math.min(100, item.percent))}%`, height: '100%', bgcolor: '#d97706', borderRadius: 999 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
              <Box sx={{ mt: 2, p: 1.4, borderRadius: 2, bgcolor: '#2563eb', color: '#fff' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800 }}>Promedio Institucional</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 900 }}>{formatNumber(summary.promedioInstitucional, 1)}</Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 320 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1.2 }}>Percentil por Competencia</Typography>
              <TablaDinamica
                columns={[
                  { key: 'label', label: 'Competencia' },
                  { key: 'percent', label: 'Percentil', render: (v) => `${formatNumber(v, 1)}%` },
                  { key: 'quintil', label: 'Quintil' }
                ]}
                rows={competencyRows.map((item) => ({ label: item.label, percent: item.percent, quintil: item.quintil }))}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 320 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1.2 }}>Distribución por Nivel</Typography>
              <Stack spacing={1.2}>
                {summary.niveles.map((item) => (
                  <Box key={item.label}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 12 }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: item.color }}>{`${item.value}%`}</Typography>
                    </Stack>
                    <Box sx={{ mt: 0.4, height: 10, borderRadius: 999, bgcolor: '#eef2ff', overflow: 'hidden' }}>
                      <Box sx={{ width: `${item.value}%`, height: '100%', bgcolor: item.color, borderRadius: 999 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 3, border: '1px solid #fbbf24', background: 'linear-gradient(135deg, #fff7ed 0%, #eff6ff 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                Clasificación Institucional
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#d97706' }}>
                {`${summary.quintil} - ${quintilMeta.label}`}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <CardKPI label="Puntaje" value={formatNumber(summary.promedioInstitucional, 1)} tone="#1d4ed8" />
              <CardKPI label="Percentil" value={`${formatNumber(summary.percentilInstitucional, 1)}%`} tone="#7c3aed" />
              <CardKPI label="Cobertura" value={`${formatNumber(coverage?.porcentaje_cobertura || 0, 1)}%`} tone="#d97706" />
              <CardKPI label="Quintil" value={summary.quintil} tone={quintilMeta.color} />
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Paper>
  );
}

// ── NBC professional design system ────────────────────────────────────────────
const QUINTIL_SCALE = {
  1: { color: '#DC2626', bg: '#FEF2F2', label: 'BAJO', labelEs: 'Bajo' },
  2: { color: '#EA580C', bg: '#FFF7ED', label: 'BÁSICO', labelEs: 'Básico' },
  3: { color: '#CA8A04', bg: '#FEFCE8', label: 'MEDIO', labelEs: 'Medio' },
  4: { color: '#16A34A', bg: '#F0FDF4', label: 'ALTO', labelEs: 'Alto' },
  5: { color: '#059669', bg: '#ECFDF5', label: 'SUPERIOR', labelEs: 'Superior' }
};
const qScale = (q) => {
  const n = Number(String(q || '').replace('Q', ''));
  return QUINTIL_SCALE[n] || QUINTIL_SCALE[3];
};

function NbcHeaderBadge({ label, value, bgColor = 'rgba(255,255,255,0.12)' }) {
  return (
    <Box sx={{ bgcolor: bgColor, px: 2.5, py: 1.5, borderRadius: '12px', textAlign: 'center', minWidth: 80 }}>
      <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '9px', letterSpacing: '1px', fontWeight: 600, mb: 0.2 }}>{label}</Typography>
      <Typography sx={{ color: '#fff', fontSize: '22px', fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  );
}

function KpiDetailCard({ icon, label, value, subtitle, percent, quintil, color }) {
  return (
    <Paper elevation={0} sx={{
      p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', borderTop: `4px solid ${color}`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' },
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
    }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box sx={{ color, display: 'flex', flexShrink: 0 }}>{icon}</Box>
        <Typography sx={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</Typography>
      </Stack>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '32px', fontWeight: 800, color: '#1e3a8a', lineHeight: 1 }}>{value}</Typography>
        <Typography sx={{ fontSize: '11px', color: '#64748b', mt: 0.5 }}>{subtitle}</Typography>
      </Box>
      <Box sx={{ mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color }}>↑ {formatNumber(percent, 1)}%</Typography>
          <Box sx={{ bgcolor: color, color: '#fff', px: 1.5, py: 0.4, borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>{quintil}</Box>
        </Stack>
        <Box sx={{ height: 6, bgcolor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.min(100, Math.max(0, percent))}%`, bgcolor: color, borderRadius: '3px' }} />
        </Box>
      </Box>
    </Paper>
  );
}

function DistribucionQuintilCard({ distribucion }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
        <Box sx={{ color: '#2563eb', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </Box>
        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', letterSpacing: '0.5px' }}>DISTRIBUCIÓN POR QUINTIL (PERCENTIL NACIONAL)</Typography>
      </Stack>
      <Stack spacing={1.8}>
        {distribucion.map(({ quintil, count, porcentaje }) => {
          const q = qScale(quintil);
          return (
            <Box key={quintil}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>{quintil} — {q.labelEs} ({`${quintil === 'Q1' ? '1-20%' : quintil === 'Q2' ? '21-40%' : quintil === 'Q3' ? '41-60%' : quintil === 'Q4' ? '61-80%' : '81-100%'}`})</Typography>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: q.color }}>
                  {formatNumber(porcentaje, 1)}%{' '}
                  <Typography component="span" sx={{ color: '#94a3b8', fontWeight: 500, fontSize: '11px' }}>({count})</Typography>
                </Typography>
              </Stack>
              <Box sx={{ height: 20, bgcolor: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${porcentaje}%`, background: `linear-gradient(90deg, ${q.color}, ${q.color}CC)`, borderRadius: '10px' }} />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}

function ResumenIndicadoresCard({ summary, distribucion }) {
  if (!summary) return null;
  const cPunt = qScale(summary.q_puntaje).color;
  const cNac = qScale(summary.q_nacional).color;
  const maxDist = Math.max(...(distribucion || []).map((d) => d.porcentaje), 10);
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ color: '#2563eb', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </Box>
        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', letterSpacing: '0.5px' }}>RESUMEN DE INDICADORES</Typography>
      </Stack>
      <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr', p: '10px 14px' }}>
          {['INDICADOR', 'VALOR', 'PORCENTAJE', 'QUINTIL'].map((h) => (
            <Typography key={h} sx={{ color: '#fff', fontSize: '10px', fontWeight: 600, textAlign: h === 'INDICADOR' ? 'left' : 'center' }}>{h}</Typography>
          ))}
        </Box>
        {[
          { label: 'Puntaje Global', val: `${formatNumber(summary.promedio_global, 1)} / 300`, pct: `${formatNumber(summary.pct_puntaje, 1)}%`, q: `Q${summary.q_puntaje}`, c: cPunt, bg: '#f8fafc' },
          { label: 'Percentil Nacional', val: formatNumber(summary.promedio_percentil, 1), pct: `${formatNumber(summary.promedio_percentil, 1)}%`, q: `Q${summary.q_nacional}`, c: cNac, bg: '#fff' }
        ].map(({ label, val, pct, q, c, bg }) => (
          <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr', p: '12px 14px', bgcolor: bg, borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 600 }}>{label}</Typography>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1e3a8a', textAlign: 'center' }}>{val}</Typography>
            <Typography sx={{ fontSize: '11px', textAlign: 'center' }}>{pct}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ bgcolor: c, color: '#fff', px: 1.5, py: 0.4, borderRadius: '14px', fontSize: '10px', fontWeight: 700 }}>{q}</Box>
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Box sx={{ color: '#2563eb', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </Box>
          <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1e3a8a' }}>COMPARATIVA VISUAL</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: 88, px: 1 }}>
          {(distribucion || []).map(({ quintil, porcentaje }) => {
            const q = qScale(quintil);
            const barH = Math.max(12, (porcentaje / maxDist) * 64);
            return (
              <Box key={quintil} sx={{ flex: 1, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: q.color, mb: 0.5 }}>{formatNumber(porcentaje, 0)}%</Typography>
                <Box sx={{ height: `${barH}px`, bgcolor: q.color, borderRadius: '6px 6px 0 0', mx: 'auto', width: '85%' }} />
                <Typography sx={{ fontSize: '9px', color: '#64748b', mt: 0.75, fontWeight: 600 }}>{quintil}</Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Paper>
  );
}

function ClasificacionBanner({ summary }) {
  if (!summary) return null;
  const q = qScale(summary.q_general);
  return (
    <Box sx={{ borderRadius: 3, p: 3, border: `2px solid ${q.color}`, background: `linear-gradient(135deg, ${q.color}12, ${q.color}22)` }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ color: q.color, display: 'flex', flexShrink: 0 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '10px', color: q.color, fontWeight: 700, letterSpacing: '1px', mb: 0.5 }}>CLASIFICACIÓN DEL GRUPO DE REFERENCIA</Typography>
            <Typography sx={{ fontSize: '28px', fontWeight: 900, color: q.color, lineHeight: 1.1 }}>QUINTIL {summary.q_general} — {summary.etiqueta}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {[['PUNTAJE', formatNumber(summary.promedio_global, 1), '#1e3a8a', false],
            ['P. NACIONAL', formatNumber(summary.promedio_percentil, 1), '#2563eb', false],
            ['QUINTIL', `Q${summary.q_general}`, q.color, true]].map(([lbl, val, clr, filled]) => (
            <Box key={lbl} sx={{ bgcolor: filled ? clr : '#fff', px: 2.5, py: 1.75, borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <Typography sx={{ fontSize: '9px', color: filled ? 'rgba(255,255,255,0.8)' : '#64748b', fontWeight: 600 }}>{lbl}</Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: filled ? '#fff' : clr, mt: 0.25 }}>{val}</Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

function EvolucionHistoricaCard({ historico }) {
  if (!historico || !historico.length) return null;
  const firstY = historico[0]?.anio;
  const lastY = historico[historico.length - 1]?.anio;
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
        <Box sx={{ color: '#2563eb', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </Box>
        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', letterSpacing: '0.5px' }}>
          EVOLUCIÓN HISTÓRICA ({firstY}–{lastY})
        </Typography>
      </Stack>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={historico.map((r) => ({ anio: r.anio, puntaje: Number(r.promedio_global || 0) }))} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip formatter={(value) => [formatNumber(value, 1), 'Puntaje Global']} />
              <Bar dataKey="puntaje" fill="#2563eb" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11, fontWeight: 700, fill: '#1e3a8a', formatter: (v) => formatNumber(v, 1) }} />
            </BarChart>
          </ResponsiveContainer>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 1.5, height: '100%' }}>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1e3a8a', mb: 1.5 }}>DETALLE POR AÑO</Typography>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', bgcolor: '#f1f5f9', p: '8px 10px' }}>
                {['AÑO', 'PUNT.', 'P.NAC', 'N'].map((h) => (
                  <Typography key={h} sx={{ fontSize: '9px', fontWeight: 600, color: '#64748b', textAlign: 'center' }}>{h}</Typography>
                ))}
              </Box>
              {historico.map((r, i) => (
                <Box key={r.anio} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', p: '8px 10px', bgcolor: i % 2 === 0 ? '#fff' : '#f8fafc', borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 600 }}>{r.anio}</Typography>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1e3a8a', textAlign: 'center' }}>{formatNumber(r.promedio_global, 1)}</Typography>
                  <Typography sx={{ fontSize: '10px', textAlign: 'center' }}>{formatNumber(r.promedio_percentil, 1)}</Typography>
                  <Typography sx={{ fontSize: '10px', color: '#64748b', textAlign: 'center' }}>{r.estudiantes}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid #e2e8f0' }}>
              {['PUNT. = Puntaje Global', 'P.NAC = Percentil Nacional', 'N = Estudiantes evaluados'].map((t) => (
                <Typography key={t} sx={{ fontSize: '9px', color: '#64748b' }}>{t}</Typography>
              ))}
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

function MetodologiaFooter() {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: '14px 20px', borderLeft: '4px solid #2563eb', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1} flexWrap="wrap">
        <Box>
          <Typography component="span" sx={{ fontSize: '9px', color: '#1e3a8a', fontWeight: 700, letterSpacing: '1px' }}>METODOLOGÍA: </Typography>
          <Typography component="span" sx={{ fontSize: '10px', color: '#64748b' }}>Q1 (≤20%) Bajo • Q2 (21-40%) Básico • Q3 (41-60%) Medio • Q4 (61-80%) Alto • Q5 ({'>'}{'>'}80%) Superior</Typography>
        </Box>
        <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>Quintil General = Promedio de Puntaje y P. Nacional</Typography>
      </Stack>
    </Box>
  );
}
// ── end NBC design system ──────────────────────────────────────────────────────

// ── SmartFilterPanel: checklist con búsqueda, select all y cascada ─────────────
function SmartFilterPanel({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter((opt) => String(opt).toLowerCase().includes(search.toLowerCase()));
  const allSelected = value.length === 0;
  const isSelected = (opt) => value.includes(opt);
  const toggle = (opt) => onChange(isSelected(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  const toggleAll = () => onChange(allSelected ? options : []);

  return (
    <Box ref={ref} sx={{ position: 'relative' }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: 'pointer', borderRadius: '10px', p: '10px 14px', minHeight: 52,
          bgcolor: value.length ? '#ede9fe' : '#fff',
          border: `1.5px solid ${value.length ? '#7c3aed' : '#e2e8f0'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1,
          transition: 'all 0.15s', userSelect: 'none',
          '&:hover': { borderColor: '#7c3aed', bgcolor: value.length ? '#e9d5ff' : '#faf8ff' }
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.8px', textTransform: 'uppercase', mb: 0.25 }}>{label}</Typography>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#312e81', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value.length ? `${value.length} seleccionado${value.length > 1 ? 's' : ''}` : 'Todos'}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
          {value.length > 0 && (
            <Box onClick={(e) => { e.stopPropagation(); onChange([]); }} sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#6d28d9' } }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Box>
          )}
          <Box sx={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </Box>
        </Stack>
      </Box>

      {open && (
        <Box sx={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1400, width: '100%', minWidth: 220, bgcolor: '#fff', borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.14)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <Box sx={{ p: 1.25, borderBottom: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f8fafc', borderRadius: '8px', px: 1.25, py: 0.75, border: '1px solid #e2e8f0' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, flex: 1, color: '#334155', minWidth: 0 }} />
            </Box>
          </Box>

          <Box onClick={toggleAll} sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #f1f5f9', '&:hover': { bgcolor: '#f5f3ff' } }}>
            <Box sx={{ width: 15, height: 15, flexShrink: 0, borderRadius: '4px', border: `2px solid ${allSelected ? '#7c3aed' : '#d1d5db'}`, bgcolor: allSelected ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {allSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>Seleccionar todos ({options.length})</Typography>
          </Box>

          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>Sin resultados</Typography>
              </Box>
            ) : filtered.map((opt) => (
              <Box key={String(opt)} onClick={() => toggle(opt)} sx={{ px: 1.5, py: 0.75, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, '&:hover': { bgcolor: '#f5f3ff' } }}>
                <Box sx={{ width: 15, height: 15, flexShrink: 0, borderRadius: '4px', border: `2px solid ${isSelected(opt) ? '#7c3aed' : '#d1d5db'}`, bgcolor: isSelected(opt) ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected(opt) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </Box>
                <Typography sx={{ fontSize: 12, color: '#334155' }}>{String(opt)}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ px: 1.5, py: 0.75, borderTop: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
            <Typography sx={{ fontSize: '10px', color: '#94a3b8' }}>
              {value.length > 0 ? `${value.length} de ${options.length} seleccionados` : `${options.length} opciones`}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
// ── end SmartFilterPanel ────────────────────────────────────────────────────────

const quintileLabel = (position, total) => {
  if (!total) return 'Q1';
  const ratio = (position + 1) / total;
  if (ratio <= 0.2) return 'Q5';
  if (ratio <= 0.4) return 'Q4';
  if (ratio <= 0.6) return 'Q3';
  if (ratio <= 0.8) return 'Q2';
  return 'Q1';
};

const quintileTone = (quintil) => {
  if (quintil === 'Q5') return { color: '#10b981', label: 'Superior' };
  if (quintil === 'Q4') return { color: '#22c55e', label: 'Alto' };
  if (quintil === 'Q3') return { color: '#d97706', label: 'Medio' };
  if (quintil === 'Q2') return { color: '#f97316', label: 'Basico' };
  return { color: '#ef4444', label: 'Bajo' };
};

function ValorAgregadoDashboardBI({ initialSection = 'va_individual' }) {
  const [catalogs, setCatalogs] = useState({ programas: [], anios: [], periodos: [], gruposReferencia: [] });
  const [filters, setFilters] = useState(BASE_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState(initialSection);
  const [searchDocumento, setSearchDocumento] = useState('');
  const [selectedDocumento, setSelectedDocumento] = useState('');
  const [selectedNbc, setSelectedNbc] = useState('');
  const [selectedPrograma, setSelectedPrograma] = useState('');
  const [payload, setPayload] = useState({ coverage: buildEmptyCoverage(), rows: [], summary: null, histogram: [], trendByYear: [], boxplot: null, statsRows: [] });
  const [nbcPayload, setNbcPayload] = useState({ total_estudiantes: 0, rows: [] });
  const [nbcDetalle, setNbcDetalle] = useState(null);
  const [nbcDetalleLoading, setNbcDetalleLoading] = useState(false);
  const [evolMode, setEvolMode] = useState('anual');
  const [rankingMode, setRankingMode] = useState('anual');
  const [programasPayload, setProgramasPayload] = useState({ total_estudiantes: 0, rows: [] });
  const [programaDetallePayload, setProgramaDetallePayload] = useState(null);
  const [programaDetalleLoading, setProgramaDetalleLoading] = useState(false);
  const [institucionalPayload, setInstitucionalPayload] = useState(null);
  const [institucionalLoading, setInstitucionalLoading] = useState(false);
  const [comparativaPayload, setComparativaPayload] = useState(null);
  const [comparativaLoading, setComparativaLoading] = useState(false);
  const [estudianteDetallePayload, setEstudianteDetallePayload] = useState(null);
  const [estudianteDetalleLoading, setEstudianteDetalleLoading] = useState(false);
  const [vaGeneralDocs, setVaGeneralDocs] = useState([]);
  const [vaGeneralDocsLoading, setVaGeneralDocsLoading] = useState(false);
  const vaSearchTimer = useRef(null);
  const [vaOnlyPositive, setVaOnlyPositive] = useState(false);
  const nbcFilters = useMemo(() => ({ ...filters, programas: [], gruposReferencia: [] }), [filters]);
  const catalogFilters = section === 'va_nbc' ? nbcFilters : filters;

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    let active = true;
    saberProAnalyticsService.getFiltrosCascade(catalogFilters)
      .then((response) => {
        if (!active) return;
        const data = response?.data || {};
        setCatalogs({
          programas: data.programas || [],
          anios: data.anios || [],
          periodos: data.periodos || [],
          gruposReferencia: data.gruposReferencia || []
        });
      })
      .catch(() => {
        if (!active) return;
      });
    return () => { active = false; };
  }, [catalogFilters]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        let response;
        if (section === 'va_individual') {
          response = await saberProAnalyticsService.getValueAddedIndividual({
            filters,
            pagination: { page: 1, pageSize: 100 },
            sort: [{ field: 'va_global', direction: 'desc' }]
          });
        } else if (section === 'va_general') {
          if (active) setVaGeneralDocsLoading(true);
          try {
            const r = await saberProAnalyticsService.getDocumentosEstudiantes(filters);
            if (active) setVaGeneralDocs(r?.data || []);
          } catch (e) {
            if (active) setVaGeneralDocs([]);
            console.error('Error documentos estudiantes:', e?.response?.data?.message || e?.message);
          } finally {
            if (active) setVaGeneralDocsLoading(false);
          }
          return;
        } else if (section === 'va_nbc') {
          const r = await saberProAnalyticsService.getResultadosNbc(nbcFilters);
          if (active) setNbcPayload(r?.data || { total_estudiantes: 0, rows: [] });
          return;
        } else if (section === 'va_programas') {
          const r = await saberProAnalyticsService.getResultadosProgramas(filters);
          if (active) setProgramasPayload(r?.data || { total_estudiantes: 0, rows: [] });
          return;
        } else if (section === 'va_institucional') {
          if (active) setInstitucionalLoading(true);
          const r = await saberProAnalyticsService.getResultadosInstitucional(filters);
          if (active) { setInstitucionalPayload(r?.data || null); setInstitucionalLoading(false); }
          return;
        } else if (section === 'va_estadistica') {
          if (active) setComparativaLoading(true);
          try {
            const r = await saberProAnalyticsService.getResultadosComparativaS11Spr(filters);
            if (active) setComparativaPayload(r?.data || null);
          } catch (e) {
            if (active) setComparativaPayload(null);
            console.error('Error comparativa S11 SPR:', e?.response?.data?.message || e?.message);
          } finally {
            if (active) setComparativaLoading(false);
          }
          return;
        }
        if (!active) return;
        setPayload(response?.data || { coverage: buildEmptyCoverage(), rows: [] });
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'No fue posible cargar el dashboard de valor agregado.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [filters, nbcFilters, section]);

  const coverage = payload.coverage || buildEmptyCoverage();
  const isBlocked = !coverage.es_valido_valor_agregado;

  const filteredIndividualRows = useMemo(() => {
    const rows = payload.rows || [];
    if (!searchDocumento.trim()) return rows;
    return rows.filter((row) => String(row.documento || '').includes(searchDocumento.trim()));
  }, [payload.rows, searchDocumento]);

  const documentOptions = useMemo(
    () => vaGeneralDocs.map((row) => ({
      documento: String(row.documento || ''),
      nombre: row.nombre || '',
      numero_registro: row.numero_registro || ''
    })),
    [vaGeneralDocs]
  );

  // Debounced search: re-fetch documents when user types in the search box
  const fetchDocsBySearch = useCallback((searchTerm) => {
    let active = true;
    setVaGeneralDocsLoading(true);
    saberProAnalyticsService.getDocumentosEstudiantes({ ...filters, search: searchTerm, onlyPositiveVa: vaOnlyPositive })
      .then((r) => { if (active) setVaGeneralDocs(r?.data || []); })
      .catch(() => { if (active) setVaGeneralDocs([]); })
      .finally(() => { if (active) setVaGeneralDocsLoading(false); });
    return () => { active = false; };
  }, [filters, vaOnlyPositive]);

  useEffect(() => {
    if (section !== 'va_general') return;
    fetchDocsBySearch('');
  }, [section, fetchDocsBySearch]);

  const selectedStudentRow = useMemo(
    () => (payload.rows || []).find((row) => String(row.documento || '') === String(selectedDocumento || '')) || null,
    [payload.rows, selectedDocumento]
  );

  const programOptions = useMemo(
    () => (programasPayload.rows || []).map((row) => row.programa).filter(Boolean),
    [programasPayload.rows]
  );

  useEffect(() => {
    if (section !== 'va_programas') return;
    const fromFilter = filters.programas?.[0] || '';
    const first = fromFilter || programOptions[0] || '';
    if (!selectedPrograma || !programOptions.includes(selectedPrograma)) {
      setSelectedPrograma(first);
    }
  }, [section, programOptions, selectedPrograma, filters.programas]);

  useEffect(() => {
    if (section !== 'va_general' || !selectedDocumento) {
      setEstudianteDetallePayload(null);
      return;
    }
    let active = true;
    setEstudianteDetalleLoading(true);
    saberProAnalyticsService.getComparativaEstudianteDetalle({ ...filters, documento: selectedDocumento })
      .then((r) => { if (active) setEstudianteDetallePayload(r?.data || null); })
      .catch(() => { if (active) setEstudianteDetallePayload(null); })
      .finally(() => { if (active) setEstudianteDetalleLoading(false); });
    return () => { active = false; };
  }, [section, selectedDocumento, filters]);

  useEffect(() => {
    if (section !== 'va_programas' || !selectedPrograma) return;
    let active = true;
    setProgramaDetalleLoading(true);
    saberProAnalyticsService.getResultadosProgramaDetalle({ programas: [selectedPrograma], anios: filters.anios, periodos: filters.periodos })
      .then((r) => { if (active) setProgramaDetallePayload(r?.data || null); })
      .catch(() => { if (active) setProgramaDetallePayload(null); })
      .finally(() => { if (active) setProgramaDetalleLoading(false); });
    return () => { active = false; };
  }, [section, selectedPrograma, filters.anios, filters.periodos]);

  const rankedProgramRows = useMemo(
    () => [...(payload.rows || [])]
      .sort((a, b) => Number(b.va_promedio || -999) - Number(a.va_promedio || -999))
      .map((row, index, arr) => {
        const quintil = quintileLabel(index, arr.length);
        return {
          ...row,
          quintil,
          quintilMeta: quintileTone(quintil),
          puntajeGeneral: Number((Number(row.va_promedio || 0) * 300).toFixed(1)),
          percentilGeneral: Number(row.porcentaje_mejora || 0)
        };
      }),
    [payload.rows]
  );

  const selectedProgramRow = useMemo(
    () => rankedProgramRows.find((row) => row.programa === selectedPrograma) || null,
    [rankedProgramRows, selectedPrograma]
  );

  const selectedProgramCompetencies = useMemo(() => {
    const rows = (payload.statsRows || []).filter((row) => row.programa === selectedPrograma);
    const specs = [
      ['razonamiento_salida', 'Razonamiento Cuantitativo'],
      ['lectura_salida', 'Lectura Critica'],
      ['comunicacion_salida', 'Comunicacion Escrita'],
      ['ciudadanas_salida', 'Competencias Ciudadanas'],
      ['ingles_salida', 'Ingles']
    ];
    return specs.map(([key, label]) => {
      const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
      const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const percent = avg * 100;
      return {
        key,
        label,
        value: avg * 300,
        percent,
        quintil: quintileLabel(Math.max(0, Math.floor((100 - percent) / 20)), 5)
      };
    });
  }, [payload.statsRows, selectedPrograma]);

  const nbcOptions = useMemo(
    () => (nbcPayload.rows || []).map((row) => row.grupo_referencia).filter(Boolean),
    [nbcPayload.rows]
  );

  useEffect(() => {
    if (section !== 'va_nbc') return;
    const fromFilter = filters.gruposReferencia?.[0] || '';
    const first = fromFilter || nbcOptions[0] || '';
    if (!selectedNbc || !nbcOptions.includes(selectedNbc)) {
      setSelectedNbc(first);
    }
  }, [filters.gruposReferencia, nbcOptions, section, selectedNbc]);

  useEffect(() => {
    if (section !== 'va_nbc' || !selectedNbc) {
      setNbcDetalle(null);
      return;
    }
    let active = true;
    setNbcDetalleLoading(true);
    saberProAnalyticsService.getResultadosNbcDetalle({ ...nbcFilters, gruposReferencia: [selectedNbc] })
      .then((r) => { if (active) setNbcDetalle(r?.data || null); })
      .catch(() => { if (active) setNbcDetalle(null); })
      .finally(() => { if (active) setNbcDetalleLoading(false); });
    return () => { active = false; };
  }, [nbcFilters, section, selectedNbc]);

  const rankedNbcRows = useMemo(
    () => [...(nbcPayload.rows || [])]
      .sort((a, b) => Number(b.promedio_global || -999) - Number(a.promedio_global || -999))
      .map((row, index, arr) => ({
        ...row,
        quintil: quintileLabel(index, arr.length),
        quintilMeta: quintileTone(quintileLabel(index, arr.length))
      })),
    [nbcPayload.rows]
  );

  const selectedRankedNbc = useMemo(
    () => rankedNbcRows.find((row) => row.grupo_referencia === selectedNbc) || null,
    [rankedNbcRows, selectedNbc]
  );

  const nbcDistribution = useMemo(() => {
    const base = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((q) => ({ quintil: q, total: 0 }));
    rankedNbcRows.forEach((row) => {
      const item = base.find((entry) => entry.quintil === row.quintil);
      if (item) item.total += 1;
    });
    const total = rankedNbcRows.length || 1;
    return base.map((item) => ({
      ...item,
      porcentaje: Number(((item.total * 100) / total).toFixed(1)),
      ...quintileTone(item.quintil)
    }));
  }, [rankedNbcRows]);

  const nbcHistoryByYear = useMemo(() => {
    const rows = (payload.statsRows || []).filter((row) => row.nucleo_basico_conocimiento === selectedNbc);
    const byYear = new Map();
    rows.forEach((row) => {
      const year = Number(row.anio);
      if (!Number.isFinite(year)) return;
      const current = byYear.get(year) || { anio: year, va: [], lectura: [], razonamiento: [], ciudadanas: [], ingles: [] };
      if (row.va_global != null) current.va.push(Number(row.va_global) * 100);
      if (row.lectura_entrada != null && row.lectura_salida != null) {
        current.lectura.push(Number(row.lectura_salida) * 100);
      }
      if (row.razonamiento_entrada != null && row.razonamiento_salida != null) {
        current.razonamiento.push(Number(row.razonamiento_salida) * 100);
      }
      if (row.ciudadanas_entrada != null && row.ciudadanas_salida != null) {
        current.ciudadanas.push(Number(row.ciudadanas_salida) * 100);
      }
      if (row.ingles_entrada != null && row.ingles_salida != null) {
        current.ingles.push(Number(row.ingles_salida) * 100);
      }
      byYear.set(year, current);
    });
    return [...byYear.values()]
      .sort((a, b) => a.anio - b.anio)
      .map((row) => ({
        anio: row.anio,
        va_promedio: row.va.length ? Number((row.va.reduce((s, v) => s + v, 0) / row.va.length).toFixed(2)) : 0,
        lectura: row.lectura.length ? Number((row.lectura.reduce((s, v) => s + v, 0) / row.lectura.length).toFixed(2)) : 0,
        razonamiento: row.razonamiento.length ? Number((row.razonamiento.reduce((s, v) => s + v, 0) / row.razonamiento.length).toFixed(2)) : 0,
        ciudadanas: row.ciudadanas.length ? Number((row.ciudadanas.reduce((s, v) => s + v, 0) / row.ciudadanas.length).toFixed(2)) : 0,
        ingles: row.ingles.length ? Number((row.ingles.reduce((s, v) => s + v, 0) / row.ingles.length).toFixed(2)) : 0,
        n: row.va.length
      }));
  }, [payload.statsRows, selectedNbc]);

  const individualColumns = useMemo(() => ([
    { key: 'documento', label: 'Documento' },
    { key: 'programa', label: 'Programa' },
    { key: 'va_global', label: 'VA Global', render: (v) => <span style={{ color: Number(v) >= 0 ? '#047857' : '#b91c1c', fontWeight: 800 }}>{formatNumber(v, 3)}</span> },
    { key: 'lectura_entrada', label: 'Lectura E', render: (v) => formatNumber(v, 3) },
    { key: 'lectura_salida', label: 'Lectura S', render: (v) => formatNumber(v, 3) },
    { key: 'va_lectura', label: 'VA Lectura', render: (v) => <span style={{ color: Number(v) >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{formatNumber(v, 3)}</span> },
    { key: 'razonamiento_entrada', label: 'Raz. E', render: (v) => formatNumber(v, 3) },
    { key: 'razonamiento_salida', label: 'Raz. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_razonamiento', label: 'VA Raz.', render: (v) => <span style={{ color: Number(v) >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{formatNumber(v, 3)}</span> },
    { key: 'ciudadanas_entrada', label: 'Ciud. E', render: (v) => formatNumber(v, 3) },
    { key: 'ciudadanas_salida', label: 'Ciud. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_ciudadanas', label: 'VA Ciud.', render: (v) => <span style={{ color: Number(v) >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{formatNumber(v, 3)}</span> },
    { key: 'comunicacion_entrada', label: 'Com. E', render: (v) => formatNumber(v, 3) },
    { key: 'comunicacion_salida', label: 'Com. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_comunicacion', label: 'VA Com.', render: (v) => <span style={{ color: Number(v) >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{formatNumber(v, 3)}</span> },
    { key: 'ingles_entrada', label: 'Ing. E', render: (v) => formatNumber(v, 3) },
    { key: 'ingles_salida', label: 'Ing. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_ingles', label: 'VA Ing.', render: (v) => <span style={{ color: Number(v) >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{formatNumber(v, 3)}</span> }
  ]), []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Stack spacing={2.2}>
        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 4, border: '1px solid #ddd6fe', background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 48%, #eff6ff 100%)' }}>
          <Stack spacing={1.8}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#312e81', letterSpacing: '-0.03em' }}>
                  Valor Agregado
                </Typography>
              </Box>
              <BadgeEstado estado={coverage.estado_cobertura} label={coverage.etiqueta_cobertura} />
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: section === 'va_nbc' ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)' }, gap: 1.5 }}>
              {section !== 'va_nbc' ? (
                <SmartFilterPanel label="Programas" options={catalogs.programas} value={filters.programas} onChange={(v) => setFilters((prev) => ({ ...prev, programas: v }))} />
              ) : null}
              <SmartFilterPanel label="Años" options={catalogs.anios} value={filters.anios} onChange={(v) => setFilters((prev) => ({ ...prev, anios: v }))} />
              <SmartFilterPanel label="Periodos" options={catalogs.periodos} value={filters.periodos} onChange={(v) => setFilters((prev) => ({ ...prev, periodos: v }))} />
              <SmartFilterPanel label="NBC / Grupo Referencia" options={catalogs.gruposReferencia} value={filters.gruposReferencia} onChange={(v) => setFilters((prev) => ({ ...prev, gruposReferencia: v }))} />
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {[
                ['va_individual', 'Individual'],
                ['va_general', 'General'],
                ['va_estadistica', 'Estadística'],
                ['va_nbc', 'NBC'],
                ['va_programas', 'Programas'],
                ['va_institucional', 'Institucional']
              ].map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  onClick={() => setSection(key)}
                  sx={{
                    bgcolor: section === key ? '#7c3aed' : '#fff',
                    color: section === key ? '#fff' : '#5b21b6',
                    border: '1px solid #ddd6fe',
                    fontWeight: 800,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: section === key ? '#6d28d9' : '#f5f3ff' }
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        {section === 'va_individual' ? (
          <ResumenCobertura coverage={coverage} />
        ) : null}

        {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
        {error ? <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert> : null}
        {section === 'va_individual' && isBlocked ? (
          <CoverageBlocked coverage={coverage} />
        ) : null}

        {section === 'va_individual' ? (
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <CardKPI label="Total Estudiantes" value={coverage.total_estudiantes} tone="#312e81" />
            </Grid>
            <Grid item xs={12} md={4}>
              <CardKPI label="Con Match" value={coverage.estudiantes_con_match} tone="#047857" />
            </Grid>
            <Grid item xs={12} md={4}>
              <CardKPI label="Cobertura" value={`${formatNumber(coverage.porcentaje_cobertura)}%`} tone="#7c3aed" helper={coverage.etiqueta_cobertura} />
            </Grid>
          </Grid>
        ) : null}

        {!isBlocked && section === 'va_individual' ? (
          <TablaDinamica columns={individualColumns} rows={filteredIndividualRows} search={searchDocumento} onSearchChange={setSearchDocumento} />
        ) : null}

        {section === 'va_general' ? (
          <Stack spacing={2}>
            {/* Filtro estratégico VA+ */}
            <Paper elevation={0} sx={{ p: '8px 14px', borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 1.5, alignSelf: 'flex-start' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', mr: 0.5 }}>
                Filtro estratégico
              </Typography>
              <Box sx={{ display: 'flex', bgcolor: '#e2e8f0', borderRadius: '20px', p: '3px', gap: '3px' }}>
                <Box
                  onClick={() => { if (vaOnlyPositive) { setVaOnlyPositive(false); setSelectedDocumento(''); } }}
                  sx={{
                    px: 2, py: 0.6, borderRadius: '16px', cursor: 'pointer', transition: 'all .15s',
                    bgcolor: !vaOnlyPositive ? '#fff' : 'transparent',
                    boxShadow: !vaOnlyPositive ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
                    color: !vaOnlyPositive ? '#0f172a' : '#94a3b8',
                    fontWeight: !vaOnlyPositive ? 800 : 600,
                    fontSize: 12,
                    userSelect: 'none',
                    '&:hover': { color: !vaOnlyPositive ? '#0f172a' : '#475569' }
                  }}
                >
                  Todos
                </Box>
                <Box
                  onClick={() => { if (!vaOnlyPositive) { setVaOnlyPositive(true); setSelectedDocumento(''); } }}
                  sx={{
                    px: 2, py: 0.6, borderRadius: '16px', cursor: 'pointer', transition: 'all .15s',
                    bgcolor: vaOnlyPositive ? '#10b981' : 'transparent',
                    boxShadow: vaOnlyPositive ? '0 1px 4px rgba(16,185,129,.35)' : 'none',
                    color: vaOnlyPositive ? '#fff' : '#94a3b8',
                    fontWeight: vaOnlyPositive ? 800 : 600,
                    fontSize: 12,
                    userSelect: 'none',
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    '&:hover': { color: vaOnlyPositive ? '#fff' : '#475569' }
                  }}
                >
                  {vaOnlyPositive && <span>✓</span>} Solo VA Positivo
                </Box>
              </Box>
              {vaOnlyPositive && (
                <Typography sx={{ fontSize: 11, color: '#059669', fontWeight: 600, ml: 0.5 }}>
                  — mostrando solo VA ≥ 0
                </Typography>
              )}
            </Paper>

            {/* Barra de búsqueda por cédula, nombre o EK */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5' }}>
              <Autocomplete
                size="small"
                options={documentOptions}
                getOptionLabel={(opt) => opt.documento
                  ? `${opt.documento}${opt.nombre ? ` · ${opt.nombre}` : ''}${opt.numero_registro ? ` · ${opt.numero_registro}` : ''}`
                  : ''}
                isOptionEqualToValue={(opt, val) => opt.documento === val.documento}
                value={documentOptions.find((d) => d.documento === selectedDocumento) || null}
                onChange={(_e, newVal) => setSelectedDocumento(newVal?.documento || '')}
                onInputChange={(_e, newInput, reason) => {
                  if (reason === 'reset') return;
                  clearTimeout(vaSearchTimer.current);
                  vaSearchTimer.current = setTimeout(() => fetchDocsBySearch(reason === 'clear' ? '' : newInput), 350);
                }}
                onOpen={() => { clearTimeout(vaSearchTimer.current); fetchDocsBySearch(''); }}
                loading={vaGeneralDocsLoading}
                filterOptions={(x) => x}
                noOptionsText="Sin resultados"
                loadingText="Buscando..."
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Buscar por cédula, nombre o EK (registro)"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8', fontSize: 18 }} /></InputAdornment>
                      ),
                      endAdornment: (
                        <>
                          {vaGeneralDocsLoading ? <CircularProgress color="inherit" size={14} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
                renderOption={(props, opt) => (
                  <Box component="li" {...props} key={opt.documento}>
                    <Stack>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{opt.documento}</Typography>
                      {opt.nombre && <Typography sx={{ fontSize: 11, color: '#64748b' }}>{opt.nombre}</Typography>}
                      {opt.numero_registro && <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>EK: {opt.numero_registro}</Typography>}
                    </Stack>
                  </Box>
                )}
              />
            </Paper>

            {/* Detalle estudiante */}
            {estudianteDetalleLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : !estudianteDetallePayload || estudianteDetallePayload.length === 0 ? (
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #dbe6f5', textAlign: 'center', color: '#64748b' }}>
                {selectedDocumento ? 'Sin datos Saber Pro para este estudiante con los filtros seleccionados.' : 'Selecciona un estudiante para ver el resultado general.'}
              </Paper>
            ) : (() => {
              const det = estudianteDetallePayload[0];
              const s11 = det.saber11 || {};
              const spr = det.saberPro || {};
              const equivalencias = det.equivalencias || {};
              const vaFinal = det.va_final;
              const vaPositive = vaFinal != null && vaFinal >= 0;
              const vaColor = vaPositive ? '#10b981' : '#ef4444';
              const vaBg = vaPositive ? '#ecfdf5' : '#fef2f2';
              const vaBorder = vaPositive ? '#6ee7b7' : '#fca5a5';
              const maxPts = spr.max_pts || 300;
              const sprLabel = det.is_tyt ? 'SABER TYT' : 'SABER PRO';

              const sprRows = [
                { key: 'lectura_critica',           label: 'Lectura Crítica',           score: spr.lectura },
                { key: 'razonamiento_cuantitativo', label: 'Razonamiento Cuantitativo', score: spr.razonamiento },
                { key: 'competencias_ciudadanas',   label: 'Competencias Ciudadanas',   score: spr.ciudadanas },
                { key: 'ingles',                    label: 'Inglés',                    score: spr.ingles },
                { key: 'comunicacion_escrita',      label: 'Comunicación Escrita',      score: spr.comunicacion }
              ];

              return (
                <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
                  {/* Header */}
                  <Box sx={{ p: { xs: 2.2, md: '20px 28px' }, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: '2px' }}>
                        COMPARATIVA SABER 11 VS {sprLabel} — RESULTADO GENERAL
                      </Typography>
                      <Stack direction="row" spacing={0.8}>
                        {det.is_tyt && <Chip size="small" label="TyT" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800 }} />}
                        {det.s11_tipo && <Chip size="small" label={det.s11_tipo.nombre} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 }} />}
                      </Stack>
                    </Stack>
                    <Typography sx={{ color: '#fff', fontSize: { xs: 18, md: 22 }, fontWeight: 900, lineHeight: 1.2, mt: 0.5 }}>
                      {det.nombre || det.documento}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={0.8} flexWrap="wrap">
                      <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{det.programa || '—'}</Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                        Año {sprLabel}: {det.anio || '—'}{det.periodo ? ` · Período: ${det.periodo}` : ''}
                        {det.s11_anio ? ` · Año S11: ${det.s11_anio}` : ''}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
                      Doc: {det.documento || '—'} · Reg: {det.numero_registro || '—'}
                    </Typography>
                  </Box>

                  {/* Tabla comparativa unificada */}
                  <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                    {/* Cabecera de tabla */}
                    <Box sx={{
                      display: 'grid', gridTemplateColumns: '200px 90px 1fr 80px',
                      bgcolor: '#1e3a8a', borderRadius: '8px 8px 0 0', px: 1.5, py: 1.2, gap: 0
                    }}>
                      {[
                        [`MÓDULO ${sprLabel}`, 'left'],
                        [`PUNTAJE (/${maxPts})`, 'center'],
                        [`EQUIVALENCIAS SABER 11 · Año ${det.s11_anio || '—'}${det.s11_tipo ? ' · ' + det.s11_tipo.nombre : ''}`, 'left'],
                        ['EQUIV.', 'center']
                      ].map(([txt, align], i) => (
                        <Typography key={i} sx={{ fontSize: 11, fontWeight: 800, color: i < 2 ? '#93c5fd' : '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.7px', textAlign: align, pl: i === 2 ? 1.5 : 0 }}>
                          {txt}
                        </Typography>
                      ))}
                    </Box>

                    {/* Filas por módulo */}
                    {SPR_MODULE_ORDER.map(({ key, label }, idx) => {
                      const sprScore = sprRows.find((r) => r.key === key)?.score ?? null;
                      const eq = equivalencias[key];
                      const eqScore = eq?.score ?? null;
                      return (
                        <Box key={key} sx={{
                          display: 'grid', gridTemplateColumns: '200px 90px 1fr 80px',
                          bgcolor: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                          borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                          borderBottom: '1px solid #e2e8f0', minHeight: 54, alignItems: 'center'
                        }}>
                          {/* Nombre módulo */}
                          <Box sx={{ px: 1.5, py: 1, borderRight: '1px solid #e2e8f0' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{label}</Typography>
                          </Box>
                          {/* Puntaje SPR */}
                          <Box sx={{ px: 1, py: 1, borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 900, color: sprScore != null ? '#0369a1' : '#cbd5e1' }}>
                              {formatNumber(sprScore, 1)}
                            </Typography>
                          </Box>
                          {/* Equivalencias S11 */}
                          <Box sx={{ px: 1.5, py: 1, borderRight: '1px solid #e2e8f0' }}>
                            {det.s11_tiene_datos && eq ? (
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                {eq.s11_cols.map((col) => (
                                  <Chip key={col.col} size="small"
                                    label={`${col.label}: ${col.score != null ? formatNumber(col.score, 1) : '—'}`}
                                    sx={{
                                      height: 24, fontSize: 11, fontWeight: 700,
                                      bgcolor: col.score != null ? '#eff6ff' : '#f1f5f9',
                                      color: col.score != null ? '#1d4ed8' : '#94a3b8',
                                      border: col.score != null ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                                    }} />
                                ))}
                              </Stack>
                            ) : (
                              <Typography sx={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Sin datos S11</Typography>
                            )}
                          </Box>
                          {/* Score equivalente */}
                          <Box sx={{ px: 1, py: 1, textAlign: 'center' }}>
                            <Typography sx={{ fontSize: 18, fontWeight: 900, color: eqScore != null ? '#1d4ed8' : '#cbd5e1' }}>
                              {eqScore != null ? formatNumber(eqScore, 1) : '—'}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}

                    {/* Resumen alineado con columnas de tabla */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '200px 90px 1fr 80px', borderTop: '2px solid #1e3a8a', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                      {/* Cabecera resumen SPR */}
                      <Box sx={{ gridColumn: '1 / span 2', px: 1.5, py: 0.8, bgcolor: '#0c4a6e', display: 'flex', alignItems: 'center', gap: 1, borderRight: '2px solid #7dd3fc' }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#38bdf8' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#e0f2fe', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                          {sprLabel} · Año {det.anio} · P{det.periodo}
                        </Typography>
                      </Box>
                      {/* Cabecera resumen S11 */}
                      <Box sx={{ gridColumn: '3 / span 2', px: 1.5, py: 0.8, bgcolor: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#818cf8' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                          SABER 11 · Año {det.s11_anio || '—'} · Equivalencias
                        </Typography>
                      </Box>
                      {/* Fila: Fórmula SPR | Promedio S11 */}
                      <Box sx={{ px: 1.5, py: 1, bgcolor: '#f0f9ff', borderRight: '1px solid #bae6fd', borderTop: '1px solid #e2e8f0' }}>
                        <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Fórmula (Σn/n)</Typography>
                      </Box>
                      <Box sx={{ px: 1, py: 1, bgcolor: '#f0f9ff', textAlign: 'center', borderRight: '2px solid #7dd3fc', borderTop: '1px solid #e2e8f0' }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#0369a1' }}>{formatNumber(spr.formula, 2)}</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1, bgcolor: '#eef2ff', borderRight: '1px solid #c7d2fe', borderTop: '1px solid #e2e8f0' }}>
                        <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Promedio Equiv. S11</Typography>
                      </Box>
                      <Box sx={{ px: 1, py: 1, bgcolor: '#eef2ff', textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#1d4ed8' }}>{formatNumber(s11.resultado_ponderado, 2)}</Typography>
                      </Box>
                      {/* Fila: VA SPR% | VA S11% */}
                      <Box sx={{ px: 1.5, py: 1, bgcolor: '#e0f2fe', borderRight: '1px solid #bae6fd', borderTop: '1px solid #bae6fd' }}>
                        <Typography sx={{ fontSize: 11, color: '#0369a1', fontWeight: 700 }}>VA {det.is_tyt ? 'TyT' : 'SPR'}% (×100/{maxPts})</Typography>
                      </Box>
                      <Box sx={{ px: 1, py: 1, bgcolor: '#e0f2fe', textAlign: 'center', borderRight: '2px solid #7dd3fc', borderTop: '1px solid #bae6fd' }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0284c7' }}>{formatNumber(spr.va_pct, 2)}%</Typography>
                      </Box>
                      <Box sx={{ px: 1.5, py: 1, bgcolor: '#ede9fe', borderRight: '1px solid #c7d2fe', borderTop: '1px solid #c7d2fe' }}>
                        <Typography sx={{ fontSize: 11, color: '#6d28d9', fontWeight: 700 }}>VA S11%</Typography>
                      </Box>
                      <Box sx={{ px: 1, py: 1, bgcolor: '#ede9fe', textAlign: 'center', borderTop: '1px solid #c7d2fe' }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#7c3aed' }}>{formatNumber(s11.va_pct, 2)}%</Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* VA Final */}
                  <Box sx={{ p: { xs: 2, md: '16px 24px' }, bgcolor: vaBg, borderTop: `3px solid ${vaColor}` }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
                      <Box>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: vaColor, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                          Valor Agregado Resultado General
                        </Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 900, color: vaColor, mt: 0.3 }}>
                          {vaPositive ? 'Valor Agregado Positivo' : 'Valor Agregado Negativo'}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.4 }}>
                          VA_Final = VA_{det.is_tyt ? 'TyT' : 'SPR'}% − VA_S11% = {formatNumber(spr.va_pct, 2)}% − {formatNumber(s11.va_pct, 2)}%
                        </Typography>
                      </Box>
                      <Box sx={{ px: 3, py: 1.5, borderRadius: 3, bgcolor: '#fff', border: `2px solid ${vaBorder}`, textAlign: 'center', minWidth: 120 }}>
                        <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>VA Final</Typography>
                        <Typography sx={{ fontSize: 32, fontWeight: 900, color: vaColor, lineHeight: 1.1 }}>
                          {vaFinal != null ? `${vaPositive ? '+' : ''}${formatNumber(vaFinal, 2)}%` : '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Múltiples registros (otros periodos) */}
                  {estudianteDetallePayload.length > 1 && (
                    <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', bgcolor: '#fafafa' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1 }}>
                        Otros registros ({estudianteDetallePayload.length - 1} más):
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                        {estudianteDetallePayload.slice(1).map((r, i) => (
                          <Chip key={i} size="small"
                            label={`${r.anio} · ${r.periodo || '—'} · VA ${r.va_final != null ? `${r.va_final >= 0 ? '+' : ''}${formatNumber(r.va_final, 2)}%` : '—'}`}
                            sx={{ bgcolor: r.va_final >= 0 ? '#d1fae5' : '#fee2e2', color: r.va_final >= 0 ? '#065f46' : '#991b1b', fontWeight: 700 }} />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Paper>
              );
            })()}
          </Stack>
        ) : null}

        {section === 'va_estadistica' ? (
          <Stack spacing={2.5}>
            {comparativaLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : !comparativaPayload ? (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
                Sin datos disponibles para los filtros seleccionados.
              </Paper>
            ) : (() => {
              const cp = comparativaPayload;
              const comps = cp.competencias || [];
              const historico = cp.historico || [];
              const histComp = cp.historicoPorCompetencia || [];
              const cov = cp.coverage || {};
              const COMP_KEYS = [
                { label: 'Lectura Crítica', s11Key: 's11_lec', sprKey: 'spr_lec', color: '#6366f1' },
                { label: 'Razon. Cuantitativo', s11Key: 's11_raz', sprKey: 'spr_raz', color: '#0ea5e9' },
                { label: 'Comp. Ciudadanas', s11Key: 's11_ciu', sprKey: 'spr_ciu', color: '#10b981' },
                { label: 'Inglés', s11Key: 's11_ing', sprKey: 'spr_ing', color: '#f59e0b' }
              ];
              const avgS11 = comps.length ? Number((comps.reduce((s, c) => s + (c.s11_pct || 0), 0) / comps.length).toFixed(2)) : 0;
              const avgSpr = comps.length ? Number((comps.reduce((s, c) => s + (c.spr_pct || 0), 0) / comps.length).toFixed(2)) : 0;
              const vaGlobal = cp.va_promedio;
              const vaColor = vaGlobal >= 0 ? '#10b981' : '#ef4444';

              return (
                <Stack spacing={2.5}>
                  {/* ── HEADER banner ── */}
                  <Paper elevation={0} sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 10px 36px rgba(37,99,235,0.2)' }}>
                    <Box sx={{ p: { xs: 2.5, md: '28px 36px' } }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 700, letterSpacing: '2.5px', mb: 0.5 }}>
                        SABER PRO — ESTADÍSTICA COMPARATIVA
                      </Typography>
                      <Typography sx={{ color: '#fff', fontSize: { xs: 20, md: 26 }, fontWeight: 900, lineHeight: 1.2, mb: 1 }}>
                        Comparativa Saber 11 vs Saber Pro
                      </Typography>
                      <Stack direction="row" spacing={3} flexWrap="wrap" gap={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#60a5fa' }} />
                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{cp.estudiantes || 0} estudiantes con cruce S11</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cov.estado_cobertura === 'ALTO' ? '#10b981' : cov.estado_cobertura === 'MEDIO' ? '#f59e0b' : '#ef4444' }} />
                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Cobertura: {formatNumber(cov.porcentaje_cobertura, 1)}% — {cov.etiqueta_cobertura}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: vaColor }} />
                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>VA Promedio Global: {vaGlobal >= 0 ? '+' : ''}{formatNumber(vaGlobal, 2)}%</Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </Paper>

                  {/* ── 4 KPI cards VA por competencia ── */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
                    {comps.map((c, i) => {
                      const vc = c.va;
                      const vColor = vc >= 0 ? '#10b981' : '#ef4444';
                      const accent = COMP_KEYS[i]?.color || '#6366f1';
                      return (
                        <Paper key={c.label} elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', borderTop: `3px solid ${accent}`, bgcolor: '#fff' }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', mb: 0.5 }}>VALOR AGREGADO</Typography>
                          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#334155', mb: 1, lineHeight: 1.2 }}>{c.label}</Typography>
                          <Typography sx={{ fontSize: 24, fontWeight: 900, color: vColor, lineHeight: 1 }}>
                            {vc >= 0 ? '+' : ''}{formatNumber(vc, 2)}%
                          </Typography>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5, pt: 1, borderTop: '1px solid #f1f5f9' }}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography sx={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>S11</Typography>
                              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>{formatNumber(c.s11_pct, 1)}%</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography sx={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>SPR</Typography>
                              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#34d399' }}>{formatNumber(c.spr_pct, 1)}%</Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Box>

                  {/* ── TABLA RESULTADOS GENERALES ── */}
                  <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
                    <Box sx={{ p: '18px 24px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'grid', gridTemplateColumns: '1fr 3fr 2fr 1.5fr', gap: 1 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>COMPETENCIA</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>S11 PUNTAJE</Typography>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>PONDERADO</Typography>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>S11 %</Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>SPR PUNTAJE</Typography>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>SPR %</Typography>
                      </Box>
                      <Typography sx={{ color: '#fef08a', fontWeight: 900, fontSize: 12, textAlign: 'center' }}>VA GENERAL</Typography>
                    </Box>
                    {[...comps, { label: 'PROMEDIO GENERAL', s11_raw: comps.length ? comps.reduce((s, c) => s + (c.s11_raw || 0), 0) / comps.length : null, s11_ponderado: comps.length ? comps.reduce((s, c) => s + (c.s11_ponderado || 0), 0) / comps.length : null, s11_pct: avgS11, spr_raw: comps.length ? comps.reduce((s, c) => s + (c.spr_raw || 0), 0) / comps.length : null, spr_pct: avgSpr, va: vaGlobal, _footer: true }].map((c, i) => {
                      const isFooter = c._footer;
                      const vc = c.va;
                      const vColor = vc >= 0 ? '#10b981' : '#ef4444';
                      return (
                        <Box key={c.label} sx={{ display: 'grid', gridTemplateColumns: '1fr 3fr 2fr 1.5fr', gap: 1, p: '12px 24px', bgcolor: isFooter ? '#eff6ff' : (i % 2 === 0 ? '#fff' : '#f8fafc'), borderBottom: isFooter ? 'none' : '1px solid #e2e8f0', borderTop: isFooter ? '2px solid #bfdbfe' : 'none' }}>
                          <Typography sx={{ fontWeight: isFooter ? 900 : 700, fontSize: 13, color: isFooter ? '#1d4ed8' : '#334155', alignSelf: 'center' }}>{c.label}</Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, alignItems: 'center' }}>
                            <Typography sx={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{formatNumber(c.s11_raw, 1)}</Typography>
                            <Typography sx={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{formatNumber(c.s11_ponderado, 1)}</Typography>
                            <Typography sx={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{formatNumber(c.s11_pct, 2)}%</Typography>
                          </Box>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, alignItems: 'center' }}>
                            <Typography sx={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#10b981' }}>{formatNumber(c.spr_raw, 1)}</Typography>
                            <Typography sx={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#059669' }}>{formatNumber(c.spr_pct, 2)}%</Typography>
                          </Box>
                          <Typography sx={{ textAlign: 'center', fontSize: 14, fontWeight: 900, color: vColor, alignSelf: 'center' }}>
                            {vc >= 0 ? '+' : ''}{formatNumber(vc, 2)}%
                          </Typography>
                        </Box>
                      );
                    })}
                  </Paper>

                  {/* ── GRÁFICO COMPARATIVO HORIZONTAL ── */}
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5' }}>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15, mb: 0.5 }}>
                      Comparativa por Competencia — Saber 11 vs Saber Pro
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#64748b', mb: 2 }}>
                      Porcentaje normalizado · {cp.estudiantes || 0} estudiantes con cruce S11
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      {comps.map((c, i) => {
                        const vc = c.va;
                        const vColor = vc >= 0 ? '#10b981' : '#ef4444';
                        const accent = COMP_KEYS[i]?.color || '#6366f1';
                        const maxBar = 100;
                        return (
                          <Box key={c.label}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                              <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>{c.label}</Typography>
                              <Box sx={{ px: 1.5, py: 0.25, borderRadius: 99, bgcolor: `${vColor}18`, border: `1px solid ${vColor}40` }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 900, color: vColor }}>
                                  VA: {vc >= 0 ? '+' : ''}{formatNumber(vc, 2)}%
                                </Typography>
                              </Box>
                            </Stack>
                            <Stack spacing={0.75}>
                              <Box>
                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>SABER 11</Typography>
                                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>{formatNumber(c.s11_pct, 1)}%</Typography>
                                </Stack>
                                <Box sx={{ height: 14, borderRadius: 99, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                                  <Box sx={{ height: '100%', width: `${Math.min((c.s11_pct || 0) / maxBar * 100, 100)}%`, bgcolor: '#60a5fa', borderRadius: 99, transition: 'width 0.6s ease' }} />
                                </Box>
                              </Box>
                              <Box>
                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#34d399' }}>SABER PRO</Typography>
                                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#34d399' }}>{formatNumber(c.spr_pct, 1)}%</Typography>
                                </Stack>
                                <Box sx={{ height: 14, borderRadius: 99, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                                  <Box sx={{ height: '100%', width: `${Math.min((c.spr_pct || 0) / maxBar * 100, 100)}%`, bgcolor: '#34d399', borderRadius: 99, transition: 'width 0.6s ease' }} />
                                </Box>
                              </Box>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Box>
                    <Stack direction="row" spacing={3} sx={{ mt: 2.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 16, height: 8, borderRadius: 99, bgcolor: '#60a5fa' }} />
                        <Typography sx={{ fontSize: 11, color: '#64748b' }}>Saber 11 (S11 % normalizado)</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 16, height: 8, borderRadius: 99, bgcolor: '#34d399' }} />
                        <Typography sx={{ fontSize: 11, color: '#64748b' }}>Saber Pro (puntaje / 300 × 100)</Typography>
                      </Stack>
                    </Stack>
                  </Paper>

                  {/* ── EVOLUCIÓN VA PROMEDIO POR AÑO ── */}
                  {historico.length > 0 ? (
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5', height: 380 }}>
                      <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15, mb: 0.3 }}>
                        Evolución del Valor Agregado Promedio por Año
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#64748b', mb: 1.5 }}>
                        Promedio de las 4 competencias · n = estudiantes con cruce
                      </Typography>
                      <ResponsiveContainer width="100%" height="84%">
                        <BarChart data={historico} margin={{ top: 20, right: 24, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="anio" tick={{ fontSize: 12, fontWeight: 700 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                          <Tooltip formatter={(v, name) => name === 'va_promedio' ? [`${v >= 0 ? '+' : ''}${formatNumber(v, 2)}%`, 'VA Promedio'] : [v, 'Estudiantes']} />
                          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                          <Bar dataKey="va_promedio" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 11, fontWeight: 700, formatter: (v) => `${v >= 0 ? '+' : ''}${formatNumber(v, 2)}%` }}>
                            {historico.map((item) => (
                              <Cell key={item.anio} fill={(item.va_promedio || 0) >= 0 ? '#34d399' : '#f87171'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  ) : null}

                  {/* ── 2×2 GRID POR COMPETENCIA S11 vs SPR POR AÑO ── */}
                  {histComp.length > 0 ? (
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5' }}>
                      <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15, mb: 0.3 }}>
                        Evolución por Competencia — S11 vs Saber Pro
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#64748b', mb: 2 }}>
                        Comparativa anual por competencia
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        {COMP_KEYS.map((ck) => (
                          <Paper key={ck.label} elevation={0} sx={{ p: 1.5, borderRadius: 3, border: `1px solid ${ck.color}30`, height: 280 }}>
                            <Typography sx={{ fontWeight: 800, color: '#334155', fontSize: 13, mb: 1, textAlign: 'center' }}>{ck.label}</Typography>
                            <ResponsiveContainer width="100%" height="88%">
                              <BarChart data={histComp} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={8}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="anio" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip formatter={(v, name) => [`${formatNumber(v, 1)}%`, name === ck.s11Key ? 'S11' : 'SPR']} />
                                <Bar dataKey={ck.s11Key} fill="#60a5fa" radius={[4, 4, 0, 0]} name="S11" />
                                <Bar dataKey={ck.sprKey} fill="#34d399" radius={[4, 4, 0, 0]} name="SPR" />
                              </BarChart>
                            </ResponsiveContainer>
                          </Paper>
                        ))}
                      </Box>
                    </Paper>
                  ) : null}

                  {/* ── EVOLUCIÓN S11 vs SPR SIDE BY SIDE ── */}
                  {histComp.length > 0 ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                      {[
                        { title: 'Evolución Promedio Saber 11', keys: [{ key: 's11_lec', color: '#818cf8', label: 'LC' }, { key: 's11_raz', color: '#60a5fa', label: 'RC' }, { key: 's11_ciu', color: '#34d399', label: 'CC' }, { key: 's11_ing', color: '#f59e0b', label: 'Ing' }] },
                        { title: 'Evolución Promedio Saber Pro', keys: [{ key: 'spr_lec', color: '#818cf8', label: 'LC' }, { key: 'spr_raz', color: '#60a5fa', label: 'RC' }, { key: 'spr_ciu', color: '#34d399', label: 'CC' }, { key: 'spr_ing', color: '#f59e0b', label: 'Ing' }] }
                      ].map((chart) => (
                        <Paper key={chart.title} elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height: 300 }}>
                          <Typography sx={{ fontWeight: 800, color: '#334155', fontSize: 13, mb: 1, textAlign: 'center' }}>{chart.title}</Typography>
                          <ResponsiveContainer width="100%" height="88%">
                            <BarChart data={histComp} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={6}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="anio" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                              <Tooltip formatter={(v, name) => [`${formatNumber(v, 1)}%`, name]} />
                              {chart.keys.map((k) => (
                                <Bar key={k.key} dataKey={k.key} fill={k.color} radius={[3, 3, 0, 0]} name={k.label} />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                      ))}
                    </Box>
                  ) : null}
                </Stack>
              );
            })()}
          </Stack>
        ) : null}

        {section === 'va_nbc' ? (
          <Stack spacing={3}>

            {/* ── HEADER: gradient banner con selector integrado ── */}
            <Paper elevation={0} sx={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 65%, #3b82f6 100%)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(37,99,235,0.22)' }}>
              <Box sx={{ p: { xs: 2.5, md: '28px 36px' } }}>
                <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={3}>
                  <Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: 700, letterSpacing: '2px', mb: 0.5 }}>
                      SABER PRO — ANÁLISIS POR GRUPO DE REFERENCIA
                    </Typography>
                    <Typography sx={{ color: '#fff', fontSize: { xs: 20, md: 26 }, fontWeight: 900, lineHeight: 1.15 }}>
                      Núcleo Básico de Conocimiento
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap">
                      <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                        {nbcPayload.total_estudiantes} estudiantes evaluados
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>·</Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                        {(nbcPayload.rows || []).length} grupos NBC
                      </Typography>
                    </Stack>
                  </Box>
                  <Box sx={{ minWidth: { xs: '100%', lg: 340 } }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', mb: 1 }}>
                      SELECCIONAR GRUPO DE REFERENCIA
                    </Typography>
                    <FormControl fullWidth size="small" sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(8px)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                      '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.8)' }
                    }}>
                      <InputLabel>Grupo de referencia</InputLabel>
                      <Select value={selectedNbc} onChange={(e) => setSelectedNbc(e.target.value)} input={<OutlinedInput label="Grupo de referencia" />} MenuProps={SELECT_MENU_PROPS}>
                        {nbcOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Box>
                </Stack>
              </Box>
            </Paper>

            {/* Loading */}
            {nbcDetalleLoading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

            {nbcDetalle ? (
              <Stack spacing={3}>

                {/* ── FILA 1: 4 KPIs — CSS Grid igual tamaño garantizado ── */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  <KpiDetailCard
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>}
                    label="Puntaje Global"
                    value={formatNumber(nbcDetalle.summary?.promedio_global, 1)}
                    subtitle="de 300 puntos"
                    percent={nbcDetalle.summary?.pct_puntaje ?? 0}
                    quintil={`Q${nbcDetalle.summary?.q_puntaje}`}
                    color={qScale(nbcDetalle.summary?.q_puntaje).color}
                  />
                  <KpiDetailCard
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                    label="Percentil Nacional"
                    value={formatNumber(nbcDetalle.summary?.promedio_percentil, 1)}
                    subtitle="percentil promedio"
                    percent={nbcDetalle.summary?.promedio_percentil ?? 0}
                    quintil={`Q${nbcDetalle.summary?.q_nacional}`}
                    color={qScale(nbcDetalle.summary?.q_nacional).color}
                  />
                  <Paper elevation={0} sx={{
                    p: 2.5, borderRadius: 3,
                    background: `linear-gradient(135deg, ${qScale(nbcDetalle.summary?.q_general).color}14, ${qScale(nbcDetalle.summary?.q_general).color}28)`,
                    border: `2px solid ${qScale(nbcDetalle.summary?.q_general).color}55`,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ color: qScale(nbcDetalle.summary?.q_general).color, display: 'flex' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                      </Box>
                      <Typography sx={{ fontSize: '10px', color: qScale(nbcDetalle.summary?.q_general).color, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Quintil General</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '48px', fontWeight: 900, color: qScale(nbcDetalle.summary?.q_general).color, lineHeight: 1, my: 1 }}>
                      Q{nbcDetalle.summary?.q_general}
                    </Typography>
                    <Box sx={{ display: 'inline-block', bgcolor: qScale(nbcDetalle.summary?.q_general).color, color: '#fff', px: 2, py: 0.5, borderRadius: '20px', fontSize: '11px', fontWeight: 700, alignSelf: 'flex-start' }}>
                      {nbcDetalle.summary?.etiqueta}
                    </Box>
                  </Paper>
                  <Paper elevation={0} sx={{
                    p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', borderTop: '4px solid #312e81',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ color: '#312e81', display: 'flex' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </Box>
                      <Typography sx={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Total Estudiantes</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '40px', fontWeight: 800, color: '#1e3a8a', lineHeight: 1, my: 1 }}>
                      {nbcDetalle.summary?.estudiantes ?? 0}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>evaluados en este grupo</Typography>
                  </Paper>
                </Box>

                {/* ── FILA 2: Distribución (50%) + Resumen (50%) — CSS Grid igual altura ── */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  <DistribucionQuintilCard distribucion={nbcDetalle.distribucion || []} />
                  <ResumenIndicadoresCard summary={nbcDetalle.summary} distribucion={nbcDetalle.distribucion || []} />
                </Box>

                {/* ── Clasificación banner ── */}
                <ClasificacionBanner summary={nbcDetalle.summary} />

                {/* ── FILA 3: Evolución — últimos 5 años, siempre dinámico ── */}
                {(() => {
                  const allHist = (nbcDetalle.historico || []).slice().sort((a, b) => Number(a.anio) - Number(b.anio));
                  const hist5 = allHist.slice(-5);

                  // Periodos mode: use historicoPeriodo, last 5 distinct years
                  const histPeriodoRaw = nbcDetalle.historicoPeriodo || [];
                  const allPeriodoYears = [...new Set(histPeriodoRaw.map((r) => Number(r.anio)).filter(Number.isFinite))].sort((a, b) => a - b);
                  const last5Years = allPeriodoYears.slice(-5);
                  const periodoData = histPeriodoRaw
                    .filter((r) => last5Years.includes(Number(r.anio)))
                    .sort((a, b) => Number(a.anio) - Number(b.anio) || String(a.periodo).localeCompare(String(b.periodo)));

                  if (!hist5.length && !periodoData.length) return null;

                  const firstY = hist5[0]?.anio || last5Years[0];
                  const lastY = hist5[hist5.length - 1]?.anio || last5Years[last5Years.length - 1];

                  const PeriodTick = ({ x, y, payload }) => {
                    const parts = String(payload?.value || '').split('-');
                    const anio = parts[0];
                    const periodo = parts.slice(1).join('-') || '';
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={14} textAnchor="middle" fill="#2563eb" fontSize={11} fontWeight={700}>{periodo}</text>
                        <text x={0} y={0} dy={27} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={500}>{anio}</text>
                      </g>
                    );
                  };

                  return (
                    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      {/* Header with segment toggle */}
                      <Box sx={{ p: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                            <Box sx={{ color: '#2563eb', display: 'flex' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                            </Box>
                            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', letterSpacing: '0.5px' }}>EVOLUCIÓN HISTÓRICA — ÚLTIMOS 5 AÑOS</Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>
                            {evolMode === 'anual' ? `Puntaje global promedio · ${firstY} — ${lastY}` : `Anual y periodos · últimos ${last5Years.length} años`} · solo responde al filtro GRUPO DE REFERENCIA
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {/* Segment toggle */}
                          <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', borderRadius: '20px', p: '3px', gap: '2px' }}>
                            {[['anual', 'Anual'], ['periodos', 'Periodos']].map(([mode, lbl]) => (
                              <Box
                                key={mode}
                                onClick={() => setEvolMode(mode)}
                                sx={{
                                  px: 2, py: 0.5, borderRadius: '16px', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                                  bgcolor: evolMode === mode ? '#2563eb' : 'transparent',
                                  color: evolMode === mode ? '#fff' : '#64748b',
                                  transition: 'all 0.15s', userSelect: 'none'
                                }}
                              >
                                {lbl}
                              </Box>
                            ))}
                          </Box>
                          <Box sx={{ bgcolor: '#f0fdf4', color: '#15803d', px: 1.75, py: 0.5, borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                            Dinámico
                          </Box>
                        </Stack>
                      </Box>

                      {/* ANUAL MODE */}
                      {evolMode === 'anual' ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 0 }}>
                          <Box sx={{ p: '24px 28px 16px', borderRight: { lg: '1px solid #f0f4f8' } }}>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart
                                data={hist5.map((r) => ({ anio: String(r.anio), puntaje: Number(r.promedio_global || 0) }))}
                                margin={{ top: 36, right: 20, left: 4, bottom: 8 }}
                                barCategoryGap="42%"
                              >
                                <defs>
                                  <linearGradient id="evolAnualGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#60a5fa" />
                                    <stop offset="100%" stopColor="#1e40af" stopOpacity={0.9} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" stroke="#e8eef6" vertical={false} />
                                <ReferenceLine y={150} stroke="#bfdbfe" strokeDasharray="6 3" label={{ value: '150 pts', position: 'insideTopRight', fill: '#93c5fd', fontSize: 9, fontWeight: 600 }} />
                                <XAxis
                                  dataKey="anio"
                                  tick={{ fontSize: 12, fill: '#475569', fontWeight: 700 }}
                                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                                  tickLine={false}
                                />
                                <YAxis
                                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                                  domain={[0, 300]}
                                  ticks={[0, 75, 150, 225, 300]}
                                  axisLine={false}
                                  tickLine={{ stroke: '#e2e8f0' }}
                                  width={34}
                                />
                                <Tooltip
                                  formatter={(v) => [formatNumber(v, 1) + ' pts', 'Puntaje Global']}
                                  contentStyle={{ borderRadius: 10, border: '1px solid #dbeafe', boxShadow: '0 8px 32px rgba(37,99,235,0.14)', fontSize: 12, background: '#fff' }}
                                  labelStyle={{ fontWeight: 800, color: '#1e3a8a', marginBottom: 2 }}
                                  cursor={{ fill: '#eff6ff', rx: 4 }}
                                />
                                <Bar dataKey="puntaje" fill="url(#evolAnualGrad)" radius={[8, 8, 0, 0]} maxBarSize={68}
                                  label={{ position: 'top', fontSize: 12, fontWeight: 800, fill: '#1d4ed8', formatter: (v) => formatNumber(v, 1) }}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>
                          <Box sx={{ p: '20px 24px' }}>
                            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1e3a8a', mb: 1.5, letterSpacing: '0.5px' }}>DETALLE POR AÑO</Typography>
                            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1.1fr 0.8fr', background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', p: '10px 14px' }}>
                                {['AÑO', 'PUNTAJE', 'P.NAC', 'N'].map((h) => (
                                  <Typography key={h} sx={{ fontSize: '9px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>{h}</Typography>
                                ))}
                              </Box>
                              {hist5.map((r, i) => {
                                const isLatest = i === hist5.length - 1;
                                return (
                                  <Box key={r.anio} sx={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1.1fr 0.8fr', p: '10px 14px', bgcolor: isLatest ? '#eff6ff' : (i % 2 === 0 ? '#fff' : '#f8fafc'), borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: isLatest ? 800 : 600, color: isLatest ? '#1d4ed8' : '#334155' }}>{r.anio}</Typography>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>{formatNumber(r.promedio_global, 1)}</Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>{formatNumber(r.promedio_percentil, 1)}</Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>{r.estudiantes}</Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                            <Box sx={{ mt: 1.5 }}>
                              {[['PUNTAJE', 'Puntaje Global (0–300)'], ['P.NAC', 'Percentil Nacional'], ['N', 'Estudiantes evaluados']].map(([k, v]) => (
                                <Typography key={k} sx={{ fontSize: '9px', color: '#94a3b8' }}>
                                  <Typography component="span" sx={{ fontWeight: 700, fontSize: '9px', color: '#2563eb' }}>{k}</Typography>
                                  {` = ${v}`}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        /* PERIODOS MODE — chart + table */
                        periodoData.length ? (
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 0 }}>
                            <Box sx={{ p: '24px 28px 16px', borderRight: { lg: '1px solid #f0f4f8' } }}>
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                  data={periodoData.map((r) => ({
                                    label: `${r.anio}-${r.periodo}`,
                                    anio: Number(r.anio),
                                    puntaje: Number(r.promedio_global || 0)
                                  }))}
                                  margin={{ top: 36, right: 20, left: 4, bottom: 42 }}
                                  barCategoryGap="32%"
                                >
                                  <defs>
                                    <linearGradient id="evolPeriodoGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#60a5fa" />
                                      <stop offset="100%" stopColor="#1e40af" stopOpacity={0.9} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="4 4" stroke="#e8eef6" vertical={false} />
                                  <ReferenceLine y={150} stroke="#bfdbfe" strokeDasharray="6 3" label={{ value: '150 pts', position: 'insideTopRight', fill: '#93c5fd', fontSize: 9, fontWeight: 600 }} />
                                  <XAxis dataKey="label" tick={<PeriodTick />} height={56} axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }} tickLine={false} interval={0} />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    domain={[0, 300]}
                                    ticks={[0, 75, 150, 225, 300]}
                                    axisLine={false}
                                    tickLine={{ stroke: '#e2e8f0' }}
                                    width={34}
                                  />
                                  <Tooltip
                                    formatter={(v) => [formatNumber(v, 1) + ' pts', 'Puntaje Global']}
                                    labelFormatter={(label) => {
                                      const parts = String(label).split('-');
                                      return `Año ${parts[0]} · Período ${parts.slice(1).join('-')}`;
                                    }}
                                    contentStyle={{ borderRadius: 10, border: '1px solid #dbeafe', boxShadow: '0 8px 32px rgba(37,99,235,0.14)', fontSize: 12, background: '#fff' }}
                                    labelStyle={{ fontWeight: 800, color: '#1e3a8a', marginBottom: 2 }}
                                    cursor={{ fill: '#eff6ff' }}
                                  />
                                  <Bar dataKey="puntaje" fill="url(#evolPeriodoGrad)" radius={[8, 8, 0, 0]} maxBarSize={56}
                                    label={{ position: 'top', fontSize: 10, fontWeight: 800, fill: '#1d4ed8', formatter: (v) => formatNumber(v, 1) }}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </Box>
                            <Box sx={{ p: '20px 24px' }}>
                              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1e3a8a', mb: 1.5, letterSpacing: '0.5px' }}>DETALLE POR PERÍODO</Typography>
                              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '0.9fr 0.6fr 1fr 1fr 0.6fr', background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', p: '10px 14px' }}>
                                  {['AÑO', 'PER.', 'PUNTAJE', 'P.NAC', 'N'].map((h) => (
                                    <Typography key={h} sx={{ fontSize: '9px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>{h}</Typography>
                                  ))}
                                </Box>
                                {periodoData.map((r, i) => {
                                  const isLatestYear = Number(r.anio) === last5Years[last5Years.length - 1];
                                  return (
                                    <Box key={`${r.anio}-${r.periodo}`} sx={{ display: 'grid', gridTemplateColumns: '0.9fr 0.6fr 1fr 1fr 0.6fr', p: '9px 14px', bgcolor: isLatestYear ? '#eff6ff' : (i % 2 === 0 ? '#fff' : '#f8fafc'), borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
                                      <Typography sx={{ fontSize: '11px', fontWeight: isLatestYear ? 800 : 600, color: isLatestYear ? '#1d4ed8' : '#334155' }}>{r.anio}</Typography>
                                      <Typography sx={{ fontSize: '11px', fontWeight: 700, textAlign: 'center', color: '#475569' }}>{r.periodo}</Typography>
                                      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>{formatNumber(r.promedio_global, 1)}</Typography>
                                      <Typography sx={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>{formatNumber(r.promedio_percentil, 1)}</Typography>
                                      <Typography sx={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>{r.estudiantes}</Typography>
                                    </Box>
                                  );
                                })}
                              </Box>
                              <Box sx={{ mt: 1.5 }}>
                                {[['PUNTAJE', 'Puntaje Global (0–300)'], ['P.NAC', 'Percentil Nacional'], ['N', 'Estudiantes evaluados']].map(([k, v]) => (
                                  <Typography key={k} sx={{ fontSize: '9px', color: '#94a3b8' }}>
                                    <Typography component="span" sx={{ fontWeight: 700, fontSize: '9px', color: '#2563eb' }}>{k}</Typography>
                                    {` = ${v}`}
                                  </Typography>
                                ))}
                              </Box>
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ textAlign: 'center', py: 5 }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de períodos disponibles para este grupo</Typography>
                          </Box>
                        )
                      )}
                    </Paper>
                  );
                })()}

                {/* ── Metodología footer ── */}
                <MetodologiaFooter />
              </Stack>
            ) : (!nbcDetalleLoading && selectedNbc ? (
              <Alert severity="info" sx={{ borderRadius: 3 }}>Sin datos disponibles para el grupo seleccionado.</Alert>
            ) : null)}

            {/* ── FILA 4+5: Ranking + Tabla — 2 columnas con toggle Anual/Periodos ── */}
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {/* Header */}
              <Box sx={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', p: '18px 24px' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5}>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Ranking NBC por Puntaje Global</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, mt: 0.25 }}>
                      Todos los grupos · coloreado por quintil · no responde al filtro de grupo seleccionado
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {/* Mode toggle */}
                    <Box sx={{ display: 'flex', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '20px', p: '3px', gap: '2px' }}>
                      {[['anual', 'Anual'], ['periodos', 'Periodos']].map(([mode, lbl]) => (
                        <Box
                          key={mode}
                          onClick={() => setRankingMode(mode)}
                          sx={{
                            px: 2, py: 0.5, borderRadius: '16px', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                            bgcolor: rankingMode === mode ? 'rgba(255,255,255,0.9)' : 'transparent',
                            color: rankingMode === mode ? '#1e3a8a' : 'rgba(255,255,255,0.8)',
                            transition: 'all 0.15s', userSelect: 'none'
                          }}
                        >
                          {lbl}
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', px: 2, py: 0.75, borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                      {rankedNbcRows.length} grupos
                    </Box>
                  </Stack>
                </Stack>
              </Box>

              {/* 2-column layout: chart (left) + table (right) */}
              {rankedNbcRows.length > 0 ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 0 }}>
                  {/* Ranking bar chart */}
                  <Box sx={{ p: 2.5, borderRight: { lg: '1px solid #f1f5f9' } }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1e3a8a', mb: 1.5, letterSpacing: '0.5px' }}>
                      {rankingMode === 'anual' ? 'RANKING ANUAL — PUNTAJE PROMEDIO GLOBAL' : 'RANKING — PUNTAJE PROMEDIO GLOBAL'}
                    </Typography>
                    <ResponsiveContainer width="100%" height={Math.min(Math.max(220, rankedNbcRows.length * 40), 480)}>
                      <BarChart
                        data={rankedNbcRows.map((r) => ({ nombre: r.grupo_referencia, promedio: Number(r.promedio_global || 0), quintil: r.quintil }))}
                        layout="vertical"
                        margin={{ top: 8, right: 64, left: 8, bottom: 8 }}
                        barCategoryGap={12}
                      >
                        <defs>
                          <linearGradient id="rankBarGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#1e40af" stopOpacity={0.92} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e8eef6" vertical={true} horizontal={false} />
                        <ReferenceLine x={150} stroke="#bfdbfe" strokeDasharray="6 3" label={{ value: '150', position: 'top', fill: '#93c5fd', fontSize: 9, fontWeight: 600 }} />
                        <XAxis
                          type="number"
                          domain={[0, 300]}
                          ticks={[0, 75, 150, 225, 300]}
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="nombre"
                          tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
                          width={155}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: '#eff6ff' }}
                          formatter={(value) => [formatNumber(value, 2) + ' pts', 'Puntaje Global']}
                          contentStyle={{ borderRadius: 10, border: '1px solid #dbeafe', boxShadow: '0 8px 32px rgba(37,99,235,0.14)', fontSize: 12, background: '#fff' }}
                          labelStyle={{ fontWeight: 800, color: '#1e3a8a', marginBottom: 2 }}
                        />
                        <Bar dataKey="promedio" fill="url(#rankBarGrad)" radius={[0, 8, 8, 0]} maxBarSize={30}
                          label={{ position: 'right', fontSize: 11, fontWeight: 800, fill: '#1d4ed8', formatter: (v) => formatNumber(v, 1) }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>

                  {/* Table */}
                  <Box>
                    <Box sx={{ background: 'linear-gradient(135deg, #f8fafc, #eff6ff)', p: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontWeight: 700, color: '#1e3a8a', fontSize: 13 }}>Detalle por Grupo de Referencia</Typography>
                      <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.25 }}>
                        {rankedNbcRows.length} grupos · {nbcPayload.total_estudiantes} estudiantes totales
                      </Typography>
                    </Box>
                    <TablaDinamica
                      columns={[
                        { key: 'ranking', label: '#' },
                        { key: 'grupo_referencia', label: 'Grupo NBC' },
                        { key: 'estudiantes', label: 'N' },
                        { key: 'promedio_global', label: 'Puntaje', render: (v) => formatNumber(v, 2) },
                        { key: 'quintil', label: 'Q', render: (v) => (
                          <Box sx={{ display: 'inline-block', bgcolor: qScale(v).color, color: '#fff', px: 1.25, py: 0.3, borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>{v}</Box>
                        )}
                      ]}
                      rows={rankedNbcRows}
                    />
                  </Box>
                </Box>
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de ranking disponibles</Typography>
                </Box>
              )}
            </Paper>

          </Stack>
        ) : null}

        {section === 'va_programas' ? (
          <Stack spacing={2.5}>
            {/* Program selector */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', background: 'linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>Análisis por Programa</Typography>
                  <Typography sx={{ fontSize: 13, color: '#475569' }}>{(programasPayload.rows || []).length} programas · {programasPayload.total_estudiantes} estudiantes evaluados</Typography>
                </Box>
                <Box sx={{ minWidth: { xs: '100%', sm: 300 } }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Seleccionar Programa</Typography>
                  <Box component="select" value={selectedPrograma} onChange={(e) => setSelectedPrograma(e.target.value)}
                    sx={{ width: '100%', px: 1.5, py: 1, borderRadius: '10px', border: '1.5px solid #bfdbfe', fontSize: 12, fontWeight: 600, color: '#1e40af', background: '#fff', outline: 'none', cursor: 'pointer', '&:focus': { borderColor: '#2563eb' } }}>
                    {(programasPayload.rows || []).map((r) => <option key={r.programa} value={r.programa}>{r.programa}</option>)}
                  </Box>
                </Box>
              </Stack>
            </Paper>

            {programaDetalleLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={40} sx={{ color: '#2563eb' }} />
              </Box>
            ) : !programaDetallePayload ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontSize: 14, color: '#94a3b8' }}>Seleccione un programa para ver el análisis detallado</Typography>
              </Box>
            ) : (() => {
              const det = programaDetallePayload;
              const sum = det.summary || {};
              const comps = det.competencias || [];
              const niveles = det.niveles || {};
              const historico = det.historico || [];
              const qColor = quintileTone(`Q${sum.q_general || 1}`);
              const COMP_LABELS = { 'LECTURA CRÍTICA': 'Lectura Crítica', 'RAZONAMIENTO CUANTITATIVO': 'Razon. Cuantitativo', 'COMUNICACIÓN ESCRITA': 'Comunic. Escrita', 'COMPETENCIAS CIUDADANAS': 'Comp. Ciudadanas', 'INGLÉS': 'Inglés' };
              const NIVEL_COLORS = { N1: '#ef4444', N2: '#f97316', N3: '#d97706', N4: '#22c55e' };
              const MCER_COLORS = { '-A1': '#94a3b8', A1: '#60a5fa', A2: '#34d399', B1: '#a78bfa', B2: '#f472b6' };
              const genData = Object.entries(niveles.genericos || {}).map(([k, v]) => ({ nivel: k, cantidad: v }));
              const ingData = Object.entries(niveles.ingles || {}).map(([k, v]) => ({ nivel: k, cantidad: v }));
              return (
                <Stack spacing={2}>
                  {/* Header banner */}
                  <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: `1.5px solid ${qColor.color}30` }}>
                    <Box sx={{ background: `linear-gradient(135deg,${qColor.color}18 0%,${qColor.color}06 100%)`, px: 3, py: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.25 }}>Programa Académico</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>{sum.programa || selectedPrograma}</Typography>
                      </Box>
                      <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#1e40af', lineHeight: 1 }}>{sum.estudiantes || 0}</Typography>
                          <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Evaluados</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#1e40af', lineHeight: 1 }}>{formatNumber(sum.promedio_global, 1)}</Typography>
                          <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Puntaje Global</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', px: 2.5, py: 1.25, borderRadius: 2.5, bgcolor: qColor.color }}>
                          <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Q{sum.q_general}</Typography>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{sum.etiqueta}</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Paper>

                  {/* 5 KPI cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(5,1fr)' }, gap: 1.5 }}>
                    {comps.map((c) => {
                      const qc = quintileTone(`Q${c.quintil}`);
                      return (
                        <Paper key={c.modulo} elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1.5px solid ${qc.color}30`, background: `linear-gradient(155deg,${qc.color}12 0%,#fff 65%)`, textAlign: 'center' }}>
                          <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.75, lineHeight: 1.3 }}>{COMP_LABELS[c.modulo] || c.modulo}</Typography>
                          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{c.puntaje != null ? formatNumber(c.puntaje, 1) : '—'}</Typography>
                          <Typography sx={{ fontSize: 9, color: '#94a3b8', mb: 0.75 }}>/300 pts</Typography>
                          <Box sx={{ display: 'inline-block', px: 1.25, py: 0.3, borderRadius: 1, bgcolor: qc.color }}>
                            <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>Q{c.quintil} · {qc.label}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: 9, color: '#64748b', mt: 0.5 }}>{formatNumber(c.pct_puntaje, 1)}% del máx.</Typography>
                        </Paper>
                      );
                    })}
                  </Box>

                  {/* 3-col grid */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1.1fr 1.4fr' }, gap: 2 }}>
                    {/* Comparativa */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', mb: 0.25 }}>Comparativa de Puntajes</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1.5 }}>Promedio por competencia genérica · escala 0–300</Typography>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={comps.map((c) => ({ name: COMP_LABELS[c.modulo] || c.modulo, puntaje: c.puntaje || 0 }))} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }} barCategoryGap="30%">
                          <defs>
                            <linearGradient id="progBarGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e40af" stopOpacity={0.92} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="#e8eef6" horizontal={false} vertical={true} />
                          <ReferenceLine x={150} stroke="#bfdbfe" strokeDasharray="5 3" />
                          <XAxis type="number" domain={[0, 300]} ticks={[0, 75, 150, 225, 300]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} width={112} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v) => [formatNumber(v, 1) + ' pts', 'Puntaje']} contentStyle={{ borderRadius: 8, border: '1px solid #dbeafe', fontSize: 11 }} />
                          <Bar dataKey="puntaje" fill="url(#progBarGrad)" radius={[0, 6, 6, 0]} maxBarSize={24} label={{ position: 'right', fontSize: 10, fontWeight: 700, fill: '#1d4ed8', formatter: (v) => formatNumber(v, 1) }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>

                    {/* Percentil table */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', mb: 0.25 }}>Percentil por Competencia</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1.5 }}>Posición nacional por módulo</Typography>
                      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                        <Box component="thead">
                          <Box component="tr" sx={{ borderBottom: '2px solid #e2e8f0' }}>
                            {['Competencia', 'Pts.', 'Percentil', 'Q'].map((h) => (
                              <Box key={h} component="th" sx={{ py: 0.75, px: 0.75, textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</Box>
                            ))}
                          </Box>
                        </Box>
                        <Box component="tbody">
                          {comps.map((c, i) => {
                            const qc = quintileTone(`Q${c.quintil}`);
                            return (
                              <Box key={c.modulo} component="tr" sx={{ borderBottom: '1px solid #f1f5f9', bgcolor: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                                <Box component="td" sx={{ py: 1, px: 0.75, fontSize: 9, fontWeight: 600, color: '#334155' }}>{COMP_LABELS[c.modulo] || c.modulo}</Box>
                                <Box component="td" sx={{ py: 1, px: 0.75, fontSize: 10, fontWeight: 800, color: '#0f172a' }}>{c.puntaje != null ? formatNumber(c.puntaje, 1) : '—'}</Box>
                                <Box component="td" sx={{ py: 1, px: 0.75, fontSize: 10, fontWeight: 700, color: '#2563eb' }}>
                                  {formatNumber(c.percentil != null ? c.percentil : c.pct_puntaje, 1)}%
                                </Box>
                                <Box component="td" sx={{ py: 1, px: 0.75 }}>
                                  <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 18, borderRadius: 1, bgcolor: qc.color }}>
                                    <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>Q{c.quintil}</Typography>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })}
                          {/* Promedio general row */}
                          {(() => {
                            const avgPct = comps.length ? comps.reduce((s, c) => s + (c.percentil != null ? c.percentil : c.pct_puntaje), 0) / comps.length : null;
                            const qAvg = quintileTone(`Q${sum.q_general || 1}`);
                            return (
                              <Box component="tr" sx={{ borderTop: '2px solid #e2e8f0', bgcolor: '#1e40af' }}>
                                <Box component="td" sx={{ py: 1, px: 0.75, fontSize: 9, fontWeight: 800, color: '#fff' }}>PROMEDIO GENERAL</Box>
                                <Box component="td" sx={{ py: 1, px: 0.75, fontSize: 10, fontWeight: 800, color: '#bfdbfe' }}>{formatNumber(sum.promedio_global, 1)}</Box>
                                <Box component="td" sx={{ py: 1, px: 0.75, fontSize: 10, fontWeight: 800, color: '#fff' }}>
                                  {avgPct != null ? formatNumber(avgPct, 1) + '%' : '—'}
                                </Box>
                                <Box component="td" sx={{ py: 1, px: 0.75 }}>
                                  <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 18, borderRadius: 1, bgcolor: qAvg.color }}>
                                    <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>Q{sum.q_general}</Typography>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })()}
                        </Box>
                      </Box>
                    </Paper>

                    {/* Distribución por nivel */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', mb: 0.25 }}>Distribución por Nivel</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1 }}>Competencias genéricas (N1–N4) · Inglés (MCER)</Typography>
                      <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#475569', mb: 0.5 }}>COMPETENCIAS GENÉRICAS</Typography>
                      {(() => {
                        const totalGen = genData.reduce((s, e) => s + e.cantidad, 0);
                        return (
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={genData.map((e) => ({ ...e, pct: totalGen ? Number(((e.cantidad / totalGen) * 100).toFixed(0)) : 0 }))} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                              <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" vertical={false} />
                              <XAxis dataKey="nivel" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                              <YAxis tick={false} axisLine={false} tickLine={false} width={0} />
                              <Tooltip formatter={(v, n, p) => [`${p.payload.cantidad} estudiantes (${v}%)`, p.payload.nivel]} contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                              <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={38} label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: '#475569', formatter: (v) => `${v}%` }}>
                                {genData.map((entry) => <Cell key={entry.nivel} fill={NIVEL_COLORS[entry.nivel] || '#60a5fa'} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()}
                      <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#475569', mt: 2, mb: 1 }}>INGLÉS — MCER</Typography>
                      {(() => {
                        const totalIng = ingData.reduce((s, e) => s + e.cantidad, 0);
                        return (
                          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${ingData.filter((e) => e.cantidad > 0).length || ingData.length}, 1fr)`, gap: 1 }}>
                            {ingData.filter((e) => e.cantidad > 0 || ingData.every((x) => x.cantidad === 0)).map((entry) => {
                              const pct = totalIng ? Number(((entry.cantidad / totalIng) * 100).toFixed(0)) : 0;
                              const clr = MCER_COLORS[entry.nivel] || '#60a5fa';
                              return (
                                <Box key={entry.nivel} sx={{ textAlign: 'center', px: 1, py: 1.25, borderRadius: 2, border: `1.5px solid ${clr}30`, background: `${clr}14` }}>
                                  <Typography sx={{ fontSize: 18, fontWeight: 900, color: clr, lineHeight: 1 }}>{pct}%</Typography>
                                  <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#475569', mt: 0.25 }}>{entry.nivel}</Typography>
                                  <Typography sx={{ fontSize: 8, color: '#94a3b8' }}>{entry.cantidad} est.</Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        );
                      })()}
                    </Paper>
                  </Box>

                  {/* Classification banner + quintil legend */}
                  <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: `1.5px solid ${qColor.color}40` }}>
                    <Box sx={{ px: 3, py: 2, background: `linear-gradient(90deg,${qColor.color} 0%,${qColor.color}cc 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '0.03em' }}>
                        Quintil Q{sum.q_general} — {sum.etiqueta}
                      </Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                        {[['Q1', 'BAJO', '#ef4444'], ['Q2', 'BÁSICO', '#f97316'], ['Q3', 'MEDIO', '#d97706'], ['Q4', 'ALTO', '#22c55e'], ['Q5', 'SUPERIOR', '#10b981']].map(([q, lbl, clr]) => {
                          const active = `Q${sum.q_general}` === q;
                          return (
                            <Box key={q} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.4, borderRadius: 1.5, bgcolor: active ? '#fff' : 'rgba(255,255,255,0.15)', border: active ? `2px solid ${clr}` : '1.5px solid rgba(255,255,255,0.3)' }}>
                              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: clr }} />
                              <Typography sx={{ fontSize: 9, fontWeight: 700, color: active ? clr : '#fff' }}>{q} · {lbl}</Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </Paper>

                  {/* Historical evolution (show only when data has multiple years) */}
                  {historico.length > 1 && (
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', mb: 0.25 }}>Evolución Histórica del Programa</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1.5 }}>Puntaje global promedio por año</Typography>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={historico.map((r) => ({ anio: String(r.anio), puntaje: r.promedio_global || 0 }))} margin={{ top: 24, right: 16, left: 4, bottom: 4 }} barCategoryGap="42%">
                          <defs>
                            <linearGradient id="progHistGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e40af" stopOpacity={0.85} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="#e8eef6" vertical={false} />
                          <ReferenceLine y={150} stroke="#bfdbfe" strokeDasharray="5 3" />
                          <XAxis dataKey="anio" tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                          <YAxis domain={[0, 300]} ticks={[0, 75, 150, 225, 300]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip formatter={(v) => [formatNumber(v, 1) + ' pts', 'Puntaje Global']} contentStyle={{ borderRadius: 8, border: '1px solid #dbeafe', fontSize: 11 }} />
                          <Bar dataKey="puntaje" fill="url(#progHistGrad)" radius={[6, 6, 0, 0]} maxBarSize={56} label={{ position: 'top', fontSize: 10, fontWeight: 800, fill: '#1d4ed8', formatter: (v) => formatNumber(v, 1) }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  )}
                </Stack>
              );
            })()}
          </Stack>
        ) : null}

        {section === 'va_institucional' ? (
          <Stack spacing={2.5}>
            {institucionalLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={40} sx={{ color: '#2563eb' }} /></Box>
            ) : !institucionalPayload ? (
              <Box sx={{ textAlign: 'center', py: 8 }}><Typography sx={{ fontSize: 14, color: '#94a3b8' }}>Sin datos disponibles para los filtros seleccionados</Typography></Box>
            ) : (() => {
              const inst = institucionalPayload;
              const sum = inst.summary || {};
              const comps = inst.competencias || [];
              const niveles = inst.niveles || {};
              const historico = inst.historico || [];
              const qColor = quintileTone(`Q${sum.q_general || 1}`);
              const COMP_LABELS = { 'LECTURA CRÍTICA': 'Lectura Crítica', 'RAZONAMIENTO CUANTITATIVO': 'Razonamiento Cuantitativo', 'COMUNICACIÓN ESCRITA': 'Comunicación Escrita', 'COMPETENCIAS CIUDADANAS': 'Competencias Ciudadanas', 'INGLÉS': 'Inglés' };
              const COMP_SHORT = { 'LECTURA CRÍTICA': 'LECTURA CRÍTICA', 'RAZONAMIENTO CUANTITATIVO': 'RAZONAMIENTO CUANTITATIVO', 'COMUNICACIÓN ESCRITA': 'COMUNICACIÓN ESCRITA', 'COMPETENCIAS CIUDADANAS': 'COMPETENCIAS CIUDADANAS', 'INGLÉS': 'INGLÉS' };
              const NIVEL_COLORS = { N1: '#dc2626', N2: '#ea580c', N3: '#ca8a04', N4: '#16a34a' };
              const MCER_COLORS = { 'A1': '#dc2626', '-A1': '#dc2626', 'A2': '#ea580c', 'B1': '#16a34a', 'B2': '#059669' };
              const COMP_ICONS = {
                'RAZONAMIENTO CUANTITATIVO': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>,
                'LECTURA CRÍTICA': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
                'COMUNICACIÓN ESCRITA': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
                'COMPETENCIAS CIUDADANAS': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                'INGLÉS': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              };
              const genData = Object.entries(niveles.genericos || {}).map(([k, v]) => ({ nivel: k, cantidad: v }));
              const ingData = Object.entries(niveles.ingles || {}).filter(([, v]) => v > 0).map(([k, v]) => ({ nivel: k, cantidad: v }));
              const totN = genData.reduce((s, e) => s + e.cantidad, 0);
              const totI = ingData.reduce((s, e) => s + e.cantidad, 0);
              const avgPct = comps.length ? comps.reduce((s, c) => s + (c.percentil != null ? c.percentil : c.pct_puntaje), 0) / comps.length : 0;
              const anioLabel = filters.anios?.length === 1 ? String(filters.anios[0]) : (filters.anios?.length > 1 ? filters.anios.join(', ') : 'Todos');

              return (
                <Stack spacing={2}>
                  {/* Header */}
                  <Box sx={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)', p: '22px 28px', borderRadius: 3 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
                      <Stack direction="row" gap={1.5} alignItems="center">
                        <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>ANÁLISIS INSTITUCIONAL SABER PRO</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', mt: 0.25 }}>Universidad CESMAG · Competencias Genéricas</Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" gap={1.5} flexWrap="wrap">
                        {[['PERÍODO', anioLabel], ['EVALUADOS', String(sum.estudiantes || 0)], ['PROGRAMAS', String(sum.programas || 0)]].map(([lbl, val]) => (
                          <Box key={lbl} sx={{ px: 2.5, py: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.12)', textAlign: 'center' }}>
                            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', fontWeight: 600 }}>{lbl}</Typography>
                            <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{val}</Typography>
                          </Box>
                        ))}
                        <Box sx={{ px: 2.5, py: 1.25, borderRadius: 1.5, bgcolor: qColor.color, textAlign: 'center', boxShadow: `0 4px 16px ${qColor.color}60` }}>
                          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', fontWeight: 600 }}>QUINTIL</Typography>
                          <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Q{sum.q_general}</Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </Box>

                  {/* 5 KPI cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(5,1fr)' }, gap: 1.5 }}>
                    {comps.map((c) => {
                      const qc = quintileTone(`Q${c.quintil}`);
                      const dispPct = c.percentil != null ? c.percentil : c.pct_puntaje;
                      return (
                        <Paper key={c.modulo} elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', borderTop: `4px solid ${qc.color}` }}>
                          <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
                            <Box sx={{ color: qc.color, display: 'flex' }}>{COMP_ICONS[c.modulo]}</Box>
                            <Typography sx={{ fontSize: 8, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.25 }}>{COMP_SHORT[c.modulo] || c.modulo}</Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a', lineHeight: 1 }}>{c.puntaje != null ? formatNumber(c.puntaje, 1) : '—'}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.25}>
                            <Stack direction="row" alignItems="center" gap={0.5}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={qc.color} strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: qc.color }}>{formatNumber(dispPct, 1)}%</Typography>
                            </Stack>
                            <Box sx={{ px: 1.25, py: 0.3, borderRadius: 1.5, bgcolor: qc.color }}>
                              <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>Q{c.quintil}</Typography>
                            </Box>
                          </Stack>
                          <Box sx={{ mt: 1.25, height: 5, borderRadius: 3, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${Math.min(dispPct, 100)}%`, bgcolor: qc.color, borderRadius: 3 }} />
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>

                  {/* 3-column grid */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
                    {/* Comparativa */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Stack direction="row" alignItems="center" gap={1} mb={2}>
                        <Box sx={{ color: '#2563eb', display: 'flex' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1e3a8a', letterSpacing: '0.04em' }}>COMPARATIVA DE PUNTAJES</Typography>
                      </Stack>
                      <Stack spacing={1.75}>
                        {comps.map((c) => {
                          const qc = quintileTone(`Q${c.quintil}`);
                          const dispPct = c.percentil != null ? c.percentil : c.pct_puntaje;
                          return (
                            <Box key={c.modulo}>
                              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{COMP_LABELS[c.modulo] || c.modulo}</Typography>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: qc.color }}>{c.puntaje != null ? formatNumber(c.puntaje, 1) : '—'}</Typography>
                              </Stack>
                              <Box sx={{ height: 12, borderRadius: 2, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', width: `${Math.min(dispPct, 100)}%`, background: `linear-gradient(90deg,${qc.color},${qc.color}bb)`, borderRadius: 2, transition: 'width 0.6s ease' }} />
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                      <Box sx={{ mt: 2, p: '14px 16px', background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>PROMEDIO INSTITUCIONAL</Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{formatNumber(sum.promedio_global, 1)}</Typography>
                      </Box>
                    </Paper>

                    {/* Percentil table */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Stack direction="row" alignItems="center" gap={1} mb={2}>
                        <Box sx={{ color: '#2563eb', display: 'flex' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1e3a8a', letterSpacing: '0.04em' }}>PERCENTIL POR COMPETENCIA</Typography>
                      </Stack>
                      <Box component="table" sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                        <Box component="thead">
                          <Box component="tr" sx={{ background: 'linear-gradient(135deg,#1e3a8a,#2563eb)' }}>
                            {['COMPETENCIA', 'PERCENTIL', 'QUINTIL'].map((h, i) => (
                              <Box key={h} component="th" sx={{ py: 1, px: 1.25, color: '#fff', textAlign: i === 0 ? 'left' : 'center', fontWeight: 600, fontSize: 9, letterSpacing: '0.06em', borderRadius: i === 0 ? '8px 0 0 0' : i === 2 ? '0 8px 0 0' : 0 }}>{h}</Box>
                            ))}
                          </Box>
                        </Box>
                        <Box component="tbody">
                          {comps.map((c, i) => {
                            const qc = quintileTone(`Q${c.quintil}`);
                            const dispPct = c.percentil != null ? c.percentil : c.pct_puntaje;
                            return (
                              <Box key={c.modulo} component="tr" sx={{ bgcolor: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                                <Box component="td" sx={{ py: 1, px: 1.25, fontWeight: 600, color: '#334155' }}>{COMP_LABELS[c.modulo] || c.modulo}</Box>
                                <Box component="td" sx={{ py: 1, px: 1.25, textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{formatNumber(dispPct, 1)}%</Box>
                                <Box component="td" sx={{ py: 1, px: 1.25, textAlign: 'center' }}>
                                  <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', px: 1.5, py: 0.3, borderRadius: 1.5, bgcolor: qc.color }}>
                                    <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>Q{c.quintil}</Typography>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })}
                          <Box component="tr" sx={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)', borderTop: '2px solid #e2e8f0' }}>
                            <Box component="td" sx={{ py: 1.25, px: 1.25, fontWeight: 700, color: '#fff', fontSize: 10, borderRadius: '0 0 0 8px' }}>PROMEDIO INSTITUCIONAL</Box>
                            <Box component="td" sx={{ py: 1.25, px: 1.25, textAlign: 'center', fontWeight: 800, color: '#fff', fontSize: 13 }}>{formatNumber(avgPct, 1)}%</Box>
                            <Box component="td" sx={{ py: 1.25, px: 1.25, textAlign: 'center', borderRadius: '0 0 8px 0' }}>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', px: 1.5, py: 0.3, borderRadius: 1.5, bgcolor: '#fff' }}>
                                <Typography sx={{ fontSize: 9, fontWeight: 800, color: qColor.color }}>Q{sum.q_general}</Typography>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1.5, px: 1.5, py: 1, bgcolor: '#f0f9ff', borderRadius: 1.5, borderLeft: '3px solid #2563eb' }}>
                        <Typography sx={{ fontSize: 9, color: '#1e3a8a', fontWeight: 600 }}>FÓRMULA: Percentil = (Puntaje ÷ 300) × 100</Typography>
                      </Box>
                    </Paper>

                    {/* Distribución por nivel */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Stack direction="row" alignItems="center" gap={1} mb={2}>
                        <Box sx={{ color: '#2563eb', display: 'flex' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="7"/><rect x="12" y="9" width="3" height="11"/><rect x="17" y="5" width="3" height="15"/></svg></Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1e3a8a', letterSpacing: '0.04em' }}>DISTRIBUCIÓN POR NIVEL</Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#64748b', mb: 1 }}>Competencias Genéricas (Niveles 1-4)</Typography>
                      {(() => {
                        return (
                          <ResponsiveContainer width="100%" height={90}>
                            <BarChart data={genData.map((e) => ({ ...e, pct: totN ? Number(((e.cantidad / totN) * 100).toFixed(0)) : 0 }))} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
                              <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" vertical={false} />
                              <XAxis dataKey="nivel" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                              <YAxis tick={false} axisLine={false} tickLine={false} width={0} />
                              <Tooltip formatter={(v, n, p) => [`${p.payload.cantidad} est. (${v}%)`, p.payload.nivel]} contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                              <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={40} label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: '#475569', formatter: (v) => `${v}%` }}>
                                {genData.map((entry) => <Cell key={entry.nivel} fill={NIVEL_COLORS[entry.nivel] || '#60a5fa'} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()}
                      <Box sx={{ mt: 1, px: 1.5, py: 0.75, bgcolor: '#f8fafc', borderRadius: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 10, color: '#64748b' }}>Índice de Desempeño</Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>{formatNumber(niveles.indice_desempeno, 1)}%</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#64748b', mt: 2, mb: 1 }}>Inglés - Marco MCER</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${ingData.length || 4}, 1fr)`, gap: 0.75 }}>
                        {ingData.map((entry) => {
                          const pct = totI ? Number(((entry.cantidad / totI) * 100).toFixed(0)) : 0;
                          const clr = MCER_COLORS[entry.nivel] || '#60a5fa';
                          return (
                            <Box key={entry.nivel} sx={{ textAlign: 'center', px: 0.75, py: 1, borderRadius: 1.5, background: `${clr}18`, borderBottom: `3px solid ${clr}` }}>
                              <Typography sx={{ fontSize: 16, fontWeight: 800, color: clr, lineHeight: 1 }}>{pct}%</Typography>
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#475569', mt: 0.25 }}>{entry.nivel}</Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  </Box>

                  {/* Clasificación */}
                  <Box sx={{ background: `linear-gradient(135deg,${qColor.color}14,${qColor.color}22)`, borderRadius: 3, p: '22px 28px', border: `2px solid ${qColor.color}` }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
                      <Stack direction="row" alignItems="center" gap={2}>
                        <Box sx={{ color: qColor.color, display: 'flex' }}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 10, color: qColor.color, fontWeight: 700, letterSpacing: '0.1em', mb: 0.25 }}>CLASIFICACIÓN INSTITUCIONAL UNICESMAG</Typography>
                          <Typography sx={{ fontSize: 26, fontWeight: 900, color: qColor.color, lineHeight: 1 }}>QUINTIL {sum.q_general} — {sum.etiqueta}</Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" gap={1.25}>
                        {[['PUNTAJE', formatNumber(sum.promedio_global, 1), '#1e3a8a'], ['PERCENTIL', formatNumber(avgPct, 1) + '%', '#2563eb']].map(([lbl, val, clr]) => (
                          <Box key={lbl} sx={{ px: 2.5, py: 1.5, bgcolor: '#fff', borderRadius: 1.5, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                            <Typography sx={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>{lbl}</Typography>
                            <Typography sx={{ fontSize: 18, fontWeight: 800, color: clr, mt: 0.25 }}>{val}</Typography>
                          </Box>
                        ))}
                        <Box sx={{ px: 2.5, py: 1.5, bgcolor: qColor.color, borderRadius: 1.5, textAlign: 'center', boxShadow: `0 4px 16px ${qColor.color}40` }}>
                          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>QUINTIL</Typography>
                          <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#fff', mt: 0.25 }}>Q{sum.q_general}</Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </Box>

                  {/* Footer */}
                  <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#fff', borderRadius: 2, borderLeft: '4px solid #2563eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography component="span" sx={{ fontSize: 9, fontWeight: 700, color: '#1e3a8a', letterSpacing: '0.08em' }}>QUINTILES: </Typography>
                      <Typography component="span" sx={{ fontSize: 10, color: '#64748b' }}>Q1 (≤20%) Bajo • Q2 (21-40%) Básico • Q3 (41-60%) Medio • Q4 (61-80%) Alto • Q5 (&gt;80%) Superior</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 9, color: '#94a3b8' }}>Escala: 0-300 puntos | Resultados Institucionales</Typography>
                  </Box>

                  {/* Historical chart */}
                  {historico.length > 1 && (
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', mb: 0.25 }}>Evolución Histórica</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1.5 }}>Puntaje global promedio por año · todos los programas</Typography>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={[...new Map(historico.map((r) => [r.anio, r])).values()].map((r) => ({ anio: String(r.anio), puntaje: r.promedio_global || 0 }))} margin={{ top: 24, right: 16, left: 4, bottom: 4 }} barCategoryGap="42%">
                          <defs>
                            <linearGradient id="instHistGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e40af" stopOpacity={0.85} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="#e8eef6" vertical={false} />
                          <ReferenceLine y={150} stroke="#bfdbfe" strokeDasharray="5 3" />
                          <XAxis dataKey="anio" tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                          <YAxis domain={[0, 300]} ticks={[0, 75, 150, 225, 300]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip formatter={(v) => [formatNumber(v, 1) + ' pts', 'Puntaje Global']} contentStyle={{ borderRadius: 8, border: '1px solid #dbeafe', fontSize: 11 }} />
                          <Bar dataKey="puntaje" fill="url(#instHistGrad)" radius={[6, 6, 0, 0]} maxBarSize={56} label={{ position: 'top', fontSize: 10, fontWeight: 800, fill: '#1d4ed8', formatter: (v) => formatNumber(v, 1) }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  )}
                </Stack>
              );
            })()}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

export default ValorAgregadoDashboardBI;
