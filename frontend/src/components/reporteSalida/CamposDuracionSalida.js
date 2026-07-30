import React from 'react';
import { Autocomplete, Box, TextField } from '@mui/material';

const getColumns = (shouldRequestReposicionHoras) =>
  shouldRequestReposicionHoras
    ? 'minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(165px, 0.9fr)'
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
    {shouldRequestReposicionHoras && (
      <TextField
        sx={inputSx}
        fullWidth
        size="small"
        required
        type="number"
        label="Tiempo a reponer (horas)"
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: 0, step: 1 }}
        value={form.salida.tiempoReponerHoras || ''}
        onChange={(e) => update('salida', 'tiempoReponerHoras', e.target.value.replace(/[^0-9]/g, ''))}
      />
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
    <Box sx={props.responsiveFieldGrid(getColumns(props.shouldRequestReposicionHoras))}>
      <Component {...props} />
    </Box>
  );
};

export default React.memo(CamposDuracionSalida);
