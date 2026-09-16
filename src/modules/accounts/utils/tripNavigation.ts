/** Bounded navigation: the selected trip never wraps or leaves the list. */
export function getTripNavigationIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  const current = Math.max(0, Math.min(index, count - 1));
  switch (key) {
    case 'ArrowUp': case 'ArrowLeft': return Math.max(0, current - 1);
    case 'ArrowDown': case 'ArrowRight': return Math.min(count - 1, current + 1);
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}
