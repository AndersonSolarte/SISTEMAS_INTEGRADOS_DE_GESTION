import React, { useId } from 'react';
import { Box, FormControl, MenuItem, Select, Typography } from '@mui/material';

export default function AdminActionPlanChatRecipient({ role, value, onChange, leader, actorId, planningUser, disabled, peers = [], planCode }) {
  const labelId = useId();
  if (role === 'administrador') return <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography sx={{ color: '#c7e8e2', fontSize: 11, mb: 0.5 }}>Escribir a</Typography>
    <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 750 }}>Planeación y Efectividad</Typography>
    {planningUser?.role === 'planeacion_efectividad' && planningUser?.nombre && <Typography sx={{ color: '#d1eee8', fontSize: 11, mt: 0.25 }}>{planningUser.nombre}</Typography>}
    {planCode && <Typography sx={{ color: '#c7e8e2', fontSize: 11, mt: 0.5 }}>Plan: {planCode}</Typography>}
  </Box>;
  if (role !== 'planeacion_efectividad' || !peers.length) return null;
  const noLeader = !leader?.id || String(leader.id) === String(actorId);
  const selectedPeer = peers.find(peer => 'administrator:' + peer.id === value);
  const title = value === 'leader' ? 'Líder del plan' : 'Administrador';
  const name = value === 'leader' ? leader?.name : selectedPeer?.name;
  return <FormControl sx={{ flex: 1, minWidth: 0, width: '100%', maxWidth: 440 }}>
    <Typography id={labelId} sx={{ color: '#c7e8e2', fontSize: 11, fontWeight: 600, mb: 0.5, lineHeight: 1.2 }}>Escribir a</Typography>
    <Select size="small" labelId={labelId} value={value} disabled={disabled}
      renderValue={() => <Box sx={{ minWidth: 0 }}>
        <Box component="span" sx={{ display: 'block', color: '#fff', fontSize: 14, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Box>
        {name && <Box component="span" sx={{ display: 'block', color: '#d1eee8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>{name}</Box>}
      </Box>}
    onChange={event => onChange(event.target.value)}
      MenuProps={{ PaperProps: { sx: { mt: 0.75, borderRadius: 2, maxWidth: 'calc(100vw - 32px)', '& .MuiMenuItem-root': { color: '#173c36', whiteSpace: 'normal', fontSize: 13, py: 1.25 } } } }}
      sx={{ bgcolor: '#116f63', borderRadius: 2, color: '#fff',
        '& .MuiSelect-select, & .MuiSelect-select:focus': { backgroundColor: 'transparent', color: '#fff', py: 1, pl: 1.5, pr: '34px !important', borderRadius: 2 },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#44978a' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8ccdbf' },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b0eadc', borderWidth: 1 },
        '& .MuiSelect-icon': { color: '#d9f3ec' }, '& .Mui-disabled': { WebkitTextFillColor: '#c7e8e2' } }}>
    <MenuItem value="leader" disabled={noLeader}>Líder del plan{leader?.name ? ' · ' + leader.name : ' · Sin líder asignado'}</MenuItem>
    {peers.map(peer => <MenuItem key={peer.id} value={'administrator:' + peer.id}>Administrador · {peer.name}</MenuItem>)}
    </Select>
    {planCode && <Typography sx={{ color: '#c7e8e2', fontSize: 11, mt: 0.5, lineHeight: 1.2 }}>Plan: {planCode}</Typography>}
  </FormControl>;
}
