import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Archive as ArchiveIcon,
  Assessment as AssessmentIcon,
  Backup as BackupIcon,
  ContentCopy as ContentCopyIcon,
  DragIndicator as DragIndicatorIcon,
  Edit as EditIcon,
  FactCheck as FactCheckIcon,
  History as HistoryIcon,
  InsertChart as InsertChartIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Launch as LaunchIcon,
  LibraryBooks as LibraryBooksIcon,
  Publish as PublishIcon,
  QrCode2 as QrCodeIcon,
  Save as SaveIcon,
  SentimentDissatisfied as SentimentDissatisfiedIcon,
  SentimentNeutral as SentimentNeutralIcon,
  SentimentSatisfied as SentimentSatisfiedIcon,
  SentimentVeryDissatisfied as SentimentVeryDissatisfiedIcon,
  SentimentVerySatisfied as SentimentVerySatisfiedIcon,
  Star as StarIcon,
  StopCircle as StopCircleIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { useSnackbar } from 'notistack';
import instrumentosApi from './services/instrumentosApi';
import { QUESTION_TYPES, createEmptyQuestion, needsOptions, normalizeOptions, themePresets, withDefaultOptions } from './utils/questionTypes';

const statusTone = {
  borrador: { color: '#475569', bg: '#f1f5f9' },
  publicado: { color: '#047857', bg: '#d1fae5' },
  cerrado: { color: '#b45309', bg: '#fef3c7' },
  archivado: { color: '#991b1b', bg: '#fee2e2' }
};

const todayYear = new Date().getFullYear();

const blankForm = {
  title: '',
  description: '',
  objective: '',
  program_name: '',
  area_name: '',
  year: todayYear,
  period: '',
  type: 'Encuesta',
  is_anonymous: true,
  allow_multiple_responses: true,
  response_limit: '',
  opens_at: '',
  closes_at: '',
  theme_config: themePresets[0],
  personal_fields_config: {
    nombre: false,
    documento: false,
    correo: false,
    telefono: false,
    programa: false,
    area: false,
    rol: false,
    cargo: false
  },
  attachment_config: { prefer_external_url: true, max_mb: 10 },
  evidence_context: { quiz_mode: false, show_feedback: true },
  sections: [{ title: 'Seccion principal', description: '', order_index: 0 }],
  questions: [createEmptyQuestion(0)],
  conditions: []
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

function MetricCard({ label, value, icon, color = '#1d4ed8' }) {
  return (
    <Paper component={motion.div} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
      <Stack direction="row" spacing={1.4} alignItems="center">
        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}18`, color, display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Box>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900, textTransform: 'uppercase' }}>{label}</Typography>
          <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: 950 }}>{Number(value || 0).toLocaleString('es-CO')}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function ActionMetricCard({ label, value, icon, color = '#1d4ed8', onClick }) {
  return (
    <Paper
      component={motion.button}
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        height: '100%',
        width: '100%',
        textAlign: 'left',
        bgcolor: 'white',
        cursor: 'pointer',
        '&:hover': { borderColor: color, boxShadow: `0 10px 24px ${color}20` }
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="center">
        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}18`, color, display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Box>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900, textTransform: 'uppercase' }}>{label}</Typography>
          <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: 950 }}>{Number(value || 0).toLocaleString('es-CO')}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function StatusChip({ status }) {
  const tone = statusTone[status] || statusTone.borrador;
  return <Chip size="small" label={status || 'borrador'} sx={{ bgcolor: tone.bg, color: tone.color, fontWeight: 900, textTransform: 'capitalize' }} />;
}

const emotionIcons = [
  { icon: <SentimentVeryDissatisfiedIcon fontSize="small" />, color: '#dc2626' },
  { icon: <SentimentDissatisfiedIcon fontSize="small" />, color: '#ea580c' },
  { icon: <SentimentNeutralIcon fontSize="small" />, color: '#64748b' },
  { icon: <SentimentSatisfiedIcon fontSize="small" />, color: '#16a34a' },
  { icon: <SentimentVerySatisfiedIcon fontSize="small" />, color: '#047857' }
];

