import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button, Chip } from '@mui/material';
import { ThemeProvider, getContrastRatio } from '@mui/material/styles';
import theme from './index';

test('Los estados verdes y las confirmaciones tienen texto blanco legible', () => {
  render(
    <ThemeProvider theme={theme}>
      <Chip color="success" label="VIGENTE" />
      <Button variant="contained" color="success">Cerrar y continuar</Button>
      <Button variant="outlined" color="success">Consultar</Button>
    </ThemeProvider>
  );
  // Chip's label inherits its color from the root element.
  // eslint-disable-next-line testing-library/no-node-access
  expect(screen.getByText('VIGENTE', { selector: '.MuiChip-label' }).parentElement).toHaveStyle({ color: '#fff' });
  // MUI 7 uses CSS variables for button colors; JSDOM does not resolve var().
  expect(getComputedStyle(screen.getByRole('button', { name: 'Cerrar y continuar' })).getPropertyValue('--variant-containedColor')).toBe('#fff');
  expect(getComputedStyle(screen.getByRole('button', { name: 'Consultar' })).getPropertyValue('--variant-outlinedColor')).toBe(theme.palette.success.main);
  expect(getContrastRatio(theme.palette.success.main, '#fff')).toBeGreaterThanOrEqual(4.5);
  expect(getContrastRatio(theme.palette.success.dark, '#fff')).toBeGreaterThanOrEqual(4.5);
});
