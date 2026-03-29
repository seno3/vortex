'use client';
import { useRouter } from 'next/navigation';

/** Dashboard: logo only over the map (controls live in the feed sidebar). */
export default function TopBar() {
  const router = useRouter();

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        padding: '12px 24px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        background: 'transparent',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={() => router.push('/')}
        style={{
          background: 'none',
          border: 'none',
          padding: '6px 0 0',
          margin: 0,
          cursor: 'pointer',
          font: 'inherit',
          lineHeight: 1,
          pointerEvents: 'auto',
        }}
      >
        <span
          style={{
            fontSize: '36px',
            fontFamily: 'var(--font-serif, Georgia, serif)',
            fontWeight: 300,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.96)',
            textShadow: [
              '0 0 1px rgba(0,0,0,0.95)',
              '0 2px 4px rgba(0,0,0,0.9)',
              '0 4px 14px rgba(0,0,0,0.75)',
              '0 0 24px rgba(0,0,0,0.65)',
              '0 0 42px rgba(0,0,0,0.45)',
            ].join(', '),
          }}
        >
          Vigil
        </span>
      </button>
    </div>
  );
}
