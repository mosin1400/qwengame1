import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { sfx } from "./audio";
import { createProceduralSoldier, animateProcedural, type ProcRig } from "./proceduralSoldier";

/* ============================================================
   کانتر وب — موتور بازی
   مدل سرباز + انیمیشن‌ها (Idle/Walk/Run) از جامعه‌ی سه‌بعدی
   (Mixamo / نمونه‌های three.js) دانلود می‌شود؛ در صورت نبود
   اینترنت، سرباز رویه‌ساز جایگزین می‌شود.
   ============================================================ */

export type GameState = "menu" | "play" | "paused" | "over";

export interface FeedItem {
  id: number;
  text: string;
  head: boolean;
}

export interface FinalStats {
  kills: number;
  headshots: number;
  wave: number;
  score: number;
  time: number;
}

export interface HudState {
  state: GameState;
  modelSource: "glb" | "procedural" | "loading";
  health: number;
  armor: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  wave: number;
  kills: number;
  headshots: number;
  score: number;
  time: number;
  enemiesLeft: number;
  spread: number;
  hitKey: number;
  headKey: number;
  dmgKey: number;
  feed: FeedItem[];
  bannerKey: number;
  bannerText: string;
  stats: FinalStats | null;
}

interface Enemy {
  id: number;
  kind: "glb" | "proc";
  root: THREE.Group;
  model: THREE.Object3D;
  rig: ProcRig | null;
  mixer: THREE.AnimationMixer | null;
  actions: {
    idle: THREE.AnimationAction | null;
    walk: THREE.AnimationAction | null;
    run: THREE.AnimationAction | null;
  };
  band: "idle" | "walk" | "run";
  hitMeshes: THREE.Mesh[];
  hp: number;
  dead: boolean;
  deathT: number;
  fallSign: number;
  yaw: number;
  speed: number;
  runSpeed: number;
  fireT: number;
  fireInterval: number;
  dmg: number;
  los: boolean;
  losT: number;
  alerted: boolean;
  waypoint: THREE.Vector3;
  strafeDir: number;
  strafePhase: number;
  flash: THREE.Sprite;
  flashT: number;
}

const BOUND = 24.4;
const EYE = 1.66;

const WAYPOINTS: Array<[number, number]> = [
  [-4, -19], [4, -19], [14, -16], [20, -6], [20, 7], [12, 17], [0, 20],
  [-12, 17], [-20, 7], [-20, -6], [-13, -17], [0, -7], [7, 1], [-7, -1],
  [17, 3], [-7, 12], [8, -3], [0, 8], [-3, -12],
];

interface ObDef { x: number; z: number; y: number; w: number; h: number; d: number; kind: "crate" | "barrel" | "pillar" | "sand"; }

const OBSTACLES: ObDef[] = [
  { x: -10, z: -9, y: 0, w: 2.2, h: 2.2, d: 2.2, kind: "crate" },
  { x: -7.6, z: -9, y: 0, w: 2.2, h: 2.2, d: 2.2, kind: "crate" },
  { x: -8.8, z: -9, y: 2.2, w: 2, h: 2, d: 2, kind: "crate" },
  { x: 9.5, z: -7, y: 0, w: 2.4, h: 2.4, d: 2.4, kind: "crate" },
  { x: 12, z: -7, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: 10.7, z: -7, y: 2.4, w: 1.8, h: 1.8, d: 1.8, kind: "crate" },
  { x: -12.5, z: 6.5, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: -12.5, z: 9, y: 0, w: 1.6, h: 1.6, d: 1.6, kind: "crate" },
  { x: 6, z: 12, y: 0, w: 2.2, h: 2.2, d: 2.2, kind: "crate" },
  { x: 8.4, z: 12, y: 0, w: 2.2, h: 2.2, d: 2.2, kind: "crate" },
  { x: 7.2, z: 12, y: 2.2, w: 1.8, h: 1.8, d: 1.8, kind: "crate" },
  { x: 0.5, z: -14, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: 3, z: -14, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: -2.5, z: 3.5, y: 0, w: 1.8, h: 1.8, d: 1.8, kind: "crate" },
  { x: 3.5, z: 5.5, y: 0, w: 1.8, h: 1.8, d: 1.8, kind: "crate" },
  { x: 15, z: -1.5, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: 15, z: 1.2, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: -16.5, z: -1.5, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: -16.5, z: 1.2, y: 0, w: 2, h: 2, d: 2, kind: "crate" },
  { x: 0, z: -2, y: 0, w: 6.5, h: 1.1, d: 0.9, kind: "sand" },
  { x: -6, z: 8, y: 0, w: 0.9, h: 1.1, d: 5, kind: "sand" },
  { x: 8, z: -12, y: 0, w: 5, h: 1.1, d: 0.9, kind: "sand" },
  { x: 5.5, z: -3.5, y: 0, w: 0.9, h: 1.2, d: 0.9, kind: "barrel" },
  { x: 6.4, z: -3.1, y: 0, w: 0.9, h: 1.2, d: 0.9, kind: "barrel" },
  { x: -4.5, z: -6, y: 0, w: 0.9, h: 1.2, d: 0.9, kind: "barrel" },
  { x: 13, z: 9.5, y: 0, w: 0.9, h: 1.2, d: 0.9, kind: "barrel" },
  { x: -14, z: -13, y: 0, w: 0.9, h: 1.2, d: 0.9, kind: "barrel" },
  { x: -19, z: 11, y: 0, w: 1.4, h: 4, d: 1.4, kind: "pillar" },
  { x: 17, z: -13, y: 0, w: 1.4, h: 4, d: 1.4, kind: "pillar" },
  { x: 19, z: 14, y: 0, w: 1.4, h: 4, d: 1.4, kind: "pillar" },
  { x: -17, z: -15, y: 0, w: 1.4, h: 4, d: 1.4, kind: "pillar" },
];

