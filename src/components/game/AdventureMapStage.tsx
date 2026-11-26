import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Lock, Check, Play, Star, Trophy, Pause, PlayCircle } from 'lucide-react';
import type { AdventureLevel } from '../../types';
import { TaraSprite } from '../character/TaraSprite';
import { playSoundEffect } from '../../services/audio/speechService';
import { assetUrl } from '../../utils/assets';

// Coordinate viewBox 1000 x 620 aligned to Kampung Nusantara 3D Diorama landmarks
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export const LEVEL_COORDS: Record<number, { x: number; y: number }> = {
  1: { x: 190, y: 322 }, // Balai Desa
  2: { x: 290, y: 458 }, // Rumah Batik
  3: { x: 560, y: 446 }, // Jembatan & Warung Desa
  4: { x: 750, y: 410 }, // Pasar Tradisional
  5: { x: 770, y: 217 }, // Sawah Terasering
  6: { x: 440, y: 242 }, // Rumah Adat & Sanggar Budaya
  7: { x: 540, y: 99 },  // Perpustakaan Nusantara
};

// Smooth cubic Bezier path segments tracing the real roads & bamboo bridges of Kampung Nusantara
export const SEGMENT_PATHS: Array<{ from: number; to: number; d: string }> = [
  { from: 1, to: 2, d: 'M 190 322 C 195 390, 225 445, 290 458' },
  { from: 2, to: 3, d: 'M 290 458 C 380 482, 470 486, 560 446' }, // Across the bamboo bridge!
  { from: 3, to: 4, d: 'M 560 446 C 640 442, 695 455, 750 410' }, // To Pasar Tradisional
  { from: 4, to: 5, d: 'M 750 410 C 825 360, 835 280, 770 217' }, // Climbing Sawah Terasering
  { from: 5, to: 6, d: 'M 770 217 C 660 190, 560 278, 440 242' }, // Through Banyan Square to Rumah Adat
  { from: 6, to: 7, d: 'M 440 242 C 445 170, 480 125, 540 99' },  // Ascending to Perpustakaan Nusantara
];

interface DustPuff {
  id: number;
  x: number;
  y: number;
}

interface AdventureMapStageProps {
  levels: AdventureLevel[];
  taraLevelNumber: number;
  walkTrigger: { from: number; to: number; key: number } | null;
  onWalkComplete?: (fromLevel: number, toLevel: number) => void;
  onSelectLevel: (level: AdventureLevel) => void;
}

