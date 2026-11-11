const test = require('node:test');
const assert = require('node:assert/strict');
const { backupRetryDecision, RETRY_DELAY_MS } = require('./backupRetryPolicy');

const now = new Date('2026-11-11T23:30:00Z');
const failed = (minutesAgo) => ({ status: 'failed', finished_at: new Date(now.getTime() - minutesAgo * 60000) });

test('inicia el primer respaldo y espera quince minutos despues de un fallo', () => {
  assert.equal(backupRetryDecision([], now), 'run');
  assert.equal(backupRetryDecision([failed(14)], now), 'waiting');
  assert.equal(backupRetryDecision([failed(15)], now), 'run');
  assert.equal(RETRY_DELAY_MS, 900000);
});

test('usa el fallo mas reciente aun si el historial llega desordenado', () => {
  assert.equal(backupRetryDecision([failed(1), failed(30)], now), 'waiting');
  assert.equal(backupRetryDecision([failed(30), failed(16)], now), 'run');
});

test('evita duplicados, detiene reintentos al completar y limita a tres intentos', () => {
  assert.equal(backupRetryDecision([failed(30), { status: 'running' }], now), 'running');
  assert.equal(backupRetryDecision([{ status: 'queued' }], now), 'running');
  assert.equal(backupRetryDecision([failed(30), { status: 'completed' }], now), 'completed');
  assert.equal(backupRetryDecision([failed(60), failed(40), failed(20)], now), 'exhausted');
});

test('un reinicio conserva la espera desde finished_at y fechas invalidas no disparan una tormenta', () => {
  const persisted = JSON.parse(JSON.stringify([failed(16)]));
  assert.equal(backupRetryDecision(persisted, now), 'run');
  assert.equal(backupRetryDecision([{ status: 'failed', started_at: new Date(now.getTime() - 60000) }], now), 'waiting');
  assert.equal(backupRetryDecision([{ status: 'failed' }], now), 'waiting');
});
