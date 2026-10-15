// Small map in the corner. Walls and furniture in grey, you as a blue arrow,
// and anyone who needs help as a dot in their priority colour (urgent ones pulse).
// The map turns with the camera, so "up" on the map is the way W walks you.

import { PRIORITIES } from './tickets.js';

export class Minimap {
  constructor(canvas, bounds, colliders) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bounds = bounds;
    this.colliders = colliders;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.size = { w: canvas.clientWidth || 200, h: canvas.clientHeight || 200 };
    canvas.width = this.size.w * ratio;
    canvas.height = this.size.h * ratio;
    this.ctx.scale(ratio, ratio);
  }

  /**
   * people: employees ({ x, z, name }); ticketFor(name) returns their open ticket or null.
   * targets: places a physical fix is waiting at ({ x, z }), drawn as blue squares.
   * Furniture colliders include the people themselves, so only boxes bigger than a person are drawn.
   */
  draw({ player, playerAngle, cameraYaw, people, ticketFor, targets = [], time }) {
    const { ctx, bounds } = this;
    const { w, h } = this.size;
    const officeW = bounds.maxX - bounds.minX;
    const officeD = bounds.maxZ - bounds.minZ;
    // Fit the whole office inside the round map whatever its rotation.
    const scale = (Math.min(w, h) - 8) / Math.hypot(officeW, officeD);
    const px = 1 / scale; // one screen pixel in world units, so dots stay a readable size

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#eef2f6';
    ctx.fillRect(0, 0, w, h);

    // World to map: centre on the office, rotate so the camera's forward direction points up.
    ctx.translate(w / 2, h / 2);
    ctx.rotate(cameraYaw);
    ctx.scale(scale, scale);
    ctx.translate(-(bounds.minX + officeW / 2), -(bounds.minZ + officeD / 2));

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#9aa7b4';
    ctx.lineWidth = 1.5 * px;
    ctx.fillRect(bounds.minX, bounds.minZ, officeW, officeD);
    ctx.strokeRect(bounds.minX, bounds.minZ, officeW, officeD);

    ctx.fillStyle = '#b7c2cd';
    for (const b of this.colliders) {
      const bw = b.maxX - b.minX;
      const bd = b.maxZ - b.minZ;
      if (bw * bd < 0.5) continue; // skip people and tiny objects
      ctx.fillRect(b.minX, b.minZ, bw, bd);
    }

    // Everyone in the office: small grey dots. People with a ticket: big coloured dots.
    for (const person of people) {
      const ticket = ticketFor(person.name);
      if (!ticket) {
        dot(ctx, person.x, person.z, 3 * px, '#8a97a5');
        continue;
      }
      const color = PRIORITIES[ticket.priority].color;
      if (ticket.priority === 'P1' || ticket.secondsLeft <= 0) {
        const pulse = (9 + 5 * (0.5 + 0.5 * Math.sin(time * 6))) * px;
        ctx.globalAlpha = 0.35;
        dot(ctx, person.x, person.z, pulse, color);
        ctx.globalAlpha = 1;
      }
      dot(ctx, person.x, person.z, 6.5 * px, color, '#ffffff', 2 * px);
    }

    // Places to go for a physical fix: pulsing blue squares.
    for (const t of targets) {
      const r = (7 + 2 * (0.5 + 0.5 * Math.sin(time * 5))) * px;
      ctx.fillStyle = '#2f6feb';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * px;
      ctx.fillRect(t.x - r, t.z - r, r * 2, r * 2);
      ctx.strokeRect(t.x - r, t.z - r, r * 2, r * 2);
    }

    // You: a blue arrow pointing the way you face.
    ctx.save();
    ctx.translate(player.x, player.z);
    ctx.rotate(-playerAngle);
    ctx.scale(px, px); // draw the arrow in screen pixels
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(6.5, -6);
    ctx.lineTo(0, -2.5);
    ctx.lineTo(-6.5, -6);
    ctx.closePath();
    ctx.fillStyle = '#2f6feb';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function dot(ctx, x, z, r, fill, stroke, width = 0) {
  ctx.beginPath();
  ctx.arc(x, z, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
