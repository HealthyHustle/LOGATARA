import React from 'react';
import { Sparkles } from 'lucide-react';
import { assetUrl } from '../../utils/assets';

interface TaraSpriteProps {
  state: 'idle' | 'walking' | 'celebrating';
  facing?: 'left' | 'right';
  speechText?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function TaraSprite({
  state,
  facing = 'right',
  speechText,
  onClick,
  size = 'md',
}: TaraSpriteProps) {
  const sizeClasses =
    size === 'sm'
      ? 'w-14 h-20 sm:w-16 sm:h-24'
      : size === 'lg'
        ? 'w-24 h-36 sm:w-28 sm:h-40'
        : 'w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-32';

  const animClass =
    state === 'walking'
      ? 'tara-walking'
      : state === 'celebrating'
        ? 'tara-celebrating'
        : 'tara-idle';

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Speech Bubble */}
      {speechText && (
        <div className="mb-1.5 relative bg-surface-ivory/95 backdrop-blur-sm text-on-surface px-3 py-1.5 rounded-2xl rounded-bl-sm shadow-storybook border border-on-surface-bark/15 max-w-[200px] sm:max-w-[235px] text-center pointer-events-none">
          <p className="text-[11px] sm:text-xs font-bold leading-snug text-primary">{speechText}</p>
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-ivory border-r border-b border-on-surface-bark/15 rotate-45" />
        </div>
      )}

      {/* Character Container */}
      <button
        type="button"
        onClick={onClick}
        aria-label="Karakter Tara Penjelajah"
        className={`relative ${sizeClasses} flex items-end justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-tertiary-gold rounded-2xl`}
      >
        {/* Celebration Sparkles */}
        {state === 'celebrating' && (
          <div className="absolute -top-3 inset-x-0 flex justify-center gap-3 pointer-events-none">
            <Sparkles className="w-5 h-5 text-tertiary-gold animate-bounce" />
            <Sparkles className="w-4 h-4 text-secondary-container animate-ping" />
          </div>
        )}

        {/* Walking Dust Ring */}
        {state === 'walking' && (
          <span className="absolute bottom-0.5 w-10 h-3 rounded-full bg-surface-dim/80 blur-[2px] animate-pulse pointer-events-none" />
        )}

        {/* Ground Shadow */}
        <span
          className={`absolute bottom-0.5 rounded-full bg-on-surface/30 blur-[3px] transition-all pointer-events-none ${
            state === 'walking' ? 'w-10 h-2.5 scale-90' : 'w-12 h-3'
          }`}
        />

        {/* Authentic Stitch Tara Character Sprite */}
        <div
          className={`w-full h-full flex items-end justify-center ${animClass}`}
          style={{
            transformOrigin: 'bottom center',
          }}
        >
          <img
            src={assetUrl('/assets/characters/tara-sprite.png')}
            alt="Tara, Karakter Penjelajah LOGATARA"
            width={374}
            height={888}
            draggable={false}
            className="w-full h-full object-contain drop-shadow-[0_6px_10px_rgba(42,23,8,0.35)] transition-transform duration-200"
            style={{
              transform: facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
            }}
          />
        </div>
      </button>
    </div>
  );
}