export function AdventureMapStage({
  levels,
  taraLevelNumber,
  walkTrigger,
  onWalkComplete,
  onSelectLevel,
}: AdventureMapStageProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const taraMarkerRef = useRef<HTMLDivElement>(null);

  const initialPos = LEVEL_COORDS[taraLevelNumber] || LEVEL_COORDS[1];
  const [taraPos, setTaraPos] = useState<{ x: number; y: number }>(initialPos);
  const [taraState, setTaraState] = useState<'idle' | 'walking' | 'celebrating'>('idle');
  const [taraFacing, setTaraFacing] = useState<'left' | 'right'>('right');
  const [walkProgress, setWalkProgress] = useState<{ segKey: string; ratio: number } | null>(null);
  const [dustPuffs, setDustPuffs] = useState<DustPuff[]>([]);
  const [speech, setSpeech] = useState<string>('');
  const [motionPaused, setMotionPaused] = useState(false);

  const activeWalkKeyRef = useRef<number | null>(null);

  // Sync static position whenever taraLevelNumber updates (when not actively walking)
  useEffect(() => {
    if (walkTrigger && activeWalkKeyRef.current !== walkTrigger.key) return;
    const coord = LEVEL_COORDS[taraLevelNumber] || LEVEL_COORDS[1];
    setTaraPos(coord);
    const currentLv = levels.find((l) => l.level_number === taraLevelNumber);
    if (currentLv) {
      setSpeech(`Ayo jelajahi Level ${currentLv.level_number}: ${currentLv.location_name}!`);
    }
  }, [taraLevelNumber, levels, walkTrigger]);

  const scrollTaraIntoView = useCallback((xPx: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth + 10) return;
    const ratioX = xPx / MAP_WIDTH;
    const targetLeft = ratioX * container.scrollWidth - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  }, []);

  // Coordinate-Based Path Walking Animation Engine (Section 08 Critical Feature)
  useEffect(() => {
    if (!walkTrigger) return;
    if (activeWalkKeyRef.current === walkTrigger.key) return;
    activeWalkKeyRef.current = walkTrigger.key;

    const { from, to } = walkTrigger;
    const segKey = `${from}-${to}`;
    const pathEl = pathRefs.current[segKey];
    const startCoord = LEVEL_COORDS[from] || LEVEL_COORDS[1];
    const endCoord = LEVEL_COORDS[to] || LEVEL_COORDS[Math.min(7, from + 1)];

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    setTaraPos(startCoord);
    setTaraState('walking');
    setSpeech(`Berjalan menuju Level ${to}...`);
    setWalkProgress({ segKey, ratio: 0 });
    scrollTaraIntoView(startCoord.x);

    const durationMs = prefersReduced ? 650 : 2500;
    const totalLength = pathEl ? pathEl.getTotalLength() : 0;
    let startTime: number | null = null;
    let lastStepSound = 0;
    let lastDustTime = 0;
    let prevX = startCoord.x;
    let rafId = 0;
    let celebrationTimer = 0;

    // Ease-in-out cubic for natural walking acceleration & deceleration
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const rawT = Math.min(1, elapsed / durationMs);
      const t = easeInOut(rawT);

      let currX = startCoord.x + (endCoord.x - startCoord.x) * t;
      let currY = startCoord.y + (endCoord.y - startCoord.y) * t;

      if (pathEl && totalLength > 0) {
        const pt = pathEl.getPointAtLength(t * totalLength);
        currX = pt.x;
        currY = pt.y;
      }

      const dx = currX - prevX;
      if (Math.abs(dx) > 0.2) {
        setTaraFacing(dx < 0 ? 'left' : 'right');
      }
      prevX = currX;

      setTaraPos({ x: currX, y: currY });
      setWalkProgress({ segKey, ratio: t });

      // Periodic footstep sound & dust puff trail
      if (!prefersReduced && elapsed - lastStepSound > 360 && rawT < 0.96) {
        lastStepSound = elapsed;
        playSoundEffect('step');
      }
      if (!prefersReduced && elapsed - lastDustTime > 210 && rawT < 0.95) {
        lastDustTime = elapsed;
        const puffId = Date.now() + Math.random();
        setDustPuffs((prev) => [...prev.slice(-6), { id: puffId, x: currX, y: currY }]);
      }

      // Gently follow character horizontally on narrow mobile screens
      if (scrollContainerRef.current && scrollContainerRef.current.scrollWidth > scrollContainerRef.current.clientWidth + 10) {
        const container = scrollContainerRef.current;
        const targetScroll = (currX / MAP_WIDTH) * container.scrollWidth - container.clientWidth / 2;
        container.scrollLeft += (Math.max(0, targetScroll) - container.scrollLeft) * 0.12;
      }

      if (rawT < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        // Arrived at destination marker!
        setTaraPos(endCoord);
        setWalkProgress(null);
        setDustPuffs([]);
        setTaraState('celebrating');
        setSpeech(`Hore! Level ${to} berhasil dibuka!`);
        playSoundEffect('celebrate');

        celebrationTimer = window.setTimeout(() => {
          onWalkComplete?.(from, to);
          setTaraState('idle');
        }, prefersReduced ? 400 : 1200);
      }
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(celebrationTimer);
    };
  }, [walkTrigger, onWalkComplete, scrollTaraIntoView]);

  const handleTaraTap = () => {
    const quotes = [
      'Ayo selesaikan semua 4 permainan untuk membuka jalan berikutnya!',
      'Setiap level punya cerita budaya unik di Kampung Nusantara!',
      'Klik penanda level yang aktif untuk memulai modul belajar!',
    ];
    setSpeech(quotes[Math.floor(Math.random() * quotes.length)]);
    playSoundEffect('click');
  };

  // Determine which segments are already unlocked/completed
  const levelByNum = new Map(levels.map((l) => [l.level_number, l]));

  return (
    <div className={`relative w-full ${motionPaused ? 'motion-paused' : ''}`}>
      {/* Pause / Play Ambient Motion Control (WCAG 2.2.2) */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-on-surface-bark">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-fixed text-primary">
            <Check className="w-3.5 h-3.5" /> Selesai
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed">
            <Play className="w-3.5 h-3.5" /> Aktif
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
            <Lock className="w-3.5 h-3.5" /> Terkunci
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMotionPaused((p) => !p)}
          className="btn-parchment px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
        >
          {motionPaused ? <PlayCircle className="w-4 h-4 text-primary" /> : <Pause className="w-4 h-4 text-primary" />}
          <span>{motionPaused ? 'Putar Animasi Peta' : 'Jeda Animasi Peta'}</span>
        </button>
      </div>

      {/* Responsive Scrollable Viewport on Mobile, Full Diorama on Desktop */}
      <div
        ref={scrollContainerRef}
        className="relative w-full overflow-x-auto rounded-[2rem] shadow-storybook-lg border-2 border-on-surface-bark/15 bg-surface-container"
      >
        <div className="relative min-w-[740px] w-full aspect-[1000/620] select-none">
          {/* Authentic Stitch Kampung Nusantara 3D Diorama */}
          <img
            src={assetUrl('/assets/environments/kampung-nusantara.png')}
            alt="Peta Petualangan 3D Kampung Nusantara"
            width={1376}
            height={768}
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Subtle Atmospheric Frame for Node Contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-on-surface/25 via-transparent to-surface-ivory/15 pointer-events-none" />

          {/* Winding Village Adventure Path SVG */}
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            aria-hidden="true"
          >
            {SEGMENT_PATHS.map((seg) => {
              const segKey = `${seg.from}-${seg.to}`;
              const fromLv = levelByNum.get(seg.from);
              const toLv = levelByNum.get(seg.to);
              const isUnlockedTrail =
                fromLv?.status === 'completed' && toLv && toLv.status !== 'locked';
              const isWalkingSeg = walkProgress?.segKey === segKey;

              return (
                <g key={segKey}>
                  {/* Base unpaved trail shadow */}
                  <path
                    d={seg.d}
                    fill="none"
                    stroke="rgba(42, 23, 8, 0.35)"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  {/* Dashed terracotta adventure road */}
                  <path
                    ref={(el) => {
                      pathRefs.current[segKey] = el;
                    }}
                    d={seg.d}
                    fill="none"
                    stroke={isUnlockedTrail ? '#F2B842' : '#FFE3D1'}
                    strokeWidth="7"
                    strokeDasharray={isUnlockedTrail ? 'none' : '12 10'}
                    strokeLinecap="round"
                    opacity={isUnlockedTrail ? 0.95 : 0.8}
                  />
                  {/* Live animated golden walking trail right behind Tara's feet */}
                  {isWalkingSeg && (
                    <path
                      d={seg.d}
                      fill="none"
                      stroke="#F8BD47"
                      strokeWidth="9"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={100 - (walkProgress?.ratio || 0) * 100}
                    />
                  )}
                </g>
              );
            })}

            {/* Footstep Dust Puffs during Tara's walk */}
            {dustPuffs.map((puff) => (
              <circle
                key={puff.id}
                cx={puff.x}
                cy={puff.y}
                r="7"
                fill="#FFFDF8"
                opacity="0.72"
              />
            ))}
          </svg>

          {/* 7 Interactive Level Markers */}
          {levels.map((lv) => {
            const coord = LEVEL_COORDS[lv.level_number] || { x: lv.map_x * 10, y: lv.map_y * 6.2 };
            const leftPct = (coord.x / MAP_WIDTH) * 100;
            const topPct = (coord.y / MAP_HEIGHT) * 100;
            const isLocked = lv.status === 'locked';
            const isCompleted = lv.status === 'completed';
            const isActive = lv.status === 'available' || lv.status === 'in_progress';
            const isBoss = lv.level_number === 7;

            return (
              <div
                key={lv.id}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group"
              >
                {/* Pulsing Beacon for Current Active Level */}
                {isActive && (
                  <span className="absolute top-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary-container/60 node-pulse-ring pointer-events-none" />
                )}

                <button
                  type="button"
                  onClick={() => onSelectLevel(lv)}
                  aria-label={`Level ${lv.level_number}: ${lv.title} (${
                    isLocked ? 'Terkunci' : isCompleted ? 'Selesai' : 'Tersedia'
                  })`}
                  className={`relative flex items-center justify-center rounded-full transition-transform active:translate-y-0.5 hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-tertiary-gold ${
                    isBoss ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-12 h-12 sm:w-14 sm:h-14'
                  } ${
                    isCompleted
                      ? 'bg-primary text-white border-b-4 border-primary-canopy shadow-lg'
                      : isActive
                        ? 'bg-secondary-terracotta text-white border-b-4 border-secondary-deep shadow-tactile-terracotta'
                        : 'bg-surface-ivory/90 text-outline border-2 border-on-surface-bark/25 shadow-md opacity-90'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6 stroke-[3]" />
                  ) : isLocked ? (
                    isBoss ? (
                      <Trophy className="w-6 h-6 text-tertiary-gold" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}

                  {/* Level Number Pill */}
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-surface-ivory text-on-surface font-display font-bold text-xs border-2 border-on-surface-bark/15 flex items-center justify-center shadow-xs">
                    {lv.level_number}
                  </span>
                </button>

                {/* Stars Earned */}
                {isCompleted && (
                  <div className="flex items-center gap-0.5 mt-1 bg-surface-ivory/90 px-1.5 py-0.5 rounded-full shadow-xs">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s <= (lv.stars_earned || 3)
                            ? 'text-tertiary-gold fill-tertiary-gold'
                            : 'text-outline-variant'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Marker Label Pill */}
                <div
                  className={`mt-1 px-2.5 py-0.5 rounded-full text-center shadow-md border backdrop-blur-sm max-w-[140px] ${
                    isActive
                      ? 'bg-surface-ivory border-secondary-terracotta/40 text-on-surface'
                      : isCompleted
                        ? 'bg-surface-ivory/95 border-primary/30 text-primary'
                        : 'bg-surface-ivory/85 border-on-surface-bark/15 text-on-surface-variant'
                  }`}
                >
                  <span className="block text-[11px] font-bold leading-tight truncate">
                    {lv.location_name}
                  </span>
                  <span className="block text-[9px] font-semibold opacity-80 truncate">
                    {lv.title}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Dynamic Walking Tara Character Positioned by Exact Map Coordinates */}
          <div
            ref={taraMarkerRef}
            style={{
              left: `${(taraPos.x / MAP_WIDTH) * 100}%`,
              top: `${(taraPos.y / MAP_HEIGHT) * 100}%`,
              transform: 'translate(-50%, -86%)',
            }}
            className="absolute z-30 will-change-[left,top]"
          >
            <TaraSprite
              state={taraState}
              facing={taraFacing}
              speechText={speech}
              onClick={handleTaraTap}
              size="md"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
