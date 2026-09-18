import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationClock } from './clock.mjs';
test('60x business time does not alter real time and pause freezes it', () => {
  let real = Date.parse('2026-09-18T12:00:00Z');
  const c = new SimulationClock({ now: () => real });
  const start = Date.parse(c.snapshot().simulatedAt);
  c.resume(); real += 60000;
  assert.equal(Date.parse(c.snapshot().simulatedAt) - start, 3600000);
  assert.equal(Date.parse(c.snapshot().realAt), real);
  c.pause(); real += 60000;
  assert.equal(Date.parse(c.snapshot().simulatedAt) - start, 3600000);
  c.advance(1440);
  assert.equal(Date.parse(c.snapshot().simulatedAt) - start, 90000000);
});
test('rejects backward time, invalid speed and concurrent explicit advancement', () => {
  assert.throws(() => new SimulationClock({ multiplier: Infinity }));
  const c = new SimulationClock();
  assert.throws(() => c.advance(-1));
  c.resume(); assert.throws(() => c.advance(1));
});
