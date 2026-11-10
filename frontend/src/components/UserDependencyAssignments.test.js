import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserDependencyAssignments, { dependencyAssignments } from './UserDependencyAssignments';

test('permite borrar, escribir y seleccionar cargos independientes en todas las dependencias', () => {
  function Editor() {
    const [profile, setProfile] = React.useState({
      dependencia: 'Programa A', vicerrectoria: 'Académica', jefe_inmediato: 'Jefe A', cargo: 'Docente',
      dependencias_asignadas: ['Programa B', 'Programa C'].map((dependencia) => ({
        dependencia, vicerrectoria: 'Investigación', jefe_inmediato: 'Jefe B', cargo: 'Coordinador'
      }))
    });
    return <UserDependencyAssignments profile={profile} onChange={setProfile}
      options={['Programa A', 'Programa B', 'Programa C']} cargos={['Docente', 'Coordinador', 'Secretario']} />;
  }
  render(<Editor />);
  for (const index of [2, 3]) {
    const cargo = screen.getByRole('combobox', { name: `Cargo de la dependencia ${index}` });
    userEvent.clear(cargo);
    expect(cargo).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Agregar otra dependencia' })).toBeDisabled();
    userEvent.type(cargo, 'Nuevo cargo');
    expect(cargo).toHaveValue('Nuevo cargo');
    userEvent.clear(cargo);
    userEvent.type(cargo, 'Secre');
    userEvent.click(screen.getByRole('option', { name: 'Secretario' }));
    expect(cargo).toHaveValue('Secretario');
  }
  expect(screen.getByRole('combobox', { name: 'Cargo de la dependencia 1' })).toHaveValue('Docente');
  expect(screen.getByRole('button', { name: 'Agregar otra dependencia' })).toBeEnabled();
});

test('mantiene la asignación principal y precarga el jefe de una dependencia adicional', () => {
  const profile = { cargo: 'Docente', dependencia: 'Programa A', jefe_inmediato: 'Jefe A', vicerrectoria: 'Académica' };
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={profile} onChange={onChange} options={['Programa A', 'Programa B']}
    relations={[{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Agregar otra dependencia' }));
  const next = onChange.mock.calls[0][0];
  expect(next.dependencia).toBe('Programa A');
  expect(next.dependencias_asignadas).toEqual([{ dependencia: '', vicerrectoria: '', jefe_inmediato: '', cargo: '' }]);
});

test('precarga la vicerrectoría y el jefe al seleccionar una dependencia en su bloque', () => {
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={{}} onChange={onChange} options={['Programa B']}
    relations={[{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }]} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /^Dependencia 1/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Programa B' }));
  expect(onChange).toHaveBeenCalledWith({ cargo: '', dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación', dependencias_asignadas: [] });
});

test('no adivina el jefe si una dependencia tiene relaciones contradictorias', () => {
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={{}} onChange={onChange} options={['Programa A']}
    relations={[{ dependencia: 'Programa A', jefe_inmediato: 'Jefe A' }, { dependencia: 'Programa A', jefe_inmediato: 'Jefe B' }]} />);
  expect(screen.getByRole('button', { name: 'Agregar otra dependencia' })).toBeDisabled();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /^Dependencia 1/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Programa A' }));
  expect(onChange.mock.calls[0][0].jefe_inmediato).toBe('');
});

test('al editar carga las dependencias y permite cambiar el jefe adicional', () => {
  const profile = { cargo: 'Docente', dependencia: 'Programa A', jefe_inmediato: 'Jefe A', dependencias_asignadas: [{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }] };
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={profile} onChange={onChange} options={['Programa A', 'Programa B']} bosses={['Jefe B', 'Jefe C']} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Jefe inmediato de la dependencia 2/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Jefe C' }));
  expect(onChange.mock.calls[0][0].dependencias_asignadas[0].jefe_inmediato).toBe('Jefe C');
  expect(dependencyAssignments(profile)).toHaveLength(2);
});

test('al quitar la dependencia principal promueve la siguiente junto con su jefe', () => {
  const profile = { cargo: 'Docente', dependencia: 'Programa A', jefe_inmediato: 'Jefe A', vicerrectoria: 'Académica', dependencias_asignadas: [{ dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación' }] };
  const onChange = jest.fn();
  render(<UserDependencyAssignments profile={profile} onChange={onChange} options={['Programa A', 'Programa B']} bosses={['Jefe B']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Quitar dependencia 1' }));
  expect(onChange).toHaveBeenCalledWith({ ...profile, dependencia: 'Programa B', jefe_inmediato: 'Jefe B', vicerrectoria: 'Investigación', dependencias_asignadas: [] });
});

test('configura los bloques de forma secuencial sin mezclar los cargos ni los jefes', () => {
  function Editor() {
    const [profile, setProfile] = React.useState({ dependencia: 'Programa A', vicerrectoria: 'Académica', jefe_inmediato: 'Jefe A', cargo: 'Docente' });
    return <UserDependencyAssignments profile={profile} onChange={setProfile} options={['Programa A', 'Programa B']}
      relations={[{ dependencia: 'Programa B', vicerrectoria: 'Investigación', jefe_inmediato: 'Jefe B' }]} />;
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: 'Agregar otra dependencia' }));
  expect(screen.getByRole('button', { name: 'Agregar otra dependencia' })).toBeDisabled();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /^Dependencia 2/ }));
  expect(screen.queryByRole('option', { name: 'Programa A' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: 'Programa B' }));
  fireEvent.change(screen.getByRole('combobox', { name: /Cargo de la dependencia 2/ }), { target: { value: 'Coordinador' } });
  expect(screen.getByRole('combobox', { name: /Cargo de la dependencia 1/ })).toHaveValue('Docente');
  expect(screen.getByRole('combobox', { name: /Jefe inmediato de la dependencia 1/ })).toHaveValue('Jefe A');
  expect(screen.getByRole('combobox', { name: /Jefe inmediato de la dependencia 2/ })).toHaveValue('Jefe B');
  expect(screen.getByRole('combobox', { name: /Vicerrectoría de la dependencia 2/ })).toHaveValue('Investigación');
  expect(screen.getByRole('button', { name: 'Agregar otra dependencia' })).toBeEnabled();
});
