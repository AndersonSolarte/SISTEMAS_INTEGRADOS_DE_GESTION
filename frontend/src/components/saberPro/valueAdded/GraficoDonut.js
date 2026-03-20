import React from 'react';
import { Paper, Stack, Typography } from '@mui/material';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#cbd5e1'];

function GraficoDonut({ title, subtitle, data = [], height = 340 }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height }}>
      <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{title}</Typography>
      {subtitle ? <Typography sx={{ fontSize: 12, color: '#64748b', mb: 1 }}>{subtitle}</Typography> : null}
      <ResponsiveContainer width="100%" height="78%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2}>
            {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => [`${value}%`, 'Participación']} />
        </PieChart>
      </ResponsiveContainer>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {data.map((entry, index) => (
          <Stack key={entry.name} direction="row" spacing={0.7} alignItems="center">
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[index % COLORS.length], display: 'inline-block' }} />
            <Typography sx={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>
              {`${entry.name}: ${entry.value}%`}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

export default GraficoDonut;
