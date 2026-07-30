import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/LoginParticles', () => () => null);

test('renders the SIAC initial loading screen', () => {
  render(<App />);
  expect(screen.getByText(/Inicializando sistema/i)).toBeInTheDocument();
});
