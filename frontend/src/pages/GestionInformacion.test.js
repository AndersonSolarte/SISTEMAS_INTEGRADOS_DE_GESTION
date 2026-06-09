import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GestionInformacion from './GestionInformacion';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      role: 'ADMINISTRADOR',
      allowedModules: ['infraestructura_fisica']
    }
  })
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: jest.fn()
  })
}));

test('renders GestionInformacion without crashing', () => {
  render(
    <MemoryRouter initialEntries={['/dashboard/gestion-informacion?tab=estadistica']}>
      <GestionInformacion />
    </MemoryRouter>
  );
});
