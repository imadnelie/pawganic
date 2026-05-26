/** Dev-only logging for order export/share debugging. */
export function shareDebug(label, value) {
  if (!import.meta.env.DEV) return;
  if (value === undefined) {
    console.log(`[share] ${label}`);
    return;
  }
  console.log(`[share] ${label}:`, value);
}
