import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import {
  FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatClear, FormatColorText,
  FormatIndentDecrease, FormatIndentIncrease, FormatItalic, FormatListBulleted, FormatListNumbered,
  FormatQuote, FormatUnderlined, HorizontalRule, Link as LinkIcon, Redo, TableChart, Title, Undo
} from '@mui/icons-material';

const TABLE_HTML = '<table><tbody><tr><th>Título 1</th><th>Título 2</th></tr><tr><td>Dato</td><td>Dato</td></tr></tbody></table><p><br></p>';

export const sanitizeRichHtml = (html = '') => {
  if (typeof window === 'undefined') return String(html || '');
  const parsed = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  const allowed = new Set(['DIV', 'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE', 'HR', 'A', 'SPAN', 'FONT', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  [...parsed.body.querySelectorAll('*')].forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    const previousStyle = node.getAttribute('style') || '';
    const alignment = /text-align\s*:\s*(left|center|right|justify)/i.exec(previousStyle)?.[1];
    const color = /(?:color\s*:\s*)(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))/i.exec(previousStyle)?.[1] || node.getAttribute('color');
    const fontFamily = /font-family\s*:\s*([^;]+)/i.exec(previousStyle)?.[1]?.replace(/["']/g, '').trim() || node.getAttribute('face');
    const fontSize = /font-size\s*:\s*(\d{1,2})(px|pt)/i.exec(previousStyle);
    const indent = /margin-left\s*:\s*(\d{1,3})px/i.exec(previousStyle)?.[1];
    const href = node.getAttribute('href') || '';
    const legacySize = node.getAttribute('size');
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    const styles = [];
    if (alignment) styles.push(`text-align:${alignment.toLowerCase()}`);
    if (color && /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i.test(color)) styles.push(`color:${color}`);
    if (fontFamily && /^(Arial|Georgia|Times New Roman|Verdana|sans-serif)$/i.test(fontFamily)) styles.push(`font-family:${fontFamily}`);
    if (fontSize) styles.push(`font-size:${Math.min(32, Math.max(9, Number(fontSize[1])))}${fontSize[2].toLowerCase()}`);
    if (indent) styles.push(`margin-left:${Math.min(200, Number(indent))}px`);
    if (styles.length) node.setAttribute('style', styles.join(';'));
    if (node.tagName === 'FONT' && /^(1|2|3|4|5|6|7)$/.test(legacySize || '')) node.setAttribute('size', legacySize);
    if (node.tagName === 'A' && /^(https?:\/\/|mailto:)/i.test(href)) {
      node.setAttribute('href', href); node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer');
    } else if (node.tagName === 'A') node.replaceWith(...node.childNodes);
  });
  return parsed.body.firstElementChild?.innerHTML || '';
};

export const insertTableRowAfter = (currentCell) => {
  const currentRow = currentCell?.closest?.('tr');
  const table = currentCell?.closest?.('table');
  if (!currentRow || !table) return null;
  const columnCount = Math.max(1, ...[...table.rows].map((row) => row.cells.length));
  const newRow = document.createElement('tr');
  for (let index = 0; index < columnCount; index += 1) {
    const cell = document.createElement('td');
    cell.innerHTML = '<br>';
    newRow.appendChild(cell);
  }
  currentRow.insertAdjacentElement('afterend', newRow);
  return newRow.cells[0];
};

export const insertTableColumnAfter = (currentCell) => {
  const table = currentCell?.closest?.('table');
  if (!currentCell || !table) return null;
  const insertAt = currentCell.cellIndex + 1;
  const selectedRowIndex = currentCell.parentElement.rowIndex;
  let targetCell = null;
  [...table.rows].forEach((row, rowIndex) => {
    const isHeaderRow = [...row.cells].some((cell) => cell.tagName === 'TH');
    const cell = document.createElement(isHeaderRow ? 'th' : 'td');
    cell.innerHTML = isHeaderRow ? `Título ${insertAt + 1}` : '<br>';
    row.insertBefore(cell, row.cells[insertAt] || null);
    if (rowIndex === selectedRowIndex) targetCell = cell;
  });
  return targetCell;
};

export default function RichTextEditor({ label, value, onChange, disabled = false, minHeight = 130 }) {
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const formatRange = useRef(null);
  const tableCellRef = useRef(null);
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [active, setActive] = useState({});

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const cleanValue = sanitizeRichHtml(value);
    if (editor.innerHTML !== cleanValue) editor.innerHTML = cleanValue;
  }, [value]);

  const readActiveFormats = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
    formatRange.current = selection.getRangeAt(0).cloneRange();
    const valueOf = (name) => String(document.queryCommandValue(name) || '').replace(/["']/g, '').trim();
    const block = valueOf('formatBlock').toLowerCase();
    const rawFont = valueOf('fontName').split(',')[0].trim();
    const fontName = ['Arial', 'Georgia', 'Times New Roman', 'Verdana'].find((item) => item.toLowerCase() === rawFont.toLowerCase()) || '';
    const selectedElement = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
    const tableCell = selectedElement?.closest?.('td,th');
    tableCellRef.current = tableCell && editorRef.current.contains(tableCell) ? tableCell : null;
    setActive({
      bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'),
      bullets: document.queryCommandState('insertUnorderedList'), numbers: document.queryCommandState('insertOrderedList'),
      left: document.queryCommandState('justifyLeft'), center: document.queryCommandState('justifyCenter'), right: document.queryCommandState('justifyRight'),
      title: /h2|h3/.test(block), quote: block === 'blockquote', fontName, fontSize: valueOf('fontSize'), color: valueOf('foreColor'), table: Boolean(tableCellRef.current)
    });
  };

  useEffect(() => {
    document.addEventListener('selectionchange', readActiveFormats);
    return () => document.removeEventListener('selectionchange', readActiveFormats);
  });

  const emit = () => onChange(sanitizeRichHtml(editorRef.current?.innerHTML || ''));
  const command = (name, commandValue = null) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (formatRange.current && selection && !editorRef.current?.contains(selection.anchorNode)) {
      selection.removeAllRanges();
      selection.addRange(formatRange.current);
    }
    document.execCommand(name, false, commandValue);
    emit();
    window.setTimeout(readActiveFormats, 0);
  };
  const openLinkDialog = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
    setLinkUrl('https://'); setLinkDialog(true);
  };
  const insertLink = () => {
    let safeUrl = linkUrl.trim();
    if (safeUrl && !/^(https?:\/\/|mailto:)/i.test(safeUrl)) safeUrl = `https://${safeUrl}`;
    if (!/^(https?:\/\/|mailto:)/i.test(safeUrl)) return;
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (savedRange.current && selection) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
    if (selection?.isCollapsed) document.execCommand('insertHTML', false, `<a href="${safeUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`);
    else document.execCommand('createLink', false, safeUrl);
    editorRef.current?.querySelectorAll('a').forEach((anchor) => { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; });
    emit(); setLinkDialog(false); savedRange.current = null;
  };
  const focusTableCell = (cell) => {
    if (!cell) return;
    tableCellRef.current = cell;
    editorRef.current?.focus();
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    formatRange.current = range.cloneRange();
    setActive((current) => ({ ...current, table: true }));
  };
  const addTableRow = () => {
    const targetCell = insertTableRowAfter(tableCellRef.current);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const addTableColumn = () => {
    const targetCell = insertTableColumnAfter(tableCellRef.current);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const tool = (title, icon, action, selected = false) => <Tooltip title={title}><span><IconButton size="small" disabled={disabled} aria-pressed={selected} onMouseDown={(event) => { event.preventDefault(); action(); }} sx={{ borderRadius: 1.5, color: selected ? '#174ea6' : '#52657d', bgcolor: selected ? '#dbeafe' : 'transparent', boxShadow: selected ? 'inset 0 0 0 1px #93b4dc' : 'none', '&:hover': { bgcolor: selected ? '#cfe3fb' : '#e5edf7' } }}>{icon}</IconButton></span></Tooltip>;

  return <Paper variant="outlined" sx={{ gridColumn: '1 / -1', overflow: 'hidden', borderRadius: 2.5, bgcolor: disabled ? '#f5f7fa' : '#fff' }}>
    <Box sx={{ px: 1.5, pt: 1.1 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography></Box>
    <Stack direction="row" alignItems="center" gap={0.25} flexWrap="wrap" sx={{ px: 1, py: 0.6, borderBottom: '1px solid #dbe5f0', bgcolor: '#f1f6fc' }}>
      {tool('Deshacer', <Undo fontSize="small" />, () => command('undo'))}
      {tool('Rehacer', <Redo fontSize="small" />, () => command('redo'))}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Box component="select" disabled={disabled} value={active.fontName || ''} onChange={(event) => command('fontName', event.target.value)} sx={{ height: 30, maxWidth: 120, border: 0, outline: 0, bgcolor: active.fontName ? '#e5edf7' : 'transparent', borderRadius: 1.5, color: '#334155', fontWeight: 700 }}><option value="">Tipo de letra</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option></Box>
      <Box component="select" disabled={disabled} value={['2', '3', '5', '6'].includes(active.fontSize) ? active.fontSize : ''} onChange={(event) => command('fontSize', event.target.value)} sx={{ height: 30, width: 82, border: 0, outline: 0, bgcolor: active.fontSize ? '#e5edf7' : 'transparent', borderRadius: 1.5, color: '#334155', fontWeight: 700 }}><option value="">Tamaño</option><option value="2">Pequeña</option><option value="3">Normal</option><option value="5">Grande</option><option value="6">Título</option></Box>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {tool('Negrita', <FormatBold fontSize="small" />, () => command('bold'), active.bold)}
      {tool('Cursiva', <FormatItalic fontSize="small" />, () => command('italic'), active.italic)}
      {tool('Subrayado', <FormatUnderlined fontSize="small" />, () => command('underline'), active.underline)}
      <Tooltip title="Color del texto"><span><IconButton component="label" size="small" disabled={disabled} sx={{ borderRadius: 1.5, color: '#52657d', borderBottom: `3px solid ${active.color || '#52657d'}` }}><FormatColorText fontSize="small" /><input hidden type="color" onChange={(event) => command('foreColor', event.target.value)} /></IconButton></span></Tooltip>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {tool('Título', <Title fontSize="small" />, () => command('formatBlock', active.title ? 'p' : 'h3'), active.title)}
      {tool('Lista con viñetas', <FormatListBulleted fontSize="small" />, () => command('insertUnorderedList'), active.bullets)}
      {tool('Lista numerada', <FormatListNumbered fontSize="small" />, () => command('insertOrderedList'), active.numbers)}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {tool('Alinear a la izquierda', <FormatAlignLeft fontSize="small" />, () => command('justifyLeft'), active.left)}
      {tool('Centrar', <FormatAlignCenter fontSize="small" />, () => command('justifyCenter'), active.center)}
      {tool('Alinear a la derecha', <FormatAlignRight fontSize="small" />, () => command('justifyRight'), active.right)}
      {tool('Disminuir sangría', <FormatIndentDecrease fontSize="small" />, () => command('outdent'))}
      {tool('Aumentar sangría', <FormatIndentIncrease fontSize="small" />, () => command('indent'))}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {tool('Insertar hipervínculo', <LinkIcon fontSize="small" />, openLinkDialog)}
      {tool('Cita', <FormatQuote fontSize="small" />, () => command('formatBlock', active.quote ? 'p' : 'blockquote'), active.quote)}
      {tool('Línea divisoria', <HorizontalRule fontSize="small" />, () => command('insertHorizontalRule'))}
      {tool('Insertar tabla de 2 × 2', <TableChart fontSize="small" />, () => command('insertHTML', TABLE_HTML))}
      {tool('Limpiar formato', <FormatClear fontSize="small" />, () => command('removeFormat'))}
    </Stack>
    {active.table && !disabled && <Stack direction="row" alignItems="center" gap={0.75} sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid #dbe5f0', bgcolor: '#f8fbff' }}>
      <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ mr: 0.5 }}>Editar tabla</Typography>
      <Button size="small" variant="outlined" onMouseDown={(event) => { event.preventDefault(); addTableRow(); }} sx={{ minHeight: 30, textTransform: 'none', fontWeight: 800 }}>+ Agregar fila</Button>
      <Button size="small" variant="outlined" onMouseDown={(event) => { event.preventDefault(); addTableColumn(); }} sx={{ minHeight: 30, textTransform: 'none', fontWeight: 800 }}>+ Agregar columna</Button>
    </Stack>}
    <Box
      ref={editorRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      onInput={() => { emit(); readActiveFormats(); }}
      onFocus={readActiveFormats}
      onMouseUp={readActiveFormats}
      onKeyUp={readActiveFormats}
      sx={{ minHeight, px: 1.8, py: 1.35, overflowX: 'auto', outline: 'none', fontSize: 15, lineHeight: 1.6, color: '#1e293b', '&:empty::before': { content: '"Escriba aquí…"', color: '#94a3b8' }, '& h2, & h3': { mt: 1, mb: 0.5, fontWeight: 800 }, '& p': { my: 0.5 }, '& blockquote': { my: 1, mx: 0, pl: 2, borderLeft: '4px solid #93b4dc', color: '#475569' }, '& hr': { my: 1.25, border: 0, borderTop: '1px solid #b8c8da' }, '& a': { color: '#1d5fd1', textDecoration: 'underline' }, '& ul, & ol': { my: 0.5, pl: 3 }, '& table': { width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', my: 1 }, '& th, & td': { border: '1px solid #94a3b8', p: 0.75, minWidth: 110 }, '& th': { bgcolor: '#eff6ff', fontWeight: 800 } }}
    />
    <Dialog open={linkDialog} onClose={() => setLinkDialog(false)} maxWidth="xs" fullWidth><DialogTitle fontWeight={900}>Insertar hipervínculo</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Dirección web o correo" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} helperText="Ejemplo: https://www.unicesmag.edu.co o mailto:correo@ejemplo.com" sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setLinkDialog(false)}>Cancelar</Button><Button variant="contained" onClick={insertLink}>Insertar enlace</Button></DialogActions></Dialog>
  </Paper>;
}
