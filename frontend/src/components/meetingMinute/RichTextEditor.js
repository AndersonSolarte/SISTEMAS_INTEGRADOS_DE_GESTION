import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import {
  Add, DeleteOutline, DeleteSweep, FitScreen,
  FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatClear, FormatColorText,
  FormatIndentDecrease, FormatIndentIncrease, FormatItalic, FormatListBulleted, FormatListNumbered,
  FormatQuote, FormatUnderlined, HorizontalRule, Link as LinkIcon, Mic, Redo, StopCircle, TableChart, Title, Undo
} from '@mui/icons-material';

const TABLE_HTML = '<table style="width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;"><tbody><tr><th style="width:50%;padding:8px;">Título 1</th><th style="width:50%;padding:8px;">Título 2</th></tr><tr><td style="padding:8px;">Dato</td><td style="padding:8px;">Dato</td></tr></tbody></table><p><br></p>';

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
    const colspan = node.getAttribute('colspan');
    const rowspan = node.getAttribute('rowspan');

    const widthMatch = /width\s*:\s*(\d+(?:\.\d+)?(?:%|px))/i.exec(previousStyle);
    const width = widthMatch?.[1];
    const heightMatch = /height\s*:\s*(\d+(?:\.\d+)?(?:%|px))/i.exec(previousStyle);
    const height = heightMatch?.[1];
    const paddingMatch = /padding\s*:\s*(\d+(?:\.\d+)?px)/i.exec(previousStyle);
    const padding = paddingMatch?.[1];
    const tableLayout = /table-layout\s*:\s*(fixed|auto)/i.exec(previousStyle)?.[1];
    const verticalAlign = /vertical-align\s*:\s*(top|middle|bottom)/i.exec(previousStyle)?.[1];
    const bgColor = /background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgb\([^)]+\)|#?[a-z0-9]+)/i.exec(previousStyle)?.[1];

    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    const styles = [];
    if (alignment) styles.push(`text-align:${alignment.toLowerCase()}`);
    if (color && /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i.test(color)) styles.push(`color:${color}`);
    if (fontFamily && /^(Arial|Georgia|Times New Roman|Verdana|sans-serif)$/i.test(fontFamily)) styles.push(`font-family:${fontFamily}`);
    if (fontSize) styles.push(`font-size:${Math.min(32, Math.max(9, Number(fontSize[1])))}${fontSize[2].toLowerCase()}`);
    if (indent) styles.push(`margin-left:${Math.min(200, Number(indent))}px`);

    if (width) styles.push(`width:${width}`);
    if (height) styles.push(`height:${height}`);
    if (padding) styles.push(`padding:${padding}`);
    if (tableLayout) styles.push(`table-layout:${tableLayout}`);
    if (verticalAlign) styles.push(`vertical-align:${verticalAlign}`);
    if (bgColor && /^(#[0-9a-f]{3,8}|rgb\([^)]+\)|#?[a-z0-9]+)$/i.test(bgColor)) styles.push(`background-color:${bgColor}`);

    if (styles.length) node.setAttribute('style', styles.join(';'));
    if (colspan && /^\d+$/.test(colspan)) node.setAttribute('colspan', colspan);
    if (rowspan && /^\d+$/.test(rowspan)) node.setAttribute('rowspan', rowspan);
    if (node.tagName === 'FONT' && /^(1|2|3|4|5|6|7)$/.test(legacySize || '')) node.setAttribute('size', legacySize);
    if (node.tagName === 'A' && /^(https?:\/\/|mailto:)/i.test(href)) {
      node.setAttribute('href', href); node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer');
    } else if (node.tagName === 'A') node.replaceWith(...node.childNodes);
  });
  return parsed.body.firstElementChild?.innerHTML || '';
};

export const adjustTableRowPadding = (currentCell, delta) => {
  const row = currentCell?.closest?.('tr');
  if (!row) return null;
  [...row.cells].forEach((cell) => {
    const computed = parseFloat(window.getComputedStyle(cell).paddingTop) || 8;
    const current = parseFloat(cell.style.paddingTop || cell.style.padding) || computed;
    const next = Math.max(2, Math.min(35, Math.round(current + delta)));
    cell.style.padding = `${next}px`;
  });
  return currentCell;
};

