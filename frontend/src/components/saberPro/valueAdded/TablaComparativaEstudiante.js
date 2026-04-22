import React, { useMemo } from 'react';
import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';

const MODULES = [
  { key: 'lectura_critica', label: 'Lectura Critica' },
  { key: 'razonamiento_cuantitativo', label: 'Razonamiento Cuantitativo' },
  { key: 'competencias_ciudadanas', label: 'Competencias Ciudadanas' },
  { key: 'comunicacion_escrita', label: 'Comunicacion Escrita' },
  { key: 'ingles', label: 'Ingles' }
];

const TYPE_CARDS = [
  { tipo: 1, tone: '#1d4ed8', title: 'TIPO 1', modules: ['Español y Literatura', 'Conocimiento Matemático', 'Física', 'Química', 'Sociales', 'Electiva'] },
  { tipo: 2, tone: '#15803d', title: 'TIPO 2', modules: ['Lenguaje', 'Aptitud Matemática', 'Biología', 'Conocimiento Matemático', 'Física', 'Química', 'Sociales', 'Electiva'] },
  { tipo: 3, tone: '#4338ca', title: 'TIPO 3', modules: ['Filosofía', 'Lenguaje', 'Biología', 'Física', 'Matemáticas', 'Química', 'Geografía', 'Historia', 'Inglés'] },
  { tipo: 4, tone: '#0f766e', title: 'TIPO 4', modules: ['Filosofía', 'Lenguaje', 'Biología', 'Física', 'Matemáticas', 'Química', 'Sociales', 'Inglés'] },
  { tipo: 5, tone: '#1e40af', title: 'TIPO 5', modules: ['Lectura Crítica', 'Ciencias Naturales', 'Matemáticas', 'Razonamiento Cuantitativo', 'Competencias Ciudadadanas', 'Sociales y Ciudadana', 'Inglés'] },
  { tipo: 6, tone: '#166534', title: 'TIPO 6', modules: ['Lectura Crítica', 'Ciencias Naturales', 'Matemáticas', 'Sociales y Ciudadana', 'Inglés'] },
  { tipo: 7, tone: '#4c1d95', title: 'TIPO 7', modules: ['Lectura Crítica', 'Ciencias Naturales', 'Matemáticas', 'Sociales y Ciudadana', 'Inglés'] }
];

const LEGACY_MODULES = [
  { key: 'lectura', label: 'Lectura Critica', entrada: 'lectura_entrada', salida: 'lectura_salida', va: 'va_lectura' },
  { key: 'razonamiento', label: 'Razonamiento Cuantitativo', entrada: 'razonamiento_entrada', salida: 'razonamiento_salida', va: 'va_razonamiento' },
  { key: 'ciudadanas', label: 'Competencias Ciudadanas', entrada: 'ciudadanas_entrada', salida: 'ciudadanas_salida', va: 'va_ciudadanas' },
  { key: 'comunicacion', label: 'Comunicacion Escrita', entrada: 'comunicacion_entrada', salida: 'comunicacion_salida', va: 'va_comunicacion' },
  { key: 'ingles', label: 'Ingles', entrada: 'ingles_entrada', salida: 'ingles_salida', va: 'va_ingles' }
];

const MODULE_LABEL_MAP = {
  lectura_critica: 'Lectura Critica',
  razonamiento_cuantitativo: 'Razonamiento Cuantitativo',
  competencias_ciudadanas: 'Competencias Ciudadanas',
  comunicacion_escrita: 'Comunicacion Escrita',
  ingles: 'Ingles'
};

const fmt = (value, digits = 2) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
};

