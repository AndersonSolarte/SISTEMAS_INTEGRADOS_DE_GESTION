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

const getRowKey = (row, rowKey) => {
  if (typeof rowKey === 'function') return rowKey(row);
  return row[rowKey];
};

function TablaDinamica({ columns, rows, search = '', onSearchChange = null, onRowClick = null, selectedRowKey = null, rowKey = 'documento' }) {
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
            {rows.map((row, index) => {
              const isSelected = selectedRowKey != null && String(getRowKey(row, rowKey)) === String(selectedRowKey);
              return (
                <TableRow
                  key={`${row.documento || row.programa || row.nucleo_basico_conocimiento || 'row'}-${index}`}
                  hover
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    bgcolor: isSelected ? '#eff6ff !important' : undefined,
                    outline: isSelected ? '2px solid #3b82f6' : 'none',
                    outlineOffset: '-2px'
                  }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} sx={{ whiteSpace: 'nowrap' }}>
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
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
