import React, { useState } from 'react';
import { Box, Button, IconButton, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Add from '@mui/icons-material/Add';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';

export const resolveIndicatorValues = (values = {}) => {
  const legacyField = values.tipoIndicador === 'Logro'
    ? 'indicadorLogro'
    : values.tipoIndicador === 'Impacto'
    ? 'indicadorImpacto'
    : 'indicadorResultado';

  const indicators = Object.fromEntries(
    ['indicadorResultado', 'indicadorLogro', 'indicadorImpacto'].map((field) => [
      field,
      values[field] ?? (field === legacyField ? (values.indicador || values.indicator || '') : '')
    ])
  );

  const legacyTarget = legacyField.replace('indicador', 'meta');
  const targets = Object.fromEntries(
    ['metaResultado', 'metaLogro', 'metaImpacto'].map((field) => [
      field,
      String(values[field] ?? (field === legacyTarget ? (values.meta || values.target || '') : ''))
    ])
  );

  const activeFlags = Object.fromEntries(
    ['Resultado', 'Logro', 'Impacto'].map((kind) => {
      const indField = `indicador${kind}`;
      const metaField = `meta${kind}`;
      const activeKey = `indicador${kind}Activo`;
      const isExplicit = values[activeKey];
      const hasContent = Boolean(String(indicators[indField] || targets[metaField] || '').trim());
      return [activeKey, isExplicit !== undefined ? Boolean(isExplicit) : hasContent];
    })
  );

  return { ...indicators, ...targets, ...activeFlags };
};

export default function ActionPlanIndicatorFields({ field, values = {}, onChange, disabled = false }) {
  const currentValues = resolveIndicatorValues(values);
  const [anchor, setAnchor] = useState(null);

  const kinds = [
    { key: 'resultado', label: 'Indicador de resultado', short: 'Resultado', field: 'indicadorResultado', target: 'metaResultado', active: 'indicadorResultadoActivo', color: '#285bc0' },
    { key: 'logro', label: 'Indicador de logro', short: 'Logro', field: 'indicadorLogro', target: 'metaLogro', active: 'indicadorLogroActivo', color: '#147a73' },
    { key: 'impacto', label: 'Indicador de impacto', short: 'Impacto', field: 'indicadorImpacto', target: 'metaImpacto', active: 'indicadorImpactoActivo', color: '#7650a6' }
  ];

  const handleUpdate = (updates) => {
    if (typeof onChange === 'function') {
      onChange(updates);
    }
  };

  const handleActivate = (kindObj) => {
    setAnchor(null);
    handleUpdate({
      [kindObj.active]: true,
      ...(field?.key ? { [field.key]: 'configurado' } : {})
    });
  };

  const handleDeactivate = (kindObj) => {
    handleUpdate({
      [kindObj.active]: false,
      [kindObj.field]: '',
      [kindObj.target]: ''
    });
  };

  const inputStyle = {
    '& .MuiOutlinedInput-root': { alignItems: 'flex-start', bgcolor: '#fff', borderRadius: 1.5, fontSize: 13, lineHeight: 1.6 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dce4ef' },
    '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600 }
  };

  const activeCount = kinds.filter((k) => currentValues[k.active]).length;

  return (
    <Box
      component="section"
      aria-label="Indicadores y metas"
      sx={{
        gridColumn: '1 / -1',
        minWidth: 0,
        border: '1px solid #dce4ef',
        borderRadius: 3,
        overflow: 'hidden',
        my: 0.5,
        bgcolor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ px: 2, py: 1.25, bgcolor: '#f5f8fc', borderBottom: activeCount > 0 ? '1px solid #e2e8f0' : 'none' }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <AssessmentOutlined sx={{ fontSize: 21, color: '#2457b8' }} />
          <Typography component="h3" sx={{ fontSize: 14, fontWeight: 800, color: '#233653' }}>
            {field?.label || 'Indicadores y metas'}
          </Typography>
        </Stack>
        <Button
          size="small"
          startIcon={<Add />}
          disabled={disabled || activeCount >= 3}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          Agregar indicador
        </Button>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          {kinds.map((k) => (
            <MenuItem
              key={k.key}
              disabled={Boolean(currentValues[k.active])}
              onClick={() => handleActivate(k)}
              sx={{ fontSize: 13, fontWeight: 600 }}
            >
              {k.label}
            </MenuItem>
          ))}
        </Menu>
      </Stack>

      {kinds.map((k) => {
        if (!currentValues[k.active]) return null;
        const isIndEmpty = !String(currentValues[k.field] || '').trim();
        const isTargetEmpty = !String(currentValues[k.target] || '').trim();

        return (
          <Box
            key={k.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr) 36px',
                sm: '85px minmax(0, 2fr) minmax(140px, 1fr) 36px'
              },
              gap: 1.5,
              alignItems: 'start',
              p: 2,
              bgcolor: '#fff',
              borderTop: '1px solid #f1f5f9',
              '&:first-of-type': { borderTop: 'none' }
            }}
          >
            <Stack sx={{ pt: { sm: 1 }, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 850, color: k.color }}>
                {k.short}
              </Typography>
            </Stack>
            <TextField
              label={`Indicador de ${k.key}`}
              placeholder={`Redactar indicador de ${k.key}...`}
              fullWidth
              size="small"
              multiline
              minRows={2}
              required
              error={isIndEmpty}
              helperText={isIndEmpty ? 'Redacte el indicador o elimínelo con el ícono de basura.' : ''}
              InputLabelProps={{ shrink: true }}
              disabled={disabled}
              value={currentValues[k.field] || ''}
              onChange={(e) => handleUpdate({ [k.field]: e.target.value })}
              sx={{ ...inputStyle, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
            />
            <TextField
              label={`Meta de ${k.key}`}
              placeholder={`Redactar meta de ${k.key}...`}
              fullWidth
              size="small"
              multiline
              minRows={2}
              required
              error={isTargetEmpty}
              helperText={isTargetEmpty ? 'Redacte la meta o elimínelo con el ícono de basura.' : ''}
              InputLabelProps={{ shrink: true }}
              disabled={disabled}
              value={currentValues[k.target] || ''}
              onChange={(e) => handleUpdate({ [k.target]: e.target.value })}
              sx={{ ...inputStyle, gridColumn: { xs: '1', sm: 'auto' } }}
            />
            <Tooltip title={`Quitar indicador de ${k.key}`}>
              <span>
                <IconButton
                  size="small"
                  disabled={disabled}
                  aria-label={`Quitar indicador de ${k.key}`}
                  onClick={() => handleDeactivate(k)}
                  sx={{
                    color: '#94a3b8',
                    mt: 0.5,
                    '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' },
                    gridColumn: { xs: 2, sm: 'auto' }
                  }}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      })}

      {activeCount === 0 && (
        <Box sx={{ p: 2.5, textAlign: 'center', color: '#94a3b8', bgcolor: '#fafbfd' }}>
          <Typography variant="body2" sx={{ fontSize: 13, fontStyle: 'italic' }}>
            No hay indicadores agregados aún. Pulse "+ Agregar indicador" para añadir Indicador de resultado, logro o impacto.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
