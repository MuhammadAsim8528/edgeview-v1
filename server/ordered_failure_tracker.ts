export interface OrderedFailureDecision {
  paused: boolean;
  newlyPaused: boolean;
  streak: number;
  nextPosition: number;
}

/**
 * Converts concurrently completed boolean outcomes into a deterministic streak
 * evaluated in original queue order. A fast worker finishing position 8 before
 * position 1 cannot change the safety decision.
 */
export class OrderedFailureStreak {
  private readonly pending = new Map<number, boolean>();
  private nextPosition = 0;
  private streak = 0;
  private paused = false;
  private pauseTime = 0;

  constructor(private readonly threshold: number, private readonly cooldownMs = 5 * 60 * 1000) {
    if (!Number.isInteger(threshold) || threshold < 1) throw new Error('threshold must be a positive integer');
    if (!Number.isInteger(cooldownMs) || cooldownMs < 0) throw new Error('cooldownMs must be a non-negative integer');
  }

  record(position: number, isFailure: boolean): OrderedFailureDecision {
    if (!Number.isInteger(position) || position < 0) throw new Error('position must be a non-negative integer');
    
    // Check if cooldown has elapsed and auto-resume
    if (this.paused && Date.now() - this.pauseTime >= this.cooldownMs) {
      this.paused = false;
      this.streak = 0;
      this.pauseTime = 0;
    }
    
    if (this.paused || position < this.nextPosition || this.pending.has(position)) {
      return { paused: this.paused, newlyPaused: false, streak: this.streak, nextPosition: this.nextPosition };
    }

    this.pending.set(position, isFailure);
    let newlyPaused = false;
    while (!this.paused && this.pending.has(this.nextPosition)) {
      const failed = this.pending.get(this.nextPosition)!;
      this.pending.delete(this.nextPosition);
      this.streak = failed ? this.streak + 1 : 0;
      this.nextPosition++;
      if (this.streak >= this.threshold) {
        this.paused = true;
        this.pauseTime = Date.now();
        newlyPaused = true;
      }
    }

    return { paused: this.paused, newlyPaused, streak: this.streak, nextPosition: this.nextPosition };
  }

  /** Manually resume after a pause (e.g., after operator intervention). */
  resume(): void {
    this.paused = false;
    this.streak = 0;
    this.pauseTime = 0;
  }

  /** Check if currently paused and cooldown has elapsed. */
  isPaused(): boolean {
    if (this.paused && Date.now() - this.pauseTime >= this.cooldownMs) {
      this.paused = false;
      this.streak = 0;
      this.pauseTime = 0;
      return false;
    }
    return this.paused;
  }

  /** Get remaining cooldown time in ms, or 0 if not paused. */
  getRemainingCooldown(): number {
    if (!this.paused) return 0;
    return Math.max(0, this.cooldownMs - (Date.now() - this.pauseTime));
  }
}
