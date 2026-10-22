import { resolveFormSession } from './formSessionGuard';

describe('sesion del formulario de reporte de salida', () => {
  test('inicializa al abrir el formulario', () => {
    const result = resolveFormSession(false, true);

    expect(result.shouldInitialize).toBe(true);
    expect(result.nextSession).toBe(true);
  });

  test('conserva el borrador ante cualquier actualizacion mientras sigue abierto', () => {
    const result = resolveFormSession(true, true);

    expect(result.shouldInitialize).toBe(false);
    expect(result.nextSession).toBe(true);
  });

  test('vuelve a inicializar solamente despues de cerrar', () => {
    const closed = resolveFormSession(true, false);
    expect(closed.shouldInitialize).toBe(false);
    expect(closed.nextSession).toBe(false);

    const reopened = resolveFormSession(closed.nextSession, true);
    expect(reopened.shouldInitialize).toBe(true);
  });
});
