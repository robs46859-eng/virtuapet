// Business-event clock only. Never inject into authentication or payment validation.
export class SimulationClock {
  constructor({ start = '2026-09-21T08:00:00-06:00', multiplier = 60, now = Date.now } = {}) {
    this.simulated = Date.parse(start);
    if (!Number.isFinite(this.simulated) || !Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 1440) throw new Error('Invalid simulation clock');
    this.multiplier = multiplier;
    this.now = now;
    this.anchor = now();
    this.running = false;
  }
  snapshot() {
    const real = this.now();
    if (!Number.isFinite(real) || real < this.anchor) throw new Error('Invalid real clock');
    return { realAt: new Date(real).toISOString(), simulatedAt: new Date(this.simulated + (this.running ? (real - this.anchor) * this.multiplier : 0)).toISOString(), multiplier: this.multiplier, paused: !this.running };
  }
  pause() {
    const current = this.snapshot();
    this.simulated = Date.parse(current.simulatedAt);
    this.anchor = Date.parse(current.realAt);
    this.running = false;
    return this.snapshot();
  }
  resume() { this.pause(); this.running = true; return this.snapshot(); }
  advance(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 525600) throw new Error('Invalid time advance');
    if (this.running) throw new Error('Pause before explicit advancement');
    this.simulated += minutes * 60000;
    return this.snapshot();
  }
}
