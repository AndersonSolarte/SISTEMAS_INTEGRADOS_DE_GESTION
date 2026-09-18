import {
  adjustTableColumnWidth, adjustTableRowPadding, distributeTableColumns, fitTableToWindow,
  insertTableColumnAfter, insertTableRowAfter, removeSelectedTableColumn,
  removeSelectedTableRow, sanitizeRichHtml
} from './RichTextEditor';

const createTable = () => {
  const container = document.createElement('div');
  container.innerHTML = '<table><tbody><tr><th>Título 1</th><th>Título 2</th></tr><tr><td>Dato 1</td><td>Dato 2</td></tr></tbody></table>';
  return container;
};

test('permite agregar filas y columnas a una tabla del acta', () => {
  const container = createTable();
  const table = container.querySelector('table');

  insertTableRowAfter(table.rows[1].cells[0]);
  insertTableColumnAfter(table.rows[1].cells[0]);

  expect(table.rows).toHaveLength(3);
  expect([...table.rows].every((row) => row.cells.length === 3)).toBe(true);
  expect(sanitizeRichHtml(container.innerHTML)).toMatch(/<table[^>]*>/);
});

test('permite eliminar la fila y la columna seleccionadas sin borrar toda la tabla', () => {
  const container = createTable();
  const table = container.querySelector('table');
  insertTableRowAfter(table.rows[1].cells[0]);
  insertTableColumnAfter(table.rows[1].cells[0]);

  const rowTarget = removeSelectedTableRow(table.rows[1].cells[0]);
  removeSelectedTableColumn(rowTarget);

  expect(table.rows).toHaveLength(2);
  expect([...table.rows].every((row) => row.cells.length === 2)).toBe(true);
  expect([...table.rows[0].cells].map((cell) => cell.textContent)).toEqual(['Título 1', 'Título 2']);
  expect(removeSelectedTableRow(table.rows[1].cells[0])).not.toBeNull();
  expect(removeSelectedTableRow(table.rows[0].cells[0])).toBeNull();
  expect(removeSelectedTableColumn(table.rows[0].cells[1])).not.toBeNull();
  expect(removeSelectedTableColumn(table.rows[0].cells[0])).toBeNull();
});

test('permite ajustar altura de filas, ancho de columnas y ajustar al 100% de la ventana', () => {
  const container = createTable();
  const table = container.querySelector('table');

  fitTableToWindow(table.rows[0].cells[0]);
  expect(table.style.width).toBe('100%');
  expect(table.style.tableLayout).toBe('fixed');

  adjustTableRowPadding(table.rows[1].cells[0], 5);
  expect(parseFloat(table.rows[1].cells[0].style.padding)).toBeGreaterThan(8);

  distributeTableColumns(table.rows[0].cells[0]);
  expect(table.rows[0].cells[0].style.width).toBe('50.00%');

  adjustTableColumnWidth(table.rows[0].cells[0], 10);
  expect(parseFloat(table.rows[0].cells[0].style.width)).toBeGreaterThan(50);
});
