'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { User, Tip, TipCategory, TipUrgency, ThreatState, Emergency, Exit, ExitType } from '@/types';
import TopBar from '@/components/TopBar';
import MapLocationSearch from '@/components/MapLocationSearch';
import NotificationFeed from '@/components/NotificationFeed';
import TipModal from '@/components/TipModal';
import AuthModal from '@/components/AuthModal';
import AlertBanner from '@/components/AlertBanner';
import BuildingPopup from '@/components/BuildingPopup';
import FlareBubbles from '@/components/FlareBubbles';
import ExitModal from '@/components/ExitModal';
import EmergencyOverlay from '@/components/emergency/EmergencyOverlay';
import EmergencyMarker from '@/components/emergency/EmergencyMarker';
import SettingsModal from '@/components/settings/SettingsModal';
import { useFlareRadiusM } from '@/hooks/useFlareRadiusM';
import { useUserLocation } from '@/hooks/useUserLocation';
import { dispatchFlaresChanged, VIGIL_FLARES_CHANGED_EVENT } from '@/lib/flareSync';

const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

/** Same priority as FlareBubbles — one color per building when multiple flares exist. */
const FLARE_CATEGORY_PRIORITY: TipCategory[] = ['active_threat', 'infrastructure', 'weather', 'general_safety'];

function topFlareCategory(tips: Tip[]): TipCategory {
  for (const cat of FLARE_CATEGORY_PRIORITY) {
    if (tips.some((t) => t.category === cat)) return cat;
  }
  return 'general_safety';
}

const EMERGENCY_TYPES = ['shooting', 'tornado', 'earthquake', 'fire'] as const;

