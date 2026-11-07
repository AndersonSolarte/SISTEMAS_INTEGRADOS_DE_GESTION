import React, { useEffect, useId, useState } from 'react';
import { Box, ButtonBase, Collapse, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DeleteOutline from '@mui/icons-material/DeleteOutline';

export default function ActivityAccordion({ number, name, expanded, onToggle, onRemove, children }) {
  const id = useId();
  const [visited, setVisited] = useState(expanded);
  useEffect(() => { if (expanded) setVisited(true); }, [expanded]);
  return <Paper elevation={0} sx={{ border: '1px solid #dce4ef', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
    <Stack direction="row" alignItems="center" sx={{ px: 1, bgcolor: expanded ? '#f5f8fd' : '#fff' }}>
      <ButtonBase onClick={onToggle} aria-expanded={expanded} aria-controls={`${id}-content`} id={`${id}-header`} sx={{ flex: 1, minWidth: 0, justifyContent: 'space-between', textAlign: 'left', borderRadius: 2, p: 1.5, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 800 }}>Actividad {number}</Typography>
          <Typography sx={{ fontWeight: 750, color: '#1e293b', overflowWrap: 'anywhere' }}>{name?.trim() || 'Nueva actividad'}</Typography>
        </Box>
        <ExpandMore sx={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </ButtonBase>
      {onRemove && <Tooltip title="Eliminar actividad"><IconButton aria-label={`Eliminar actividad ${number}`} color="error" onClick={onRemove} sx={{ mr: 1 }}><DeleteOutline /></IconButton></Tooltip>}
    </Stack>
    <Collapse in={expanded} timeout="auto">
      <Box role="region" id={`${id}-content`} aria-labelledby={`${id}-header`} sx={{ p: { xs: 1.5, md: 2 }, borderTop: '1px solid #e8edf5' }}>{(visited || expanded) && children}</Box>
    </Collapse>
  </Paper>;
}
