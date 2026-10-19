import { OrderedFailureStreak } from '../ordered_failure_tracker';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Ordered failure tracker test failed: ${message}`);
}

// Nine failures must pause regardless of completion order, but only once all
// earlier queue positions are known.
const shuffled = new OrderedFailureStreak(9);
for (const position of [4, 2, 7, 1, 8, 5, 3, 6]) {
  const decision = shuffled.record(position, true);
  assert(!decision.paused, `must not pause while queue position 0 is unresolved (position ${position})`);
}
const ninth = shuffled.record(0, true);
assert(ninth.paused && ninth.newlyPaused, 'must pause after the ordered streak reaches nine');
assert(ninth.streak === 9, 'ordered streak must equal nine');

// A non-transport outcome in queue order resets the streak even if later
// failures happened to finish first in wall-clock time.
const reset = new OrderedFailureStreak(9);
for (const position of [12, 11, 10, 9, 8, 7, 6, 5]) reset.record(position, true);
for (let position = 0; position < 4; position++) reset.record(position, true);
const success = reset.record(4, false);
assert(!success.paused && success.streak === 8, 'queue-order success must reset the earlier streak before buffered later failures are consumed');
const afterReset = reset.record(13, true);
assert(afterReset.streak === 9 && afterReset.paused, 'the ninth failure after the reset must pause deterministically');

// Duplicate/late completions cannot alter a settled decision.
const duplicate = afterReset;
const duplicateDecision = reset.record(13, false);
assert(duplicateDecision.paused === duplicate.paused && duplicateDecision.streak === duplicate.streak, 'duplicate completion must be ignored');

console.log('PASS ordered transport-failure streak is deterministic under concurrent completion');
