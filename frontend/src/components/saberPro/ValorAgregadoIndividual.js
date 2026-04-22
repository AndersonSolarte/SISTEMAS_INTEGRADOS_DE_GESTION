import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';
import TablaComparativaEstudiante from './valueAdded/TablaComparativaEstudiante';

function CompactFilter({ label, value, onChange, options = [], placeholder = 'Todos' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(
    () => options.filter((option) => String(option).toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  return (
    <Box ref={ref} sx={{ position: 'relative', flex: 1, minWidth: 180 }}>
      <Box
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          cursor: 'pointer',
          borderRadius: 3,
          p: '12px 14px',
          minHeight: 58,
          bgcolor: value ? '#eef2ff' : '#fff',
          border: `1.5px solid ${value ? '#2563eb' : '#dbeafe'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          transition: 'all 0.18s ease',
          '&:hover': { borderColor: '#2563eb', bgcolor: '#f8fbff' }
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1e293b', mt: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value || placeholder}
          </Typography>
        </Box>
        <Typography sx={{ color: '#2563eb', fontWeight: 900 }}>{open ? '▴' : '▾'}</Typography>
      </Box>

      {open && (
        <Box sx={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '100%', zIndex: 30, bgcolor: '#fff', borderRadius: 3, border: '1px solid #dbeafe', boxShadow: '0 20px 35px rgba(15, 23, 42, 0.12)', overflow: 'hidden' }}>
          <Box sx={{ p: 1, borderBottom: '1px solid #eff6ff' }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{ width: '100%', border: '1px solid #dbeafe', borderRadius: 10, padding: '9px 10px', outline: 'none', fontSize: 12 }}
            />
          </Box>
          <Box
            onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
            sx={{ px: 1.5, py: 1, cursor: 'pointer', borderBottom: '1px solid #eff6ff', '&:hover': { bgcolor: '#f8fbff' } }}
          >
            <Typography sx={{ fontSize: 12, color: '#2563eb', fontWeight: 800 }}>{placeholder}</Typography>
          </Box>
          <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.map((option) => (
              <Box
                key={String(option)}
                onClick={() => { onChange(option); setOpen(false); setSearch(''); }}
                sx={{ px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: '#f8fbff' } }}
              >
                <Typography sx={{ fontSize: 12.5, color: '#334155', fontWeight: value === option ? 800 : 600 }}>
                  {String(option)}
                </Typography>
              </Box>
            ))}
            {filtered.length === 0 && (
              <Box sx={{ px: 2, py: 2 }}>
                <Typography sx={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Sin resultados</Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function StudentSearch({ value, onInputChange, onSelect, suggestions, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <Box ref={ref} sx={{ position: 'relative', flex: 1.15, minWidth: 260 }}>
      <Box sx={{ borderRadius: 3, p: '12px 14px', minHeight: 58, bgcolor: '#fff', border: '1.5px solid #dbeafe', '&:focus-within': { borderColor: '#2563eb', bgcolor: '#f8fbff' } }}>
        <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Estudiante
        </Typography>
        <input
          value={value}
          onChange={(e) => {
            onInputChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por documento, nombre o registro..."
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', paddingTop: 6, fontSize: 13, fontWeight: 700, color: '#1e293b' }}
        />
      </Box>

      {open && (value.trim() || suggestions.length > 0) && (
        <Box sx={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '100%', zIndex: 30, bgcolor: '#fff', borderRadius: 3, border: '1px solid #dbeafe', boxShadow: '0 20px 35px rgba(15, 23, 42, 0.12)', overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ py: 2.5, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={20} />
            </Box>
          ) : suggestions.length > 0 ? (
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {suggestions.map((student) => (
                <Box
                  key={`${student.documento}-${student.anio}-${student.numero_registro || 'sinreg'}`}
                  onClick={() => {
                    onSelect(student);
                    setOpen(false);
                  }}
                  sx={{ px: 1.5, py: 1.1, cursor: 'pointer', borderBottom: '1px solid #eff6ff', '&:hover': { bgcolor: '#f8fbff' } }}
                >
                  <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: '#1e293b' }}>{student.documento}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{student.nombre || 'Estudiante sin nombre'}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                    {student.programa || 'Programa no disponible'} · Año {student.anio || '—'}{student.periodo ? `-${student.periodo}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ px: 2, py: 2 }}>
              <Typography sx={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                No hay estudiantes que coincidan con la búsqueda.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function ValorAgregadoIndividual() {
  const [catalogs, setCatalogs] = useState({ programas: [], anios: [] });
  const [programa, setPrograma] = useState('');
  const [anio, setAnio] = useState('');
  const [tipoPrueba, setTipoPrueba] = useState('');
  const [filtroVa, setFiltroVa] = useState('General');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [loadingFiltros, setLoadingFiltros] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingFiltros(true);
    const params = {};
    if (programa) params.programa = programa;
    if (anio) params.anio = anio;
    saberProAnalyticsService.getValueAddedFiltros(params)
      .then((response) => {
        setCatalogs({
          programas: response?.data?.programas || [],
          anios: response?.data?.anios || []
        });
      })
      .catch(() => {})
      .finally(() => setLoadingFiltros(false));
  }, [programa, anio]);

  useEffect(() => {
    if (!programa && !anio && !search.trim()) {
      setStudents([]);
      return;
    }
    let active = true;
    setStudentsLoading(true);
    setError('');
    const filters = {};
    if (programa) filters.programas = [programa];
    if (anio) filters.anios = [Number(anio)];
    if (tipoPrueba) filters.tipoExamen = tipoPrueba;
    if (filtroVa === 'Valor Agregado Positivo') filters.onlyPositiveVa = true;
    if (filtroVa === 'Todas las competencias positivas') filters.allCompetenciesPositive = true;
    if (search.trim()) filters.search = search.trim();

    saberProAnalyticsService.getDocumentosEstudiantes(filters)
      .then((response) => {
        if (active) setStudents(response?.data || []);
      })
      .catch((err) => {
        if (active) {
          setStudents([]);
          setError(err?.response?.data?.message || 'No fue posible consultar estudiantes.');
        }
      })
      .finally(() => {
        if (active) setStudentsLoading(false);
      });

    return () => { active = false; };
  }, [programa, anio, tipoPrueba, filtroVa, search]);

  useEffect(() => {
    if (!selectedStudent?.documento) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setError('');

    const filters = { documento: selectedStudent.documento };
    if (selectedStudent.programa) filters.programas = [selectedStudent.programa];
    else if (programa) filters.programas = [programa];
    if (selectedStudent.anio) filters.anios = [Number(selectedStudent.anio)];
    else if (anio) filters.anios = [Number(anio)];
    if (selectedStudent.periodo) filters.periodos = [selectedStudent.periodo];
    if (tipoPrueba) filters.tipoExamen = tipoPrueba;

    saberProAnalyticsService.getComparativaEstudianteDetalle(filters)
      .then((response) => {
        if (!active) return;
        const payload = Array.isArray(response?.data) ? response.data : [];
        const exact = payload.find((row) =>
          String(row.documento || '') === String(selectedStudent.documento || '') &&
          Number(row.anio || 0) === Number(selectedStudent.anio || 0) &&
          String(row.programa || '') === String(selectedStudent.programa || '')
        );
        setDetail(exact || payload[0] || null);
      })
      .catch((err) => {
        if (active) {
          setDetail(null);
          setError(err?.response?.data?.message || 'No fue posible construir la comparativa del estudiante.');
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => { active = false; };
  }, [selectedStudent, programa, anio, tipoPrueba]);

  const availableCount = students.length;
  const selectedSummary = selectedStudent || detail || null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1380, mx: 'auto', width: '100%' }}>
      <Stack spacing={2.2}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 5, border: '1px solid #bfdbfe', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 45%, #eef2ff 100%)' }}>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 900, color: '#1e3a8a', letterSpacing: '-0.03em' }}>
                Valor Agregado Individual
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#1d4ed8', fontWeight: 700, mt: 0.4 }}>
                Selecciona un estudiante y la tabla se construye con la tarjeta equivalente de Saber 11 y sus resultados reales de {selectedSummary?.is_tyt ? 'Saber TyT' : 'Saber Pro'}.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box
                onClick={() => {
                  setTipoPrueba('');
                  setFiltroVa('General');
                  setPrograma('');
                  setAnio('');
                  setSearch('');
                  setSelectedStudent(null);
                  setDetail(null);
                }}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 999,
                  border: '1px solid #bfdbfe',
                  bgcolor: '#fff',
                  color: '#1d4ed8',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  userSelect: 'none',
                  '&:hover': { bgcolor: '#eff6ff', borderColor: '#93c5fd' }
                }}
              >
                Borrar filtros
              </Box>
            </Box>

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.4}>
              <CompactFilter
                label="Tipo Saber 11"
                value={tipoPrueba}
                onChange={(value) => {
                  setTipoPrueba(value || '');
                  setSearch('');
                  setSelectedStudent(null);
                }}
                options={['Tipo 1', 'Tipo 2', 'Tipo 3', 'Tipo 4', 'Tipo 5', 'Tipo 6', 'Tipo 7']}
                placeholder="Seleccionar tipo"
              />
              <CompactFilter
                label="Filtro VA"
                value={filtroVa}
                onChange={(value) => {
                  setFiltroVa(value || 'General');
                  setSearch('');
                  setSelectedStudent(null);
                }}
                options={['General', 'Valor Agregado Positivo', 'Todas las competencias positivas']}
                placeholder="Seleccionar filtro"
              />
              <CompactFilter
                label="Programa académico"
                value={programa}
                onChange={(value) => {
                  setPrograma(value);
                  setSearch('');
                  setSelectedStudent(null);
                }}
                options={catalogs.programas}
                placeholder="Seleccionar programa"
              />
              <CompactFilter
                label="Año"
                value={anio}
                onChange={(value) => {
                  setAnio(value);
                  setSearch('');
                  setSelectedStudent(null);
                }}
                options={catalogs.anios}
                placeholder="Seleccionar año"
              />
              <StudentSearch
                value={search}
                onInputChange={(value) => {
                  setSearch(value);
                  setSelectedStudent((prev) => (prev && String(prev.documento || '') !== String(value || '').trim() ? null : prev));
                  if (!value.trim()) setSelectedStudent(null);
                }}
                onSelect={(student) => {
                  setSelectedStudent(student);
                  setSearch(String(student.documento || ''));
                }}
                suggestions={students}
                loading={studentsLoading}
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} flexWrap="wrap" useFlexGap>
              {[
                { label: 'Estudiantes con cruce', value: availableCount, tone: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
                { label: 'Filtro activo', value: selectedStudent ? '1 estudiante' : 'Sin selección', tone: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
                { label: 'Diseño aplicado', value: detail?.s11_tipo?.nombre || 'Tarjeta automática', tone: '#92400e', bg: '#fffbeb', border: '#fde68a' }
              ].map((card) => (
                <Paper key={card.label} elevation={0} sx={{ minWidth: 160, px: 2, py: 1.4, borderRadius: 3, border: `1px solid ${card.border}`, bgcolor: card.bg }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 900, color: card.tone }}>{card.value}</Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: card.tone }}>{card.label}</Typography>
                </Paper>
              ))}
            </Stack>

            {loadingFiltros && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography sx={{ fontSize: 12, color: '#64748b' }}>Actualizando filtros de programas y años...</Typography>
              </Stack>
            )}
          </Stack>
        </Paper>

        {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

        {selectedStudent && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid #dbeafe', bgcolor: '#fff' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Estudiante seleccionado
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#0f172a', mt: 0.5 }}>
              {selectedStudent.nombre || selectedStudent.documento}
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#475569', fontWeight: 700, mt: 0.4 }}>
              Documento {selectedStudent.documento} · {selectedStudent.programa || 'Programa no disponible'} · Año {selectedStudent.anio || '—'}{selectedStudent.periodo ? `-${selectedStudent.periodo}` : ''}
            </Typography>
          </Paper>
        )}

        {detailLoading ? (
          <Paper elevation={0} sx={{ p: 5, borderRadius: 4, border: '1px solid #dbeafe', textAlign: 'center' }}>
            <CircularProgress />
            <Typography sx={{ fontSize: 13, color: '#64748b', fontWeight: 700, mt: 1.5 }}>
              Construyendo la comparativa individual con la tarjeta correspondiente de Saber 11...
            </Typography>
          </Paper>
        ) : detail ? (
          <TablaComparativaEstudiante student={detail} />
        ) : (
          <Paper elevation={0} sx={{ p: 5, borderRadius: 4, border: '1px dashed #bfdbfe', textAlign: 'center', bgcolor: '#f8fbff' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#1d4ed8' }}>
              Selecciona un estudiante para ver la comparativa individual.
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.7 }}>
              El filtro ahora está pensado para trabajar estudiante por estudiante y no con una tabla masiva que mezcle cruces.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
