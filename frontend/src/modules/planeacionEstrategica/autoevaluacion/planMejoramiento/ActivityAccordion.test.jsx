import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivityAccordion from './ActivityAccordion';

test('keeps activity form values when collapsed and reopened', () => {
  function Example() {
    const [expanded, setExpanded] = useState(true);
    return <ActivityAccordion number={1} name="Generar informes" expanded={expanded} onToggle={() => setExpanded(!expanded)}><input aria-label="Descripción" defaultValue="" /></ActivityAccordion>;
  }
  render(<Example />);
  const header = screen.getByRole('button', { name: /Actividad 1 Generar informes/ });
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Cambios pendientes' } });
  fireEvent.click(header);
  expect(header.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(header);
  expect(header.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByLabelText('Descripción').value).toBe('Cambios pendientes');
});

test('removing an activity does not toggle its accordion', () => {
  const onToggle = jest.fn();
  const onRemove = jest.fn();
  render(<ActivityAccordion number={2} name="Revisar" expanded={false} onToggle={onToggle} onRemove={onRemove}>Contenido</ActivityAccordion>);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar actividad 2' }));
  expect(onRemove).toHaveBeenCalledTimes(1);
  expect(onToggle).not.toHaveBeenCalled();
});
