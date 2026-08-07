/** Light, hue-rotated pastel per chip so several chips in the same window stay distinguishable without drowning out the (black) GDS pattern drawn on top. */
export function chipFillColor(index: number): string {
  const hue = (index * 47) % 360;
  return `hsl(${hue}, 55%, 94%)`;
}