function OptionVisual({ type, index }) {
  if (type === 'estrellas') {
    return (
      <Stack direction="row" spacing={0.1} sx={{ width: 104, flexShrink: 0 }}>
        {Array.from({ length: 5 }).map((_, starIndex) => (
          <StarIcon key={starIndex} fontSize="small" sx={{ color: starIndex <= index ? '#f59e0b' : '#cbd5e1' }} />
        ))}
      </Stack>
    );
  }
  if (type === 'caritas') {
    const item = emotionIcons[index] || emotionIcons[2];
    return (
      <Box sx={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', color: item.color, bgcolor: '#f8fafc', border: '1px solid #dbeafe', flexShrink: 0 }}>
        {item.icon}
      </Box>
    );
  }
  if (type === 'ranking') {
    return (
      <Box sx={{ width: 28, height: 28, borderRadius: 1.2, display: 'grid', placeItems: 'center', bgcolor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 950, flexShrink: 0 }}>
        {index + 1}
      </Box>
    );
  }
  return <Box sx={{ width: 18, height: 18, borderRadius: type === 'seleccion_multiple' ? 0.8 : '50%', border: '2px solid #94a3b8', flexShrink: 0 }} />;
}

const listToText = (value = []) => (Array.isArray(value) ? value.join('\n') : '');
const textToList = (value = '') => String(value).split('\n').map((item) => item.trim()).filter(Boolean);

const typeDefaultConfig = (type, previousConfig = {}) => {
  if (type === 'matriz') {
    return {
      ...previousConfig,
      rows: previousConfig.rows?.length ? previousConfig.rows : ['Fila 1'],
      columns: previousConfig.columns?.length ? previousConfig.columns : ['Columna 1']
    };
  }
  if (type === 'matriz_likert') {
    return {
      ...previousConfig,
      rows: previousConfig.rows?.length ? previousConfig.rows : ['Fila 1'],
      columns: previousConfig.columns?.length
        ? previousConfig.columns
        : ['Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo']
    };
  }
  if (type === 'escala_lineal' || type === 'escala_numerica') {
    return {
      ...previousConfig,
      min: previousConfig.min ?? 1,
      max: previousConfig.max ?? 5,
      min_label: previousConfig.min_label || '',
      max_label: previousConfig.max_label || ''
    };
  }
  if (type === 'carga_archivo') {
    return {
      ...previousConfig,
      attachment_mode: previousConfig.attachment_mode || 'both',
      max_mb: previousConfig.max_mb ?? 10,
      accept: previousConfig.accept || '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg'
    };
  }
  return previousConfig;
};

function QuestionTypeConfig({ question, onChange }) {
  const config = question.config || {};
  if (question.question_type === 'escala_lineal' || question.question_type === 'escala_numerica') {
    return (
      <Paper elevation={0} sx={{ mt: 1.2, p: 1.2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <Typography sx={{ fontWeight: 900, mb: 1 }}>Escala lineal</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '120px 120px 1fr 1fr' }, gap: 1 }}>
          <TextField label="Minimo" type="number" size="small" value={config.min ?? 1} onChange={(e) => onChange({ ...question, config: { ...config, min: Number(e.target.value) } })} fullWidth />
          <TextField label="Maximo" type="number" size="small" value={config.max ?? 5} onChange={(e) => onChange({ ...question, config: { ...config, max: Number(e.target.value) } })} fullWidth />
          <TextField label="Etiqueta minimo" size="small" value={config.min_label || ''} onChange={(e) => onChange({ ...question, config: { ...config, min_label: e.target.value } })} fullWidth />
          <TextField label="Etiqueta maximo" size="small" value={config.max_label || ''} onChange={(e) => onChange({ ...question, config: { ...config, max_label: e.target.value } })} fullWidth />
        </Box>
      </Paper>
    );
  }
  if (question.question_type === 'matriz' || question.question_type === 'matriz_likert') {
    const rows = config.rows || ['Fila 1'];
    const columns = config.columns || (question.question_type === 'matriz_likert'
      ? ['Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo']
      : ['Columna 1']);
    return (
      <Paper elevation={0} sx={{ mt: 1.2, p: 1.2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <Typography sx={{ fontWeight: 900, mb: 1 }}>{question.question_type === 'matriz_likert' ? 'Matriz Likert' : 'Matriz'}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 1fr) minmax(320px, 1.4fr)' }, gap: 1, maxWidth: 860 }}>
          <TextField label="Filas, una por linea" value={listToText(rows)} onChange={(e) => onChange({ ...question, config: { ...config, rows: textToList(e.target.value), columns } })} fullWidth multiline minRows={4} />
          <TextField label="Columnas, una por linea" value={listToText(columns)} onChange={(e) => onChange({ ...question, config: { ...config, rows, columns: textToList(e.target.value) } })} fullWidth multiline minRows={4} />
        </Box>
        <Box sx={{ mt: 1, overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `minmax(140px, 1fr) repeat(${columns.length}, minmax(90px, 1fr))`, gap: 0.5, minWidth: 220 + columns.length * 90 }}>
            <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b' }}>Vista previa</Typography>
            {columns.map((column) => <Typography key={column} variant="caption" sx={{ fontWeight: 900, textAlign: 'center', color: '#64748b' }}>{column}</Typography>)}
            {rows.slice(0, 3).map((row) => (
              <React.Fragment key={row}>
                <Typography variant="caption" sx={{ fontWeight: 800 }}>{row}</Typography>
                {columns.map((column) => <Box key={`${row}-${column}`} sx={{ height: 18, borderRadius: 999, border: '1px solid #cbd5e1', mx: 'auto', width: 18 }} />)}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      </Paper>
    );
  }
  if (question.question_type === 'carga_archivo') {
    return (
      <Paper elevation={0} sx={{ mt: 1.2, p: 1.2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        <Typography sx={{ fontWeight: 900, mb: 1 }}>Carga de archivo</Typography>
        <Grid container spacing={1}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Modo aceptado</InputLabel>
              <Select value={config.attachment_mode || 'both'} label="Modo aceptado" onChange={(e) => onChange({ ...question, config: { ...config, attachment_mode: e.target.value } })}>
                <MenuItem value="both">Archivo o enlace externo</MenuItem>
                <MenuItem value="external_url">Solo enlace externo</MenuItem>
                <MenuItem value="local_metadata">Archivo local controlado</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Tamano max MB" type="number" size="small" value={config.max_mb ?? 10} onChange={(e) => onChange({ ...question, config: { ...config, max_mb: Number(e.target.value) } })} fullWidth />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextField label="Tipos permitidos" size="small" value={config.accept || '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg'} onChange={(e) => onChange({ ...question, config: { ...config, accept: e.target.value } })} fullWidth />
          </Grid>
        </Grid>
      </Paper>
    );
  }
  return null;
}

function QuizQuestionConfig({ question, onChange }) {
  const config = question.config || {};
  const options = Array.isArray(question.options) ? question.options.map((option) => String(option)) : [];
  const correctAnswers = Array.isArray(config.correct_answers) ? config.correct_answers : [];
  const toggleCorrect = (option) => {
    const nextCorrect = correctAnswers.includes(option)
      ? correctAnswers.filter((item) => item !== option)
      : [...correctAnswers, option];
    onChange({ ...question, config: { ...config, correct_answers: nextCorrect } });
  };
  return (
    <Paper elevation={0} sx={{ mt: 1.2, p: 1.2, borderRadius: 2, border: '1px solid #fbbf24', bgcolor: '#fffbeb' }}>
      <Typography sx={{ fontWeight: 950, mb: 1, color: '#92400e' }}>Configuracion de evaluacion</Typography>
      <Grid container spacing={1}>
        <Grid item xs={12} md={2}>
          <TextField label="Puntos" type="number" size="small" value={config.points ?? 1} onChange={(e) => onChange({ ...question, config: { ...config, points: Number(e.target.value) } })} fullWidth />
        </Grid>
        <Grid item xs={12} md={5}>
          <TextField label="Retroalimentacion si acierta" size="small" value={config.feedback_correct || ''} onChange={(e) => onChange({ ...question, config: { ...config, feedback_correct: e.target.value } })} fullWidth />
        </Grid>
        <Grid item xs={12} md={5}>
          <TextField label="Retroalimentacion si falla" size="small" value={config.feedback_incorrect || ''} onChange={(e) => onChange({ ...question, config: { ...config, feedback_incorrect: e.target.value } })} fullWidth />
        </Grid>
      </Grid>
      {options.length > 0 && (
        <Stack direction="row" spacing={0.8} flexWrap="wrap" sx={{ mt: 1 }}>
          {options.map((option) => (
            <Chip key={option} label={option} color={correctAnswers.includes(option) ? 'success' : 'default'} variant={correctAnswers.includes(option) ? 'filled' : 'outlined'} onClick={() => toggleCorrect(option)} sx={{ fontWeight: 900, mb: 0.5 }} />
          ))}
        </Stack>
      )}
      {!options.length && <Typography variant="caption" sx={{ color: '#92400e' }}>Este tipo de pregunta no tiene opciones para marcar correctas.</Typography>}
    </Paper>
  );
}

const QuestionConditionTools = React.memo(function QuestionConditionTools({ question, questions = [], sections = [], conditions = [], onChange }) {
  const targets = questions.filter((item) => item.id && item.id !== question.id);
  const sectionTargets = sections.filter((section) => section.id);
  const sourceConditions = conditions.filter((condition) => Number(condition.source_question_id) === Number(question.id));

  const addRule = (preset = {}) => {
    const target = preset.target_type === 'section' ? sectionTargets[0] : targets[0];
    if (!question.id || !target) return;
    const rule = {
      source_question_id: question.id,
      operator: preset.operator || 'equals',
      value: preset.value || ''
    };
    onChange([
      ...conditions,
      {
        source_question_id: question.id,
        target_type: preset.target_type || 'question',
        target_id: target.id,
        action: preset.action || 'show',
        condition_logic: { mode: 'AND', rules: [rule] }
      }
    ]);
  };

  const updateRule = (conditionIndex, patch) => {
    onChange(conditions.map((condition, index) => {
      if (index !== conditionIndex) return condition;
      const { conditionPatch = {}, ...rulePatch } = patch;
      const rule = {
        ...(condition.condition_logic?.rules?.[0] || {}),
        source_question_id: question.id,
        ...rulePatch
      };
      return { ...condition, ...conditionPatch, condition_logic: { mode: 'AND', rules: [rule] } };
    }));
  };

  if (!question.id) {
    return (
      <Alert severity="info" sx={{ mt: 1.2, borderRadius: 2 }}>
        Guarda el borrador para activar condicionales en esta pregunta.
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ mt: 1.2, p: 1.2, borderRadius: 2, border: '1px dashed #bfdbfe', bgcolor: '#f8fbff' }}>
      <Stack spacing={1}>
        <Box>
          <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Validar o condicionar esta pregunta</Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Reglas comunes: mostrar seguimiento, ocultar una pregunta, pedir justificacion o activar bloque segun respuesta.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} flexWrap="wrap">
          <Button size="small" variant="outlined" disabled={!targets.length} onClick={() => addRule({ operator: 'equals', value: 'Si', action: 'show' })}>
            Si responde "Si", mostrar otra pregunta
          </Button>
          <Button size="small" variant="outlined" disabled={!targets.length} onClick={() => addRule({ operator: 'equals', value: 'No', action: 'hide' })}>
            Si responde "No", ocultar pregunta
          </Button>
          <Button size="small" variant="outlined" disabled={!targets.length} onClick={() => addRule({ operator: 'lte', value: '3', action: 'show' })}>
            Si puntaje {'<='} 3, pedir justificacion
          </Button>
          <Button size="small" variant="outlined" disabled={!targets.length} onClick={() => addRule({ operator: 'equals', value: 'Muy triste', action: 'show' })}>
            Si elige carita triste, seguimiento
          </Button>
          <Button size="small" variant="contained" disabled={!sectionTargets.length} onClick={() => addRule({ operator: 'equals', value: 'Si', action: 'jump_section', target_type: 'section' })}>
            Segun respuesta, ir a seccion
          </Button>
        </Stack>
        {sourceConditions.map((condition) => {
          const conditionIndex = conditions.indexOf(condition);
          const rule = condition.condition_logic?.rules?.[0] || {};
          return (
            <Grid container spacing={1} key={conditionIndex} alignItems="center">
              <Grid item xs={12} md={2.2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Condicion</InputLabel>
                  <Select value={rule.operator || 'equals'} label="Condicion" onChange={(event) => updateRule(conditionIndex, { operator: event.target.value })}>
                    {CONDITION_OPERATORS.map((operator) => <MenuItem key={operator.value} value={operator.value}>{operator.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField size="small" label="Valor" value={rule.value || ''} disabled={['empty', 'not_empty'].includes(rule.operator)} onChange={(event) => updateRule(conditionIndex, { value: event.target.value })} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Accion</InputLabel>
                  <Select
                    value={condition.action || 'show'}
                    label="Accion"
                    onChange={(event) => {
                      const action = event.target.value;
                      const nextTarget = action === 'jump_section' ? sectionTargets[0] : targets[0];
                      updateRule(conditionIndex, {
                        conditionPatch: {
                          action,
                          target_type: action === 'jump_section' ? 'section' : 'question',
                          target_id: nextTarget?.id || null
                        }
                      });
                    }}
                  >
                    <MenuItem value="show">Mostrar</MenuItem>
                    <MenuItem value="hide">Ocultar</MenuItem>
                    <MenuItem value="jump_section">Ir a seccion</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4.6}>
                <FormControl fullWidth size="small">
                  <InputLabel>{condition.action === 'jump_section' ? 'Seccion destino' : 'Pregunta destino'}</InputLabel>
                  <Select
                    value={condition.target_id || ''}
                    label={condition.action === 'jump_section' ? 'Seccion destino' : 'Pregunta destino'}
                    onChange={(event) => updateRule(conditionIndex, { conditionPatch: { target_type: condition.action === 'jump_section' ? 'section' : 'question', target_id: Number(event.target.value) } })}
                  >
                    {(condition.action === 'jump_section' ? sectionTargets : targets).map((target) => (
                      <MenuItem key={target.id} value={target.id}>{target.title || target.question_text || `Destino ${target.id}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={1.2}>
                <Button color="error" onClick={() => onChange(conditions.filter((_, index) => index !== conditionIndex))}>Quitar</Button>
              </Grid>
            </Grid>
          );
        })}
        {!targets.length && <Typography variant="caption" sx={{ color: '#64748b' }}>Necesitas otra pregunta guardada para usarla como destino.</Typography>}
        {!sectionTargets.length && <Typography variant="caption" sx={{ color: '#64748b' }}>Para saltos por seccion, guarda primero las secciones.</Typography>}
      </Stack>
    </Paper>
  );
});

const QuestionFields = React.memo(function QuestionFields({ question, index, displayIndex, sections = [], questions = [], conditions = [], isQuiz = false, onConditionsChange, onChange, onRemove, onDuplicate, onMoveUp, onMoveDown, disableMoveUp, disableMoveDown, dragHandleProps = {} }) {
  const options = Array.isArray(question.options) && question.options.length
    ? question.options.map((option) => (typeof option === 'string' ? option : option?.label || option?.value || ''))
    : normalizeOptions([], question.question_type);
  const updateOption = (optionIndex, value) => {
    const next = [...options];
    next[optionIndex] = value;
    onChange({ ...question, options: next });
  };
  const addOption = () => onChange({ ...question, options: [...options, `Opcion ${options.length + 1}`] });
  const addOther = () => {
    if (options.includes('Otro')) return;
    onChange({ ...question, options: [...options, 'Otro'] });
  };
  return (
    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fbfdff' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1.2, pb: 1, borderBottom: '1px solid #e2e8f0' }}>
        <Stack direction="row" spacing={0.6} flexWrap="wrap">
          <Chip size="small" label="Editar" color="primary" sx={{ fontWeight: 900 }} />
          <Button size="small" variant="text" onClick={() => onChange({ ...question, config: { ...(question.config || {}), show_description: !question.config?.show_description } })}>Opciones</Button>
        </Stack>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900 }}>
          P{displayIndex ?? index + 1}
        </Typography>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
        <Stack direction="row" spacing={0.2} sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}>
          <Tooltip title="Arrastrar pregunta">
            <IconButton
              size="small"
              {...dragHandleProps}
              sx={{ cursor: 'grab', color: '#64748b', ...dragHandleProps.sx }}
            >
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Subir pregunta">
            <span><IconButton size="small" disabled={disableMoveUp} onClick={(event) => { event.stopPropagation(); onMoveUp(); }}><KeyboardArrowUpIcon fontSize="small" /></IconButton></span>
          </Tooltip>
          <Tooltip title="Bajar pregunta">
            <span><IconButton size="small" disabled={disableMoveDown} onClick={(event) => { event.stopPropagation(); onMoveDown(); }}><KeyboardArrowDownIcon fontSize="small" /></IconButton></span>
          </Tooltip>
        </Stack>
        <TextField
          label={`Pregunta ${displayIndex ?? index + 1}`}
          value={question.question_text || ''}
          onChange={(event) => onChange({ ...question, question_text: event.target.value })}
          fullWidth
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 210 } }}>
          <InputLabel>Seccion</InputLabel>
          <Select
            value={question.section_id || question.section_temp_id || ''}
            label="Seccion"
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                ...question,
                section_id: typeof value === 'number' ? value : null,
                section_temp_id: typeof value === 'string' ? value : ''
              });
            }}
          >
            <MenuItem value="">Sin seccion</MenuItem>
            {sections.map((section, sectionIndex) => (
              <MenuItem key={section.id || section.temp_id || sectionIndex} value={section.id || section.temp_id}>
                {section.title || `Seccion ${sectionIndex + 1}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 220 } }}>
          <InputLabel>Tipo</InputLabel>
          <Select
            value={question.question_type || 'texto_corto'}
            label="Tipo"
            onChange={(event) => {
              const nextType = event.target.value;
              onChange(withDefaultOptions({
                ...question,
                question_type: nextType,
                config: typeDefaultConfig(nextType, question.config || {})
              }, { forceDefaults: true }));
            }}
          >
            {QUESTION_TYPES.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Copiar pregunta">
            <IconButton size="small" onClick={onDuplicate}><ContentCopyIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Button color="error" onClick={onRemove} sx={{ minWidth: 38 }}>Quitar</Button>
        </Stack>
      </Stack>
      {question.config?.show_description && (
        <TextField
          label="Descripcion de ayuda"
          size="small"
          value={question.question_description || ''}
          onChange={(event) => onChange({ ...question, question_description: event.target.value })}
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 1.2 }}
        />
      )}
      {needsOptions(question.question_type) && (
        <Stack spacing={0.8} sx={{ mt: 1.2 }}>
          {options.map((option, optionIndex) => (
            <Stack direction="row" spacing={1} alignItems="center" key={optionIndex}>
              <OptionVisual type={question.question_type} index={optionIndex} />
              <TextField
                size="small"
                value={option}
                onChange={(event) => updateOption(optionIndex, event.target.value)}
                fullWidth
                label={`Opcion ${optionIndex + 1}`}
              />
              <Button color="error" onClick={() => onChange({ ...question, options: options.filter((_, idx) => idx !== optionIndex) })}>Quitar</Button>
            </Stack>
          ))}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pl: { sm: 3.5 } }}>
            <Button startIcon={<AddIcon />} onClick={addOption} sx={{ alignSelf: 'flex-start' }}>Agregar opcion</Button>
            {['seleccion_unica', 'seleccion_multiple', 'lista_desplegable', 'si_no'].includes(question.question_type) && (
              <Button onClick={addOther} sx={{ alignSelf: 'flex-start' }}>Agregar "Otro"</Button>
            )}
          </Stack>
          {question.question_type === 'si_no' && (
            <Typography variant="caption" sx={{ color: '#64748b', pl: { sm: 3.5 } }}>
              Puedes editar "Si" y "No" si el instrumento necesita otra redacción.
            </Typography>
          )}
        </Stack>
      )}
      <QuestionTypeConfig question={question} onChange={onChange} />
      {isQuiz && <QuizQuestionConfig question={question} onChange={onChange} />}
      <Divider sx={{ my: 1.2 }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button
            size="small"
            variant={question.config?.show_description ? 'contained' : 'outlined'}
            onClick={() => onChange({ ...question, config: { ...(question.config || {}), show_description: !question.config?.show_description } })}
          >
            Descripcion
          </Button>
          <Button size="small" variant="outlined" onClick={() => onChange({ ...question, config: { ...(question.config || {}), show_conditions: !question.config?.show_conditions } })}>
            Ir a seccion / condicionar
          </Button>
        </Stack>
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Obligatoria</Typography>
          <Switch checked={Boolean(question.is_required)} onChange={(event) => onChange({ ...question, is_required: event.target.checked })} />
        </Stack>
      </Stack>
      {question.config?.show_conditions && (
        <QuestionConditionTools question={question} questions={questions} sections={sections} conditions={conditions} onChange={onConditionsChange} />
      )}
    </Paper>
  );
}, (prev, next) => {
  const conditionsWereOpen = Boolean(prev.question?.config?.show_conditions);
  const conditionsAreOpen = Boolean(next.question?.config?.show_conditions);
  return (
    prev.question === next.question &&
    prev.displayIndex === next.displayIndex &&
    prev.sections === next.sections &&
    prev.isQuiz === next.isQuiz &&
    prev.disableMoveUp === next.disableMoveUp &&
    prev.disableMoveDown === next.disableMoveDown &&
    conditionsWereOpen === conditionsAreOpen &&
    (!conditionsAreOpen || (prev.questions === next.questions && prev.conditions === next.conditions))
  );
});

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'contains', label: 'contiene' },
  { value: 'not_empty', label: 'tiene respuesta' },
  { value: 'empty', label: 'esta vacia' },
  { value: 'lte', label: 'es menor o igual que' },
  { value: 'gte', label: 'es mayor o igual que' }
];

// Panel avanzado conservado como respaldo; la edicion principal ahora vive en cada pregunta.
// eslint-disable-next-line no-unused-vars
const ConditionalLogicEditor = React.memo(function ConditionalLogicEditor({ questions = [], conditions = [], onChange }) {
  const persistedQuestions = questions.filter((question) => question.id);
  const addCondition = () => {
    const source = persistedQuestions[0];
    const target = persistedQuestions[1] || persistedQuestions[0];
    if (!source || !target) return;
    onChange([
      ...conditions,
      {
        source_question_id: source.id,
        target_type: 'question',
        target_id: target.id,
        action: 'show',
        condition_logic: {
          mode: 'AND',
          rules: [{ source_question_id: source.id, operator: 'equals', value: '' }]
        }
      }
    ]);
  };

  const updateCondition = (index, patch) => {
    onChange(conditions.map((condition, conditionIndex) => {
      if (conditionIndex !== index) return condition;
      const next = { ...condition, ...patch };
      const rule = {
        ...(next.condition_logic?.rules?.[0] || {}),
        source_question_id: next.source_question_id
      };
      next.condition_logic = { mode: 'AND', rules: [rule] };
      return next;
    }));
  };

  const updateRule = (index, patch) => {
    onChange(conditions.map((condition, conditionIndex) => {
      if (conditionIndex !== index) return condition;
      const rule = {
        ...(condition.condition_logic?.rules?.[0] || {}),
        source_question_id: condition.source_question_id,
        ...patch
      };
      return { ...condition, condition_logic: { mode: 'AND', rules: [rule] } };
    }));
  };

  if (persistedQuestions.length < 2) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Guarda el borrador con al menos dos preguntas para configurar condicionales entre preguntas.
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Condicionales</Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Define reglas para mostrar u ocultar preguntas según una respuesta.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={addCondition}>Agregar condicional</Button>
      </Stack>
      <Stack spacing={1}>
        {conditions.map((condition, index) => {
          const rule = condition.condition_logic?.rules?.[0] || {};
          return (
            <Paper key={index} elevation={0} sx={{ p: 1.2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
              <Grid container spacing={1}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Si la pregunta</InputLabel>
                    <Select
                      value={condition.source_question_id || ''}
                      label="Si la pregunta"
                      onChange={(event) => {
                        const sourceId = Number(event.target.value);
                        updateCondition(index, { source_question_id: sourceId });
                        updateRule(index, { source_question_id: sourceId });
                      }}
                    >
                      {persistedQuestions.map((question) => <MenuItem key={question.id} value={question.id}>{question.question_text || `Pregunta ${question.id}`}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Condición</InputLabel>
                    <Select value={rule.operator || 'equals'} label="Condición" onChange={(event) => updateRule(index, { operator: event.target.value })}>
                      {CONDITION_OPERATORS.map((operator) => <MenuItem key={operator.value} value={operator.value}>{operator.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    label="Valor"
                    size="small"
                    value={rule.value || ''}
                    onChange={(event) => updateRule(index, { value: event.target.value })}
                    fullWidth
                    disabled={['empty', 'not_empty'].includes(rule.operator)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Acción</InputLabel>
                    <Select value={condition.action || 'show'} label="Acción" onChange={(event) => updateCondition(index, { action: event.target.value })}>
                      <MenuItem value="show">Mostrar</MenuItem>
                      <MenuItem value="hide">Ocultar</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Pregunta destino</InputLabel>
                    <Select value={condition.target_id || ''} label="Pregunta destino" onChange={(event) => updateCondition(index, { target_type: 'question', target_id: Number(event.target.value) })}>
                      {persistedQuestions.map((question) => <MenuItem key={question.id} value={question.id}>{question.question_text || `Pregunta ${question.id}`}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={1}>
                  <Button color="error" onClick={() => onChange(conditions.filter((_, conditionIndex) => conditionIndex !== index))}>Quitar</Button>
                </Grid>
              </Grid>
            </Paper>
          );
        })}
        {!conditions.length && <Alert severity="info" sx={{ borderRadius: 2 }}>Aún no hay reglas condicionales.</Alert>}
      </Stack>
    </Paper>
  );
}, (prev, next) => prev.questions === next.questions && prev.conditions === next.conditions);

function SectionsEditor({ sections = [], onChange }) {
  const addSection = () => onChange([
    ...sections,
    { temp_id: `section_${Date.now()}`, title: `Seccion ${sections.length + 1}`, description: '', order_index: sections.length }
  ]);

  const updateSection = (index, patch) => {
    onChange(sections.map((section, sectionIndex) => (
      sectionIndex === index ? { ...section, ...patch, order_index: sectionIndex } : section
    )));
  };

  return (
    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Secciones</Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Organiza el instrumento por bloques como datos generales, percepción, evidencias o cierre.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={addSection}>Agregar seccion</Button>
      </Stack>
      <Stack spacing={1}>
        {sections.map((section, index) => (
          <Paper key={section.id || section.temp_id || index} elevation={0} sx={{ p: 1.2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  label={`Nombre seccion ${index + 1}`}
                  size="small"
                  value={section.title || ''}
                  onChange={(event) => updateSection(index, { title: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={7}>
                <TextField
                  label="Descripcion opcional"
                  size="small"
                  value={section.description || ''}
                  onChange={(event) => updateSection(index, { description: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={1}>
                <Button
                  color="error"
                  onClick={() => onChange(sections.filter((_, sectionIndex) => sectionIndex !== index).map((item, nextIndex) => ({ ...item, order_index: nextIndex })))}
                >
                  Quitar
                </Button>
              </Grid>
            </Grid>
          </Paper>
        ))}
        {!sections.length && <Alert severity="info" sx={{ borderRadius: 2 }}>Sin secciones. Puedes crear preguntas sin sección o agregar una para organizar mejor.</Alert>}
      </Stack>
    </Paper>
  );
}

// Vista previa simplificada conservada solo como respaldo interno; el ojo abre la vista real.
// eslint-disable-next-line no-unused-vars
function InstrumentPreviewDialog({ open, form, onClose }) {
  const groupedSections = useMemo(() => {
    const sections = form?.sections || [];
    const bySection = new Map(sections.map((section) => [Number(section.id), { ...section, questions: [] }]));
    const noSection = { id: 'none', title: 'Preguntas generales', description: '', questions: [] };
    (form?.questions || []).forEach((question) => {
      const target = bySection.get(Number(question.section_id)) || noSection;
      target.questions.push(question);
    });
    return [...Array.from(bySection.values()).filter((section) => section.questions.length), ...(noSection.questions.length ? [noSection] : [])];
  }, [form]);

  const renderPreviewQuestion = (question) => {
    const options = normalizeOptions(question.options, question.question_type);
    if (question.question_type === 'estrellas') {
      return <Stack direction="row" spacing={0.2}>{Array.from({ length: options.length || 5 }).map((_, index) => <StarIcon key={index} sx={{ color: '#f59e0b' }} />)}</Stack>;
    }
    if (question.question_type === 'caritas') {
      return (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {options.map((option, index) => {
            const item = emotionIcons[index] || emotionIcons[2];
            return <Chip key={option} icon={item.icon} label={option} variant="outlined" sx={{ color: item.color, borderColor: item.color, fontWeight: 800 }} />;
          })}
        </Stack>
      );
    }
    if (needsOptions(question.question_type)) {
      return <Stack spacing={0.5}>{options.map((option) => <Chip key={option} label={option} variant="outlined" sx={{ alignSelf: 'flex-start' }} />)}</Stack>;
    }
    if (question.question_type === 'texto_largo') return <TextField disabled fullWidth multiline minRows={3} placeholder="Respuesta larga" />;
    return <TextField disabled fullWidth size="small" placeholder="Respuesta" />;
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 950 }}>Previsualizacion del instrumento</DialogTitle>
      <DialogContent dividers>
        {!form ? <CircularProgress /> : (
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, color: 'white', bgcolor: form.theme_config?.primary || '#1d4ed8' }}>
              <Typography variant="h5" sx={{ fontWeight: 950 }}>{form.title}</Typography>
              <Typography sx={{ opacity: 0.9 }}>{form.description || form.objective || 'Instrumento institucional'}</Typography>
            </Paper>
            {groupedSections.map((section, sectionIndex) => (
              <Paper key={section.id || sectionIndex} elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 950 }}>Seccion {sectionIndex + 1} de {groupedSections.length}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 950 }}>{section.title || 'Preguntas generales'}</Typography>
                {section.description && <Typography sx={{ color: '#64748b', mb: 1 }}>{section.description}</Typography>}
                <Stack spacing={1.1} sx={{ mt: 1 }}>
                  {section.questions.map((question, questionIndex) => (
                    <Paper key={question.id || questionIndex} elevation={0} sx={{ p: 1.2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontWeight: 900, mb: 0.8 }}>{questionIndex + 1}. {question.question_text || 'Pregunta sin titulo'}</Typography>
                      {renderPreviewQuestion(question)}
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            ))}
            {!groupedSections.length && <Alert severity="info">Este instrumento aun no tiene preguntas para previsualizar.</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function InstrumentEditor({ open, initial, onClose, onSaved }) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [draggingQuestionIndex, setDraggingQuestionIndex] = useState(null);
  const questionsEndRef = useRef(null);

  useEffect(() => {
    setForm(initial ? {
      ...blankForm,
      ...initial,
      opens_at: initial.opens_at ? String(initial.opens_at).slice(0, 16) : '',
      closes_at: initial.closes_at ? String(initial.closes_at).slice(0, 16) : '',
      questions: initial.questions?.length ? initial.questions : blankForm.questions,
      sections: initial.sections?.length ? initial.sections : blankForm.sections,
      theme_config: initial.theme_config?.name ? initial.theme_config : blankForm.theme_config
    } : blankForm);
  }, [initial, open]);

  const updateQuestion = (index, next) => {
    setForm((current) => ({
      ...current,
      questions: (() => {
        const previous = current.questions[index] || {};
        const previousSection = String(previous.section_id || previous.section_temp_id || '');
        const nextSection = String(next.section_id || next.section_temp_id || '');
        const questions = current.questions.map((question, qIndex) => qIndex === index ? { ...next } : question);
        if (previousSection === nextSection) {
          return questions.map((question, qIndex) => ({ ...question, order_index: qIndex }));
        }
        const [moved] = questions.splice(index, 1);
        let insertAt = questions.reduce((lastIndex, question, qIndex) => {
          const sectionKey = String(question.section_id || question.section_temp_id || '');
          return sectionKey === nextSection ? qIndex : lastIndex;
        }, -1);
        if (insertAt < 0) insertAt = questions.length - 1;
        questions.splice(insertAt + 1, 0, moved);
        return questions.map((question, qIndex) => ({ ...question, order_index: qIndex }));
      })()
    }));
  };

  const addQuestion = (section = null) => {
    setForm((current) => {
      const question = createEmptyQuestion(current.questions.length);
      const nextQuestion = section
        ? { ...question, section_id: section.id || null, section_temp_id: section.temp_id || '' }
        : question;
      return { ...current, questions: [...current.questions, nextQuestion] };
    });
    window.setTimeout(() => {
      questionsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const reorderQuestion = (fromIndex, toIndex) => {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    setForm((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.questions.length || toIndex >= current.questions.length) return current;
      const questions = [...current.questions];
      const [moved] = questions.splice(fromIndex, 1);
      questions.splice(toIndex, 0, moved);
      return { ...current, questions: questions.map((question, qIndex) => ({ ...question, order_index: qIndex })) };
    });
  };

  const duplicateQuestion = (index) => {
    setForm((current) => {
      const source = current.questions[index];
      if (!source) return current;
      const clone = {
        ...source,
        id: undefined,
        question_text: `${source.question_text || 'Pregunta'} (copia)`,
        options: Array.isArray(source.options) ? [...source.options] : [],
        config: { ...(source.config || {}) },
        validation_rules: { ...(source.validation_rules || {}) }
      };
      const questions = [...current.questions];
      questions.splice(index + 1, 0, clone);
      return { ...current, questions: questions.map((question, qIndex) => ({ ...question, order_index: qIndex })) };
    });
  };

  const editorQuestionGroups = useMemo(() => {
    const baseGroups = (form.sections || []).map((section, sectionIndex) => ({
      key: String(section.id || section.temp_id || `section-${sectionIndex}`),
      section,
      title: section.title || `Seccion ${sectionIndex + 1}`,
      description: section.description || '',
      questions: []
    }));
    const noSection = { key: 'no-section', section: null, title: 'Sin seccion', description: 'Preguntas generales que todavia no tienen seccion asignada.', questions: [] };
    const findGroup = (question) => {
      const sectionKey = String(question.section_id || question.section_temp_id || '');
      return baseGroups.find((group) => String(group.section.id || group.section.temp_id) === sectionKey) || noSection;
    };
    (form.questions || []).forEach((question, originalIndex) => {
      findGroup(question).questions.push({ question, originalIndex });
    });
    return [...baseGroups.filter((group) => group.questions.length), ...(noSection.questions.length ? [noSection] : [])];
  }, [form.questions, form.sections]);

  const save = async (publish = false) => {
    setSaving(true);
    try {
      const tempSectionIndex = new Map((form.sections || []).map((section, index) => [section.temp_id, index]));
      const payloadSections = (form.sections || []).map((section, index) => ({
        ...section,
        order_index: index
      }));
      const payloadQuestions = (form.questions || []).map((question) => {
        const normalized = withDefaultOptions(question);
        const tempIndex = normalized.section_temp_id ? tempSectionIndex.get(normalized.section_temp_id) : null;
        const tempSection = Number.isInteger(tempIndex) ? payloadSections[tempIndex] : null;
        const selectedSectionIndex = payloadSections.findIndex((section) => {
          const selectedKey = String(normalized.section_id || normalized.section_temp_id || '');
          const sectionKey = String(section.id || section.temp_id || '');
          return selectedKey && sectionKey && selectedKey === sectionKey;
        });
        return {
          ...normalized,
          section_id: normalized.section_id || tempSection?.id || null,
          section_temp_id: normalized.section_temp_id || '',
          section_index: selectedSectionIndex >= 0 ? selectedSectionIndex : null
        };
      });

      const payload = {
        ...form,
        sections: payloadSections,
        status: publish ? 'publicado' : (form.status || 'borrador'),
        questions: payloadQuestions
      };
      const response = form.id ? await instrumentosApi.update(form.id, payload) : await instrumentosApi.create(payload);
      if (publish) await instrumentosApi.publish(response.data.id);
      enqueueSnackbar(publish ? 'Instrumento guardado y publicado' : 'Instrumento guardado', { variant: 'success' });
      onSaved();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el instrumento', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 950 }}>{form.id ? 'Editar instrumento' : 'Crear instrumento'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={7}><TextField label="Nombre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} fullWidth size="small" /></Grid>
          <Grid item xs={12} md={2}><TextField label="Año" type="number" value={form.year || ''} onChange={(e) => setForm({ ...form, year: e.target.value })} fullWidth size="small" /></Grid>
          <Grid item xs={12} md={3}><TextField label="Periodo" value={form.period || ''} onChange={(e) => setForm({ ...form, period: e.target.value })} fullWidth size="small" /></Grid>
          <Grid item xs={12} md={6}><TextField label="Programa" value={form.program_name || ''} onChange={(e) => setForm({ ...form, program_name: e.target.value })} fullWidth size="small" /></Grid>
          <Grid item xs={12} md={3}><TextField label="Area" value={form.area_name || ''} onChange={(e) => setForm({ ...form, area_name: e.target.value })} fullWidth size="small" /></Grid>
          <Grid item xs={12} md={3}><TextField label="Tipo" value={form.type || ''} onChange={(e) => setForm({ ...form, type: e.target.value })} fullWidth size="small" /></Grid>
          <Grid item xs={12}><TextField label="Descripcion corta" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth size="small" multiline minRows={2} /></Grid>
          <Grid item xs={12}><TextField label="Objetivo" value={form.objective || ''} onChange={(e) => setForm({ ...form, objective: e.target.value })} fullWidth size="small" multiline minRows={2} /></Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={3}><TextField label="Apertura" type="datetime-local" value={form.opens_at || ''} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Cierre" type="datetime-local" value={form.closes_at || ''} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} fullWidth size="small" InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Limite respuestas" type="number" value={form.response_limit || ''} onChange={(e) => setForm({ ...form, response_limit: e.target.value })} fullWidth size="small" /></Grid>
          <Grid item xs={12} md={3}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>Anonimo</Typography>
              <Switch checked={Boolean(form.is_anonymous)} onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })} />
              <Typography variant="body2" sx={{ fontWeight: 800 }}>Multiple</Typography>
              <Switch checked={Boolean(form.allow_multiple_responses)} onChange={(e) => setForm({ ...form, allow_multiple_responses: e.target.checked })} />
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Tema visual</InputLabel>
              <Select value={form.theme_config?.name || themePresets[0].name} label="Tema visual" onChange={(e) => setForm({ ...form, theme_config: themePresets.find((item) => item.name === e.target.value) || themePresets[0] })}>
                {themePresets.map((theme) => <MenuItem key={theme.name} value={theme.name}>{theme.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <Paper elevation={0} sx={{ p: 1.2, borderRadius: 2, border: '1px solid #fbbf24', bgcolor: form.evidence_context?.quiz_mode ? '#fffbeb' : '#fff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Box>
                  <Typography sx={{ fontWeight: 950, color: '#92400e' }}>Convertir en cuestionario de evaluacion</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Permite marcar respuestas correctas, puntos y retroalimentacion por pregunta.</Typography>
                </Box>
                <Switch
                  checked={Boolean(form.evidence_context?.quiz_mode)}
                  onChange={(e) => setForm({ ...form, evidence_context: { ...(form.evidence_context || {}), quiz_mode: e.target.checked, show_feedback: true } })}
                />
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <SectionsEditor
          sections={form.sections || []}
          onChange={(sections) => setForm((current) => ({ ...current, sections }))}
        />

        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Preguntas</Typography>
            <Button startIcon={<AddIcon />} onClick={addQuestion}>Agregar pregunta</Button>
          </Stack>
          {editorQuestionGroups.map((group) => (
            <Paper key={group.key} elevation={0} sx={{ p: 1.2, borderRadius: 2.5, border: '1px solid #dbeafe', bgcolor: group.section ? '#f8fbff' : '#fff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>{group.title}</Typography>
                  {group.description && <Typography variant="caption" sx={{ color: '#64748b' }}>{group.description}</Typography>}
                </Box>
                {group.section && <Button size="small" startIcon={<AddIcon />} onClick={() => addQuestion(group.section)}>Agregar aqui</Button>}
              </Stack>
              <Stack spacing={1}>
                {group.questions.map(({ question, originalIndex }, groupQuestionIndex) => {
                  const previousQuestion = group.questions[groupQuestionIndex - 1];
                  const nextQuestion = group.questions[groupQuestionIndex + 1];
                  return (
                  <Box
                    key={`${question.id || 'new'}-${originalIndex}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      reorderQuestion(draggingQuestionIndex, originalIndex);
                      setDraggingQuestionIndex(null);
                    }}
                    onDragEnd={() => setDraggingQuestionIndex(null)}
                    sx={{
                      opacity: draggingQuestionIndex === originalIndex ? 0.55 : 1,
                      cursor: 'grab'
                    }}
                  >
                    <QuestionFields
                      question={question}
                      index={originalIndex}
                      displayIndex={groupQuestionIndex + 1}
                      sections={form.sections || []}
                      questions={form.questions || []}
                      conditions={form.conditions || []}
                      isQuiz={Boolean(form.evidence_context?.quiz_mode)}
                      onConditionsChange={(conditions) => setForm((current) => ({ ...current, conditions }))}
                      onChange={(next) => updateQuestion(originalIndex, next)}
                      onRemove={() => setForm((current) => ({ ...current, questions: current.questions.filter((_, qIndex) => qIndex !== originalIndex) }))}
                      onDuplicate={() => duplicateQuestion(originalIndex)}
                      onMoveUp={() => reorderQuestion(originalIndex, previousQuestion?.originalIndex)}
                      onMoveDown={() => reorderQuestion(originalIndex, nextQuestion?.originalIndex)}
                      disableMoveUp={!previousQuestion}
                      disableMoveDown={!nextQuestion}
                      dragHandleProps={{
                        draggable: true,
                        onDragStart: (event) => {
                          event.stopPropagation();
                          setDraggingQuestionIndex(originalIndex);
                        }
                      }}
                    />
                  </Box>
                  );
                })}
              </Stack>
            </Paper>
          ))}
          <Box ref={questionsEndRef} />
          <Paper
            elevation={0}
            sx={{
              p: 1.4,
              borderRadius: 2,
              border: '1px dashed #93c5fd',
              bgcolor: '#f8fbff',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <Button startIcon={<AddIcon />} variant="contained" onClick={addQuestion} sx={{ borderRadius: 999, fontWeight: 900 }}>
              Agregar otra pregunta
            </Button>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button startIcon={<SaveIcon />} disabled={saving} variant="outlined" onClick={() => save(false)}>Guardar borrador</Button>
        <Button startIcon={<PublishIcon />} disabled={saving} variant="contained" onClick={() => save(true)}>Publicar</Button>
      </DialogActions>
    </Dialog>
  );
}

function InstrumentosPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState('panel');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [forms, setForms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [results, setResults] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [bank, setBank] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', include_archived: false });
  const [qrDialog, setQrDialog] = useState({ open: false, title: '', url: '' });
  const [responseDialog, setResponseDialog] = useState({ open: false, response: null });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, list, bankRows] = await Promise.all([
        instrumentosApi.dashboard(),
        instrumentosApi.list(filters),
        instrumentosApi.questionBank().catch(() => ({ data: [] }))
      ]);
      setDashboard(dash.data);
      setForms(list.data.rows || []);
      setBank(bankRows.data || []);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar instrumentos', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, filters]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openDetails = useCallback(async (form, nextTab = 'consultar') => {
    if (!form?.id) return;
    setTab(nextTab);
    try {
      const [detail, formResults, stats] = await Promise.all([
        instrumentosApi.get(form.id),
        instrumentosApi.results(form.id).catch(() => ({ data: [] })),
        instrumentosApi.statistics(form.id).catch(() => ({ data: null }))
      ]);
      setSelected(detail.data);
      setDetails(detail.data);
      setResults(formResults.data || []);
      setStatistics(stats.data || null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar el instrumento', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (loading || details || !forms.length || !['resultados', 'estadisticas', 'backups'].includes(tab)) return;
    openDetails(forms[0], tab);
  }, [details, forms, loading, openDetails, tab]);

  const openEditor = async (form = null) => {
    if (!form?.id) {
      setSelected(null);
      setEditorOpen(true);
      return;
    }
    setEditorLoading(true);
    try {
      const response = await instrumentosApi.get(form.id);
      setSelected(response.data);
      setEditorOpen(true);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar el instrumento completo para editar', { variant: 'error' });
    } finally {
      setEditorLoading(false);
    }
  };

  const runAction = async (label, action) => {
    try {
      await action();
      enqueueSnackbar(label, { variant: 'success' });
      await loadAll();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible completar la accion', { variant: 'error' });
    }
  };

  const deleteInstrument = async (form) => {
    const confirmed = window.confirm(`Eliminar definitivamente "${form.title}"?\n\nEsta accion borra estructura, respuestas y estadisticas del instrumento.`);
    if (!confirmed) return;
    await runAction('Instrumento eliminado definitivamente', () => instrumentosApi.delete(form.id));
  };

  const charts = useMemo(() => statistics?.questions?.filter((question) => question.distribution?.length).slice(0, 4) || [], [statistics]);
  const selectedThemeColor = details?.theme_config?.primary || details?.theme_config?.accent || '#1d4ed8';

  const questionById = useMemo(() => {
    const pairs = (details?.questions || []).map((question) => [Number(question.id), question]);
    return new Map(pairs);
  }, [details]);

  const formatAnswerValue = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'object' ? item.other || item.option || JSON.stringify(item) : item)).join(', ');
    }
    if (value && typeof value === 'object') {
      if (value.external_url) return value.external_url;
      if (value.file_name) return `${value.file_name}${value.file_size ? ` (${Math.round(value.file_size / 1024)} KB)` : ''}`;
      if (value.other) return `${value.option || 'Otro'}: ${value.other}`;
      return Object.entries(value).map(([key, item]) => `${key}: ${item}`).join(' | ');
    }
    return String(value ?? '-');
  };

  const calculateResponseScore = (response) => {
    if (!details?.evidence_context?.quiz_mode) return null;
    const answerMap = new Map((response?.answers || []).map((answer) => [Number(answer.question_id), answer.answer_value]));
    return (details.questions || []).reduce((acc, question) => {
      const correct = Array.isArray(question.config?.correct_answers) ? question.config.correct_answers : [];
      if (!correct.length) return acc;
      const points = Number(question.config?.points ?? 1);
      const value = answerMap.get(Number(question.id));
      const isCorrect = Array.isArray(value)
        ? correct.length === value.length && correct.every((item) => value.includes(item))
        : correct.includes(String(value));
      return {
        total: acc.total + points,
        score: acc.score + (isCorrect ? points : 0)
      };
    }, { score: 0, total: 0 });
  };

  const buildPublicUrl = (form = {}) => {
    const raw = form.public_url || (form.public_code ? `/f/${form.public_code}` : '');
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${window.location.origin}${raw.startsWith('/') ? raw : `/${raw}`}`;
  };

  const buildPreviewUrl = (form = {}) => `${window.location.origin}/instrumentos/preview/${form.id}`;

  const buildOpenFormUrl = (form = {}) => (
    form.status === 'publicado' ? buildPublicUrl(form) : buildPreviewUrl(form)
  );

  const openQrDialog = (form = {}) => {
    const url = buildPublicUrl(form);
    if (!url) {
      enqueueSnackbar('Este instrumento aun no tiene enlace publico.', { variant: 'warning' });
      return;
    }
    setQrDialog({ open: true, title: form.title || 'Instrumento', url });
  };

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrDialog.url);
      enqueueSnackbar('Enlace copiado', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('No fue posible copiar el enlace automaticamente', { variant: 'warning' });
    }
  };

  const goToFilteredList = (status = '') => {
    setFilters((current) => ({ ...current, status, include_archived: status === 'archivado' || current.include_archived }));
    setTab('historico');
  };

  const renderNavigation = () => (
    <Paper elevation={0} sx={{ p: 1, borderRadius: 2.5, border: '1px solid #dbeafe', mb: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }, gap: 0.8 }}>
        {[
          ['panel', 'Inicio', <FactCheckIcon />],
          ['crear', 'Crear', <AddIcon />],
          ['historico', 'Instrumentos', <HistoryIcon />],
          ['banco', 'Banco', <LibraryBooksIcon />],
          ['estadisticas', 'Estadisticas', <InsertChartIcon />],
          ['backups', 'Backups', <BackupIcon />]
        ].map(([key, label, icon]) => (
          <Button
            key={key}
            startIcon={React.cloneElement(icon, { fontSize: 'small' })}
            variant={tab === key ? 'contained' : 'outlined'}
            onClick={() => {
              if (key === 'crear') {
                openEditor(null);
                return;
              }
              setTab(key);
            }}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}
          >
            {label}
          </Button>
        ))}
      </Box>
    </Paper>
  );

  const renderDashboard = () => (
    <>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6} md={2.4}><ActionMetricCard label="Total" value={dashboard?.total} icon={<FactCheckIcon />} onClick={() => goToFilteredList('')} /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><ActionMetricCard label="Publicados" value={dashboard?.activos} icon={<PublishIcon />} color="#047857" onClick={() => goToFilteredList('publicado')} /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><ActionMetricCard label="Cerrados" value={dashboard?.cerrados} icon={<StopCircleIcon />} color="#b45309" onClick={() => goToFilteredList('cerrado')} /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><ActionMetricCard label="Archivados" value={dashboard?.archivados} icon={<ArchiveIcon />} color="#991b1b" onClick={() => goToFilteredList('archivado')} /></Grid>
        <Grid item xs={12} sm={6} md={2.4}><ActionMetricCard label="Respuestas" value={dashboard?.respuestas} icon={<AssessmentIcon />} color="#0f766e" onClick={() => setTab('resultados')} /></Grid>
      </Grid>
      <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Ultimos instrumentos creados</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>Ordenados del mas reciente al mas antiguo.</Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEditor(null)}>Crear instrumento</Button>
        </Stack>
        {renderTable(dashboard?.ultimos || forms)}
      </Paper>
    </>
  );

  const renderTable = (rows = forms) => (
    <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 950 }}>Nombre</TableCell>
            <TableCell sx={{ fontWeight: 950 }}>Programa / Area</TableCell>
            <TableCell sx={{ fontWeight: 950 }}>Año / Periodo</TableCell>
            <TableCell sx={{ fontWeight: 950 }}>Estado</TableCell>
            <TableCell sx={{ fontWeight: 950 }}>Respuestas</TableCell>
            <TableCell sx={{ fontWeight: 950 }}>Creacion</TableCell>
            <TableCell align="center" sx={{ fontWeight: 950 }}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((form) => (
            <TableRow key={form.id} hover>
              <TableCell>
                <Typography sx={{ fontWeight: 900 }}>{form.title}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>{form.type || 'Instrumento'} v{form.version || 1}</Typography>
              </TableCell>
              <TableCell>{form.program_name || '-'}<br /><Typography variant="caption">{form.area_name || '-'}</Typography></TableCell>
              <TableCell>{form.year || '-'} / {form.period || '-'}</TableCell>
              <TableCell><StatusChip status={form.status} /></TableCell>
              <TableCell>{form.response_count || 0}</TableCell>
              <TableCell>{formatDate(form.created_at)}</TableCell>
              <TableCell align="center">
                <Tooltip title="Previsualizar como usuario"><IconButton size="small" component="a" href={buildPreviewUrl(form)} target="_blank" rel="noopener noreferrer"><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Consultar detalle"><IconButton size="small" onClick={() => openDetails(form, 'consultar')}><FactCheckIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Editar"><IconButton size="small" disabled={editorLoading} onClick={() => openEditor(form)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Ver QR y enlace"><IconButton size="small" onClick={() => openQrDialog(form)}><QrCodeIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Publicar"><IconButton size="small" onClick={() => runAction('Instrumento publicado', () => instrumentosApi.publish(form.id))}><PublishIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Cerrar"><IconButton size="small" onClick={() => runAction('Instrumento cerrado', () => instrumentosApi.close(form.id))}><StopCircleIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Duplicar"><IconButton size="small" onClick={() => runAction('Instrumento duplicado', () => instrumentosApi.duplicate(form.id))}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Archivar"><IconButton size="small" onClick={() => runAction('Instrumento archivado', () => instrumentosApi.archive(form.id))}><ArchiveIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Eliminar definitivamente"><Button size="small" color="error" onClick={() => deleteInstrument(form)}>Borrar</Button></Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={7}><Alert severity="info">No hay instrumentos para los filtros seleccionados.</Alert></TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderHistory = () => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
        <TextField size="small" label="Buscar por nombre" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} fullWidth />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Estado</InputLabel>
          <Select value={filters.status} label="Estado" onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="borrador">Borrador</MenuItem>
            <MenuItem value="publicado">Publicado</MenuItem>
            <MenuItem value="cerrado">Cerrado</MenuItem>
            <MenuItem value="archivado">Archivado</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={() => setFilters({ ...filters, include_archived: !filters.include_archived })}>
          {filters.include_archived ? 'Ocultar archivados' : 'Ver archivados'}
        </Button>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEditor(null)}>Crear</Button>
      </Stack>
      {renderTable(forms)}
    </Paper>
  );

  const renderConsult = () => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
      {!details ? <Alert severity="info">Selecciona un instrumento del historico.</Alert> : (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 950 }}>{details.title}</Typography>
              <Typography sx={{ color: '#64748b' }}>{details.objective || details.description}</Typography>
            </Box>
            <Stack direction="row" spacing={0.8}>
              <StatusChip status={details.status} />
              <Button size="small" startIcon={<LaunchIcon />} href={buildOpenFormUrl(details)} target="_blank" rel="noopener noreferrer">
                {details.status === 'publicado' ? 'Abrir formulario' : 'Vista previa'}
              </Button>
              <Button size="small" startIcon={<QrCodeIcon />} onClick={() => openQrDialog(details)}>QR</Button>
            </Stack>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}><MetricCard label="Version" value={details.version} icon={<HistoryIcon />} /></Grid>
            <Grid item xs={12} md={3}><MetricCard label="Respuestas" value={details.response_count} icon={<AssessmentIcon />} color="#0f766e" /></Grid>
            <Grid item xs={12} md={3}><MetricCard label="Preguntas" value={details.questions?.length} icon={<LibraryBooksIcon />} color="#7c3aed" /></Grid>
            <Grid item xs={12} md={3}><MetricCard label="Anonimo" value={details.is_anonymous ? 1 : 0} icon={<VisibilityIcon />} color="#b45309" /></Grid>
          </Grid>
          <Typography sx={{ mt: 2, mb: 1, fontWeight: 950 }}>Preguntas</Typography>
          <Stack spacing={1}>
            {(details.questions || []).map((question, index) => (
              <Paper key={question.id} elevation={0} sx={{ p: 1.3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontWeight: 900 }}>{index + 1}. {question.question_text}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>{question.question_type} {question.is_required ? '· obligatoria' : '· opcional'}</Typography>
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  );

  const renderResults = () => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
      {!details ? <Alert severity="info">Consulta primero un instrumento para ver sus resultados.</Alert> : (
        <>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontWeight: 950 }}>Resultados reales: {details.title}</Typography>
            <Button size="small" component="a" href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/autoevaluacion/instrumentos/${details.id}/export/excel`} target="_blank">Exportar Excel</Button>
          </Stack>
          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Codigo</TableCell><TableCell>Fecha</TableCell><TableCell>Respondente</TableCell><TableCell>Respuestas</TableCell><TableCell align="right">Detalle</TableCell></TableRow></TableHead>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.respondent_code}</TableCell>
                    <TableCell>{formatDate(row.submitted_at)}</TableCell>
                    <TableCell>{row.is_anonymous ? 'Anonimo' : Object.values(row.respondent_data || {}).join(' / ')}</TableCell>
                    <TableCell>{(row.answers || []).length}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => setResponseDialog({ open: true, response: row })}>
                        Ver resumen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!results.length && <TableRow><TableCell colSpan={5}>Sin respuestas registradas.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Paper>
  );

  const renderStatistics = () => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
      {!statistics ? <Alert severity="info">Selecciona un instrumento para calcular estadisticas.</Alert> : (
        <>
          <MetricCard label="Total respuestas" value={statistics.total_responses} icon={<InsertChartIcon />} />
          {!charts.length && (
            <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
              Las graficas se activan automaticamente cuando el instrumento tenga respuestas con opciones, escalas o matrices.
            </Alert>
          )}
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            {charts.map((question, index) => (
              <Grid item xs={12} md={6} key={question.id}>
                <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontWeight: 900, mb: 1 }}>{question.text}</Typography>
                  <ResponsiveContainer width="100%" height={230}>
                    {index % 2 === 0 ? (
                      <BarChart data={question.distribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <ChartTooltip />
                        <Bar dataKey="value" fill={selectedThemeColor} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : (
                      <PieChart>
                        <Pie data={question.distribution} dataKey="value" nameKey="name" outerRadius={80} label>
                          {question.distribution.map((_, cellIndex) => <Cell key={cellIndex} fill={[selectedThemeColor, '#0f766e', '#d97706', '#7c3aed'][cellIndex % 4]} />)}
                        </Pie>
                        <ChartTooltip />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Paper>
  );

  const renderBank = () => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
      <Typography sx={{ fontWeight: 950, mb: 1 }}>Banco reutilizable de preguntas</Typography>
      <Grid container spacing={1}>
        {bank.map((question) => (
          <Grid item xs={12} md={6} key={question.id}>
            <Paper elevation={0} sx={{ p: 1.4, borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontWeight: 900 }}>{question.question_text}</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>{question.category || 'Sin categoria'} · {question.question_type}</Typography>
            </Paper>
          </Grid>
        ))}
        {!bank.length && <Grid item xs={12}><Alert severity="info">El banco aun no tiene preguntas reutilizables.</Alert></Grid>}
      </Grid>
    </Paper>
  );

  const renderBackups = () => (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
      <Alert severity="info" sx={{ mb: 1.5 }}>Los backups respetan el alcance del usuario: creador solo sus instrumentos, administrador todos los que puede consultar.</Alert>
      {details ? (
        <Button variant="contained" startIcon={<BackupIcon />} component="a" href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/autoevaluacion/instrumentos/${details.id}/backup`} target="_blank">
          Generar backup del instrumento seleccionado
        </Button>
      ) : (
        <Typography>Selecciona un instrumento en Consultar para generar su backup.</Typography>
      )}
    </Paper>
  );

  return (
    <Box>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 2, borderRadius: 3, color: 'white', background: 'linear-gradient(120deg, #0f172a 0%, #1d4ed8 52%, #0f766e 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 950 }}>Gestion de Instrumentos</Typography>
            <Typography sx={{ color: '#dbeafe' }}>Crea, publica, responde, consulta y respalda formularios institucionales dentro de Autoevaluacion.</Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => openEditor(null)} sx={{ bgcolor: 'white', color: '#1d4ed8', fontWeight: 900, '&:hover': { bgcolor: '#eff6ff' } }}>Crear instrumento</Button>
        </Stack>
      </Paper>
      {renderNavigation()}
      {loading ? <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : (
        <>
          {tab === 'panel' && renderDashboard()}
          {tab === 'historico' && renderHistory()}
          {tab === 'consultar' && renderConsult()}
          {tab === 'resultados' && renderResults()}
          {tab === 'estadisticas' && renderStatistics()}
          {tab === 'banco' && renderBank()}
          {tab === 'backups' && renderBackups()}
        </>
      )}
      <InstrumentEditor open={editorOpen} initial={selected} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); loadAll(); }} />
      <Dialog open={responseDialog.open} onClose={() => setResponseDialog({ open: false, response: null })} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 950 }}>Resumen de respuesta</DialogTitle>
        <DialogContent dividers>
          {responseDialog.response && (
            <Stack spacing={1.5}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                  <Box>
                    <Typography sx={{ fontWeight: 950 }}>{responseDialog.response.respondent_code}</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>{formatDate(responseDialog.response.submitted_at)}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 900, color: '#475569' }}>
                    {responseDialog.response.is_anonymous ? 'Respuesta anonima' : Object.values(responseDialog.response.respondent_data || {}).join(' / ')}
                  </Typography>
                </Stack>
              </Paper>
              {(() => {
                const score = calculateResponseScore(responseDialog.response);
                return score?.total ? (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    Puntaje del cuestionario: {score.score} de {score.total}
                  </Alert>
                ) : null;
              })()}
              <Stack spacing={1}>
                {(responseDialog.response.answers || []).map((answer) => {
                  const question = questionById.get(Number(answer.question_id));
                  return (
                    <Paper key={answer.id || `${answer.question_id}-${answer.created_at}`} elevation={0} sx={{ p: 1.3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontWeight: 900 }}>{question?.question_text || `Pregunta ${answer.question_id}`}</Typography>
                      <Typography sx={{ color: '#334155', mt: 0.5 }}>{formatAnswerValue(answer.answer_value)}</Typography>
                      {question?.config?.feedback_correct || question?.config?.feedback_incorrect ? (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.6, color: '#64748b' }}>
                          Retroalimentacion configurada: {question.config.feedback_correct || question.config.feedback_incorrect}
                        </Typography>
                      ) : null}
                    </Paper>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setResponseDialog({ open: false, response: null })}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={qrDialog.open} onClose={() => setQrDialog({ open: false, title: '', url: '' })} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 950 }}>Código QR del formulario</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} alignItems="center">
            <Typography sx={{ fontWeight: 900, textAlign: 'center', color: '#0f172a' }}>{qrDialog.title}</Typography>
            <Box
              component="img"
              alt="Código QR del formulario"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(qrDialog.url)}`}
              sx={{ width: 260, height: 260, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: 'white', p: 1 }}
            />
            <TextField value={qrDialog.url} fullWidth size="small" InputProps={{ readOnly: true }} />
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Puedes copiar el enlace o escanear el código para responder el formulario.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<ContentCopyIcon />} onClick={copyPublicUrl}>Copiar enlace</Button>
          <Button startIcon={<LaunchIcon />} component="a" href={qrDialog.url} target="_blank" rel="noopener noreferrer">Abrir</Button>
          <Button variant="contained" onClick={() => setQrDialog({ open: false, title: '', url: '' })}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InstrumentosPanel;