function DevEmergencyWidget({ lat, lng }: { lat: number; lng: number }) {
  const [type, setType] = useState<typeof EMERGENCY_TYPES[number]>('shooting');
  const [busy, setBusy] = useState(false);

  const trigger = async () => {
    setBusy(true);
    await fetch('/api/emergencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, lat, lng, address: 'Test Location' }),
    }).catch(() => {});
    setBusy(false);
  };

  const clear = async () => {
    setBusy(true);
    await fetch('/api/emergencies', { method: 'DELETE' }).catch(() => {});
    setBusy(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 16, left: 16, zIndex: 9998,
      background: 'rgba(234,179,8,0.12)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(234,179,8,0.4)', borderRadius: 10,
      padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
      fontFamily: 'var(--font-mono, monospace)', fontSize: 10,
      color: 'rgba(234,179,8,0.9)', letterSpacing: '0.08em',
    }}>
      <span style={{ opacity: 0.6 }}>DEV</span>
      <select
        value={type}
        onChange={e => setType(e.target.value as typeof type)}
        style={{
          background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.3)',
          borderRadius: 4, color: 'rgba(234,179,8,0.9)', fontSize: 10,
          fontFamily: 'inherit', padding: '2px 4px', cursor: 'pointer',
        }}
      >
        {EMERGENCY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <button
        onClick={trigger} disabled={busy}
        style={{
          background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)',
          borderRadius: 4, color: 'rgba(234,179,8,0.9)', fontSize: 10,
          fontFamily: 'inherit', padding: '3px 8px', cursor: busy ? 'default' : 'pointer',
          letterSpacing: '0.08em', opacity: busy ? 0.5 : 1,
        }}
      >
        TRIGGER
      </button>
      <button
        onClick={clear} disabled={busy}
        style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4, color: 'rgba(255,255,255,0.4)', fontSize: 10,
          fontFamily: 'inherit', padding: '3px 8px', cursor: busy ? 'default' : 'pointer',
          letterSpacing: '0.08em', opacity: busy ? 0.5 : 1,
        }}
      >
        CLEAR
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [is3D, setIs3D] = useState(true);
  const flareRadiusM = useFlareRadiusM();
  const userLoc = useUserLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [center, setCenter] = useState<[number, number]>(() => {
    const lat = parseFloat(searchParams.get('lat') ?? '');
    const lng = parseFloat(searchParams.get('lng') ?? '');
    return (isFinite(lat) && isFinite(lng)) ? [lng, lat] : [-87.6298, 41.8781];
  });

  const feedLng = userLoc?.lng ?? center[0];
  const feedLat = userLoc?.lat ?? center[1];

  // Fly to user location on first fix (covers direct reload with no URL params)
  const userLocApplied = useRef(false);
  useEffect(() => {
    if (!userLoc || userLocApplied.current) return;
    userLocApplied.current = true;
    setCenter([userLoc.lng, userLoc.lat]);
  }, [userLoc]);
  const [threatBuildings, setThreatBuildings] = useState<Record<string, ThreatState['threatLevel']>>({});
  const [flareBuildings, setFlareBuildings] = useState<Record<string, TipCategory>>({});
  const [roadFlarePoints, setRoadFlarePoints] = useState<Array<{ lng: number; lat: number; category: TipCategory }>>([]);
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [tipModal, setTipModal] = useState<{ lng: number; lat: number; buildingId?: string } | null>(null);
  const [mapContext, setMapContext] = useState<{ map: any; mapboxGL: any } | null>(null);
  const [buildingPopup, setBuildingPopup] = useState<{ lng: number; lat: number; buildingId: string } | null>(null);
  const [exitModal, setExitModal] = useState<{ buildingId: string; buildingCenter: { lng: number; lat: number } } | null>(null);
  const [exitPlacementMode, setExitPlacementMode] = useState(false);
  const [exitPlacedLocation, setExitPlacedLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const prevActiveRef = useRef(false);

  // Poll for active emergency every 5s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/emergencies');
        const { emergency } = await res.json();

        if (emergency && !prevActiveRef.current) {
          prevActiveRef.current = true;
          // Close modals first, mount overlay, then fade in
          setTipModal(null);
          setBuildingPopup(null);
          setShowAuth(false);
          setExitModal(null);
          setExitPlacementMode(false);
          setSettingsOpen(false);
          setAlertMsg(null);
          setActiveEmergency(emergency);
          // Small delay so feed unmounts (map expands) before overlay fades in
          requestAnimationFrame(() => setEmergencyVisible(true));
        } else if (!emergency && prevActiveRef.current) {
          prevActiveRef.current = false;
          setEmergencyVisible(false);
          setTimeout(() => setActiveEmergency(null), 400);
        }
      } catch { /* silent */ }
    };

    poll();
    const id = setInterval(poll, 5_000);
    return () => clearInterval(id);
  }, []);

  const refreshThreats = useCallback(async () => {
    const res = await fetch('/api/threats');
    const threats: ThreatState[] = await res.json();
    const map: Record<string, ThreatState['threatLevel']> = {};
    threats.forEach(t => { map[t.buildingId] = t.threatLevel; });
    setThreatBuildings(map);
    if (threats.some(t => t.threatLevel === 'critical')) {
      setAlertMsg('CRITICAL THREAT DETECTED NEARBY — Avoid the area and contact authorities.');
    }
  }, []);

  const refreshFlareBuildings = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tips?lng=${feedLng}&lat=${feedLat}&radius=${flareRadiusM}`,
        { credentials: 'include' },
      );
      const tips: Tip[] = await res.json();
      if (!Array.isArray(tips)) return;
      const byBuilding = new Map<string, Tip[]>();
      for (const t of tips) {
        if (!t.buildingId) continue;
        if (!byBuilding.has(t.buildingId)) byBuilding.set(t.buildingId, []);
        byBuilding.get(t.buildingId)!.push(t);
      }
      const next: Record<string, TipCategory> = {};
      const roadPts: Array<{ lng: number; lat: number; category: TipCategory }> = [];
      byBuilding.forEach((arr: Tip[], id: string) => {
        if (id.startsWith('road:')) {
          // One point per flare on a road (exact click coordinates)
          arr.forEach(t => roadPts.push({
            lng: t.location.coordinates[0],
            lat: t.location.coordinates[1],
            category: t.category,
          }));
        } else {
          next[id] = topFlareCategory(arr);
        }
      });
      setFlareBuildings(next);
      setRoadFlarePoints(roadPts);
    } catch {
      /* silent */
    }
  }, [feedLng, feedLat, flareRadiusM]);

  const handleMapClick = useCallback((lng: number, lat: number) => {
    if (!user) { setShowAuth(true); return; }
    setTipModal({ lng, lat });
  }, [user]);

  const handleBuildingClick = useCallback((lng: number, lat: number, buildingId: string) => {
    if (!user) { setShowAuth(true); return; }
    setBuildingPopup({ lng, lat, buildingId });
  }, [user]);

  const handleRoadClick = useCallback((lng: number, lat: number, roadId: string) => {
    if (!user) { setShowAuth(true); return; }
    setTipModal({ lng, lat, buildingId: roadId });
  }, [user]);

  const handleLocate = useCallback(() => {
    setLocateTrigger(n => n + 1);
  }, []);

  // Restore session from cookie on mount
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => { if (u) setUser(u as User); })
      .catch(() => {});
  }, []);

  const handleSignOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
  }, []);

  const handleTipSubmit = useCallback(async (data: { category: TipCategory; description: string; urgency: TipUrgency }) => {
    if (!tipModal || !user) return;
    const res = await fetch('/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ lng: tipModal.lng, lat: tipModal.lat, buildingId: tipModal.buildingId, ...data }),
    });
    if (res.ok) {
      dispatchFlaresChanged();
    }
  }, [tipModal, user]);

  useEffect(() => {
    refreshFlareBuildings();
  }, [refreshFlareBuildings]);

  useEffect(() => {
    const onFlaresChanged = () => {
      refreshThreats();
      refreshFlareBuildings();
    };
    window.addEventListener(VIGIL_FLARES_CHANGED_EVENT, onFlaresChanged);
    return () => window.removeEventListener(VIGIL_FLARES_CHANGED_EVENT, onFlaresChanged);
  }, [refreshThreats, refreshFlareBuildings]);

  const handleReportFromPopup = useCallback(() => {
    if (!buildingPopup) return;
    setBuildingPopup(null);
    setTipModal({ lng: buildingPopup.lng, lat: buildingPopup.lat, buildingId: buildingPopup.buildingId });
  }, [buildingPopup]);

  const handleAddExit = useCallback(() => {
    if (!buildingPopup) return;
    setExitModal({ buildingId: buildingPopup.buildingId, buildingCenter: { lng: buildingPopup.lng, lat: buildingPopup.lat } });
    setExitPlacedLocation(null);
  }, [buildingPopup]);

  const handleEnterPlacement = useCallback(() => {
    setExitPlacementMode(true);
  }, []);

  const handlePlacementClick = useCallback((lng: number, lat: number) => {
    setExitPlacedLocation({ lng, lat });
    setExitPlacementMode(false);
  }, []);

  const handleExitSubmit = useCallback(async (data: {
    buildingId: string;
    location: { lng: number; lat: number };
    exitType: ExitType;
    floor: number;
    description: string;
    accessible: boolean;
  }) => {
    const res = await fetch('/api/exits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save exit');
    setExitModal(null);
    setExitPlacedLocation(null);
    // Reopen building popup to show the new exit
    if (buildingPopup) {
      setBuildingPopup({ ...buildingPopup });
    }
  }, [buildingPopup]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        height: '100dvh',
        maxHeight: '100dvh',
        background: '#000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {!emergencyVisible && alertMsg && <AlertBanner message={alertMsg} onDismiss={() => setAlertMsg(null)} />}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Map area */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {/* TopBar — fades during emergency */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
            opacity: emergencyVisible ? 0 : 1,
            pointerEvents: emergencyVisible ? 'none' : 'auto',
            transition: 'opacity 400ms ease',
          }}>
            <TopBar />
          </div>

          {/* Search — fades during emergency. Must be position:absolute inset:0 so
              MapLocationSearch's own "absolute right-4 top-4" stays relative to the map container */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 28, pointerEvents: 'none',
            opacity: emergencyVisible ? 0 : 1,
            transition: 'opacity 400ms ease',
          }}>
            <div style={{ pointerEvents: emergencyVisible ? 'none' : 'auto' }}>
              <MapLocationSearch
                proximity={center}
                onNavigate={(lng, lat) => setCenter([lng, lat])}
              />
            </div>
          </div>

          {/* Map always visible */}
          <MapView
            threatBuildings={threatBuildings}
            flareBuildings={flareBuildings}
            roadFlarePoints={roadFlarePoints}
            is3D={is3D}
            center={center}
            locateTrigger={locateTrigger}
            flyTarget={flyTarget}
            placementMode={exitPlacementMode}
            onReady={() => setRevealed(true)}
            onMapClick={handleMapClick}
            onBuildingClick={handleBuildingClick}
            onRoadClick={handleRoadClick}
            onPlacementClick={handlePlacementClick}
            onMapRef={(map, mapboxGL) => setMapContext(map ? { map, mapboxGL } : null)}
          />

          {/* Report button — fades during emergency */}
          <button
            onClick={() => user ? setTipModal({ lng: center[0], lat: center[1] }) : setShowAuth(true)}
            style={{
              position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
              background: '#dc2626', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '999px',
              padding: '12px 32px', fontSize: '12px', letterSpacing: '0.25em',
              fontFamily: 'var(--font-sans, sans-serif)', color: '#ffffff', cursor: 'pointer',
              textTransform: 'uppercase', zIndex: 10,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ef4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#dc2626'; }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(-50%) scale(0.97)'; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(-50%) scale(1)'; }}
          >
            + REPORT
          </button>

          {/* Flare bubbles — hidden during emergency */}
          {!emergencyVisible && (
            <FlareBubbles
              mapContext={mapContext}
              lng={feedLng}
              lat={feedLat}
              radius={flareRadiusM}
            />
          )}

          {/* Building popup — hidden during emergency */}
          {!emergencyVisible && buildingPopup && !exitPlacementMode && (
            <BuildingPopup
              buildingId={buildingPopup.buildingId}
              lng={buildingPopup.lng}
              lat={buildingPopup.lat}
              onClose={() => setBuildingPopup(null)}
              onAddExit={handleAddExit}
              onFlyToExit={(exitCenter, zoom) => setFlyTarget({ center: exitCenter, zoom })}
              onReportHere={handleReportFromPopup}
            />
          )}

          {/* Geo-pinned emergency marker */}
          {activeEmergency && mapContext && (
            <EmergencyMarker emergency={activeEmergency} mapContext={mapContext} />
          )}
        </div>

        {/* Feed panel — swaps with an equal-width spacer during emergency so the map
            area (and report button centering) never shifts */}
        {emergencyVisible ? (
          <div style={{ flexShrink: 0, width: 'min(300px, 100%)' }} />
        ) : (
          <NotificationFeed
            lng={feedLng}
            lat={feedLat}
            radius={flareRadiusM}
            user={user}
            is3D={is3D}
            onToggle3D={() => setIs3D((v) => !v)}
            onLocate={handleLocate}
            onAuthOpen={() => setShowAuth(true)}
            onSignOut={handleSignOut}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </div>

      {!emergencyVisible && settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {!emergencyVisible && tipModal && <TipModal {...tipModal} onClose={() => setTipModal(null)} onSubmit={handleTipSubmit} />}
      {!emergencyVisible && showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={u => setUser(u as User)} />}

      {!emergencyVisible && exitModal && !exitPlacementMode && (
        <ExitModal
          buildingId={exitModal.buildingId}
          isPlacementMode={exitPlacementMode}
          placedLocation={exitPlacedLocation}
          onEnterPlacement={handleEnterPlacement}
          onConfirmPlacement={() => {}}
          onClose={() => { setExitModal(null); setExitPlacedLocation(null); setExitPlacementMode(false); }}
          onSubmit={handleExitSubmit}
        />
      )}

      {activeEmergency && (
        <EmergencyOverlay emergency={activeEmergency} visible={emergencyVisible} />
      )}

      {/* ── DEV-ONLY emergency test widget ── */}
      {process.env.NODE_ENV === 'development' && (
        <DevEmergencyWidget lat={feedLat} lng={feedLng} />
      )}

      {/* Reveal overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#000',
          opacity: revealed ? 0 : 1,
          transition: 'opacity 300ms ease-out',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
