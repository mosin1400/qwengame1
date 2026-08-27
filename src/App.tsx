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

/* ---------------- ابزار ---------------- */

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const initialHud: HudState = {
  state: "menu",
  modelSource: "loading",
  health: 100,
  armor: 25,
  ammo: 30,
  reserve: 120,
  reloading: false,
  wave: 0,
  kills: 0,
  headshots: 0,
  score: 0,
  time: 0,
  enemiesLeft: 0,
  spread: 0.0035,
  hitKey: 0,
  headKey: 0,
  dmgKey: 0,
  feed: [],
  bannerKey: 0,
  bannerText: "",
  stats: null,
};

/* ---------------- برنامه ---------------- */

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new GameEngine(mountRef.current, (s) => setHud((prev) => ({ ...prev, ...s })));
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const eng = () => engineRef.current;
  const inGame = hud.state === "play" || hud.state === "paused" || hud.state === "over";
  const gap = Math.round(6 + hud.spread * 1700);
  const lowHp = hud.state === "play" && hud.health <= 30;

  return (
    <div dir="rtl" className="fixed inset-0 overflow-hidden bg-[#0c0f09] select-none">
      {/* بوم سه‌بعدی */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* لایه‌های جو */}
      <div className="absolute inset-0 pointer-events-none vignette" />
      <div className="absolute inset-0 pointer-events-none grain" />

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
            <div key={`hs${hud.headKey}`} className="absolute left-1/2 top-1/2 anim-head text-center" style={{ transform: "translate(-50%,-50%)" }}>
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

          {/* بنر موج */}
          {hud.bannerKey > 0 && hud.state === "play" && (
            <div key={hud.bannerKey} className="absolute left-1/2 top-[22%] -translate-x-1/2 anim-banner">
              <div className="clip-tag bg-[#ffb03a] px-10 py-2 text-[#17130a]">
                <span className="font-stencil text-3xl">{hud.bannerText}</span>
              </div>
            </div>
          )}

          {/* پنل بالا-چپ: وضعیت عملیات */}
          <div className="absolute top-4 left-4 hud-panel clip-panel px-4 py-3 min-w-[190px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-bold text-[#d8c49a]/70 tracking-wide">موج</span>
              <span className="num text-2xl text-[#ffb03a] leading-none">{String(hud.wave).padStart(2, "0")}</span>
            </div>
            <div className="flex items-center justify-between gap-4 mt-2">
              <span className="text-[11px] font-bold text-[#d8c49a]/70 flex items-center gap-1"><Skull className="w-3.5 h-3.5" /> باقی‌مانده</span>
              <span className="num text-xl text-[#e9e4d4] leading-none">{hud.enemiesLeft}</span>
            </div>
            <div className="flex items-center justify-between gap-4 mt-2">
              <span className="text-[11px] font-bold text-[#d8c49a]/70 flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> زمان</span>
              <span className="num text-xl text-[#e9e4d4] leading-none">{fmtTime(hud.time)}</span>
            </div>
          </div>

          {/* بالا-راست: امتیاز + کیل‌فید */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-2 max-w-[300px]">
            <div className="hud-panel clip-panel px-4 py-2 flex items-center gap-3">
              <span className="text-[11px] font-bold text-[#d8c49a]/70">امتیاز</span>
              <span className="num text-2xl text-[#ffb03a] leading-none">{hud.score.toLocaleString("en-US")}</span>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {hud.feed.map((f) => (
                <div key={f.id} className="anim-feed clip-tag bg-[#17130a]/85 border border-[#ffb03a]/25 px-3 py-1.5 flex items-center gap-2">
                  {f.head ? <Target className="w-3.5 h-3.5 text-[#ffb03a]" /> : <Skull className="w-3.5 h-3.5 text-[#d8c49a]" />}
                  <span className={`text-xs font-bold ${f.head ? "text-[#ffb03a]" : "text-[#e9e4d4]"}`}>{f.text}</span>
                </div>
              ))}
            </div>
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

          {/* پایین-راست: مهمات */}
          <div className="absolute bottom-4 right-4 hud-panel clip-panel px-5 py-3 text-left">
            <div className="text-[11px] font-bold text-[#d8c49a]/70 mb-1 flex items-center gap-1.5 justify-end">
              <span>کلاشینکف | AK-47</span>
              <Bullet className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-2 justify-end" dir="ltr">
              <span className="num text-[13px] text-[#d8c49a]/60">/ {hud.reserve}</span>
              <span className={`num text-5xl leading-none ${hud.ammo === 0 ? "text-[#ff4b3a]" : hud.ammo <= 6 ? "text-[#ffb03a]" : "text-[#e9e4d4]"}`}>
                {hud.ammo}
              </span>
            </div>
            {hud.ammo <= 6 && !hud.reloading && hud.state === "play" && (
              <div className="text-[10px] font-bold text-[#ffb03a] mt-1 anim-blink text-right">R — خشاب‌گذاری</div>
            )}
          </div>
        </div>
      )}

      {/* ================= منوی اصلی ================= */}
      {hud.state === "menu" && (
        <div className="absolute inset-0 scanlines">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f09] via-[#0c0f09]/55 to-[#0c0f09]/20" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0c0f09]/80 via-transparent to-transparent" />

          {/* عنوان — پایین چپ */}
          <div className="absolute bottom-14 left-8 md:left-16 pointer-events-none">
            <div className="anim-stamp" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-[3px] w-14 bg-[#ffb03a]" />
                <span className="font-stencil text-[#ffb03a] text-sm tracking-[0.3em]">COUNTER WEB OPS</span>
              </div>
              <h1 className="font-stencil text-6xl md:text-8xl text-[#e9e4d4] leading-[0.95] drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">
                عملیات
                <br />
                <span className="text-[#ffb03a]">صحرا</span>
              </h1>
            </div>
            <p className="anim-rise mt-5 max-w-md text-[#d8c49a]/90 text-sm md:text-base leading-7" style={{ animationDelay: "0.25s" }}>
              میدان شهر متروکه سقوط کرده. موج‌های تروریست‌ها از هر سو می‌آیند —
              تا می‌توانی مقاومت کن، هدشات بزن و رکورد بزن.
            </p>
          </div>

          {/* کنترل‌ها — راست */}
          <div className="absolute top-8 right-8 md:right-14 anim-rise" style={{ animationDelay: "0.35s" }}>
            <div className="hud-panel clip-panel p-5 w-[240px]">
              <div className="font-stencil text-[#ffb03a] text-xs tracking-[0.25em] mb-3">CONTROLS</div>
              {[
                ["W A S D", "حرکت"],
                ["MOUSE", "نشانه‌گیری"],
                ["CLICK", "شلیک (رگبار)"],
                ["R", "خشاب‌گذاری"],
                ["SHIFT", "دویدن"],
                ["ESC", "توقف عملیات"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-[#d8c49a]/80 font-medium">{v}</span>
                  <span className="num text-xs bg-black/50 border border-[#ffb03a]/25 text-[#ffb03a] px-2 py-0.5">{k}</span>
                </div>
              ))}
            </div>
          </div>

          {/* وضعیت مدل جامعه */}
          <div className="absolute top-8 left-8 anim-rise" style={{ animationDelay: "0.45s" }}>
            <div className="clip-tag bg-black/45 border border-white/10 px-4 py-2 flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${hud.modelSource === "glb" ? "bg-[#9dff5a]" : hud.modelSource === "loading" ? "bg-[#ffb03a] anim-blink" : "bg-[#6fb7ff]"}`} />
              <span className="text-[11px] font-bold text-[#d8c49a]/90">
                {hud.modelSource === "loading"
                  ? "در حال بارگیری مدل و انیمیشن از جامعه (Mixamo)…"
                  : hud.modelSource === "glb"
                    ? "مدل جامعه بارگیری شد — سرباز Mixamo با انیمیشن واقعی"
                    : "حالت آفلاین — سرباز رویه‌ساز فعال است"}
              </span>
            </div>
          </div>

          {/* دکمه شروع — پایین راست */}
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
              نسخه ۱٫۰ — موتور Three.js — صدا و تصویر بی‌درنگ
            </div>
          </div>

          {/* نوار پایین */}
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
              نکته: در فاصله ۵ تا ۱۲ متری دشمن، ایستادن و نشانه‌گیری دقیق، بیشترین آسیب را دارد.
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
