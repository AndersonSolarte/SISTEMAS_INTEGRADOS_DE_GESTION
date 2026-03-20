import React from 'react';
import { Paper, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';

function GraficoBar({ title, subtitle, data = [], xKey, yKey, color = '#7c3aed', height = 340, colorByValue = false }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height }}>
      <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{title}</Typography>
      {subtitle ? <Typography sx={{ fontSize: 12, color: '#64748b', mb: 1 }}>{subtitle}</Typography> : null}
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey={yKey} radius={[8, 8, 0, 0]}>
            {data.map((row, index) => (
              <Cell
                key={`${xKey}-${index}`}
                fill={colorByValue ? (Number(row[yKey] || 0) >= 0 ? '#10b981' : '#ef4444') : color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}

export default GraficoBar;