export const adjustTableColumnWidth = (currentCell, delta) => {
  const table = currentCell?.closest?.('table');
  if (!currentCell || !table || !table.rows.length) return null;
  const colIndex = currentCell.cellIndex;
  const firstRow = table.rows[0];
  const numCols = firstRow.cells.length;
  if (numCols <= 1) return currentCell;

  table.style.width = '100%';
  table.style.maxWidth = '100%';
  table.style.tableLayout = 'fixed';

  const widths = [...firstRow.cells].map((c) => {
    const raw = parseFloat(c.style.width);
    return isNaN(raw) ? 100 / numCols : raw;
  });

  const targetWidth = Math.max(10, Math.min(80, widths[colIndex] + delta));
  const diff = targetWidth - widths[colIndex];
  widths[colIndex] = targetWidth;

  const otherCols = numCols - 1;
  const adj = diff / otherCols;
  widths.forEach((w, idx) => {
    if (idx !== colIndex) {
      widths[idx] = Math.max(10, w - adj);
    }
  });

  const total = widths.reduce((s, w) => s + w, 0);
  [...table.rows].forEach((r) => {
    [...r.cells].forEach((c, idx) => {
      c.style.width = `${((widths[idx] / total) * 100).toFixed(2)}%`;
      c.style.wordBreak = 'break-word';
      c.style.overflowWrap = 'anywhere';
      c.style.whiteSpace = 'normal';
    });
  });

  return currentCell;
};

export const distributeTableColumns = (currentCell) => {
  const table = currentCell?.closest?.('table');
  if (!table || !table.rows.length) return null;
  table.style.width = '100%';
  table.style.maxWidth = '100%';
  table.style.tableLayout = 'fixed';
  const numCols = Math.max(1, ...[...table.rows].map((r) => r.cells.length));
  const pct = (100 / numCols).toFixed(2);
  [...table.rows].forEach((r) => {
    [...r.cells].forEach((c) => {
      c.style.width = `${pct}%`;
      c.style.wordBreak = 'break-word';
      c.style.overflowWrap = 'anywhere';
      c.style.whiteSpace = 'normal';
    });
  });
  return currentCell;
};

export const fitTableToWindow = (currentCell) => {
  const table = currentCell?.closest?.('table');
  if (!table) return null;
  table.style.width = '100%';
  table.style.maxWidth = '100%';
  table.style.tableLayout = 'fixed';
  const numCols = Math.max(1, ...[...table.rows].map((r) => r.cells.length));
  const pct = (100 / numCols).toFixed(2);
  [...table.rows].forEach((r) => {
    [...r.cells].forEach((c) => {
      if (!c.style.width) c.style.width = `${pct}%`;
      c.style.wordBreak = 'break-word';
      c.style.overflowWrap = 'anywhere';
      c.style.whiteSpace = 'normal';
    });
  });
  return currentCell;
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
    cell.style.padding = currentRow.cells[index]?.style.padding || '8px';
    cell.style.wordBreak = 'break-word';
    cell.style.overflowWrap = 'anywhere';
    cell.style.whiteSpace = 'normal';
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
    cell.innerHTML = isHeaderRow ? `Título ${row.cells.length + 1}` : '<br>';
    cell.style.padding = '8px';
    cell.style.wordBreak = 'break-word';
    cell.style.overflowWrap = 'anywhere';
    cell.style.whiteSpace = 'normal';
    row.insertBefore(cell, row.cells[insertAt] || null);
    if (rowIndex === selectedRowIndex) targetCell = cell;
  });
  distributeTableColumns(targetCell || currentCell);
  const headerCells = [...(table.rows[0]?.cells || [])];
  if (headerCells.length && headerCells.every((cell) => /^Título\s+\d+$/i.test(cell.textContent.trim()))) {
    headerCells.forEach((cell, index) => { cell.textContent = `Título ${index + 1}`; });
  }
  return targetCell;
};

