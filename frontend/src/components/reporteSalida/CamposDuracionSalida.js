import React from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';

const getColumns = (shouldRequestReposicionHoras) =>
  shouldRequestReposicionHoras
    ? 'minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(260px, 1.2fr)'
    : 'minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(160px, 1fr) minmax(140px, 0.8fr)';

const normalizeTimeString = (rawInput, isBlur = true) => {
  if (!rawInput) return '';
  const str = String(rawInput).trim();
  if (!str) return '';

  const periodMatch = str.match(/(am|pm|a|p)$/i);
  const userPeriod = periodMatch ? periodMatch[1].toLowerCase() : null;

  // Si son 3 o 4 dígitos sin puntos ni dos puntos (ej: "730", "815", "1215", "1430")
  const digitsOnlyMatch = str.match(/^(\d{3,4})\s*(am|pm|a\.m\.|p\.m\.|a|p)?$/i);
  if (digitsOnlyMatch) {
    const digits = digitsOnlyMatch[1];
    const period = (digitsOnlyMatch[2] || userPeriod || '').toLowerCase().replace(/\./g, '');
    const h = parseInt(digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2), 10);
    const m = parseInt(digits.slice(-2), 10);
    let finalH = h;
    if (period.startsWith('p') && finalH < 12) finalH += 12;
    else if (period.startsWith('a') && finalH === 12) finalH = 0;
    if (finalH >= 24) finalH = 0;
    return `${finalH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // Si ya tiene formato HH:mm de 24h
  if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(str)) {
    const [h, m] = str.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }

  const cleaned = str.replace('.', ':');
  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.|a|p)?$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    let m = parseInt(ampmMatch[2], 10);
    let period = (ampmMatch[3] || userPeriod || '').toLowerCase().replace(/\./g, '');

    if (h < 0 || h > 24 || m < 0 || m > 59) return str;

    if (period.startsWith('p') && h < 12) {
      h += 12;
    } else if (period.startsWith('a') && h === 12) {
      h = 0;
    }

    if (h >= 24) h = 0;

    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
  }

  // Si en blur escribió únicamente la hora (ej: "7" -> "07:00", "12" -> "12:00")
  if (isBlur && /^\d{1,2}$/.test(str)) {
    let h = parseInt(str, 10);
    if (h < 0 || h > 23) h = 0;
    return `${h.toString().padStart(2, '0')}:00`;
  }

  return str;
};

export const TimeAutocomplete = ({
  options,
  value,
  onChange,
  label,
  placeholder = 'hh:mm am/pm',
  required,
  error,
  helperText,
  inputSx,
  convert24To12
}) => {
  const formattedVal = React.useMemo(() => convert24To12(value) || '', [value, convert24To12]);
  const [inputValue, setInputValue] = React.useState(formattedVal);

  React.useEffect(() => {
    setInputValue(formattedVal);
  }, [formattedVal]);

  const handleInputChange = (e, newInputValue, reason) => {
    if (reason === 'clear') {
      onChange('');
      setInputValue('');
      return;
    }

    if (reason === 'reset') {
      return;
    }

    // Mantener la digitación 100% limpia sin disparar conversiones intermedias mientras se escribe
    setInputValue(newInputValue);
  };

  const handleBlur = () => {
    const raw = inputValue || value || '';
    const normalized = normalizeTimeString(raw, true);
    if (normalized) {
      onChange(normalized);
      setInputValue(convert24To12(normalized));
    } else {
      onChange('');
      setInputValue('');
    }
  };

  return (
    <Autocomplete
      freeSolo
      options={options}
      getOptionLabel={(opt) => {
        if (!opt) return '';
        return convert24To12(opt);
      }}
      value={value || ''}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={(e, newValue) => {
        const val = typeof newValue === 'string' ? newValue : (newValue?.value || '');
        const normalized = normalizeTimeString(val, true);
        onChange(normalized);
        setInputValue(convert24To12(normalized));
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          sx={inputSx}
          required={required}
          label={label}
          placeholder={placeholder}
          InputLabelProps={{ shrink: true }}
          error={error}
          helperText={helperText || ''}
          onBlur={handleBlur}
        />
      )}
    />
  );
};

const formatMinutes = (value) => {
  const total = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`;
};