const GLB_URLS = [
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb",
  "https://threejs.org/examples/models/gltf/Soldier.glb",
];

interface GlbTemplate {
  scene: THREE.Group;
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameEngine {
  private container: HTMLElement;
  private hud: (s: Partial<HudState>) => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  state: GameState = "menu";
  private modelSource: HudState["modelSource"] = "loading";
  private glb: GlbTemplate | null = null;

  // بازیکن
  private pos = new THREE.Vector3(0, 0, 21);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private health = 100;
  private armor = 25;
  private ammo = 30;
  private reserve = 120;
  private reloading = false;
  private reloadT = 0;
  private fireCd = 0;
  private heat = 0;
  private mouseDown = false;
  private sprinting = false;
  private bobT = 0;
  private stepAcc = 0;
  private stepAlt = false;
  private kick = 0;
  private kickV = 0;
  private pushZ = 0;
  private fov = 74;

  // اسلحه
  private gun = new THREE.Group();
  private muzzle = new THREE.Object3D();
  private flash!: THREE.Sprite;
  private flashLight!: THREE.PointLight;
  private flashT = 0;

  // دنیا
  private enemies: Enemy[] = [];
  private blockers: THREE.Mesh[] = [];
  private tracers: Array<{ line: THREE.Line; life: number }> = [];
  private sprites: Array<{ sprite: THREE.Sprite; life: number; vel: THREE.Vector3 }> = [];
  private spritePool: THREE.Sprite[] = [];
  private dust!: THREE.Points;

  // وضعیت کلی
  private wave = 0;
  private kills = 0;
  private headshots = 0;
  private score = 0;
  private time = 0;
  private waveCd = 2.6;
  private feed: FeedItem[] = [];
  private feedId = 1;
  private bannerKey = 0;
  private bannerText = "";
  private hitKey = 0;
  private headKey = 0;
  private dmgKey = 0;
  private stats: FinalStats | null = null;
  private hudAcc = 0;
  private orbitT = 0;
  private enemyId = 1;

  private raycaster = new THREE.Raycaster();
  private flashTex: THREE.Texture;
  private keys = new Set<string>();

  private handlers: Array<[EventTarget, string, EventListener]> = [];

  constructor(container: HTMLElement, hud: (s: Partial<HudState>) => void) {
    this.container = container;
    this.hud = hud;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(74, container.clientWidth / container.clientHeight, 0.05, 400);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.flashTex = this.makeGlowTexture();
    this.buildWorld();
    this.buildWeapon();
    this.bindEvents();
    this.spawnAmbient(5);
    void this.loadGlb();

    this.clock.start();
    this.loop();
    this.emitNow();
  }

  /* ---------------- ساخت دنیا ---------------- */

  private makeGlowTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,230,180,0.85)");
    grad.addColorStop(1, "rgba(255,180,80,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private makeSandTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#c8b088";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const l = Math.random();
      g.fillStyle = l > 0.5 ? `rgba(90,70,45,${Math.random() * 0.16})` : `rgba(240,225,190,${Math.random() * 0.14})`;
      g.fillRect(x, y, 1.6, 1.6);
    }
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(110,88,58,${0.04 + Math.random() * 0.05})`;
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 30, 6 + Math.random() * 14, Math.random() * 3, 0, 7);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(24, 24);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildWorld() {
    this.scene.background = new THREE.Color(0xcdbb92);
    this.scene.fog = new THREE.Fog(0xcdbb92, 45, 160);

    const hemi = new THREE.HemisphereLight(0xe8e0c8, 0x8a7a55, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe0b0, 2.1);
    sun.position.set(34, 52, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -34;
    sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34;
    sun.shadow.camera.bottom = -34;
    sun.shadow.camera.far = 140;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);

    // زمین
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 340),
      new THREE.MeshStandardMaterial({ map: this.makeSandTexture(), roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // دیوارهای دور میدان
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xbfae87, roughness: 0.95 });
    const wallDefs: Array<[number, number, number, number]> = [
      [0, -27.8, 58, 1.4], [0, 27.8, 58, 1.4], [-27.8, 0, 1.4, 58], [27.8, 0, 1.4, 58],
    ];
    for (const [x, z, w, d] of wallDefs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.2, d), wallMat);
      wall.position.set(x, 2.6, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.blockers.push(wall);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), new THREE.MeshStandardMaterial({ color: 0x8f7d59, roughness: 1 }));
      lip.position.set(x, 5.35, z);
      this.scene.add(lip);
    }

    // موانع
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6b3f, roughness: 0.95 });
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xb3a276, roughness: 1 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xb0a48c, roughness: 1 });
    const barrelMats = [
      new THREE.MeshStandardMaterial({ color: 0x6a4632, roughness: 0.7, metalness: 0.25 }),
      new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.7, metalness: 0.25 }),
    ];
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x54401f, transparent: true, opacity: 0.55 });

    for (const o of OBSTACLES) {
      let mesh: THREE.Mesh;
      if (o.kind === "barrel") {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, o.h, 12), barrelMats[(o.x + o.z) % 2 === 0 ? 0 : 1]);
        mesh.position.set(o.x, o.y + o.h / 2, o.z);
      } else {
        const mat = o.kind === "crate" ? crateMat : o.kind === "sand" ? sandMat : pillarMat;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), mat);
        mesh.position.set(o.x, o.y + o.h / 2, o.z);
        if (o.kind === "crate") {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry as THREE.BoxGeometry), edgeMat);
          mesh.add(edges);
        }
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.blockers.push(mesh);
    }

    // کوه‌های دوردست
    const mMat = new THREE.MeshStandardMaterial({ color: 0xa3906a, roughness: 1, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 115 + Math.sin(i * 12.9) * 18;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(20 + (i % 4) * 7, 12 + (i % 3) * 8, 5), mMat);
      cone.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      cone.rotation.y = i;
      this.scene.add(cone);
    }

    // ذرات گردوغبار
    const n = 260;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = Math.random() * 9;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({ color: 0xe4d3ab, size: 0.11, transparent: true, opacity: 0.4, depthWrite: false })
    );
    this.scene.add(this.dust);
  }

  private buildWeapon() {
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 });
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      this.gun.add(mesh);
      return mesh;
    };
    mk(new THREE.BoxGeometry(0.085, 0.1, 0.5), dark, 0, 0, 0);
    mk(new THREE.BoxGeometry(0.05, 0.05, 0.3), dark, 0, 0.075, -0.04);
    const barrel = mk(new THREE.CylinderGeometry(0.017, 0.017, 0.46, 10), dark, 0, 0.012, -0.46);
    barrel.rotation.x = Math.PI / 2;
    mk(new THREE.BoxGeometry(0.062, 0.065, 0.24), wood, 0, -0.005, -0.28);
    mk(new THREE.BoxGeometry(0.05, 0.24, 0.09), new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.6, metalness: 0.3 }), 0, -0.16, -0.02, 0.32);
    mk(new THREE.BoxGeometry(0.06, 0.09, 0.22), wood, 0, -0.01, 0.33);
    mk(new THREE.BoxGeometry(0.02, 0.055, 0.02), dark, 0, 0.115, -0.22);
    mk(new THREE.BoxGeometry(0.055, 0.045, 0.02), dark, 0, 0.108, 0.1);

    this.muzzle.position.set(0, 0.012, -0.7);
    this.gun.add(this.muzzle);

    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.flashTex, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.flash.position.copy(this.muzzle.position);
    this.flash.scale.setScalar(0.01);
    this.gun.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffb066, 0, 9);
    this.flashLight.position.set(0, 0, -0.8);
    this.gun.add(this.flashLight);

    this.gun.position.set(0.24, -0.22, -0.45);
    this.camera.add(this.gun);
  }

  /* ---------------- بارگیری مدل جامعه ---------------- */

  private async loadGlb() {
    const loader = new GLTFLoader();
    for (const url of GLB_URLS) {
      try {
        const gltf = await Promise.race([
          loader.loadAsync(url),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 9000)),
        ]);
        const clips = gltf.animations;
        const find = (name: string) => clips.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
        const idle = find("Idle");
        const walk = find("Walk");
        const run = find("Run");
        if (!idle || !walk || !run) continue;
        this.glb = { scene: gltf.scene as THREE.Group, idle, walk, run };
        this.modelSource = "glb";
        // سربازهای فعلیِ منو را با مدل واقعی جایگزین کن
        this.refreshAmbient();
        this.emitNow();
        return;
      } catch {
        /* منبع بعدی */
      }
    }
    this.modelSource = "procedural";
    this.emitNow();
  }

  /* ---------------- دشمن‌ها ---------------- */

  private randomWaypoint(awayFrom?: THREE.Vector3, minDist = 0): THREE.Vector3 {
    const options = WAYPOINTS.filter(
      ([x, z]) => !awayFrom || Math.hypot(x - awayFrom.x, z - awayFrom.z) >= minDist
    );
    const pool = options.length ? options : WAYPOINTS;
    const [x, z] = pool[Math.floor(Math.random() * pool.length)];
    return new THREE.Vector3(x + (Math.random() - 0.5) * 1.5, 0, z + (Math.random() - 0.5) * 1.5);
  }

  private makeFlashSprite(): THREE.Sprite {
    return new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.flashTex, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
  }

  private spawnEnemy(pt: THREE.Vector3, waveNum: number): Enemy {
    const root = new THREE.Group();
    root.position.copy(pt);

    const e: Enemy = {
      id: this.enemyId++,
      kind: "proc",
      root,
      model: new THREE.Group(),
      rig: null,
      mixer: null,
      actions: { idle: null, walk: null, run: null },
      band: "idle",
      hitMeshes: [],
      hp: 100 + Math.min(60, (waveNum - 1) * 8),
      dead: false,
      deathT: 0,
      fallSign: Math.random() < 0.5 ? -1 : 1,
      yaw: Math.random() * Math.PI * 2,
      speed: 0,
      runSpeed: Math.min(4.4, 3.2 + waveNum * 0.15),
      fireT: 0.8 + Math.random(),
      fireInterval: Math.max(0.55, 1.35 - waveNum * 0.07),
      dmg: 5 + waveNum,
      los: false,
      losT: Math.random() * 0.2,
      alerted: false,
      waypoint: this.randomWaypoint(),
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafePhase: Math.random() * 6,
      flash: this.makeFlashSprite(),
      flashT: 0,
    };

    if (this.glb) {
      e.kind = "glb";
      const model = cloneSkinned(this.glb.scene) as THREE.Group;
      model.rotation.y = Math.PI; // مدل Mixamo رو به -Z است
      root.add(model);
      e.model = model;
      e.mixer = new THREE.AnimationMixer(model);
      e.actions.idle = e.mixer.clipAction(this.glb.idle);
      e.actions.walk = e.mixer.clipAction(this.glb.walk);
      e.actions.run = e.mixer.clipAction(this.glb.run);
      e.actions.idle.setEffectiveWeight(1).play();
      e.actions.walk.setEffectiveWeight(0).play();
      e.actions.run.setEffectiveWeight(0).play();
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.userData.enemy = e;
          e.hitMeshes.push(m);
        }
      });
    } else {
      const rig = createProceduralSoldier(e.id);
      root.add(rig.root);
      e.model = rig.root;
      e.rig = rig;
      for (const m of rig.hitMeshes) {
        m.userData.enemy = e;
        e.hitMeshes.push(m);
      }
    }

    e.flash.position.set(0, 1.35, 0.55);
    e.flash.scale.setScalar(0.01);
    root.add(e.flash);

    root.rotation.y = e.yaw;
    this.enemies.push(e);
    this.scene.add(root);
    return e;
  }

  private clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.root);
    this.enemies = [];
  }

  private spawnAmbient(n: number) {
    for (let i = 0; i < n; i++) {
      this.spawnEnemy(this.randomWaypoint(undefined, 0), 1);
    }
  }

  private refreshAmbient() {
    // اگر مدل جامعه بعداً رسید و هنوز در منو هستیم، سربازها را واقعی کن
    if (this.state !== "menu") return;
    this.clearEnemies();
    this.spawnAmbient(5);
  }

  private spawnWave(n: number) {
    this.wave = n;
    this.waveCd = 2.6;
    const count = Math.min(3 + n * 2, 13);
    const spots = shuffle(WAYPOINTS)
      .filter(([x, z]) => Math.hypot(x - this.pos.x, z - this.pos.z) > 13)
      .slice(0, count);
    while (spots.length < count) {
      spots.push(WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)]);
    }
    for (const [x, z] of spots) {
      this.spawnEnemy(new THREE.Vector3(x + (Math.random() - 0.5) * 2, 0, z + (Math.random() - 0.5) * 2), n);
    }
    this.bannerText = `موج ${n}`;
    this.bannerKey = Date.now();
    sfx.wave();
    this.emitNow();
  }

  private setBand(e: Enemy, band: Enemy["band"]) {
    e.band = band;
    const acts = e.actions;
    const target = acts[band];
    for (const key of ["idle", "walk", "run"] as const) {
      const a = acts[key];
      if (!a) continue;
      if (a === target) {
        a.enabled = true;
        a.setEffectiveTimeScale(1);
        a.fadeIn(0.25);
      } else {
        a.fadeOut(0.25);
      }
    }
  }

  private checkLOS(e: Enemy): boolean {
    const from = new THREE.Vector3(e.root.position.x, 1.45, e.root.position.z);
    const to = new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
    const dir = to.clone().sub(from);
    const dist = dir.length();
    this.raycaster.set(from, dir.normalize());
    this.raycaster.far = dist - 0.4;
    const hit = this.raycaster.intersectObjects(this.blockers, false);
    this.raycaster.far = Infinity;
    return hit.length === 0;
  }

  private enemyFire(e: Enemy, dist: number) {
    const yaw = e.yaw;
    const mPos = new THREE.Vector3(
      e.root.position.x + Math.sin(yaw) * 0.55,
      1.35,
      e.root.position.z + Math.cos(yaw) * 0.55
    );
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
    const pSpeed = Math.hypot(this.vel.x, this.vel.z);
    let acc = 0.5 - dist * 0.014 - pSpeed * 0.02 - (this.sprinting ? 0.05 : 0);
    acc = THREE.MathUtils.clamp(acc, 0.07, 0.48);
    const hits = Math.random() < acc;
    const spread = dist * (hits ? 0.012 : 0.13);
    const end = eye
      .clone()
      .add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 2).multiplyScalar(spread));
    this.addTracer(mPos, end, 0xffb37a);
    e.flashT = 0.06;
    sfx.enemyShot(THREE.MathUtils.clamp(0.42 - dist * 0.012, 0.05, 0.4));
    if (hits) this.damagePlayer(e.dmg * (0.75 + Math.random() * 0.5));
  }

  private damagePlayer(d: number) {
    if (this.state !== "play") return;
    let dmg = d;
    if (this.armor > 0) {
      const ab = Math.min(this.armor, dmg * 0.6);
      this.armor -= ab;
      dmg -= ab;
    }
    this.health = Math.max(0, this.health - dmg);
    this.dmgKey = Date.now();
    sfx.hurt();
    if (this.health <= 0) {
      this.state = "over";
      this.stats = { kills: this.kills, headshots: this.headshots, wave: this.wave, score: this.score, time: this.time };
      sfx.gameOver();
      if (document.pointerLockElement) document.exitPointerLock();
    }
    this.emitNow();
  }

  private killEnemy(e: Enemy, head: boolean) {
    e.dead = true;
    e.deathT = 0;
    e.fallSign = Math.random() < 0.5 ? -1 : 1;
    this.kills++;
    if (head) this.headshots++;
    this.score += (head ? 150 : 100) + this.wave * 10;
    const item: FeedItem = {
      id: this.feedId++,
      text: head ? "هدشات! تروریست از پای درآمد" : "تروریست از پای درآمد",
      head,
    };
    this.feed = [...this.feed.slice(-4), item];
    setTimeout(() => {
      this.feed = this.feed.filter((f) => f.id !== item.id);
      if (!this.disposed) this.emitNow();
    }, 4200);
    sfx.death();
    if (e.mixer) {
      for (const key of ["idle", "walk", "run"] as const) e.actions[key]?.fadeOut(0.3);
    }
    this.emitNow();
  }

  private updateEnemies(dt: number, mode: "ambient" | "combat") {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.dead) {
        e.deathT += dt;
        const k = Math.min(1, e.deathT / 0.5);
        const ease = 1 - Math.pow(1 - k, 3);
        e.model.rotation.x = e.fallSign * ease * Math.PI * 0.5;
        e.model.rotation.z = e.fallSign * ease * 0.2;
        if (e.deathT > 3) {
          e.root.position.y -= dt * 0.9;
          if (e.root.position.y < -2.5) {
            this.scene.remove(e.root);
            this.enemies.splice(i, 1);
          }
        }
        continue;
      }

      const dx = this.pos.x - e.root.position.x;
      const dz = this.pos.z - e.root.position.z;
      const dist = Math.hypot(dx, dz);

      e.losT -= dt;
      if (e.losT <= 0) {
        e.losT = 0.12 + (e.id % 5) * 0.04;
        e.los = mode === "combat" ? this.checkLOS(e) : false;
        if (e.los) e.alerted = true;
      }

      let mx = 0;
      let mz = 0;
      let speed = 0;
      let facePlayer = false;
      let shooting = false;

      const patrol = () => {
        const wp = e.waypoint;
        const wx = wp.x - e.root.position.x;
        const wz = wp.z - e.root.position.z;
        const wd = Math.hypot(wx, wz);
        if (wd < 1.2) e.waypoint = this.randomWaypoint();
        else {
          mx = wx / wd;
          mz = wz / wd;
          speed = mode === "ambient" ? 1.3 : 1.6;
        }
      };

      if (mode === "combat") {
        if (e.los && dist < 17) {
          facePlayer = true;
          if (dist > 12.5) {
            mx = dx / dist;
            mz = dz / dist;
            speed = e.runSpeed;
          } else if (dist < 5.5) {
            mx = -dx / dist;
            mz = -dz / dist;
            speed = 1.5;
          } else {
            e.strafePhase += dt * (0.9 + (e.id % 3) * 0.25);
            const sgn = Math.sin(e.strafePhase) * e.strafeDir;
            mx = (-dz / dist) * sgn;
            mz = (dx / dist) * sgn;
            speed = 1.7;
            shooting = true;
            e.fireT -= dt;
            if (e.fireT <= 0) {
              this.enemyFire(e, dist);
              e.fireT = e.fireInterval * (0.75 + Math.random() * 0.5);
            }
          }
        } else if (e.alerted || dist < 20) {
          mx = dx / dist;
          mz = dz / dist;
          speed = e.runSpeed;
        } else {
          patrol();
        }
      } else {
        patrol();
      }

      e.speed += (speed - e.speed) * Math.min(1, dt * 8);

      const targetYaw = facePlayer
        ? Math.atan2(dx, dz)
        : e.speed > 0.3
          ? Math.atan2(mx, mz)
          : e.yaw;
      const dy = THREE.MathUtils.euclideanModulo(targetYaw - e.yaw + Math.PI, Math.PI * 2) - Math.PI;
      e.yaw += dy * Math.min(1, dt * 7);
      e.root.rotation.y = e.yaw;

      if (e.speed > 0.05) {
        e.root.position.x += mx * e.speed * dt;
        e.root.position.z += mz * e.speed * dt;
      }
      this.collideCircle(e.root.position, 0.42);

      // جداسازی از بقیه‌ی دشمن‌ها
      for (const o of this.enemies) {
        if (o === e || o.dead) continue;
        const sx = e.root.position.x - o.root.position.x;
        const sz = e.root.position.z - o.root.position.z;
        const sd = Math.hypot(sx, sz);
        if (sd < 1.05 && sd > 0.001) {
          const push = ((1.05 - sd) / sd) * 0.5;
          e.root.position.x += sx * push;
          e.root.position.z += sz * push;
        }
      }

      // انیمیشن
      if (e.kind === "glb" && e.mixer) {
        const band: Enemy["band"] = e.speed < 0.4 ? "idle" : e.speed < 2.5 ? "walk" : "run";
        if (band !== e.band) this.setBand(e, band);
        e.mixer.update(dt);
      } else if (e.rig) {
        animateProcedural(e.rig, e.speed, dt, shooting && e.los);
      }

      // فلش شلیک
      e.flashT -= dt;
      const fm = e.flash.material as THREE.SpriteMaterial;
      if (e.flashT > 0) {
        fm.opacity = 1;
        e.flash.scale.setScalar(0.7 + Math.random() * 0.4);
      } else {
        fm.opacity = 0;
        e.flash.scale.setScalar(0.01);
      }
    }
  }

  /* ---------------- بازیکن ---------------- */

  private collideCircle(p: THREE.Vector3, r: number) {
    for (const o of OBSTACLES) {
      if (p.y > o.y + o.h) continue;
      const cx = THREE.MathUtils.clamp(p.x, o.x - o.w / 2, o.x + o.w / 2);
      const cz = THREE.MathUtils.clamp(p.z, o.z - o.d / 2, o.z + o.d / 2);
      let dx = p.x - cx;
      let dz = p.z - cz;
      let d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 0.0001) {
          dx = p.x - o.x;
          dz = p.z - o.z;
          d = Math.hypot(dx, dz) || 1;
        }
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      }
    }
    p.x = THREE.MathUtils.clamp(p.x, -BOUND, BOUND);
    p.z = THREE.MathUtils.clamp(p.z, -BOUND, BOUND);
  }

  private currentSpread(): number {
    const moveK = THREE.MathUtils.clamp(Math.hypot(this.vel.x, this.vel.z) / 6.4, 0, 1);
    return 0.0035 + moveK * 0.006 + this.heat * 0.012;
  }

  private updatePlayer(dt: number) {
    const f = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const s = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    this.sprinting = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && f > 0;
    const spd = this.sprinting ? 6.4 : 4.2;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    let wx = -sinY * f + cosY * s;
    let wz = -cosY * f - sinY * s;
    const wl = Math.hypot(wx, wz);
    if (wl > 0.001) {
      wx = (wx / wl) * spd;
      wz = (wz / wl) * spd;
    }
    this.vel.x += (wx - this.vel.x) * Math.min(1, dt * 11);
    this.vel.z += (wz - this.vel.z) * Math.min(1, dt * 11);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.collideCircle(this.pos, 0.45);

    const moveK = THREE.MathUtils.clamp(Math.hypot(this.vel.x, this.vel.z) / 6.4, 0, 1);
    this.bobT += Math.hypot(this.vel.x, this.vel.z) * dt * 1.35;

    // قدم‌ها
    if (moveK > 0.15) {
      this.stepAcc += Math.hypot(this.vel.x, this.vel.z) * dt;
      if (this.stepAcc > 2.2) {
        this.stepAcc = 0;
        this.stepAlt = !this.stepAlt;
        sfx.step(this.stepAlt);
      }
    }

    // دوربین
    this.camera.position.set(this.pos.x, EYE + Math.sin(this.bobT * 1.7) * 0.03 * moveK, this.pos.z);
    this.kickV += (-this.kick * 150 - this.kickV * 13) * dt;
    this.kick += this.kickV * dt;
    this.camera.rotation.set(this.pitch + this.kick * 0.05, this.yaw, (s * -0.012) * moveK);

    const targetFov = this.sprinting && moveK > 0.5 ? 81 : 74;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 8);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // شلیک و خشاب
    this.heat = Math.max(0, this.heat - dt * 1.7);
    this.fireCd -= dt;
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = 30 - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloading = false;
        this.emitNow();
      }
    } else if (this.keys.has("KeyR")) {
      this.tryReload();
    }
    if (this.mouseDown && !this.reloading && this.fireCd <= 0) {
      if (this.ammo > 0) this.shoot();
      else {
        this.fireCd = 0.35;
        this.tryReload();
      }
    }
  }

  private tryReload() {
    if (this.reloading || this.ammo >= 30 || this.reserve <= 0 || this.state !== "play") return;
    this.reloading = true;
    this.reloadT = 2.1;
    sfx.reload();
    this.emitNow();
  }

  private shoot() {
    this.ammo--;
    this.fireCd = 0.1;
    this.heat = Math.min(1, this.heat + 0.13);
    this.kickV += 1.7;
    this.pushZ = 0.075;
    this.flashT = 0.05;
    sfx.shot();
    this.hitscan();
    if (this.ammo <= 6 || this.ammo === 0) this.emitNow();
  }

  private hitscan() {
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const sp = this.currentSpread();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    dir
      .addScaledVector(right, (Math.random() - 0.5) * 2 * sp)
      .addScaledVector(up, (Math.random() - 0.5) * 2 * sp)
      .normalize();

    this.raycaster.set(origin, dir);
    this.raycaster.far = 200;
    const targets: THREE.Object3D[] = [...this.blockers];
    for (const e of this.enemies) if (!e.dead) targets.push(...e.hitMeshes);
    const hits = this.raycaster.intersectObjects(targets, false);

    const muzzleWorld = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzleWorld);

    if (hits.length > 0) {
      const h = hits[0];
      const e = h.object.userData.enemy as Enemy | undefined;
      if (e && !e.dead) {
        const relY = h.point.y - e.root.position.y;
        let dmg: number;
        let head = false;
        if (relY > 1.42) {
          head = true;
          dmg = 110;
        } else if (relY < 0.8) {
          dmg = 21;
        } else {
          dmg = 27 + Math.random() * 7;
        }
        e.hp -= dmg;
        e.alerted = true;
        if (head) this.headKey = Date.now();
        else this.hitKey = Date.now();
        sfx.hit(head);
        this.spawnBurst(h.point, head ? 0xd81f1f : 0xa31414, 7);
        this.addTracer(muzzleWorld, h.point, 0xffe0a8);
        if (e.hp <= 0) this.killEnemy(e, head);
        else this.emitNow();
        return;
      }
      this.spawnBurst(h.point, 0xcbb98f, 5);
      this.addTracer(muzzleWorld, h.point, 0xffe0a8);
    } else {
      const end = origin.clone().addScaledVector(dir, 90);
      this.addTracer(muzzleWorld, end, 0xffe0a8);
    }
  }

  private updateWeapon(dt: number) {
    this.pushZ *= Math.exp(-11 * dt);
    const moveK = THREE.MathUtils.clamp(Math.hypot(this.vel.x, this.vel.z) / 6.4, 0, 1);
    this.gun.position.set(
      0.24 + Math.sin(this.bobT * 1.7) * 0.008 * moveK,
      -0.22 + Math.abs(Math.cos(this.bobT * 1.7)) * 0.01 * moveK,
      -0.45 + this.pushZ
    );
    if (this.reloading) {
      const p = 1 - this.reloadT / 2.1;
      this.gun.rotation.x = Math.sin(p * Math.PI) * 0.85;
      this.gun.rotation.z = Math.sin(p * Math.PI) * -0.25;
    } else {
      this.gun.rotation.x *= 1 - Math.min(1, dt * 12);
      this.gun.rotation.z *= 1 - Math.min(1, dt * 12);
    }
    this.flashT -= dt;
    const fm = this.flash.material as THREE.SpriteMaterial;
    if (this.flashT > 0) {
      fm.opacity = 1;
      this.flash.scale.setScalar(0.42 + Math.random() * 0.22);
      this.flash.material.rotation = Math.random() * Math.PI;
      this.flashLight.intensity = 5;
    } else {
      fm.opacity = 0;
      this.flashLight.intensity *= Math.exp(-20 * dt);
    }
  }

  /* ---------------- افکت‌ها ---------------- */

  private addTracer(a: THREE.Vector3, b: THREE.Vector3, color: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 1 });
  }

  private spawnBurst(at: THREE.Vector3, color: number, n: number) {
    for (let i = 0; i < n; i++) {
      let sprite = this.spritePool.pop();
      if (!sprite) {
        sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: this.flashTex, color, transparent: true, depthWrite: false })
        );
      } else {
        (sprite.material as THREE.SpriteMaterial).color.setHex(color);
      }
      sprite.position.copy(at);
      sprite.scale.setScalar(0.16);
      (sprite.material as THREE.SpriteMaterial).opacity = 0.95;
      this.scene.add(sprite);
      this.sprites.push({
        sprite,
        life: 0.42,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.6 + 0.6, (Math.random() - 0.5) * 3),
      });
    }
  }

  private updateFx(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt * 5.5;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life) * 0.85;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i];
      s.life -= dt;
      s.sprite.position.addScaledVector(s.vel, dt);
      s.vel.y -= 7 * dt;
      (s.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, s.life / 0.42);
      s.sprite.scale.setScalar(0.16 + (0.42 - s.life) * 0.4);
      if (s.life <= 0) {
        this.scene.remove(s.sprite);
        this.spritePool.push(s.sprite);
        this.sprites.splice(i, 1);
      }
    }
    this.dust.rotation.y += dt * 0.008;
  }

  /* ---------------- رویدادها و حالت‌ها ---------------- */

  private bindEvents() {
    const on = (t: EventTarget, ev: string, fn: EventListener) => {
      t.addEventListener(ev, fn);
      this.handlers.push([t, ev, fn]);
    };

    on(window, "resize", (() => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }) as EventListener);

    on(document, "keydown", ((e: KeyboardEvent) => {
      this.keys.add(e.code);
    }) as EventListener);
    on(document, "keyup", ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
    }) as EventListener);

    on(document, "mousemove", ((e: MouseEvent) => {
      if (document.pointerLockElement !== this.renderer.domElement || this.state !== "play") return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.45, 1.45);
    }) as EventListener);

    on(document, "mousedown", ((e: MouseEvent) => {
      if (e.button === 0 && this.state === "play" && document.pointerLockElement === this.renderer.domElement) {
        this.mouseDown = true;
        this.fireCd = Math.min(this.fireCd, 0);
      }
    }) as EventListener);
    on(document, "mouseup", (() => {
      this.mouseDown = false;
    }) as EventListener);

    on(document, "pointerlockchange", (() => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      if (!locked && this.state === "play") {
        this.state = "paused";
        this.mouseDown = false;
        this.keys.clear();
        this.emitNow();
      } else if (locked && this.state === "paused") {
        this.state = "play";
        this.emitNow();
      }
    }) as EventListener);

    on(window, "blur", (() => {
      if (this.state === "play") {
        this.state = "paused";
        this.mouseDown = false;
        this.keys.clear();
        this.emitNow();
      }
    }) as EventListener);

    on(document, "contextmenu", ((e: Event) => e.preventDefault()) as EventListener);
  }

  private requestLock() {
    const el = this.renderer.domElement as HTMLCanvasElement & { requestPointerLock: () => Promise<void> | void };
    try {
      const p = el.requestPointerLock();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {
          /* کاربر دوباره تلاش می‌کند */
        });
      }
    } catch {
      /* ignore */
    }
  }

  start() {
    this.clearEnemies();
    this.pos.set(0, 0, 21);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.health = 100;
    this.armor = 25;
    this.ammo = 30;
    this.reserve = 120;
    this.reloading = false;
    this.heat = 0;
    this.kills = 0;
    this.headshots = 0;
    this.score = 0;
    this.time = 0;
    this.feed = [];
    this.stats = null;
    this.state = "play";
    this.spawnWave(1);
    this.requestLock();
    this.emitNow();
  }

  resume() {
    if (this.state !== "paused") return;
    this.requestLock();
    // مرورگر بعد از Esc یک دوره‌ی سردرگمی ۱٫۲۵ ثانیه‌ای دارد — تلاش مجدد خودکار
    const retry = () => {
      if (this.disposed || this.state !== "paused") return;
      this.requestLock();
    };
    setTimeout(retry, 600);
    setTimeout(retry, 1400);
  }

  pause() {
    if (this.state !== "play") return;
    this.state = "paused";
    if (document.pointerLockElement) document.exitPointerLock();
    this.emitNow();
  }

  toMenu() {
    this.clearEnemies();
    this.state = "menu";
    this.spawnAmbient(5);
    if (document.pointerLockElement) document.exitPointerLock();
    this.emitNow();
  }

  private emitNow() {
    this.hud({
      state: this.state,
      modelSource: this.modelSource,
      health: Math.ceil(this.health),
      armor: Math.ceil(this.armor),
      ammo: this.ammo,
      reserve: this.reserve,
      reloading: this.reloading,
      wave: this.wave,
      kills: this.kills,
      headshots: this.headshots,
      score: this.score,
      time: this.time,
      enemiesLeft: this.enemies.filter((e) => !e.dead).length,
      spread: this.currentSpread(),
      hitKey: this.hitKey,
      headKey: this.headKey,
      dmgKey: this.dmgKey,
      feed: [...this.feed],
      bannerKey: this.bannerKey,
      bannerText: this.bannerText,
      stats: this.stats,
    });
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === "menu") {
      this.orbitT += dt;
      const a = this.orbitT * 0.085;
      this.camera.position.set(Math.cos(a) * 27, 12.5 + Math.sin(this.orbitT * 0.3) * 2.5, Math.sin(a) * 27);
      this.camera.lookAt(0, 1.2, 0);
      this.updateEnemies(dt, "ambient");
    } else if (this.state === "play") {
      this.time += dt;
      this.updatePlayer(dt);
      this.updateEnemies(dt, "combat");
      this.updateWeapon(dt);

      const alive = this.enemies.some((e) => !e.dead);
      if (!alive) {
        this.waveCd -= dt;
        if (this.waveCd <= 0) {
          this.score += 250;
          this.health = Math.min(100, this.health + 25);
          this.armor = Math.min(100, this.armor + 40);
          this.reserve += 60;
          this.spawnWave(this.wave + 1);
        }
      }
      this.hudAcc += dt;
      if (this.hudAcc > 0.1) {
        this.hudAcc = 0;
        this.emitNow();
      }
    }

    this.updateFx(dt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [t, ev, fn] of this.handlers) t.removeEventListener(ev, fn);
    this.handlers = [];
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
