import { useEffect, useRef, useState } from "react";
import { GameEngine, type HudState } from "./game/engine";
import { sfx } from "./game/audio";

/* ---------------- آیکون‌های SVG ---------------- */

const Skull = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C7 2 3 6 3 11c0 2.8 1.3 5.2 3.5 6.7V21a1 1 0 0 0 1 1H9v-2h2v2h2v-2h2v2h1.5a1 1 0 0 0 1-1v-3.3C19.7 16.2 21 13.8 21 11c0-5-4-9-9-9Zm-3.5 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM12 17l-1.5-2.5h3L12 17Z" />
  </svg>
);

const Bullet = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M14 3c3 1.5 5 5 5 9v6H9v-6c0-4 2-7.5 5-9Zm-7 13v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3H7Z" />
  </svg>
);

const Shield = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm0 10.5h6c-.5 3.6-2.9 6.8-6 8v-8H6V6.7l6-2.2v8Z" />
  </svg>
);

const Cross = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />
  </svg>
);

const Timer = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9 2h6v2H9V2Zm3 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v5.4l3.5 2-.9 1.6L11 15v-6h2Z" />
  </svg>
);

const Target = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
  </svg>
);

const Bolt = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);

const GrenadeIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M14 3h3v2h-2v2.1A7 7 0 0 1 17 12a7 7 0 1 1-14 0 7 7 0 0 1 5-6.7V4a1 1 0 0 1 1-1h1V1h2v2h2Zm-4 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm13-2 2 2-4 4-2-2 4-4Z" />
  </svg>
);

const Users = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-3 0-6 1.6-6 4v2h12v-2c0-2.4-3-4-6-4Zm9-2a3 3 0 1 0-2-5.2A5 5 0 0 1 15 10a5 5 0 0 1 0 1 3 3 0 0 0 2-4v2Zm1 2c-.5 0-1 0-1.5.2A5.6 5.6 0 0 1 18 17v2h6v-2c0-2.4-3-4-5-4Z" />
  </svg>
);

const KnifeIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3 21c4-1 14-7 18-14 1-2 0-4-2-4-2 0-3 2-4 4-3 5-8 11-12 14Zm15-13c1-1.5 1.5-2.5 2-3 .5 1-.5 2.5-1 3.5-.3-.2-.7-.3-1-.5Z" />
  </svg>
);

/* ---------------- ابزار ---------------- */

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const initialHud: HudState = {
  state: "menu",
  modelSource: "loading",
  propsSource: "loading",
  assetsLoaded: 0,
  assetsTotal: 16,
  locked: false,
  health: 100,
  armor: 25,
  ammo: 30,
  reserve: 120,
  reloading: false,
  slot: 0,
  weaponName: "کلاشینکف AK-47",
  grenades: 2,
  wave: 0,
  kills: 0,
  headshots: 0,
  score: 0,
  time: 0,
  enemiesLeft: 0,
  allies: [],
  spread: 0.0035,
  hitKey: 0,
  headKey: 0,
  dmgKey: 0,
  feed: [],
  bannerKey: 0,
  bannerText: "",
  bannerKind: "wave",
  stats: null,
};

const WEAPON_SLOTS = [
  { key: "۱", name: "کلاشینکف", icon: <Bullet className="w-4 h-4" /> },
  { key: "۲", name: "کلت", icon: <Bullet className="w-3.5 h-3.5" /> },
  { key: "۳", name: "چاقو", icon: <KnifeIcon className="w-4 h-4" /> },
];

