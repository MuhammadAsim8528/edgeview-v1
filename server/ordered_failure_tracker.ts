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

  constructor(private readonly threshold: number) {
    if (!Number.isInteger(threshold) || threshold < 1) throw new Error('threshold must be a positive integer');
  }

  record(position: number, isFailure: boolean): OrderedFailureDecision {
    if (!Number.isInteger(position) || position < 0) throw new Error('position must be a non-negative integer');
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
        newlyPaused = true;
      }
    }

    return { paused: this.paused, newlyPaused, streak: this.streak, nextPosition: this.nextPosition };
  }
}
