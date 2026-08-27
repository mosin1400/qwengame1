import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sfx } from "./audio";
import { createProceduralSoldier, animateProcedural, type ProcRig } from "./proceduralSoldier";
import { AssetBank, SLOT_DEFS, type SlotName } from "./assets";

/* ============================================================
   کانتر وب — موتور بازی (نسخه‌ی نقشه‌ی بزرگ)
   • مدل سرباز + انیمیشن‌ها از جامعه (three.js / Mixamo) — برای هر
     سرباز جدا parse می‌شود تا اسکلت و انیمیشن قطعاً درست کار کنند.
   • اشیای صحنه و بافت زمین از Poly Haven (لایسنس CC0) دانلود
     می‌شود؛ در صورت نبود اینترنت، نسخه‌ی رویه‌ساز جایگزین است.
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

export interface AllyHud {
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface HudState {
  state: GameState;
  modelSource: "glb" | "procedural" | "loading";
  propsSource: "polyhaven" | "procedural" | "loading";
  assetsLoaded: number;
  assetsTotal: number;
  locked: boolean;
  health: number;
  armor: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  slot: number;
  weaponName: string;
  grenades: number;
  wave: number;
  kills: number;
  headshots: number;
  score: number;
  time: number;
  enemiesLeft: number;
  allies: AllyHud[];
  spread: number;
  hitKey: number;
  headKey: number;
  dmgKey: number;
  feed: FeedItem[];
  bannerKey: number;
  bannerText: string;
  bannerKind: "wave" | "streak" | "info";
  stats: FinalStats | null;
  money: number;
  buyOpen: boolean;
  scoping: boolean;
  best: number;
  ownedPrimaries: PrimaryId[];
  primaryId: PrimaryId;
  dmgDirs: Array<{ id: number; deg: number }>;
  storm: boolean;
}

type EType = "rifle" | "runner" | "heavy";

/** گونه‌ی سلاح سربازها (دشمن و هم‌رزم) */
export type WKind = "ak" | "smg" | "shotgun" | "pistol" | "lmg" | "knife";

/** ریگ استخوانی دستی — انیمیشن مستقیم روی استخوان‌ها، بدون وابستگی به کلیپ */
interface BoneRig {
  hips: THREE.Object3D | null;
  chest: THREE.Object3D | null;
  head: THREE.Object3D | null;
  armL: THREE.Object3D | null;
  armR: THREE.Object3D | null;
  foreL: THREE.Object3D | null;
  foreR: THREE.Object3D | null;
  legL: THREE.Object3D | null;
  legR: THREE.Object3D | null;
  kneeL: THREE.Object3D | null;
  kneeR: THREE.Object3D | null;
  handR: THREE.Object3D | null;
  hipsY: number;
  phase: number;
  aimK: number;
  recoil: number;
}

function pickWeaponKind(team: "enemy" | "ally", etype: EType, nameIdx: number): WKind {
  if (team === "ally") return (["ak", "shotgun", "smg", "pistol"] as const)[nameIdx % 4];
  if (etype === "runner") return "knife";
  if (etype === "heavy") return Math.random() < 0.7 ? "lmg" : "shotgun";
  const r = Math.random();
  return r < 0.55 ? "ak" : r < 0.8 ? "smg" : "shotgun";
}

interface Soldier {
  id: number;
  team: "enemy" | "ally";
  etype: EType;
  name: string;
  root: THREE.Group;
  visual: THREE.Group;
  rig: ProcRig | null;
  bones: BoneRig | null;
  wkind: WKind;
  mixer: THREE.AnimationMixer | null;
  actions: {
    idle: THREE.AnimationAction | null;
    walk: THREE.AnimationAction | null;
    run: THREE.AnimationAction | null;
  };
  band: "idle" | "walk" | "run";
  hitMeshes: THREE.Mesh[];
  hp: number;
  maxHp: number;
  dead: boolean;
  removed: boolean;
  deathT: number;
  fallSign: number;
  yaw: number;
  speed: number;
  fireT: number;
  burstLeft: number;
  burstPause: number;
  meleeCd: number;
  los: boolean;
  losT: number;
  alerted: boolean;
  waypoint: THREE.Vector3;
  strafeDir: number;
  strafePhase: number;
  target: Soldier | "player" | null;
  retargetT: number;
  flash: THREE.Sprite;
  flashT: number;
  ring: THREE.Mesh;
  radius: number;
  scale: number;
  gone: boolean;
}

interface Pickup {
  kind: "health" | "armor" | "ammo" | "grenade";
  mesh: THREE.Group;
  pos: THREE.Vector3;
  taken: boolean;
  respawnT: number;
  baseY: number;
}

interface Grenade {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  t: number;
}

interface BoxCol { x: number; z: number; hw: number; hd: number; }
interface CirCol { x: number; z: number; r: number; }

/* ---------------- تنظیمات دنیا ---------------- */

const HALF = 190; // نقشه‌ی ۳۸۰×۳۸۰ متری
const WALL = 180;
const EYE = 1.66;
const FA = "۰۱۲۳۴۵۶۷۸۹";
const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => FA[+d]);

const SOLDIER_URLS = [
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb",
  "https://threejs.org/examples/models/gltf/Soldier.glb",
  "https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/Soldier.glb",
];



const ALLY_NAMES = ["علی", "رضا", "مهدی", "حسن"];
const ALLY_TINT = 0xa8e8b0;
const TINTS: Record<EType, number> = { rifle: 0xffffff, runner: 0xf2c9a8, heavy: 0xc3cae8 };

const ETYPES: Record<
  EType,
  { hp: (w: number) => number; speed: number; rof: number; dmg: (w: number) => number; score: number; label: string; scale: number }
> = {
  rifle: { hp: (w) => 100 + w * 8, speed: 4.3, rof: 1.15, dmg: (w) => 8 + w * 0.7, score: 100, label: "تروریست", scale: 1 },
  runner: { hp: () => 65, speed: 7.6, rof: 0, dmg: (w) => 14 + w, score: 130, label: "دونده", scale: 0.96 },
  heavy: { hp: (w) => 280 + w * 18, speed: 2.7, rof: 1.75, dmg: (w) => 14 + w, score: 260, label: "سنگین‌اسلحه", scale: 1.14 },
};

interface WeaponDef {
  name: string;
  auto: boolean;
  melee?: boolean;
  scoped?: boolean;
  pellets?: number;
  rof: number;
  mag: number;
  reload: number;
  spread: number;
  heatAdd: number;
  kick: number;
  dmg: number;
  head: number;
  leg: number;
  range: number;
}

export type PrimaryId = "ak" | "mp5" | "shotgun" | "awp";

const PRIMARY_DEFS: Record<PrimaryId, WeaponDef> = {
  ak: { name: "کلاشینکف AK-47", auto: true, rof: 0.105, mag: 30, reload: 2.1, spread: 0.0035, heatAdd: 0.13, kick: 1.7, dmg: 28, head: 110, leg: 21, range: 220 },
  mp5: { name: "مسلسل MP5", auto: true, rof: 0.075, mag: 30, reload: 1.8, spread: 0.003, heatAdd: 0.1, kick: 1.2, dmg: 22, head: 88, leg: 17, range: 180 },
  shotgun: { name: "شاتگان M3", auto: false, pellets: 8, rof: 0.85, mag: 6, reload: 2.6, spread: 0.022, heatAdd: 0.25, kick: 3.2, dmg: 15, head: 46, leg: 12, range: 60 },
  awp: { name: "اسنایپر AWP", auto: false, scoped: true, rof: 1.35, mag: 5, reload: 3.0, spread: 0.02, heatAdd: 0.3, kick: 4.5, dmg: 115, head: 280, leg: 90, range: 400 },
};

const WEAPONS: WeaponDef[] = [
  PRIMARY_DEFS.ak,
  { name: "کلت M9", auto: false, rof: 0.24, mag: 12, reload: 1.3, spread: 0.0022, heatAdd: 0.07, kick: 1.1, dmg: 24, head: 80, leg: 18, range: 180 },
  { name: "چاقوی رزمی", auto: false, melee: true, rof: 0.45, mag: 0, reload: 0, spread: 0, heatAdd: 0, kick: 0, dmg: 90, head: 90, leg: 90, range: 2.8 },
];

/** فروشگاه — قیمت‌ها به دلار کانتر */
export interface BuyItem {
  id: string;
  label: string;
  price: number;
  kind: "primary" | "gear";
  primary?: PrimaryId;
  desc: string;
}

export const BUY_ITEMS: BuyItem[] = [
  { id: "mp5", label: "مسلسل MP5", price: 1500, kind: "primary", primary: "mp5", desc: "نرخ آتش بالا، پس‌زدن کم" },
  { id: "shotgun", label: "شاتگان M3", price: 1800, kind: "primary", primary: "shotgun", desc: "۸ ساچمه — مرگبار در نزدیک" },
  { id: "awp", label: "اسنایپر AWP", price: 4750, kind: "primary", primary: "awp", desc: "تک‌تیرانداز — با کلیک‌راست اسکوپ" },
  { id: "vest", label: "زره + کلاه", price: 1000, kind: "gear", desc: "زره کامل ۱۰۰" },
  { id: "ammo", label: "شارژ مهمات", price: 500, kind: "gear", desc: "پر کردن ذخیره‌ی همه‌ی سلاح‌ها" },
  { id: "he", label: "نارنجک HE", price: 300, kind: "gear", desc: "+۱ نارنجک (حداکثر ۵)" },
];

const ZONES = {
  plaza: { x0: -45, x1: 45, z0: -45, z1: 45 },
  cont: { x0: 70, x1: 160, z0: -160, z1: -70 },
  res: { x0: -160, x1: -70, z0: 70, z1: 160 },
  oasis: { cx: -110, cz: -110, r: 42 },
  rocks: { x0: 70, x1: 165, z0: 70, z1: 165 },
};