const formatEquivalentTime = (totalValue, dailyValue) => {
  const total = Math.max(0, Math.round(Number(totalValue) || 0));
  const daily = Math.max(0, Math.round(Number(dailyValue) || 0));
  if (!total || !daily) return 'Complete los valores';
  const fullDays = Math.floor(total / daily);
  const remaining = total % daily;
  const parts = [];
  if (fullDays) parts.push(`${fullDays} ${fullDays === 1 ? 'día' : 'días'}`);
  if (remaining) parts.push(formatMinutes(remaining));
  return parts.length ? parts.join(' y ') : formatMinutes(total);
};

const ReposicionTimeFields = ({ form, inputSx, isDaily = false, update }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, width: '100%' }}>
    <TextField
      sx={inputSx}
      fullWidth
      size="small"
      required
      type="number"
      label={isDaily ? 'Horas diarias' : 'Horas a reponer'}
      InputLabelProps={{ shrink: true }}
      inputProps={{ min: 0, step: 1 }}
      value={form.salida.tiempoReponerHoras ?? ''}
      onChange={(e) => update('salida', 'tiempoReponerHoras', e.target.value.replace(/[^0-9]/g, ''))}
    />
    <TextField
      sx={inputSx}
      fullWidth
      size="small"
      required
      type="number"
      label={isDaily ? 'Minutos adicionales' : 'Minutos'}
      InputLabelProps={{ shrink: true }}
      inputProps={{ min: 0, max: 59, step: 1 }}
      value={form.salida.tiempoReponerMinutos ?? ''}
      onChange={(e) => {
        const clean = e.target.value.replace(/[^0-9]/g, '');
        update('salida', 'tiempoReponerMinutos', clean === '' ? '' : String(Math.min(59, Number(clean))));
      }}
    />
  </Box>
);

const FechaHoraFields = ({
  category,
  convert24To12,
  form,
  horaRegresoOptions,
  horaSalidaOptions,
  inputSx,
  isPastTimeError,
  salidaRangeIssue,
  shouldRequestReposicionHoras,
  reposicionTimeIsDaily,
  subtype,
  todayString,
  update
}) => (
  <>
    <TextField
      sx={inputSx}
      fullWidth
      size="small"
      required
      type="date"
      label={subtype === 'urgencia_medica' ? 'Fecha de salida a urgencias' : 'Fecha salida'}
      InputLabelProps={{ shrink: true }}
      inputProps={{ min: todayString }}
      value={form.salida.fecha}
      onChange={(e) => update('salida', 'fecha', e.target.value)}
    />
    <TimeAutocomplete
      options={horaSalidaOptions}
      value={form.salida.horaInicio}
      onChange={(val) => update('salida', 'horaInicio', val)}
      convert24To12={convert24To12}
      inputSx={inputSx}
      required
      label={subtype === 'urgencia_medica' ? 'Hora de salida a urgencias' : 'Hora salida'}
      placeholder="hh:mm am/pm"
      error={isPastTimeError(form.salida.fecha, form.salida.horaInicio)}
    />
    <TextField
      sx={inputSx}
      fullWidth
      size="small"
      required
      type="date"
      label="Fecha regreso"
      InputLabelProps={{ shrink: true }}
      inputProps={{ min: todayString }}
      value={form.salida.fechaRegreso}
      onChange={(e) => update('salida', 'fechaRegreso', e.target.value)}
    />
    <TimeAutocomplete
      options={horaRegresoOptions}
      value={form.salida.horaFin}
      onChange={(val) => update('salida', 'horaFin', val)}
      convert24To12={convert24To12}
      inputSx={inputSx}
      required={!(category === 'salud' && subtype !== 'terapias')}
      label={category === 'salud' && subtype !== 'terapias' ? 'Hora regreso (Opcional)' : 'Hora regreso'}
      placeholder={(category === 'salud' && subtype !== 'terapias') ? 'Opcional (hh:mm am/pm)' : 'hh:mm am/pm'}
      error={isPastTimeError(form.salida.fechaRegreso, form.salida.horaFin) || Boolean(salidaRangeIssue && form.salida.horaInicio && form.salida.horaFin)}
      helperText={salidaRangeIssue && form.salida.horaInicio && form.salida.horaFin ? salidaRangeIssue : ''}
    />
    {shouldRequestReposicionHoras && !reposicionTimeIsDaily && (
      <ReposicionTimeFields form={form} inputSx={inputSx} update={update} />
    )}
  </>
);

