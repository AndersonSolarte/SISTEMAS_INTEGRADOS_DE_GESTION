import React, { useMemo } from 'react';
import { Box, InputAdornment, MenuItem, Radio, TextField, Typography } from '@mui/material';

const DuracionSelector = ({ salida, fieldSx, locked = false, onChange }) => {
  const requiresViaticos = salida?.requiereViaticos === 'Sí';
  const isEcuador = salida?.alcance === 'Internacional' && String(salida?.pais || '').trim().toLowerCase() === 'ecuador';
  const requiresMinTwoDays = requiresViaticos && (salida?.alcance === 'Nacional' || (salida?.alcance === 'Internacional' && !isEcuador));

  const options = useMemo(() => {
    const isElectoral = ['jurado_votacion', 'sufragante'].includes(salida.tipo);
    const isOnlyHalfDay = isElectoral || ['entierro_companero', 'obligaciones_escolares'].includes(salida.tipo);

    return [
      {
        value: 'menos_media_jornada',
        label: salida.tipo === 'jurado_votacion'
          ? 'Equivale a un dia'
          : (salida.tipo === 'sufragante' ? 'Equivale a media jornada' : 'Hasta media jornada')
      },
      { value: '1_2_dias', label: 'Entre 1 y 2 dias' },
      { value: '3_mas_dias', label: '3 o mas dias' }
    ].filter((opt) => {
      if (isOnlyHalfDay) return opt.value === 'menos_media_jornada';
      if (requiresMinTwoDays) return opt.value !== 'menos_media_jornada';
      return true;
    });
  }, [salida.tipo, salida.alcance, requiresMinTwoDays]);

  const selectDuration = (value) => {
    if (locked) return;
    onChange('duracionTipo', value);
    const defaultDays = value === 'menos_media_jornada' ? 0 : (value === '1_2_dias' ? (requiresMinTwoDays ? 2 : 1) : 3);
    onChange('duracionDias', defaultDays);
  };

  return (
    <Box sx={{ mb: 1.8, width: '100%' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#334155', mb: 1 }}>
        Duracion estimada de la salida:
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.2, width: '100%', alignItems: 'stretch' }}>
        {options.map((opt) => {
          const selected = salida.duracionTipo === opt.value;
          return (
            <Box
              key={opt.value}
              onClick={() => selectDuration(opt.value)}
              sx={{
                flex: 1,
                p: 1.2,
                borderRadius: 2.2,
                border: '2px solid',
                borderColor: selected ? '#2563eb' : '#cbd5e1',
                bgcolor: selected ? '#eff6ff' : '#ffffff',
                cursor: locked ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.2s',
                opacity: locked && !selected ? 0.72 : 1,
                '&:hover': locked ? {} : { borderColor: '#2563eb', bgcolor: selected ? '#eff6ff' : '#f8fafc' }
              }}
            >
              <Radio checked={selected} size="small" sx={{ p: 0 }} color="primary" />
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: selected ? '#1d4ed8' : '#475569' }}>
                {opt.label}
              </Typography>
            </Box>
          );
        })}

        {salida.duracionTipo === '1_2_dias' && (
          <TextField
            select
            size="small"
            sx={fieldSx}
            label="Digite la cantidad de dias a solicitar *"
            value={salida.duracionDias || (requiresMinTwoDays ? 2 : 1)}
            onChange={(e) => onChange('duracionDias', parseInt(e.target.value, 10))}
            disabled={locked}
          >
            {!requiresMinTwoDays && <MenuItem value={1}>1 dia</MenuItem>}
            <MenuItem value={2}>2 dias</MenuItem>
          </TextField>
        )}

        {salida.duracionTipo === '3_mas_dias' && (
          <TextField
            size="small"
            sx={fieldSx}
            type="number"
            label="Digite la cantidad de dias a solicitar *"
            value={salida.duracionDias || ''}
            disabled={locked}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              onChange('duracionDias', Number.isNaN(value) ? '' : value);
            }}
            inputProps={{ min: 3, step: 1 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">dias</InputAdornment>
            }}
          />
        )}
      </Box>
    </Box>
  );
};

export default React.memo(DuracionSelector);