export const removeSelectedTableRow = (currentCell) => {
  const currentRow = currentCell?.closest?.('tr');
  const table = currentCell?.closest?.('table');
  if (!currentRow || !table || table.rows.length <= 1) return null;
  const rowIndex = currentRow.rowIndex;
  const columnIndex = currentCell.cellIndex;
  currentRow.remove();
  const targetRow = table.rows[Math.min(rowIndex, table.rows.length - 1)];
  return targetRow?.cells[Math.min(columnIndex, targetRow.cells.length - 1)] || null;
};

export const removeSelectedTableColumn = (currentCell) => {
  const table = currentCell?.closest?.('table');
  if (!currentCell || !table || Math.max(...[...table.rows].map((row) => row.cells.length)) <= 1) return null;
  const rowIndex = currentCell.parentElement.rowIndex;
  const columnIndex = currentCell.cellIndex;
  [...table.rows].forEach((row) => row.cells[columnIndex]?.remove());
  distributeTableColumns(table.rows[0]?.cells[0]);
  const headerCells = [...(table.rows[0]?.cells || [])];
  if (headerCells.length && headerCells.every((cell) => /^Título\s+\d+$/i.test(cell.textContent.trim()))) {
    headerCells.forEach((cell, index) => { cell.textContent = `Título ${index + 1}`; });
  }
  const targetRow = table.rows[Math.min(rowIndex, table.rows.length - 1)];
  return targetRow?.cells[Math.min(columnIndex, targetRow.cells.length - 1)] || null;
};

export const getDictationParagraph = (editor, forceNewParagraph = false) => {
  if (!editor) return null;
  const lastElement = editor.lastElementChild;
  const canContinueLastParagraph = !forceNewParagraph
    && lastElement
    && ['P', 'DIV'].includes(lastElement.tagName)
    && !lastElement.querySelector('table');
  if (canContinueLastParagraph) return lastElement;

  const paragraph = document.createElement('p');
  paragraph.appendChild(document.createElement('br'));
  editor.appendChild(paragraph);
  return paragraph;
};

export const appendDictationText = (paragraph, transcript) => {
  const cleanTranscript = String(transcript || '').replace(/\s+/g, ' ').trim();
  if (!paragraph || !cleanTranscript) return false;
  const currentText = String(paragraph.textContent || '');
  const separator = currentText && !/\s$/.test(currentText) ? ' ' : '';
  const trailingBreak = paragraph.lastChild?.nodeName === 'BR' ? paragraph.lastChild : null;
  paragraph.insertBefore(document.createTextNode(`${separator}${cleanTranscript}`), trailingBreak);
  return true;
};

