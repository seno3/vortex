'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { forwardGeocodeUrl } from '@/lib/mapboxGeocoding';

interface GeocodeFeature {
  place_name: string;
  center: [number, number];
}

interface MapLocationSearchProps {
  /** Bias search toward map view (lng, lat). */
  proximity: [number, number];
  onNavigate: (lng: number, lat: number) => void;
}

export default function MapLocationSearch({ proximity, onNavigate }: MapLocationSearchProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const runSearch = useCallback(
    (q: string) => {
      if (!token || q.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const url = forwardGeocodeUrl({
        accessToken: token,
        query: q.trim(),
        proximity,
        limit: 6,
      });
      fetch(url)
        .then((r) => r.json())
        .then((data: { features?: GeocodeFeature[] }) => {
          setResults(Array.isArray(data.features) ? data.features : []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    },
    [token, proximity],
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, runSearch]);

  const pick = (f: GeocodeFeature) => {
    const [lng, lat] = f.center;
    onNavigate(lng, lat);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const glass =
    'bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_4px_24px_rgba(0,0,0,0.25)] text-white/95';

  if (!token) return null;

  return (
    <div
      ref={rootRef}
      className={`absolute right-4 top-4 z-[28] flex flex-col items-end gap-1 transition-[width] duration-200 ease-out ${open ? 'w-[min(92vw,320px)]' : 'w-auto'}`}
      style={{ fontFamily: 'var(--font-sans, sans-serif)' }}
    >
      <div
        className={`flex min-h-[42px] w-full overflow-hidden rounded-full ${glass} ${open ? 'rounded-2xl' : ''}`}
      >
        {!open ? (
          <button
            type="button"
            aria-label="Search location"
            onClick={() => setOpen(true)}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center text-white/80 transition hover:bg-white/10 hover:text-white hover:scale-[1.02]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <div className="flex w-full min-w-0 items-center gap-2 px-3 py-2">
            <svg
              className="shrink-0 text-white/50"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  setResults([]);
                  setQuery('');
                }
                if (e.key === 'Enter' && results[0]) {
                  e.preventDefault();
                  pick(results[0]);
                }
              }}
              placeholder="Search place or address"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white/95 placeholder:text-white/35 outline-none"
              autoComplete="off"
              autoCorrect="off"
            />
            {loading && (
              <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-white/40">…</span>
            )}
            <button
              type="button"
              aria-label="Close search"
              onClick={() => {
                setOpen(false);
                setResults([]);
                setQuery('');
              }}
              className="shrink-0 rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white/80"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          className={`max-h-[40vh] w-full overflow-y-auto rounded-2xl py-1 ${glass}`}
          role="listbox"
        >
          {results.map((f, i) => (
            <li key={`${f.place_name}-${i}`}>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-2.5 text-left text-[12px] leading-snug text-white/90 transition hover:bg-white/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(f)}
              >
                {f.place_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
