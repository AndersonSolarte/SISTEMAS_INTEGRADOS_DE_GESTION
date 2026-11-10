import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import UserDependencyAssignments, { dependencyAssignments } from './UserDependencyAssignments';

test('mantiene la asignación principal y precarga el jefe de una dependencia adicional', () => {
  const profile = { dependencia: 'Programa A', jefe_inmediato: 'Jefe A', vicerrectoria: 'Académica' };
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={profile} onChange={onChange} options={['Programa A', 'Programa B']}
    relations={[{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }]} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Dependencias asignadas' }));
  fireEvent.click(screen.getByRole('option', { name: 'Programa B' }));
  expect(onChange).toHaveBeenCalledWith({ ...profile, dependencias_asignadas: [{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }] });
});

test('no adivina el jefe si una dependencia tiene relaciones contradictorias', () => {
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={{}} onChange={onChange} options={['Programa A']}
    relations={[{ dependencia: 'Programa A', jefe_inmediato: 'Jefe A' }, { dependencia: 'Programa A', jefe_inmediato: 'Jefe B' }]} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Dependencias asignadas' }));
  fireEvent.click(screen.getByRole('option', { name: 'Programa A' }));
  expect(onChange.mock.calls[0][0].jefe_inmediato).toBe('');
});

test('al editar carga las dependencias y permite cambiar el jefe adicional', () => {
  const profile = { dependencia: 'Programa A', jefe_inmediato: 'Jefe A', dependencias_asignadas: [{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }] };
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={profile} onChange={onChange} options={['Programa A', 'Programa B']} bosses={['Jefe B', 'Jefe C']} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Jefe inmediato de la dependencia/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Jefe C' }));
  expect(onChange.mock.calls[0][0].dependencias_asignadas[0].jefe_inmediato).toBe('Jefe C');
  expect(dependencyAssignments(profile)).toHaveLength(2);
});

test('al quitar la dependencia principal promueve la siguiente junto con su jefe', () => {
  const profile = { dependencia: 'Programa A', jefe_inmediato: 'Jefe A', vicerrectoria: 'Académica', dependencias_asignadas: [{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }] };
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={profile} onChange={onChange} options={['Programa A', 'Programa B']} bosses={['Jefe B']} />);
  fireEvent.click(screen.getAllByTestId('CancelIcon')[0]);
  expect(onChange).toHaveBeenCalledWith({ ...profile, dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación', dependencias_asignadas: [] });
});
