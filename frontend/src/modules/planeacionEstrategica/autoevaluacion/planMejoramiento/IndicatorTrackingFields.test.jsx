import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import IndicatorTrackingFields from './IndicatorTrackingFields';
import { trackingProgress } from './indicatorTracking';
test('restores the repository URL with copy and direct preview actions for each indicator', () => {
  const onCopy = jest.fn();
  const onPreview = jest.fn();
  const evidence = { nombre: 'resultado.pdf', driveFileId: 'result-file', carpetaUrl: 'https://drive.google.com/drive/folders/actividad', indicatorFolderUrl: 'https://drive.google.com/drive/folders/resultados' };
  render(<IndicatorTrackingFields activity={{ indicadorResultadoActivo: true, indicadorResultado: 'Informe', seguimientoIndicadores: { Resultado: { evidencias: [evidence] } } }} onCopy={onCopy} onPreview={onPreview} />);
  expect(screen.getByLabelText('Enlace de evidencias de resultado').value).toBe(evidence.indicatorFolderUrl);
  fireEvent.click(screen.getByRole('button', { name: 'Copiar URL de resultado' }));
  expect(onCopy).toHaveBeenCalledWith(evidence.indicatorFolderUrl);
  fireEvent.click(screen.getByRole('button', { name: 'Previsualizar evidencias de resultado' }));
  expect(onPreview).toHaveBeenCalledWith(evidence, 'Resultado');
});
test('shows separate indicator lanes, evidence and progress without unused indicators', () => {
  const onRegister = jest.fn();
  const activity = { indicadorResultadoActivo: true, indicadorResultado: 'Entregar informe', metaResultado: 'Un informe', indicadorLogroActivo: true, indicadorLogro: 'Aplicar ajustes', indicadorImpactoActivo: false,
    seguimientoIndicadores: { Resultado: { porcentaje: 100, evidencias: [{ nombre: 'informe.pdf' }] } } };
  render(<IndicatorTrackingFields activity={activity} onRegister={onRegister} onChange={jest.fn()} onUpload={jest.fn()} onPreview={jest.fn()} />);
  expect(screen.getByText('Entregar informe')).toBeTruthy();
  expect(screen.getByText('Aplicar ajustes')).toBeTruthy();
  expect(screen.queryByText('Impacto')).toBeNull();
  expect(trackingProgress(activity)).toBe(50);
  expect(screen.getByText('Evidencia de resultado · informe.pdf')).toBeTruthy();
  fireEvent.click(screen.getAllByText('Registrar corte')[0]);
  expect(onRegister).toHaveBeenCalledWith('Resultado');
});