const CamposHastaMediaJornada = (props) => <FechaHoraFields {...props} />;
const CamposUnoDosDias = (props) => <FechaHoraFields {...props} />;
const CamposTresMasDias = (props) => <FechaHoraFields {...props} />;

const CamposDuracionSalida = (props) => {
  if (props.subtype === 'terapias') return null;

  const Component = props.form.salida.duracionTipo === '1_2_dias'
    ? CamposUnoDosDias
    : props.form.salida.duracionTipo === '3_mas_dias'
      ? CamposTresMasDias
      : CamposHastaMediaJornada;

  return (
    <>
      {!props.panelOnly && (
        <Box sx={props.responsiveFieldGrid(getColumns(props.shouldRequestReposicionHoras && !props.reposicionTimeIsDaily))}>
          <Component {...props} />
        </Box>
      )}
      {props.panelOnly && props.shouldRequestReposicionHoras && props.reposicionTimeIsDaily && (
        <Box
          sx={{
            mt: 1.5,
            border: '1px solid #bfdbfe',
            borderRadius: 2,
            bgcolor: '#ffffff',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(240px, 1fr) minmax(220px, 0.7fr)' }, gap: 1.5, alignItems: 'center', bgcolor: '#f1f6ff', borderBottom: '1px solid #dbeafe' }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#173f78' }}>
                Cálculo de reposición · {props.reposicionProfileLabel}
              </Typography>
              <Typography sx={{ mt: 0.25, fontSize: 12, color: '#64748b' }}>
                La duración se selecciona automáticamente según el tiempo solicitado.
              </Typography>
            </Box>
            {props.reposicionRequiresDailyInput ? (
              <TextField
                sx={props.inputSx}
                fullWidth
                size="small"
                required
                type="number"
                label="Horas que trabaja al día"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: 1, step: 1 }}
                value={props.form.salida.jornadaDiariaHoras ?? ''}
                onChange={(e) => props.update('salida', 'jornadaDiariaHoras', e.target.value.replace(/[^0-9]/g, ''))}
              />
            ) : (
              <Box sx={{ px: 1.5, py: 0.9, border: '1px solid #bfdbfe', borderRadius: 1.5, bgcolor: '#ffffff' }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {props.reposicionProfileKey === 'docente_medio_tiempo'
                    ? '20 horas semanales'
                    : props.reposicionProfileKey === 'docente_tiempo_completo'
                      ? '40 horas semanales'
                    : 'Jornada diaria según contrato'}
                </Typography>
                <Typography sx={{ mt: 0.2, fontSize: 14, fontWeight: 800, color: '#173f78' }}>
                  {props.reposicionProfileKey === 'docente_medio_tiempo'
                    ? '1 día equivale a 4 horas'
                    : props.reposicionProfileKey === 'docente_tiempo_completo'
                      ? '1 día equivale a 8 horas'
                    : formatMinutes(props.reposicionDailyMinutes)}
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ p: { xs: 1.5, sm: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'minmax(180px, 0.8fr) minmax(180px, 0.8fr) minmax(230px, 1fr)' }, gap: 1.5, alignItems: 'center' }}>
            <TextField
              sx={props.inputSx}
              fullWidth
              size="small"
              required
              type="number"
              label="Horas solicitadas"
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: 0, step: 1 }}
              value={props.form.salida.tiempoReponerHoras ?? ''}
              onChange={(e) => props.update('salida', 'tiempoReponerHoras', e.target.value.replace(/[^0-9]/g, ''))}
            />
            <TextField
              sx={props.inputSx}
              fullWidth
              size="small"
              required
              type="number"
              label="Minutos solicitados"
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: 0, max: 59, step: 1 }}
              value={props.form.salida.tiempoReponerMinutos ?? ''}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '');
                props.update('salida', 'tiempoReponerMinutos', clean === '' ? '' : String(Math.min(59, Number(clean))));
              }}
            />
            <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: '#eaf2ff', color: '#173f78', gridColumn: { xs: '1', sm: '1 / -1', md: 'auto' } }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                Equivalencia del permiso
              </Typography>
              <Typography sx={{ mt: 0.25, fontSize: 15, fontWeight: 800 }}>
                {formatEquivalentTime(props.reposicionTotalMinutes, props.reposicionDailyMinutes)}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
};

export default React.memo(CamposDuracionSalida);
