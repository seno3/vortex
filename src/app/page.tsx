'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { User } from '@/types';
import AuthModal from '@/components/AuthModal';
import ProfilePanel from '@/components/ui/ProfilePanel';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const PERIOD = 40000;
const FONT = 'var(--font-sans, sans-serif)';
const FALLBACK = { lat: 41.8781, lng: -87.6298 };

export default function LandingPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const driftActiveRef = useRef(true);
  const rafRef = useRef<number>(0);
  const router = useRouter();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const [blackout, setBlackout] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98, 39],
      zoom: 4.2,
      interactive: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;
    map.on('load', () => setMapLoaded(true));

    const startLng = -98, startLat = 39;
    const drift = () => {
      if (!driftActiveRef.current) return;
      if (window.innerWidth >= 768) {
        const t = Date.now() / PERIOD;
        map.setCenter({ lng: startLng + Math.sin(t * Math.PI * 2) * 1.2, lat: startLat + Math.cos(t * Math.PI * 2) * 0.6 });
        map.setBearing(Math.sin(t * Math.PI * 2) * 6);
      }
      rafRef.current = requestAnimationFrame(drift);
    };
    rafRef.current = requestAnimationFrame(drift);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const handleOpen = () => {
    if (blackout) return;
    setBlackout(true);
    driftActiveRef.current = false;

    const locRef = { current: FALLBACK };

    navigator.geolocation?.getCurrentPosition(
      pos => { locRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => {},
      { enableHighAccuracy: false, timeout: 350 },
    );

    setTimeout(() => {
      const { lat, lng } = locRef.current;
      router.push(`/dashboard?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
    }, 400);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '100%', height: '100dvh', maxHeight: '100dvh', background: '#000', overflow: 'hidden', fontFamily: FONT, minHeight: 0 }}>
      {/* Map — background drift */}
      <div
        ref={mapContainerRef}
        style={{ position: 'absolute', inset: 0, opacity: mapLoaded ? 1 : 0, transition: 'opacity 1.2s ease' }}
      />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)', pointerEvents: 'none' }} />

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '64px', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeUp 0.6s 0.4s both' }}>
        <span />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user ? (
            <>
              <div
                onClick={() => setPanelOpen(v => !v)}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', border: `1.5px solid ${avatarHover ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: '#fff', fontFamily: FONT, cursor: 'pointer', transition: 'border-color 150ms ease' }}
              >
                {user.username[0].toUpperCase()}
              </div>
              {panelOpen && (
                <ProfilePanel
                  user={user}
                  onClose={() => setPanelOpen(false)}
                  onSignOut={() => { setPanelOpen(false); setUser(null); }}
                />
              )}
            </>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', textTransform: 'uppercase', fontFamily: FONT }}>
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Center hero */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '44px', pointerEvents: 'none' }}>
        <h1 style={{ animation: 'fadeUp 0.6s 0.75s both', fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(72px,10vw,128px)', color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
          Vigil
        </h1>
        <div style={{ animation: 'fadeUp 0.6s 1.1s both', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={handleOpen}
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '999px',
              padding: '12px 32px',
              fontSize: '12px',
              letterSpacing: '0.25em',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: FONT,
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.25)'); (e.currentTarget.style.transform = 'scale(1.02)'); }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.15)'); (e.currentTarget.style.transform = 'scale(1)'); }}
          >
            OPEN
          </button>
          <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)', animation: 'bounce 2s infinite' }}>⌄</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '48px', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeUp 0.6s 1.3s both' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulseDot 1.5s infinite' }} />
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', fontFamily: FONT }}>NOT A SUBSTITUTE FOR 911</span>
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={u => { setUser(u as User); setShowAuth(false); }}
        />
      )}

      {/* Blackout overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#000',
          opacity: blackout ? 1 : 0,
          transition: 'opacity 400ms ease-in',
          pointerEvents: 'none',
        }}
      />

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.7; } }
      `}</style>
    </div>
  );
}