export default function RichTextEditor({ label, value, onChange, disabled = false, minHeight = 130, error = false, id }) {
  const editorRef = useRef(null);
  const savedRange = useRef(null);
  const formatRange = useRef(null);
  const tableCellRef = useRef(null);
  const recognitionRef = useRef(null);
  const dictationParagraphRef = useRef(null);
  const dictationStartsNewParagraphRef = useRef(false);
  const hasCompletedDictationRef = useRef(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [active, setActive] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [microphoneDialog, setMicrophoneDialog] = useState(false);
  const [requestingMicrophone, setRequestingMicrophone] = useState(false);
  const [microphonePermissionError, setMicrophonePermissionError] = useState('');

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
    const selectedTable = tableCellRef.current?.closest('table');
    setActive({
      bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'),
      bullets: document.queryCommandState('insertUnorderedList'), numbers: document.queryCommandState('insertOrderedList'),
      left: document.queryCommandState('justifyLeft'), center: document.queryCommandState('justifyCenter'), right: document.queryCommandState('justifyRight'),
      title: /h2|h3/.test(block), quote: block === 'blockquote', fontName, fontSize: valueOf('fontSize'), color: valueOf('foreColor'), table: Boolean(tableCellRef.current),
      tableRows: selectedTable?.rows.length || 0, tableColumns: selectedTable ? Math.max(...[...selectedTable.rows].map((row) => row.cells.length)) : 0
    });
  };

  useEffect(() => {
    document.addEventListener('selectionchange', readActiveFormats);
    return () => document.removeEventListener('selectionchange', readActiveFormats);
  });

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try { recognition.stop(); } catch (_) {}
    }
  }, []);

  const emit = () => onChange(sanitizeRichHtml(editorRef.current?.innerHTML || ''));
  const stopDictation = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setIsListening(false);
    setSpeechMessage('Dictado detenido. Al volver a activarlo continuará en un párrafo nuevo.');
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
  };
  const startDictation = () => {
    if (disabled) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechMessage('El dictado por voz no está disponible en este navegador. Use Chrome o Edge actualizado.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = true;
    dictationParagraphRef.current = null;
    dictationStartsNewParagraphRef.current = hasCompletedDictationRef.current;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalTranscript += ` ${transcript}`;
        else interimTranscript += ` ${transcript}`;
      }
      if (finalTranscript.trim()) {
        if (!dictationParagraphRef.current) {
          dictationParagraphRef.current = getDictationParagraph(editorRef.current, dictationStartsNewParagraphRef.current);
        }
        if (appendDictationText(dictationParagraphRef.current, finalTranscript)) {
          hasCompletedDictationRef.current = true;
          emit();
        }
      }
      setSpeechMessage(interimTranscript.trim() ? `Escuchando: ${interimTranscript.trim()}` : 'Escuchando… hable con claridad.');
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setIsListening(false);
      const permissionDenied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      setSpeechMessage(permissionDenied
        ? 'Permita el acceso al micrófono en el navegador para usar el dictado.'
        : 'El dictado se interrumpió. Puede volver a intentarlo.');
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      setSpeechMessage((current) => current.startsWith('Escuchando')
        ? 'Dictado detenido. Al volver a activarlo continuará en un párrafo nuevo.'
        : current);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setSpeechMessage('Escuchando… hable con claridad.');
    } catch (_) {
      setIsListening(false);
      setSpeechMessage('No fue posible iniciar el micrófono. Inténtelo nuevamente.');
    }
  };
  const requestMicrophoneAndStart = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermissionError('Este navegador no permite solicitar el micrófono desde la página. Use Chrome o Edge actualizado.');
      return;
    }
    setRequestingMicrophone(true);
    setMicrophonePermissionError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneDialog(false);
      startDictation();
    } catch (error) {
      const blocked = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      setMicrophonePermissionError(blocked
        ? 'El permiso está bloqueado en el navegador. Abra la información del sitio junto a la dirección, restablezca el permiso del micrófono y luego pulse “Reintentar”.'
        : 'No fue posible acceder al micrófono. Verifique que esté conectado y disponible.');
    } finally {
      setRequestingMicrophone(false);
    }
  };
  const toggleDictation = async () => {
    if (isListening) {
      stopDictation();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechMessage('El dictado por voz no está disponible en este navegador. Use Chrome o Edge actualizado.');
      return;
    }

    let permissionState = 'prompt';
    try {
      const permission = await navigator.permissions?.query?.({ name: 'microphone' });
      permissionState = permission?.state || 'prompt';
    } catch (_) {}
    if (permissionState === 'granted') {
      startDictation();
      return;
    }
    setMicrophonePermissionError(permissionState === 'denied'
      ? 'El permiso está bloqueado en el navegador. Abra la información del sitio junto a la dirección, restablezca el permiso del micrófono y luego pulse “Reintentar”.'
      : '');
    setMicrophoneDialog(true);
  };
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
    const table = cell.closest('table');
    setActive((current) => ({ ...current, table: true, tableRows: table?.rows.length || 0, tableColumns: table ? Math.max(...[...table.rows].map((row) => row.cells.length)) : 0 }));
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
  const removeTableRow = () => {
    const targetCell = removeSelectedTableRow(tableCellRef.current);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const removeTableColumn = () => {
    const targetCell = removeSelectedTableColumn(tableCellRef.current);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const handleAdjustRowHeight = (delta) => {
    const targetCell = adjustTableRowPadding(tableCellRef.current, delta);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const handleAdjustColumnWidth = (delta) => {
    const targetCell = adjustTableColumnWidth(tableCellRef.current, delta);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const handleDistributeCols = () => {
    const targetCell = distributeTableColumns(tableCellRef.current);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const handleFitWindow = () => {
    const targetCell = fitTableToWindow(tableCellRef.current);
    if (!targetCell) return;
    emit();
    focusTableCell(targetCell);
  };
  const tool = (title, icon, action, selected = false) => <Tooltip title={title}><span><IconButton size="small" disabled={disabled} aria-pressed={selected} onMouseDown={(event) => { event.preventDefault(); action(); }} sx={{ borderRadius: 1.5, color: selected ? '#174ea6' : '#52657d', bgcolor: selected ? '#dbeafe' : 'transparent', boxShadow: selected ? 'inset 0 0 0 1px #93b4dc' : 'none', '&:hover': { bgcolor: selected ? '#cfe3fb' : '#e5edf7' } }}>{icon}</IconButton></span></Tooltip>;

  return <Paper id={id} variant="outlined" sx={{ gridColumn: '1 / -1', overflow: 'hidden', borderRadius: 2.5, bgcolor: disabled ? '#f5f7fa' : '#fff', borderWidth: '1.5px', borderColor: error ? '#dc2626' : '#94a3b8', boxShadow: error ? '0 0 0 2px rgba(220,38,38,0.12)' : 'none' }}>
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
      {tool('Insertar tabla', <TableChart fontSize="small" />, () => command('insertHTML', TABLE_HTML))}
      {tool('Limpiar formato', <FormatClear fontSize="small" />, () => command('removeFormat'))}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {tool(isListening ? 'Detener dictado por voz' : 'Iniciar dictado por voz', isListening ? <StopCircle color="error" fontSize="small" /> : <Mic fontSize="small" />, toggleDictation, isListening)}
    </Stack>
    {speechMessage && (
      <Box sx={{ px: 1.5, py: 0.55, borderBottom: '1px solid #dbe5f0', bgcolor: isListening ? '#ecfdf5' : '#fff7ed' }}>
        <Typography variant="caption" sx={{ color: isListening ? '#047857' : '#9a3412', fontWeight: 750 }}>
          {speechMessage}
        </Typography>
      </Box>
    )}
    {active.table && !disabled && (
      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        flexWrap="wrap"
        sx={{
          px: 1.5,
          py: 0.6,
          borderBottom: '1px solid #dbe5f0',
          bgcolor: '#f8fafc'
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.6} sx={{ color: '#1e40af', mr: 0.5 }}>
          <TableChart sx={{ fontSize: 16 }} />
          <Typography variant="caption" fontWeight={900} letterSpacing={0.5}>TABLA</Typography>
        </Stack>

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

        {/* Filas */}
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Tooltip title="Agregar fila abajo">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add sx={{ fontSize: '15px !important' }} />}
              onMouseDown={(event) => { event.preventDefault(); addTableRow(); }}
              sx={{ minHeight: 26, py: 0.2, px: 1, textTransform: 'none', fontWeight: 750, fontSize: 11.5, borderColor: '#cbd5e1', color: '#1e293b' }}
            >
              Fila
            </Button>
          </Tooltip>
          <Tooltip title="Eliminar fila actual">
            <span>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={active.tableRows <= 1}
                startIcon={<DeleteOutline sx={{ fontSize: '15px !important' }} />}
                onMouseDown={(event) => { event.preventDefault(); removeTableRow(); }}
                sx={{ minHeight: 26, py: 0.2, px: 1, textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
              >
                Fila
              </Button>
            </span>
          </Tooltip>
        </Stack>

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

        {/* Columnas */}
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Tooltip title="Agregar columna a la derecha">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add sx={{ fontSize: '15px !important' }} />}
              onMouseDown={(event) => { event.preventDefault(); addTableColumn(); }}
              sx={{ minHeight: 26, py: 0.2, px: 1, textTransform: 'none', fontWeight: 750, fontSize: 11.5, borderColor: '#cbd5e1', color: '#1e293b' }}
            >
              Columna
            </Button>
          </Tooltip>
          <Tooltip title="Eliminar columna actual">
            <span>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={active.tableColumns <= 1}
                startIcon={<DeleteOutline sx={{ fontSize: '15px !important' }} />}
                onMouseDown={(event) => { event.preventDefault(); removeTableColumn(); }}
                sx={{ minHeight: 26, py: 0.2, px: 1, textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
              >
                Columna
              </Button>
            </span>
          </Tooltip>
        </Stack>

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

        {/* Ajuste al 100% */}
        <Tooltip title="Distribuir columnas y ajustar la tabla al 100% de la ventana">
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<FitScreen sx={{ fontSize: '15px !important' }} />}
            onMouseDown={(event) => {
              event.preventDefault();
              handleFitWindow();
              handleDistributeCols();
            }}
            sx={{ minHeight: 26, py: 0.2, px: 1.25, textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
          >
            Ajustar al 100%
          </Button>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

        {/* Eliminar tabla completa */}
        <Tooltip title="Eliminar toda la tabla">
          <Button
            size="small"
            color="error"
            startIcon={<DeleteSweep sx={{ fontSize: '16px !important' }} />}
            onMouseDown={(event) => {
              event.preventDefault();
              const table = tableCellRef.current?.closest('table');
              if (table) {
                table.remove();
                emit();
                editorRef.current?.focus();
                readActiveFormats();
              }
            }}
            sx={{ minHeight: 26, py: 0.2, px: 1, textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
          >
            Eliminar tabla
          </Button>
        </Tooltip>
      </Stack>
    )}
    <Box
      ref={editorRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-invalid={error}
      onInput={() => { emit(); readActiveFormats(); }}
      onFocus={readActiveFormats}
      onMouseUp={readActiveFormats}
      onKeyUp={readActiveFormats}
      sx={{
        minHeight,
        px: 1.8,
        py: 1.35,
        overflowX: 'auto',
        outline: 'none',
        fontSize: 15,
        lineHeight: 1.6,
        color: '#1e293b',
        '&:empty::before': { content: '"Escriba aquí…"', color: '#94a3b8' },
        '& h2, & h3': { mt: 1, mb: 0.5, fontWeight: 800 },
        '& p': { my: 0.5 },
        '& blockquote': { my: 1, mx: 0, pl: 2, borderLeft: '4px solid #93b4dc', color: '#475569' },
        '& hr': { my: 1.25, border: 0, borderTop: '1px solid #b8c8da' },
        '& a': { color: '#1d5fd1', textDecoration: 'underline' },
        '& ul, & ol': { my: 0.5, pl: 3 },
        '& table': {
          width: '100%',
          maxWidth: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          my: 1,
          boxSizing: 'border-box'
        },
        '& th, & td': {
          border: '1px solid #94a3b8',
          p: 1,
          minWidth: 40,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          verticalAlign: 'top',
          boxSizing: 'border-box'
        },
        '& th': { bgcolor: '#eff6ff', fontWeight: 800 }
      }}
    />
    <Dialog open={linkDialog} onClose={() => setLinkDialog(false)} maxWidth="xs" fullWidth><DialogTitle fontWeight={900}>Insertar hipervínculo</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Dirección web o correo" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} helperText="Ejemplo: https://www.unicesmag.edu.co o mailto:correo@ejemplo.com" sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setLinkDialog(false)}>Cancelar</Button><Button variant="contained" onClick={insertLink}>Insertar enlace</Button></DialogActions></Dialog>
    <Dialog open={microphoneDialog} onClose={() => !requestingMicrophone && setMicrophoneDialog(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Mic color="primary" /> Activar dictado por voz
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#475569', lineHeight: 1.65, mb: 1.5 }}>
          Permita el acceso al micrófono para comenzar a redactar este apartado con su voz. El permiso se solicita directamente al navegador.
        </Typography>
        <Alert severity="info" sx={{ mb: microphonePermissionError ? 1.5 : 0 }}>
          Después de permitirlo, el dictado comenzará automáticamente. Puede detenerlo pulsando nuevamente el micrófono.
        </Alert>
        {microphonePermissionError && <Alert severity="warning">{microphonePermissionError}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button disabled={requestingMicrophone} onClick={() => setMicrophoneDialog(false)} sx={{ textTransform: 'none' }}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={requestingMicrophone}
          startIcon={requestingMicrophone ? <CircularProgress size={16} color="inherit" /> : <Mic />}
          onClick={requestMicrophoneAndStart}
          sx={{ textTransform: 'none', fontWeight: 850 }}
        >
          {microphonePermissionError ? 'Reintentar' : 'Permitir y comenzar'}
        </Button>
      </DialogActions>
    </Dialog>
  </Paper>;
}
