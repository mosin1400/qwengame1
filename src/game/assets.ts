import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/* ============================================================
   بانک دارایی‌های متن‌باز
   • Poly Haven  → لایسنس CC0 (مالکیت عمومی)
   • poly.pizza  → مدل‌های low-poly رایگان (CC-BY)
   همه‌ی آدرس‌ها در زمان اجرا از API خودِ سرویس‌ها گرفته می‌شود؛
   هر چیزی که دانلود نشود، با نسخه‌ی رویه‌ساز جایگزین می‌شود.
   ============================================================ */

export type SlotName =
  | "house" | "stall" | "container" | "palm" | "rock" | "crate" | "barrel"
  | "pallet" | "sandbag" | "tower" | "truck" | "lamp"
  | "wpn-ak" | "wpn-pistol" | "wpn-knife" | "grenade";

interface SlotDef {
  kw: string;            // کلیدواژه‌ی جستجوی poly.pizza
  ph?: string;           // زیرنام برای جستجو در فهرست Poly Haven
  h?: number;            // ارتفاع هدف نرمال‌سازی
  len?: number;          // طول هدف (سلاح‌ها)
  weapon?: boolean;
  gripZ?: number;        // جابه‌جایی دسته نسبت به مرکز
}

export const SLOT_DEFS: Record<SlotName, SlotDef> = {
  house:      { kw: "desert house", h: 6.2 },
  stall:      { kw: "market stall", h: 2.7 },
  container:  { kw: "shipping container", h: 2.7 },
  palm:       { kw: "palm tree", h: 7.5 },
  rock:       { kw: "low poly rock", h: 3.4 },
  crate:      { kw: "wooden crate", ph: "crate", h: 1.6 },
  barrel:     { kw: "oil barrel", ph: "barrel", h: 1.15 },
  pallet:     { kw: "wooden pallet", ph: "pallet", h: 0.5 },
  sandbag:    { kw: "sandbag", h: 1.0 },
  tower:      { kw: "watchtower", h: 10.5 },
  truck:      { kw: "pickup truck", h: 2.1 },
  lamp:       { kw: "street lamp", ph: "lamp", h: 4.5 },
  "wpn-ak":     { kw: "ak-47", len: 0.92, weapon: true, gripZ: 0.14 },
  "wpn-pistol": { kw: "pistol gun", len: 0.26, weapon: true, gripZ: 0.03 },
  "wpn-knife":  { kw: "combat knife", len: 0.34, weapon: true, gripZ: 0.02 },
  grenade:    { kw: "grenade", h: 0.3 },
};

const SLOTS = Object.keys(SLOT_DEFS) as SlotName[];

async function fetchT(url: string, ms = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/** جستجوی اولین رشته‌ی http...glb در هر ساختار JSON */
function findGlbUrl(v: unknown, guard = 0): string | null {
  if (guard > 900) return null;
  if (typeof v === "string") {
    if (v.startsWith("http") && /\.glb(\?|$)/i.test(v)) return v;
    return null;
  }
  if (Array.isArray(v)) {
    for (const it of v) {
      const r = findGlbUrl(it, guard + 1);
      if (r) return r;
    }
    return null;
  }
  if (v && typeof v === "object") {
    // اولویت با فیلدهای GLB/glb
    const obj = v as Record<string, unknown>;
    for (const k of ["Download", "GLB", "glb", "GLTF", "gltf", "url", "Url", "download"]) {
      if (typeof obj[k] === "string") {
        const r = findGlbUrl(obj[k], guard + 1);
        if (r) return r;
      }
    }
    for (const val of Object.values(obj)) {
      const r = findGlbUrl(val, guard + 1);
      if (r) return r;
    }
  }
  return null;
}

/* ---------- نرمال‌سازی مدل‌ها ---------- */

export function normalizeProp(tpl: THREE.Object3D, targetH: number): THREE.Group {
  const holder = new THREE.Group();
  holder.add(tpl);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const s = targetH / Math.max(0.001, size.y);
  tpl.scale.setScalar(s);
  tpl.position.set(
    -((box.min.x + box.max.x) / 2) * s,
    -box.min.y * s,
    -((box.min.z + box.max.z) / 2) * s
  );
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return holder;
}

export interface WeaponRig {
  obj: THREE.Group;
  muzzle: THREE.Vector3;
}

export function normalizeWeapon(tpl: THREE.Object3D, def: SlotDef): WeaponRig {
  const holder = new THREE.Group();
  holder.add(tpl);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const L = Math.max(size.x, size.y, size.z, 0.001);
  const s = (def.len ?? 0.5) / L;
  tpl.scale.setScalar(s);
  // محور بلند را روی Z می‌اندازیم (جلوی صحنه = -Z)
  if (size.x === L) tpl.rotation.y = Math.PI / 2;
  else if (size.y === L) tpl.rotation.x = -Math.PI / 2;
  const b2 = new THREE.Box3().setFromObject(holder);
  tpl.position.set(
    -((b2.min.x + b2.max.x) / 2),
    -b2.min.y,
    -((b2.min.z + b2.max.z) / 2) + (def.gripZ ?? 0)
  );
  const b3 = new THREE.Box3().setFromObject(holder);
  const muzzle = new THREE.Vector3(
    (b3.min.x + b3.max.x) / 2,
    b3.min.y + (b3.max.y - b3.min.y) * 0.55,
    b3.min.z
  );
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = false;
  });
  return { obj: holder, muzzle };
}

