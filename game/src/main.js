// Entry point: sets up Three.js, builds the office, and runs the game loop.

import * as THREE from 'three';
import { FollowCamera } from './camera.js';
import { createEmployees } from './employees.js';
import { Input } from './input.js';
import { nearestWithin } from './logic.js';
import { buildOffice, PLAYER_START } from './office.js';
import { createPlayer } from './player.js';

const TALK_RADIUS = 1.8; // how close you must be to talk to someone
const LABEL_RADIUS = 8; // name tags show within this distance

const $ = (id) => document.getElementById(id);

function start() {
  // ---------- renderer, scene, camera ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    $('error').hidden = false;
    console.error(err);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ec);
  scene.fog = new THREE.Fog(0xdfe6ec, 35, 70);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 70 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ---------- world ----------
  const { colliders, blinkers } = buildOffice(scene);
  const employees = createEmployees(scene, colliders, $('labels'));
  employees[0].marker.visible = true; // preview of a ticket alert (Phase 4 makes this real)

  const player = createPlayer(scene, PLAYER_START);
  const followCam = new FollowCamera(camera, renderer.domElement);
  const input = new Input();

  // ---------- talking ----------
  let nearby = null;
  let talkingTo = null;

  function openPanel(person) {
    talkingTo = person;
    player.face(person.x, person.z);
    // The employee turns to face you while you talk.
    person.group.rotation.y = Math.atan2(player.position.x - person.x, player.position.z - person.z);
    $('panel-name').textContent = person.name;
    $('panel-dept').textContent = person.department;
    $('panel-text').textContent = `"${person.line}"`;
    $('panel').hidden = false;
    $('prompt').hidden = true;
  }
  function closePanel() {
    if (talkingTo) talkingTo.group.rotation.y = talkingTo.facing; // back to their desk
    talkingTo = null;
    $('panel').hidden = true;
  }
  input.onPress('KeyE', () => {
    if (talkingTo) closePanel();
    else if (nearby) openPanel(nearby);
  });
  input.onPress('Escape', closePanel);

  // ---------- resize ----------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- game loop ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05); // cap so a slow frame can't teleport the player
    const time = clock.elapsedTime;

    player.update(dt, input.state, followCam.yaw, colliders, talkingTo !== null);
    followCam.update(dt, player.position);

    // Who is close enough to talk to?
    nearby = talkingTo ? null : nearestWithin(player.position, employees, TALK_RADIUS);
    if (nearby) {
      $('prompt').innerHTML = `<kbd>E</kbd> Talk to <b>${nearby.name}</b>`;
      $('prompt').hidden = false;
    } else if (!talkingTo) {
      $('prompt').hidden = true;
    }
    // Walking away ends the conversation.
    if (talkingTo && nearestWithin(player.position, [talkingTo], TALK_RADIUS + 0.5) === null) closePanel();

    // Name tags that follow people on screen
    for (const person of employees) {
      const dist = Math.hypot(person.x - player.position.x, person.z - player.position.z);
      tmp.set(person.x, person.marker.visible ? 2.6 : 2.0, person.z).project(camera);
      const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      person.label.hidden = !(onScreen && dist < LABEL_RADIUS);
      if (!person.label.hidden) {
        person.label.style.left = `${(tmp.x * 0.5 + 0.5) * window.innerWidth}px`;
        person.label.style.top = `${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
      }
      if (person.marker.visible) {
        person.marker.position.y = 2.15 + Math.sin(time * 3) * 0.08;
        person.marker.rotation.y = time * 2;
      }
    }

    // Blinking server LEDs
    for (const led of blinkers) {
      led.material.emissiveIntensity = Math.sin(time * led.speed + led.phase) > 0.2 ? 1.2 : 0.1;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Handy for debugging in the browser console: helpDeskHero.player.position
  window.helpDeskHero = { player, followCam, employees, scene };
}

start();
