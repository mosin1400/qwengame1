import * as THREE from "three";

/* سرباز رویه‌ساز (low-poly) — جایگزین آفلاین برای مدل جامعه، رو به +Z */

export interface ProcRig {
  root: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  torso: THREE.Group;
  gun: THREE.Group;
  muzzle: THREE.Object3D;
  hitMeshes: THREE.Mesh[];
  phase: number;
}

const PALETTES = [
  { shirt: 0x6b7048, pants: 0x3d3f33, skin: 0xc9986b, gear: 0x2e3025, accent: 0xa03128 },
  { shirt: 0x9a8a5e, pants: 0x4a4436, skin: 0xb98455, gear: 0x3a3626, accent: 0x28523c },
  { shirt: 0x7a7d6a, pants: 0x35382e, skin: 0xd8a878, gear: 0x26281f, accent: 0x8a5a20 },
];

function mat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
}

function box(w: number, h: number, d: number, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  return mesh;
}

export function createProceduralSoldier(seed: number): ProcRig {
  const p = PALETTES[seed % PALETTES.length];
  const root = new THREE.Group();

  // پاها (لولا در لگن)
  const legGeo = (side: 1 | -1) => {
    const g = new THREE.Group();
    g.position.set(0.11 * side, 0.92, 0);
    const thigh = box(0.15, 0.46, 0.17, mat(p.pants));
    thigh.position.y = -0.23;
    const shin = box(0.13, 0.44, 0.15, mat(p.pants));
    shin.position.y = -0.68;
    const boot = box(0.16, 0.12, 0.26, mat(0x1e1c17));
    boot.position.set(0, -0.88, 0.04);
    g.add(thigh, shin, boot);
    root.add(g);
    return g;
  };
  const legL = legGeo(-1);
  const legR = legGeo(1);

  // تنه
  const torso = new THREE.Group();
  torso.position.y = 1.22;
  const chest = box(0.44, 0.56, 0.26, mat(p.shirt));
  const vest = box(0.47, 0.36, 0.3, mat(p.gear));
  vest.position.y = 0.02;
  const pouch = box(0.14, 0.1, 0.05, mat(p.accent));
  pouch.position.set(0.12, -0.05, 0.17);
  torso.add(chest, vest, pouch);
  root.add(torso);

  // بازوها (لولا در شانه)
  const armGeo = (side: 1 | -1) => {
    const g = new THREE.Group();
    g.position.set(0.28 * side, 1.46, 0);
    const upper = box(0.12, 0.34, 0.13, mat(p.shirt));
    upper.position.y = -0.17;
    const fore = box(0.1, 0.3, 0.11, mat(p.skin));
    fore.position.y = -0.46;
    g.add(upper, fore);
    root.add(g);
    return g;
  };
  const armL = armGeo(-1);
  const armR = armGeo(1);

  // سر + کلاه
  const head = box(0.21, 0.23, 0.22, mat(p.skin));
  head.position.y = 1.66;
  const helmet = box(0.26, 0.1, 0.27, mat(p.gear, 0.7));
  helmet.position.y = 1.8;
  const band = box(0.24, 0.05, 0.25, mat(p.accent));
  band.position.y = 1.74;
  const visor = box(0.15, 0.04, 0.03, mat(0x14161a, 0.4));
  visor.position.set(0, 1.68, 0.12);
  root.add(head, helmet, band, visor);

  // تفنگ در دست راست — رو به +Z
  const gun = new THREE.Group();
  gun.position.set(0.22, 1.28, 0.28);
  const gunBody = box(0.06, 0.09, 0.52, mat(0x23262a, 0.55));
  gunBody.position.z = 0.1;
  const barrelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8),
    mat(0x16181b, 0.4)
  );
  barrelMesh.rotation.x = Math.PI / 2;
  barrelMesh.position.z = 0.48;
  barrelMesh.castShadow = true;
  const magMesh = box(0.05, 0.2, 0.07, mat(0x4a3320));
  magMesh.position.set(0, -0.13, 0.05);
  magMesh.rotation.x = -0.25;
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, 0.68);
  gun.add(gunBody, barrelMesh, magMesh, muzzle);
  root.add(gun);

  // حالت ایستایی اولیه: دست‌ها کمی خم
  armL.rotation.x = -0.9;
  armR.rotation.x = -1.25;
  armR.rotation.z = 0.25;
  armL.rotation.z = -0.15;

  const hitMeshes = [chest, vest, head, helmet, thighOf(legL), thighOf(legR)];
  function thighOf(g: THREE.Group): THREE.Mesh {
    return g.children[0] as THREE.Mesh;
  }

  return { root, legL, legR, armL, armR, torso, gun, muzzle, hitMeshes, phase: Math.random() * 10 };
}

/* انیمیشن رویه‌ساز: راه‌رفتن/دویدن با نوسان اندام‌ها */
export function animateProcedural(rig: ProcRig, speed: number, dt: number, shooting: boolean) {
  const run = THREE.MathUtils.clamp(speed / 3.4, 0, 1);
  const freq = 4.5 + run * 4.5;
  rig.phase += dt * freq * Math.min(1, speed / 1.2 + 0.12);
  const amp = run * 0.85;
  const s = Math.sin(rig.phase);

  rig.legL.rotation.x = s * amp;
  rig.legR.rotation.x = -s * amp;

  if (shooting) {
    rig.armR.rotation.x += (-1.35 - rig.armR.rotation.x) * Math.min(1, dt * 10);
    rig.armL.rotation.x += (-1.15 - rig.armL.rotation.x) * Math.min(1, dt * 10);
    rig.torso.rotation.y += (0.35 - rig.torso.rotation.y) * Math.min(1, dt * 8);
  } else {
    rig.armL.rotation.x = -0.9 + -s * amp * 0.5;
    rig.armR.rotation.x = -1.25 + s * amp * 0.35;
    rig.torso.rotation.y *= 1 - Math.min(1, dt * 6);
  }
  rig.torso.position.y = 1.22 + Math.abs(Math.cos(rig.phase)) * 0.045 * run;
}
