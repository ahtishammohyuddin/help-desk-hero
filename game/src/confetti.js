// A short confetti burst on a full-screen canvas. No libraries.
// Skipped for players who ask their system for reduced motion.

const COLORS = ['#ffd43b', '#69db7c', '#4dabf7', '#845ef7', '#ff8787', '#ffa94d'];

export function confetti({ count = 160, duration = 2600 } = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const pieces = Array.from({ length: count }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.3,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 4,
    size: 5 + Math.random() * 6,
    spin: Math.random() * Math.PI,
    spinSpeed: (Math.random() - 0.5) * 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  const start = performance.now();
  function draw(now) {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.max(0, 1 - t / duration);
    for (const p of pieces) {
      p.vy += 0.35; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.spinSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(draw);
    else canvas.remove();
  }
  requestAnimationFrame(draw);
}
