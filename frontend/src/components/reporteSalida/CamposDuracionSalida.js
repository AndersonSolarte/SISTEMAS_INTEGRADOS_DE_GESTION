import React from 'react';
import { Autocomplete, Box, TextField } from '@mui/material';

const getColumns = (shouldRequestReposicionHoras) =>
  shouldRequestReposicionHoras
    ? 'minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(165px, 0.9fr)'
    : 'minmax(160px, 1fr) minmax(140px, 0.8fr) minmax(160px, 1fr) minmax(140px, 0.8fr)';

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
    <Autocomplete
      disableClearable
      options={horaSalidaOptions}
      getOptionLabel={convert24To12}
      value={form.salida.horaInicio || ''}
      onChange={(e, newValue) => update('salida', 'horaInicio', newValue)}
      renderInput={(params) => (
        <TextField
          {...params}
          sx={inputSx}
          required
          label={subtype === 'urgencia_medica' ? 'Hora de salida a urgencias' : 'Hora salida'}
          placeholder="Seleccione hora"
          InputLabelProps={{ shrink: true }}
          error={isPastTimeError(form.salida.fecha, form.salida.horaInicio)}
        />
      )}
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
    <Autocomplete
      options={horaRegresoOptions}
      getOptionLabel={convert24To12}
      value={form.salida.horaFin || null}
      onChange={(e, newValue) => update('salida', 'horaFin', newValue || '')}
      renderInput={(params) => (
        <TextField
          {...params}
          sx={inputSx}
          required={!(category === 'salud' && subtype !== 'terapias')}
          label={category === 'salud' && subtype !== 'terapias' ? 'Hora regreso (Opcional)' : 'Hora regreso'}
          placeholder={(category === 'salud' && subtype !== 'terapias') ? 'Opcional' : 'Seleccione hora'}
          InputLabelProps={{ shrink: true }}
          error={isPastTimeError(form.salida.fechaRegreso, form.salida.horaFin) || Boolean(salidaRangeIssue && form.salida.horaInicio && form.salida.horaFin)}
          helperText={salidaRangeIssue && form.salida.horaInicio && form.salida.horaFin ? salidaRangeIssue : ''}
        />
      )}
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