const fmtSigned = (value, digits = 2) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%` : '—';
};

const toneForValue = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return { color: '#94a3b8', bg: '#f8fafc' };
  if (n >= 0) return { color: '#16a34a', bg: '#dcfce7' };
  return { color: '#dc2626', bg: '#fee2e2' };
};

function LegacyTable({ student }) {
  const rows = LEGACY_MODULES.map((module) => {
    const s11Value = student[module.entrada] != null ? Number(student[module.entrada]) * 100 : null;
    const sprValue = student[module.salida] != null ? Number(student[module.salida]) : null;
    const sprPct = sprValue != null ? (sprValue * 100) / 300 : null;
    const vaPct = student[module.va] != null ? Number(student[module.va]) * 100 : null;
    return { ...module, s11Value, sprValue, sprPct, vaPct };
  });

  return (
    <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
      <Box sx={{ p: 2.2, background: 'linear-gradient(135deg, #0b4ea2 0%, #1565c0 55%, #1d4ed8 100%)' }}>
        <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>
          Tabla Comparativa Saber 11 vs Saber Pro
        </Typography>
        <Typography sx={{ fontSize: 15, color: 'rgba(255,255,255,0.92)', fontWeight: 700, mt: 0.8 }}>
          {student.nombre || student.documento}
        </Typography>
      </Box>
      <Box sx={{ p: 1.5, bgcolor: '#f8fbff' }}>
        <Stack spacing={1}>
          {rows.map((row) => (
            <Box key={row.key} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '180px 1fr 1fr 140px' }, border: '1px solid #dbeafe', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
              <Box sx={{ p: 1.2, bgcolor: '#eff6ff' }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: '#1e293b' }}>{row.label}</Typography>
              </Box>
              <Box sx={{ p: 1.2, borderLeft: { md: '1px solid #dbeafe' } }}>
                <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>Saber 11</Typography>
                <Typography sx={{ fontSize: 16, color: '#1d4ed8', fontWeight: 900 }}>{fmt(row.s11Value)}%</Typography>
              </Box>
              <Box sx={{ p: 1.2, borderLeft: { md: '1px solid #dbeafe' } }}>
                <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>Saber Pro</Typography>
                <Typography sx={{ fontSize: 16, color: '#1565c0', fontWeight: 900 }}>
                  {fmt(row.sprValue, row.sprValue != null && row.sprValue % 1 === 0 ? 0 : 1)} · {fmt(row.sprPct)}%
                </Typography>
              </Box>
              <Box sx={{ p: 1.2, bgcolor: toneForValue(row.vaPct).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: { md: '1px solid #dbeafe' } }}>
                <Typography sx={{ fontSize: 18, color: toneForValue(row.vaPct).color, fontWeight: 900 }}>
                  {fmtSigned(row.vaPct)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
}

function TypeReferenceCards({ activeTipo }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 1.2 }}>
      {TYPE_CARDS.map((card) => {
        const active = Number(activeTipo) === card.tipo;
        return (
          <Paper
            key={card.tipo}
            elevation={0}
            sx={{
              p: 1.4,
              borderRadius: 3,
              border: `2px solid ${active ? card.tone : '#dbeafe'}`,
              bgcolor: active ? `${card.tone}12` : '#fff',
              boxShadow: active ? '0 12px 30px rgba(37,99,235,0.12)' : 'none'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: card.tone }}>{card.title}</Typography>
              {active && <Chip size="small" label="Aplicado" sx={{ bgcolor: card.tone, color: '#fff', fontWeight: 800 }} />}
            </Stack>
            <Typography sx={{ fontSize: 10, color: '#475569', fontWeight: 800, mt: 0.6, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Referencia Saber 11 usada para la equivalencia
            </Typography>
            <Stack spacing={0.45}>
              {card.modules.map((module) => (
                <Typography key={module} sx={{ fontSize: 11.5, color: '#334155', fontWeight: 600 }}>
                  • {module}
                </Typography>
              ))}
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}

export default function TablaComparativaEstudiante({ student }) {
  const detail = student || null;
  const isLegacy = !!detail && !detail?.saber11 && (
    Object.prototype.hasOwnProperty.call(detail, 'lectura_entrada') ||
    Object.prototype.hasOwnProperty.call(detail, 'va_global')
  );
  const s11 = detail?.saber11 || {};
  const spr = detail?.saberPro || {};
  const equivalencias = detail?.equivalencias || {};
  const activeTipo = detail?.s11_tipo?.tipo_numero || null;
  const sprLabel = detail?.is_tyt ? 'Saber TyT' : 'Saber Pro';
  const maxPts = Number(spr.max_pts || (detail?.is_tyt ? 200 : 300));
  const s11HeaderTitle = detail?.s11_tipo ? `Saber 11 - Tipo ${detail.s11_tipo.tipo_numero}` : 'Saber 11';

  const rows = useMemo(() => (
    MODULES.map((module) => {
      const eq = equivalencias[module.key] || null;
      const sourceCols = Array.isArray(eq?.s11_cols) ? eq.s11_cols : [];
      const scoredCols = sourceCols.filter((item) => item?.score != null);
      const weighted = scoredCols.length
        ? scoredCols.reduce((acc, item) => acc + Number(item.score || 0), 0)
        : null;
      const s11Score = eq?.score != null ? Number(eq.score) : null;
      const sprField = module.key === 'lectura_critica'
        ? 'lectura'
        : module.key === 'razonamiento_cuantitativo'
          ? 'razonamiento'
          : module.key === 'competencias_ciudadanas'
            ? 'ciudadanas'
            : module.key === 'comunicacion_escrita'
              ? 'comunicacion'
              : 'ingles';
      const sprScore = spr[sprField] != null ? Number(spr[sprField]) : null;
      const sprPct = sprScore != null && maxPts > 0 ? (sprScore * 100) / maxPts : null;
      const va = sprPct != null && s11Score != null ? sprPct - s11Score : null;
      return {
        ...module,
        sourceCols,
        weighted,
        s11Score,
        sprScore,
        sprPct,
        va,
        sprCompetencia: MODULE_LABEL_MAP[module.key] || module.label
      };
    })
  ), [equivalencias, maxPts, spr]);

  if (!detail) return null;
  if (isLegacy) return <LegacyTable student={detail} />;

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #bfdbfe' }}>
        <Box sx={{ p: { xs: 2, md: 3 }, background: 'linear-gradient(135deg, #0b4ea2 0%, #1565c0 55%, #1d4ed8 100%)' }}>
          <Typography sx={{ fontSize: { xs: 25, md: 32 }, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>
            Tabla Comparativa Saber 11 vs {sprLabel}
          </Typography>
          <Typography sx={{ fontSize: { xs: 16, md: 20 }, color: 'rgba(255,255,255,0.95)', fontWeight: 700, mt: 1 }}>
            {detail.nombre || detail.documento}
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} mt={1.4} flexWrap="wrap" useFlexGap>
            <Chip label={`Documento ${detail.documento || '—'}`} sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 800 }} />
            <Chip label={detail.programa || 'Programa no disponible'} sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 800 }} />
            <Chip label={`${sprLabel} ${detail.anio || '—'}${detail.periodo ? `-${detail.periodo}` : ''}`} sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 800 }} />
            <Chip label={`Saber 11 ${detail.s11_anio || '—'}`} sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 800 }} />
            {detail.s11_tipo && <Chip label={detail.s11_tipo.nombre} sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 900 }} />}
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 1.5, md: 2.2 }, bgcolor: '#f8fbff' }}>
          <Box sx={{ overflowX: 'auto', borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#fff' }}>
            <Box component="table" sx={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" colSpan={3} sx={{ p: 1.4, bgcolor: '#1459ad', color: '#fff', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', textAlign: 'left' }}>
                    {sprLabel}
                  </Box>
                  <Box component="th" colSpan={3} sx={{ p: 1.4, bgcolor: '#0f4c81', color: '#fff', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', textAlign: 'left', borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                    {s11HeaderTitle}
                  </Box>
                  <Box component="th" rowSpan={2} sx={{ p: 1.4, bgcolor: '#1459ad', color: '#fff', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', borderLeft: '2px solid rgba(255,255,255,0.2)' }}>
                    Valor Agregado
                  </Box>
                </Box>
                <Box component="tr">
                  {['Competencia', 'Puntaje', '%', 'Competencias', 'Puntaje Saber 11', '%'].map((label, index) => (
                    <Box
                      key={label}
                      component="th"
                      sx={{
                        p: 1.15,
                        bgcolor: index < 3 ? '#1d5faf' : '#14507f',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        textAlign: index === 1 || index === 2 || index >= 4 ? 'center' : 'left',
                        borderTop: '1px solid rgba(255,255,255,0.12)',
                        borderLeft: index === 3 ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box component="tbody">
                {rows.map((row, index) => {
                  const rowTone = toneForValue(row.va);
                  const bg = index % 2 === 0 ? '#ffffff' : '#f8fbff';
                  return (
                    <Box component="tr" key={row.key}>
                      <Box component="td" sx={{ p: 1.2, bgcolor: bg, borderTop: '1px solid #dbeafe', fontSize: 12.5, fontWeight: 900, color: '#0f766e', textTransform: 'uppercase' }}>
                        {row.sprCompetencia}
                      </Box>
                      <Box component="td" sx={{ p: 1.2, bgcolor: bg, borderTop: '1px solid #dbeafe', textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: '#1565c0' }}>
                        {fmt(row.sprScore, row.sprScore != null && row.sprScore % 1 === 0 ? 0 : 1)}
                      </Box>
                      <Box component="td" sx={{ p: 1.2, bgcolor: bg, borderTop: '1px solid #dbeafe', textAlign: 'center', fontSize: 12.5, fontWeight: 900, color: '#16a34a' }}>
                        {fmt(row.sprPct)}%
                      </Box>
                      <Box component="td" sx={{ p: 0, bgcolor: bg, borderTop: '1px solid #dbeafe', borderLeft: '2px solid #bfdbfe', minWidth: 360 }}>
                        {row.sourceCols.length ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 58 }}>
                            {row.sourceCols.map((col, colIndex) => (
                              <Box
                                key={col.col}
                                sx={{
                                  px: 1,
                                  py: 0.7,
                                  borderTop: colIndex === 0 ? 'none' : '1.5px solid #bfdbfe',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 1,
                                  bgcolor: col.score != null ? '#f8fbff' : '#f8fafc'
                                }}
                              >
                                <Typography sx={{ fontSize: 10.5, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.2, pr: 1 }}>
                                  {col.label}
                                </Typography>
                                <Typography sx={{ fontSize: 13, color: col.score != null ? '#1d4ed8' : '#94a3b8', fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {col.score != null ? fmt(col.score, 1) : '—'}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Typography sx={{ px: 1.2, py: 1.2, fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>Sin equivalencias</Typography>
                        )}
                      </Box>
                      <Box component="td" sx={{ p: 1.2, bgcolor: bg, borderTop: '1px solid #dbeafe', textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: '#1d4ed8' }}>
                        {fmt(row.s11Score)}
                      </Box>
                      <Box component="td" sx={{ p: 1.2, bgcolor: bg, borderTop: '1px solid #dbeafe', textAlign: 'center', fontSize: 12.5, fontWeight: 900, color: '#0f766e' }}>
                        {fmt(row.s11Score)}%
                      </Box>
                      <Box component="td" sx={{ p: 1.2, bgcolor: rowTone.bg, borderTop: '1px solid #dbeafe', borderLeft: '2px solid #bfdbfe', textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 900, color: rowTone.color }}>
                          {fmtSigned(row.va)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}

                <Box component="tr">
                  <Box component="td" sx={{ p: 1.2, bgcolor: '#1459ad', color: '#fff', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>
                    Resumen
                  </Box>
                  <Box component="td" sx={{ p: 1.2, bgcolor: '#0f3f7e', color: '#fff', textAlign: 'center', fontSize: 22, fontWeight: 900 }}>
                    {fmt(spr.formula)}
                  </Box>
                  <Box component="td" sx={{ p: 1.2, bgcolor: '#0f3f7e', color: '#bfdbfe', textAlign: 'center', fontSize: 12, fontWeight: 800 }}>
                    {fmt(spr.va_pct)}%
                  </Box>
                  <Box component="td" sx={{ p: 1.2, bgcolor: '#0f3f7e', borderLeft: '2px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                    {detail.s11_tipo?.nombre || 'Saber 11'}
                  </Box>
                  <Box component="td" sx={{ p: 1.2, bgcolor: '#0f3f7e', color: '#fff', textAlign: 'center', fontSize: 22, fontWeight: 900 }}>
                    {fmt(s11.resultado_ponderado)}
                  </Box>
                  <Box component="td" sx={{ p: 1.2, bgcolor: '#0f3f7e', color: '#c7d2fe', textAlign: 'center', fontSize: 12, fontWeight: 800 }}>
                    {fmt(s11.va_pct)}%
                  </Box>
                  <Box component="td" sx={{ p: 1.2, bgcolor: toneForValue(detail.va_final).bg, borderLeft: '2px solid rgba(191,219,254,0.9)', textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 22, fontWeight: 900, color: toneForValue(detail.va_final).color }}>
                      {fmtSigned(detail.va_final)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#1e3a8a', mb: 1.2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Referencia de Tarjetas Saber 11
          </Typography>
          <TypeReferenceCards activeTipo={activeTipo} />

          <Box sx={{ mt: 2, p: 1.5, borderRadius: 3, bgcolor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <Typography sx={{ fontSize: 11.5, color: '#1e3a8a', fontWeight: 700, lineHeight: 1.7 }}>
              La comparativa toma el registro de Saber 11 inmediatamente anterior al año del {sprLabel} y detecta automáticamente el tipo de tarjeta
              para construir las equivalencias por módulo. El valor agregado final se calcula como la diferencia entre el porcentaje promedio
              del {sprLabel} y el porcentaje equivalente consolidado de Saber 11.
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Stack>
  );
}
