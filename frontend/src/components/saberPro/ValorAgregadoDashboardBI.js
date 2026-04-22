import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';
import BadgeEstado from './valueAdded/BadgeEstado';
import CardKPI from './valueAdded/CardKPI';
import ResumenCobertura from './valueAdded/ResumenCobertura';
import TablaDinamica from './valueAdded/TablaDinamica';
import TablaComparativaEstudiante from './valueAdded/TablaComparativaEstudiante';

const BASE_FILTERS = { programas: [], anios: [], periodos: [], gruposReferencia: [] };

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
        La cobertura actual es {formatNumber(coverage.porcentaje_cobertura || 0)}%. El sistema bloquea visualizaciones hasta superar el 30%.
      </Typography>
    </Alert>
  );
}

function BoxplotCard({ boxplot }) {
  const items = [
    ['Min', boxplot.min],
    ['Q1', boxplot.q1],
    ['Mediana', boxplot.mediana],
    ['Q3', boxplot.q3],
    ['Max', boxplot.max]
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

const GENERAL_RESULT_ORDER = [
  { key: 'lectura_critica', label: 'LECTURA CRITICA', sprKey: 'lectura' },
  { key: 'razonamiento_cuantitativo', label: 'RAZONAMIENTO CUANTITATIVO', sprKey: 'razonamiento' },
  { key: 'competencias_ciudadanas', label: 'COMPETENCIAS CIUDADANAS', sprKey: 'ciudadanas' },
  { key: 'ingles', label: 'INGLES', sprKey: 'ingles' },
  { key: 'comunicacion_escrita', label: 'COMUNICACION ESCRITA', sprKey: 'comunicacion' }
];

function ValorAgregadoResultadoGeneralCard({ detail }) {
  if (!detail) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #dbeafe', textAlign: 'center', color: '#64748b' }}>
        Selecciona un documento para ver el resultado general.
      </Paper>
    );
  }

  const s11Entries = [];
  const seenS11Cols = new Set();
  GENERAL_RESULT_ORDER.forEach((item) => {
    const eq = (detail.equivalencias && detail.equivalencias[item.key]) || {};
    const s11Cols = Array.isArray(eq.s11_cols) ? eq.s11_cols : [];
    s11Cols.forEach((col) => {
      const key = String(col.col || col.label || '').trim();
      if (!key || seenS11Cols.has(key)) return;
      seenS11Cols.add(key);
      if (col.score == null) return;
      s11Entries.push({
        key,
        label: String(col.label || key).trim().toUpperCase(),
        pct: Number(col.score)
      });
    });
  });

  const sprEntries = GENERAL_RESULT_ORDER.map((item) => {
    const sprScore = detail.saberPro && detail.saberPro[item.sprKey] != null ? Number(detail.saberPro[item.sprKey]) : null;
    const maxPts = Number(detail.saberPro.max_pts || (detail.is_tyt ? 200 : 300));
    const sprPct = sprScore != null && maxPts > 0 ? Number(((sprScore * 100) / maxPts).toFixed(2)) : null;
    return {
      key: item.key,
      label: item.label,
      score: sprScore,
      sprPct
    };
  }).filter((row) => row.score != null || row.sprPct != null);

  const totalRows = Math.max(s11Entries.length, sprEntries.length);
  void totalRows;
  const s11AvgPct = s11Entries.length
    ? Number((s11Entries.reduce((acc, item) => acc + (item.pct || 0), 0) / s11Entries.length).toFixed(2))
    : null;
  const sprAverageScore = sprEntries.length
    ? Number((sprEntries.reduce((acc, item) => acc + (item.score || 0), 0) / sprEntries.length).toFixed(2))
    : null;
  const sprAvgPct = sprEntries.length
    ? Number((sprEntries.reduce((acc, item) => acc + (item.sprPct || 0), 0) / sprEntries.length).toFixed(2))
    : null;
  const finalVa = s11AvgPct != null && sprAvgPct != null ? Number((sprAvgPct - s11AvgPct).toFixed(2)) : null;
  const finalPositive = finalVa != null && finalVa >= 0;

  return (
    <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
      <Box sx={{ p: { xs: 2.2, md: 3 }, background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', color: '#fff' }}>
        <Typography sx={{ fontSize: { xs: 22, md: 30 }, fontWeight: 900, lineHeight: 1.05 }}>
          COMPARATIVA SABER 11 VS {detail.is_tyt ? 'SABER TYT' : 'SABER PRO'}
        </Typography>
        <Typography sx={{ mt: 1.4, fontSize: 18, fontWeight: 800 }}>{detail.nombre || detail.documento}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, fontWeight: 700, opacity: 0.95 }}>
          {detail.programa || 'SIN PROGRAMA'}
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} mt={0.8} flexWrap="wrap">
          <Typography sx={{ fontSize: 11, opacity: 0.9 }}>DOCUMENTO: {detail.documento || '—'}</Typography>
          <Typography sx={{ fontSize: 11, opacity: 0.9 }}>REGISTRO: {detail.numero_registro || '—'}</Typography>
          <Typography sx={{ fontSize: 11, opacity: 0.9 }}>
            SABER 11: {detail.s11_anio || '—'} {detail.s11_tipo.nombre ? `· ${detail.s11_tipo.nombre}` : ''}
          </Typography>
          <Typography sx={{ fontSize: 11, opacity: 0.9 }}>
            {detail.is_tyt ? 'SABER TYT' : 'SABER PRO'}: {detail.anio || '—'}{detail.periodo ? `-${detail.periodo}` : ''}
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ bgcolor: '#fff' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 1.25, md: 1.5 },
            px: { xs: 1.25, md: 2, lg: 2.5 },
            pt: { xs: 1.25, md: 1.75 },
            pb: 1
          }}
        >
          <Box>
            <Paper elevation={0} sx={{ p: 1.6, minHeight: 112, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#f8fbff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8', textTransform: 'uppercase' }}>Saber 11</Typography>
              <Typography sx={{ mt: 0.35, fontSize: 28, fontWeight: 900, color: '#1e3a8a' }}>
                {s11AvgPct != null ? `${formatNumber(s11AvgPct, 2)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Promedio de todas las competencias evaluadas</Typography>
            </Paper>
          </Box>
          <Box>
            <Paper elevation={0} sx={{ p: 1.6, minHeight: 112, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#f8fbff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8', textTransform: 'uppercase' }}>
                {detail.is_tyt ? 'Saber TyT' : 'Saber Pro'}
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 28, fontWeight: 900, color: '#1e3a8a' }}>
                {sprAvgPct != null ? `${formatNumber(sprAvgPct, 2)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                Promedio del porcentaje normalizado
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1', lg: 'auto' } }}>
            <Paper elevation={0} sx={{ p: 1.6, minHeight: 112, borderRadius: 3, border: `1px solid ${finalPositive ? '#86efac' : '#fca5a5'}`, bgcolor: finalPositive ? '#f0fdf4' : '#fef2f2', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 900, color: finalPositive ? '#059669' : '#b91c1c', textTransform: 'uppercase' }}>
                Valor Agregado
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 28, fontWeight: 900, color: finalPositive ? '#10b981' : '#ef4444' }}>
                {finalVa != null ? `${finalPositive ? '+' : ''}${formatNumber(finalVa, 2)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Diferencia entre ambos resultados</Typography>
            </Paper>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 0.95fr) minmax(0, 1.25fr)' },
            gap: { xs: 1.25, md: 1.75 },
            px: { xs: 1.25, md: 2, lg: 2.5 },
            pb: 2.2,
            alignItems: 'stretch'
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 3, border: '1px solid #dbeafe', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ px: 2, py: 1.2, bgcolor: '#2563eb' }}>
                <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>
                  {`SABER 11${detail.s11_tipo.nombre ? ` - ${String(detail.s11_tipo.nombre).replace('_', ' ')}` : ''}`}
                </Typography>
              </Box>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', flex: 1 }}>
                <Box component="thead" sx={{ bgcolor: '#eff6ff' }}>
                  <Box component="tr">
                    <Box component="th" sx={{ px: 2, py: 1, textAlign: 'left', fontSize: 11, fontWeight: 900, color: '#1d4ed8', borderBottom: '1px solid #dbeafe' }}>
                      COMPETENCIA EVALUADA
                    </Box>
                    <Box component="th" sx={{ width: 92, px: 2, py: 1, textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#1d4ed8', borderBottom: '1px solid #dbeafe' }}>
                      %
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {s11Entries.map((row, index) => (
                    <Box key={row.key} component="tr" sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f8fbff' }}>
                      <Box component="td" sx={{ px: 2, py: 1.12, borderBottom: '1px solid #dbeafe' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{row.label}</Typography>
                      </Box>
                      <Box component="td" sx={{ width: 92, px: 2, py: 1.12, textAlign: 'center', borderBottom: '1px solid #dbeafe' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#2563eb' }}>{formatNumber(row.pct, 2)}%</Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box component="tr" sx={{ bgcolor: '#60a5fa' }}>
                    <Box component="td" sx={{ px: 2, py: 1.15, color: '#fff', fontSize: 11, fontWeight: 900 }}>RESULTADO GENERAL NORMALIZADO</Box>
                    <Box component="td" sx={{ width: 92, px: 2, py: 1.15, textAlign: 'center', color: '#fff', fontSize: 20, fontWeight: 900 }}>
                      {s11AvgPct != null ? `${formatNumber(s11AvgPct, 2)}%` : '—'}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Paper elevation={0} sx={{ overflow: 'hidden', borderRadius: 3, border: '1px solid #dbeafe', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ px: 2, py: 1.2, bgcolor: '#2563eb' }}>
                <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>{detail.is_tyt ? 'SABER TYT' : 'SABER PRO'}</Typography>
              </Box>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', flex: 1 }}>
                <Box component="thead" sx={{ bgcolor: '#eff6ff' }}>
                  <Box component="tr">
                    <Box component="th" sx={{ px: 2, py: 1, textAlign: 'left', fontSize: 11, fontWeight: 900, color: '#1d4ed8', borderBottom: '1px solid #dbeafe' }}>
                      COMPETENCIA GENERICA
                    </Box>
                    <Box component="th" sx={{ width: 108, px: 2, py: 1, textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#1d4ed8', borderBottom: '1px solid #dbeafe' }}>
                      PUNTAJE
                    </Box>
                    <Box component="th" sx={{ width: 96, px: 2, py: 1, textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#1d4ed8', borderBottom: '1px solid #dbeafe' }}>
                      %
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {sprEntries.map((row, index) => (
                    <Box key={row.key} component="tr" sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f8fbff' }}>
                      <Box component="td" sx={{ px: 2, py: 1.12, borderBottom: '1px solid #dbeafe' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{row.label}</Typography>
                      </Box>
                      <Box component="td" sx={{ width: 108, px: 2, py: 1.12, textAlign: 'center', borderBottom: '1px solid #dbeafe' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#2563eb' }}>{formatNumber(row.score, 2)}</Typography>
                      </Box>
                      <Box component="td" sx={{ width: 96, px: 2, py: 1.12, textAlign: 'center', borderBottom: '1px solid #dbeafe' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#2563eb' }}>{formatNumber(row.sprPct, 2)}%</Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box component="tr" sx={{ bgcolor: '#60a5fa' }}>
                    <Box component="td" sx={{ px: 2, py: 1.15, color: '#fff', fontSize: 11, fontWeight: 900 }}>PROMEDIO NORMALIZADO</Box>
                    <Box component="td" sx={{ width: 108, px: 2, py: 1.15, textAlign: 'center', color: '#fff', fontWeight: 800 }}>
                      {sprAverageScore != null ? formatNumber(sprAverageScore, 2) : '—'}
                    </Box>
                    <Box component="td" sx={{ width: 96, px: 2, py: 1.15, textAlign: 'center', color: '#fff', fontSize: 20, fontWeight: 900 }}>
                      {sprAvgPct != null ? `${formatNumber(sprAvgPct, 2)}%` : '—'}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>

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
            <Typography sx={{ fontSize: 13, opacity: 0.92 }}>Universidad CESMAG · Competencias Genéricas</Typography>
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
              <CardKPI label="Cobertura" value={`${formatNumber(coverage.porcentaje_cobertura || 0, 1)}%`} tone="#d97706" />
              <CardKPI label="Quintil" value={summary.quintil} tone={quintilMeta.color} />
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Paper>
  );
}

// â”€â”€ NBC professional design system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const firstY = historico[0].anio;
  const lastY = historico[historico.length - 1].anio;
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
                {['AÑO', 'PUNT.', 'P. NAC', 'N'].map((h) => (
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

void CoverageBlocked;
void BoxplotCard;
void StudentGeneralCard;
void ProgramAnalysisCard;
void InstitutionalAnalysisCard;
void NbcHeaderBadge;
void EvolucionHistoricaCard;

function MetodologiaFooter() {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: '14px 20px', borderLeft: '4px solid #2563eb', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1} flexWrap="wrap">
        <Box>
          <Typography component="span" sx={{ fontSize: '9px', color: '#1e3a8a', fontWeight: 700, letterSpacing: '1px' }}>METODOLOGÍA: </Typography>
          <Typography component="span" sx={{ fontSize: '10px', color: '#64748b' }}>Q1 (≤20%) Bajo • Q2 (21-40%) Básico • Q3 (41-60%) Medio • Q4 (61-80%) Alto • Q5 (&gt;80%) Superior</Typography>
        </Box>
        <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>Quintil General = Promedio de Puntaje y P. Nacional</Typography>
      </Stack>
    </Box>
  );
}
// â”€â”€ end NBC design system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ SmartFilterPanel: checklist con bÃºsqueda, select all y cascada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SmartFilterPanel({ label, options, value, onChange, singleSelect = false }) {
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
  const toggle = (opt) => {
    if (singleSelect) {
      onChange(isSelected(opt) ? [] : [opt]);
      setOpen(false);
      setSearch('');
      return;
    }
    onChange(isSelected(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
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
            {value.length
              ? (singleSelect ? String(value[0]) : `${value.length} seleccionado${value.length > 1 ? 's' : ''}`)
              : 'Todos'}
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

          {!singleSelect ? (
            <Box onClick={toggleAll} sx={{ px: 1.5, py: 0.875, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #f1f5f9', '&:hover': { bgcolor: '#f5f3ff' } }}>
              <Box sx={{ width: 15, height: 15, flexShrink: 0, borderRadius: '4px', border: `2px solid ${allSelected ? '#7c3aed' : '#d1d5db'}`, bgcolor: allSelected ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {allSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>Seleccionar todos ({options.length})</Typography>
            </Box>
          ) : null}

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
              {singleSelect
                ? (value.length > 0 ? '1 seleccionado' : `${options.length} opciones`)
                : (value.length > 0 ? `${value.length} de ${options.length} seleccionados` : `${options.length} opciones`)}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
// â”€â”€ end SmartFilterPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

function ValorAgregadoDashboardBI({ initialSection = 'va_individual', allowedDashboards = [] }) {
  const [catalogs, setCatalogs] = useState({ programas: [], anios: [], periodos: [], gruposReferencia: [] });
  const [filters, setFilters] = useState(BASE_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState(initialSection);
  const [searchDocumento, setSearchDocumento] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
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
  const [exportingPositivos, setExportingPositivos] = useState(false);
  const [vaTrendYears, setVaTrendYears] = useState([]);
  const [vaCompYears, setVaCompYears] = useState([]);
  const [vaDualYears, setVaDualYears] = useState([]);
  const allowedDashboardSet = useMemo(() => new Set(Array.isArray(allowedDashboards) ? allowedDashboards : []), [allowedDashboards]);
  const restrictedByPermissions = allowedDashboardSet.size > 0;
  const modularOptions = useMemo(() => ([
    { key: 'va_nbc', label: 'NBC', permission: 'saber_pro_valor_agregado_nbc' },
    { key: 'va_programas', label: 'Programas', permission: 'saber_pro_valor_agregado_programas' },
    { key: 'va_institucional', label: 'Institucional', permission: 'saber_pro_valor_agregado_institucional' }
  ]), []);
  const visibleModularOptions = useMemo(() => {
    if (!restrictedByPermissions) return modularOptions;
    return modularOptions.filter((item) => allowedDashboardSet.has(item.permission));
  }, [restrictedByPermissions, modularOptions, allowedDashboardSet]);
  const firstVisibleModularSection = visibleModularOptions[0]?.key || 'va_nbc';

  const handleExportPositivos = useCallback(async () => {
    setExportingPositivos(true);
    try {
      const r = await saberProAnalyticsService.getEstudiantesPositivosEstadistica({ ...filters, onlyPositiveVa: true });
      const rows = (r.data && r.data.rows) || [];
      if (!rows.length) {
        alert('No hay estudiantes con valor agregado positivo para los filtros actuales.');
        return;
      }
      const headers = [
        'Documento', 'Nombre', 'Programa', 'Año', 'Periodo', 'Registro',
        'S11 Lectura %', 'S11 Razonamiento %', 'S11 Ciudadanas %', 'S11 Comunicación %', 'S11 Inglés %',
        'SPR Lectura (pts)', 'SPR Razonamiento (pts)', 'SPR Ciudadanas (pts)', 'SPR Comunicación (pts)', 'SPR Inglés (pts)',
        'SPR Lectura %', 'SPR Razonamiento %', 'SPR Ciudadanas %', 'SPR Comunicación %', 'SPR Inglés %',
        'VA Lectura %', 'VA Razonamiento %', 'VA Ciudadanas %', 'VA Comunicación %', 'VA Inglés %',
        'VA Promedio %'
      ];
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(';')];
      rows.forEach((x) => {
        lines.push([
          x.documento, x.nombre, x.programa, x.anio, x.periodo, x.numero_registro,
          x.s11_lec, x.s11_raz, x.s11_ciu, x.s11_com, x.s11_ing,
          x.spr_lec_pts, x.spr_raz_pts, x.spr_ciu_pts, x.spr_com_pts, x.spr_ing_pts,
          x.spr_lec_pct, x.spr_raz_pct, x.spr_ciu_pct, x.spr_com_pct, x.spr_ing_pct,
          x.va_lec, x.va_raz, x.va_ciu, x.va_com, x.va_ing,
          x.va_promedio
        ].map(esc).join(';'));
      });
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estudiantes_va_positivos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exportando positivos:', e);
      alert('No se pudo exportar los estudiantes positivos.');
    } finally {
      setExportingPositivos(false);
    }
  }, [filters]);
  const nbcFilters = useMemo(() => ({
    programas: [],
    anios: filters.anios || [],
    periodos: [],
    gruposReferencia: filters.gruposReferencia || []
  }), [filters.anios, filters.gruposReferencia]);
  const programFilters = useMemo(() => ({
    programas: filters.programas || [],
    anios: filters.anios || [],
    periodos: [],
    gruposReferencia: []
  }), [filters.programas, filters.anios]);
  const institutionalFilters = useMemo(() => ({
    programas: [],
    anios: filters.anios || [],
    periodos: [],
    gruposReferencia: []
  }), [filters.anios]);
  const hasNbcFilters = !!((filters.anios && filters.anios.length) || (filters.gruposReferencia && filters.gruposReferencia.length));
  const hasProgramFilters = !!((filters.anios && filters.anios.length) || (filters.programas && filters.programas.length));
  const hasInstitutionalFilters = !!(filters.anios && filters.anios.length);
  const catalogFilters = section === 'va_nbc'
    ? nbcFilters
    : section === 'va_programas'
      ? programFilters
      : section === 'va_institucional'
        ? institutionalFilters
        : filters;

  const hasActiveFilters = useMemo(() => (
    (filters.programas && filters.programas.length > 0) ||
    (filters.anios && filters.anios.length > 0) ||
    (filters.periodos && filters.periodos.length > 0) ||
    (filters.gruposReferencia && filters.gruposReferencia.length > 0) ||
    vaOnlyPositive ||
    !!selectedDocumento
  ), [filters, vaOnlyPositive, selectedDocumento]);

  const handleClearFilters = useCallback(() => {
    setFilters(BASE_FILTERS);
    setVaOnlyPositive(false);
    setSelectedDocumento('');
    setEstudianteDetallePayload(null);
    setSelectedNbc('');
    setSelectedPrograma('');
  }, []);

  useEffect(() => {
    if (['va_nbc', 'va_programas', 'va_institucional'].includes(initialSection)) {
      if (visibleModularOptions.some((item) => item.key === initialSection)) {
        setSection(initialSection);
      } else {
        setSection(firstVisibleModularSection);
      }
      return;
    }
    setSection(initialSection);
  }, [initialSection, visibleModularOptions, firstVisibleModularSection]);

  useEffect(() => {
    if (!['va_nbc', 'va_programas', 'va_institucional'].includes(section)) return;
    if (!visibleModularOptions.some((item) => item.key === section)) {
      setSection(firstVisibleModularSection);
    }
  }, [section, visibleModularOptions, firstVisibleModularSection]);

  useEffect(() => {
    let active = true;
    saberProAnalyticsService.getFiltrosCascade(catalogFilters)
      .then((response) => {
        if (!active) return;
        const data = response.data || {};
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
          // La carga de documentos para va_general la maneja fetchDocsBySearch
          // (respeta vaOnlyPositive). No duplicar aquí para evitar conflictos.
          return;
        } else if (section === 'va_nbc') {
          if (!hasNbcFilters) {
            if (active) setNbcPayload({ total_estudiantes: 0, rows: [] });
            return;
          }
          const r = await saberProAnalyticsService.getResultadosNbc(nbcFilters);
          if (active) setNbcPayload(r.data || { total_estudiantes: 0, rows: [] });
          return;
        } else if (section === 'va_programas') {
          if (!hasProgramFilters) {
            if (active) setProgramasPayload({ total_estudiantes: 0, rows: [] });
            return;
          }
          const r = await saberProAnalyticsService.getResultadosProgramas(programFilters);
          if (active) setProgramasPayload(r.data || { total_estudiantes: 0, rows: [] });
          return;
        } else if (section === 'va_institucional') {
          if (!hasInstitutionalFilters) {
            if (active) { setInstitucionalPayload(null); setInstitucionalLoading(false); }
            return;
          }
          if (active) setInstitucionalLoading(true);
          const r = await saberProAnalyticsService.getResultadosInstitucional(institutionalFilters);
          if (active) { setInstitucionalPayload(r.data || null); setInstitucionalLoading(false); }
          return;
        } else if (section === 'va_estadistica') {
          if (active) setComparativaLoading(true);
          try {
            const r = await saberProAnalyticsService.getResultadosComparativaS11Spr({ ...filters, onlyPositiveVa: vaOnlyPositive });
            if (active) setComparativaPayload(r.data || null);
          } catch (e) {
            if (active) setComparativaPayload(null);
            console.error('Error comparativa S11 SPR:', e.response.data.message || e.message);
          } finally {
            if (active) setComparativaLoading(false);
          }
          return;
        }
        if (!active) return;
        setPayload(response.data || { coverage: buildEmptyCoverage(), rows: [] });
      } catch (err) {
        if (!active) return;
        setError(err.response.data.message || 'No fue posible cargar el dashboard de valor agregado.');
      } finally {
        if (active) setLoading(false);
      }
    };
    // Debounce para evitar disparar múltiples consultas pesadas mientras el
    // usuario sigue ajustando filtros (especialmente útil en va_estadistica).
    const debounceMs = section === 'va_estadistica' || section === 'va_institucional' ? 400 : 0;
    const timerId = setTimeout(load, debounceMs);
    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [filters, nbcFilters, programFilters, institutionalFilters, section, vaOnlyPositive, hasNbcFilters, hasProgramFilters, hasInstitutionalFilters]);

  const coverage = payload.coverage || buildEmptyCoverage();

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
      .then((r) => { if (active) setVaGeneralDocs(r.data || []); })
      .catch(() => { if (active) setVaGeneralDocs([]); })
      .finally(() => { if (active) setVaGeneralDocsLoading(false); });
    return () => { active = false; };
  }, [filters, vaOnlyPositive]);

  useEffect(() => {
    if (section !== 'va_general') return;
    return fetchDocsBySearch('');
  }, [section, fetchDocsBySearch]);

  const selectedStudentRow = useMemo(
    () => (payload.rows || []).find((row) => String(row.documento || '') === String(selectedDocumento || '')) || null,
    [payload.rows, selectedDocumento]
  );
  void selectedStudentRow;

  const programOptions = useMemo(
    () => (programasPayload.rows || []).map((row) => row.programa).filter(Boolean),
    [programasPayload.rows]
  );

  useEffect(() => {
    if (section !== 'va_programas') return;
    const fromFilter = (filters.programas && filters.programas[0]) || '';
    const firstAvailable = fromFilter || programOptions[0] || '';
    if (!hasProgramFilters) {
      if (selectedPrograma) setSelectedPrograma('');
      return;
    }
    if (!firstAvailable) {
      if (selectedPrograma) setSelectedPrograma('');
      return;
    }
    if (!fromFilter && programOptions[0]) {
      setFilters((prev) => ({ ...prev, programas: [programOptions[0]] }));
      if (selectedPrograma !== programOptions[0]) setSelectedPrograma(programOptions[0]);
      return;
    }
    if (!selectedPrograma || selectedPrograma !== firstAvailable) {
      setSelectedPrograma(firstAvailable);
    }
  }, [section, programOptions, selectedPrograma, filters.programas, hasProgramFilters, setFilters]);

  useEffect(() => {
    if (section !== 'va_general' || !selectedDocumento) {
      setEstudianteDetallePayload(null);
      return;
    }
    let active = true;
    setEstudianteDetalleLoading(true);
    saberProAnalyticsService.getComparativaEstudianteDetalle({ ...filters, documento: selectedDocumento })
      .then((r) => { if (active) setEstudianteDetallePayload(r.data || null); })
      .catch(() => { if (active) setEstudianteDetallePayload(null); })
      .finally(() => { if (active) setEstudianteDetalleLoading(false); });
    return () => { active = false; };
  }, [section, selectedDocumento, filters]);

  useEffect(() => {
    if (section !== 'va_programas' || !selectedPrograma) {
      setProgramaDetallePayload(null);
      return;
    }
    let active = true;
    setProgramaDetalleLoading(true);
    saberProAnalyticsService.getResultadosProgramaDetalle({ programas: [selectedPrograma], anios: filters.anios, periodos: [] })
      .then((r) => { if (active) setProgramaDetallePayload(r.data || null); })
      .catch(() => { if (active) setProgramaDetallePayload(null); })
      .finally(() => { if (active) setProgramaDetalleLoading(false); });
    return () => { active = false; };
  }, [section, selectedPrograma, filters.anios]);

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
  void selectedProgramRow;

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
  void selectedProgramCompetencies;

  const nbcOptions = useMemo(
    () => (nbcPayload.rows || []).map((row) => row.grupo_referencia).filter(Boolean),
    [nbcPayload.rows]
  );

  useEffect(() => {
    if (section !== 'va_nbc') return;
    const fromFilter = (filters.gruposReferencia && filters.gruposReferencia[0]) || '';
    const firstAvailable = fromFilter || nbcOptions[0] || '';
    if (!hasNbcFilters) {
      if (selectedNbc) setSelectedNbc('');
      return;
    }
    if (!firstAvailable) {
      if (selectedNbc) setSelectedNbc('');
      return;
    }
    if (!fromFilter && nbcOptions[0]) {
      setFilters((prev) => ({ ...prev, gruposReferencia: [nbcOptions[0]] }));
      if (selectedNbc !== nbcOptions[0]) setSelectedNbc(nbcOptions[0]);
      return;
    }
    if (!selectedNbc || selectedNbc !== firstAvailable) {
      setSelectedNbc(firstAvailable);
    }
  }, [filters.gruposReferencia, nbcOptions, section, selectedNbc, hasNbcFilters, setFilters]);

  useEffect(() => {
    if (section !== 'va_nbc' || !selectedNbc) {
      setNbcDetalle(null);
      return;
    }
    let active = true;
    setNbcDetalleLoading(true);
    saberProAnalyticsService.getResultadosNbcDetalle({ ...nbcFilters, gruposReferencia: [selectedNbc] })
      .then((r) => { if (active) setNbcDetalle(r.data || null); })
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
  void selectedRankedNbc;

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
  void nbcDistribution;

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
  void nbcHistoryByYear;

  const individualColumns = useMemo(() => ([
    { key: '_detalle', label: 'Detalle', render: (_v, row) => {
      const isSel = selectedStudent && selectedStudent.documento === row.documento && selectedStudent.anio === row.anio;
      return <span style={{ fontSize: 13, color: isSel ? '#1d4ed8' : '#94a3b8', fontWeight: 700 }}>{isSel ? '▼' : '▶'}</span>;
    }},
    { key: 'nombre', label: 'Nombre', render: (v) => <span style={{ fontWeight: 600 }}>{v || '—'}</span> },
    { key: 'documento', label: 'Documento' },
    { key: 'programa', label: 'Programa' },
    { key: 'anio', label: 'Año' },
    { key: 'va_global', label: 'VA Global', render: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return <span style={{ color: '#94a3b8' }}>Sin S11</span>;
      return <span style={{ color: n >= 0 ? '#047857' : '#b91c1c', fontWeight: 800 }}>{n >= 0 ? '+' : ''}{(n * 100).toFixed(2)}%</span>;
    }},
    { key: 'lectura_salida', label: 'Lec. SPR', render: (v) => formatNumber(v, 0) },
    { key: 'va_lectura', label: 'VA Lec.', render: (v) => { const n = Number(v); return !Number.isFinite(n) ? '—' : <span style={{ color: n >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{n >= 0 ? '+' : ''}{(n * 100).toFixed(2)}%</span>; }},
    { key: 'razonamiento_salida', label: 'Raz. SPR', render: (v) => formatNumber(v, 0) },
    { key: 'va_razonamiento', label: 'VA Raz.', render: (v) => { const n = Number(v); return !Number.isFinite(n) ? '—' : <span style={{ color: n >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{n >= 0 ? '+' : ''}{(n * 100).toFixed(2)}%</span>; }},
    { key: 'ciudadanas_salida', label: 'Ciud. SPR', render: (v) => formatNumber(v, 0) },
    { key: 'va_ciudadanas', label: 'VA Ciud.', render: (v) => { const n = Number(v); return !Number.isFinite(n) ? '—' : <span style={{ color: n >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{n >= 0 ? '+' : ''}{(n * 100).toFixed(2)}%</span>; }},
    { key: 'comunicacion_salida', label: 'Com. SPR', render: (v) => formatNumber(v, 0) },
    { key: 'va_comunicacion', label: 'VA Com.', render: (v) => { const n = Number(v); return !Number.isFinite(n) ? '—' : <span style={{ color: n >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{n >= 0 ? '+' : ''}{(n * 100).toFixed(2)}%</span>; }},
    { key: 'ingles_salida', label: 'Ing. SPR', render: (v) => formatNumber(v, 0) },
    { key: 'va_ingles', label: 'VA Ing.', render: (v) => { const n = Number(v); return !Number.isFinite(n) ? '—' : <span style={{ color: n >= 0 ? '#047857' : '#b91c1c', fontWeight: 700 }}>{n >= 0 ? '+' : ''}{(n * 100).toFixed(2)}%</span>; }}
  ]), [selectedStudent]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      <Stack spacing={2.2}>
        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 4, border: '1px solid #ddd6fe', background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 48%, #eff6ff 100%)' }}>
          <Stack spacing={1.8}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} spacing={1.5}>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#312e81', letterSpacing: '-0.03em' }}>
                  Valor Agregado
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FilterAltOffIcon sx={{ fontSize: 18 }} />}
                  onClick={handleClearFilters}
                  disabled={!hasActiveFilters}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 99,
                    borderColor: '#c4b5fd',
                    color: '#6d28d9',
                    bgcolor: '#fff',
                    px: 1.5,
                    '&:hover': { borderColor: '#7c3aed', bgcolor: '#f5f3ff' },
                    '&.Mui-disabled': { borderColor: '#e5e7eb', color: '#cbd5e1', bgcolor: '#f8fafc' }
                  }}
                >
                  Limpiar filtros
                </Button>
                {section !== 'va_general' && section !== 'va_estadistica' ? (
                  <BadgeEstado estado={coverage.estado_cobertura} label={coverage.etiqueta_cobertura} />
                ) : null}
              </Stack>
            </Stack>

            {['va_nbc', 'va_programas', 'va_institucional'].includes(section) ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.25,
                    width: '100%'
                  }}
                >
                  {visibleModularOptions.map(({ key, label }) => (
                    <Box
                      key={key}
                      onClick={() => setSection(key)}
                      sx={{
                        width: '100%',
                        minHeight: 54,
                        px: 2.25,
                        py: 1.25,
                        borderRadius: 2.5,
                        border: '1px solid #ddd6fe',
                        background: section === key ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : '#fff',
                        color: section === key ? '#fff' : '#5b21b6',
                        fontWeight: 900,
                        fontSize: 15,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: section === key ? '0 10px 22px rgba(109,40,217,0.22)' : '0 2px 10px rgba(15,23,42,0.04)',
                        userSelect: 'none',
                        cursor: 'pointer',
                        transition: 'all .18s ease',
                        '&:hover': {
                          background: section === key ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' : '#f5f3ff',
                          transform: 'translateY(-1px)'
                        }
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: section === 'va_institucional' ? '1fr' : 'repeat(2, 1fr)' }, gap: 1.5 }}>
                  <SmartFilterPanel
                    label="Años"
                    options={catalogs.anios}
                    value={filters.anios}
                    onChange={(v) => setFilters((prev) => ({ ...prev, anios: v, periodos: [] }))}
                  />

                  {section === 'va_nbc' ? (
                    <SmartFilterPanel
                      label="Grupo de referencia"
                      options={catalogs.gruposReferencia}
                      value={filters.gruposReferencia}
                      singleSelect
                      onChange={(v) => {
                        setFilters((prev) => ({ ...prev, gruposReferencia: v, programas: [], periodos: [] }));
                        setSelectedNbc(v[0] || '');
                      }}
                    />
                  ) : null}

                  {section === 'va_programas' ? (
                    <SmartFilterPanel
                      label="Programas"
                      options={catalogs.programas}
                      value={filters.programas}
                      singleSelect
                      onChange={(v) => {
                        setFilters((prev) => ({ ...prev, programas: v, gruposReferencia: [], periodos: [] }));
                        setSelectedPrograma(v[0] || '');
                      }}
                    />
                  ) : null}
                </Box>
              </>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: section === 'va_general' ? 'repeat(4, 1fr)' : section === 'va_estadistica' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }, gap: 1.5 }}>
                  {section !== 'va_nbc' ? (
                    <SmartFilterPanel
                      label="Programas"
                      options={catalogs.programas}
                      value={filters.programas}
                      onChange={(v) => {
                        setFilters((prev) => ({ ...prev, programas: v }));
                        if (section === 'va_general') {
                          setSelectedDocumento('');
                          setEstudianteDetallePayload(null);
                        }
                      }}
                    />
                  ) : null}
                  <SmartFilterPanel
                    label="Años"
                    options={catalogs.anios}
                    value={filters.anios}
                    onChange={(v) => {
                      setFilters((prev) => ({ ...prev, anios: v }));
                      if (section === 'va_general') {
                        setSelectedDocumento('');
                        setEstudianteDetallePayload(null);
                      }
                    }}
                  />
                  {section !== 'va_general' && section !== 'va_estadistica' ? (
                    <SmartFilterPanel label="Periodos" options={catalogs.periodos} value={filters.periodos} onChange={(v) => setFilters((prev) => ({ ...prev, periodos: v }))} />
                  ) : (
                    section === 'va_general' ? (
                    <Paper elevation={0} sx={{ p: 1.2, borderRadius: 3, border: '1px solid #ddd6fe', background: '#fff' }}>
                      <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.8px', textTransform: 'uppercase', mb: 0.75 }}>
                        Documento
                      </Typography>
                      <Autocomplete
                        size="small"
                        options={documentOptions}
                        getOptionLabel={(opt) => (
                          opt && opt.documento
                            ? `${opt.documento}${opt.nombre ? ` · ${opt.nombre}` : ''}${opt.numero_registro ? ` · ${opt.numero_registro}` : ''}`
                            : ''
                        )}
                        isOptionEqualToValue={(opt, val) => opt.documento === val.documento}
                        value={documentOptions.find((d) => d.documento === selectedDocumento) || null}
                        onChange={(_e, newVal) => setSelectedDocumento((newVal && newVal.documento) || '')}
                        onInputChange={(_e, newInput, reason) => {
                          if (reason === 'reset') return;
                          clearTimeout(vaSearchTimer.current);
                          vaSearchTimer.current = setTimeout(() => fetchDocsBySearch(reason === 'clear' ? '' : newInput), 350);
                        }}
                        onOpen={() => {
                          clearTimeout(vaSearchTimer.current);
                          fetchDocsBySearch('');
                        }}
                        loading={vaGeneralDocsLoading}
                        filterOptions={(x) => x}
                        noOptionsText="Sin resultados"
                        loadingText="Buscando..."
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Buscar por documento, nombre o registro"
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                                </InputAdornment>
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
                      />
                    </Paper>
                    ) : null
                  )}
                  {section !== 'va_general' && section !== 'va_estadistica' ? (
                    <SmartFilterPanel label="NBC / Grupo Referencia" options={catalogs.gruposReferencia} value={filters.gruposReferencia} onChange={(v) => setFilters((prev) => ({ ...prev, gruposReferencia: v }))} />
                  ) : (
                    (section === 'va_general' || section === 'va_estadistica') ? (
                    <Paper elevation={0} sx={{ p: 1.2, borderRadius: 3, border: '1px solid #ddd6fe', background: '#fff' }}>
                      <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.8px', textTransform: 'uppercase', mb: 0.75 }}>
                        Filtro final
                      </Typography>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={vaOnlyPositive ? 'positivo' : 'general'}
                          onChange={(event) => {
                            const nextPositive = event.target.value === 'positivo';
                            setVaOnlyPositive(nextPositive);
                            setSelectedDocumento('');
                            setEstudianteDetallePayload(null);
                          }}
                        >
                          <MenuItem value="general">General</MenuItem>
                          <MenuItem value="positivo">Solo valor agregado positivo</MenuItem>
                        </Select>
                      </FormControl>
                    </Paper>
                    ) : null
                  )}
                </Box>
              </>
            )}
          </Stack>
        </Paper>

        {section === 'va_individual' ? (
          <ResumenCobertura coverage={coverage} />
        ) : null}

        {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
        {error ? <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert> : null}

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

        {section === 'va_individual' && selectedStudent ? (
          <TablaComparativaEstudiante
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
          />
        ) : null}

        {section === 'va_individual' ? (
          <>
            <TablaDinamica
              columns={individualColumns}
              rows={filteredIndividualRows}
              search={searchDocumento}
              onSearchChange={setSearchDocumento}
              onRowClick={(row) => setSelectedStudent((prev) => (prev.documento === row.documento && prev.anio === row.anio ? null : row))}
              selectedRowKey={selectedStudent ? `${selectedStudent.documento}-${selectedStudent.anio}` : null}
              rowKey={(row) => `${row.documento}-${row.anio}`}
            />
            {filteredIndividualRows.length > 0 && !loading && (
              <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block', textAlign: 'center' }}>
                Haz clic en una fila para ver la tabla comparativa Saber 11 vs Saber Pro del estudiante.
              </Typography>
            )}
          </>
        ) : null}

        {section === 'va_general' ? (
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbeafe', background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Filtros Iniciales
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: 13, color: '#475569', fontWeight: 700 }}>
                Trabaja el resultado general por estudiante con los filtros: Programa, Año y Documento.
              </Typography>
            </Paper>

            {estudianteDetalleLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : !estudianteDetallePayload || estudianteDetallePayload.length === 0 ? (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #dbeafe', textAlign: 'center', color: '#64748b' }}>
                {selectedDocumento ? 'No hay comparativa general para este documento con los filtros seleccionados.' : 'Selecciona un documento para ver el resultado general.'}
              </Paper>
            ) : (
              <ValorAgregadoResultadoGeneralCard detail={estudianteDetallePayload[0]} />
            )}
          </Stack>
        ) : null}

        {section === 'va_estadistica' ? (
          <Stack spacing={2.5}>
            {comparativaLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : !comparativaPayload ? (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>No se pudieron cargar los datos.</Typography>
                <Typography sx={{ fontSize: 12 }}>Revisa la conexión o intenta ajustar los filtros.</Typography>
              </Paper>
            ) : (() => {
              const cp = comparativaPayload;
              const comps = cp.competencias || [];
              const historico = cp.historico || [];
              const histComp = cp.historicoPorCompetencia || [];
              const COMP_KEYS = [
                { label: 'Lectura Crítica', s11Key: 's11_lec', sprKey: 'spr_lec', color: '#6366f1' },
                { label: 'Razon. Cuantitativo', s11Key: 's11_raz', sprKey: 'spr_raz', color: '#0ea5e9' },
                { label: 'Comp. Ciudadanas', s11Key: 's11_ciu', sprKey: 'spr_ciu', color: '#10b981' },
                { label: 'Comunicación Escrita', s11Key: 's11_com', sprKey: 'spr_com', color: '#8b5cf6' },
                { label: 'Inglés', s11Key: 's11_ing', sprKey: 'spr_ing', color: '#f59e0b' }
              ];
              const COMP_CHARTS = COMP_KEYS.map((ck, index) => {
                const comp = comps[index] || {};
                const s11Labels = Array.isArray(comp.s11_label) && comp.s11_label.length
                  ? comp.s11_label
                  : [comp.label || ck.label];
                return {
                  ...ck,
                  sprLabel: comp.spr_label || ck.label,
                  s11Labels
                };
              });
              const avgS11 = comps.length ? (comps.reduce((s, c) => s + (c.s11_pct || 0), 0) / comps.length) : 0;
              const avgSpr = comps.length ? (comps.reduce((s, c) => s + (c.spr_pct || 0), 0) / comps.length) : 0;
              const vaGlobal = cp.va_promedio;
              const vaColor = vaGlobal >= 0 ? '#10b981' : '#ef4444';
              const tableRows = [
                ...comps,
                {
                  label: 'PROMEDIO GENERAL',
                  s11_label: [cp.tipo_saber11 ? `Saber 11 - ${cp.tipo_saber11}` : 'Promedio general'],
                  spr_label: 'Promedio general',
                  s11_raw: comps.length ? comps.reduce((s, c) => s + (c.s11_raw || 0), 0) / comps.length : null,
                  s11_ponderado: comps.length ? comps.reduce((s, c) => s + (c.s11_ponderado || 0), 0) / comps.length : null,
                  s11_pct: avgS11,
                  spr_raw: comps.length ? comps.reduce((s, c) => s + (c.spr_raw || 0), 0) / comps.length : null,
                  spr_pct: avgSpr,
                  va: vaGlobal,
                  _footer: true
                }
              ];

              return (
                <Stack spacing={2.5}>
                  {/* Header banner */}
                  <Paper elevation={0} sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 10px 36px rgba(37,99,235,0.2)' }}>
                    <Box sx={{ p: { xs: 2.5, md: '28px 36px' } }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}>
                        <Box>
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 700, letterSpacing: '2.5px', mb: 0.5 }}>
                            SABER PRO - ESTADÍSTICA COMPARATIVA {vaOnlyPositive ? '· FILTRO: SOLO VA POSITIVO' : '· FILTRO: GENERAL'}
                          </Typography>
                          <Typography sx={{ color: '#fff', fontSize: { xs: 20, md: 26 }, fontWeight: 900, lineHeight: 1.2, mb: 1 }}>
                            Comparativa Saber 11 vs Saber Pro
                          </Typography>
                          <Stack direction="row" spacing={3} flexWrap="wrap" gap={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: vaOnlyPositive ? '#10b981' : '#60a5fa' }} />
                              <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
                                {cp.estudiantes || 0} estudiantes contabilizados{vaOnlyPositive ? ' (solo con VA ≥ 0)' : ' (con cruce S11)'}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: vaColor }} />
                              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>VA Promedio Global: {vaGlobal >= 0 ? '+' : ''}{formatNumber(vaGlobal, 2)}%</Typography>
                            </Stack>
                          </Stack>
                        </Box>
                        {vaOnlyPositive ? (
                          <Button
                            variant="contained"
                            disabled={exportingPositivos}
                            onClick={handleExportPositivos}
                            sx={{ bgcolor: '#10b981', color: '#fff', fontWeight: 800, borderRadius: 2, textTransform: 'none', px: 2.5, py: 1.2, fontSize: 13, boxShadow: '0 4px 14px rgba(16,185,129,0.35)', '&:hover': { bgcolor: '#059669' } }}
                          >
                            {exportingPositivos ? 'Exportando…' : `⬇ Exportar base de datos (${cp.estudiantes || 0} estudiantes)`}
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  </Paper>

                  {/* KPI cards VA por competencia */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, 1fr)' }, gap: 1.5 }}>
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
                              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>{formatNumber(c.s11_pct, 2)}%</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography sx={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>SPR</Typography>
                              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#34d399' }}>{formatNumber(c.spr_pct, 2)}%</Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Box>

                  {/* Tabla resultados generales */}
                  <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
                    <Box sx={{ p: '16px 24px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'grid', gridTemplateColumns: '2.8fr 2.4fr 1.2fr', gap: 1 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr', gap: 1 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 13, textAlign: 'left' }}>SABER 11</Typography>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>PUNTAJE</Typography>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>%</Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr', gap: 1 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 13, textAlign: 'left' }}>SABER PRO</Typography>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>PUNTAJE</Typography>
                        <Typography sx={{ color: '#bfdbfe', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>%</Typography>
                      </Box>
                      <Typography sx={{ color: '#fef08a', fontWeight: 900, fontSize: 12, textAlign: 'center' }}>VA GENERAL</Typography>
                    </Box>
                    {tableRows.map((c, i) => {
                      const isFooter = c._footer;
                      const vc = c.va;
                      const vColor = vc >= 0 ? '#10b981' : '#ef4444';
                      return (
                        <Box key={`${c.key || c.label}-${i}`} sx={{ display: 'grid', gridTemplateColumns: '2.8fr 2.4fr 1.2fr', gap: 1, p: '12px 24px', bgcolor: isFooter ? '#eff6ff' : (i % 2 === 0 ? '#fff' : '#f8fafc'), borderBottom: isFooter ? 'none' : '1px solid #e2e8f0', borderTop: isFooter ? '2px solid #bfdbfe' : 'none' }}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr', gap: 1, alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                              {(Array.isArray(c.s11_label) && c.s11_label.length ? c.s11_label : [c.label]).map((entry) => (
                                <Typography key={`${c.key || c.label}-${entry}`} sx={{ fontSize: 13, fontWeight: 800, color: isFooter ? '#1d4ed8' : '#334155', lineHeight: 1.25 }}>
                                  {entry}
                                </Typography>
                              ))}
                            </Box>
                            <Typography sx={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{formatNumber(c.s11_raw, 1)}</Typography>
                            <Typography sx={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{formatNumber(c.s11_pct, 2)}%</Typography>
                          </Box>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr', gap: 1, alignItems: 'center' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 800, color: isFooter ? '#1d4ed8' : '#334155' }}>{c.spr_label || c.label}</Typography>
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

                  {/* Gráfico comparativo horizontal (Saber 11 vs Saber Pro) */}
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.2} sx={{ mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15, letterSpacing: '0.3px' }}>
                          SABER 11 vs SABER PRO · Muestra: {cp.estudiantes || 0} estudiantes
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                          Porcentaje normalizado por competencia
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 14, height: 10, borderRadius: 2, bgcolor: '#60a5fa' }} />
                          <Typography sx={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>SABER 11</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 14, height: 10, borderRadius: 2, bgcolor: '#34d399' }} />
                          <Typography sx={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>SABER PRO</Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                    {(!comps || comps.length === 0 || (cp.estudiantes || 0) === 0) ? (
                      <Box sx={{ py: 6, textAlign: 'center', color: '#94a3b8' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                          Sin estudiantes con cruce Saber 11 para los filtros aplicados.
                        </Typography>
                        <Typography sx={{ fontSize: 11, mt: 0.5 }}>
                          Ajusta los filtros o limpia los filtros para ver la comparativa.
                        </Typography>
                      </Box>
                    ) : (() => {
                      const chartData = comps.map((c) => ({
                        name: c.label,
                        sprLabel: c.spr_label || c.label,
                        s11Labels: Array.isArray(c.s11_label) && c.s11_label.length ? c.s11_label : [c.label],
                        s11: c.s11_pct || 0,
                        spr: c.spr_pct || 0
                      }));
                      const maxVal = Math.max(0, ...chartData.map((d) => Math.max(d.s11 || 0, d.spr || 0)));
                      const xMax = Math.min(100, Math.max(40, Math.ceil((maxVal + 10) / 10) * 10));
                      const BAR_SIZE = 36;
                      const BAR_GAP = 10;
                      const BAR_OFFSET = (BAR_SIZE + BAR_GAP) / 2;
                      const CustomYTick = (props) => {
                        const { x, y, payload } = props;
                        const entry = chartData.find((d) => d.name === payload.value);
                        if (!entry) return null;
                        const s11List = entry.s11Labels || [];
                        const lineH = 13;
                        const s11Start = -BAR_OFFSET - ((s11List.length - 1) * lineH) / 2 + 4;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <circle cx={-7} cy={-BAR_OFFSET} r={4} fill="#60a5fa" />
                            {s11List.map((s, idx) => (
                              <text
                                key={`s11-${idx}`}
                                x={-16}
                                y={s11Start + (idx * lineH)}
                                textAnchor="end"
                                fontSize="11.5"
                                fontWeight="700"
                                fill="#2563eb"
                              >
                                {s}
                              </text>
                            ))}
                            <circle cx={-7} cy={BAR_OFFSET} r={4} fill="#34d399" />
                            <text
                              x={-16}
                              y={BAR_OFFSET + 4}
                              textAnchor="end"
                              fontSize="13"
                              fontWeight="800"
                              fill="#059669"
                            >
                              {entry.sprLabel}
                            </text>
                          </g>
                        );
                      };
                      const rowHeight = 150;
                      const chartHeight = Math.max(520, comps.length * rowHeight);
                      return (
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 112px' },
                            columnGap: { xs: 0, md: 0 },
                            rowGap: 1,
                            alignItems: 'stretch'
                          }}
                        >
                          <Box sx={{ width: '100%', height: chartHeight }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 12, right: 18, left: 12, bottom: 12 }}
                                barCategoryGap="30%"
                                barGap={BAR_GAP}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                <XAxis type="number" domain={[0, xMax]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  width={240}
                                  interval={0}
                                  tickLine={false}
                                  axisLine={false}
                                  tick={<CustomYTick />}
                                />
                                <Tooltip
                                  formatter={(v, key) => [`${formatNumber(v, 2)}%`, key === 's11' ? 'SABER 11' : 'SABER PRO']}
                                  labelFormatter={(label) => {
                                    const entry = chartData.find((d) => d.name === label);
                                    if (!entry) return label;
                                    return `${entry.sprLabel} · S11: ${entry.s11Labels.join(', ')}`;
                                  }}
                                />
                                <Bar dataKey="s11" name="SABER 11" fill="#60a5fa" barSize={BAR_SIZE} radius={[0, 8, 8, 0]} label={{ position: 'right', fontSize: 12.5, fontWeight: 800, fill: '#2563eb', formatter: (v) => `${formatNumber(v, 2)}%` }} />
                                <Bar dataKey="spr" name="SABER PRO" fill="#34d399" barSize={BAR_SIZE} radius={[0, 8, 8, 0]} label={{ position: 'right', fontSize: 12.5, fontWeight: 800, fill: '#059669', formatter: (v) => `${formatNumber(v, 2)}%` }} />
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>
                          <Stack
                            spacing={1.2}
                            justifyContent="space-around"
                            sx={{
                              py: 2,
                              pl: { xs: 0, md: 0.5 },
                              ml: { xs: 0, md: -1.5 }
                            }}
                          >
                            {comps.map((c) => {
                              const vc = c.va;
                              const vColor = vc >= 0 ? '#10b981' : '#ef4444';
                              return (
                                <Box
                                  key={`va-badge-${c.label}`}
                                  sx={{
                                    px: 1.1,
                                    py: 0.75,
                                    minWidth: { xs: 110, md: 104 },
                                    borderRadius: 99,
                                    border: `1.5px solid ${vColor}`,
                                    bgcolor: `${vColor}10`,
                                    textAlign: 'center',
                                    alignSelf: { xs: 'flex-end', md: 'flex-start' }
                                  }}
                                >
                                  <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: vColor, letterSpacing: '0.3px' }}>
                                    VA: {vc >= 0 ? '+' : ''}{formatNumber(vc, 2)}%
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Stack>
                        </Box>
                      );
                    })()}
                  </Paper>

                  {/* Evolución VA promedio por año */}
                  {historico.length > 0 ? (() => {
                    const yearOptions = [...new Set(historico.map((item) => String(item.anio)).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
                    const activeYears = vaTrendYears.filter((year) => yearOptions.includes(year));
                    const historicoFiltrado = activeYears.length ? historico.filter((item) => activeYears.includes(String(item.anio))) : historico;
                    const toggleTrendYear = (year) => {
                      setVaTrendYears((prev) => (
                        prev.includes(year) ? prev.filter((item) => item !== year) : [...prev, year]
                      ));
                    };

                    return (
                      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5', minHeight: 380 }}>
                        <Stack
                          direction={{ xs: 'column', lg: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', lg: 'center' }}
                          spacing={1.5}
                          sx={{ mb: 1.5 }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15, mb: 0.3 }}>
                              Evolución del Valor Agregado Promedio por Año
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                              Promedio de las 4 competencias · n = estudiantes con cruce
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                            <Chip
                              label="Todos"
                              size="small"
                              onClick={() => setVaTrendYears([])}
                              color={activeYears.length === 0 ? 'primary' : 'default'}
                              variant={activeYears.length === 0 ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 700 }}
                            />
                            {yearOptions.map((year) => {
                              const selected = activeYears.includes(year);
                              return (
                                <Chip
                                  key={`va-trend-year-${year}`}
                                  label={year}
                                  size="small"
                                  onClick={() => toggleTrendYear(year)}
                                  color={selected ? 'primary' : 'default'}
                                  variant={selected ? 'filled' : 'outlined'}
                                  sx={{ fontWeight: 700 }}
                                />
                              );
                            })}
                          </Stack>
                        </Stack>

                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={historicoFiltrado} margin={{ top: 20, right: 24, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="anio" tick={{ fontSize: 12, fontWeight: 700 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                            <Tooltip formatter={(v, name) => name === 'va_promedio' ? [`${v >= 0 ? '+' : ''}${formatNumber(v, 2)}%`, 'VA Promedio'] : [v, 'Estudiantes']} />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                            <Bar dataKey="va_promedio" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 11, fontWeight: 700, formatter: (v) => `${v >= 0 ? '+' : ''}${formatNumber(v, 2)}%` }}>
                              {historicoFiltrado.map((item) => (
                                <Cell key={item.anio} fill={(item.va_promedio || 0) >= 0 ? '#34d399' : '#f87171'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Paper>
                    );
                  })() : null}

                  {/* Grid por competencia S11 vs Saber Pro por año */}
                  {histComp.length > 0 ? (() => {
                    const compYearOptions = [...new Set(histComp.map((item) => String(item.anio)).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
                    const activeCompYears = vaCompYears.filter((year) => compYearOptions.includes(year));
                    const histCompFiltrado = activeCompYears.length ? histComp.filter((item) => activeCompYears.includes(String(item.anio))) : histComp;
                    const toggleCompYear = (year) => {
                      setVaCompYears((prev) => (
                        prev.includes(year) ? prev.filter((item) => item !== year) : [...prev, year]
                      ));
                    };

                    return (
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5' }}>
                      <Stack
                        direction={{ xs: 'column', lg: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', lg: 'center' }}
                        spacing={1.5}
                        sx={{ mb: 2 }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15, mb: 0.3 }}>
                            Evolución por Competencia - S11 vs Saber Pro
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: '#64748b', mb: 0.5 }}>
                            Comparativa anual por competencia
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>
                            Muestra usada en este gráfico: {cp.estudiantes || 0} estudiantes con cruce
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                          <Chip
                            label="Todos"
                            size="small"
                            onClick={() => setVaCompYears([])}
                            color={activeCompYears.length === 0 ? 'primary' : 'default'}
                            variant={activeCompYears.length === 0 ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 700 }}
                          />
                          {compYearOptions.map((year) => {
                            const selected = activeCompYears.includes(year);
                            return (
                              <Chip
                                key={`va-comp-year-${year}`}
                                label={year}
                                size="small"
                                onClick={() => toggleCompYear(year)}
                                color={selected ? 'primary' : 'default'}
                                variant={selected ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 700 }}
                              />
                            );
                          })}
                        </Stack>
                      </Stack>

                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
                        {COMP_CHARTS.map((ck) => (
                          <Paper key={ck.label} elevation={0} sx={{ p: 1.5, borderRadius: 3, border: `1px solid ${ck.color}30`, minHeight: 320 }}>
                            <Box sx={{ mb: 1.2, textAlign: 'center' }}>
                              <Stack spacing={0.35} alignItems="center">
                                <Stack direction="row" spacing={0.7} alignItems="center">
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#34d399' }} />
                                  <Typography sx={{ fontWeight: 600, color: '#334155', fontSize: 12, lineHeight: 1.2 }}>
                                    Saber Pro: {ck.sprLabel}
                                  </Typography>
                                </Stack>
                                <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap>
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#60a5fa' }} />
                                  <Typography sx={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.35, fontWeight: 500 }}>
                                    Saber 11: {ck.s11Labels.join(' / ')}
                                  </Typography>
                                </Stack>
                              </Stack>
                            </Box>
                            <ResponsiveContainer width="100%" height="88%">
                              <BarChart data={histCompFiltrado} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={8}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="anio" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                  formatter={(v, name) => [`${formatNumber(v, 2)}%`, name === ck.s11Key ? `Saber 11: ${ck.s11Labels.join(' / ')}` : `Saber Pro: ${ck.sprLabel}`]}
                                />
                                <Bar
                                  dataKey={ck.s11Key}
                                  fill="#60a5fa"
                                  radius={[4, 4, 0, 0]}
                                  name="S11"
                                  label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: '#2563eb', formatter: (v) => `${formatNumber(v, 2)}%` }}
                                />
                                <Bar
                                  dataKey={ck.sprKey}
                                  fill="#34d399"
                                  radius={[4, 4, 0, 0]}
                                  name="SPR"
                                  label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: '#059669', formatter: (v) => `${formatNumber(v, 2)}%` }}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </Paper>
                        ))}
                      </Box>
                    </Paper>
                    );
                  })() : null}

                  {/* Evolución general S11 y Saber Pro */}
                  {histComp.length > 0 ? (() => {
                    const dualYearOptions = [...new Set(histComp.map((item) => String(item.anio)).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
                    const activeDualYears = vaDualYears.filter((year) => dualYearOptions.includes(year));
                    const histCompDual = activeDualYears.length ? histComp.filter((item) => activeDualYears.includes(String(item.anio))) : histComp;
                    const toggleDualYear = (year) => {
                      setVaDualYears((prev) => (
                        prev.includes(year) ? prev.filter((item) => item !== year) : [...prev, year]
                      ));
                    };
                    const avgPct = (row, keys) => {
                      const nums = keys
                        .map((key) => Number(row[key]))
                        .filter((value) => Number.isFinite(value));
                      if (!nums.length) return 0;
                      return nums.reduce((sum, value) => sum + value, 0) / nums.length;
                    };
                    const dualData = histCompDual.map((row) => ({
                      anio: String(row.anio),
                      s11_promedio: avgPct(row, ['s11_lec', 's11_raz', 's11_ciu', 's11_com', 's11_ing']),
                      spr_promedio: avgPct(row, ['spr_lec', 'spr_raz', 'spr_ciu', 'spr_com', 'spr_ing'])
                    }));

                    return (
                      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5' }}>
                        <Stack
                          direction={{ xs: 'column', lg: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', lg: 'center' }}
                          spacing={1.5}
                          sx={{ mb: 2 }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15, mb: 0.3 }}>
                              Evolución del Desempeño Promedio por Año
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: '#64748b', mb: 0.4 }}>
                              Porcentaje promedio anual de Saber 11 y Saber Pro
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>
                              Muestra usada en este gráfico: {cp.estudiantes || 0} estudiantes con cruce
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                            <Chip
                              label="Todos"
                              size="small"
                              onClick={() => setVaDualYears([])}
                              color={activeDualYears.length === 0 ? 'primary' : 'default'}
                              variant={activeDualYears.length === 0 ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 700 }}
                            />
                            {dualYearOptions.map((year) => {
                              const selected = activeDualYears.includes(year);
                              return (
                                <Chip
                                  key={`va-dual-year-${year}`}
                                  label={year}
                                  size="small"
                                  onClick={() => toggleDualYear(year)}
                                  color={selected ? 'primary' : 'default'}
                                  variant={selected ? 'filled' : 'outlined'}
                                  sx={{ fontWeight: 700 }}
                                />
                              );
                            })}
                          </Stack>
                        </Stack>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
                          {[
                            { title: 'Promedio General Saber 11', key: 's11_promedio', color: '#60a5fa', textColor: '#2563eb' },
                            { title: 'Promedio General Saber Pro', key: 'spr_promedio', color: '#34d399', textColor: '#059669' }
                          ].map((chart) => (
                            <Paper key={chart.title} elevation={0} sx={{ p: 1.75, borderRadius: 3, border: `1px solid ${chart.color}40`, minHeight: 320 }}>
                              <Typography sx={{ fontWeight: 800, color: '#334155', fontSize: 13, mb: 1.2, textAlign: 'center' }}>
                                {chart.title}
                              </Typography>
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={dualData} margin={{ top: 12, right: 16, left: 4, bottom: 0 }} barCategoryGap="12%">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                  <XAxis dataKey="anio" tick={{ fontSize: 10, fontWeight: 700 }} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                  <Tooltip formatter={(v) => [`${formatNumber(v, 2)}%`, chart.title]} />
                                  <Bar
                                    dataKey={chart.key}
                                    fill={chart.color}
                                    barSize={50}
                                    radius={[6, 6, 0, 0]}
                                    label={{ position: 'top', fontSize: 11, fontWeight: 800, fill: chart.textColor, formatter: (v) => `${formatNumber(v, 2)}%` }}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </Paper>
                          ))}
                        </Box>
                      </Paper>
                    );
                  })() : null}
                </Stack>
              );
            })()}
          </Stack>
        ) : null}

        {section === 'va_nbc' ? (
          <Stack spacing={3}>
            {!hasNbcFilters ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontSize: 14, color: '#94a3b8' }}>
                  Aplica filtros de Año o Grupo de referencia para construir el tablero NBC.
                </Typography>
              </Box>
            ) : null}

            {hasNbcFilters ? (
              <>

            {/* â”€â”€ HEADER: gradient banner con selector integrado â”€â”€ */}
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
                  <Box sx={{ minWidth: { xs: '100%', lg: 280 }, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
                    <Box sx={{ px: 2, py: 1.25, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', mb: 0.45 }}>
                        GRUPO DE REFERENCIA ACTIVO
                      </Typography>
                      <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
                        {selectedNbc || 'Todos'}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Box>
            </Paper>

            {/* Loading */}
            {nbcDetalleLoading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

            {nbcDetalle ? (
              <Stack spacing={3}>

                {/* â”€â”€ FILA 1: 4 KPIs â€” CSS Grid igual tamaÃ±o garantizado â”€â”€ */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  <KpiDetailCard
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>}
                    label="Puntaje Global"
                    value={formatNumber(nbcDetalle.summary.promedio_global, 1)}
                    subtitle="de 300 puntos"
                    percent={nbcDetalle.summary.pct_puntaje || 0}
                    quintil={`Q${nbcDetalle.summary.q_puntaje}`}
                    color={qScale(nbcDetalle.summary.q_puntaje).color}
                  />
                  <KpiDetailCard
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                    label="Percentil Nacional"
                    value={formatNumber(nbcDetalle.summary.promedio_percentil, 1)}
                    subtitle="percentil promedio"
                    percent={nbcDetalle.summary.promedio_percentil || 0}
                    quintil={`Q${nbcDetalle.summary.q_nacional}`}
                    color={qScale(nbcDetalle.summary.q_nacional).color}
                  />
                  <Paper elevation={0} sx={{
                    p: 2.5, borderRadius: 3,
                    background: `linear-gradient(135deg, ${qScale(nbcDetalle.summary.q_general).color}14, ${qScale(nbcDetalle.summary.q_general).color}28)`,
                    border: `2px solid ${qScale(nbcDetalle.summary.q_general).color}55`,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ color: qScale(nbcDetalle.summary.q_general).color, display: 'flex' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                      </Box>
                      <Typography sx={{ fontSize: '10px', color: qScale(nbcDetalle.summary.q_general).color, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Quintil General</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '48px', fontWeight: 900, color: qScale(nbcDetalle.summary.q_general).color, lineHeight: 1, my: 1 }}>
                      Q{nbcDetalle.summary.q_general}
                    </Typography>
                    <Box sx={{ display: 'inline-block', bgcolor: qScale(nbcDetalle.summary.q_general).color, color: '#fff', px: 2, py: 0.5, borderRadius: '20px', fontSize: '11px', fontWeight: 700, alignSelf: 'flex-start' }}>
                      {nbcDetalle.summary.etiqueta}
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
                      <Typography sx={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>En este grupo</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '40px', fontWeight: 800, color: '#1e3a8a', lineHeight: 1, my: 1 }}>
                      {nbcDetalle.summary.estudiantes || 0}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#64748b' }}>subconjunto del total filtrado</Typography>
                  </Paper>
                </Box>

                {/* â”€â”€ FILA 2: DistribuciÃ³n (50%) + Resumen (50%) â€” CSS Grid igual altura â”€â”€ */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  <DistribucionQuintilCard distribucion={nbcDetalle.distribucion || []} />
                  <ResumenIndicadoresCard summary={nbcDetalle.summary} distribucion={nbcDetalle.distribucion || []} />
                </Box>

                {/* â”€â”€ ClasificaciÃ³n banner â”€â”€ */}
                <ClasificacionBanner summary={nbcDetalle.summary} />

                {/* â”€â”€ FILA 3: EvoluciÃ³n â€” Ãºltimos 5 aÃ±os, siempre dinÃ¡mico â”€â”€ */}
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

                  const firstY = hist5[0].anio || last5Years[0];
                  const lastY = hist5[hist5.length - 1].anio || last5Years[last5Years.length - 1];

                  const PeriodTick = ({ x, y, payload }) => {
                    const parts = String(payload.value || '').split('-');
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
                                {['AÑO', 'PUNTAJE', 'P. NAC', 'N'].map((h) => (
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
                              {[['PUNTAJE', 'Puntaje Global (0–300)'], ['P. NAC', 'Percentil Nacional'], ['N', 'Estudiantes evaluados']].map(([k, v]) => (
                                <Typography key={k} sx={{ fontSize: '9px', color: '#94a3b8' }}>
                                  <Typography component="span" sx={{ fontWeight: 700, fontSize: '9px', color: '#2563eb' }}>{k}</Typography>
                                  {` = ${v}`}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        /* PERIODOS MODE â€” chart + table */
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
                                  {['AÑO', 'PER.', 'PUNTAJE', 'P. NAC', 'N'].map((h) => (
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
                                {[['PUNTAJE', 'Puntaje Global (0–300)'], ['P. NAC', 'Percentil Nacional'], ['N', 'Estudiantes evaluados']].map(([k, v]) => (
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

                {/* â”€â”€ MetodologÃ­a footer â”€â”€ */}
                <MetodologiaFooter />
              </Stack>
            ) : null}

            {!nbcDetalle && !nbcDetalleLoading && selectedNbc ? (
              <Alert severity="info" sx={{ borderRadius: 3 }}>Sin datos disponibles para el grupo seleccionado.</Alert>
            ) : null}

            {!nbcDetalle && !nbcDetalleLoading && !selectedNbc ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography sx={{ fontSize: 14, color: '#94a3b8' }}>
                  Selecciona un Grupo de referencia para ver el análisis detallado NBC.
                </Typography>
              </Box>
            ) : null}

            {/* â”€â”€ FILA 4+5: Ranking + Tabla â€” 2 columnas con toggle Anual/Periodos â”€â”€ */}
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
            </>
            ) : null}

          </Stack>
        ) : null}

        {section === 'va_programas' ? (
          <Stack spacing={2.5}>
            {!hasProgramFilters ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontSize: 14, color: '#94a3b8' }}>
                  Aplica filtros de Año o Programa para construir el tablero de Programas.
                </Typography>
              </Box>
            ) : programaDetalleLoading ? (
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
                  <Paper elevation={0} sx={{ borderRadius: 3.5, overflow: 'hidden', boxShadow: '0 14px 34px rgba(37,99,235,0.16)' }}>
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #1e3a8a 100%)',
                        px: { xs: 2.25, md: 3.5 },
                        py: { xs: 2.25, md: 2.75 },
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2,
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 220 }}>
                        <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <rect x="4" y="3" width="16" height="18" rx="2" />
                            <line x1="8" y1="7" x2="16" y2="7" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                            <line x1="8" y1="17" x2="13" y2="17" />
                          </svg>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: { xs: 18, md: 20 }, fontWeight: 900, color: '#fff', lineHeight: 1.15 }}>
                            ANÁLISIS POR PROGRAMA ACADÉMICO
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', mt: 0.75, fontWeight: 700 }}>
                            {sum.programa || selectedPrograma}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', mt: 0.65 }}>
                            {(programasPayload.rows || []).length} programas · {programasPayload.total_estudiantes} estudiantes evaluados
                          </Typography>
                        </Box>
                      </Stack>

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'repeat(3, minmax(88px, 1fr))', md: 'repeat(3, minmax(92px, 112px))' },
                          gap: 1.25,
                          width: { xs: '100%', md: 'auto' }
                        }}
                      >
                        <Box sx={{ textAlign: 'center', px: 1.5, py: 1.2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)' }}>
                          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.08em' }}>AÑO</Typography>
                          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.05, mt: 0.35 }}>
                            {filters.anios.length === 1 ? filters.anios[0] : 'Todos'}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', px: 1.5, py: 1.2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)' }}>
                          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.08em' }}>TOTAL BASE</Typography>
                          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.05, mt: 0.35 }}>
                            {programasPayload.total_estudiantes || 0}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center', px: 1.5, py: 1.2, borderRadius: 2, bgcolor: '#d89200', boxShadow: '0 8px 18px rgba(216,146,0,0.28)' }}>
                          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.78)', fontWeight: 700, letterSpacing: '0.08em' }}>QUINTIL</Typography>
                          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.05, mt: 0.35 }}>
                            Q{sum.q_general}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>

                  {/* 5 KPI cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', xl: 'repeat(5,1fr)' }, gap: 1.5 }}>
                    {comps.map((c) => {
                      const qc = quintileTone(`Q${c.quintil}`);
                      return (
                        <Paper key={c.modulo} elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1.5px solid ${qc.color}30`, borderTop: `4px solid ${qc.color}`, background: '#fff', textAlign: 'left', boxShadow: '0 3px 14px rgba(15,23,42,0.05)' }}>
                          <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.75, lineHeight: 1.3 }}>{COMP_LABELS[c.modulo] || c.modulo}</Typography>
                          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{c.puntaje != null ? formatNumber(c.puntaje, 1) : '—'}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.1 }}>
                            <Typography sx={{ fontSize: 10, fontWeight: 700, color: qc.color }}>{formatNumber(c.pct_puntaje, 1)}%</Typography>
                            <Box sx={{ display: 'inline-block', px: 1.15, py: 0.28, borderRadius: 999, bgcolor: '#d89200' }}>
                              <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>Q{c.quintil}</Typography>
                            </Box>
                          </Stack>
                          <Box sx={{ mt: 1.1, height: 6, borderRadius: 999, bgcolor: '#eef2ff', overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.max(0, Math.min(c.pct_puntaje || 0, 100))}%`, height: '100%', bgcolor: '#d89200', borderRadius: 999 }} />
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>

                  {/* 3-col grid */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.15fr 1fr 1fr' }, gap: 2 }}>
                    {/* Comparativa */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', mb: 0.25 }}>Comparativa de Puntajes</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1.5 }}>Promedio por competencia genérica · escala 0–300 · programa activo: {sum.estudiantes || 0} estudiantes</Typography>
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
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1.5 }}>Posición nacional por módulo · programa activo: {sum.estudiantes || 0} estudiantes</Typography>
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

                    {/* DistribuciÃ³n por nivel */}
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e3a8a', mb: 0.25 }}>Distribución por Nivel</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8', mb: 1 }}>Competencias genéricas (N1–N4) · Inglés (MCER) · programa activo: {sum.estudiantes || 0} estudiantes</Typography>
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
            {!hasInstitutionalFilters ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography sx={{ fontSize: 14, color: '#94a3b8' }}>
                  Aplica un filtro de Año para construir el tablero Institucional.
                </Typography>
              </Box>
            ) : institucionalLoading ? (
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
              const anioLabel = filters.anios.length === 1 ? String(filters.anios[0]) : (filters.anios.length > 1 ? filters.anios.join(', ') : 'Todos');

              return (
                <Stack spacing={2}>
                  {/* Header */}
                  <Box sx={{ background: 'linear-gradient(135deg,#2563eb 0%, #1d4ed8 55%, #1e3a8a 100%)', p: { xs: 2.25, md: '22px 28px' }, borderRadius: 3.5, boxShadow: '0 14px 34px rgba(37,99,235,0.16)' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
                      <Stack direction="row" gap={1.5} alignItems="center" sx={{ flex: 1, minWidth: 240 }}>
                        <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>ANÁLISIS INSTITUCIONAL SABER PRO</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', mt: 0.25 }}>Universidad CESMAG · Competencias Genéricas</Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" gap={1.25} flexWrap="wrap">
                        {[['PERÍODO', anioLabel], ['EVALUADOS', String(sum.estudiantes || 0)], ['PROGRAMAS', String(sum.programas || 0)]].map(([lbl, val]) => (
                          <Box key={lbl} sx={{ minWidth: 92, px: 2, py: 1.1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.12)', textAlign: 'center' }}>
                            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', fontWeight: 600 }}>{lbl}</Typography>
                            <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{val}</Typography>
                          </Box>
                        ))}
                        <Box sx={{ minWidth: 92, px: 2, py: 1.1, borderRadius: 1.5, bgcolor: '#d89200', textAlign: 'center', boxShadow: '0 8px 18px rgba(216,146,0,0.28)' }}>
                          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', fontWeight: 600 }}>QUINTIL</Typography>
                          <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Q{sum.q_general}</Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </Box>

                  {/* 5 KPI cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', xl: 'repeat(5,1fr)' }, gap: 1.5 }}>
                    {comps.map((c) => {
                      const dispPct = c.percentil != null ? c.percentil : c.pct_puntaje;
                      return (
                        <Paper key={c.modulo} elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', borderTop: '4px solid #d89200', boxShadow: '0 3px 14px rgba(15,23,42,0.05)' }}>
                          <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
                            <Box sx={{ color: '#d89200', display: 'flex' }}>{COMP_ICONS[c.modulo]}</Box>
                            <Typography sx={{ fontSize: 8, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.25 }}>{COMP_SHORT[c.modulo] || c.modulo}</Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 26, fontWeight: 900, color: '#1e3a8a', lineHeight: 1 }}>{c.puntaje != null ? formatNumber(c.puntaje, 1) : '—'}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.25}>
                            <Stack direction="row" alignItems="center" gap={0.5}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d89200" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#d89200' }}>{formatNumber(dispPct, 1)}%</Typography>
                            </Stack>
                            <Box sx={{ px: 1.25, py: 0.3, borderRadius: 1.5, bgcolor: '#d89200' }}>
                              <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>Q{c.quintil}</Typography>
                            </Box>
                          </Stack>
                          <Box sx={{ mt: 1.25, height: 5, borderRadius: 3, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${Math.min(dispPct, 100)}%`, bgcolor: '#d89200', borderRadius: 3 }} />
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>

                  {/* 3-column grid */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.15fr 1fr 1fr' }, gap: 2 }}>
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

                    {/* DistribuciÃ³n por nivel */}
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

                  {/* ClasificaciÃ³n */}
                  <Box sx={{ background: 'linear-gradient(135deg,#fffdf5,#eef5f6)', borderRadius: 3, p: '22px 28px', border: '2px solid #d89200' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
                      <Stack direction="row" alignItems="center" gap={2}>
                        <Box sx={{ color: '#d89200', display: 'flex' }}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 10, color: '#d89200', fontWeight: 700, letterSpacing: '0.1em', mb: 0.25 }}>CLASIFICACIÓN INSTITUCIONAL UNICESMAG</Typography>
                          <Typography sx={{ fontSize: 26, fontWeight: 900, color: '#d89200', lineHeight: 1 }}>QUINTIL {sum.q_general} — {sum.etiqueta}</Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" gap={1.25}>
                        {[['PUNTAJE', formatNumber(sum.promedio_global, 1), '#1e3a8a'], ['PERCENTIL', formatNumber(avgPct, 1) + '%', '#2563eb']].map(([lbl, val, clr]) => (
                          <Box key={lbl} sx={{ px: 2.5, py: 1.5, bgcolor: '#fff', borderRadius: 1.5, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                            <Typography sx={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>{lbl}</Typography>
                            <Typography sx={{ fontSize: 18, fontWeight: 800, color: clr, mt: 0.25 }}>{val}</Typography>
                          </Box>
                        ))}
                        <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#d89200', borderRadius: 1.5, textAlign: 'center', boxShadow: '0 8px 18px rgba(216,146,0,0.22)' }}>
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
