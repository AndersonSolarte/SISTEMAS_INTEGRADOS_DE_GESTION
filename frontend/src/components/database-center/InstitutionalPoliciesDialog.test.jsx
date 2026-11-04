import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InstitutionalPoliciesDialog from './InstitutionalPoliciesDialog';
import institutionalPolicyService from '../../services/institutionalPolicyService';
jest.mock('../../services/institutionalPolicyService', () => ({ list: jest.fn() }));

test('consults the central catalog and filters policies with their own lines', async () => {
  institutionalPolicyService.list.mockResolvedValue([
    { id: 1, name: 'Política de Calidad', actionLines: ['Mejora continua'] },
    { id: 2, name: 'Política de Bienestar', actionLines: ['Atención integral'] }
  ]);
  render(<InstitutionalPoliciesDialog open onClose={jest.fn()} />);
  expect(await screen.findByText('Mejora continua')).toBeInTheDocument();
  expect(screen.getByText('Atención integral')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar política o línea de acción' }), { target: { value: 'Bienestar' } });
  expect(screen.getByText('Atención integral')).toBeInTheDocument();
  expect(screen.queryByText('Mejora continua')).not.toBeInTheDocument();
  expect(institutionalPolicyService.list).toHaveBeenCalledTimes(1);
});
