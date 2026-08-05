'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/**
 * Hero showcase: crossfades the dashboard between light and dark on a loop,
 * with an animated cursor that "clicks" the sun/moon toggle (already present
 * in the top-right of the screenshots) right before each switch.
 *
 * Both source images are normalized to the same 2416×1056 frame so the
 * crossfade aligns pixel-for-pixel.
 */

const W = 2416;
const H = 1056;

// Timing.
const CYCLE = 3400; // ms between switches
const PRESS = 450; // ms the cursor spends pressing before the theme flips

// Toggle position as a fraction of the frame (center of the sun/moon icon).
const TOGGLE_X = 0.947;
const TOGGLE_Y = 0.042;

export function ThemeSwitchShowcase() {
  const [isDark, setIsDark] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let flip: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setPressing(true);
      setClicks((c) => c + 1);
      flip = setTimeout(() => {
        setIsDark((v) => !v);
        setPressing(false);
      }, PRESS);
    }, CYCLE);

    return () => {
      clearInterval(id);
      clearTimeout(flip);
    };
  }, []);

  return (
    <div
      className="group relative select-none"
      aria-label="RachBase dashboard shown in light and dark mode"
    >
      {/* Base (light) — defines the layout box */}
      <Image
        src="/images/deployment-canvas-light.png"
        alt="RachBase deployment canvas in light mode — a running VM connected to a Postgres database and a Git repository"
        width={W}
        height={H}
        className="h-auto w-full"
        priority
        sizes="(max-width: 1024px) 100vw, 1024px"
      />

      {/* Dark layer, crossfaded on top */}
      <Image
        src="/images/deployment-canvas-dark.png"
        alt=""
        aria-hidden="true"
        width={W}
        height={H}
        className="absolute inset-0 h-full w-full transition-opacity duration-700 ease-in-out"
        style={{ opacity: isDark ? 1 : 0 }}
        sizes="(max-width: 1024px) 100vw, 1024px"
      />

      {/* Cursor + click ripple over the sun/moon toggle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ left: `${TOGGLE_X * 100}%`, top: `${TOGGLE_Y * 100}%` }}
      >
        {/* ripple — remounts each cycle via key so the animation replays */}
        <span
          key={clicks}
          className="tsw-ripple absolute rounded-full"
          style={{
            left: '-14px',
            top: '-14px',
            width: '28px',
            height: '28px',
          }}
        />
        {/* cursor pointer */}
        <svg
          className="tsw-cursor absolute"
          style={{
            left: '-2px',
            top: '2px',
            transform: pressing ? 'scale(0.82)' : 'scale(1)',
          }}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M5 3l14 7-6 1.6L9.6 18 5 3z"
            fill="#ffffff"
            stroke="#0B0D12"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <style>{`
        .tsw-cursor { transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1); }
        .tsw-ripple {
          background: rgba(37, 99, 235, 0.55);
          transform: scale(0.2);
          opacity: 0.9;
          animation: tsw-ripple-anim 620ms ease-out forwards;
        }
        @keyframes tsw-ripple-anim {
          0%   { transform: scale(0.2); opacity: 0.85; }
          70%  { opacity: 0.35; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tsw-cursor, .tsw-ripple { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
