/** Light, hue-rotated pastel per chip so several chips in the same window stay distinguishable without drowning out the (black) GDS pattern drawn on top. */
export function chipFillColor(index: number): string {
  const hue = (index * 47) % 360;
  return `hsl(${hue}, 55%, 94%)`;
}

/** Same hue rotation as chipFillColor, but saturated and mid-lightness instead of pale — this one is for thin outline strokes and small text labels, which need to actually read as a color rather than sit under something else. */
export function jobAccentColor(index: number): string {
  const hue = (index * 47) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}
