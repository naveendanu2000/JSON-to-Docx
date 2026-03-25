// capacityStore.js
// Single source of truth for the weighted capacity pool.
// Imported by both exportQuillToDocx.js and worker.js so they share state.

const MAX_CAPACITY = 200 * 1024 * 1024; // 200 MB total
const MEMORY_MULTIPLIER = 3;
const SMALL_FILE_THRESHOLD = 20 * 1024 * 1024; // 20 MB

let currentUsage = 0;

export function estimateSize(sections) {
  const htmlBytes = sections.reduce(
    (acc, s) => acc + (s.content?.data?.length ?? 0),
    0,
  );
  return Math.max(htmlBytes * 4, 512 * 1024); // minimum 512 KB
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

export function isSmallFile(estimatedSize) {
  return estimatedSize < SMALL_FILE_THRESHOLD;
}
