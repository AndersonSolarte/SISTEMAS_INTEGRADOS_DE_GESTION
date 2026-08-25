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
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import cronogramaMovilidadService from '../../services/cronogramaMovilidadService';

const normalizeString = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const MatriculadosSelectorModal = ({ open, onClose, selectedEstudiantes = [], onSelect, programaFilter = '' }) => {
  const [query, setQuery] = useState('');
  const [selectedPrograma, setSelectedPrograma] = useState(programaFilter || 'TODOS');
  const [programasList, setProgramasList] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tempSelected, setTempSelected] = useState(selectedEstudiantes);

  useEffect(() => {
    setTempSelected(selectedEstudiantes || []);
  }, [selectedEstudiantes, open]);

  useEffect(() => {
    if (programaFilter) {
      setSelectedPrograma(programaFilter);
    }
  }, [programaFilter]);

  useEffect(() => {
    let active = true;
    const fetchEstudiantes = async () => {
      setLoading(true);
      try {
        const prog = selectedPrograma === 'TODOS' ? '' : selectedPrograma;
        const res = await cronogramaMovilidadService.buscarEstudiantesMatriculados(query, prog);
        if (active) {
          setOptions(res.estudiantes || []);
          if (res.programas && res.programas.length > 0) {
            setProgramasList(res.programas);
          }
        }
      } catch (err) {
        console.error('Error buscando estudiantes matriculados:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchEstudiantes();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selectedPrograma, open]);

  const handleConfirm = () => {
    onSelect(tempSelected);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#1e3a8a', color: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Asociar Estudiantes en Práctica Formativa (Base de Matriculados)
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Filtra por programa y busca por nombre, código de estudiante o documento de identidad en la base institucional de matriculados.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.5fr' }, gap: 1.5, mb: 2 }}>
          <Autocomplete
            options={['TODOS', ...programasList]}
            value={selectedPrograma}
            onChange={(e, newValue) => setSelectedPrograma(newValue || 'TODOS')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filtrar por Programa Académico"
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
            getOptionLabel={(option) => `${option.nombre_completo} (${option.codigo_estudiante || option.numero_documento}) - ${option.programa || ''}`}
            isOptionEqualToValue={(option, value) => option.id === value.id || option.numero_documento === value.numero_documento}
            filterOptions={(opts, state) => {
              if (!state.inputValue) return opts;
              const inputClean = normalizeString(state.inputValue);
              const tokens = inputClean.split(/\s+/).filter(Boolean);

              return opts.filter((opt) => {
                const targetText = normalizeString(
                  `${opt.nombre_completo || ''} ${opt.numero_documento || ''} ${opt.codigo_estudiante || ''} ${opt.programa || ''}`
                );
                return tokens.every((token) => targetText.includes(token));
              });
            }}
            loading={loading}
            onInputChange={(e, newInputValue) => setQuery(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Buscar Estudiantes Matriculados"
                placeholder="Escribe nombre, documento o código..."
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
                  label={`${option.nombre_completo} (${option.codigo_estudiante || option.numero_documento})`}
                  {...getTagProps({ index })}
                  color="primary"
                  variant="outlined"
                  sx={{ m: 0.5 }}
                />
              ))
            }
          />
        </Box>

        {tempSelected.length > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#1e293b' }}>
              Estudiantes Seleccionados ({tempSelected.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {tempSelected.map((est, idx) => (
                <Box key={idx} sx={{ p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #cbd5e1', fontSize: 13 }}>
                  <strong>{est.nombre_completo}</strong> | Cód: {est.codigo_estudiante || 'N/A'} | Doc: {est.numero_documento || 'N/A'} | {est.programa}
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
        <Button onClick={handleConfirm} variant="contained" color="primary" sx={{ bgcolor: '#1e3a8a', '&:hover': { bgcolor: '#1d4ed8' } }}>
          Confirmar Estudiantes ({tempSelected.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MatriculadosSelectorModal;
