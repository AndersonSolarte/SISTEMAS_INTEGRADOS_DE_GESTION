import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, FormControl, IconButton,
  InputAdornment, InputLabel, LinearProgress, ListItemIcon, ListItemText, Menu,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  FaArrowLeft, FaArrowRight, FaBoxArchive, FaChartColumn, FaChartPie,
  FaCircleCheck, FaClipboardCheck, FaDownload, FaEllipsisVertical, FaEye,
  FaFileLines, FaFilePen, FaFilter, FaIdCard, FaMagnifyingGlass, FaPaperPlane,
  FaPercent, FaRotate, FaShieldHalved, FaTrashCan, FaUserCheck, FaXmark
} from 'react-icons/fa6';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Sector, Tooltip as ChartTooltip, XAxis, YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import meetingMinuteService from '../../services/meetingMinuteService';

const MEETING_MINUTES_FORMAT = 'meeting_minutes';
const ROWS_PER_PAGE = 25;

const STATUS = {
  draft: { label: 'Borrador', color: '#64748b', soft: '#f1f5f9' },
  signing: { label: 'En firmas', color: '#d97706', soft: '#fffbeb' },
  signed: { label: 'Firmada', color: '#16a34a', soft: '#f0fdf4' },
  distributed: { label: 'Enviada', color: '#2563eb', soft: '#eff6ff' },
  deleted: { label: 'Retirada', color: '#dc2626', soft: '#fef2f2' }
};

const LIFECYCLE = {
  archived: { label: 'Archivada', color: '#7c3aed', soft: '#f3e8ff' },
  deleted: { label: 'Retirada', color: '#dc2626', soft: '#fef2f2' },
  operational: { label: 'Operativa', color: '#0284c7', soft: '#e0f2fe' }
};

const emptyData = {
  retention_days: 30,
  available_years: [],
  selected_year: null,
  summary: {
    total: 0, active: 0, archived: 0, deleted: 0, draft: 0, signing: 0, signed: 0,
    distributed: 0, completed: 0, participants: 0, signed_participants: 0,
    pending_participants: 0, signature_progress: 0
  },
  by_status: [],
  trend: [],
  archive: [],
  recent: []
};

const formatNumber = (value) => new Intl.NumberFormat('es-CO').format(Number(value || 0));

const displayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Sin fecha';
};

export const normalizeExactName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export const normalizeExactDocument = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/^\s*(?:c\.?\s*c\.?|cedula|doc(?:umento)?)(?=\s|[:#.-]|$)\.?\s*[:#-]?\s*/i, '')
  .replace(/[\s.-]+/g, '')
  .trim()
  .toLowerCase();

export const extractResponsibleSearchTarget = (rawInput) => {
  if (rawInput && typeof rawInput === 'object') {
    const namePart = String(rawInput.name || rawInput.label || '').trim();
    const docPart = String(rawInput.document || '').trim();
    return {
      raw: String(rawInput.label || namePart || docPart).trim(),
      namePart,
      docPart,
      hasExplicitSplit: Boolean(namePart && docPart)
    };
  }
  const raw = String(rawInput || '').trim();
  if (!raw) {
    return { raw: '', namePart: '', docPart: '', hasExplicitSplit: false };
  }
  const splitMatch = raw.match(/^(.*?)\s*[—–-]\s*(?:CC|C\.?\s*C\.?|C[eé]dula|Doc(?:umento)?)\.?\s*[:#-]?\s*(.+)$/i);
  if (splitMatch) {
    return {
      raw,
      namePart: splitMatch[1].trim(),
      docPart: splitMatch[2].trim(),
      hasExplicitSplit: true
    };
  }
  return { raw, namePart: raw, docPart: raw, hasExplicitSplit: false };
};

export const getRowResponsibles = (row = {}) => {
  const candidates = [];
  const pushCandidate = (name, document) => {
    const cleanName = String(name || '').trim();
    const cleanDoc = String(document || '').trim();
    if (!cleanName && !cleanDoc) return;
    candidates.push({ name: cleanName, document: cleanDoc });
  };

  pushCandidate(row.responsible_name || row.creator, row.responsible_document || row.creator_document);
  if (Array.isArray(row.responsables)) {
    row.responsables.forEach((resp) => {
      if (resp) pushCandidate(resp.name || resp.nombre, resp.document || resp.username);
    });
  }
  pushCandidate(row.creator_name || row.creator, row.creator_document);

  const unique = new Map();
  candidates.forEach((item) => {
    const key = `${normalizeExactName(item.name)}|${normalizeExactDocument(item.document)}`;
    if (!unique.has(key)) unique.set(key, item);
  });
  return Array.from(unique.values());
};

export const matchesExactResponsible = (row, rawQuery) => {
  const target = extractResponsibleSearchTarget(rawQuery);
  if (!target.raw) return true;

  const normName = normalizeExactName(target.namePart);
  const normDoc = normalizeExactDocument(target.docPart);
  const responsibles = getRowResponsibles(row);
  if (!responsibles.length) return false;

  return responsibles.some((resp) => {
    const respDoc = normalizeExactDocument(resp.document);
    const respName = normalizeExactName(resp.name);

    if (target.hasExplicitSplit) {
      if (normDoc && respDoc) {
        return respDoc === normDoc;
      }
      return Boolean(normName && respName === normName);
    }

    const docMatches = Boolean(normDoc && respDoc && respDoc === normDoc);
    const nameMatches = Boolean(normName && respName && respName === normName);
    return docMatches || nameMatches;
  });
};

const WatermarkMetricCard = React.memo(({ index, label, value, Icon, color, soft, detail }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.24, delay: index * 0.04, ease: 'easeOut' }}
    whileHover={{ y: -4 }}
    style={{ height: '100%' }}
  >
    <Paper
      elevation={0}
      sx={{
        p: 2.3,
        height: '100%',
        minHeight: 152,
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          borderColor: `${color}55`,
          boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)'
        }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.2} sx={{ position: 'relative', zIndex: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: '#64748b',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            lineHeight: 1.35,
            fontSize: 11.5,
            pt: 0.4
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: '13px',
            display: 'grid',
            placeItems: 'center',
            color,
            bgcolor: soft
          }}
        >
          <Icon size={19} aria-hidden="true" />
        </Box>
      </Stack>

      <Box sx={{ mt: 1.2, position: 'relative', zIndex: 1 }}>
        <Typography
          sx={{
            color: '#1e3a8a',
            fontWeight: 800,
            fontSize: '32px',
            lineHeight: 1.08,
            letterSpacing: '-0.02em'
          }}
        >
          {typeof value === 'string' ? value : formatNumber(value)}
        </Typography>
        {detail && (
          <Typography
            variant="body2"
            sx={{
              mt: 0.8,
              color: '#64748b',
              fontWeight: 600,
              fontSize: 12.5
            }}
          >
            {detail}
          </Typography>
        )}
      </Box>

      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          right: -10,
          bottom: -14,
          color,
          opacity: 0.09,
          pointerEvents: 'none',
          lineHeight: 0,
          transform: 'rotate(-6deg)'
        }}
      >
        <Icon size={92} />
      </Box>
    </Paper>
  </motion.div>
));