/* ---------------- برنامه ---------------- */

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new GameEngine(mountRef.current, (s) => setHud((prev) => ({ ...prev, ...s })));
    engineRef.current = engine;
    if (minimapRef.current && compassRef.current) {
      engine.bindHud(minimapRef.current, compassRef.current);
    }
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const eng = () => engineRef.current;
  const inGame = hud.state === "play" || hud.state === "paused" || hud.state === "over";
  const gap = Math.round(6 + hud.spread * 1700);
  const lowHp = hud.state === "play" && hud.health <= 30;
  const reserveText = hud.reserve === -2 ? "∞" : hud.reserve === -1 ? "—" : hud.reserve;

  return (
    <div dir="rtl" className="fixed inset-0 overflow-hidden bg-[#0c0f09] select-none">
      {/* بوم سه‌بعدی */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* لایه‌های جو */}
      <div className="absolute inset-0 pointer-events-none vignette" />
      <div className="absolute inset-0 pointer-events-none grain" />

      {/* هشدار قفل ماوس */}
      {hud.state === "play" && !hud.locked && (
        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <button
            className="btn-mil px-8 py-3 text-base pointer-events-auto anim-blink"
            onClick={() => eng()?.lockPointer()}
          >
            کلیک کن تا ماوس قفل شود
          </button>
          <span className="text-[11px] text-[#d8c49a]/75 bg-black/50 px-3 py-1 clip-tag">
            یا نگه‌دار و بکش تا نشانه بگیری — P برای توقف
          </span>
        </div>
      )}

      {/* مینی‌مپ و قطب‌نما — همیشه زنده (موتور مستقیم می‌کشد) */}
      <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
        <div className="relative w-[300px] h-8 hud-panel clip-tag overflow-hidden">
          <div ref={compassRef} className="absolute inset-0" />
          <div className="absolute left-1/2 top-0 h-full w-[2px] bg-[#ffb03a] -translate-x-1/2" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#ffb03a]" />
        </div>
      </div>

      <div className={`absolute top-14 left-4 pointer-events-none transition-opacity duration-300 ${inGame ? "opacity-100" : "opacity-0"}`}>
          <div className="hud-panel clip-panel p-1.5">
            <canvas ref={minimapRef} width={336} height={336} className="w-[168px] h-[168px] block" />
          </div>
          <div className="hud-panel clip-panel mt-2 px-3 py-2 w-[180px]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#d8c49a]/70 mb-1.5">
              <Users className="w-3.5 h-3.5 text-[#4fc96a]" /> هم‌رزم‌ها
            </div>
            {hud.allies.map((a) => (
              <div key={a.name} className="flex items-center gap-2 py-0.5">
                <span className={`text-[11px] font-bold w-9 ${a.alive ? "text-[#e9e4d4]" : "text-[#ff4b3a] line-through"}`}>{a.name}</span>
                <div className="flex-1 h-1.5 bg-black/60 overflow-hidden" style={{ transform: "skewX(-12deg)" }}>
                  <div
                    className={`h-full transition-all duration-300 ${a.alive ? "bg-[#4fc96a]" : "bg-[#552018]"}`}
                    style={{ width: `${a.alive ? (a.hp / a.maxHp) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* ================= HUD ================= */}
      {inGame && (
        <div className="absolute inset-0 pointer-events-none scanlines">
          {/* فلش آسیب */}
          {hud.dmgKey > 0 && (
            <div
              key={hud.dmgKey}
              className="absolute inset-0 anim-dmg"
              style={{ background: "radial-gradient(ellipse at center, rgba(255,40,20,0.12) 40%, rgba(200,10,0,0.55) 100%)" }}
            />
          )}
          {lowHp && (
            <div
              className="absolute inset-0 anim-lowhp"
              style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(190,10,0,0.5) 100%)" }}
            />
          )}

          {/* نشانگر اصابت */}
          {hud.hitKey > 0 && (
            <div key={`h${hud.hitKey}`} className="absolute left-1/2 top-1/2 anim-hit">
              <div className="w-5 h-5 relative">
                <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white" />
                <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white" />
              </div>
            </div>
          )}
          {hud.headKey > 0 && (
            <div key={`hs${hud.headKey}`} className="absolute left-1/2 top-1/2 anim-head text-center">
              <div className="font-stencil text-[#ffb03a] text-lg leading-none drop-shadow-[0_0_8px_rgba(255,150,30,0.8)]">✕</div>
              <div className="font-stencil text-[#ffb03a] text-[11px] mt-1 tracking-widest">HEADSHOT</div>
            </div>
          )}

          {/* کراس‌هیر */}
          {hud.state === "play" && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="absolute w-[2px] h-3 bg-[#9dff5a] shadow-[0_0_4px_rgba(120,255,60,0.9)]" style={{ left: -1, top: -gap - 12 }} />
              <div className="absolute w-[2px] h-3 bg-[#9dff5a] shadow-[0_0_4px_rgba(120,255,60,0.9)]" style={{ left: -1, top: gap }} />
              <div className="absolute h-[2px] w-3 bg-[#9dff5a] shadow-[0_0_4px_rgba(120,255,60,0.9)]" style={{ top: -1, left: -gap - 12 }} />
              <div className="absolute h-[2px] w-3 bg-[#9dff5a] shadow-[0_0_4px_rgba(120,255,60,0.9)]" style={{ top: -1, left: gap }} />
              <div className="absolute w-[3px] h-[3px] rounded-full bg-[#9dff5a]/80" style={{ left: -1.5, top: -1.5 }} />
            </div>
          )}

          {/* در حال خشاب‌گذاری */}
          {hud.reloading && hud.state === "play" && (
            <div className="absolute left-1/2 top-[58%] -translate-x-1/2 text-center anim-blink">
              <div className="text-[#ffb03a] font-bold text-sm">در حال خشاب‌گذاری…</div>
            </div>
          )}

          {/* بنر */}
          {hud.bannerKey > 0 && hud.state === "play" && (
            <div key={hud.bannerKey} className="absolute left-1/2 top-[24%] -translate-x-1/2 anim-banner">
              <div
                className={`clip-tag px-10 py-2 ${
                  hud.bannerKind === "streak"
                    ? "bg-[#ff4b3a] text-white"
                    : hud.bannerKind === "info"
                      ? "bg-[#17130a]/90 border border-[#ffb03a]/40 text-[#ffb03a]"
                      : "bg-[#ffb03a] text-[#17130a]"
                }`}
              >
                <span className="font-stencil text-3xl whitespace-nowrap">{hud.bannerText}</span>
              </div>
            </div>
          )}

          {/* پنل عملیات */}
          <div className="absolute top-14 right-4 hud-panel clip-panel px-4 py-3 min-w-[190px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-bold text-[#d8c49a]/70">موج</span>
              <span className="num text-2xl text-[#ffb03a] leading-none">{String(hud.wave).padStart(2, "0")}</span>
            </div>
            <div className="flex items-center justify-between gap-4 mt-2">
              <span className="text-[11px] font-bold text-[#d8c49a]/70 flex items-center gap-1"><Skull className="w-3.5 h-3.5" /> دشمن</span>
              <span className="num text-xl text-[#e9e4d4] leading-none">{hud.enemiesLeft}</span>
            </div>
            <div className="flex items-center justify-between gap-4 mt-2">
              <span className="text-[11px] font-bold text-[#d8c49a]/70 flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> زمان</span>
              <span className="num text-xl text-[#e9e4d4] leading-none">{fmtTime(hud.time)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 mt-2">
              <span className="text-[11px] font-bold text-[#d8c49a]/70 flex items-center gap-1"><Bolt className="w-3.5 h-3.5" /> امتیاز</span>
              <span className="num text-xl text-[#ffb03a] leading-none">{hud.score.toLocaleString("en-US")}</span>
            </div>
          </div>

          {/* کیل‌فید */}
          <div className="absolute top-[220px] right-4 flex flex-col items-end gap-1.5 max-w-[300px]">
            {hud.feed.map((f) => (
              <div key={f.id} className="anim-feed clip-tag bg-[#17130a]/85 border border-[#ffb03a]/25 px-3 py-1.5 flex items-center gap-2">
                {f.head ? <Target className="w-3.5 h-3.5 text-[#ffb03a]" /> : <Skull className="w-3.5 h-3.5 text-[#d8c49a]" />}
                <span className={`text-xs font-bold ${f.head ? "text-[#ffb03a]" : "text-[#e9e4d4]"}`}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* پایین-چپ: سلامتی و زره */}
          <div className="absolute bottom-4 left-4 hud-panel clip-panel px-4 py-3 w-[260px]">
            <div className="flex items-center gap-3">
              <Cross className={`w-6 h-6 shrink-0 ${hud.health <= 30 ? "text-[#ff4b3a]" : "text-[#9dff5a]"}`} />
              <div className="flex-1">
                <div className="h-3 bg-black/60 border border-white/10 overflow-hidden" style={{ transform: "skewX(-12deg)" }}>
                  <div
                    className={`h-full transition-all duration-200 ${hud.health <= 30 ? "bg-[#ff4b3a] anim-barlow" : "bg-[#9dff5a]"}`}
                    style={{ width: `${hud.health}%` }}
                  />
                </div>
              </div>
              <span className={`num text-3xl leading-none ${hud.health <= 30 ? "text-[#ff4b3a]" : "text-[#e9e4d4]"}`}>{hud.health}</span>
            </div>
            <div className="flex items-center gap-3 mt-2.5">
              <Shield className="w-6 h-6 shrink-0 text-[#6fb7ff]" />
              <div className="flex-1">
                <div className="h-2 bg-black/60 border border-white/10 overflow-hidden" style={{ transform: "skewX(-12deg)" }}>
                  <div className="h-full bg-[#6fb7ff] transition-all duration-200" style={{ width: `${hud.armor}%` }} />
                </div>
              </div>
              <span className="num text-xl text-[#6fb7ff] leading-none">{hud.armor}</span>
            </div>
          </div>

          {/* پایین-وسط: جای سلاح‌ها و نارنجک */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2">
            {WEAPON_SLOTS.map((w, i) => (
              <div
                key={w.name}
                className={`clip-tag px-4 py-2 flex items-center gap-2 border transition-all duration-150 ${
                  hud.slot === i
                    ? "bg-[#ffb03a] text-[#17130a] border-[#ffb03a] -translate-y-1"
                    : "bg-[#17130a]/80 text-[#d8c49a]/60 border-white/10"
                }`}
              >
                <span className={`num text-[10px] ${hud.slot === i ? "text-[#17130a]/70" : "text-[#d8c49a]/40"}`}>{w.key}</span>
                {w.icon}
                <span className="text-[11px] font-bold">{w.name}</span>
              </div>
            ))}
            <div className="clip-tag px-4 py-2 flex items-center gap-2 bg-[#17130a]/80 border border-white/10 text-[#d8c49a]">
              <GrenadeIcon className="w-4 h-4 text-[#9dff5a]" />
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={`w-2 h-2 rounded-full ${i < hud.grenades ? "bg-[#9dff5a]" : "bg-white/10"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* پایین-راست: مهمات */}
          <div className="absolute bottom-4 right-4 hud-panel clip-panel px-5 py-3 text-left">
            <div className="text-[11px] font-bold text-[#d8c49a]/70 mb-1 flex items-center gap-1.5 justify-end">
              <span>{hud.weaponName}</span>
              <Bullet className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-2 justify-end" dir="ltr">
              <span className="num text-[13px] text-[#d8c49a]/60">/ {reserveText}</span>
              <span
                className={`num text-5xl leading-none ${
                  hud.ammo === -1 ? "text-[#d8c49a]/40 text-3xl" : hud.ammo === 0 ? "text-[#ff4b3a]" : hud.ammo <= 6 ? "text-[#ffb03a]" : "text-[#e9e4d4]"
                }`}
              >
                {hud.ammo === -1 ? "—" : hud.ammo}
              </span>
            </div>
            {hud.ammo !== -1 && hud.ammo <= 6 && !hud.reloading && hud.state === "play" && (
              <div className="text-[10px] font-bold text-[#ffb03a] mt-1 anim-blink text-right">R — خشاب‌گذاری</div>
            )}
          </div>
        </div>
      )}

      {/* ================= منوی اصلی ================= */}
      {hud.state === "menu" && (
        <div className="absolute inset-0 scanlines">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f09] via-[#0c0f09]/45 to-[#0c0f09]/15" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0c0f09]/75 via-transparent to-transparent" />

          {/* عنوان */}
          <div className="absolute bottom-14 left-8 md:left-16 pointer-events-none">
            <div className="anim-stamp" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-[3px] w-14 bg-[#ffb03a]" />
                <span className="font-stencil text-[#ffb03a] text-sm tracking-[0.3em]">COUNTER WEB OPS</span>
              </div>
              <h1 className="font-stencil text-6xl md:text-8xl text-[#e9e4d4] leading-[0.95] drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">
                نبرد بزرگ
                <br />
                <span className="text-[#ffb03a]">صحرا</span>
              </h1>
            </div>
            <p className="anim-rise mt-5 max-w-md text-[#d8c49a]/90 text-sm md:text-base leading-7" style={{ animationDelay: "0.25s" }}>
              نقشه‌ای وسیع با میدان بازار، محله‌ی مسکونی، محوطه‌ی کانتینرها، نخلستان و صخره‌زار.
              چهار هم‌رزم کنار تو می‌جنگند؛ موج‌ها را پس بزن، هدشات بزن و رکورد بزن.
            </p>
            <div className="anim-rise flex flex-wrap gap-2 mt-4 max-w-lg" style={{ animationDelay: "0.3s" }}>
              {[
                hud.modelSource === "glb" ? "سرباز Mixamo ✔" : hud.modelSource === "loading" ? "بارگیری سرباز…" : "سرباز رویه‌ساز",
                hud.propsSource === "polyhaven"
                  ? `مدل‌های متن‌باز: ${hud.assetsLoaded}/${hud.assetsTotal} ✔`
                  : hud.propsSource === "loading"
                    ? `بارگیری مدل‌ها… ${hud.assetsLoaded}/${hud.assetsTotal}`
                    : "مدل‌های رویه‌ساز (آفلاین)",
                "نقشه ۳۸۰×۳۸۰ متر",
                "۴ هم‌رزم هوش مصنوعی",
                "سلاح‌های دانلودی",
              ].map((t) => (
                <span key={t} className="clip-tag bg-black/45 border border-[#ffb03a]/25 px-3 py-1 text-[11px] font-bold text-[#d8c49a]/90">
                  {t}
                </span>
              ))}
            </div>
            <div className="anim-rise mt-3 max-w-lg text-[10px] leading-5 text-[#d8c49a]/45" style={{ animationDelay: "0.35s" }}>
              منابع متن‌باز: Poly Haven (لایسنس CC0 — مالکیت عمومی) • poly.pizza (CC-BY) • three.js examples
              <br />
              همه‌ی دارایی‌ها در زمان اجرا از API رسمی سرویس‌ها فهرست‌گیری و دانلود می‌شوند.
            </div>
          </div>

          {/* کنترل‌ها */}
          <div className="absolute top-16 right-8 md:right-14 anim-rise" style={{ animationDelay: "0.35s" }}>
            <div className="hud-panel clip-panel p-5 w-[250px]">
              <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.25em] mb-3">CONTROLS</div>
              {[
                ["W A S D", "حرکت"],
                ["MOUSE", "نشانه‌گیری"],
                ["CLICK", "شلیک"],
                ["RIGHT-CLICK", "نشانه‌گیری دقیق (ADS)"],
                ["R", "خشاب‌گذاری"],
                ["SHIFT", "دویدن"],
                ["G", "پرتاب نارنجک"],
                ["1 / 2 / 3", "تعویض سلاح"],
                ["WHEEL", "تعویض سریع سلاح"],
                ["ESC / P", "توقف عملیات"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-[#d8c49a]/80 font-medium">{v}</span>
                  <span className="num text-[11px] bg-black/50 border border-[#ffb03a]/25 text-[#ffb03a] px-2 py-0.5">{k}</span>
                </div>
              ))}
            </div>
          </div>

          {/* شروع */}
          <div className="absolute bottom-14 right-8 md:right-14 anim-rise" style={{ animationDelay: "0.5s" }}>
            <button
              className="btn-mil text-xl px-12 py-4 pointer-events-auto"
              onClick={() => {
                sfx.init();
                sfx.click();
                eng()?.start();
              }}
            >
              شروع عملیات
            </button>
            <div className="text-center text-[10px] text-[#d8c49a]/50 mt-3 font-medium">
              اشیای صحنه و سلاح‌ها: Poly Haven (CC0) + poly.pizza (CC-BY) — دانلود زنده هنگام اجرا
            </div>
          </div>

          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-l from-transparent via-[#ffb03a] to-transparent opacity-60" />
        </div>
      )}

      {/* ================= توقف ================= */}
      {hud.state === "paused" && (
        <div className="absolute inset-0 bg-[#0c0f09]/70 backdrop-blur-[2px] flex items-center justify-center">
          <div className="hud-panel clip-panel p-8 w-[340px] anim-rise">
            <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.3em] mb-1">PAUSED</div>
            <h2 className="text-3xl font-black mb-6">عملیات متوقف شد</h2>
            <div className="flex flex-col gap-3">
              <button className="btn-mil py-3 text-lg" onClick={() => { sfx.click(); eng()?.resume(); }}>
                ادامه عملیات
              </button>
              <button className="btn-ghost py-2.5" onClick={() => { sfx.click(); eng()?.start(); }}>
                شروع دوباره
              </button>
              <button className="btn-ghost py-2.5" onClick={() => { sfx.click(); eng()?.toMenu(); }}>
                بازگشت به منو
              </button>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-[#d8c49a]/60 leading-5">
              نکته: هم‌رزم‌هایت هر موج دوباره برمی‌گردند. آیتم‌های روی نقشه (مربع‌های فیروزه‌ای در رادار) سلامتی، زره و مهمات می‌دهند.
            </div>
          </div>
        </div>
      )}

      {/* ================= پایان ================= */}
      {hud.state === "over" && hud.stats && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a0806]/90 via-[#0c0f09]/80 to-[#0c0f09]/60 flex items-center justify-center scanlines">
          <div className="text-center px-6">
            <div className="font-stencil text-[#ff4b3a] text-sm tracking-[0.4em] mb-2 anim-rise">MISSION FAILED</div>
            <h2 className="anim-stamp font-stencil text-6xl md:text-7xl text-[#e9e4d4] mb-2">شکست خوردی</h2>
            <p className="text-[#d8c49a]/80 mb-8 anim-rise" style={{ animationDelay: "0.15s" }}>
              نیروهای دشمن در موج <span className="num text-[#ffb03a]">{hud.stats.wave}</span> بر میدان چیره شدند
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto anim-rise" style={{ animationDelay: "0.25s" }}>
              {[
                { label: "امتیاز", val: hud.stats.score.toLocaleString("en-US"), icon: <Bolt className="w-5 h-5" />, big: true },
                { label: "کشتار", val: String(hud.stats.kills), icon: <Skull className="w-5 h-5" /> },
                { label: "هدشات", val: String(hud.stats.headshots), icon: <Target className="w-5 h-5" /> },
                { label: "زمان بقا", val: fmtTime(hud.stats.time), icon: <Timer className="w-5 h-5" /> },
              ].map((s) => (
                <div key={s.label} className="hud-panel clip-panel px-4 py-4">
                  <div className={`flex items-center justify-center gap-1.5 mb-1 ${s.big ? "text-[#ffb03a]" : "text-[#d8c49a]/60"}`}>
                    {s.icon}
                    <span className="text-[11px] font-bold">{s.label}</span>
                  </div>
                  <div className={`num leading-none ${s.big ? "text-4xl text-[#ffb03a]" : "text-2xl text-[#e9e4d4]"}`}>{s.val}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 mt-10 anim-rise" style={{ animationDelay: "0.4s" }}>
              <button className="btn-mil px-10 py-3.5 text-lg" onClick={() => { sfx.click(); eng()?.start(); }}>
                عملیات دوباره
              </button>
              <button className="btn-ghost px-8 py-3.5" onClick={() => { sfx.click(); eng()?.toMenu(); }}>
                منوی اصلی
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
