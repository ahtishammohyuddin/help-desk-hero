// The office staff. Names and departments match characters in the problem bank.
// desk: their desk number, which is also their port number on the server room switch.

import { makeAlertMarker, makePerson, sitDown } from './people.js';

const SOUTH = 0;
const NORTH = Math.PI;

// Everyone sits at their own desk with a PC (pods at x -7 / 2, z -8.5 / -1.5; chairs 1.3 from the pod
// centre), or at the reception counter. facing: NORTH looks at a desk to the north, SOUTH to the south.
export const EMPLOYEES = [
  { name: 'Ahmed', desk: 1, gender: 'male', department: 'Accounts', x: -7.85, z: -7.2, facing: NORTH, shirt: 0x7d8c3c, hair: 0x2b1d14,
    line: "Hi! Everything's fine right now. I'll call you if my screen acts up again." },
  { name: 'Sana', desk: 4, gender: 'female', department: 'HR', x: 2.85, z: -7.2, facing: NORTH, shirt: 0xc4577a, hair: 0x1a1110,
    line: 'Oh hello! No problems today, touch wood. My keyboard has been behaving.' },
  { name: 'Imran', desk: 2, gender: 'male', department: 'Sales', x: -7.85, z: -0.2, facing: NORTH, shirt: 0x4f9a6b, hair: 0x3a2a1c,
    line: "All good here. Honestly I don't understand computers, so I'm glad you're around." },
  { name: 'Farah', desk: 5, gender: 'female', department: 'Finance', x: 2.85, z: -0.2, facing: NORTH, shirt: 0x8a63c4, hair: 0x23160f,
    line: "Month-end is coming, so please don't let anything break this week!" },
  { name: 'Usman', desk: 3, gender: 'male', department: 'Operations', x: 1.15, z: -2.8, facing: SOUTH, shirt: 0xd08a3a, hair: 0x15100c,
    line: 'All quiet at my desk today. Shout if you need a hand carrying anything.' },
  { name: 'Nida', desk: 6, gender: 'female', department: 'Accounts', x: -6.15, z: -9.8, facing: SOUTH, shirt: 0x3fa3a3, hair: 0x2a1a12,
    line: 'I print a lot of invoices. If that printer goes offline, you will hear from me.' },
  { name: 'Haroon', desk: 8, gender: 'male', department: 'Management', x: 44.2, z: -8, facing: -Math.PI / 2, shirt: 0x1f2a37, hair: 0x2a2a2a,
    line: 'Ah, the IT hero. Keep the office running and we will all be happy.' },
  { name: 'Saima', desk: 7, gender: 'female', department: 'Reception', x: 11.4, z: 8.6, facing: SOUTH, shirt: 0xb84a4a, hair: 0x1d1310,
    line: 'Welcome! Let me know if you need anything. I can never find where files save.' },
];

export function createEmployees(scene, colliders, labelLayer) {
  return EMPLOYEES.map((data) => {
    const group = makePerson({ shirt: data.shirt, hair: data.hair });
    group.position.set(data.x, 0, data.z);
    group.rotation.y = data.facing;
    sitDown(group); // seated on the chair at their desk
    scene.add(group);

    const marker = makeAlertMarker();
    marker.visible = false;
    marker.userData.baseY = 2.15 - group.position.y; // keep the "!" at the same height above the floor
    group.add(marker);

    // People are solid: the player walks around them, not through them.
    const collider = { minX: data.x - 0.3, maxX: data.x + 0.3, minZ: data.z - 0.3, maxZ: data.z + 0.3 };
    colliders.push(collider);

    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = `<div class="row">${data.name}</div>`; // main.js redraws it with the desk number
    label.hidden = true;
    labelLayer.appendChild(label);

    return { ...data, group, marker, label, collider };
  });
}