const hasPendingSignatures = (row = {}) => {
  const pendingCount = Number(
    row.pending_participants ?? Math.max(0, Number(row.participants || 0) - Number(row.signed_participants || 0))
  );
  return pendingCount > 0 && row.status !== 'signed' && row.status !== 'distributed';
};

const ArchiveRow = React.memo(({ row, isBusy, isSelected, disableActions, onOpenMenu }) => {
  const status = STATUS[row.status] || STATUS.draft;
  const lifecycle = LIFECYCLE[row.lifecycle] || LIFECYCLE.operational;
  const responsibleName = row.responsible_name || row.creator || 'Sin información';
  const responsibleDoc = row.responsible_document || row.creator_document || '';
  const extraResponsibles = Array.isArray(row.responsables) && row.responsables.length > 1
    ? row.responsables.length - 1
    : 0;
  const signatureTotal = Number(row.participants || 0);
  const signatureSigned = Number(row.signed_participants || 0);
  const signaturePct = signatureTotal > 0 ? Math.round((signatureSigned / signatureTotal) * 100) : 0;

  return (
    <TableRow
      hover
      data-selected={isSelected ? 'true' : 'false'}
      sx={{
        bgcolor: isSelected ? '#e0f2fe' : 'transparent',
        transition: 'background-color 0.15s ease',
        '&:hover td': { bgcolor: isSelected ? '#bae6fd' : '#f8fbff' },
        '& td': isSelected ? { bgcolor: '#e0f2fe' } : {}
      }}
    >
      <TableCell
        sx={{
          py: 1.3,
          borderLeft: isSelected ? '4px solid #0284c7' : '4px solid transparent'
        }}
      >
        <Typography fontSize={13} fontWeight={800} color="#0f172a">{row.title}</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>{row.code}</Typography>
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#334155' }}>
        {displayDate(row.meeting_date || row.created_at)}
      </TableCell>
      <TableCell>
        <Stack spacing={0.5} alignItems="flex-start">
          <Chip size="small" label={status.label} sx={{ fontWeight: 800, color: status.color, bgcolor: status.soft }} />
          <Chip size="small" label={lifecycle.label} sx={{ fontWeight: 800, color: lifecycle.color, bgcolor: lifecycle.soft }} />
        </Stack>
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" fontWeight={800} color="#0f172a">
            {responsibleName}
          </Typography>
          {responsibleDoc && (
            <Chip
              size="small"
              icon={<FaIdCard size={11} />}
              label={`CC ${responsibleDoc}`}
              sx={{
                height: 22,
                fontSize: 11,
                fontWeight: 800,
                bgcolor: '#e0f2fe',
                color: '#0284c7',
                px: 0.3
              }}
            />
          )}
          {extraResponsibles > 0 && (
            <Tooltip
              title={row.responsables.map((r) => `${r.name}${r.document ? ` (CC ${r.document})` : ''}`).join(' · ')}
            >
              <Chip
                size="small"
                label={`+${extraResponsibles} resp.`}
                sx={{ height: 22, fontSize: 10.5, fontWeight: 800, bgcolor: '#f1f5f9', color: '#475569' }}
              />
            </Tooltip>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {row.dependency}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 110 }}>
        <Typography variant="body2" fontWeight={750} color="#0f172a">
          {signatureSigned} de {signatureTotal}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={signaturePct}
          sx={{ mt: 0.5, height: 5, borderRadius: 99, bgcolor: '#e2e8f0' }}
        />
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          label={row.archive_location || 'Base de datos SIAC · COM-IF-FR-002'}
          sx={{ fontWeight: 700, fontSize: 11, bgcolor: '#f1f5f9', color: '#334155' }}
        />
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Acciones del acta">
          <span>
            <IconButton
              size="small"
              aria-label="Acciones del acta"
              onClick={(event) => onOpenMenu(event.currentTarget, row)}
              disabled={disableActions}
              sx={{
                width: 34,
                height: 34,
                color: isSelected ? '#0284c7' : '#475569',
                bgcolor: isSelected ? '#ffffff' : 'transparent',
                border: isSelected ? '1px solid #bae6fd' : '1px solid transparent',
                borderRadius: '10px',
                '&:hover': { bgcolor: '#f1f5f9', color: '#0284c7' }
              }}
            >
              {isBusy ? <CircularProgress size={15} /> : <FaEllipsisVertical size={15} />}
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

const ArchiveTableSection = React.memo(({
  archiveRows,
  busyMinuteId,
  onVisualizeMinute,
  onDownloadMinute,
  onResendPending,
  onDeleteMinutePermanently
}) => {
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [menuState, setMenuState] = useState({ anchorEl: null, row: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleOpenMenu = useCallback((anchorEl, row) => {
    if (row?.id) setSelectedRowId(row.id);
    setMenuState({ anchorEl, row });
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuState({ anchorEl: null, row: null });
  }, []);

  const indexedArchive = useMemo(() => (
    archiveRows.map((row) => {
      const exactNames = new Set();
      const exactDocs = new Set();
      getRowResponsibles(row).forEach((resp) => {
        const normName = normalizeExactName(resp.name);
        const normDoc = normalizeExactDocument(resp.document);
        if (normName) exactNames.add(normName);
        if (normDoc) exactDocs.add(normDoc);
      });
      return { row, exactNames, exactDocs };
    })
  ), [archiveRows]);

  const filteredArchive = useMemo(() => {
    const target = extractResponsibleSearchTarget(responsibleFilter);
    if (!target.raw) return archiveRows;

    const normName = normalizeExactName(target.namePart);
    const normDoc = normalizeExactDocument(target.docPart);

    return indexedArchive
      .filter((entry) => {
        if (target.hasExplicitSplit) {
          return matchesExactResponsible(entry.row, responsibleFilter);
        }
        return (normDoc && entry.exactDocs.has(normDoc)) || (normName && entry.exactNames.has(normName));
      })
      .map((entry) => entry.row);
  }, [archiveRows, indexedArchive, responsibleFilter]);

  useEffect(() => {
    setPage(0);
  }, [responsibleFilter, archiveRows]);

  const hasResponsibleFilter = Boolean(String(responsibleFilter || '').trim());
  const totalPages = Math.max(1, Math.ceil(filteredArchive.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * ROWS_PER_PAGE;
  const visibleRows = useMemo(
    () => filteredArchive.slice(pageStart, pageStart + ROWS_PER_PAGE),
    [filteredArchive, pageStart]
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.2, md: 3 },
        borderRadius: '22px',
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        boxShadow: '0 10px 32px rgba(15, 23, 42, 0.05)'
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5} mb={2}>
        <Typography sx={{ color: '#1e3a8a', fontWeight: 850, fontSize: 18 }}>
          Control de archivo de actas
        </Typography>
        <Chip
          label={
            hasResponsibleFilter
              ? `${formatNumber(filteredArchive.length)} de ${formatNumber(archiveRows.length)} documento(s)`
              : `${formatNumber(archiveRows.length)} documento(s)`
          }
          sx={{
            alignSelf: { xs: 'flex-start', sm: 'center' },
            fontWeight: 800,
            bgcolor: hasResponsibleFilter ? '#e0f2fe' : '#f1f5f9',
            color: hasResponsibleFilter ? '#0284c7' : '#1e3a8a',
            border: hasResponsibleFilter ? '1px solid #bae6fd' : '1px solid #e2e8f0'
          }}
        />
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: '16px',
          border: '1px solid #dbeafe',
          bgcolor: '#f8fbff'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.3} alignItems={{ md: 'center' }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ flexShrink: 0 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '11px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#e0f2fe',
                color: '#0284c7'
              }}
            >
              <FaFilter size={15} aria-hidden="true" />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e3a8a', whiteSpace: 'nowrap' }}>
              Filtro de responsable
            </Typography>
          </Stack>

          <TextField
            fullWidth
            size="small"
            value={responsibleFilter}
            onChange={(event) => setResponsibleFilter(event.target.value)}
            placeholder="Buscar por cédula o nombre exacto..."
            inputProps={{ 'aria-label': 'Filtrar responsable por cédula o nombre exacto' }}
            sx={{
              bgcolor: '#fff',
              borderRadius: '12px',
              '& .MuiOutlinedInput-root': { borderRadius: '12px', height: 40 }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: '#64748b' }}>
                  <FaMagnifyingGlass size={14} aria-hidden="true" />
                </InputAdornment>
              )
            }}
          />

          <Tooltip title="Filtra únicamente las actas donde la cédula o el nombre completo del responsable coincidan exactamente.">
            <Chip
              icon={<FaShieldHalved size={13} />}
              label="Coincidencia exacta"
              size="small"
              sx={{
                alignSelf: { xs: 'flex-start', md: 'center' },
                bgcolor: '#e0f2fe',
                color: '#0284c7',
                border: '1px solid #bae6fd',
                fontWeight: 800,
                height: 34,
                px: 0.4
              }}
            />
          </Tooltip>

          <Button
            variant="outlined"
            size="small"
            startIcon={<FaXmark size={14} />}
            disabled={!hasResponsibleFilter}
            onClick={() => setResponsibleFilter('')}
            sx={{
              height: 40,
              px: 2,
              flexShrink: 0,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              borderColor: '#cbd5e1',
              color: '#334155',
              bgcolor: '#fff',
              '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' }
            }}
          >
            Limpiar filtro
          </Button>
        </Stack>
      </Paper>

      <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '16px' }}>
        <Table size="small">
          <TableHead
            sx={{
              background: 'linear-gradient(90deg, #1e3a8a 0%, #0284c7 100%)'
            }}
          >
            <TableRow sx={{ bgcolor: 'transparent' }}>
              <TableCell sx={{ fontWeight: 800, color: '#ffffff', bgcolor: 'transparent', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', py: 1.5, borderBottom: 'none' }}>Documento</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#ffffff', bgcolor: 'transparent', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', py: 1.5, borderBottom: 'none' }}>Fecha</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#ffffff', bgcolor: 'transparent', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', py: 1.5, borderBottom: 'none' }}>Estado</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#ffffff', bgcolor: 'transparent', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', py: 1.5, borderBottom: 'none' }}>Responsable / dependencia</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#ffffff', bgcolor: 'transparent', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', py: 1.5, borderBottom: 'none' }}>Firmas</TableCell>
              <TableCell sx={{ fontWeight: 800, color: '#ffffff', bgcolor: 'transparent', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', py: 1.5, borderBottom: 'none' }}>Registro en BD</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, color: '#ffffff', bgcolor: 'transparent', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', py: 1.5, borderBottom: 'none' }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <ArchiveRow
                key={row.id}
                row={row}
                isBusy={busyMinuteId === row.id}
                isSelected={selectedRowId === row.id}
                disableActions={Boolean(busyMinuteId)}
                onOpenMenu={handleOpenMenu}
              />
            ))}
            {filteredArchive.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {hasResponsibleFilter ? (
                    <Stack spacing={1.2} alignItems="center">
                      <Typography variant="body2" fontWeight={700} color="#334155">
                        No se encontraron actas cuya cédula o nombre completo del responsable coincida exactamente con «{responsibleFilter}».
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FaXmark size={13} />}
                        onClick={() => setResponsibleFilter('')}
                        sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px' }}
                      >
                        Limpiar filtro
                      </Button>
                    </Stack>
                  ) : (
                    'No hay actas registradas para el periodo seleccionado.'
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredArchive.length > ROWS_PER_PAGE && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          gap={1.5}
          sx={{ mt: 2 }}
        >
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
            Mostrando {formatNumber(pageStart + 1)}–{formatNumber(Math.min(pageStart + ROWS_PER_PAGE, filteredArchive.length))} de {formatNumber(filteredArchive.length)}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              startIcon={<FaArrowLeft size={12} />}
              disabled={safePage === 0}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px' }}
            >
              Anterior
            </Button>
            <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 800, px: 1 }}>
              Página {safePage + 1} de {totalPages}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              endIcon={<FaArrowRight size={12} />}
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px' }}
            >
              Siguiente
            </Button>
          </Stack>
        </Stack>
      )}

      <Menu
        anchorEl={menuState.anchorEl}
        open={Boolean(menuState.anchorEl && menuState.row)}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 0.6,
              minWidth: 230,
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12)'
            }
          }
        }}
      >
        <MenuItem
          onClick={() => {
            const target = menuState.row;
            if (target?.id) setSelectedRowId(target.id);
            handleCloseMenu();
            if (target) onVisualizeMinute(target);
          }}
        >
          <ListItemIcon sx={{ color: '#0284c7', minWidth: 32 }}>
            <FaEye size={14} />
          </ListItemIcon>
          <ListItemText primary="Visualizar" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            const target = menuState.row;
            if (target?.id) setSelectedRowId(target.id);
            handleCloseMenu();
            if (target) onDownloadMinute(target);
          }}
        >
          <ListItemIcon sx={{ color: '#1e3a8a', minWidth: 32 }}>
            <FaDownload size={14} />
          </ListItemIcon>
          <ListItemText primary="Descargar acta" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }} />
        </MenuItem>

        {menuState.row && hasPendingSignatures(menuState.row) && (
          <MenuItem
            onClick={() => {
              const target = menuState.row;
              if (target?.id) setSelectedRowId(target.id);
              handleCloseMenu();
              if (target) onResendPending(target);
            }}
          >
            <ListItemIcon sx={{ color: '#d97706', minWidth: 32 }}>
              <FaPaperPlane size={14} />
            </ListItemIcon>
            <ListItemText primary="Enviar firmas a pendientes" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }} />
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            const target = menuState.row;
            if (target?.id) setSelectedRowId(target.id);
            handleCloseMenu();
            if (target) setDeleteTarget(target);
          }}
          sx={{ color: '#dc2626' }}
        >
          <ListItemIcon sx={{ color: '#dc2626', minWidth: 32 }}>
            <FaTrashCan size={14} />
          </ListItemIcon>
          <ListItemText primary="Eliminar registro" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 750 }} />
        </MenuItem>
      </Menu>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => { if (!busyMinuteId) setDeleteTarget(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}
      >
        <DialogTitle sx={{ fontWeight: 850, color: '#0f172a', pb: 1 }}>
          ¿Eliminar registro definitivamente?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#475569', fontSize: 14 }}>
            Esta acción eliminará definitivamente el acta <strong>{deleteTarget?.code}</strong> ({deleteTarget?.title || 'Sin título'}) junto con sus participantes y firmas de la base de datos. No podrá recuperarse.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            disabled={Boolean(busyMinuteId)}
            onClick={() => setDeleteTarget(null)}
            sx={{ textTransform: 'none', fontWeight: 750, borderRadius: '10px' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={Boolean(busyMinuteId)}
            startIcon={busyMinuteId === deleteTarget?.id ? <CircularProgress size={14} color="inherit" /> : <FaTrashCan size={13} />}
            onClick={async () => {
              const target = deleteTarget;
              if (!target) return;
              await onDeleteMinutePermanently(target);
              setSelectedRowId((prev) => (prev === target.id ? null : prev));
              setDeleteTarget(null);
            }}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px' }}
          >
            Eliminar definitivamente
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
});

export default function MeetingMinuteStatisticsDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [activeStatus, setActiveStatus] = useState(null);
  const [pinnedStatus, setPinnedStatus] = useState(null);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(false);
  const [busyMinuteId, setBusyMinuteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await meetingMinuteService.getStatistics(selectedYear);
      setData(response.data || emptyData);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar las estadísticas de actas.', { variant: 'error' });
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, selectedYear]);

  useEffect(() => {
    if (selectedFormat === MEETING_MINUTES_FORMAT) load();
  }, [load, selectedFormat]);

  const summary = data.summary || emptyData.summary;
  const archiveRows = useMemo(() => (Array.isArray(data.archive) ? data.archive : []), [data.archive]);

  const statusDistribution = useMemo(() => {
    const list = Array.isArray(data.by_status) ? data.by_status : [];
    const totalCount = list.reduce((acc, item) => acc + Number(item.total || 0), 0);
    return list.map((item) => {
      const meta = STATUS[item.status] || { label: item.label || item.status, color: '#64748b', soft: '#f1f5f9' };
      const total = Number(item.total || 0);
      return {
        ...item,
        label: item.label || meta.label,
        color: meta.color,
        soft: meta.soft,
        total,
        pct: totalCount > 0 ? Math.round((total / totalCount) * 100) : 0
      };
    });
  }, [data.by_status]);

  const activeStatusSlices = useMemo(
    () => statusDistribution.filter((item) => item.total > 0),
    [statusDistribution]
  );

  const highlightedStatus = activeStatus || pinnedStatus;

  const activeStatusMeta = useMemo(
    () => statusDistribution.find((item) => item.status === highlightedStatus) || null,
    [highlightedStatus, statusDistribution]
  );

  const togglePinnedStatus = useCallback((status) => {
    if (!status) return;
    setPinnedStatus((prev) => {
      if (prev === status) {
        setActiveStatus(null);
        return null;
      }
      return status;
    });
  }, []);

  const renderActiveStatusSector = useCallback((props) => {
    const {
      cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload
    } = props;
    const sliceStatus = payload?.status || props.status;
    const isHighlighted = Boolean(highlightedStatus && sliceStatus === highlightedStatus);
    const isDimmed = Boolean(highlightedStatus && sliceStatus !== highlightedStatus);

    return (
      <g style={{ cursor: 'pointer' }}>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={isHighlighted ? Math.max(0, innerRadius - 3) : innerRadius}
          outerRadius={isHighlighted ? outerRadius + 9 : outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          fillOpacity={isDimmed ? 0.32 : 1}
          cornerRadius={isHighlighted ? 6 : 2}
          stroke="#ffffff"
          strokeWidth={isHighlighted ? 2.5 : 1.5}
        />
        {isHighlighted && (
          <Sector
            cx={cx}
            cy={cy}
            startAngle={startAngle}
            endAngle={endAngle}
            innerRadius={outerRadius + 12}
            outerRadius={outerRadius + 15}
            fill={fill}
            cornerRadius={4}
          />
        )}
      </g>
    );
  }, [highlightedStatus]);

  const openArchivedPdf = useCallback(async (row, { download = false } = {}) => {
    setBusyMinuteId(row.id);
    try {
      const blob = await meetingMinuteService.downloadArchivedPdf(row.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      if (download) {
        const safeCode = String(row.code || 'acta').trim().replace(/[^a-z0-9_-]/gi, '-');
        link.download = `${safeCode}.pdf`;
      } else {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible consultar el acta archivada.', { variant: 'error' });
    } finally {
      setBusyMinuteId(null);
    }
  }, [enqueueSnackbar]);

  const visualizeArchivedMinute = useCallback((row) => openArchivedPdf(row, { download: false }), [openArchivedPdf]);
  const downloadArchivedMinuteFile = useCallback((row) => openArchivedPdf(row, { download: true }), [openArchivedPdf]);

  const resendArchivedPending = useCallback(async (row) => {
    setBusyMinuteId(row.id);
    try {
      const response = await meetingMinuteService.resendArchivedPendingInvitations(row.id, {
        public_base_url: window.location.origin
      });
      enqueueSnackbar(response.message || 'Invitaciones de firma enviadas a los participantes pendientes.', { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible enviar las firmas pendientes.', { variant: 'error' });
    } finally {
      setBusyMinuteId(null);
    }
  }, [enqueueSnackbar, load]);

  const deleteArchivedMinute = useCallback(async (row) => {
    setBusyMinuteId(row.id);
    try {
      const response = await meetingMinuteService.deleteArchivedMinutePermanently(row.id);
      enqueueSnackbar(response.message || 'Acta eliminada definitivamente.', { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar definitivamente el acta.', { variant: 'error' });
    } finally {
      setBusyMinuteId(null);
    }
  }, [enqueueSnackbar, load]);

  if (!selectedFormat) {
    return (
      <Box
        sx={{
          p: { xs: 1.5, md: 2.5 },
          borderRadius: '24px',
          bgcolor: '#f4f8ff',
          border: '1px solid #e2ecfb'
        }}
      >
        <Stack spacing={2.8}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5}>
            <Typography sx={{ color: '#1e3a8a', fontWeight: 850, fontSize: { xs: 24, md: 30 }, lineHeight: 1.15 }}>
              Estadísticas de formatos
            </Typography>
            <Chip
              icon={<FaCircleCheck size={14} />}
              label="1 formato habilitado"
              sx={{
                alignSelf: { xs: 'flex-start', sm: 'center' },
                bgcolor: '#ffffff',
                color: '#1e3a8a',
                border: '1px solid #cbd5e1',
                fontWeight: 750,
                px: 0.5,
                height: 34,
                '& .MuiChip-icon': { color: '#16a34a' }
              }}
            />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              gap: 2.5,
              width: '100%'
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              whileHover={{ y: -4 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2.8,
                  borderRadius: '22px',
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                  '&:hover': {
                    borderColor: '#93c5fd',
                    boxShadow: '0 18px 36px rgba(2, 132, 199, 0.12)'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5} sx={{ position: 'relative', zIndex: 1 }}>
                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label="COM-ID-FR-002 · ACTAS" sx={{ color: '#0284c7', bgcolor: '#e0f2fe', fontWeight: 800 }} />
                    <Chip size="small" label="Disponible" sx={{ color: '#15803d', bgcolor: '#dcfce7', fontWeight: 800 }} />
                  </Stack>
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      flexShrink: 0,
                      borderRadius: '14px',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#0284c7',
                      bgcolor: '#e0f2fe'
                    }}
                  >
                    <FaClipboardCheck size={20} aria-hidden="true" />
                  </Box>
                </Stack>

                <Box sx={{ mt: 2, mb: 2.5, position: 'relative', zIndex: 1 }}>
                  <Typography sx={{ color: '#1e3a8a', fontWeight: 850, fontSize: 20, lineHeight: 1.25 }}>
                    Registro de Asistencia y Reunión
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mt: 0.9, lineHeight: 1.6 }}>
                    Resumen de actas, estados, firmas y control de archivo.
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  endIcon={<FaArrowRight size={14} />}
                  onClick={() => setSelectedFormat(MEETING_MINUTES_FORMAT)}
                  sx={{
                    mt: 'auto',
                    minHeight: 44,
                    position: 'relative',
                    zIndex: 1,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: 14.5,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
                    boxShadow: '0 8px 20px rgba(29, 78, 216, 0.22)'
                  }}
                >
                  Ver estadísticas
                </Button>

                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    right: -12,
                    bottom: -14,
                    color: '#0284c7',
                    opacity: 0.07,
                    pointerEvents: 'none',
                    lineHeight: 0,
                    transform: 'rotate(-8deg)'
                  }}
                >
                  <FaClipboardCheck size={112} />
                </Box>
              </Paper>
            </motion.div>
          </Box>
        </Stack>
      </Box>
    );
  }

  if (loading && !summary.total) {
    return (
      <Paper elevation={0} sx={{ p: 7, border: '1px solid #e2e8f0', borderRadius: '22px', textAlign: 'center', bgcolor: '#fff' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: '#64748b', fontWeight: 700 }}>Calculando estadísticas de actas…</Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 2.5 },
        borderRadius: '24px',
        bgcolor: '#f4f8ff',
        border: '1px solid #e2ecfb'
      }}
    >
      <Stack spacing={2.5}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.2, md: 2.6 },
            borderRadius: '22px',
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
            <Stack direction="row" spacing={1.6} alignItems="center">
              <Button
                variant="outlined"
                aria-label="Volver a formatos"
                onClick={() => setSelectedFormat(null)}
                sx={{
                  minWidth: 42,
                  width: 42,
                  height: 42,
                  p: 0,
                  borderRadius: '13px',
                  color: '#1e3a8a',
                  borderColor: '#cbd5e1',
                  bgcolor: '#f8fafc',
                  '&:hover': { borderColor: '#0284c7', bgcolor: '#e0f2fe' }
                }}
              >
                <FaArrowLeft size={15} />
              </Button>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography sx={{ color: '#1e3a8a', fontWeight: 850, fontSize: { xs: 20, md: 24 }, lineHeight: 1.2 }}>
                  Registro de Asistencia y Reunión
                </Typography>
                <Chip
                  size="small"
                  label="COM-ID-FR-002"
                  sx={{ bgcolor: '#e0f2fe', color: '#0284c7', fontWeight: 800, height: 24 }}
                />
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems="stretch">
              <FormControl size="small" sx={{ minWidth: 185 }}>
                <InputLabel id="meeting-minute-year-label" sx={{ fontWeight: 700, color: '#475569' }}>
                  Año
                </InputLabel>
                <Select
                  labelId="meeting-minute-year-label"
                  value={selectedYear}
                  label="Año"
                  onChange={(event) => setSelectedYear(event.target.value)}
                  sx={{
                    height: 42,
                    bgcolor: '#f8fafc',
                    borderRadius: '12px',
                    fontWeight: 700,
                    color: '#1e3a8a'
                  }}
                >
                  <MenuItem value="">Todos los años</MenuItem>
                  {(data.available_years || []).map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FaRotate size={14} />}
                onClick={load}
                disabled={loading}
                sx={{
                  height: 42,
                  px: 2.2,
                  borderRadius: '12px',
                  fontWeight: 800,
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
                  boxShadow: '0 6px 16px rgba(2, 132, 199, 0.22)'
                }}
              >
                Actualizar
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(6, minmax(0, 1fr))'
            },
            gap: 2,
            width: '100%'
          }}
        >
          <WatermarkMetricCard
            index={0}
            label="Total general"
            value={summary.total}
            Icon={FaFileLines}
            color="#0284c7"
            soft="#e0f2fe"
            detail={`${formatNumber(summary.active)} activas`}
          />
          <WatermarkMetricCard
            index={1}
            label="Borradores"
            value={summary.draft}
            Icon={FaFilePen}
            color="#64748b"
            soft="#f1f5f9"
            detail="En elaboración"
          />
          <WatermarkMetricCard
            index={2}
            label="En firmas"
            value={summary.signing}
            Icon={FaUserCheck}
            color="#d97706"
            soft="#fef3c7"
            detail="Pendientes de firma"
          />
          <WatermarkMetricCard
            index={3}
            label="Firmadas / aprobadas"
            value={summary.completed}
            Icon={FaCircleCheck}
            color="#16a34a"
            soft="#dcfce7"
            detail={`${formatNumber(summary.distributed)} enviadas`}
          />
          <WatermarkMetricCard
            index={4}
            label="Archivadas"
            value={summary.archived}
            Icon={FaBoxArchive}
            color="#7c3aed"
            soft="#f3e8ff"
            detail="Fuera de la vista operativa"
          />
          <WatermarkMetricCard
            index={5}
            label="Avance de firmas"
            value={`${summary.signature_progress}%`}
            Icon={FaPercent}
            color="#0891b2"
            soft="#cffafe"
            detail={`${formatNumber(summary.signed_participants)} firmadas · ${formatNumber(summary.pending_participants)} pendientes de ${formatNumber(summary.participants)}`}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 7fr)' },
            gap: 2.2,
            width: '100%'
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 2.8,
              borderRadius: '22px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              minHeight: 370,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Stack direction="row" spacing={1.4} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    bgcolor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <FaChartPie size={17} aria-hidden="true" />
                </Box>
                <Typography sx={{ color: '#1e3a8a', fontWeight: 800, fontSize: 16 }}>
                  Actas por estado
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={`${formatNumber(summary.total)} actas`}
                sx={{ bgcolor: '#f0f9ff', color: '#0284c7', fontWeight: 800, border: '1px solid #bae6fd' }}
              />
            </Stack>

            {activeStatusSlices.length === 0 ? (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">Sin actas registradas en este periodo.</Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' },
                  alignItems: 'center',
                  gap: 2,
                  minHeight: 250
                }}
              >
                <Box sx={{ position: 'relative', width: '100%', height: 245 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart onMouseLeave={() => setActiveStatus(null)}>
                      <Pie
                        data={activeStatusSlices}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={74}
                        paddingAngle={3}
                        shape={renderActiveStatusSector}
                        onMouseEnter={(entry) => setActiveStatus(entry?.status || entry?.payload?.status || null)}
                        onMouseLeave={() => setActiveStatus(null)}
                        onClick={(entry) => togglePinnedStatus(entry?.status || entry?.payload?.status || null)}
                      >
                        {activeStatusSlices.map((entry) => (
                          <Cell key={entry.status} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(val, name) => [`${formatNumber(val)} actas`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <Box sx={{ textAlign: 'center', maxWidth: 86, px: 0.5 }}>
                      <Typography
                        sx={{
                          fontWeight: 850,
                          fontSize: 23,
                          lineHeight: 1.05,
                          color: activeStatusMeta ? activeStatusMeta.color : '#1e3a8a'
                        }}
                      >
                        {formatNumber(activeStatusMeta ? activeStatusMeta.total : summary.total)}
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: 11,
                          lineHeight: 1.2,
                          color: '#475569',
                          mt: 0.25
                        }}
                        noWrap
                      >
                        {activeStatusMeta ? activeStatusMeta.label : 'Total actas'}
                      </Typography>
                      {activeStatusMeta && (
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: 11,
                            lineHeight: 1.1,
                            color: activeStatusMeta.color,
                            mt: 0.15
                          }}
                        >
                          {activeStatusMeta.pct}%
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
                <Stack spacing={1}>
                  {statusDistribution.map((entry) => {
                    const isHighlighted = highlightedStatus === entry.status;
                    const isDimmed = Boolean(highlightedStatus && !isHighlighted);
                    return (
                      <Box
                        key={entry.status}
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => setActiveStatus(entry.status)}
                        onMouseLeave={() => setActiveStatus(null)}
                        onClick={() => togglePinnedStatus(entry.status)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            togglePinnedStatus(entry.status);
                          }
                        }}
                        sx={{
                          px: 1.4,
                          py: 0.95,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          bgcolor: isHighlighted ? '#ffffff' : (entry.total > 0 ? entry.soft : '#f8fafc'),
                          border: isHighlighted
                            ? `2px solid ${entry.color}`
                            : `1px solid ${entry.total > 0 ? `${entry.color}30` : '#e2e8f0'}`,
                          boxShadow: isHighlighted ? `0 8px 20px ${entry.color}33` : 'none',
                          transform: isHighlighted ? 'translateX(-6px) scale(1.03)' : 'translateX(0) scale(1)',
                          opacity: isDimmed ? 0.52 : 1,
                          transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, background-color 0.18s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              width: isHighlighted ? 13 : 10,
                              height: isHighlighted ? 13 : 10,
                              borderRadius: '50%',
                              bgcolor: entry.color,
                              boxShadow: isHighlighted ? `0 0 0 3px ${entry.color}28` : 'none',
                              transition: 'all 0.18s ease',
                              flexShrink: 0
                            }}
                          />
                          <Typography variant="body2" fontWeight={isHighlighted ? 850 : 750} color="#0f172a" noWrap>
                            {entry.label}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="baseline" spacing={0.6} flexShrink={0}>
                          <Typography variant="body2" fontWeight={900} sx={{ color: entry.color }}>
                            {formatNumber(entry.total)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            ({entry.pct}%)
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2.8,
              borderRadius: '22px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              minHeight: 370,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Stack direction="row" spacing={1.4} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    bgcolor: '#ede9fe',
                    color: '#7c3aed',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <FaChartColumn size={17} aria-hidden="true" />
                </Box>
                <Typography sx={{ color: '#1e3a8a', fontWeight: 800, fontSize: 16 }}>
                  {selectedYear ? `Evolución mensual (${selectedYear})` : 'Evolución histórica por año'}
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={selectedYear ? `Año ${selectedYear}` : 'Todos los años'}
                sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 800 }}
              />
            </Stack>
            <Box sx={{ flex: 1, width: '100%', minHeight: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend || []} margin={{ top: 28, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <ChartTooltip formatter={(val) => [`${formatNumber(val)} actas`, 'Total']} />
                  <Bar dataKey="total" name="Actas" fill="#0284c7" radius={[10, 10, 0, 0]} maxBarSize={64}>
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(val) => formatNumber(val)}
                      style={{ fill: '#1e3a8a', fontSize: 13, fontWeight: 800 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>

        <ArchiveTableSection
          archiveRows={archiveRows}
          busyMinuteId={busyMinuteId}
          onVisualizeMinute={visualizeArchivedMinute}
          onDownloadMinute={downloadArchivedMinuteFile}
          onResendPending={resendArchivedPending}
          onDeleteMinutePermanently={deleteArchivedMinute}
        />
      </Stack>
    </Box>
  );
}
