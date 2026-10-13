// The office staff. Names and departments match characters in the problem bank.
// In Phase 4 the ticket system will pick who needs help; for now one person
// shows the "!" marker as a preview.

import { makeAlertMarker, makePerson } from './people.js';

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const SOUTH = 0;
const NORTH = Math.PI;

export const EMPLOYEES = [
  { name: 'Ahmed', department: 'Accounts', x: -9.1, z: -8.0, facing: EAST, shirt: 0x7d8c3c, hair: 0x2b1d14,
    line: "Hi! Everything's fine right now. I'll call you if my screen acts up again." },
  { name: 'Sana', department: 'HR', x: 4.1, z: -9.0, facing: WEST, shirt: 0xc4577a, hair: 0x1a1110,
    line: 'Oh hello! No problems today, touch wood. My keyboard has been behaving.' },
  { name: 'Imran', department: 'Sales', x: -9.1, z: -1.0, facing: EAST, shirt: 0x4f9a6b, hair: 0x3a2a1c,
    line: "All good here. Honestly I don't understand computers, so I'm glad you're around." },
  { name: 'Farah', department: 'Finance', x: 4.1, z: -2.0, facing: WEST, shirt: 0x8a63c4, hair: 0x23160f,
    line: "Month-end is coming, so please don't let anything break this week!" },
  { name: 'Usman', department: 'Operations', x: -2.5, z: -5.0, facing: SOUTH, shirt: 0xd08a3a, hair: 0x15100c,
    line: 'Someone moved the desks around again. Nothing broken yet though.' },
  { name: 'Nida', department: 'Accounts', x: -15.5, z: -10.5, facing: NORTH, shirt: 0x3fa3a3, hair: 0x2a1a12,
    line: 'I print a lot of invoices. If this printer goes offline, you will hear from me.' },
  { name: 'Saima', department: 'Reception', x: 13.3, z: 8.6, facing: SOUTH, shirt: 0xb84a4a, hair: 0x1d1310,
    line: 'Welcome! Let me know if you need anything. I can never find where files save.' },
];

export function createEmployees(scene, colliders, labelLayer) {
  return EMPLOYEES.map((data) => {
    const group = makePerson({ shirt: data.shirt, hair: data.hair });
    group.position.set(data.x, 0, data.z);
    group.rotation.y = data.facing;
    scene.add(group);

    const marker = makeAlertMarker();
    marker.visible = false;
    group.add(marker);

    // People are solid: the player walks around them, not through them.
    colliders.push({ minX: data.x - 0.3, maxX: data.x + 0.3, minZ: data.z - 0.3, maxZ: data.z + 0.3 });

    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = `${data.name}<small>${data.department}</small>`;
    label.hidden = true;
    labelLayer.appendChild(label);

    return { ...data, group, marker, label };
  });
}
