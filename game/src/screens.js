// Pictures on the lounge TV and the meeting room projector, drawn on canvases.
// The TV plays a simple animated "video" while someone watches; the projector shows slides in meetings.

const SLIDES = [
  { title: 'Quarterly review', kind: 'bars' },
  { title: 'Ticket trends', kind: 'line' },
  { title: 'Next steps', kind: 'list' },
];

function idle(ctx, w, h, text) {
  ctx.fillStyle = '#05080b';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1b2533';
  ctx.font = `700 ${Math.round(h * 0.12)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + h * 0.04);
}

/** The lounge TV: a calm animated landscape "video" while someone watches, otherwise standby. */
export function drawTv(screen, t, on, fault = false) {
  const { ctx, canvas } = screen;
  const w = canvas.width;
  const h = canvas.height;
  if (fault) {
    idle(ctx, w, h, '');
    ctx.fillStyle = '#e5484d';
    ctx.font = `700 ${Math.round(h * 0.1)}px system-ui, sans-serif`;
    ctx.fillText('No internet connection', w / 2, h / 2);
  } else if (!on) {
    idle(ctx, w, h, 'Standby');
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const shift = (Math.sin(t * 0.1) + 1) / 2;
    sky.addColorStop(0, `hsl(${200 + shift * 30}, 70%, ${55 + shift * 10}%)`);
    sky.addColorStop(1, '#ffd9a0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // drifting clouds
    for (let i = 0; i < 3; i++) {
      const x = ((t * 12 + i * 110) % (w + 80)) - 40;
      ctx.beginPath();
      ctx.ellipse(x, 20 + i * 12, 26, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3d8b5a'; // rolling hills
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.72 + Math.sin(x / 30 + t * 0.6) * 6);
    ctx.lineTo(w, h);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'; // progress bar, like a video player
    ctx.fillRect(8, h - 10, w - 16, 4);
    ctx.fillStyle = '#e5484d';
    ctx.fillRect(8, h - 10, ((t % 60) / 60) * (w - 16), 4);
  }
  screen.texture.needsUpdate = true;
}

/** The meeting room projector: slides that change every few seconds during a meeting. */
export function drawSlides(screen, t, on, fault = false) {
  const { ctx, canvas } = screen;
  const w = canvas.width;
  const h = canvas.height;
  if (fault) {
    ctx.fillStyle = '#1d3f8f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(h * 0.11)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('No signal', w / 2, h / 2);
    screen.texture.needsUpdate = true;
    return;
  }
  if (!on) {
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, w, h);
    screen.texture.needsUpdate = true;
    return;
  }
  const slide = SLIDES[Math.floor(t / 6) % SLIDES.length];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f2a37';
  ctx.fillRect(0, 0, w, h * 0.2);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(h * 0.11)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(slide.title, 12, h * 0.14);
  const top = h * 0.3;
  const bottom = h * 0.9;
  if (slide.kind === 'bars') {
    const vals = [0.5, 0.7, 0.6, 0.9];
    vals.forEach((v, i) => {
      ctx.fillStyle = ['#2f6feb', '#33d17a', '#ffb02e', '#6c4fd1'][i];
      const bh = (bottom - top) * v;
      ctx.fillRect(30 + i * 52, bottom - bh, 34, bh);
    });
  } else if (slide.kind === 'line') {
    ctx.strokeStyle = '#2f6feb';
    ctx.lineWidth = 4;
    ctx.beginPath();
    [0.8, 0.6, 0.65, 0.4, 0.3].forEach((v, i) => {
      const x = 24 + i * 50;
      const y = top + (bottom - top) * v;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1f2a37';
    ctx.font = `${Math.round(h * 0.08)}px system-ui, sans-serif`;
    ['• Faster first response', '• Fewer repeat tickets', '• New starter kits ready'].forEach((line, i) => ctx.fillText(line, 16, top + 12 + i * h * 0.17));
  }
  screen.texture.needsUpdate = true;
}
