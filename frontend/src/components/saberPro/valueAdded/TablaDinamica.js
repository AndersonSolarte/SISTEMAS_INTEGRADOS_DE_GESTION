import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from '@mui/material';

function TablaDinamica({ columns, rows, search = '', onSearchChange = null }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5', overflow: 'hidden' }}>
      {onSearchChange ? (
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por documento..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          sx={{ p: 1.2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
        />
      ) : null}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.key} sx={{ fontWeight: 800, color: '#1e293b', bgcolor: '#f8fafc', whiteSpace: 'nowrap' }}>
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.documento || row.programa || row.nucleo_basico_conocimiento || 'row'}-${index}`} hover>
                {columns.map((column) => (
                  <TableCell key={column.key} sx={{ whiteSpace: 'nowrap' }}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ py: 4, textAlign: 'center', color: '#64748b' }}>
                  No hay datos disponibles para la selección actual.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default TablaDinamica;
