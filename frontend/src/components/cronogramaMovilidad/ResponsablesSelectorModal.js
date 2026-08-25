import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Chip,
  Box,
  Typography,
  CircularProgress,
  IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import cronogramaMovilidadService from '../../services/cronogramaMovilidadService';

const normalizeString = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ResponsablesSelectorModal = ({ open, onClose, selectedResponsables = [], onSelect }) => {
  const [query, setQuery] = useState('');
  const [dependenciaFilter, setDependenciaFilter] = useState('TODOS');
  const [dependenciasList, setDependenciasList] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tempSelected, setTempSelected] = useState(selectedResponsables);

  useEffect(() => {
    setTempSelected(selectedResponsables || []);
  }, [selectedResponsables, open]);

  useEffect(() => {
    let active = true;
    const fetchResponsables = async () => {
      setLoading(true);
      try {
        const res = await cronogramaMovilidadService.buscarResponsables(query, dependenciaFilter);
        if (active) {
          setOptions(res.usuarios || []);
          if (res.dependencias && res.dependencias.length > 0) {
            setDependenciasList(res.dependencias);
          }
        }
      } catch (err) {
        console.error('Error buscando responsables:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchResponsables();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, dependenciaFilter, open]);

  const handleConfirm = () => {
    onSelect(tempSelected);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#0f766e', color: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SupervisorAccountIcon />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Seleccionar Tutor(es) Responsable(s)
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Selecciona uno o varios tutores/docentes responsables del listado institucional de usuarios.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.5fr' }, gap: 1.5, mb: 2 }}>
          <Autocomplete
            options={['TODOS', ...dependenciasList]}
            value={dependenciaFilter}
            onChange={(e, newValue) => setDependenciaFilter(newValue || 'TODOS')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filtrar por Programa / Dependencia"
                size="medium"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <FilterAltIcon color="action" sx={{ mr: 0.5 }} />
                      {params.InputProps.startAdornment}
                    </>
                  )
                }}
              />
            )}
          />

          <Autocomplete
            multiple
            options={options}
            value={tempSelected}
            onChange={(event, newValue) => setTempSelected(newValue)}
            getOptionLabel={(option) => `${option.nombre} (${option.cargo || option.dependencia || option.email})`}
            isOptionEqualToValue={(option, value) => option.id === value.id || option.email === value.email}
            filterOptions={(opts, state) => {
              if (!state.inputValue) return opts;
              const inputClean = normalizeString(state.inputValue);
              const tokens = inputClean.split(/\s+/).filter(Boolean);

              return opts.filter((opt) => {
                const targetText = normalizeString(
                  `${opt.nombre || ''} ${opt.email || ''} ${opt.cargo || ''} ${opt.dependencia || ''}`
                );
                return tokens.every((token) => targetText.includes(token));
              });
            }}
            loading={loading}
            onInputChange={(e, newInputValue) => setQuery(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Buscar Tutores Responsables"
                placeholder="Escribe nombre, correo o cargo..."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <SearchIcon color="action" sx={{ mr: 1 }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => (
                <Chip
                  key={option.id || index}
                  label={`${option.nombre} - ${option.cargo || option.email}`}
                  {...getTagProps({ index })}
                  color="secondary"
                  variant="outlined"
                  sx={{ m: 0.5 }}
                />
              ))
            }
          />
        </Box>

        {tempSelected.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#166534' }}>
              Tutores Seleccionados ({tempSelected.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {tempSelected.map((resp, idx) => (
                <Box key={idx} sx={{ p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #86efac', fontSize: 13 }}>
                  <strong>{resp.nombre}</strong> ({resp.email}) | {resp.cargo || resp.dependencia}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancelar
        </Button>
        <Button onClick={handleConfirm} variant="contained" color="secondary" sx={{ bgcolor: '#0f766e', '&:hover': { bgcolor: '#0d9488' } }}>
          Confirmar Tutores ({tempSelected.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResponsablesSelectorModal;
