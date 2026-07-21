import React from 'react';
import { Box, Typography } from '@mui/material';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';

const CATEGORY_OPTIONS = [
  {
    value: 'propias_cargo',
    label: 'Actividades propias del cargo (Misionales)',
    Icon: BusinessCenterIcon
  },
  {
    value: 'salud',
    label: 'Salud y Bienestar',
    Icon: LocalHospitalIcon
  },
  {
    value: 'personales',
    label: 'Tramites, Permisos y Licencias',
    Icon: DirectionsWalkIcon,
    hideWhenMultiple: true
  }
];

const getTabSx = (selected) => ({
  py: 0.5,
  px: 1.5,
  width: '100%',
  borderRadius: 3,
  border: '2px solid',
  borderColor: selected ? '#2563eb' : '#e2e8f0',
  bgcolor: selected ? '#eff6ff' : '#ffffff',
  boxShadow: selected ? '0 0 12px rgba(37, 99, 235, 0.5)' : '0 2px 5px rgba(0,0,0,0.02)',
  cursor: 'pointer',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  gap: 1.5,
  '&:hover': {
    borderColor: '#2563eb',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)'
  }
});

const CategoriaTabs = ({ category, isSalidaMultiple, onChange }) => {
  const visibleOptions = CATEGORY_OPTIONS.filter((opt) => !opt.hideWhenMultiple || !isSalidaMultiple);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: isSalidaMultiple ? '1fr 1fr' : '1fr 1fr 1fr' }, gap: 1.5, mb: 1.8 }}>
      {visibleOptions.map(({ value, label, Icon }) => {
        const selected = category === value;
        return (
          <Box key={value} onClick={() => onChange(value)} sx={getTabSx(selected)}>
            <Icon sx={{ fontSize: 24, color: selected ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }} />
            <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: selected ? '#1e3a8a' : '#475569', textAlign: 'left', lineHeight: 1.2 }}>
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default React.memo(CategoriaTabs);
