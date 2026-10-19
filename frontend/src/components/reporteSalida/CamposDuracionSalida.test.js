import { normalizeTimeString, timeToMinutes } from './CamposDuracionSalida';

describe('campos de hora del reporte de salida', () => {
  test('descarta texto ajeno pegado después de una hora', () => {
    expect(normalizeTimeString('12:00 pmcd /var/www/SISTEMAS_INTEGRADOS_DE_GESTION ./deploy.sh')).toBe('');
    expect(timeToMinutes('12:00 pmcd /var/www/SISTEMAS_INTEGRADOS_DE_GESTION ./deploy.sh')).toBeNull();
  });

  test('normaliza horas válidas y rechaza minutos fuera de rango', () => {
    expect(normalizeTimeString('12:00 pm')).toBe('12:00');
    expect(normalizeTimeString('730 am')).toBe('07:30');
    expect(normalizeTimeString('1299')).toBe('');
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});
