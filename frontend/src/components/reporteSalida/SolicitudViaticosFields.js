import React from 'react';
import {
  Alert,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography
} from '@mui/material';

export const AUTORIZACION_VIATICOS = 'Autorizo a la Universidad CESMAG para que descuente de mi salario, prestaciones sociales a la fecha consignadas en los fondos de cesantías y/o cualquier otra acreencia relacionada con honorarios o servicios, el valor recibido o al que mi cargo diera lugar la no oportuna legalización de este anticipo.';
export const AVISO_LEGALIZACION_VIATICOS = 'IMPORTANTE: El Acuerdo 001 de 2013 exige la legalización de este anticipo dentro de los tres días hábiles siguientes al regreso de la comisión.';

const BANK_OPTIONS = ['Bancolombia', 'Davivienda', 'Banco AV Villas', 'Otro'];

const ViaticosQuestion = ({ value, onChange }) => (
  <Box sx={{ mt: 0.8, mb: 1.2, px: 1.5, py: 0.8, borderRadius: 1.8, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
    <FormControl required sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
        <FormLabel sx={{ fontSize: 13, fontWeight: 900, color: '#1e3a8a', '&.Mui-focused': { color: '#1e3a8a' } }}>
          ¿El desplazamiento requiere viáticos?
        </FormLabel>
        <RadioGroup row value={value === true ? 'si' : value === false ? 'no' : ''} onChange={(event) => onChange(event.target.value === 'si')} sx={{ gap: 1.5, flexWrap: 'nowrap' }}>
          <FormControlLabel value="si" control={<Radio size="small" sx={{ p: 0.5 }} />} label="Sí" sx={{ m: 0 }} />
          <FormControlLabel value="no" control={<Radio size="small" sx={{ p: 0.5 }} />} label="No" sx={{ m: 0 }} />
        </RadioGroup>
      </Box>
    </FormControl>
  </Box>
);

const SectionLabel = ({ children }) => (
  <Typography sx={{ gridColumn: '1 / -1', mt: 0.3, mb: -0.3, fontSize: 11.5, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    {children}
  </Typography>
);

const SolicitudViaticosFields = ({
  viaticos,
  salida,
  onChange,
  onSalidaChange,
  onObjetoChange,
  inputSx,
  todayString,
  TimeFieldComponent,
  horaSalidaOptions,
  horaRegresoOptions,
  convert24To12,
  isPastTimeError,
  salidaRangeIssue
}) => {
  const compactSx = {
    ...inputSx,
    '& .MuiOutlinedInput-root': {
      ...(inputSx?.['& .MuiOutlinedInput-root'] || {}),
      minHeight: 42,
      borderRadius: 1.6,
      bgcolor: '#fff'
    },
    '& .MuiInputBase-input': { py: 1, fontSize: 13 },
    '& .MuiInputLabel-root': { fontSize: 13 }
  };
  const commissionTextareaSx = {
    width: '100%',
    height: 76,
    boxSizing: 'border-box',
    resize: 'vertical',
    display: 'block',
    px: 1.5,
    py: 1.2,
    border: '1px solid #cbd5e1',
    borderRadius: 1.8,
    outline: 'none',
    bgcolor: '#fff',
    color: '#1e293b',
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: 1.5,
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
    '&::placeholder': { color: '#94a3b8', opacity: 1 },
    '&:hover': { borderColor: '#94a3b8' },
    '&:focus': {
      borderColor: '#2563eb',
      borderWidth: '2px',
      px: '11px',
      py: '8px',
      boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.10)'
    }
  };
  const bankOption = viaticos.entidadBancariaOpcion || (BANK_OPTIONS.includes(viaticos.entidadBancaria) ? viaticos.entidadBancaria : (viaticos.entidadBancaria ? 'Otro' : ''));

  return (
    <Box sx={{ mb: 1.3, border: '1px solid #cbd5e1', borderRadius: 2, bgcolor: '#f8fafc', overflow: 'hidden' }}>
      <Box sx={{ px: 1.6, py: 1, bgcolor: '#eef4fb', borderBottom: '1px solid #dbe3ee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#0b3a6f' }}>
          Solicitud de desplazamiento fuera de la ciudad
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 11.5, color: '#64748b' }}>ADF-PP-FR-004</Typography>
      </Box>

      <Box sx={{ p: { xs: 1.2, md: 1.5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1.1 }}>
        <SectionLabel>Datos de la comisión</SectionLabel>
        <TextField sx={{ ...compactSx, gridColumn: { sm: 'span 2' } }} size="small" required label="Lugar a visitar" value={viaticos.lugarVisitar || ''} onChange={(e) => onChange('lugarVisitar', e.target.value)} />
        <TextField sx={compactSx} size="small" required type="date" label="Fecha del evento" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={viaticos.fechaEvento || ''} onChange={(e) => onChange('fechaEvento', e.target.value)} />
        <TextField
          sx={compactSx}
          size="small"
          required
          type="number"
          label="Número de días"
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: 1, step: 1, inputMode: 'numeric' }}
          value={viaticos.numeroDiasSolicitados || ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '');
            onChange('numeroDiasSolicitados', digits === '' ? '' : String(Math.max(1, Number(digits))));
          }}
          onBlur={() => {
            if (!Number.isInteger(Number(viaticos.numeroDiasSolicitados)) || Number(viaticos.numeroDiasSolicitados) < 1) {
              onChange('numeroDiasSolicitados', '1');
            }
          }}
        />

        <TextField sx={compactSx} size="small" required type="date" label="Día de salida" InputLabelProps={{ shrink: true }} inputProps={{ min: todayString }} value={salida.fecha || ''} onChange={(e) => onSalidaChange('fecha', e.target.value)} />
        <TimeFieldComponent
          options={horaSalidaOptions}
          value={salida.horaInicio || ''}
          onChange={(value) => onSalidaChange('horaInicio', value)}
          convert24To12={convert24To12}
          inputSx={compactSx}
          required
          label="Hora de salida"
          placeholder="hh:mm am/pm"
          error={isPastTimeError(salida.fecha, salida.horaInicio)}
        />
        <TextField sx={compactSx} size="small" required type="date" label="Día de regreso" InputLabelProps={{ shrink: true }} inputProps={{ min: salida.fecha || todayString }} value={salida.fechaRegreso || ''} onChange={(e) => onSalidaChange('fechaRegreso', e.target.value)} />
        <TimeFieldComponent
          options={horaRegresoOptions}
          value={salida.horaFin || ''}
          onChange={(value) => onSalidaChange('horaFin', value)}
          convert24To12={convert24To12}
          inputSx={compactSx}
          required
          label="Hora de regreso"
          placeholder="hh:mm am/pm"
          error={isPastTimeError(salida.fechaRegreso, salida.horaFin) || Boolean(salidaRangeIssue && salida.horaInicio && salida.horaFin)}
          helperText={salidaRangeIssue && salida.horaInicio && salida.horaFin ? salidaRangeIssue : ''}
        />

        <Box
          sx={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 1.1,
            alignItems: 'stretch'
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, minWidth: 0 }}>
            <Typography component="label" htmlFor="viaticos-objeto-comision" sx={{ pl: 0.25, fontSize: 11.5, lineHeight: 1.2, fontWeight: 800, color: '#475569' }}>
              Objeto de la comisión <Box component="span" sx={{ color: '#dc2626' }}>*</Box>
            </Typography>
            <Box
              component="textarea"
              id="viaticos-objeto-comision"
              sx={commissionTextareaSx}
              required
              placeholder="Describa claramente el propósito de la comisión"
              value={viaticos.objetoComision || ''}
              onChange={(e) => onObjetoChange(e.target.value)}
              aria-label="Objeto de la comisión"
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, minWidth: 0 }}>
            <Typography component="label" htmlFor="viaticos-observaciones-especiales" sx={{ pl: 0.25, fontSize: 11.5, lineHeight: 1.2, fontWeight: 800, color: '#475569' }}>
              Observaciones especiales
            </Typography>
            <Box
              component="textarea"
              id="viaticos-observaciones-especiales"
              sx={commissionTextareaSx}
              placeholder="Agregue indicaciones o condiciones especiales (opcional)"
              value={viaticos.observacionesEspeciales || ''}
              onChange={(e) => onChange('observacionesEspeciales', e.target.value)}
              aria-label="Observaciones especiales"
            />
          </Box>
        </Box>

        <SectionLabel>Logística y consignación</SectionLabel>
        <Box
          sx={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.1
          }}
        >
          <TextField sx={compactSx} size="small" required label="Centro de costos" value={viaticos.centroCosto || ''} onChange={(e) => onChange('centroCosto', e.target.value)} />
          <TextField sx={compactSx} size="small" required select label="Alojamiento" value={viaticos.alojamiento || ''} onChange={(e) => onChange('alojamiento', e.target.value)}>
            <MenuItem value="Hotel">Hotel</MenuItem>
            <MenuItem value="Casa de familia">Casa de familia</MenuItem>
            <MenuItem value="No requiere">No requiere</MenuItem>
          </TextField>
          <TextField sx={compactSx} size="small" required select label="Transporte" value={viaticos.transporte || ''} onChange={(e) => onChange('transporte', e.target.value)}>
            <MenuItem value="Terrestre">Terrestre</MenuItem>
            <MenuItem value="Aéreo">Aéreo</MenuItem>
            <MenuItem value="Mixto">Mixto</MenuItem>
          </TextField>
          <TextField sx={compactSx} size="small" required select label="Tipo de cuenta" value={viaticos.tipoCuenta || ''} onChange={(e) => onChange('tipoCuenta', e.target.value)}>
            <MenuItem value="Ahorros">Ahorros</MenuItem>
            <MenuItem value="Corriente">Corriente</MenuItem>
          </TextField>
          <TextField
            sx={compactSx}
            size="small"
            required
            select
            label="Entidad bancaria"
            value={bankOption}
            onChange={(e) => {
              const option = e.target.value;
              onChange('entidadBancariaOpcion', option);
              onChange('entidadBancaria', option === 'Otro' ? '' : option);
            }}
          >
            {BANK_OPTIONS.map((bank) => <MenuItem key={bank} value={bank}>{bank}</MenuItem>)}
          </TextField>
          {bankOption === 'Otro' && (
            <TextField sx={compactSx} size="small" required label="¿Cuál entidad bancaria?" value={viaticos.entidadBancaria || ''} onChange={(e) => onChange('entidadBancaria', e.target.value)} />
          )}
          <TextField sx={compactSx} size="small" required label="Número de cuenta" value={viaticos.numeroCuenta || ''} onChange={(e) => onChange('numeroCuenta', e.target.value.replace(/[^0-9-]/g, ''))} />
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.2, md: 1.5 }, pb: 1.4 }}>
        <Alert severity="warning" sx={{ py: 0.2, borderRadius: 1.5, fontSize: 12.2, fontWeight: 700, '& .MuiAlert-icon': { py: 0.5 }, '& .MuiAlert-message': { py: 0.55 } }}>
          {AVISO_LEGALIZACION_VIATICOS}
        </Alert>
        <Box sx={{ mt: 0.8, px: 1, py: 0.45, bgcolor: '#fff', border: '1px solid #dbe3ee', borderRadius: 1.5 }}>
          <FormControlLabel
            sx={{ m: 0, alignItems: 'flex-start' }}
            control={<Checkbox size="small" sx={{ mt: 0.15 }} checked={Boolean(viaticos.autorizacionAceptada)} onChange={(e) => onChange('autorizacionAceptada', e.target.checked)} />}
            label={<Typography sx={{ pt: 0.55, fontSize: 11.6, lineHeight: 1.4, color: '#334155' }}>{AUTORIZACION_VIATICOS}</Typography>}
          />
        </Box>
      </Box>
    </Box>
  );
};

export { ViaticosQuestion };
export default React.memo(SolicitudViaticosFields);
