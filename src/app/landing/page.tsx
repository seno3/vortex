'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Map from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import type { Map as MapboxMap } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';

import LiveCounter from '@/components/landing/LiveCounter';
import { useCameraDrift } from '@/components/landing/CameraDrift';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['italic'],
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'auto',
        animation: 'fadeUp 400ms ease both',
        animationDelay: '400ms',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-geist, sans-serif)',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.9)',
          textTransform: 'uppercase' as const,
        }}
      >
        VIGIL
      </span>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <a
          href="#"
          className="about-link"
          style={{
            fontFamily: 'var(--font-geist, sans-serif)',
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
          }}
        >
          About
        </a>
        <a
          href="#"
          className="sign-in-link"
          style={{
            fontFamily: 'var(--font-geist, sans-serif)',
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '6px 16px',
            borderRadius: 20,
          }}
        >
          Sign in
        </a>
      </nav>
    </div>
  );
}

function ScrollChevron() {
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        marginTop: 20,
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <svg
        width={12}
        height={12}
        viewBox="0 0 12 12"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: 'chevronBounce 2s ease-in-out infinite' }}
      >
        <polyline points="2,4 6,8 10,4" />
      </svg>
    </div>
  );
}

function CenterHero() {
  const router = useRouter();

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'auto',
        width: '90%',
        maxWidth: 640,
        padding: '0 20px',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-playfair, Georgia, "Times New Roman", serif)',
          fontSize: 'clamp(72px, 10vw, 128px)',
          fontWeight: 300,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.95)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          marginBottom: 44,
          marginTop: 0,
          textShadow: '0 2px 40px rgba(0,0,0,0.5)',
          animation: 'fadeUp 700ms ease both',
          animationDelay: '750ms',
        }}
      >
        Vigil
      </h1>

      <button
        onClick={() => router.push('/')}
        className="cta-button"
        style={{
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: 'var(--font-geist, sans-serif)',
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase' as const,
          padding: '14px 36px',
          borderRadius: 100,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          animation: 'fadeUp 500ms ease both',
          animationDelay: '1100ms',
          display: 'inline-block',
        }}
      >
        Open
      </button>

      <ScrollChevron />
    </div>
  );
}

function BottomBar() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 48,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        animation: 'fadeUp 400ms ease both',
        animationDelay: '1300ms',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <LiveCounter />
      </div>

      <p
        className="legal-line"
        style={{
          fontFamily: 'var(--font-geist, sans-serif)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.03em',
          margin: 0,
        }}
      >
        Not a substitute for 911
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const mapGlRef = useRef<MapboxMap | null>(null);

  useCameraDrift(mapGlRef);

  return (
    <div
      className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable}`}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a0a' }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chevronBounce {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(5px); }
        }

        .about-link,
        .sign-in-link {
          transition: color 150ms ease;
        }
        .about-link:hover,
        .sign-in-link:hover {
          color: rgba(255,255,255,0.9) !important;
        }
        .sign-in-link {
          transition: color 150ms ease, border-color 150ms ease;
        }
        .sign-in-link:hover {
          border-color: rgba(255,255,255,0.5) !important;
        }

        .cta-button {
          transition: background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;
        }
        .cta-button:hover {
          background: rgba(255,255,255,0.25) !important;
          border-color: rgba(255,255,255,0.6) !important;
          color: rgba(255,255,255,1) !important;
          transform: scale(1.02);
        }
        .cta-button:active {
          transform: scale(0.98) !important;
        }

        @media (max-width: 767px) {
          .about-link { display: none !important; }
          .cta-button { width: 100% !important; padding: 16px 0 !important; }
          .legal-line { display: none !important; }
        }
      `}</style>

      {/* Map layer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          initialViewState={{
            longitude: -98.5795,
            latitude: 39.8283,
            zoom: 4.2,
            pitch: 0,
            bearing: 0,
          }}
          style={{
            width: '100%',
            height: '100%',
            opacity: mapLoaded ? 1 : 0,
            transition: 'opacity 1200ms ease',
          }}
          interactive={false}
          scrollZoom={false}
          dragPan={false}
          doubleClickZoom={false}
          attributionControl={false}
          onLoad={() => {
            if (mapRef.current) {
              mapGlRef.current = mapRef.current.getMap() as MapboxMap;
            }
            setMapLoaded(true);
          }}
        />
      </div>

      {/* Vignette layer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, transparent 0%, transparent 35%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)',
          }}
        />
      </div>

      {/* Content layer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
        <TopBar />
        <CenterHero />
        <BottomBar />
      </div>
    </div>
  );
}
