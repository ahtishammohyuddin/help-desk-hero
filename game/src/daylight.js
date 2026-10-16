// Daylight that follows the shift clock (9 AM to 5 PM): the sun moves from east to west,
// is whitest around midday and turns warm in the late afternoon. Pure logic, tested with Node.

const START_HOUR = 9;
const END_HOUR = 17;

function mix(a, b, t) {
  const ch = (c, s) => (c >> s) & 255;
  const lerp = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

/**
 * Light for a moment in the shift. fraction: 0 at 9 AM, 1 at 5 PM.
 * Returns the sun's position, colour and strength, the sky light, the background, and the window glow.
 */
export function daylight(fraction) {
  const f = Math.min(Math.max(fraction, 0), 1);
  const hour = START_HOUR + f * (END_HOUR - START_HOUR);
  const arc = ((hour - 6) / 12) * Math.PI; // sunrise at 6 AM (0), sunset at 6 PM (pi)
  const height = Math.sin(arc); // 1 at noon
  const warmth = Math.max(0, 1 - height) ** 1.6; // warm low sun, mostly late in the day
  return {
    hour,
    sun: { x: 8 + Math.cos(arc) * 30, y: 6 + height * 20, z: 10 }, // east (+x) in the morning, west in the evening
    sunColor: mix(0xfff6e8, 0xffb36b, warmth),
    sunIntensity: 2.2 * (0.6 + 0.4 * height),
    skyIntensity: 1.4 * (0.82 + 0.18 * height),
    background: mix(0xdfe6ec, 0xeed8c2, warmth),
    windowGlow: mix(0xcfe9ff, 0xffc58a, warmth),
  };
}
