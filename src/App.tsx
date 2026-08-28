import { useEffect, useRef, useState } from "react";
import { GameEngine, BUY_ITEMS, DIFF_LABELS, type HudState, type PrimaryId } from "./game/engine";
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

const HelmetIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 3a8 8 0 0 0-8 8v4h2v2h3v-2h6v2h3v-2h2v-4a8 8 0 0 0-8-8Zm-8 14v2h16v-2H4Z" />
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

const Coin = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1.2 15v1h-2v-1c-1.8-.3-3-1.4-3.1-3h1.9c.1.8.8 1.3 2.1 1.3 1.2 0 1.9-.5 1.9-1.2 0-.6-.5-1-1.8-1.3l-1.3-.3C8.6 12 7.5 11 7.5 9.4c0-1.5 1.2-2.7 3-3V5.4h2v1c1.7.3 2.8 1.3 3 2.8h-1.9c-.1-.7-.7-1.2-1.9-1.2-1.1 0-1.8.5-1.8 1.1 0 .6.5.9 1.7 1.2l1.3.3c2.3.5 3.4 1.5 3.4 3.2 0 1.7-1.3 2.9-3.1 3.2Z" />
  </svg>
);

const BombIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M14 5a7 7 0 1 1-6.3 10A7 7 0 0 1 14 5Zm3-3 1.5 1.5L16 6l2 2 1-1a2.8 2.8 0 0 0-4-4l-1 1 2 2-3-3Z" />
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
  money: 800,
  buyOpen: false,
  scoping: false,
  best: 0,
  ownedPrimaries: ["ak"],
  primaryId: "ak",
  dmgDirs: [],
  storm: false,
  helmet: 0,
  skin: null,
  difficulty: 1,
  scoreOpen: false,
  scoreRows: [],
  boss: null,
  bomb: null,
  achv: null,
  settings: { sens: 1, volume: 0.5, fov: 74, cross: "#9dff5a" },
};

const WEAPON_SLOTS = [
  { key: "۱", name: "کلاشینکف", icon: <Bullet className="w-4 h-4" /> },
  { key: "۲", name: "کلت", icon: <Bullet className="w-3.5 h-3.5" /> },
  { key: "۳", name: "چاقو", icon: <KnifeIcon className="w-4 h-4" /> },
];

const CROSS_COLORS = ["#9dff5a", "#ffb03a", "#ff4b3a", "#5fd8e8", "#ffffff"];