/* ---------- بانک ---------- */

export class AssetBank {
  private loader = new GLTFLoader();
  private templates = new Map<SlotName, THREE.Object3D>();
  private listeners = new Set<(slot: SlotName, tpl: THREE.Object3D) => void>();
  loaded = 0;
  total = SLOTS.length;
  onStatus?: (loaded: number, total: number) => void;

  get(slot: SlotName): THREE.Object3D | null {
    return this.templates.get(slot) ?? null;
  }

  instantiate(slot: SlotName): THREE.Object3D | null {
    const t = this.templates.get(slot);
    return t ? t.clone() : null;
  }

  onSlot(fn: (slot: SlotName, tpl: THREE.Object3D) => void): () => void {
    this.listeners.add(fn);
    // اگر قبلاً بارگیری شده، فوراً خبر بده
    for (const [slot, tpl] of this.templates) fn(slot, tpl);
    return () => this.listeners.delete(fn);
  }

  private publish(slot: SlotName, tpl: THREE.Object3D) {
    if (this.templates.has(slot)) return;
    this.templates.set(slot, tpl);
    this.loaded = this.templates.size;
    for (const fn of this.listeners) {
      try {
        fn(slot, tpl);
      } catch {
        /* ignore */
      }
    }
    if (this.onStatus) this.onStatus(this.loaded, this.total);
  }

  async loadAll(): Promise<void> {
    const phSlugs = await this.fetchPolyHavenSlugs();
    await Promise.all(SLOTS.map((slot) => this.loadSlot(slot, phSlugs)));
  }

  /** فهرست مدل‌های Poly Haven (CC0) — اسلاگ‌ها را همان لحظه از API می‌گیریم */
  private async fetchPolyHavenSlugs(): Promise<Array<{ slug: string; name: string }>> {
    try {
      const res = await fetchT("https://api.polyhaven.com/assets?t=models", 9000);
      if (!res.ok) return [];
      const json = (await res.json()) as Record<string, { name?: string }>;
      return Object.entries(json).map(([slug, meta]) => ({ slug, name: (meta?.name ?? slug).toLowerCase() }));
    } catch {
      return [];
    }
  }

  private async loadSlot(slot: SlotName, phList: Array<{ slug: string; name: string }>): Promise<void> {
    const def = SLOT_DEFS[slot];
    // ۱) Poly Haven (CC0)
    if (def.ph) {
      const match = phList.find((m) => m.name.includes(def.ph!));
      if (match) {
        try {
          const tpl = await this.loadFromPolyHaven(match.slug);
          if (tpl) {
            this.publish(slot, def.weapon ? normalizeWeapon(tpl, def).obj : normalizeProp(tpl, def.h ?? 1));
            return;
          }
        } catch {
          /* poly.pizza */
        }
      }
    }
    // ۲) poly.pizza (CC-BY) — دو قالب API امتحان می‌شود
    const endpoints = [
      `https://api.poly.pizza/v1.1/search/${encodeURIComponent(def.kw)}?Limit=6`,
      `https://api.poly.pizza/v1/search/${encodeURIComponent(def.kw)}?Limit=6`,
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetchT(ep, 9000);
        if (!res.ok) continue;
        const json: unknown = await res.json();
        const url = findGlbUrl(json);
        if (!url) continue;
        const gltf = await this.loader.loadAsync(url);
        if (def.weapon) {
          const rig = normalizeWeapon(gltf.scene, def);
          (rig.obj as THREE.Group & { userData: Record<string, unknown> }).userData.muzzle = rig.muzzle;
          this.publish(slot, rig.obj);
        } else {
          this.publish(slot, normalizeProp(gltf.scene, def.h ?? 1));
        }
        return;
      } catch {
        /* قالب بعدی */
      }
    }
    // ۳) نشد — رویه‌ساز می‌ماند
  }

  private async loadFromPolyHaven(slug: string): Promise<THREE.Object3D | null> {
    const res = await fetchT(`https://api.polyhaven.com/files/${encodeURIComponent(slug)}`, 9000);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      "1k"?: { gltf?: { url?: string } };
      "2k"?: { gltf?: { url?: string } };
    };
    const url = json["1k"]?.gltf?.url ?? json["2k"]?.gltf?.url;
    if (!url) return null;
    const gltf = await this.loader.loadAsync(url);
    return gltf.scene;
  }

  /** URL بافت از Poly Haven (مثل بافت شن) */
  static async polyHavenTextureUrl(slug: string): Promise<string | null> {
    try {
      const res = await fetchT(`https://api.polyhaven.com/files/${encodeURIComponent(slug)}`, 9000);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        "2k"?: { jpg?: { diff?: string } };
        "1k"?: { jpg?: { diff?: string } };
      };
      return json["2k"]?.jpg?.diff ?? json["1k"]?.jpg?.diff ?? null;
    } catch {
      return null;
    }
  }
}