/* ---------------- موتور ---------------- */

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
  private propsSource: HudState["propsSource"] = "loading";
  private soldierBuffer: ArrayBuffer | null = null;
  private bank = new AssetBank();
  private placements = new Map<
    SlotName,
    Array<{ group: THREE.Group; targetH: number; fallback: THREE.Object3D; upgraded: boolean }>
  >();
  private assetsLoaded = 0;
  private assetsTotal = Object.keys(SLOT_DEFS).length;
  private soldierPool: GLTF[] = [];
  private poolBusy = false;
  private dragLook = false;
  private lastMX = 0;
  private lastMY = 0;

  // بازیکن
  private pos = new THREE.Vector3(0, 0, 28);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private health = 100;
  private armor = 25;
  private grenades = 2;
  private slot = 0;
  private ammoArr = [30, 12, 0];
  private reserveArr = [120, Infinity, 0];
  private reloading = false;
  private reloadT = 0;
  private fireCd = 0;
  private heat = 0;
  private mouseDown = false;
  private mousePressed = false;
  private sprinting = false;
  private adsDown = false;
  private adsK = 0;
  private bobT = 0;
  private stepAcc = 0;
  private stepAlt = false;
  private kick = 0;
  private kickV = 0;
  private pushZ = 0;
  private shake = 0;
  private fov = 74;
  private knifeT = -1;

  // اقتصاد و سلاح‌های اصلی
  private money = 800;
  private buyOpen = false;
  private best = 0;
  private primaryId: PrimaryId = "ak";
  private ownedPrimaries = new Set<PrimaryId>(["ak"]);
  private primaryAmmo: Record<PrimaryId, { mag: number; reserve: number }> = {
    ak: { mag: 30, reserve: 120 },
    mp5: { mag: 30, reserve: 0 },
    shotgun: { mag: 6, reserve: 0 },
    awp: { mag: 5, reserve: 0 },
  };
  private primaryGroup = new THREE.Group();
  private primaryBodies: Record<PrimaryId, THREE.Group> | null = null;
  private primaryMuzzles: Record<PrimaryId, THREE.Object3D> | null = null;
  private scoping = false;
  private scopeT = 0;

  // افکت‌های جدید
  private dmgDirs: Array<{ id: number; deg: number }> = [];
  private dmgDirId = 1;
  private storm = false;
  private stormK = 0;
  private shells: Array<{ m: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number }> = [];
  private shellGeo = new THREE.BoxGeometry(0.02, 0.02, 0.06);
  private shellMat = new THREE.MeshStandardMaterial({ color: 0xd8a848, roughness: 0.4, metalness: 0.7 });
  private dmgNums: Array<{ s: THREE.Sprite; life: number; vy: number }> = [];
  private radarPings: Array<{ x: number; z: number; life: number; col: string }> = [];

  // اسلحه‌ها
  private gun = new THREE.Group();
  private gunBodies: THREE.Group[] = [];
  private muzzles: THREE.Object3D[] = [];
  private flash!: THREE.Sprite;
  private flashLight!: THREE.PointLight;
  private flashT = 0;

  // دنیا
  private soldiers: Soldier[] = [];
  private boxCols: BoxCol[] = [];
  private cirCols: CirCol[] = [];
  private blockers: THREE.Mesh[] = [];
  private pickups: Pickup[] = [];
  private grenadeList: Grenade[] = [];
  private tracers: Array<{ line: THREE.Line; life: number }> = [];
  private sprites: Array<{ sprite: THREE.Sprite; life: number; vel: THREE.Vector3; grow: number }> = [];
  private spritePool: THREE.Sprite[] = [];
  private dust!: THREE.Points;
  private sun!: THREE.DirectionalLight;

  // وضعیت کلی
  private wave = 0;
  private kills = 0;
  private headshots = 0;
  private score = 0;
  private time = 0;
  private waveCd = 3;
  private streak = 0;
  private lastKillT = -99;
  private feed: FeedItem[] = [];
  private feedId = 1;
  private bannerKey = 0;
  private bannerText = "";
  private bannerKind: HudState["bannerKind"] = "wave";
  private hitKey = 0;
  private headKey = 0;
  private dmgKey = 0;
  private stats: FinalStats | null = null;
  private hudAcc = 0;
  private orbitT = 0;
  private soldierId = 1;
  private dustT = 0;

  private raycaster = new THREE.Raycaster();
  private flashTex: THREE.Texture;
  private keys = new Set<string>();
  private handlers: Array<[EventTarget, string, EventListener]> = [];

  // HUD مستقیم
  private minimap: HTMLCanvasElement | null = null;
  private mapBase: HTMLCanvasElement | null = null;
  private compassEl: HTMLElement | null = null;
  private compassLabels: Array<{ el: HTMLElement; deg: number }> = [];

  constructor(container: HTMLElement, hud: (s: Partial<HudState>) => void) {
    this.container = container;
    this.hud = hud;

    try {
      this.best = parseInt(localStorage.getItem("cwo-best") ?? "0", 10) || 0;
    } catch {
      this.best = 0;
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(74, container.clientWidth / container.clientHeight, 0.05, 1400);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.flashTex = this.makeGlowTexture();
    this.buildWorld();
    this.buildPickups();
    this.buildWeapons();
    this.bindEvents();
    this.spawnMenuActors();
    this.drawMapBase();
    void this.loadSoldier();
    void this.loadGroundTexture();
    this.bank.onSlot((slot, tpl) => this.upgradeSlot(slot, tpl));
    this.bank.onStatus = (l, t) => {
      this.assetsLoaded = l;
      this.assetsTotal = t;
      if (l > 0) this.propsSource = "polyhaven";
      if (!this.disposed) this.emitNow();
    };
    void this.bank.loadAll().then(() => {
      if (this.disposed) return;
      if (this.bank.loaded === 0) this.propsSource = "procedural";
      this.emitNow();
    });

    this.clock.start();
    this.loop();
    this.emitNow();
  }

  /* ================= بافت‌ها ================= */

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
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ================= ساخت دنیا ================= */

  private addBox(mesh: THREE.Mesh, x: number, z: number, w: number, d: number) {
    this.boxCols.push({ x, z, hw: w / 2, hd: d / 2 });
    this.blockers.push(mesh);
  }

  /** مانع نامرئی برای تست خط دید (مدل ظاهری جداست) */
  private addInvisibleBlocker(x: number, z: number, w: number, h: number, d: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, h / 2, z);
    this.scene.add(m);
    this.blockers.push(m);
  }

  private buildWorld() {
    this.scene.background = new THREE.Color(0xd8c69c);
    this.scene.fog = new THREE.Fog(0xd8c69c, 70, 330);

    const hemi = new THREE.HemisphereLight(0xe8e0c8, 0x8a7a55, 1.05);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xffe0b0, 2.1);
    this.sun.position.set(60, 90, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.far = 300;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // آسمان گرادیانی
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 20, 14),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x4f86b8) },
          mid: { value: new THREE.Color(0xc2cdb8) },
          bot: { value: new THREE.Color(0xe9d9ac) },
        },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
          void main(){ float h = normalize(vP).y;
            vec3 c = mix(bot, mid, smoothstep(-0.02, 0.14, h));
            c = mix(c, top, smoothstep(0.12, 0.65, h));
            gl_FragColor = vec4(c, 1.0); }`,
      })
    );
    this.scene.add(sky);

    // خورشید
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.flashTex, color: 0xfff3cf, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    sunSprite.position.set(380, 520, 190);
    sunSprite.scale.setScalar(240);
    this.scene.add(sunSprite);

    // زمین بزرگ
    const sandTex = this.makeSandTexture();
    sandTex.repeat.set(160, 160);
    this.groundMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1300, 1300), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildRoads();
    this.buildWalls();
    this.buildPlaza();
    this.buildContainers();
    this.buildResidential();
    this.buildOasis();
    this.buildRocks();
    this.scatterFlavor();
    this.buildMountains();
    this.buildDust();
  }

  private groundMat!: THREE.MeshStandardMaterial;

  private async loadGroundTexture() {
    const urls: string[] = [];
    const ph = await AssetBank.polyHavenTextureUrl("sand_01");
    if (ph) urls.push(ph);
    urls.push(
      "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sand_01/sand_01_diff_2k.jpg",
      "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/sand_01/sand_01_diff_1k.jpg"
    );
    for (const url of urls) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 9000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const blob = await res.blob();
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await img.decode();
        const tex = new THREE.Texture(img);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(160, 160);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        if (!this.disposed) {
          this.groundMat.map = tex;
          this.groundMat.needsUpdate = true;
        }
        return;
      } catch {
        /* بعدی */
      }
    }
  }

  /* --- سیستم جای‌گذاری مدل‌های دانلودی (Poly Haven CC0 / poly.pizza CC-BY) --- */

  private place(
    slot: SlotName,
    makeFallback: () => THREE.Object3D,
    x: number,
    z: number,
    ry = 0,
    targetH = SLOT_DEFS[slot].h ?? 1
  ): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    const fallback = makeFallback();
    group.add(fallback);
    this.scene.add(group);
    let list = this.placements.get(slot);
    if (!list) {
      list = [];
      this.placements.set(slot, list);
    }
    const rec = { group, targetH, fallback, upgraded: false };
    list.push(rec);
    const tpl = this.bank.get(slot);
    if (tpl) this.applyModel(rec, tpl);
    return group;
  }

  private applyModel(rec: { group: THREE.Group; targetH: number; fallback: THREE.Object3D; upgraded: boolean }, tpl: THREE.Object3D) {
    if (rec.upgraded || this.disposed) return;
    rec.group.remove(rec.fallback);
    const clone = tpl.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0.001) {
      const s = rec.targetH / size.y;
      clone.scale.multiplyScalar(s);
      clone.position.y -= box.min.y * s;
    }
    rec.group.add(clone);
    rec.upgraded = true;
  }

  private upgradeSlot(slot: SlotName, tpl: THREE.Object3D) {
    if (this.disposed) return;
    const list = this.placements.get(slot);
    if (list) for (const rec of list) this.applyModel(rec, tpl);
    if (slot === "wpn-ak") this.applyWeaponModel(0, tpl);
    if (slot === "wpn-pistol") this.applyWeaponModel(1, tpl);
    if (slot === "wpn-knife") this.applyWeaponModel(2, tpl);
    this.propsSource = "polyhaven";
    this.drawMapBase();
    this.emitNow();
  }

  private applyWeaponModel(idx: number, tpl: THREE.Object3D) {
    const body = this.gunBodies[idx];
    if (!body || body.userData.modelUpgraded) return;
    body.userData.modelUpgraded = true;
    for (let i = body.children.length - 1; i >= 0; i--) {
      const c = body.children[i];
      if (c !== this.muzzles[idx]) body.remove(c);
    }
    const clone = tpl.clone();
    body.add(clone);
    const mData = (tpl.userData as { muzzle?: THREE.Vector3 }).muzzle;
    if (mData) this.muzzles[idx].position.copy(mData);
  }

  /* --- سازنده‌های جایگزین (آفلاین) --- */

  private makeFallbackStall(i: number): THREE.Group {
    const canopyCols = [0xa83232, 0x3a6a8a, 0xc9a23a, 0x4a7a4a];
    const stall = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5c34, roughness: 0.95 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 1.8), woodMat);
    base.position.y = 0.55;
    base.castShadow = true;
    base.receiveShadow = true;
    stall.add(base);
    // سایه‌بان راه‌راه
    const c1 = canopyCols[i % canopyCols.length];
    const c2 = 0xe8ddc0;
    for (let k = 0; k < 4; k++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(4.2 / 4 + 0.01, 0.1, 2.6),
        new THREE.MeshStandardMaterial({ color: k % 2 === 0 ? c1 : c2, roughness: 0.9 })
      );
      stripe.position.set(-2.1 + (k + 0.5) * (4.2 / 4), 2.35, 0);
      stripe.rotation.x = 0.18;
      stripe.castShadow = true;
      stall.add(stripe);
    }
    for (const px of [-1.9, 1.9]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.35, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a22, roughness: 0.9 }));
      pole.position.set(px, 1.17, 1.1);
      stall.add(pole);
    }
    // اجناس روی پیشخوان
    const goodsCols = [0xc9a23a, 0xa83232, 0x4a7a4a, 0xd8b06a];
    for (let k = 0; k < 5; k++) {
      const gd = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 + Math.random() * 0.2, 0.24, 0.3),
        new THREE.MeshStandardMaterial({ color: goodsCols[(i + k) % goodsCols.length], roughness: 0.9 })
      );
      gd.position.set(-1.3 + k * 0.65, 1.22, 0.2 + (k % 2) * 0.3);
      gd.rotation.y = Math.random();
      gd.castShadow = true;
      stall.add(gd);
    }
    return stall;
  }

  private makeFallbackContainer(color: number): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x26262a, roughness: 0.7, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.6, 2.5), mat);
    body.position.y = 1.3;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // موج‌های ورق بدنه
    for (let k = 0; k < 9; k++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 2.56), dark);
      rib.position.set(-2.8 + k * 0.7, 1.3, 0);
      g.add(rib);
    }
    // ستون‌های گوشه و درب
    for (const cx of [-3.15, 3.15]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 2.56), dark);
      post.position.set(cx, 1.3, 0);
      g.add(post);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 2.2), dark);
    door.position.set(3.24, 1.25, 0);
    g.add(door);
    return g;
  }

  private makeFallbackHouse(color: number): THREE.Group {
    const g = new THREE.Group();
    const w = 14;
    const d = 11;
    const wallMat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x241f18, roughness: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), wallMat);
    body.position.y = 2.5;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // سقف نیمه‌فروریخته
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, d + 1), new THREE.MeshStandardMaterial({ color: 0x6e5a40, roughness: 1 }));
    roof.position.set(-0.6, 5.25, 0.3);
    roof.rotation.z = 0.05;
    roof.rotation.y = 0.03;
    roof.castShadow = true;
    g.add(roof);
    // پنجره‌ها (حفره‌ی تاریک + قاب)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a3620, roughness: 0.9 });
    for (const [wx, wz, ry] of [[-4, -d / 2 - 0.05, 0], [4, -d / 2 - 0.05, 0], [-w / 2 - 0.05, 0, Math.PI / 2]] as Array<[number, number, number]>) {
      const hole = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 0.25), darkMat);
      hole.position.set(wx, 3.1, wz);
      hole.rotation.y = ry;
      g.add(hole);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(2, 0.16, 0.4), frameMat);
      sill.position.set(wx, 2.2, wz);
      sill.rotation.y = ry;
      g.add(sill);
    }
    // درگاه
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.3), frameMat);
    door.position.set(0, 1.3, -d / 2 - 0.12);
    g.add(door);
    // ترک و میلگرد و آوار پای دیوار
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.1), darkMat);
    crack.position.set(5.5, 2.6, -d / 2 - 0.02);
    crack.rotation.z = 0.28;
    g.add(crack);
    for (let k = 0; k < 3; k++) {
      const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.6, metalness: 0.5 }));
      rb.position.set(-5 + k * 1.2, 5.6, 1.5 - k);
      rb.rotation.set(0.4 + k * 0.3, 0, -0.5 + k * 0.4);
      g.add(rb);
    }
    for (let k = 0; k < 4; k++) {
      const rub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.3, 0), wallMat);
      rub.position.set(-6 + k * 3.5 + Math.random(), 0.25, -d / 2 - 1 + Math.random());
      rub.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      rub.castShadow = true;
      g.add(rub);
    }
    return g;
  }

  private makeFallbackRock(r: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 1, flatShading: true }));
    m.position.y = r * 0.5;
    m.scale.y = 0.62 + Math.random() * 0.2;
    m.rotation.set(Math.random(), Math.random() * 3, Math.random());
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  private makeFallbackCrate(s: number): THREE.Group {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6b3f, roughness: 0.95 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x5e4828, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), wood);
    body.position.y = s / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // تخته‌ها و مهاربند
    for (const fy of [0.18, 0.5, 0.82]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(s + 0.04, s * 0.12, s + 0.04), darkWood);
      plank.position.y = s * fy;
      g.add(plank);
    }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, s * 1.35, 0.08), darkWood);
    brace.position.set(0, s / 2, s / 2 + 0.03);
    brace.rotation.z = 0.72;
    g.add(brace);
    return g;
  }

  private makeFallbackBarrel(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a4632, roughness: 0.75, metalness: 0.2 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 1.05, 12), mat);
    m.position.y = 0.52;
    m.castShadow = true;
    g.add(m);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x3e2c1e, roughness: 0.6, metalness: 0.35 });
    for (const ry of [0.22, 0.52, 0.82]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.465, 0.465, 0.05, 12), ringMat);
      ring.position.y = ry;
      g.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), ringMat);
    cap.position.set(0.15, 1.06, 0.1);
    g.add(cap);
    return g;
  }

  private makeFallbackPallet(): THREE.Group {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6b3f, roughness: 0.95 });
    for (let k = 0; k < 5; k++) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.24), wood);
      top.position.set(0, 0.14, -0.6 + k * 0.3);
      top.castShadow = true;
      g.add(top);
    }
    for (const bx of [-0.55, 0, 0.55]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 1.5), wood);
      block.position.set(bx, 0.05, 0);
      g.add(block);
    }
    return g;
  }

  private makeFallbackSandbag(): THREE.Group {
    const g = new THREE.Group();
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xb3a276, roughness: 1 });
    const bagMat2 = new THREE.MeshStandardMaterial({ color: 0xa3946a, roughness: 1 });
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 4; k++) {
        const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), row % 2 === 0 ? bagMat : bagMat2);
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = (Math.random() - 0.5) * 0.25;
        bag.position.set(-1.35 + k * 0.9 + (row % 2) * 0.4, 0.22 + row * 0.4, (Math.random() - 0.5) * 0.12);
        bag.scale.y = 0.85;
        bag.castShadow = true;
        bag.receiveShadow = true;
        g.add(bag);
      }
    }
    return g;
  }

  private makeFallbackTower(): THREE.Group {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.9 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0x77603c, roughness: 0.9 });
    const t = new THREE.Group();
    for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]] as Array<[number, number]>) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), legMat);
      leg.position.set(lx, 4, lz);
      leg.castShadow = true;
      t.add(leg);
    }
    const plat = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 4.6), topMat);
    plat.position.y = 8;
    plat.castShadow = true;
    t.add(plat);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.8, 4), topMat);
    roof.position.y = 9.6;
    roof.rotation.y = Math.PI / 4;
    t.add(roof);
    return t;
  }

  private makeFallbackTruck(): THREE.Group {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6e7a52, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a26, roughness: 0.9 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 3.4), bodyMat);
    bed.position.set(0, 0.75, 0.4);
    bed.castShadow = true;
    g.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 1.5), bodyMat);
    cab.position.set(0, 1.05, -1.6);
    cab.castShadow = true;
    g.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x2a3a44, roughness: 0.2, metalness: 0.4 }));
    glass.position.set(0, 1.25, -2.36);
    g.add(glass);
    for (const [wx, wz] of [[-1.05, -1.5], [1.05, -1.5], [-1.05, 1.3], [1.05, 1.3]] as Array<[number, number]>) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12), darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      wheel.castShadow = true;
      g.add(wheel);
    }
    return g;
  }

  private makeFallbackLamp(): THREE.Group {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.7, metalness: 0.4 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.4, 8), poleMat);
    pole.position.y = 2.2;
    pole.castShadow = true;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 0.09), poleMat);
    arm.position.set(0.55, 4.35, 0);
    g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.4, emissive: 0x554422, emissiveIntensity: 0.35 }));
    head.position.set(1.05, 4.28, 0);
    g.add(head);
    return g;
  }

  private makePalm(): THREE.Group {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3e6e34, roughness: 0.9, side: THREE.DoubleSide });
    const h = 6.5 + Math.random() * 2;
    const segs = 4;
    let lean = 0;
    for (let i = 0; i < segs; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.03, 0.26 - i * 0.03, h / segs, 7), trunkMat);
      lean += 0.1;
      s.position.set(Math.sin(lean) * i * 0.3, (h / segs) * (i + 0.5), 0);
      s.rotation.z = -lean * 0.4;
      s.castShadow = true;
      g.add(s);
    }
    const topY = h + 0.2;
    const topX = Math.sin(lean) * segs * 0.3;
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4, 1, true), leafMat);
      leaf.position.set(topX, topY, 0);
      leaf.rotation.z = Math.PI / 2 - 0.55;
      leaf.rotation.y = (i / 7) * Math.PI * 2;
      leaf.castShadow = true;
      g.add(leaf);
    }
    return g;
  }

  private makeGrenadeBody(): THREE.Group {
    const g = new THREE.Group();
    const tpl = this.bank.get("grenade");
    if (tpl) {
      g.add(tpl.clone());
      return g;
    }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x3e4a2e, roughness: 0.55, metalness: 0.3 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x888474, roughness: 0.4, metalness: 0.6 }));
    cap.position.y = 0.14;
    g.add(body, cap);
    return g;
  }

  /* اشیای پراکنده‌ی طعم‌دار (بشکه، پالت، چراغ، کامیون) */
  private scatterFlavor() {
    const zones: Array<[number, number, number, number, number]> = [
      [-45, 45, -45, 45, 8],
      [70, 160, -160, -70, 7],
      [-160, -70, 70, 160, 7],
      [-150, -60, -150, -60, 5],
    ];
    for (const [x0, x1, z0, z1, n] of zones) {
      for (let i = 0; i < n; i++) {
        const x = x0 + Math.random() * (x1 - x0);
        const z = z0 + Math.random() * (z1 - z0);
        if (this.pointBlocked(x, z, 1.3)) continue;
        const pick = Math.random();
        const ry = Math.random() * Math.PI * 2;
        if (pick < 0.4) {
          this.place("barrel", () => this.makeFallbackBarrel(), x, z, ry, 1.05 + Math.random() * 0.2);
          this.cirCols.push({ x, z, r: 0.65 });
        } else if (pick < 0.7) {
          this.place("pallet", () => this.makeFallbackPallet(), x, z, ry, 0.5);
          this.cirCols.push({ x, z, r: 0.9 });
        } else {
          this.place("crate", () => this.makeFallbackCrate(1.3), x, z, ry, 1.3);
          this.cirCols.push({ x, z, r: 0.85 });
        }
      }
    }
    // کامیون‌های پارک‌شده
    const trucks: Array<[number, number, number]> = [[30, -95, 0.6], [-95, 30, -2.2], [135, -45, 1.4]];
    for (const [x, z, ry] of trucks) {
      this.place("truck", () => this.makeFallbackTruck(), x, z, ry, 2.1);
      this.boxCols.push({ x, z, hw: 2.4, hd: 1.5 });
    }
    // چراغ‌های خیابان کنار جاده‌ها
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      this.place("lamp", () => this.makeFallbackLamp(), 7.5, i * 42, Math.PI, 4.5);
      this.place("lamp", () => this.makeFallbackLamp(), i * 42, -7.5, Math.PI / 2, 4.5);
      this.cirCols.push({ x: 7.5, z: i * 42, r: 0.25 });
      this.cirCols.push({ x: i * 42, z: -7.5, r: 0.25 });
    }
    // دیوارهای خرابه
    const walls: Array<[number, number, number]> = [
      [-60, 40, 0.4], [50, 55, -1.2], [-45, -55, 2.2], [62, -38, 0.9],
      [-30, 95, 1.8], [95, 60, -0.6], [-95, -30, 0.2], [35, 120, 2.6],
    ];
    walls.forEach(([x, z, ry], i) => {
      const gw = this.makeRuinWall(i);
      gw.position.set(x, 0, z);
      gw.rotation.y = ry;
      this.scene.add(gw);
      const dx = Math.sin(ry) * 2.2;
      const dz = Math.cos(ry) * 2.2;
      this.cirCols.push({ x: x + dx, z: z + dz, r: 1.6 }, { x: x - dx, z: z - dz, r: 1.6 });
      const blk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.4, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      blk.position.set(x, 1.7, z);
      blk.rotation.y = ry;
      this.scene.add(blk);
      this.blockers.push(blk);
    });
    // لاشه‌ی خودروهای سوخته
    const wrecks: Array<[number, number, number]> = [[4.5, -60, 0.35], [-3.5, 70, 2.8], [60, 4.5, 1.7], [-70, -3.5, 1.2], [115, -70, 0.8]];
    for (const [x, z, ry] of wrecks) {
      const car = this.makeCarWreck();
      car.position.set(x, 0, z);
      car.rotation.y = ry;
      this.scene.add(car);
      this.boxCols.push({ x, z, hw: 2.3, hd: 1.3 });
    }
    // گودال‌های انفجار
    const craters: Array<[number, number, number]> = [[20, -25, 2.4], [-28, 18, 2], [85, -105, 3], [-100, 105, 2.6], [120, 120, 2.2], [-20, -90, 2.8]];
    for (const [x, z, r] of craters) {
      const cr = this.makeCrater(r);
      cr.position.set(x, 0, z);
      this.scene.add(cr);
    }
    // توده‌های آوار
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 30 + Math.random() * 120;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (this.pointBlocked(x, z, 1)) continue;
      const rp = this.makeRubblePile();
      rp.position.set(x, 0, z);
      rp.rotation.y = Math.random() * 6;
      this.scene.add(rp);
      this.cirCols.push({ x, z, r: 0.9 });
    }
  }

  /* --- خرابه‌ها و جزئیات جنگی --- */

  private makeRuinWall(seed: number): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xa89878, roughness: 1 });
    const darkM = new THREE.MeshStandardMaterial({ color: 0x4a3f30, roughness: 1 });
    const seg = (sw: number, sh: number, sd: number, x: number, y: number, z: number, m = mat) => {
      const mm = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), m);
      mm.position.set(x, y, z);
      mm.castShadow = true;
      mm.receiveShadow = true;
      g.add(mm);
      return mm;
    };
    const len = 5 + (seed % 3);
    seg(len, 2.6, 0.5, 0, 1.3, 0);
    seg(len * 0.6, 0.9, 0.5, -len * 0.2, 3.05, 0);
    seg(len * 0.3, 0.6, 0.5, len * 0.28, 2.9, 0);
    seg(1.1, 1.2, 0.55, -len * 0.18, 1.7, 0, darkM);
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.22, 0), mat);
      r.position.set((Math.random() - 0.5) * len, 0.2, (Math.random() - 0.5) * 1.6 + 0.6);
      r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      r.castShadow = true;
      g.add(r);
    }
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.6, metalness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), rebarMat);
      rb.position.set(-len * 0.3 + i * len * 0.3, 3.3 + (i % 2) * 0.2, 0);
      rb.rotation.z = (Math.random() - 0.5) * 0.5;
      g.add(rb);
    }
    return g;
  }

  private makeCarWreck(): THREE.Group {
    const g = new THREE.Group();
    const rust = new THREE.MeshStandardMaterial({ color: 0x7a4a32, roughness: 0.95 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.2), rust);
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 1.9), rust);
    cab.position.set(0.1, 1.1, -0.3);
    cab.rotation.z = 0.14;
    cab.rotation.y = 0.06;
    cab.castShadow = true;
    g.add(cab);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x1a2026, roughness: 0.3 }));
    glass.position.set(0.05, 1.15, -1.28);
    glass.rotation.z = 0.14;
    g.add(glass);
    for (const [wx, wz] of [[-0.95, -1.4], [0.95, -1.4], [-0.95, 1.4], [0.95, 1.4]] as Array<[number, number]>) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.26, 10), dark);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.3, wz);
      wh.castShadow = true;
      g.add(wh);
    }
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.7, 18), new THREE.MeshStandardMaterial({ color: 0x1e1a14, roughness: 1 }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.02;
    g.add(scorch);
    return g;
  }

  private makeCrater(r: number): THREE.Group {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.28, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.12;
    rim.castShadow = true;
    g.add(rim);
    const pit = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 18), new THREE.MeshStandardMaterial({ color: 0x35301f, roughness: 1 }));
    pit.rotation.x = -Math.PI / 2;
    pit.position.y = 0.03;
    g.add(pit);
    for (let i = 0; i < 5; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.25, 0), new THREE.MeshStandardMaterial({ color: 0x6e6248, roughness: 1, flatShading: true }));
      const a = Math.random() * Math.PI * 2;
      rock.position.set(Math.cos(a) * (r + 0.4), 0.18, Math.sin(a) * (r + 0.4));
      rock.castShadow = true;
      g.add(rock);
    }
    return g;
  }

  private makeRubblePile(): THREE.Group {
    const g = new THREE.Group();
    const mats = [0x8a7a62, 0x9a8a70, 0x7a6a52].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
    for (let i = 0; i < 6; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.32, 0), mats[i % mats.length]);
      rock.position.set((Math.random() - 0.5) * 1.8, 0.16 + Math.random() * 0.25, (Math.random() - 0.5) * 1.8);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      g.add(rock);
    }
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 5), new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.6, metalness: 0.5 }));
    rb.position.set(0.3, 0.5, 0.2);
    rb.rotation.set(0.5, 0, 0.8);
    g.add(rb);
    return g;
  }



  /* --- سازه‌های نقشه --- */

  private buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x6f6754, roughness: 1 });
    const mk = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), roadMat);
      m.position.set(x, 0.04, z);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    mk(10, WALL * 2 + 10, 0, 0);
    mk(WALL * 2 + 10, 10, 0, 0);
    mk(10, 160, 115, -115 + 45);
    mk(160, 10, -115 + 45, 115);
  }

  private buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xbfae87, roughness: 0.95 });
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x8f7d59, roughness: 1 });
    const defs: Array<[number, number, number, number]> = [
      [0, -WALL, WALL * 2 + 3, 1.6],
      [0, WALL, WALL * 2 + 3, 1.6],
      [-WALL, 0, 1.6, WALL * 2 + 3],
      [WALL, 0, 1.6, WALL * 2 + 3],
    ];
    for (const [x, z, w, d] of defs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.4, d), wallMat);
      wall.position.set(x, 2.7, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.addBox(wall, x, z, w, d);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), lipMat);
      lip.position.set(x, 5.55, z);
      this.scene.add(lip);
    }
    // برج‌های دیده‌بانی (مدل دانلودی با جایگزین رویه‌ساز)
    for (const [tx, tz] of [[-WALL + 4, -WALL + 4], [WALL - 4, -WALL + 4], [-WALL + 4, WALL - 4], [WALL - 4, WALL - 4]] as Array<[number, number]>) {
      this.place("tower", () => this.makeFallbackTower(), tx, tz, Math.atan2(tx, tz), 10.5);
      for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]] as Array<[number, number]>) {
        this.cirCols.push({ x: tx + lx, z: tz + lz, r: 0.4 });
      }
    }
  }

  private buildPlaza() {
    // زمین میدان
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(44, 40),
      new THREE.MeshStandardMaterial({ color: 0xb49c72, roughness: 1 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.05;
    pad.receiveShadow = true;
    this.scene.add(pad);

    // چشمه
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.6, 0.9, 22),
      new THREE.MeshStandardMaterial({ color: 0xa8987a, roughness: 0.95 })
    );
    basin.position.set(0, 0.45, 0);
    basin.castShadow = true;
    basin.receiveShadow = true;
    this.scene.add(basin);
    this.cirCols.push({ x: 0, z: 0, r: 4.6 });
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 22),
      new THREE.MeshStandardMaterial({ color: 0x3d7c92, roughness: 0.15, metalness: 0.15 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.92, 0);
    this.scene.add(water);
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 2.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xa8987a, roughness: 0.9 })
    );
    col.position.set(0, 2, 0);
    col.castShadow = true;
    this.scene.add(col);

    // غرفه‌های بازار (مدل دانلودی با جایگزین رویه‌ساز)
    const stallSpots: Array<[number, number, number]> = [
      [-16, -14, 0.4], [16, -14, -0.3], [-16, 14, 2.7], [16, 14, 3.4],
      [-26, 0, 1.57], [26, 0, -1.57], [0, -26, 0], [0, 26, 3.14],
    ];
    stallSpots.forEach(([x, z, ry], i) => {
      this.place("stall", () => this.makeFallbackStall(i), x, z, ry, 2.7);
      this.boxCols.push({ x, z, hw: 1.8, hd: 0.9 });
      this.addInvisibleBlocker(x, z, 3.6, 2.4, 1.8);
    });

    // جعبه‌ها و کیسه‌شن (مدل دانلودی با جایگزین رویه‌ساز)
    const crates: Array<[number, number, number, number]> = [
      [-8, -6, 2.2, 1], [8, -7, 2, 1], [-9, 7, 2, 2], [9, 8, 2.4, 1],
      [-22, -20, 2, 1], [22, -19, 2.2, 1], [-21, 20, 2, 2], [21, 21, 2, 1],
      [-33, -8, 2.2, 1], [33, 9, 2, 2], [-12, -24, 2, 1], [12, 25, 2, 1],
      [30, -28, 2.4, 2], [-30, 27, 2, 1],
    ];
    for (const [x, z, s, stack] of crates) {
      for (let k = 0; k <= stack; k++) {
        const ss = s - k * 0.3;
        this.place("crate", () => this.makeFallbackCrate(ss), x, z, k * 0.3 + Math.random() * 0.2, ss);
        const g = this.placements.get("crate")!;
        if (k > 0) g[g.length - 1].group.position.y = k * s;
      }
      this.boxCols.push({ x, z, hw: s / 2, hd: s / 2 });
      this.addInvisibleBlocker(x, z, s, s * (stack + 1), s);
    }
    const bags: Array<[number, number, number]> = [
      [-5, -18, 0], [5, 18, 0], [-19, 4, 1.57], [19, -4, 1.57], [-36, -16, 0.6], [36, 16, -0.5],
    ];
    for (const [x, z, ry] of bags) {
      this.place("sandbag", () => this.makeFallbackSandbag(), x, z, ry, 1);
      this.boxCols.push({ x, z, hw: 2, hd: 0.45 });
      this.addInvisibleBlocker(x, z, 4, 1, 0.9);
    }
  }

  private buildContainers() {
    const cols = [0x8a4a3a, 0x4a6a52, 0x5a5a6e, 0x9a7a3a, 0x6e3a3a, 0x3a5a6e];
    let ci = 0;
    for (let row = 0; row < 5; row++) {
      const x = 80 + row * 17;
      const n = 3 - (row % 2);
      for (let k = 0; k < n; k++) {
        const z = -150 + k * 26;
        const stacked = (row + k) % 3 === 0;
        for (let h = 0; h < (stacked ? 2 : 1); h++) {
          const col = cols[ci++ % cols.length];
          const g = this.place("container", () => this.makeFallbackContainer(col), x, z, (row % 2) * 0.12, 2.6);
          g.position.y = h * 2.6;
          if (h === 0) {
            this.boxCols.push({ x, z, hw: 3.3, hd: 1.35 });
            this.addInvisibleBlocker(x, z, 6.6, stacked ? 5.2 : 2.6, 2.7);
          }
        }
      }
    }
    // جرثقیل تزئینی
    const crane = new THREE.Group();
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xc9a23a, roughness: 0.7 });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 18, 1.2), craneMat);
    mast.position.y = 9;
    mast.castShadow = true;
    crane.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 0.9), craneMat);
    arm.position.set(6, 17.5, 0);
    crane.add(arm);
    crane.position.set(150, 0, -90);
    this.scene.add(crane);
    this.cirCols.push({ x: 150, z: -90, r: 1 });
  }

  private buildResidential() {
    const wallCols = [0xb09878, 0xa08868, 0x9a8a70, 0x8f7d62];
    let hi = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = -146 + i * 27;
        const z = 84 + j * 27;
        const col = wallCols[hi++ % wallCols.length];
        this.place("house", () => this.makeFallbackHouse(col), x, z, ((i + j) % 2) * 0.16, 6.2);
        this.boxCols.push({ x, z, hw: 7, hd: 5.5 });
        this.addInvisibleBlocker(x, z, 14, 5, 11);
      }
    }
  }

  private buildOasis() {
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(ZONES.oasis.r, 36),
      new THREE.MeshStandardMaterial({ color: 0x7c8a4c, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(ZONES.oasis.cx, 0.04, ZONES.oasis.cz);
    grass.receiveShadow = true;
    this.scene.add(grass);

    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(11, 26),
      new THREE.MeshStandardMaterial({ color: 0x35718a, roughness: 0.12, metalness: 0.2 })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(ZONES.oasis.cx, 0.07, ZONES.oasis.cz);
    this.scene.add(pond);
    this.cirCols.push({ x: ZONES.oasis.cx, z: ZONES.oasis.cz, r: 11 });

    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * Math.PI * 2;
      const r = 15 + ((i * 37) % 20);
      const x = ZONES.oasis.cx + Math.cos(a) * r;
      const z = ZONES.oasis.cz + Math.sin(a) * r;
      this.place("palm", () => this.makePalm(), x, z, Math.random() * Math.PI * 2, 6.5 + Math.random() * 2.5);
      this.cirCols.push({ x, z, r: 0.5 });
    }
  }

  private buildRocks() {
    for (let i = 0; i < 17; i++) {
      const x = ZONES.rocks.x0 + Math.random() * (ZONES.rocks.x1 - ZONES.rocks.x0);
      const z = ZONES.rocks.z0 + Math.random() * (ZONES.rocks.z1 - ZONES.rocks.z0);
      const r = 1.6 + Math.random() * 2.6;
      this.place("rock", () => this.makeFallbackRock(r), x, z, Math.random() * 3, r * 1.5);
      this.cirCols.push({ x, z, r: r * 0.95 });
      this.addInvisibleBlocker(x, z, r * 1.7, r * 1.1, r * 1.7);
    }
    // تپه‌های شنی
    const duneMat = new THREE.MeshStandardMaterial({ color: 0xc6ad82, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.5;
      const m = new THREE.Mesh(new THREE.SphereGeometry(26 + (i % 3) * 10, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), duneMat);
      m.scale.y = 0.14;
      m.position.set(Math.cos(a) * 150, 0, Math.sin(a) * 150);
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  private buildMountains() {
    const mMat = new THREE.MeshStandardMaterial({ color: 0xa3906a, roughness: 1, flatShading: true, fog: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      const r = 300 + Math.sin(i * 12.9) * 26;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(34 + (i % 4) * 12, 30 + (i % 3) * 26, 5), mMat);
      cone.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      cone.rotation.y = i * 1.7;
      this.scene.add(cone);
    }
  }

  private buildDust() {
    const n = 500;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 90;
      arr[i * 3 + 1] = Math.random() * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({ color: 0xe4d3ab, size: 0.12, transparent: true, opacity: 0.38, depthWrite: false })
    );
    this.scene.add(this.dust);
  }

  /* --- آیتم‌ها --- */

  private buildPickups() {
    const defs: Array<[Pickup["kind"], number, number]> = [
      ["health", -30, -30], ["health", 120, -120], ["health", -120, 120],
      ["armor", 30, 30], ["armor", -100, -140], ["armor", 140, 100],
      ["ammo", -14, 14], ["ammo", 95, -95], ["ammo", -95, 95], ["ammo", 60, 60],
      ["grenade", 14, -14], ["grenade", -60, -60],
    ];
    for (const [kind, x, z] of defs) {
      const g = new THREE.Group();
      const baseCol = kind === "health" ? 0x2e8b3a : kind === "armor" ? 0x2e6bb0 : kind === "ammo" ? 0xc9922e : 0x5a6e3a;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.5, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.7 })
      );
      g.add(box);
      if (kind === "health") {
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.74), new THREE.MeshStandardMaterial({ color: baseCol, roughness: 0.6 }));
        const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: baseCol, roughness: 0.6 }));
        c1.position.y = 0.24;
        c2.position.y = 0.24;
        g.add(c1, c2);
      } else if (kind === "grenade") {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: baseCol, roughness: 0.5 }));
        ball.position.y = 0.42;
        g.add(ball);
      } else {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.72), new THREE.MeshStandardMaterial({ color: baseCol, roughness: 0.6 }));
        stripe.position.y = 0.1;
        g.add(stripe);
      }
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      g.position.set(x, 0.55, z);
      this.scene.add(g);
      this.pickups.push({ kind, mesh: g, pos: new THREE.Vector3(x, 0, z), taken: false, respawnT: 0, baseY: 0.55 });
    }
  }

  /* ================= سربازها ================= */

  private makeFlashSprite(): THREE.Sprite {
    return new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.flashTex, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
  }

  private randomPatrolPoint(): THREE.Vector3 {
    const zones = [ZONES.plaza, ZONES.cont, ZONES.res, ZONES.rocks];
    for (let tries = 0; tries < 10; tries++) {
      const pick = Math.random();
      let x = 0;
      let z = 0;
      if (pick < 0.35) {
        x = ZONES.plaza.x0 + Math.random() * 90;
        z = ZONES.plaza.z0 + Math.random() * 90;
      } else if (pick < 0.85) {
        const zn = zones[1 + Math.floor(Math.random() * 3)];
        x = zn.x0 + Math.random() * (zn.x1 - zn.x0);
        z = zn.z0 + Math.random() * (zn.z1 - zn.z0);
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = 55 + Math.random() * 90;
        x = ZONES.oasis.cx + Math.cos(a) * r;
        z = ZONES.oasis.cz + Math.sin(a) * r;
      }
      if (!this.pointBlocked(x, z, 0.7)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  private pointBlocked(x: number, z: number, r: number): boolean {
    for (const b of this.boxCols) {
      if (Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r) return true;
    }
    for (const c of this.cirCols) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    }
    return false;
  }

  private spawnSoldier(team: "enemy" | "ally", etype: EType, at: THREE.Vector3, waveNum: number, nameIdx = 0): Soldier {
    const root = new THREE.Group();
    root.position.copy(at);
    const def = ETYPES[etype];
    const maxHp = team === "ally" ? 150 : def.hp(waveNum);
    const s: Soldier = {
      id: this.soldierId++,
      team,
      etype,
      name: team === "ally" ? ALLY_NAMES[nameIdx % ALLY_NAMES.length] : def.label,
      root,
      visual: new THREE.Group(),
      rig: null,
      bones: null,
      mixer: null,
      actions: { idle: null, walk: null, run: null },
      band: "idle",
      wkind: pickWeaponKind(team, etype, nameIdx),
      hitMeshes: [],
      hp: maxHp,
      maxHp,
      dead: false,
      removed: false,
      deathT: 0,
      fallSign: Math.random() < 0.5 ? -1 : 1,
      yaw: Math.random() * Math.PI * 2,
      speed: 0,
      fireT: 0.6 + Math.random(),
      burstLeft: 0,
      burstPause: 0,
      meleeCd: 0,
      los: false,
      losT: Math.random() * 0.25,
      alerted: team === "ally",
      waypoint: this.randomPatrolPoint(),
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafePhase: Math.random() * 6,
      target: null,
      retargetT: 0,
      flash: this.makeFlashSprite(),
      flashT: 0,
      ring: new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.55, 20),
        new THREE.MeshBasicMaterial({ color: team === "ally" ? 0x4fc96a : 0xd8402e, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      ),
      radius: 0.42 * def.scale,
      scale: def.scale,
      gone: false,
    };
    s.ring.rotation.x = -Math.PI / 2;
    s.ring.position.y = 0.06;
    s.ring.scale.setScalar(def.scale);
    root.add(s.ring);
    root.add(s.visual);
    s.flash.position.set(0, 1.35 * def.scale, 0.55 * def.scale);
    s.flash.scale.setScalar(0.01);
    root.add(s.flash);
    root.rotation.y = s.yaw;

    this.attachVisual(s);
    this.soldiers.push(s);
    this.scene.add(root);
    return s;
  }

  private attachVisual(s: Soldier) {
    if (!this.soldierBuffer) {
      this.attachProcedural(s);
      return;
    }
    void this.attachGlb(s);
  }

  private attachProcedural(s: Soldier) {
    if (s.gone) return;
    const rig = createProceduralSoldier(s.id);
    s.rig = rig;
    for (const m of rig.hitMeshes) {
      m.userData.soldier = s;
      s.hitMeshes.push(m);
    }
    const inner = new THREE.Group();
    inner.add(rig.root);
    s.visual.add(inner);
    if (s.team === "ally") {
      rig.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) (m.material as THREE.MeshStandardMaterial).color.multiply(new THREE.Color(ALLY_TINT));
      });
    }
    // سلاح متنوع به‌جای تفنگ پیش‌فرض
    for (const c of rig.gun.children) if (c !== rig.muzzle) c.visible = false;
    const w = this.makeSoldierWeapon(s.wkind);
    w.rotation.y = Math.PI; // مدل رویه‌ساز رو به +Z است
    w.position.set(0, 0, 0.28);
    rig.gun.add(w);
  }

  /* ---------- ریگ استخوانی دستی (تضمین ضد تی‌پوز) ----------
     به‌جای وابستگی به کلیپ‌های انیمیشن، استخوان‌های Mixamo را پیدا
     می‌کنیم و هر فریم مستقیم می‌چرخانیم: راه‌رفتن، دویدن، نشانه‌گیری
     و لگد اسلحه. اگر استخوانی پیدا نشود، سرباز رویه‌ساز جایگزین است. */

  private findBone(root: THREE.Object3D, suffixes: string[]): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (found) return;
      const n = o.name.toLowerCase().replace(/mixamorig:?/g, "").replace(/[^a-z0-9]/g, "");
      if (n && suffixes.some((sfx) => n.endsWith(sfx))) found = o;
    });
    return found;
  }

  private setupBones(s: Soldier, model: THREE.Object3D) {
    const b: BoneRig = {
      hips: this.findBone(model, ["hips"]),
      chest: this.findBone(model, ["chest", "spine2", "spine1"]),
      head: this.findBone(model, ["head"]),
      armL: this.findBone(model, ["leftarm"]),
      armR: this.findBone(model, ["rightarm"]),
      foreL: this.findBone(model, ["leftforearm"]),
      foreR: this.findBone(model, ["rightforearm"]),
      legL: this.findBone(model, ["leftupleg"]),
      legR: this.findBone(model, ["rightupleg"]),
      kneeL: this.findBone(model, ["leftleg"]),
      kneeR: this.findBone(model, ["rightleg"]),
      handR: this.findBone(model, ["righthand"]),
      hipsY: 0,
      phase: Math.random() * 10,
      aimK: 0,
      recoil: 0,
    };
    if (b.hips) b.hipsY = b.hips.position.y;
    // حالت استراحت: بازوها پایین — مدل هرگز تی‌پوز نمی‌ماند
    if (b.armR) {
      b.armR.rotation.set(0, 0, -1.3);
    }
    if (b.armL) {
      b.armL.rotation.set(0, 0, 1.3);
    }
    if (b.foreR) b.foreR.rotation.z = -0.12;
    if (b.foreL) b.foreL.rotation.z = 0.12;
    s.bones = b;
  }

  private updateBones(b: BoneRig, dt: number, speed: number, aiming: boolean, isRunner: boolean) {
    const k = THREE.MathUtils.clamp(speed / (isRunner ? 5.5 : 3.4), 0, 1);
    b.phase += dt * (4.5 + speed * 1.4);
    const sw = Math.sin(b.phase);
    b.aimK += ((aiming ? 1 : 0) - b.aimK) * Math.min(1, dt * 7);
    const a = b.aimK;
    const w = 1 - a;
    if (b.legL && b.legR) {
      b.legL.rotation.x = sw * 0.5 * k * w + a * 0.05;
      b.legR.rotation.x = -sw * 0.5 * k * w - a * 0.1;
    }
    if (b.kneeL && b.kneeR) {
      b.kneeL.rotation.x = Math.max(0, -sw) * 0.65 * k * w + a * 0.1;
      b.kneeR.rotation.x = Math.max(0, sw) * 0.65 * k * w + a * 0.22;
    }
    if (b.hips) b.hips.position.y = b.hipsY + Math.abs(Math.cos(b.phase)) * 0.035 * k * w;
    if (b.chest) b.chest.rotation.x = (0.1 * k + sw * 0.02 * k) * w + 0.06 * a;
    if (b.head) b.head.rotation.x = -0.08 * a;
    if (b.armL && b.armR) {
      const amp = 0.42 * k * w;
      b.armL.rotation.x = -sw * amp - 1.1 * a;
      b.armR.rotation.x = sw * amp - 0.5 * a - b.recoil;
      b.armL.rotation.z = 1.3 * w + 0.55 * a;
      b.armR.rotation.z = -1.3 * w - 0.7 * a;
      b.armL.rotation.y = -0.55 * a;
      b.armR.rotation.y = 0.35 * a;
    }
    if (b.foreL && b.foreR) {
      const eb = 0.4 * k * w;
      b.foreL.rotation.x = -0.12 * w - Math.max(0, sw) * eb - 0.55 * a;
      b.foreR.rotation.x = -0.12 * w - Math.max(0, -sw) * eb - 0.3 * a;
      b.foreL.rotation.z = 0.12 * w - 0.25 * a;
      b.foreR.rotation.z = -0.12 * w;
    }
    b.recoil *= Math.exp(-13 * dt);
  }

  /* ---------- تعویض نرم انیمیشن Mixamo ---------- */

  private setBand(s: Soldier, band: Soldier["band"]) {
    s.band = band;
    for (const key of ["idle", "walk", "run"] as const) {
      const a = s.actions[key];
      if (!a) continue;
      if (key === band) {
        a.enabled = true;
        a.setEffectiveTimeScale(1);
        a.fadeIn(0.22);
      } else {
        a.fadeOut(0.22);
      }
    }
  }

  /* ---------- سلاح سربازها (نسخه‌ی رویه‌ساز) ---------- */

  private makeSoldierWeapon(kind: WKind): THREE.Group {
    const slot: SlotName = kind === "pistol" ? "wpn-pistol" : kind === "knife" ? "wpn-knife" : "wpn-ak";
    const dl = this.bank.instantiate(slot);
    if (dl) return dl as THREE.Group;
    return this.buildProcWeapon(kind);
  }

  /** سلاح رویه‌ساز با جزئیات — لوله رو به -Z */
  private buildProcWeapon(kind: WKind): THREE.Group {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.4, metalness: 0.6 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6e4a26, roughness: 0.85 });
    const olive = new THREE.MeshStandardMaterial({ color: 0x4a5238, roughness: 0.8 });
    const B = (bw: number, bh: number, bd: number, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    };
    if (kind === "pistol") {
      B(0.045, 0.06, 0.24, metal, 0, 0.02, -0.04);
      const grip = B(0.04, 0.13, 0.06, dark, 0, -0.07, 0.05);
      grip.rotation.x = 0.3;
      B(0.02, 0.03, 0.02, dark, 0, 0.06, -0.14);
    } else if (kind === "knife") {
      const blade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.028, 0.24, 4),
        new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 0.9 })
      );
      blade.rotation.x = Math.PI / 2;
      blade.rotation.y = Math.PI / 4;
      blade.position.set(0, 0.01, -0.18);
      g.add(blade);
      B(0.07, 0.02, 0.02, dark, 0, 0, -0.05);
      B(0.035, 0.04, 0.13, wood, 0, -0.005, 0.05);
    } else {
      const L = kind === "smg" ? 0.62 : kind === "lmg" ? 1.0 : kind === "shotgun" ? 0.95 : 0.88;
      B(0.06, 0.09, L * 0.5, kind === "lmg" ? olive : metal, 0, 0.02, -L * 0.18);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, L * 0.55, 8), dark);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0, 0.035, -L * 0.62);
      g.add(bar);
      B(0.05, 0.1, L * 0.28, wood, 0, -0.01, L * 0.3);
      const mag = B(0.05, 0.2, 0.09, kind === "lmg" ? olive : dark, 0, -0.12, -L * 0.12);
      if (kind === "ak") mag.rotation.x = -0.3;
      const grip = B(0.045, 0.12, 0.05, wood, 0, -0.09, 0.02);
      grip.rotation.x = 0.35;
      B(0.02, 0.05, 0.02, dark, 0, 0.08, -L * 0.85);
      if (kind === "shotgun") {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, L * 0.5, 8), metal);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(0, 0, -L * 0.6);
        g.add(tube);
        B(0.05, 0.05, 0.16, wood, 0, -0.035, -L * 0.5);
      }
      if (kind === "lmg") {
        B(0.09, 0.16, 0.16, olive, 0, -0.1, -L * 0.2);
        B(0.02, 0.12, 0.02, dark, -0.05, -0.1, -L * 0.7);
        B(0.02, 0.12, 0.02, dark, 0.05, -0.1, -L * 0.7);
      }
    }
    return g;
  }

  /** مدل + کلیپ‌ها از یک parse یکسان — بدون اشتراک‌گذاری کلیپ بین صحنه‌ها */
  private async attachGlb(s: Soldier) {
    try {
      let g: GLTF | null = this.soldierPool.pop() ?? null;
      this.refillSoldierPool();
      if (!g && this.soldierBuffer) {
        g = await new GLTFLoader().parseAsync(this.soldierBuffer, "");
      }
      if (!g || s.gone) return;
      const tint = s.team === "ally" ? ALLY_TINT : TINTS[s.etype];
      const model = g.scene;
      const inner = new THREE.Group();
      inner.rotation.y = Math.PI; // مدل Mixamo رو به -Z است
      inner.add(model);
      inner.scale.setScalar(s.scale);
      s.visual.add(inner);
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.userData.soldier = s;
          s.hitMeshes.push(m);
          if (tint !== 0xffffff) {
            const mm = m.material as THREE.MeshStandardMaterial;
            if (mm && mm.color) mm.color.multiply(new THREE.Color(tint));
          }
        }
      });
      // انیمیشن واقعی Mixamo — کلیپ‌های Idle/Walk/Run از همان parse.
      // هیچ چرخش دستی روی استخوان‌ها اعمال نمی‌شود تا با میکسر تداخل نکند.
      const clips = (g.animations as THREE.AnimationClip[]).filter(
        (c) => c.tracks.length > 8 && !/tpose|t-?_?pose/i.test(c.name)
      );
      const find = (n: string) =>
        clips.find((c) => c.name.toLowerCase() === n) ?? clips.find((c) => c.name.toLowerCase().includes(n));
      const idle = find("idle");
      const walk = find("walk");
      const run = find("run");
      if (!idle || !walk || !run) throw new Error("mixamo-clips-missing");
      s.mixer = new THREE.AnimationMixer(model);
      s.actions.idle = s.mixer.clipAction(idle);
      s.actions.walk = s.mixer.clipAction(walk);
      s.actions.run = s.mixer.clipAction(run);
      s.actions.idle.setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
      s.actions.walk.setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(0).play();
      s.actions.run.setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(0).play();
      s.band = "idle";
      s.mixer.update(0.016);
    } catch {
      // مدل یا کلیپ‌ها ناقص بودند — مدل GLB را بردار و سرباز رویه‌ساز بگذار (هرگز تی‌پوز نمی‌شود)
      if (!s.gone && !s.rig) {
        s.visual.clear();
        s.hitMeshes.length = 0;
        s.mixer = null;
        this.attachProcedural(s);
      }
    }
  }

  /** استخر نمونه‌های از پیش parse شده تا اسپاون موج‌ها بدون لگ باشد */
  private refillSoldierPool() {
    if (this.poolBusy || !this.soldierBuffer || this.disposed) return;
    if (this.soldierPool.length >= 3) return;
    this.poolBusy = true;
    const refill = async () => {
      try {
        while (this.soldierPool.length < 3 && this.soldierBuffer && !this.disposed) {
          this.soldierPool.push(await new GLTFLoader().parseAsync(this.soldierBuffer, ""));
        }
      } catch {
        /* ignore */
      } finally {
        this.poolBusy = false;
      }
    };
    void refill();
  }

  private removeSoldier(s: Soldier) {
    s.gone = true;
    this.scene.remove(s.root);
  }

  private clearSoldiers() {
    for (const s of this.soldiers) this.scene.remove(s.root);
    this.soldiers = [];
  }

  private enemies(): Soldier[] {
    return this.soldiers.filter((s) => s.team === "enemy");
  }

  private allies(): Soldier[] {
    return this.soldiers.filter((s) => s.team === "ally");
  }

  private spawnMenuActors() {
    for (let i = 0; i < 6; i++) this.spawnSoldier("enemy", "rifle", this.randomPatrolPoint(), 1);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      this.spawnSoldier("ally", "rifle", new THREE.Vector3(Math.cos(a) * 6, 0, 8 + Math.sin(a) * 4), 1, i);
    }
  }

  private async loadSoldier() {
    for (const url of SOLDIER_URLS) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        // اعتبارسنجی: یک بار parse و بررسی سه کلیپ
        const probe: GLTF = await new GLTFLoader().parseAsync(buf, "");
        const names = probe.animations.map((c) => c.name.toLowerCase());
        if (
          !names.some((n) => n.includes("idle")) ||
          !names.some((n) => n.includes("walk")) ||
          !names.some((n) => n.includes("run"))
        ) {
          continue;
        }
        if (this.disposed) return;
        this.soldierBuffer = buf;
        this.soldierPool.push(probe);
        this.refillSoldierPool();
        this.modelSource = "glb";
        if (this.state === "menu") {
          this.clearSoldiers();
          this.spawnMenuActors();
        }
        this.emitNow();
        return;
      } catch {
        /* بعدی */
      }
    }
    if (this.disposed) return;
    this.modelSource = "procedural";
    this.emitNow();
  }

  /* ================= موج‌ها ================= */

  private waveComposition(n: number): EType[] {
    const list: EType[] = [];
    const rifles = Math.min(4 + n * 2, 12);
    for (let i = 0; i < rifles; i++) list.push("rifle");
    if (n >= 2) {
      const runners = Math.min(1 + Math.floor(n * 0.7), 5);
      for (let i = 0; i < runners; i++) list.push("runner");
    }
    if (n >= 3) {
      const heavies = Math.min(n - 2, 3);
      for (let i = 0; i < heavies; i++) list.push("heavy");
    }
    return list.slice(0, 16);
  }

  private spawnWave(n: number) {
    this.wave = n;
    this.waveCd = 3.4;
    const comp = this.waveComposition(n);
    for (const et of comp) {
      let pt = this.randomPatrolPoint();
      for (let tries = 0; tries < 12; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = 55 + Math.random() * 35;
        const x = THREE.MathUtils.clamp(this.pos.x + Math.cos(a) * r, -WALL + 6, WALL - 6);
        const z = THREE.MathUtils.clamp(this.pos.z + Math.sin(a) * r, -WALL + 6, WALL - 6);
        if (!this.pointBlocked(x, z, 0.8)) {
          pt = new THREE.Vector3(x, 0, z);
          break;
        }
      }
      const s = this.spawnSoldier("enemy", et, pt, n);
      s.alerted = true;
    }
    // بازگشت هم‌رزم‌های از دست رفته
    for (const a of this.allies()) {
      if (a.dead) {
        this.removeSoldier(a);
      }
    }
    const aliveAllies = this.allies().filter((a) => !a.dead);
    let ni = aliveAllies.length;
    for (let i = aliveAllies.length; i < 4; i++) {
      const s = this.spawnSoldier("ally", "rifle", this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, 4 + Math.random() * 3)), n, ni++);
      s.alerted = true;
    }
    if (aliveAllies.length < 4 && n > 1) this.showBanner("نیروی کمکی رسید!", "info");
    this.storm = n >= 4 && n % 4 === 0;
    if (this.storm) {
      this.showBanner(`موج ${toFa(n)} — طوفان شن!`, "streak");
      sfx.wave();
      setTimeout(() => sfx.wave(), 400);
    } else {
      this.showBanner(`موج ${toFa(n)}`, "wave");
      sfx.wave();
    }
    this.emitNow();
  }

  private showBanner(text: string, kind: HudState["bannerKind"]) {
    this.bannerText = text;
    this.bannerKind = kind;
    this.bannerKey = Date.now();
  }

  /* ================= هوش مصنوعی ================= */

  private targetPos(s: Soldier): THREE.Vector3 {
    if (s.target === "player") return this.pos;
    if (s.target && !s.target.dead) return s.target.root.position;
    return this.pos;
  }

  private pickEnemyTarget(e: Soldier) {
    const dp = e.root.position.distanceTo(this.pos);
    const aliveAllies = this.allies().filter((a) => !a.dead);
    let best: Soldier | null = null;
    let bd = Infinity;
    for (const a of aliveAllies) {
      const d = e.root.position.distanceTo(a.root.position);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (dp < 42 || best === null || Math.random() < 0.6) e.target = "player";
    else e.target = best;
  }

  private checkLOS(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 0.01) return true;
    this.raycaster.set(from, dir.normalize());
    this.raycaster.far = dist - 0.4;
    const hit = this.raycaster.intersectObjects(this.blockers, false);
    this.raycaster.far = Infinity;
    return hit.length === 0;
  }



  private enemyFire(e: Soldier, dist: number) {
    const tpos = this.targetPos(e);
    const isPlayer = e.target === "player" || e.target === null;
    const yaw = e.yaw;
    const mPos = new THREE.Vector3(
      e.root.position.x + Math.sin(yaw) * 0.55,
      1.35 * e.scale,
      e.root.position.z + Math.cos(yaw) * 0.55
    );
    const aim = isPlayer ? new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z) : tpos.clone().setY(1.3);
    const moveSpeed = isPlayer ? Math.hypot(this.vel.x, this.vel.z) : 1.5;
    let acc = 0.5 - dist * 0.012 - moveSpeed * 0.018 - (isPlayer && this.sprinting ? 0.05 : 0);
    acc = THREE.MathUtils.clamp(acc, 0.07, 0.5);
    const hits = Math.random() < acc;
    const spread = dist * (hits ? 0.012 : 0.13);
    const end = aim
      .clone()
      .add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 2).multiplyScalar(spread));
    this.addTracer(mPos, end, 0xff9a6a);
    e.flashT = 0.06;
    if (e.bones) e.bones.recoil = 0.45;
    sfx.enemyShot(THREE.MathUtils.clamp(0.4 - dist * 0.01, 0.04, 0.38));
    if (!hits) return;
    if (isPlayer) this.damagePlayer(ETYPES[e.etype].dmg(this.wave) * (0.75 + Math.random() * 0.5), e.root.position);
    else if (e.target && e.target !== "player") this.damageAlly(e.target, ETYPES[e.etype].dmg(this.wave));
  }

  private updateSoldier(s: Soldier, dt: number, mode: "ambient" | "combat") {
    if (s.dead) {
      s.deathT += dt;
      const k = Math.min(1, s.deathT / 0.5);
      const ease = 1 - Math.pow(1 - k, 3);
      s.visual.rotation.x = s.fallSign * ease * Math.PI * 0.5;
      s.visual.rotation.z = s.fallSign * ease * 0.2;
      if (s.deathT > 3.2) {
        s.root.position.y -= dt * 1;
        if (s.root.position.y < -2.6) {
          this.removeSoldier(s);
          s.removed = true;
        }
      }
      return;
    }

    const isEnemy = s.team === "enemy";
    const myPos = s.root.position;

    // انتخاب هدف و خط دید
    if (isEnemy) {
      s.retargetT -= dt;
      if (s.retargetT <= 0 || s.target === null || (s.target !== "player" && s.target.dead)) {
        s.retargetT = 0.5 + (s.id % 4) * 0.15;
        if (mode === "combat") this.pickEnemyTarget(s);
      }
    } else {
      // هم‌رزم: نزدیک‌ترین دشمن زنده
      s.retargetT -= dt;
      if (s.retargetT <= 0) {
        s.retargetT = 0.4;
        let best: Soldier | null = null;
        let bd = Infinity;
        for (const e of this.enemies()) {
          if (e.dead) continue;
          const d = myPos.distanceTo(e.root.position);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        s.target = best;
      }
    }

    const allyTarget: Soldier | null = !isEnemy && s.target !== "player" ? s.target : null;
    const tpos = isEnemy ? this.targetPos(s) : allyTarget && !allyTarget.dead ? allyTarget.root.position : null;
    const dx = tpos ? tpos.x - myPos.x : 0;
    const dz = tpos ? tpos.z - myPos.z : 0;
    const dist = tpos ? Math.hypot(dx, dz) : Infinity;

    s.losT -= dt;
    if (s.losT <= 0) {
      s.losT = 0.12 + (s.id % 5) * 0.04;
      s.los =
        mode === "combat" && tpos
          ? this.checkLOS(new THREE.Vector3(myPos.x, 1.45, myPos.z), new THREE.Vector3(tpos.x, isEnemy ? (s.target === "player" ? this.pos.y + EYE : 1.3) : 1.3, tpos.z))
          : false;
      if (s.los && isEnemy) s.alerted = true;
    }

    let mx = 0;
    let mz = 0;
    let speed = 0;
    let faceTarget = false;
    let shooting = false;
    const def = ETYPES[s.etype];

    const patrol = () => {
      const wp = s.waypoint;
      const wx = wp.x - myPos.x;
      const wz = wp.z - myPos.z;
      const wd = Math.hypot(wx, wz);
      if (wd < 1.6) s.waypoint = this.randomPatrolPoint();
      else {
        mx = wx / wd;
        mz = wz / wd;
        speed = mode === "ambient" ? 1.4 : 1.8;
      }
    };

    if (isEnemy) {
      if (mode === "combat" && tpos) {
        const et = s.etype;
        if (et === "runner") {
          faceTarget = true;
          if (dist > 2.1) {
            mx = dx / dist;
            mz = dz / dist;
            speed = def.speed;
          } else {
            s.meleeCd -= dt;
            if (s.meleeCd <= 0) {
              s.meleeCd = 0.9;
              s.flashT = 0.05;
              sfx.knife();
              if (s.target === "player") this.damagePlayer(def.dmg(this.wave), s.root.position);
              else if (s.target) this.damageAlly(s.target, def.dmg(this.wave));
            }
          }
        } else if (s.los && dist < (et === "heavy" ? 40 : 46)) {
          faceTarget = true;
          const want = et === "heavy" ? 14 : 11;
          if (dist > want + 4) {
            mx = dx / dist;
            mz = dz / dist;
            speed = def.speed;
          } else if (dist < want - 5) {
            mx = -dx / dist;
            mz = -dz / dist;
            speed = 1.6;
          } else {
            s.strafePhase += dt * (0.9 + (s.id % 3) * 0.25);
            const sgn = Math.sin(s.strafePhase) * s.strafeDir;
            mx = (-dz / dist) * sgn;
            mz = (dx / dist) * sgn;
            speed = et === "heavy" ? 1.1 : 1.8;
            shooting = true;
            s.fireT -= dt;
            if (s.fireT <= 0) {
              this.enemyFire(s, dist);
              s.fireT = def.rof * (0.75 + Math.random() * 0.5);
            }
          }
        } else if (s.alerted || dist < 24) {
          faceTarget = true;
          mx = dx / dist;
          mz = dz / dist;
          speed = def.speed;
        } else {
          patrol();
        }
      } else {
        patrol();
      }
    } else {
      /* هم‌رزم */
      if (mode === "combat") {
        if (allyTarget && !allyTarget.dead) {
          faceTarget = true;
          if (dist > 16) {
            mx = dx / dist;
            mz = dz / dist;
            speed = dist > 30 ? 6.4 : 4.6;
          } else if (dist < 8) {
            mx = -dx / dist;
            mz = -dz / dist;
            speed = 2;
          } else {
            s.strafePhase += dt * 1.1;
            const sgn = Math.sin(s.strafePhase) * s.strafeDir;
            mx = (-dz / dist) * sgn;
            mz = (dx / dist) * sgn;
            speed = 1.8;
          }
          // شلیک رگباری
          if (s.los || dist < 14) {
            shooting = true;
            if (s.burstLeft > 0) {
              s.fireT -= dt;
              if (s.fireT <= 0) {
                s.fireT = 0.13;
                s.burstLeft--;
                this.allyFire(s);
              }
            } else {
              s.burstPause -= dt;
              if (s.burstPause <= 0) {
                s.burstLeft = 3;
                s.burstPause = 1.3 + Math.random() * 1;
                s.fireT = 0;
              }
            }
          }
        } else {
          // دنبال کردن بازیکن
          const offs = [
            [-4, -3],
            [4, -3],
            [-6, 2.5],
            [6, 2.5],
          ];
          const idx = ALLY_NAMES.indexOf(s.name);
          const off = offs[(idx + 4) % 4];
          const sinY = Math.sin(this.yaw);
          const cosY = Math.cos(this.yaw);
          // right = (cosY, -sinY) ، forward = (-sinY, -cosY)
          const fx = this.pos.x + cosY * off[0] - sinY * off[1];
          const fz = this.pos.z - sinY * off[0] - cosY * off[1];
          const wx = fx - myPos.x;
          const wz = fz - myPos.z;
          const wd = Math.hypot(wx, wz);
          if (wd > 2.5) {
            mx = wx / wd;
            mz = wz / wd;
            speed = wd > 14 ? 6.8 : 4.4;
          }
        }
      } else {
        patrol();
      }
    }

    s.speed += (speed - s.speed) * Math.min(1, dt * 8);

    const targetYaw = faceTarget && tpos
      ? Math.atan2(dx, dz)
      : s.speed > 0.3
        ? Math.atan2(mx, mz)
        : s.yaw;
    const dy = THREE.MathUtils.euclideanModulo(targetYaw - s.yaw + Math.PI, Math.PI * 2) - Math.PI;
    s.yaw += dy * Math.min(1, dt * 7);
    s.root.rotation.y = s.yaw;

    if (s.speed > 0.05) {
      myPos.x += mx * s.speed * dt;
      myPos.z += mz * s.speed * dt;
    }
    this.collideCircle(myPos, s.radius);
    myPos.x = THREE.MathUtils.clamp(myPos.x, -WALL + 3, WALL - 3);
    myPos.z = THREE.MathUtils.clamp(myPos.z, -WALL + 3, WALL - 3);

    // جداسازی
    for (const o of this.soldiers) {
      if (o === s || o.dead) continue;
      const sx = myPos.x - o.root.position.x;
      const sz = myPos.z - o.root.position.z;
      const sd = Math.hypot(sx, sz);
      if (sd < 1.05 && sd > 0.001) {
        const push = ((1.05 - sd) / sd) * 0.5;
        myPos.x += sx * push;
        myPos.z += sz * push;
      }
    }

    // انیمیشن — اول کلیپ واقعی Mixamo، بعد ریگ استخوانی، بعد رویه‌ساز
    const aimingNow = shooting && (s.los || dist < 14);
    if (s.mixer) {
      const band: Soldier["band"] = s.speed < 0.4 ? "idle" : s.speed < (s.etype === "runner" ? 4.5 : 3.1) ? "walk" : "run";
      if (band !== s.band) this.setBand(s, band);
      s.mixer.update(dt);
    } else if (s.bones) {
      this.updateBones(s.bones, dt, s.speed, aimingNow, s.etype === "runner");
    } else if (s.rig) {
      animateProcedural(s.rig, s.speed, dt, aimingNow);
    }

    // فلش
    s.flashT -= dt;
    const fm = s.flash.material as THREE.SpriteMaterial;
    if (s.flashT > 0) {
      fm.opacity = 1;
      s.flash.scale.setScalar(0.7 + Math.random() * 0.4);
    } else {
      fm.opacity = 0;
      s.flash.scale.setScalar(0.01);
    }
  }

  private allyFire(a: Soldier) {
    const tgt = a.target;
    if (!tgt || tgt === "player" || tgt.dead) return;
    const mPos = new THREE.Vector3(
      a.root.position.x + Math.sin(a.yaw) * 0.5,
      1.35,
      a.root.position.z + Math.cos(a.yaw) * 0.5
    );
    const aim = tgt.root.position.clone().setY(1.25);
    const dist = a.root.position.distanceTo(tgt.root.position);
    const hit = Math.random() < (tgt.etype === "heavy" ? 0.3 : 0.4);
    const end = hit
      ? aim
      : aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.4));
    this.addTracer(mPos, end, 0xb8ffa0);
    a.flashT = 0.05;
    sfx.enemyShot(THREE.MathUtils.clamp(0.3 - dist * 0.008, 0.03, 0.25));
    if (hit) {
      this.spawnBurst(aim, 0xa31414, 4);
      tgt.hp -= 20;
      tgt.alerted = true;
      if (tgt.hp <= 0) this.killEnemy(tgt, false, a.name);
    }
  }

  private damageAlly(a: Soldier, dmg: number) {
    if (this.state !== "play" || a.dead) return;
    a.hp -= dmg;
    this.spawnBurst(a.root.position.clone().setY(1.2), 0xa31414, 3);
    if (a.hp <= 0) {
      a.dead = true;
      a.deathT = 0;
      a.fallSign = Math.random() < 0.5 ? -1 : 1;
      this.pushFeed(`${a.name} به شهادت رسید — تا موج بعد`, false);
      sfx.allyDown();
      this.emitNow();
    }
  }

  private updateSoldiers(dt: number, mode: "ambient" | "combat") {
    for (const s of [...this.soldiers]) {
      this.updateSoldier(s, dt, mode);
    }
    this.soldiers = this.soldiers.filter((s) => !s.removed);
  }

  /* ================= آسیب و کشتار ================= */

  private pushFeed(text: string, head: boolean) {
    const item: FeedItem = { id: this.feedId++, text, head };
    this.feed = [...this.feed.slice(-4), item];
    setTimeout(() => {
      this.feed = this.feed.filter((f) => f.id !== item.id);
      if (!this.disposed) this.emitNow();
    }, 4200);
  }

  private killEnemy(e: Soldier, head: boolean, byAlly?: string) {
    e.dead = true;
    e.deathT = 0;
    e.fallSign = Math.random() < 0.5 ? -1 : 1;
    const def = ETYPES[e.etype];
    const now = this.time;

    if (byAlly) {
      this.score += 50;
      this.pushFeed(`${byAlly}: ${def.label} از پای درآمد`, false);
    } else {
      this.kills++;
      if (head) this.headshots++;
      if (now - this.lastKillT < 3.5) this.streak++;
      else this.streak = 1;
      this.lastKillT = now;
      const bonus = (head ? 50 : 0) + Math.max(0, this.streak - 1) * 25 + this.wave * 10;
      this.score += def.score + bonus;
      const reward = 300 + (head ? 150 : 0);
      this.money += reward;
      const label = head ? `هدشات! ${def.label} از پای درآمد  +$${reward}` : `${def.label} از پای درآمد  +$${reward}`;
      this.pushFeed(label, head);
      if (this.streak === 2) this.showBanner("کشتار دوبل!", "streak");
      else if (this.streak === 3) this.showBanner("سه‌کشتار!", "streak");
      else if (this.streak === 4) this.showBanner("چهارکشتار!!", "streak");
      else if (this.streak >= 5) this.showBanner("افسانه‌ای!!!", "streak");
    }
    sfx.death();
    this.emitNow();
  }

  private damagePlayer(d: number, attacker?: THREE.Vector3) {
    if (this.state !== "play") return;
    let dmg = d;
    if (this.armor > 0) {
      const ab = Math.min(this.armor, dmg * 0.6);
      this.armor -= ab;
      dmg -= ab;
    }
    this.health = Math.max(0, this.health - dmg);
    this.dmgKey = Date.now();
    this.shake = Math.min(1, this.shake + 0.35);
    if (attacker) {
      const dx = attacker.x - this.pos.x;
      const dz = attacker.z - this.pos.z;
      const angToAttacker = Math.atan2(dx, dz);
      let deg = THREE.MathUtils.radToDeg(angToAttacker - this.yaw);
      deg = ((deg + 540) % 360) - 180;
      this.dmgDirs.push({ id: this.dmgDirId++, deg });
      if (this.dmgDirs.length > 6) this.dmgDirs.shift();
    }
    sfx.hurt();
    if (this.health <= 0) {
      this.state = "over";
      this.stats = { kills: this.kills, headshots: this.headshots, wave: this.wave, score: this.score, time: this.time };
      if (this.score > this.best) {
        this.best = this.score;
        try {
          localStorage.setItem("cwo-best", String(this.best));
        } catch {
          /* ignore */
        }
      }
      sfx.gameOver();
      sfx.stopWind();
      if (document.pointerLockElement) document.exitPointerLock();
    }
    this.emitNow();
  }

  /* ================= بازیکن ================= */

  private collideCircle(p: THREE.Vector3, r: number) {
    for (const b of this.boxCols) {
      const cx = THREE.MathUtils.clamp(p.x, b.x - b.hw, b.x + b.hw);
      const cz = THREE.MathUtils.clamp(p.z, b.z - b.hd, b.z + b.hd);
      let dx = p.x - cx;
      let dz = p.z - cz;
      let d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 0.0001) {
          dx = p.x - b.x;
          dz = p.z - b.z;
          d = Math.hypot(dx, dz) || 1;
        }
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      }
    }
    for (const c of this.cirCols) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + r;
      if (d < min && d > 0.0001) {
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    }
    p.x = THREE.MathUtils.clamp(p.x, -WALL + 2.4, WALL - 2.4);
    p.z = THREE.MathUtils.clamp(p.z, -WALL + 2.4, WALL - 2.4);
  }

  private currentSpread(): number {
    const w = WEAPONS[this.slot];
    if (w.melee) return 0;
    if (w.scoped && this.scoping) {
      // اسکوپ AWP — دقت بسیار بالا، اما حرکت آن را خراب می‌کند
      const moveK = THREE.MathUtils.clamp(Math.hypot(this.vel.x, this.vel.z) / 2, 0, 1);
      return 0.0004 + moveK * 0.01;
    }
    const moveK = THREE.MathUtils.clamp(Math.hypot(this.vel.x, this.vel.z) / 6.4, 0, 1);
    return (w.spread + moveK * 0.005 + this.heat * 0.012) * (1 - this.adsK * 0.8);
  }

  private updatePlayer(dt: number) {
    const f = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const st = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const wNow = WEAPONS[this.slot];
    const wantScope = this.adsDown && wNow.scoped === true;
    if (wantScope !== this.scoping) {
      this.scoping = wantScope;
      this.emitNow();
    }
    this.scopeT += ((this.scoping ? 1 : 0) - this.scopeT) * Math.min(1, dt * 9);
    const wantAds = this.adsDown && !wNow.melee && !wNow.scoped;
    this.adsK += ((wantAds ? 1 : 0) - this.adsK) * Math.min(1, dt * 11);
    this.sprinting = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) && f > 0 && !wantAds && !this.scoping;
    const spd = (this.sprinting ? 9 : 4.6) * (1 - this.adsK * 0.42) * (1 - this.scopeT * 0.62);

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    let wx = -sinY * f + cosY * st;
    let wz = -cosY * f - sinY * st;
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

    const moveK = THREE.MathUtils.clamp(Math.hypot(this.vel.x, this.vel.z) / 9, 0, 1);
    this.bobT += Math.hypot(this.vel.x, this.vel.z) * dt * 1.35;

    if (moveK > 0.12) {
      this.stepAcc += Math.hypot(this.vel.x, this.vel.z) * dt;
      if (this.stepAcc > 2.4) {
        this.stepAcc = 0;
        this.stepAlt = !this.stepAlt;
        sfx.step(this.stepAlt);
      }
    }

    // سایه‌ی خورشید دنبال بازیکن
    this.sun.position.set(this.pos.x + 60, 90, this.pos.z + 30);
    this.sun.target.position.set(this.pos.x, 0, this.pos.z);

    // دوربین
    this.shake *= Math.exp(-5 * dt);
    const shx = (Math.random() - 0.5) * this.shake * 0.22;
    const shy = (Math.random() - 0.5) * this.shake * 0.22;
    this.camera.position.set(this.pos.x + shx, EYE + Math.sin(this.bobT * 1.7) * 0.03 * moveK + shy, this.pos.z);
    this.kickV += (-this.kick * 150 - this.kickV * 13) * dt;
    this.kick += this.kickV * dt;
    this.camera.rotation.set(this.pitch + this.kick * 0.05, this.yaw, st * -0.012 * moveK);

    let targetFov = this.sprinting && moveK > 0.5 ? 82 : 74 - this.adsK * 20;
    if (this.scoping) targetFov = 26; // زوم اسکوپ AWP
    this.fov += (targetFov - this.fov) * Math.min(1, dt * (this.scoping ? 12 : 8));
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // سلاح
    this.heat = Math.max(0, this.heat - dt * 1.7);
    this.fireCd -= dt;
    const w = WEAPONS[this.slot];
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = w.mag - this.ammoArr[this.slot];
        const take = Math.min(need, this.reserveArr[this.slot]);
        this.ammoArr[this.slot] += take;
        this.reserveArr[this.slot] -= take;
        this.reloading = false;
        this.emitNow();
      }
    } else if (this.keys.has("KeyR")) {
      this.tryReload();
    }

    const wantFire = w.auto ? this.mouseDown : this.mousePressed;
    this.mousePressed = false;
    if (wantFire && !this.reloading && this.fireCd <= 0) {
      if (w.melee) this.meleeAttack();
      else if (this.ammoArr[this.slot] > 0) this.shoot();
      else {
        this.fireCd = 0.3;
        sfx.empty();
        this.tryReload();
      }
    }

    // نارنجک
    if (this.keys.has("KeyG") && this.grenades > 0) {
      this.keys.delete("KeyG");
      this.throwGrenade();
    }

    // آیتم‌ها
    for (const p of this.pickups) {
      if (p.taken) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) {
          p.taken = false;
          p.mesh.visible = true;
        }
        continue;
      }
      p.mesh.rotation.y += dt * 1.6;
      p.mesh.position.y = p.baseY + Math.sin(this.time * 2.4 + p.pos.x) * 0.12;
      if (Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < 1.4) {
        this.applyPickup(p);
      }
    }
  }

  private applyPickup(p: Pickup) {
    p.taken = true;
    p.respawnT = 25;
    p.mesh.visible = false;
    sfx.pickup();
    if (p.kind === "health") {
      this.health = Math.min(100, this.health + 35);
      this.pushFeed("جعبه کمک‌های اولیه (+۳۵ سلامتی)", false);
    } else if (p.kind === "armor") {
      this.armor = Math.min(100, this.armor + 50);
      this.pushFeed("زره (+۵۰)", false);
    } else if (p.kind === "ammo") {
      this.reserveArr[0] += 90;
      this.pushFeed("مهمات کلاشینکف (+۹۰)", false);
    } else {
      this.grenades = Math.min(5, this.grenades + 2);
      this.pushFeed("نارنجک (+۲)", false);
    }
    this.emitNow();
  }

  private tryReload() {
    const w = WEAPONS[this.slot];
    if (w.melee || this.reloading || this.ammoArr[this.slot] >= w.mag || this.reserveArr[this.slot] <= 0 || this.state !== "play") return;
    this.reloading = true;
    this.reloadT = w.reload;
    sfx.reload();
    this.emitNow();
  }

  private switchWeapon(slot: number) {
    if (slot === this.slot || slot < 0 || slot > 2 || this.state !== "play") return;
    this.slot = slot;
    this.reloading = false;
    this.fireCd = 0.25;
    this.knifeT = -1;
    this.scoping = false;
    for (let i = 0; i < 3; i++) this.gunBodies[i].visible = i === slot;
    sfx.swap();
    this.emitNow();
  }

  /** تعویض سلاح اصلی بین مالک‌شده‌ها (کلید Q) */
  private cyclePrimary(dir = 1) {
    const owned = (["ak", "mp5", "shotgun", "awp"] as PrimaryId[]).filter((p) => this.ownedPrimaries.has(p));
    if (owned.length < 2) return;
    const idx = owned.indexOf(this.primaryId);
    const next = owned[(idx + dir + owned.length) % owned.length];
    this.setPrimary(next);
  }

  private setPrimary(id: PrimaryId) {
    if (!this.ownedPrimaries.has(id) || !this.primaryBodies || !this.primaryMuzzles) return;
    // ذخیره مهمات قبلی
    this.primaryAmmo[this.primaryId] = { mag: this.ammoArr[0], reserve: this.reserveArr[0] };
    this.primaryId = id;
    WEAPONS[0] = PRIMARY_DEFS[id];
    for (const p of ["ak", "mp5", "shotgun", "awp"] as PrimaryId[]) this.primaryBodies[p].visible = p === id;
    this.muzzles[0] = this.primaryMuzzles[id];
    this.ammoArr[0] = this.primaryAmmo[id].mag;
    this.reserveArr[0] = this.primaryAmmo[id].reserve;
    this.reloading = false;
    this.scoping = false;
    this.fireCd = 0.3;
    if (this.slot !== 0) this.switchWeapon(0);
    sfx.swap();
    this.emitNow();
  }

  /* ---------- اقتصاد و فروشگاه ---------- */

  openBuy() {
    if (this.state !== "play" || this.buyOpen) return;
    this.buyOpen = true;
    this.scoping = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.emitNow();
  }

  closeBuy() {
    if (!this.buyOpen) return;
    this.buyOpen = false;
    this.requestLock();
    this.emitNow();
  }

  purchase(id: string) {
    const item = BUY_ITEMS.find((b) => b.id === id);
    if (!item || this.money < item.price || this.state !== "play") return;
    if (item.kind === "primary" && item.primary) {
      if (this.ownedPrimaries.has(item.primary)) return;
      this.money -= item.price;
      this.ownedPrimaries.add(item.primary);
      this.primaryAmmo[item.primary] = { mag: PRIMARY_DEFS[item.primary].mag, reserve: PRIMARY_DEFS[item.primary].mag * 3 };
      this.setPrimary(item.primary);
      sfx.pickup();
    } else if (item.id === "vest") {
      if (this.armor >= 100) return;
      this.money -= item.price;
      this.armor = 100;
      sfx.pickup();
    } else if (item.id === "ammo") {
      this.money -= item.price;
      for (const p of this.ownedPrimaries) {
        this.primaryAmmo[p].reserve += PRIMARY_DEFS[p].mag * 3;
      }
      this.reserveArr[0] = this.primaryAmmo[this.primaryId].reserve;
      this.reserveArr[1] = Infinity;
      sfx.pickup();
    } else if (item.id === "he") {
      if (this.grenades >= 5) return;
      this.money -= item.price;
      this.grenades = Math.min(5, this.grenades + 1);
      sfx.pickup();
    }
    this.emitNow();
  }

  private shoot() {
    const w = WEAPONS[this.slot];
    this.ammoArr[this.slot]--;
    this.fireCd = w.rof * (this.scoping ? 1 : 1);
    this.heat = Math.min(1, this.heat + w.heatAdd);
    this.kickV += w.kick * (this.scoping ? 1.6 : 1);
    this.pushZ = this.scoping ? 0.14 : 0.075;
    this.flashT = 0.05;
    if (this.slot === 0 && !w.melee) this.ejectShell();
    sfx.shot(this.slot === 0 ? (w.scoped ? "ak" : "ak") : "pistol");
    const pellets = w.pellets ?? 1;
    for (let i = 0; i < pellets; i++) this.hitscan(w);
    if (this.ammoArr[this.slot] <= 6) this.emitNow();
  }

  /** پوکه‌ی گلوله */
  private ejectShell() {
    if (this.shells.length > 40) return;
    const m = new THREE.Mesh(this.shellGeo, this.shellMat);
    const wp = new THREE.Vector3();
    this.muzzles[this.slot].getWorldPosition(wp);
    m.position.copy(wp);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const vel = right.multiplyScalar(1.6 + Math.random()).add(new THREE.Vector3(0, 2.2 + Math.random(), 0));
    this.scene.add(m);
    this.shells.push({ m, vel, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), life: 1.4 });
  }

  private hitscan(w: WeaponDef) {
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
    this.raycaster.far = w.range;
    const targets: THREE.Object3D[] = [...this.blockers];
    for (const s of this.soldiers) {
      if (s.team === "enemy" && !s.dead) targets.push(...s.hitMeshes);
    }
    const hits = this.raycaster.intersectObjects(targets, false);

    const muzzleWorld = new THREE.Vector3();
    this.muzzles[this.slot].getWorldPosition(muzzleWorld);

    if (hits.length > 0) {
      const h = hits[0];
      const e = h.object.userData.soldier as Soldier | undefined;
      if (e && e.team === "enemy" && !e.dead) {
        const relY = (h.point.y - e.root.position.y) / e.scale;
        let dmg: number;
        let head = false;
        if (relY > 1.42) {
          head = true;
          dmg = w.head;
        } else if (relY < 0.8) {
          dmg = w.leg;
        } else {
          dmg = w.dmg + Math.random() * 6;
        }
        e.hp -= dmg;
        e.alerted = true;
        if (head) this.headKey = Date.now();
        else this.hitKey = Date.now();
        sfx.hit(head);
        this.spawnBurst(h.point, head ? 0xd81f1f : 0xa31414, 7);
        this.addTracer(muzzleWorld, h.point, 0xffe0a8);
        this.spawnDmgNum(h.point, Math.round(dmg), head);
        if (e.hp <= 0) this.killEnemy(e, head);
        return;
      }
      this.spawnBurst(h.point, 0xcbb98f, 5);
      this.addTracer(muzzleWorld, h.point, 0xffe0a8);
    } else {
      const end = origin.clone().addScaledVector(dir, Math.min(w.range, 120));
      this.addTracer(muzzleWorld, end, 0xffe0a8);
    }
  }

  private meleeAttack() {
    const w = WEAPONS[2];
    this.fireCd = w.rof;
    this.knifeT = 0;
    sfx.knife();
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let hitAny = false;
    for (const e of this.enemies()) {
      if (e.dead) continue;
      const to = e.root.position.clone().setY(1).sub(origin);
      const d = to.length();
      if (d < w.range) {
        to.normalize();
        if (to.dot(dir) > 0.45) {
          e.hp -= w.dmg;
          e.alerted = true;
          hitAny = true;
          this.spawnBurst(e.root.position.clone().setY(1.2), 0xa31414, 6);
          if (e.hp <= 0) this.killEnemy(e, false);
        }
      }
    }
    if (hitAny) {
      this.hitKey = Date.now();
      sfx.hit(false);
    }
  }

  private throwGrenade() {
    this.grenades--;
    const g = this.makeGrenadeBody();
    g.scale.setScalar(0.9);
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    g.position.copy(origin).addScaledVector(dir, 0.6);
    const vel = dir.clone().multiplyScalar(17);
    vel.y += 5.5;
    this.scene.add(g);
    this.grenadeList.push({ mesh: g, vel, t: 0 });
    sfx.swap();
    this.emitNow();
  }

  private explode(at: THREE.Vector3) {
    sfx.explosion();
    this.shake = Math.min(1.4, this.shake + 0.9);
    this.spawnBurst(at, 0xff8a2a, 16);
    this.spawnBurst(at.clone().add(new THREE.Vector3(0, 0.6, 0)), 0x888078, 10);
    const R = 8;
    for (const e of this.enemies()) {
      if (e.dead) continue;
      const d = e.root.position.distanceTo(at);
      if (d < R) {
        const dmg = 135 * (1 - d / R);
        e.hp -= dmg;
        e.alerted = true;
        if (e.hp <= 0) this.killEnemy(e, false);
      }
    }
    const dp = this.pos.distanceTo(at);
    if (dp < 6.5) this.damagePlayer(34 * (1 - dp / 6.5));
  }

  private updateGrenades(dt: number) {
    for (let i = this.grenadeList.length - 1; i >= 0; i--) {
      const g = this.grenadeList[i];
      g.t += dt;
      g.vel.y -= 19 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += dt * 9;
      if (g.mesh.position.y < 0.1) {
        g.mesh.position.y = 0.1;
        g.vel.y *= -0.38;
        g.vel.x *= 0.6;
        g.vel.z *= 0.6;
      }
      if (g.t > 1.4) {
        this.explode(g.mesh.position.clone());
        this.scene.remove(g.mesh);
        this.grenadeList.splice(i, 1);
      }
    }
  }

  /* ================= اسلحه‌های دید ================= */

  private buildWeapons() {
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 });

    const olive = new THREE.MeshStandardMaterial({ color: 0x4a5238, roughness: 0.75 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.5, metalness: 0.5 });
    const green = new THREE.MeshStandardMaterial({ color: 0x2e4a30, roughness: 0.6, metalness: 0.3 });
    const mkMuzzle = (parent: THREE.Group, z: number, y = 0.012) => {
      const m = new THREE.Object3D();
      m.position.set(0, y, z);
      parent.add(m);
      return m;
    };

    // کلاشینکف AK-47
    const ak = new THREE.Group();
    ak.add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.5), dark));
    const akBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.46, 10), dark);
    akBarrel.rotation.x = Math.PI / 2;
    akBarrel.position.set(0, 0.012, -0.46);
    ak.add(akBarrel);
    const akHand = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.065, 0.24), wood);
    akHand.position.set(0, -0.005, -0.28);
    ak.add(akHand);
    const akMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.09), new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.6, metalness: 0.3 }));
    akMag.position.set(0, -0.16, -0.02);
    akMag.rotation.x = 0.32;
    ak.add(akMag);
    const akStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.22), wood);
    akStock.position.set(0, -0.01, 0.33);
    ak.add(akStock);
    const akMuzzle = mkMuzzle(ak, -0.7);

    // مسلسل MP5
    const mp5 = new THREE.Group();
    mp5.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), black));
    const mp5Barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), black);
    mp5Barrel.rotation.x = Math.PI / 2;
    mp5Barrel.position.set(0, 0.01, -0.36);
    mp5.add(mp5Barrel);
    const mp5Hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), black);
    mp5Hand.position.set(0, -0.01, -0.24);
    mp5.add(mp5Hand);
    const mp5Mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.07), black);
    mp5Mag.position.set(0, -0.14, -0.02);
    mp5Mag.rotation.x = 0.15;
    mp5.add(mp5Mag);
    const mp5Stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.2), black);
    mp5Stock.position.set(0, -0.01, 0.3);
    mp5.add(mp5Stock);
    const mp5Sight = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), black);
    mp5Sight.position.set(0, 0.07, -0.1);
    mp5.add(mp5Sight);
    const mp5Muzzle = mkMuzzle(mp5, -0.55, 0.01);

    // شاتگان M3
    const shotgun = new THREE.Group();
    shotgun.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.55), black));
    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.55, 10), black);
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.set(0, 0.015, -0.5);
    shotgun.add(sgBarrel);
    const sgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), dark);
    sgTube.rotation.x = Math.PI / 2;
    sgTube.position.set(0, -0.025, -0.42);
    shotgun.add(sgTube);
    const sgPump = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), wood);
    sgPump.position.set(0, -0.025, -0.3);
    shotgun.add(sgPump);
    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.26), wood);
    sgStock.position.set(0, -0.02, 0.38);
    shotgun.add(sgStock);
    const sgMuzzle = mkMuzzle(shotgun, -0.8, 0.015);

    // اسنایپر AWP
    const awp = new THREE.Group();
    awp.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.62), green));
    const awpBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 10), black);
    awpBarrel.rotation.x = Math.PI / 2;
    awpBarrel.position.set(0, 0.015, -0.58);
    awp.add(awpBarrel);
    const awpScope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), black);
    awpScope.rotation.x = Math.PI / 2;
    awpScope.position.set(0, 0.1, -0.1);
    awp.add(awpScope);
    const awpScopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 10), new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.1, metalness: 0.8 }));
    awpScopeLens.rotation.x = Math.PI / 2;
    awpScopeLens.position.set(0, 0.1, -0.2);
    awp.add(awpScopeLens);
    const awpMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), green);
    awpMag.position.set(0, -0.11, -0.05);
    awp.add(awpMag);
    const awpStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.3), green);
    awpStock.position.set(0, -0.02, 0.42);
    awp.add(awpStock);
    const awpBipod1 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), black);
    awpBipod1.position.set(-0.03, -0.1, -0.4);
    awpBipod1.rotation.z = 0.3;
    awp.add(awpBipod1);
    const awpBipod2 = awpBipod1.clone();
    awpBipod2.position.x = 0.03;
    awpBipod2.rotation.z = -0.3;
    awp.add(awpBipod2);
    const awpMuzzle = mkMuzzle(awp, -0.92, 0.015);

    this.primaryBodies = { ak, mp5, shotgun, awp };
    this.primaryMuzzles = { ak: akMuzzle, mp5: mp5Muzzle, shotgun: sgMuzzle, awp: awpMuzzle };
    for (const id of ["ak", "mp5", "shotgun", "awp"] as PrimaryId[]) {
      this.primaryBodies[id].visible = id === "ak";
      this.primaryGroup.add(this.primaryBodies[id]);
    }

    // کلت
    const pistol = new THREE.Group();
    const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.3), dark);
    pSlide.position.y = 0.03;
    pistol.add(pSlide);
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.8 }));
    pGrip.position.set(0, -0.08, 0.08);
    pGrip.rotation.x = -0.2;
    pistol.add(pGrip);
    const pMuzzle = new THREE.Object3D();
    pMuzzle.position.set(0, 0.03, -0.18);
    pistol.add(pMuzzle);

    // چاقو
    const knife = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.3), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 0.85 }));
    blade.position.z = -0.2;
    knife.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), dark);
    guard.position.z = -0.04;
    knife.add(guard);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.14), new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 }));
    handle.position.z = 0.05;
    knife.add(handle);
    const knifeTip = new THREE.Object3D();
    knifeTip.position.set(0, 0.02, -0.36);
    knife.add(knifeTip);

    this.gunBodies = [this.primaryGroup, pistol, knife];
    this.muzzles = [this.primaryMuzzles.ak, pMuzzle, knifeTip];
    pistol.visible = false;
    knife.visible = false;
    this.gun.add(this.primaryGroup, pistol, knife);

    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.flashTex, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.flash.scale.setScalar(0.01);
    this.gun.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffb066, 0, 9);
    this.gun.add(this.flashLight);

    this.gun.position.set(0.24, -0.22, -0.45);
    this.camera.add(this.gun);
  }

  private updateWeaponView(dt: number) {
    this.pushZ *= Math.exp(-11 * dt);
    const moveK = THREE.MathUtils.clamp(Math.hypot(this.vel.x, this.vel.z) / 9, 0, 1);
    const w = WEAPONS[this.slot];
    // هنگام اسکوپ، مدل اسلحه پنهان می‌شود (از لنز نگاه می‌کنیم)
    this.gun.visible = this.scopeT < 0.55;
    const bobAmp = 1 - this.adsK * 0.85;
    const baseX = w.melee ? 0.34 : 0.24 * (1 - this.adsK);
    const baseY = w.melee ? -0.28 : -0.22 + 0.055 * this.adsK;
    this.gun.position.set(
      baseX + Math.sin(this.bobT * 1.7) * 0.008 * moveK * bobAmp,
      baseY + Math.abs(Math.cos(this.bobT * 1.7)) * 0.01 * moveK * bobAmp,
      -0.45 + 0.14 * this.adsK + this.pushZ
    );

    let rx = 0;
    let rz = 0;
    if (this.reloading) {
      const p = 1 - this.reloadT / WEAPONS[this.slot].reload;
      rx = Math.sin(p * Math.PI) * 0.85;
      rz = Math.sin(p * Math.PI) * -0.25;
    } else if (this.knifeT >= 0) {
      this.knifeT += dt;
      const p = this.knifeT / 0.3;
      if (p >= 1) this.knifeT = -1;
      else rx = -1.5 * Math.sin(p * Math.PI);
    }
    this.gun.rotation.x += (rx - this.gun.rotation.x) * Math.min(1, dt * 16);
    this.gun.rotation.z += (rz - this.gun.rotation.z) * Math.min(1, dt * 16);

    // موقعیت فلش و نور روی muzzle اسلحه‌ی فعال
    const mw = new THREE.Vector3();
    this.muzzles[this.slot].getWorldPosition(mw);
    this.flash.position.copy(this.gun.worldToLocal(mw));
    this.flashLight.position.copy(this.flash.position);

    this.flashT -= dt;
    const fm = this.flash.material as THREE.SpriteMaterial;
    if (this.flashT > 0) {
      fm.opacity = 1;
      this.flash.scale.setScalar(this.slot === 1 ? 0.3 : 0.42 + Math.random() * 0.22);
      this.flash.material.rotation = Math.random() * Math.PI;
      this.flashLight.intensity = 5;
    } else {
      fm.opacity = 0;
      this.flashLight.intensity *= Math.exp(-20 * dt);
    }
  }

  /* ================= افکت‌ها ================= */

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
        sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, color, transparent: true, depthWrite: false }));
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
        grow: 0.4,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.6 + 0.6, (Math.random() - 0.5) * 3),
      });
    }
  }

  /** عدد آسیب شناور */
  private spawnDmgNum(at: THREE.Vector3, val: number, head: boolean) {
    if (this.dmgNums.length > 20) return;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const g = c.getContext("2d");
    if (!g) return;
    g.font = "900 44px 'Black Ops One', monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 8;
    g.strokeStyle = "rgba(0,0,0,0.85)";
    const txt = String(val);
    g.strokeText(txt, 64, 32);
    g.fillStyle = head ? "#ffb03a" : "#ffffff";
    g.fillText(txt, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3, 0));
    sp.scale.set(head ? 0.8 : 0.6, head ? 0.4 : 0.3, 1);
    this.scene.add(sp);
    this.dmgNums.push({ s: sp, life: 0.8, vy: 1.4 });
  }

  private updateFx(dt: number) {
    // اعداد آسیب
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.life -= dt;
      d.s.position.y += d.vy * dt;
      (d.s.material as THREE.SpriteMaterial).opacity = Math.max(0, d.life / 0.8);
      if (d.life <= 0) {
        this.scene.remove(d.s);
        (d.s.material as THREE.SpriteMaterial).map?.dispose();
        (d.s.material as THREE.Material).dispose();
        this.dmgNums.splice(i, 1);
      }
    }
    // پوکه‌ها
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt;
      sh.vel.y -= 9 * dt;
      sh.m.position.addScaledVector(sh.vel, dt);
      sh.m.rotation.x += sh.spin.x * dt;
      sh.m.rotation.y += sh.spin.y * dt;
      if (sh.m.position.y < 0.02) {
        sh.m.position.y = 0.02;
        sh.vel.set(sh.vel.x * 0.3, Math.abs(sh.vel.y) * 0.25, sh.vel.z * 0.3);
      }
      if (sh.life <= 0) {
        this.scene.remove(sh.m);
        this.shells.splice(i, 1);
      }
    }
    // پینگ‌های رادار
    for (let i = this.radarPings.length - 1; i >= 0; i--) {
      this.radarPings[i].life -= dt;
      if (this.radarPings[i].life <= 0) this.radarPings.splice(i, 1);
    }
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
      s.sprite.scale.setScalar(0.16 + (0.42 - s.life) * s.grow);
      if (s.life <= 0) {
        this.scene.remove(s.sprite);
        this.spritePool.push(s.sprite);
        this.sprites.splice(i, 1);
      }
    }
    this.dustT += dt;
    this.dust.position.set(this.pos.x, 0, this.pos.z);
    this.dust.rotation.y = this.dustT * (0.02 + this.stormK * 0.5);
  }

  /** طوفان شن — مه غلیظ، گردوغبار شدید، دید کم */
  private updateStorm(dt: number) {
    this.stormK += ((this.storm ? 1 : 0) - this.stormK) * Math.min(1, dt * 0.8);
    const fog = this.scene.fog as THREE.Fog;
    if (fog) {
      fog.near = 70 - this.stormK * 55;
      fog.far = 330 - this.stormK * 230;
      fog.color.setHex(0xd8c69c).lerp(new THREE.Color(0xb89a66), this.stormK * 0.7);
    }
    (this.scene.background as THREE.Color).setHex(0xd8c69c).lerp(new THREE.Color(0xc0a272), this.stormK * 0.7);
    const dm = this.dust.material as THREE.PointsMaterial;
    dm.opacity = 0.38 + this.stormK * 0.5;
    dm.size = 0.12 + this.stormK * 0.16;
  }

  /* ================= مینی‌مپ و قطب‌نما ================= */

  bindHud(minimap: HTMLCanvasElement, compass: HTMLElement) {
    this.minimap = minimap;
    this.compassEl = compass;
    this.buildCompass();
    this.drawMapBase();
  }

  private buildCompass() {
    if (!this.compassEl) return;
    this.compassEl.innerHTML = "";
    this.compassLabels = [];
    const majors: Record<number, string> = { 0: "ش", 90: "خ", 180: "ج", 270: "غ" };
    const mids: Record<number, string> = { 45: "ش‌خ", 135: "ج‌خ", 225: "ج‌غ", 315: "ش‌غ" };
    for (let d = 0; d < 360; d += 15) {
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.top = "50%";
      el.style.transform = "translate(-50%,-50%)";
      if (majors[d] !== undefined) {
        el.textContent = majors[d];
        el.style.fontFamily = "'Vazirmatn', sans-serif";
        el.style.fontWeight = "900";
        el.style.fontSize = "15px";
        el.style.color = "#ffb03a";
      } else if (mids[d] !== undefined) {
        el.textContent = mids[d];
        el.style.fontFamily = "'Vazirmatn', sans-serif";
        el.style.fontWeight = "700";
        el.style.fontSize = "10px";
        el.style.color = "#d8c49a";
      } else {
        el.style.width = "1px";
        el.style.height = "7px";
        el.style.background = "rgba(216,196,154,0.5)";
      }
      this.compassEl.appendChild(el);
      this.compassLabels.push({ el, deg: d });
    }
  }

  private updateCompass() {
    if (!this.compassEl) return;
    const heading = THREE.MathUtils.euclideanModulo((-this.yaw * 180) / Math.PI, 360);
    const ppd = 2.6;
    const center = this.compassEl.clientWidth / 2 || 150;
    for (const l of this.compassLabels) {
      let rel = l.deg - heading;
      rel = THREE.MathUtils.euclideanModulo(rel + 180, 360) - 180;
      if (Math.abs(rel) > 58) {
        l.el.style.opacity = "0";
        continue;
      }
      l.el.style.opacity = String(1 - Math.abs(rel) / 62);
      l.el.style.left = `${center + rel * ppd}px`;
    }
  }

  private drawMapBase() {
    if (!this.minimap) return;
    const S = this.minimap.width;
    const base = document.createElement("canvas");
    base.width = base.height = S;
    const g = base.getContext("2d")!;
    const sc = S / (WALL * 2 + 20);
    const px = (x: number) => (x + WALL + 10) * sc;
    g.fillStyle = "#12170d";
    g.fillRect(0, 0, S, S);
    // جاده‌ها
    g.strokeStyle = "#3d3a2c";
    g.lineWidth = 10 * sc;
    g.beginPath();
    g.moveTo(px(0), px(-WALL));
    g.lineTo(px(0), px(WALL));
    g.moveTo(px(-WALL), px(0));
    g.lineTo(px(WALL), px(0));
    g.stroke();
    // منطقه‌ها
    const zone = (x0: number, z0: number, x1: number, z1: number, fill: string, stroke: string) => {
      g.fillStyle = fill;
      g.strokeStyle = stroke;
      g.lineWidth = 1.4;
      g.fillRect(px(x0), px(z0), (x1 - x0) * sc, (z1 - z0) * sc);
      g.strokeRect(px(x0), px(z0), (x1 - x0) * sc, (z1 - z0) * sc);
    };
    zone(ZONES.plaza.x0, ZONES.plaza.z0, ZONES.plaza.x1, ZONES.plaza.z1, "rgba(255,176,58,0.10)", "rgba(255,176,58,0.4)");
    zone(ZONES.cont.x0, ZONES.cont.z0, ZONES.cont.x1, ZONES.cont.z1, "rgba(110,130,160,0.12)", "rgba(140,160,190,0.4)");
    zone(ZONES.res.x0, ZONES.res.z0, ZONES.res.x1, ZONES.res.z1, "rgba(190,150,110,0.12)", "rgba(200,160,120,0.4)");
    zone(ZONES.rocks.x0, ZONES.rocks.z0, ZONES.rocks.x1, ZONES.rocks.z1, "rgba(150,140,120,0.10)", "rgba(170,160,140,0.35)");
    g.fillStyle = "rgba(90,160,90,0.14)";
    g.strokeStyle = "rgba(120,190,120,0.45)";
    g.beginPath();
    g.arc(px(ZONES.oasis.cx), px(ZONES.oasis.cz), ZONES.oasis.r * sc, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // دیوار دور
    g.strokeStyle = "rgba(255,176,58,0.55)";
    g.lineWidth = 2.4;
    g.strokeRect(px(-WALL), px(-WALL), WALL * 2 * sc, WALL * 2 * sc);
    g.fillStyle = "rgba(216,196,154,0.75)";
    g.font = `700 ${Math.round(S * 0.055)}px Vazirmatn, sans-serif`;
    g.textAlign = "center";
    g.fillText("ش", px(0), px(-WALL) + S * 0.07);
    this.mapBase = base;
  }

  private updateMinimap() {
    if (!this.minimap || !this.mapBase) return;
    const g = this.minimap.getContext("2d")!;
    const S = this.minimap.width;
    const sc = S / (WALL * 2 + 20);
    const px = (x: number) => (x + WALL + 10) * sc;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.mapBase, 0, 0);

    // آیتم‌ها
    g.fillStyle = "#5fd8e8";
    for (const p of this.pickups) {
      if (p.taken) continue;
      g.fillRect(px(p.pos.x) - 1.5, px(p.pos.z) - 1.5, 3, 3);
    }
    // دشمن‌ها
    for (const s of this.soldiers) {
      if (s.dead) continue;
      const x = px(s.root.position.x);
      const y = px(s.root.position.z);
      if (s.team === "enemy") {
        g.fillStyle = s.etype === "heavy" ? "#ff7a3a" : "#ff4b3a";
        if (s.etype === "heavy") g.fillRect(x - 3, y - 3, 6, 6);
        else {
          g.beginPath();
          g.arc(x, y, s.etype === "runner" ? 2.2 : 2.8, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.fillStyle = "#4fc96a";
        g.beginPath();
        g.arc(x, y, 2.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    // بازیکن
    const cx = px(this.pos.x);
    const cy = px(this.pos.z);
    g.save();
    g.translate(cx, cy);
    g.rotate(-this.yaw);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(0, -5.5);
    g.lineTo(4, 4.5);
    g.lineTo(-4, 4.5);
    g.closePath();
    g.fill();
    g.restore();
  }

  /* ================= رویدادها ================= */

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
      if (e.code === "KeyB") {
        if (this.buyOpen) this.closeBuy();
        else this.openBuy();
        return;
      }
      if (e.code === "Escape" && this.buyOpen) {
        this.closeBuy();
        return;
      }
      if (this.buyOpen) return;
      if (e.code === "Digit1") this.switchWeapon(0);
      if (e.code === "Digit2") this.switchWeapon(1);
      if (e.code === "Digit3") this.switchWeapon(2);
      if (e.code === "KeyQ") this.cyclePrimary(1);
      if (e.code === "KeyP") {
        if (this.state === "play") this.pause();
        else if (this.state === "paused") this.resume();
      }
    }) as EventListener);
    on(document, "keyup", ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
    }) as EventListener);

    on(document, "mousemove", ((e: MouseEvent) => {
      if (this.state !== "play") return;
      const locked = document.pointerLockElement === this.renderer.domElement;
      const sens = 0.0022 * (1 - this.adsK * 0.45); // نشانه‌گیری = دقت بیشتر
      if (locked) {
        this.yaw -= e.movementX * sens;
        this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sens, -1.45, 1.45);
      } else if (this.dragLook) {
        // حالت کشیدنی (وقتی مرورگر اجازه‌ی قفل ماوس نمی‌دهد)
        const ds = 0.0042 * (1 - this.adsK * 0.45);
        this.yaw -= (e.clientX - this.lastMX) * ds;
        this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.lastMY) * ds, -1.45, 1.45);
        this.lastMX = e.clientX;
        this.lastMY = e.clientY;
      }
    }) as EventListener);

    on(document, "mousedown", ((e: MouseEvent) => {
      if (this.state !== "play") return;
      if (e.button === 2) {
        // نشانه‌گیری روی شانه (ADS)
        e.preventDefault();
        this.adsDown = true;
        return;
      }
      if (e.button !== 0 || this.buyOpen) return;
      const locked = document.pointerLockElement === this.renderer.domElement;
      this.mouseDown = true;
      this.mousePressed = true;
      this.fireCd = Math.min(this.fireCd, 0);
      if (!locked) {
        this.dragLook = true;
        this.lastMX = e.clientX;
        this.lastMY = e.clientY;
      }
    }) as EventListener);
    on(document, "mouseup", ((e: MouseEvent) => {
      if ((e as MouseEvent).button === 2) this.adsDown = false;
      this.mouseDown = false;
      this.dragLook = false;
    }) as EventListener);

    on(window, "wheel", ((e: WheelEvent) => {
      if (this.state !== "play") return;
      const d = e.deltaY > 0 ? 1 : -1;
      this.switchWeapon((this.slot + d + 3) % 3);
    }) as EventListener, );

    on(document, "pointerlockchange", (() => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      if (!locked && this.state === "play" && !this.buyOpen) {
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

  /* ================= حالت‌ها ================= */

  start() {
    this.clearSoldiers();
    this.grenadeList.forEach((g) => this.scene.remove(g.mesh));
    this.grenadeList = [];
    this.pos.set(0, 0, 28);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.health = 100;
    this.armor = 25;
    this.grenades = 2;
    this.slot = 0;
    this.ammoArr = [30, 12, 0];
    this.reserveArr = [120, Infinity, 0];
    this.reloading = false;
    this.heat = 0;
    this.shake = 0;
    this.kills = 0;
    this.headshots = 0;
    this.score = 0;
    this.time = 0;
    this.streak = 0;
    this.feed = [];
    this.stats = null;
    this.gunBodies.forEach((g, i) => (g.visible = i === 0));
    for (const p of this.pickups) {
      p.taken = false;
      p.mesh.visible = true;
    }
    // هم‌رزم‌های اولیه
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const s = this.spawnSoldier("ally", "rifle", new THREE.Vector3(Math.cos(a) * 4, 0, 24 + Math.sin(a) * 3), 1, i);
      s.alerted = true;
    }
    this.state = "play";
    this.spawnWave(1);
    this.requestLock();
    sfx.startWind();
    this.emitNow();
  }

  resume() {
    if (this.state !== "paused") return;
    this.requestLock();
    const retry = () => {
      if (this.disposed || this.state !== "paused") return;
      this.requestLock();
    };
    setTimeout(retry, 600);
    setTimeout(retry, 1400);
    // اگر مرورگر اصلاً قفل ماوس ندهد، با حالت کشیدنی ادامه می‌دهیم
    setTimeout(() => {
      if (this.disposed || this.state !== "paused") return;
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.state = "play";
        this.emitNow();
      }
    }, 2300);
  }

  /** از کلیک مستقیم کاربر صدا زده می‌شود */
  lockPointer() {
    this.requestLock();
  }

  pause() {
    if (this.state !== "play") return;
    this.state = "paused";
    if (document.pointerLockElement) document.exitPointerLock();
    this.emitNow();
  }

  toMenu() {
    this.clearSoldiers();
    this.state = "menu";
    sfx.stopWind();
    this.spawnMenuActors();
    if (document.pointerLockElement) document.exitPointerLock();
    this.emitNow();
  }

  private emitNow() {
    const w = WEAPONS[this.slot];
    const reserve = this.reserveArr[this.slot];
    this.hud({
      state: this.state,
      modelSource: this.modelSource,
      propsSource: this.propsSource,
      assetsLoaded: this.assetsLoaded,
      assetsTotal: this.assetsTotal,
      locked: document.pointerLockElement === this.renderer.domElement,
      health: Math.ceil(this.health),
      armor: Math.ceil(this.armor),
      ammo: w.melee ? -1 : this.ammoArr[this.slot],
      reserve: w.melee ? -1 : Number.isFinite(reserve) ? reserve : -2,
      reloading: this.reloading,
      slot: this.slot,
      weaponName: w.name,
      grenades: this.grenades,
      wave: this.wave,
      kills: this.kills,
      headshots: this.headshots,
      score: this.score,
      time: this.time,
      enemiesLeft: this.enemies().filter((e) => !e.dead).length,
      allies: this.allies().map((a) => ({ name: a.name, hp: Math.max(0, Math.ceil(a.hp)), maxHp: a.maxHp, alive: !a.dead })),
      spread: this.currentSpread(),
      hitKey: this.hitKey,
      headKey: this.headKey,
      dmgKey: this.dmgKey,
      feed: [...this.feed],
      bannerKey: this.bannerKey,
      bannerText: this.bannerText,
      bannerKind: this.bannerKind,
      stats: this.stats,
      money: this.money,
      buyOpen: this.buyOpen,
      scoping: this.scoping,
      best: this.best,
      ownedPrimaries: [...this.ownedPrimaries],
      primaryId: this.primaryId,
      dmgDirs: [...this.dmgDirs],
      storm: this.storm,
    });
  }

  /* ================= حلقه ================= */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === "menu") {
      this.orbitT += dt;
      const a = this.orbitT * 0.075;
      const r = 34 + Math.sin(this.orbitT * 0.2) * 8;
      this.camera.position.set(Math.cos(a) * r, 15 + Math.sin(this.orbitT * 0.27) * 3, 8 + Math.sin(a) * r);
      this.camera.lookAt(0, 2, 0);
      this.updateSoldiers(dt, "ambient");
      this.updateCompass();
    } else if (this.state === "play") {
      this.time += dt;
      this.updatePlayer(dt);
      this.updateSoldiers(dt, "combat");
      this.updateWeaponView(dt);
      this.updateGrenades(dt);
      this.updateStorm(dt);
      this.updateCompass();
      this.updateMinimap();

      const alive = this.enemies().some((e) => !e.dead);
      if (!alive && this.wave > 0) {
        this.waveCd -= dt;
        if (this.waveCd <= 0) {
          const bonus = 250 + this.wave * 50;
          this.score += bonus;
          this.health = Math.min(100, this.health + 25);
          this.armor = Math.min(100, this.armor + 40);
          this.reserveArr[0] += 60;
          this.grenades = Math.min(5, this.grenades + 1);
          this.showBanner(`موج پاک‌سازی شد  +${toFa(bonus)}`, "info");
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
    sfx.stopWind();
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
