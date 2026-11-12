import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityTableText from './ActivityTableText';
import { activityColumnWidth } from '../utils/activityTableLayout';

test('long cells show a compact preview and preserve all text in an accessible detail dialog', () => {
  const text = 'A-018 Desplegar Planes de Acción Anual de Bienestar, Permanencia, Inclusión y Graduación. '.repeat(5);
  render(<ActivityTableText value={text} label="Macroactividad" />);
  expect(screen.getByText(text.trim())).toHaveStyle({ overflow: 'hidden', display: '-webkit-box' });
  fireEvent.click(screen.getByRole('button', { name: 'Ver completo: Macroactividad' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Macroactividad' }));
  expect(dialog.getByText(text.trim())).toBeInTheDocument();
  expect(dialog.getByText(text.trim())).toHaveStyle({ whiteSpace: 'pre-wrap' });
  fireEvent.click(dialog.getByRole('button', { name: 'Cerrar' }));
});

test('short and empty cells do not add unnecessary controls', () => {
  render(<><ActivityTableText value="Texto breve" /><ActivityTableText value={null} /></>);
  expect(screen.getByText('Texto breve')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('text columns have sufficient widths instead of squeezing a macroactivity into a narrow column', () => {
  expect(activityColumnWidth({ key: 'macroactividad', label: 'Macroactividad' })).toBe(360);
  expect(activityColumnWidth({ key: 'activity', label: 'Actividad' })).toBe(360);
  expect(activityColumnWidth({ key: 'indicadores_metas' })).toBe(380);
  expect(activityColumnWidth({ key: 'strategic_objective' })).toBe(320);
  expect(activityColumnWidth({ key: 'starts_on' })).toBe(150);
});
