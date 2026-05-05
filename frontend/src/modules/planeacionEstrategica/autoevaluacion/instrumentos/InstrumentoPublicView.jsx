import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Rating,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  SentimentDissatisfied as SentimentDissatisfiedIcon,
  SentimentNeutral as SentimentNeutralIcon,
  SentimentSatisfied as SentimentSatisfiedIcon,
  SentimentVeryDissatisfied as SentimentVeryDissatisfiedIcon,
  SentimentVerySatisfied as SentimentVerySatisfiedIcon
} from '@mui/icons-material';
import instrumentosApi from './services/instrumentosApi';
import { evaluateCondition, isQuestionVisible } from './utils/conditionalEngine';
import { normalizeOptions } from './utils/questionTypes';

function InstrumentoPublicView({ previewMode = false }) {
  const { code, id } = useParams();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [respondentData, setRespondentData] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    const request = previewMode ? instrumentosApi.preview(id) : instrumentosApi.publicGet(code);
    request
      .then((response) => {
        if (mounted) setForm(response.data);
      })
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message || 'Instrumento no disponible');
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [code, id, previewMode]);

  const visibleQuestions = useMemo(() => (form?.questions || []).filter((question) => isQuestionVisible(question, form?.conditions || [], answers)), [form, answers]);
  const groupedSections = useMemo(() => {
    const sections = form?.sections || [];
    const bySection = new Map(sections.map((section) => [Number(section.id), { ...section, questions: [] }]));
    const noSection = { id: 'none', title: '', description: '', questions: [] };
    visibleQuestions.forEach((question) => {
      const target = bySection.get(Number(question.section_id)) || noSection;
      target.questions.push(question);
    });
    return [...Array.from(bySection.values()).filter((section) => section.questions.length), ...(noSection.questions.length ? [noSection] : [])];
  }, [form, visibleQuestions]);
  useEffect(() => {
    setActiveSectionIndex((current) => Math.min(current, Math.max(0, groupedSections.length - 1)));
  }, [groupedSections.length]);
  const currentSection = groupedSections[activeSectionIndex] || groupedSections[0] || null;
  const isLastSection = activeSectionIndex >= groupedSections.length - 1;
  const progress = groupedSections.length ? Math.round(((activeSectionIndex + 1) / groupedSections.length) * 100) : 0;
  const theme = form?.theme_config || {};
  const themeColor = theme.primary || theme.accent || '#047857';
  const footerColor = themeColor;
  const choiceControlSx = { color: themeColor, '&.Mui-checked': { color: themeColor } };

  const setAnswer = (questionId, value) => setAnswers((current) => ({ ...current, [questionId]: value }));
  const setOtherAnswer = (questionId, value) => setAnswers((current) => ({ ...current, [questionId]: { option: 'Otro', other: value } }));
  const isOtherSelected = (value) => value === 'Otro' || value?.option === 'Otro';
  const hasAnswer = (value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.values(value).some((item) => String(item || '').trim());
    return String(value ?? '').trim() !== '';
  };
  const setFileAnswer = (questionId, patch) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] && typeof current[questionId] === 'object' ? current[questionId] : {}),
        ...patch
      }
    }));
  };
  const validateSection = (section) => {
    const missing = (section?.questions || []).find((question) => question.is_required && !hasAnswer(answers[question.id]));
    if (missing) {
      setError(`Completa la pregunta obligatoria: ${missing.question_text}`);
      return false;
    }
    setError('');
    return true;
  };
  const findJumpSectionIndex = () => {
    const jump = (form?.conditions || []).find((condition) => {
      if (condition.target_type !== 'section' || condition.action !== 'jump_section') return false;
      const rules = condition.condition_logic?.rules || [];
      return rules.every((rule) => evaluateCondition(rule, answers));
    });
    if (!jump) return -1;
    return groupedSections.findIndex((section) => Number(section.id) === Number(jump.target_id));
  };
  const goNextSection = () => {
    if (!validateSection(currentSection)) return;
    const jumpIndex = findJumpSectionIndex();
    setActiveSectionIndex((current) => (
      jumpIndex >= 0 && jumpIndex > current
        ? jumpIndex
        : Math.min(current + 1, groupedSections.length - 1)
    ));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goPreviousSection = () => {
    setError('');
    setActiveSectionIndex((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const emotionIcons = [
    { icon: <SentimentVeryDissatisfiedIcon />, color: '#dc2626' },
    { icon: <SentimentDissatisfiedIcon />, color: '#ea580c' },
    { icon: <SentimentNeutralIcon />, color: '#64748b' },
    { icon: <SentimentSatisfiedIcon />, color: '#16a34a' },
    { icon: <SentimentVerySatisfiedIcon />, color: '#047857' }
  ];

  const emotionButtonSx = (emotion, active) => ({
    minWidth: 0,
    width: { xs: 54, sm: 66 },
    height: { xs: 54, sm: 66 },
    borderRadius: '50%',
    color: active ? 'white' : emotion.color,
    border: `2px solid ${emotion.color}`,
    bgcolor: active ? emotion.color : 'white',
    boxShadow: active ? `0 12px 26px ${emotion.color}55` : '0 8px 18px rgba(15,23,42,.08)',
    transform: active ? 'translateY(-3px) scale(1.08)' : 'translateY(0) scale(1)',
    transition: 'transform .18s ease, box-shadow .18s ease, background-color .18s ease',
    '& svg': { fontSize: { xs: 30, sm: 38 } },
    '&:hover': {
      bgcolor: active ? emotion.color : '#f8fafc',
      transform: 'translateY(-3px) scale(1.06)',
      boxShadow: `0 12px 24px ${emotion.color}35`
    }
  });

  const renderQuestion = (question) => {
    const value = answers[question.id] ?? '';
    const options = normalizeOptions(question.options, question.question_type);
    if (question.question_type === 'escala_lineal' || question.question_type === 'escala_numerica') {
      const min = Number(question.config?.min ?? 1);
      const max = Number(question.config?.max ?? 5);
      const values = Array.from({ length: Math.max(1, max - min + 1) }, (_, index) => min + index);
      return (
        <Box>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>{question.question_text}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {question.config?.min_label && <Typography variant="caption" sx={{ color: '#64748b', mr: 0.5 }}>{question.config.min_label}</Typography>}
            {values.map((item) => (
              <Button
                key={item}
                variant={Number(value) === item ? 'contained' : 'outlined'}
                onClick={() => setAnswer(question.id, item)}
                sx={{
                  minWidth: 42,
                  borderRadius: 999,
                  fontWeight: 900,
                  borderColor: themeColor,
                  color: Number(value) === item ? 'white' : themeColor,
                  bgcolor: Number(value) === item ? themeColor : 'white',
                  '&:hover': { borderColor: themeColor, bgcolor: Number(value) === item ? themeColor : `${themeColor}12` }
                }}
              >
                {item}
              </Button>
            ))}
            {question.config?.max_label && <Typography variant="caption" sx={{ color: '#64748b', ml: 0.5 }}>{question.config.max_label}</Typography>}
          </Stack>
        </Box>
      );
    }
    if (question.question_type === 'matriz' || question.question_type === 'matriz_likert') {
      const rows = question.config?.rows || ['Fila 1'];
      const columns = question.config?.columns || (question.question_type === 'matriz_likert'
        ? ['Totalmente en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Totalmente de acuerdo']
        : ['Columna 1']);
      const matrixValue = value && typeof value === 'object' ? value : {};
      return (
        <Box>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>{question.question_text}</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${columns.length}, minmax(120px, 1fr))`, gap: 0.8, minWidth: 220 + columns.length * 120 }}>
              <Box />
              {columns.map((column) => <Typography key={column} variant="caption" sx={{ fontWeight: 900, textAlign: 'center' }}>{column}</Typography>)}
              {rows.map((row) => (
                <React.Fragment key={row}>
                  <Typography sx={{ fontWeight: 800 }}>{row}</Typography>
                  {columns.map((column) => (
                    <Button
                      key={`${row}-${column}`}
                      variant={matrixValue[row] === column ? 'contained' : 'outlined'}
                      onClick={() => setAnswer(question.id, { ...matrixValue, [row]: column })}
                      sx={{
                        minWidth: 0,
                        borderColor: themeColor,
                        color: matrixValue[row] === column ? 'white' : themeColor,
                        bgcolor: matrixValue[row] === column ? themeColor : 'white',
                        '&:hover': { borderColor: themeColor, bgcolor: matrixValue[row] === column ? themeColor : `${themeColor}12` }
                      }}
                    >
                      {matrixValue[row] === column ? 'Seleccionado' : 'Elegir'}
                    </Button>
                  ))}
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </Box>
      );
    }
    if (question.question_type === 'estrellas') {
      const selectedIndex = options.findIndex((option) => option === value);
      return (
        <Box>
          <Typography sx={{ fontWeight: 900, mb: 0.7 }}>{question.question_text}</Typography>
          <Rating
            value={selectedIndex >= 0 ? selectedIndex + 1 : 0}
            max={options.length || 5}
            onChange={(_, nextValue) => setAnswer(question.id, options[(nextValue || 1) - 1] || String(nextValue || ''))}
            size="large"
          />
          {value && <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 800 }}>{value}</Typography>}
        </Box>
      );
    }
    if (question.question_type === 'caritas') {
      return (
        <Box>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>{question.question_text}</Typography>
          <Stack direction="row" spacing={1.2} flexWrap="wrap">
            {options.map((option, index) => {
              const emotion = emotionIcons[index] || emotionIcons[2];
              const active = value === option;
              return (
                <Button
                  key={option}
                  aria-label={option}
                  title={option}
                  onClick={() => setAnswer(question.id, option)}
                  sx={emotionButtonSx(emotion, active)}
                >
                  {emotion.icon}
                </Button>
              );
            })}
          </Stack>
        </Box>
      );
    }
    if (['seleccion_unica', 'likert', 'satisfaccion', 'caritas', 'estrellas', 'nps', 'si_no'].includes(question.question_type)) {
      return (
        <FormControl>
          <FormLabel>{question.question_text}</FormLabel>
          <RadioGroup value={typeof value === 'object' ? value.option : value} onChange={(event) => setAnswer(question.id, event.target.value)}>
            {options.map((option) => <FormControlLabel key={option} value={option} control={<Radio sx={choiceControlSx} />} label={option} />)}
          </RadioGroup>
          {isOtherSelected(value) && (
            <TextField
              size="small"
              label="Escribe otra respuesta"
              value={value?.other || ''}
              onChange={(event) => setOtherAnswer(question.id, event.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </FormControl>
      );
    }
    if (question.question_type === 'seleccion_multiple') {
      const selected = Array.isArray(value) ? value : [];
      return (
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{question.question_text}</Typography>
          {options.map((option) => (
            <FormControlLabel
              key={option}
              control={<Checkbox sx={choiceControlSx} checked={selected.includes(option)} onChange={(event) => setAnswer(question.id, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />}
              label={option}
            />
          ))}
          {selected.includes('Otro') && (
            <TextField
              size="small"
              label="Escribe otra respuesta"
              value={answers[`${question.id}_otro`] || ''}
              onChange={(event) => setAnswer(`${question.id}_otro`, event.target.value)}
              fullWidth
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      );
    }
    if (question.question_type === 'lista_desplegable') {
      return (
        <FormControl fullWidth>
          <FormLabel sx={{ mb: 0.8 }}>{question.question_text}</FormLabel>
          <Select value={value} onChange={(event) => setAnswer(question.id, event.target.value)} displayEmpty>
            <MenuItem value="">Selecciona una opcion</MenuItem>
            {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </Select>
        </FormControl>
      );
    }
    if (question.question_type === 'carga_archivo') {
      const fileValue = value && typeof value === 'object' ? value : {};
      const mode = question.config?.attachment_mode || 'both';
      const allowFile = mode !== 'external_url';
      const allowUrl = mode !== 'local_metadata';
      return (
        <Box>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>{question.question_text}</Typography>
          <Stack spacing={1}>
            {allowFile && (
              <Button variant="outlined" component="label" sx={{ alignSelf: 'flex-start', borderRadius: 2, fontWeight: 900 }}>
                Seleccionar archivo
                <input
                  hidden
                  type="file"
                  accept={question.config?.accept || undefined}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const maxBytes = Number(question.config?.max_mb || 10) * 1024 * 1024;
                    if (file.size > maxBytes) {
                      setError(`El archivo supera el limite permitido de ${question.config?.max_mb || 10} MB.`);
                      return;
                    }
                    setError('');
                    setFileAnswer(question.id, {
                      file_name: file.name,
                      file_type: file.type || 'application/octet-stream',
                      file_size: file.size,
                      storage_type: 'local_metadata'
                    });
                  }}
                />
              </Button>
            )}
            {fileValue.file_name && (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                Archivo seleccionado: {fileValue.file_name} ({Math.round((fileValue.file_size || 0) / 1024)} KB)
              </Alert>
            )}
            {allowUrl && (
              <TextField
                label="Enlace externo del archivo"
                helperText="Recomendado para archivos institucionales: Drive, OneDrive u otro repositorio autorizado."
                value={fileValue.external_url || ''}
                onChange={(event) => setFileAnswer(question.id, { external_url: event.target.value, storage_type: event.target.value ? 'external_url' : fileValue.storage_type })}
                type="url"
                fullWidth
              />
            )}
          </Stack>
        </Box>
      );
    }
    if (question.question_type === 'url_archivo') {
      return (
        <TextField
          label={question.question_text}
          helperText="Pega el enlace externo institucional del archivo."
          value={value}
          onChange={(event) => setAnswer(question.id, event.target.value)}
          type="url"
          fullWidth
        />
      );
    }
    if (question.question_type === 'ranking') {
      return (
        <Box>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>{question.question_text}</Typography>
          {options.map((option, index) => (
            <FormControl key={option} fullWidth size="small" sx={{ mb: 1 }}>
              <FormLabel>{option}</FormLabel>
              <Select
                value={value?.[option] || ''}
                onChange={(event) => setAnswer(question.id, { ...(typeof value === 'object' ? value : {}), [option]: event.target.value })}
                displayEmpty
              >
                <MenuItem value="">Orden</MenuItem>
                {options.map((_, orderIndex) => <MenuItem key={orderIndex} value={orderIndex + 1}>{orderIndex + 1}</MenuItem>)}
              </Select>
            </FormControl>
          ))}
        </Box>
      );
    }
    if (question.question_type === 'texto_informativo' || question.question_type === 'separador') {
      return <Alert severity="info">{question.question_text}</Alert>;
    }
    const inputType = ({ numero: 'number', correo: 'email', telefono: 'tel', fecha: 'date', hora: 'time', url_archivo: 'url' })[question.question_type] || 'text';
    return (
      <TextField
        label={question.question_text}
        value={value}
        onChange={(event) => setAnswer(question.id, event.target.value)}
        type={inputType}
        multiline={question.question_type === 'texto_largo'}
        minRows={question.question_type === 'texto_largo' ? 4 : 1}
        fullWidth
        InputLabelProps={['fecha', 'hora'].includes(question.question_type) ? { shrink: true } : undefined}
      />
    );
  };

  const submit = async () => {
    if (!validateSection(currentSection)) return;
    const buildQuizMessage = () => {
      if (!form?.evidence_context?.quiz_mode) return null;
      let total = 0;
      let score = 0;
      (form.questions || []).forEach((question) => {
        const correct = question.config?.correct_answers || [];
        if (!correct.length) return;
        const points = Number(question.config?.points ?? 1);
        total += points;
        const answer = answers[question.id];
        const isCorrect = Array.isArray(answer)
          ? correct.length === answer.length && correct.every((item) => answer.includes(item))
          : correct.includes(String(answer));
        if (isCorrect) score += points;
      });
      return total ? `Respuesta registrada. Puntaje: ${score} de ${total}.` : 'Respuesta registrada.';
    };
    if (previewMode) {
      setMessage(buildQuizMessage() || 'Vista previa validada. No se registro ninguna respuesta.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const preparedAnswers = { ...answers };
      (form?.questions || []).forEach((question) => {
        const value = preparedAnswers[question.id];
        const otherValue = preparedAnswers[`${question.id}_otro`];
        if (Array.isArray(value) && value.includes('Otro') && otherValue) {
          preparedAnswers[question.id] = value.map((item) => item === 'Otro' ? { option: 'Otro', other: otherValue } : item);
        }
        delete preparedAnswers[`${question.id}_otro`];
      });
      const response = await instrumentosApi.publicSubmit(code, { answers: preparedAnswers, respondent_data: respondentData });
      setMessage(buildQuizMessage() || response.message || 'Respuesta registrada');
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible enviar la respuesta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  if (error && !form) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: { xs: 2, md: 8 }, px: 2 }}>
        <Paper elevation={0} sx={{ maxWidth: 760, mx: 'auto', overflow: 'hidden', borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Box sx={{ p: { xs: 2, md: 3 }, color: 'white', bgcolor: '#1d4ed8' }}>
            <Typography variant="h4" sx={{ fontWeight: 950 }}>Instrumento institucional</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.9)' }}>Universidad CESMAG</Typography>
          </Box>
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
              {error}
            </Alert>
            <Typography sx={{ color: '#475569' }}>
              Verifica que el instrumento este publicado, dentro de sus fechas de apertura y con preguntas configuradas.
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: { xs: 2, md: 5 }, px: 2 }}>
      <Paper elevation={0} sx={{ maxWidth: 860, mx: 'auto', overflow: 'hidden', borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Box sx={{ p: { xs: 2, md: 3 }, color: 'white', bgcolor: themeColor }}>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>{form?.title || 'Instrumento institucional'}</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.9)' }}>{form?.description || form?.objective}</Typography>
        </Box>
        <Box sx={{ p: { xs: 2, md: 3 }, pb: visibleQuestions.length > 0 && !message ? 11 : { xs: 2, md: 3 } }}>
          {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
          {previewMode && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              Vista previa administrativa. Puedes navegar y validar el formulario como usuario, sin registrar respuestas reales.
            </Alert>
          )}
          {message ? (
            <Alert severity="success">{message}</Alert>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900 }}>Avance</Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, progress)}
                  sx={{
                    height: 8,
                    borderRadius: 999,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': { bgcolor: themeColor }
                  }}
                />
              </Box>
              {!form?.is_anonymous && (
                <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Typography sx={{ fontWeight: 900, mb: 1 }}>Datos del respondente</Typography>
                  <Stack spacing={1}>
                    <TextField label="Nombre completo" size="small" value={respondentData.nombre || ''} onChange={(e) => setRespondentData({ ...respondentData, nombre: e.target.value })} />
                    <TextField label="Correo electronico" size="small" value={respondentData.correo || ''} onChange={(e) => setRespondentData({ ...respondentData, correo: e.target.value })} />
                  </Stack>
                </Paper>
              )}
              {currentSection && (
                <Stack spacing={1.2}>
                  <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #dbeafe', borderRadius: 2, bgcolor: '#f8fbff' }}>
                    <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 950 }}>
                      Seccion {activeSectionIndex + 1} de {groupedSections.length}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 950 }}>{currentSection.title || 'Preguntas generales'}</Typography>
                    {currentSection.description && <Typography sx={{ color: '#64748b' }}>{currentSection.description}</Typography>}
                  </Paper>
                  {currentSection.questions.map((question) => (
                    <Paper key={question.id} elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                      {renderQuestion(question)}
                      {question.question_description && <Typography variant="body2" sx={{ mt: 0.8, color: '#64748b' }}>{question.question_description}</Typography>}
                      {question.is_required && <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800 }}>Obligatoria</Typography>}
                    </Paper>
                  ))}
                </Stack>
              )}
              {!visibleQuestions.length && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  Este instrumento no tiene preguntas disponibles para responder.
                </Alert>
              )}
            </Stack>
          )}
        </Box>
        {visibleQuestions.length > 0 && !message && (
          <Box sx={{ position: 'sticky', bottom: 0, bgcolor: footerColor, color: 'white', px: { xs: 2, md: 3 }, py: 1.5, borderTop: '1px solid rgba(255,255,255,.25)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
              <Typography sx={{ fontWeight: 900, textAlign: { xs: 'center', sm: 'left' } }}>
                Seccion {activeSectionIndex + 1} de {groupedSections.length}
              </Typography>
              <Box sx={{ flex: 1, maxWidth: { sm: 320 }, mx: { sm: 2 } }}>
                <LinearProgress variant="determinate" value={Math.min(100, progress)} sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(255,255,255,.35)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
              </Box>
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'center', sm: 'flex-end' }}>
                <Button disabled={activeSectionIndex === 0 || submitting} variant="outlined" onClick={goPreviousSection} sx={{ bgcolor: 'white', borderColor: 'white', color: footerColor, fontWeight: 900 }}>
                  Anterior
                </Button>
                {isLastSection ? (
                  <Button disabled={submitting} variant="contained" onClick={submit} sx={{ bgcolor: 'white', color: footerColor, fontWeight: 900, '&:hover': { bgcolor: '#f8fafc' } }}>
                    {previewMode ? 'Validar vista previa' : 'Enviar respuesta'}
                  </Button>
                ) : (
                  <Button disabled={submitting} variant="contained" onClick={goNextSection} sx={{ bgcolor: 'white', color: footerColor, fontWeight: 900, '&:hover': { bgcolor: '#f8fafc' } }}>
                    Siguiente
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default InstrumentoPublicView;
