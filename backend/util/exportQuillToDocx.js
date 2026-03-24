const MAX_CAPACITY = 200 * 1024 * 1024; // 200 MB total
let currentUsage = 0;
const MEMORY_MULTIPLIER = 3;

export function estimateSize(sections) {
  const htmlBytes = sections.reduce(
    (acc, s) => acc + (s.content?.data?.length ?? 0),
    0,
  );
  return Math.max(htmlBytes * 4, 512 * 1024);
}

export function getEffectiveSize(size) {
  return size * MEMORY_MULTIPLIER;
}

export function canAccept(effectiveSize) {
  return currentUsage + effectiveSize <= MAX_CAPACITY;
}

export function acquire(effectiveSize) {
  currentUsage += effectiveSize;
}

export function release(effectiveSize) {
  currentUsage = Math.max(0, currentUsage - effectiveSize);
}