/* ---------------- برنامه ---------------- */

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);
  const [showSettings, setShowSettings] = useState(false);

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
  const cross = hud.settings.cross;

  return (
    <div dir="rtl" className="fixed inset-0 overflow-hidden bg-[#0c0f09] select-none">
      {/* بوم سه‌بعدی */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* لایه‌های جو */}
      <div className="absolute inset-0 pointer-events-none vignette" />
      <div className="absolute inset-0 pointer-events-none grain" />

      {/* هشدار قفل ماوس */}
      {hud.state === "play" && !hud.locked && !hud.buyOpen && (
        <div className="absolute left-1/2 top-[18%] -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <button className="btn-mil px-8 py-3 text-base pointer-events-auto anim-blink" onClick={() => eng()?.lockPointer()}>
            کلیک کن تا ماوس قفل شود
          </button>
          <span className="text-[11px] text-[#d8c49a]/75 bg-black/50 px-3 py-1 clip-tag">یا نگه‌دار و بکش تا نشانه بگیری — P برای توقف</span>
        </div>
      )}

      {/* قطب‌نما */}
      <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
        <div className="relative w-[300px] h-8 hud-panel clip-tag overflow-hidden">
          <div ref={compassRef} className="absolute inset-0" />
          <div className="absolute left-1/2 top-0 h-full w-[2px] bg-[#ffb03a] -translate-x-1/2" />
        </div>
      </div>

      {/* مینی‌مپ و هم‌رزم‌ها */}
      <div className={`absolute top-14 left-4 pointer-events-none transition-opacity duration-300 ${inGame ? "opacity-100" : "opacity-0"}`}>
        <div className="hud-panel clip-panel p-1.5">
          <canvas ref={minimapRef} width={336} height={336} className="w-[168px] h-[168px] block" />
        </div>
        <div className="hud-panel clip-panel mt-2 px-3 py-2 w-[180px]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#d8c49a]/70 mb-1.5">
            <Users className="w-3.5 h-3.5 text-[#4fc96a]" /> هم‌رزم‌ها — Tab جدول امتیازات
          </div>
          {hud.allies.map((a) => (
            <div key={a.name} className="flex items-center gap-2 py-0.5">
              <span className={`text-[11px] font-bold w-9 ${a.alive ? "text-[#e9e4d4]" : "text-[#ff4b3a] line-through"}`}>{a.name}</span>
              <div className="flex-1 h-1.5 bg-black/60 overflow-hidden" style={{ transform: "skewX(-12deg)" }}>
                <div className={`h-full transition-all duration-300 ${a.alive ? "bg-[#4fc96a]" : "bg-[#552018]"}`} style={{ width: `${a.alive ? (a.hp / a.maxHp) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        {/* دستاورد */}
        {hud.achv && (
          <div key={hud.achv.key} className="anim-feed hud-panel clip-panel mt-2 px-3 py-2 w-[180px] border-[#ffb03a]/60">
            <div className="text-[9px] font-bold text-[#ffb03a]/70 tracking-widest">دستاورد جدید</div>
            <div className="text-xs font-black text-[#ffb03a] mt-0.5">🏅 {hud.achv.label}</div>
          </div>
        )}
      </div>

      {/* ================= HUD ================= */}
      {inGame && (
        <div className="absolute inset-0 pointer-events-none scanlines">
          {/* طوفان شن */}
          {hud.storm && (
            <div className="absolute inset-0 anim-lowhp" style={{ background: "linear-gradient(100deg, rgba(190,150,90,0.16), rgba(160,120,60,0.3))" }} />
          )}

          {/* فلش آسیب + جهت‌نما */}
          {hud.dmgKey > 0 && (
            <div key={hud.dmgKey} className="absolute inset-0 anim-dmg" style={{ background: "radial-gradient(ellipse at center, rgba(255,40,20,0.12) 40%, rgba(200,10,0,0.55) 100%)" }} />
          )}
          {hud.dmgDirs.map((d) => (
            <div key={d.id} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${d.deg}deg)` }}>
              <div className="anim-dmg" style={{ position: "absolute", left: -16, top: -130, width: 32, height: 26, background: "linear-gradient(to top, rgba(255,60,40,0.85), transparent)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
            </div>
          ))}
          {lowHp && <div className="absolute inset-0 anim-lowhp" style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(190,10,0,0.5) 100%)" }} />}

          {/* اسکوپ اسنایپر */}
          {hud.scoping && hud.state === "play" && (
            <div className="absolute inset-0">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[86vmin] h-[86vmin] rounded-full border-[3px] border-black" style={{ boxShadow: "0 0 0 200vmax rgba(0,0,0,0.97)" }}>
                <div className="absolute inset-0 rounded-full border border-black/50" />
                <div className="absolute left-1/2 top-0 h-full w-[2px] bg-black/80 -translate-x-1/2" />
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-black/80 -translate-y-1/2" />
                <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-[#ff4b3a] -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
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
          {hud.state === "play" && !hud.scoping && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="absolute w-[2px] h-3" style={{ left: -1, top: -gap - 12, background: cross, boxShadow: `0 0 4px ${cross}` }} />
              <div className="absolute w-[2px] h-3" style={{ left: -1, top: gap, background: cross, boxShadow: `0 0 4px ${cross}` }} />
              <div className="absolute h-[2px] w-3" style={{ top: -1, left: -gap - 12, background: cross, boxShadow: `0 0 4px ${cross}` }} />
              <div className="absolute h-[2px] w-3" style={{ top: -1, left: gap, background: cross, boxShadow: `0 0 4px ${cross}` }} />
              <div className="absolute w-[3px] h-[3px] rounded-full" style={{ left: -1.5, top: -1.5, background: cross, opacity: 0.8 }} />
            </div>
          )}

          {/* بمب */}
          {hud.bomb && hud.state === "play" && (
            <div className="absolute left-1/2 top-[13%] -translate-x-1/2 text-center">
              {hud.bomb.state === "planted" ? (
                <div className="hud-panel clip-panel px-6 py-2 border-[#ff4b3a]/60">
                  <div className="flex items-center gap-2 justify-center text-[#ff4b3a]">
                    <BombIcon className="w-5 h-5 anim-blink" />
                    <span className="num text-3xl">{Math.max(0, hud.bomb.timer).toFixed(1)}</span>
                    <span className="text-[11px] font-bold">سایت {hud.bomb.site}</span>
                  </div>
                  {hud.bomb.defuseP > 0 && (
                    <div className="mt-1.5 h-2 w-44 bg-black/60 overflow-hidden mx-auto" style={{ transform: "skewX(-12deg)" }}>
                      <div className="h-full bg-[#9dff5a] transition-all" style={{ width: `${hud.bomb.defuseP * 100}%` }} />
                    </div>
                  )}
                  <div className="text-[10px] text-[#d8c49a]/75 mt-1 font-bold">برای خنثی‌سازی E را نگه دار</div>
                </div>
              ) : (
                <div className="clip-tag bg-[#17130a]/85 border border-[#ffd23a]/50 px-4 py-1.5 text-[#ffd23a] text-xs font-bold anim-blink">
                  <BombIcon className="w-3.5 h-3.5 inline-block ml-1 -mt-0.5" />
                  حامل بمب را متوقف کن — سایت {hud.bomb.site}
                </div>
              )}
            </div>
          )}

          {/* نوار باس */}
          {hud.boss && hud.state === "play" && (
            <div className="absolute left-1/2 top-[8%] -translate-x-1/2 w-[340px]">
              <div className="flex items-center justify-between text-[11px] font-black text-[#e8b8ff] mb-1">
                <span>☠ فرمانده</span>
                <span className="num">{hud.boss.hp}</span>
              </div>
              <div className="h-2.5 bg-black/70 border border-[#e8b8ff]/40 overflow-hidden" style={{ transform: "skewX(-12deg)" }}>
                <div className="h-full bg-gradient-to-l from-[#e8b8ff] to-[#a06acc] transition-all duration-200" style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }} />
              </div>
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
                  hud.bannerKind === "streak" ? "bg-[#ff4b3a] text-white" : hud.bannerKind === "info" ? "bg-[#17130a]/90 border border-[#ffb03a]/40 text-[#ffb03a]" : "bg-[#ffb03a] text-[#17130a]"
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
              <span className="text-[11px] font-bold text-[#d8c49a]/70 flex items-center gap-1"><Bolt className="w-3.5 h-3.5" /> امتیاز</span>
              <span className="num text-xl text-[#ffb03a] leading-none">{hud.score.toLocaleString("en-US")}</span>
            </div>
            <div className="flex items-center justify-between gap-4 mt-2">
              <span className="text-[11px] font-bold text-[#d8c49a]/70 flex items-center gap-1"><Coin className="w-3.5 h-3.5" /> پول</span>
              <span className="num text-xl text-[#9dff5a] leading-none">${hud.money.toLocaleString("en-US")}</span>
            </div>
            <button className="btn-ghost w-full py-1 mt-2.5 text-[11px] pointer-events-auto" onClick={() => eng()?.openBuy()}>
              فروشگاه (B)
            </button>
          </div>

          {/* کیل‌فید */}
          <div className="absolute top-[250px] right-4 flex flex-col items-end gap-1.5 max-w-[300px]">
            {hud.feed.map((f) => (
              <div key={f.id} className="anim-feed clip-tag bg-[#17130a]/85 border border-[#ffb03a]/25 px-3 py-1.5 flex items-center gap-2">
                {f.head ? <Target className="w-3.5 h-3.5 text-[#ffb03a]" /> : <Skull className="w-3.5 h-3.5 text-[#d8c49a]" />}
                <span className={`text-xs font-bold ${f.head ? "text-[#ffb03a]" : "text-[#e9e4d4]"}`}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* پایین-چپ: سلامتی و زره و کلاه */}
          <div className="absolute bottom-4 left-4 hud-panel clip-panel px-4 py-3 w-[260px]">
            <div className="flex items-center gap-3">
              <Cross className={`w-6 h-6 shrink-0 ${hud.health <= 30 ? "text-[#ff4b3a]" : "text-[#9dff5a]"}`} />
              <div className="flex-1">
                <div className="h-3 bg-black/60 border border-white/10 overflow-hidden" style={{ transform: "skewX(-12deg)" }}>
                  <div className={`h-full transition-all duration-200 ${hud.health <= 30 ? "bg-[#ff4b3a] anim-barlow" : "bg-[#9dff5a]"}`} style={{ width: `${hud.health}%` }} />
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
            {hud.helmet > 0 && (
              <div className="flex items-center gap-3 mt-2.5">
                <HelmetIcon className="w-6 h-6 shrink-0 text-[#d8c49a]" />
                <div className="flex-1">
                  <div className="h-1.5 bg-black/60 border border-white/10 overflow-hidden" style={{ transform: "skewX(-12deg)" }}>
                    <div className="h-full bg-[#d8c49a] transition-all duration-200" style={{ width: `${hud.helmet}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* پایین-وسط: سلاح‌ها */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2">
            {WEAPON_SLOTS.map((w, i) => {
              const primaryLabel: Record<string, string> = { ak: "کلاشینکف", mp5: "MP5", shotgun: "شاتگان", awp: "AWP" };
              const label = i === 0 ? primaryLabel[hud.primaryId] ?? w.name : w.name;
              return (
                <div
                  key={w.name}
                  className={`clip-tag px-4 py-2 flex items-center gap-2 border transition-all duration-150 ${
                    hud.slot === i ? "bg-[#ffb03a] text-[#17130a] border-[#ffb03a] -translate-y-1" : "bg-[#17130a]/80 text-[#d8c49a]/60 border-white/10"
                  }`}
                >
                  <span className={`num text-[10px] ${hud.slot === i ? "text-[#17130a]/70" : "text-[#d8c49a]/40"}`}>{w.key}</span>
                  {w.icon}
                  <span className="text-[11px] font-bold">{label}</span>
                </div>
              );
            })}
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
              <span className={`num text-5xl leading-none ${hud.ammo === -1 ? "text-[#d8c49a]/40 text-3xl" : hud.ammo === 0 ? "text-[#ff4b3a]" : hud.ammo <= 6 ? "text-[#ffb03a]" : "text-[#e9e4d4]"}`}>
                {hud.ammo === -1 ? "—" : hud.ammo}
              </span>
            </div>
          </div>

          {/* جدول امتیازات (Tab) */}
          {hud.scoreOpen && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hud-panel clip-panel p-5 w-[380px]">
              <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.25em] mb-3">SCOREBOARD</div>
              <div className="grid grid-cols-[1fr_70px_80px] text-[11px] font-bold text-[#d8c49a]/60 border-b border-white/10 pb-1.5">
                <span>رزمنده</span>
                <span className="text-center">کشتار</span>
                <span className="text-center">آسیب</span>
              </div>
              {hud.scoreRows.map((r) => (
                <div key={r.name} className={`grid grid-cols-[1fr_70px_80px] py-1.5 border-b border-white/5 text-sm ${r.you ? "text-[#ffb03a] font-black" : "text-[#e9e4d4]"}`}>
                  <span>{r.you ? "★ " : ""}{r.name}</span>
                  <span className="num text-center">{r.kills}</span>
                  <span className="num text-center">{r.dmg}</span>
                </div>
              ))}
              <div className="text-[10px] text-[#d8c49a]/50 mt-2 text-center">Tab را رها کن</div>
            </div>
          )}
        </div>
      )}

      {/* ================= فروشگاه ================= */}
      {hud.buyOpen && (
        <div className="absolute inset-0 bg-[#0c0f09]/78 flex items-center justify-center">
          <div className="hud-panel clip-panel p-6 w-[560px] max-w-[92vw] anim-rise max-h-[86vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.3em]">ARMORY</div>
                <h2 className="text-2xl font-black">فروشگاه تسلیحات</h2>
              </div>
              <div className="flex items-center gap-2 text-[#9dff5a]">
                <Coin className="w-6 h-6" />
                <span className="num text-3xl">${hud.money.toLocaleString("en-US")}</span>
              </div>
            </div>

            {[
              { title: "سلاح‌های اصلی", items: BUY_ITEMS.filter((b) => b.kind === "primary") },
              { title: "تجهیزات", items: BUY_ITEMS.filter((b) => b.kind === "gear") },
              { title: "اسکین سلاح", items: BUY_ITEMS.filter((b) => b.kind === "skin") },
            ].map((cat) => (
              <div key={cat.title} className="mb-4">
                <div className="text-[11px] font-bold text-[#d8c49a]/60 mb-2 tracking-wide">{cat.title}</div>
                <div className="grid grid-cols-2 gap-2">
                  {cat.items.map((it) => {
                    const ownedWeapon = it.primary && hud.ownedPrimaries.includes(it.primary);
                    const equippedSkin = it.skin && hud.skin === it.skin;
                    const hasHelmet = it.id === "helmet" && hud.helmet >= 100;
                    const disabled = ownedWeapon || equippedSkin || hasHelmet || hud.money < it.price;
                    return (
                      <button
                        key={it.id}
                        disabled={disabled}
                        onClick={() => {
                          sfx.click();
                          eng()?.purchase(it.id);
                        }}
                        className={`text-right px-3 py-2.5 border transition-all duration-150 ${
                          ownedWeapon || equippedSkin || hasHelmet
                            ? "border-[#9dff5a]/40 bg-[#9dff5a]/8 opacity-80"
                            : disabled
                              ? "border-white/8 bg-black/30 opacity-45"
                              : "border-[#ffb03a]/30 bg-black/40 hover:border-[#ffb03a] hover:bg-[#ffb03a]/10 hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-[#e9e4d4]">{it.label}</span>
                          <span className={`num text-sm ${ownedWeapon || equippedSkin || hasHelmet ? "text-[#9dff5a]" : "text-[#ffb03a]"}`}>
                            {ownedWeapon || equippedSkin || hasHelmet ? "✔" : `$${it.price}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#d8c49a]/60 mt-0.5">{it.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button className="btn-mil w-full py-2.5 text-base" onClick={() => { sfx.click(); eng()?.closeBuy(); }}>
              بستن (B)
            </button>
          </div>
        </div>
      )}

      {/* ================= منوی اصلی ================= */}
      {hud.state === "menu" && (
        <div className="absolute inset-0 scanlines">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f09] via-[#0c0f09]/45 to-[#0c0f09]/15" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0c0f09]/75 via-transparent to-transparent" />

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
              بمب را خنثی کن، فرمانده را بزن، بشکه‌ها را منفجر کن و طوفان شن را پشت سر بگذار.
              چهار هم‌رزم کنار تو می‌جنگند — فروشگاه، اسکین و رکورد در انتظار توست.
            </p>
            <div className="anim-rise flex flex-wrap gap-2 mt-4 max-w-lg" style={{ animationDelay: "0.3s" }}>
              {[
                hud.modelSource === "glb" ? "سرباز Mixamo ✔" : hud.modelSource === "loading" ? "بارگیری سرباز…" : "سرباز رویه‌ساز",
                hud.propsSource === "polyhaven" ? `مدل‌های متن‌باز: ${hud.assetsLoaded}/${hud.assetsTotal} ✔` : hud.propsSource === "loading" ? `بارگیری مدل‌ها… ${hud.assetsLoaded}/${hud.assetsTotal}` : "مدل‌های رویه‌ساز (آفلاین)",
                "بمب‌گذاری سایت A/B",
                "باس و طوفان شن",
              ].map((t) => (
                <span key={t} className="clip-tag bg-black/45 border border-[#ffb03a]/25 px-3 py-1 text-[11px] font-bold text-[#d8c49a]/90">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* سختی + کنترل‌ها */}
          <div className="absolute top-16 right-8 md:right-14 anim-rise flex flex-col gap-3" style={{ animationDelay: "0.35s" }}>
            <div className="hud-panel clip-panel p-4 w-[250px]">
              <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.25em] mb-2.5">DIFFICULTY</div>
              <div className="flex gap-2">
                {DIFF_LABELS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => {
                      sfx.init();
                      sfx.click();
                      eng()?.setDifficulty(i);
                    }}
                    className={`flex-1 py-2 text-[11px] font-black clip-tag border transition-all ${
                      hud.difficulty === i ? "bg-[#ffb03a] text-[#17130a] border-[#ffb03a]" : "bg-black/40 text-[#d8c49a]/70 border-white/10 hover:border-[#ffb03a]/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="hud-panel clip-panel p-5 w-[250px]">
              <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.25em] mb-3">CONTROLS</div>
              {[
                ["W A S D", "حرکت"],
                ["MOUSE", "نشانه‌گیری"],
                ["CLICK", "شلیک"],
                ["R-CLICK", "نشانه‌گیری / اسکوپ"],
                ["R", "خشاب‌گذاری"],
                ["SHIFT", "دویدن"],
                ["G", "نارنجک"],
                ["E", "خنثی‌سازی بمب"],
                ["1/2/3 · Q", "سلاح‌ها"],
                ["B", "فروشگاه"],
                ["TAB", "جدول امتیازات"],
                ["ESC / P", "توقف"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-[11px] text-[#d8c49a]/80 font-medium">{v}</span>
                  <span className="num text-[10px] bg-black/50 border border-[#ffb03a]/25 text-[#ffb03a] px-1.5 py-0.5">{k}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-14 right-8 md:right-14 anim-rise" style={{ animationDelay: "0.5s" }}>
            {hud.best > 0 && (
              <div className="text-left mb-3">
                <span className="text-[11px] font-bold text-[#d8c49a]/60">بهترین امتیاز: </span>
                <span className="num text-lg text-[#ffb03a]">{hud.best.toLocaleString("en-US")}</span>
              </div>
            )}
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
            <div className="text-center text-[10px] text-[#d8c49a]/50 mt-3 font-medium">منابع: Poly Haven (CC0) + poly.pizza (CC-BY) — دانلود زنده</div>
          </div>

          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-l from-transparent via-[#ffb03a] to-transparent opacity-60" />
        </div>
      )}

      {/* ================= توقف ================= */}
      {hud.state === "paused" && !showSettings && (
        <div className="absolute inset-0 bg-[#0c0f09]/70 backdrop-blur-[2px] flex items-center justify-center">
          <div className="hud-panel clip-panel p-8 w-[340px] anim-rise">
            <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.3em] mb-1">PAUSED</div>
            <h2 className="text-3xl font-black mb-6">عملیات متوقف شد</h2>
            <div className="flex flex-col gap-3">
              <button className="btn-mil py-3 text-lg" onClick={() => { sfx.click(); eng()?.resume(); }}>
                ادامه عملیات
              </button>
              <button className="btn-ghost py-2.5" onClick={() => { sfx.click(); setShowSettings(true); }}>
                تنظیمات
              </button>
              <button className="btn-ghost py-2.5" onClick={() => { sfx.click(); eng()?.start(); }}>
                شروع دوباره
              </button>
              <button className="btn-ghost py-2.5" onClick={() => { sfx.click(); eng()?.toMenu(); }}>
                بازگشت به منو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= تنظیمات ================= */}
      {hud.state === "paused" && showSettings && (
        <div className="absolute inset-0 bg-[#0c0f09]/70 backdrop-blur-[2px] flex items-center justify-center">
          <div className="hud-panel clip-panel p-8 w-[380px] anim-rise">
            <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.3em] mb-1">SETTINGS</div>
            <h2 className="text-2xl font-black mb-6">تنظیمات</h2>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold text-[#d8c49a]/80 mb-1.5">
                  <span>حساسیت ماوس</span>
                  <span className="num text-[#ffb03a]">{hud.settings.sens.toFixed(2)}</span>
                </div>
                <input type="range" min={0.3} max={2.5} step={0.05} value={hud.settings.sens} className="w-full accent-[#ffb03a]" onChange={(e) => eng()?.setSettings({ sens: parseFloat(e.target.value) })} />
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-[#d8c49a]/80 mb-1.5">
                  <span>بلندی صدا</span>
                  <span className="num text-[#ffb03a]">{Math.round(hud.settings.volume * 100)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.05} value={hud.settings.volume} className="w-full accent-[#ffb03a]" onChange={(e) => eng()?.setSettings({ volume: parseFloat(e.target.value) })} />
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-[#d8c49a]/80 mb-1.5">
                  <span>میدان دید (FOV)</span>
                  <span className="num text-[#ffb03a]">{hud.settings.fov}</span>
                </div>
                <input type="range" min={60} max={100} step={1} value={hud.settings.fov} className="w-full accent-[#ffb03a]" onChange={(e) => eng()?.setSettings({ fov: parseInt(e.target.value, 10) })} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#d8c49a]/80 mb-2">رنگ کراس‌هیر</div>
                <div className="flex gap-2">
                  {CROSS_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => eng()?.setSettings({ cross: c })}
                      className={`w-9 h-9 clip-tag border-2 transition-transform hover:scale-110 ${hud.settings.cross === c ? "border-white" : "border-transparent"}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button className="btn-mil w-full py-2.5 mt-7" onClick={() => { sfx.click(); setShowSettings(false); }}>
              بازگشت
            </button>
          </div>
        </div>
      )}

      {/* ================= پایان ================= */}
      {hud.state === "over" && hud.stats && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a0806]/90 via-[#0c0f09]/80 to-[#0c0f09]/60 flex items-center justify-center scanlines">
          <div className="text-center px-6">
            <div className="font-stencil text-[#ff4b3a] text-sm tracking-[0.4em] mb-2 anim-rise">MISSION FAILED</div>
            <h2 className="anim-stamp font-stencil text-6xl md:text-7xl text-[#e9e4d4] mb-2">شکست خوردی</h2>
            <p className="text-[#d8c49a]/80 mb-2 anim-rise" style={{ animationDelay: "0.15s" }}>
              نیروهای دشمن در موج <span className="num text-[#ffb03a]">{hud.stats.wave}</span> بر میدان چیره شدند
            </p>
            {hud.stats.score >= hud.best && hud.best > 0 && (
              <p className="text-[#ffb03a] font-black mb-4 anim-rise" style={{ animationDelay: "0.2s" }}>
                ★ رکورد جدید! ★
              </p>
            )}

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
