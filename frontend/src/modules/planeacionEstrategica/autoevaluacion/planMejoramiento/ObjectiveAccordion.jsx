import React, { useId, useState } from 'react';
import { Box, ButtonBase, Chip, Collapse, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DeleteOutline from '@mui/icons-material/DeleteOutline';

export default function ObjectiveAccordion({ number, imported, onRemove, children }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#fbfdff', overflow: 'hidden' }}>
    <Stack direction="row" alignItems="center" sx={{ px: { xs: 1, md: 1.5 }, py: 0.5 }}>
      <ButtonBase id={`${id}-header`} aria-expanded={expanded} aria-controls={`${id}-content`} onClick={() => setExpanded((value) => !value)} sx={{ flex: 1, minWidth: 0, p: 1, gap: 1.5, borderRadius: 2, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Chip label={`Objetivo de mejoramiento ${number}`} color="primary" sx={{ fontWeight: 900 }} />
        {imported && <Chip size="small" label="Importado de Autoevaluación" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 850 }} />}
      </ButtonBase>
      <Tooltip title="Eliminar objetivo"><IconButton aria-label={`Eliminar objetivo ${number}`} color="error" onClick={onRemove}><DeleteOutline /></IconButton></Tooltip>
      <Tooltip title={expanded ? 'Contraer objetivo' : 'Expandir objetivo'}>
        <IconButton aria-label={`${expanded ? 'Contraer' : 'Expandir'} objetivo ${number}`} aria-expanded={expanded} aria-controls={`${id}-content`} onClick={() => setExpanded((value) => !value)}>
          <ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </IconButton>
      </Tooltip>
    </Stack>
    <Collapse in={expanded} timeout="auto">
      <Box id={`${id}-content`} role="region" aria-labelledby={`${id}-header`} sx={{ p: { xs: 1.5, md: 2 }, pt: 1 }}>{children}</Box>
    </Collapse>
  </Paper>;
}
