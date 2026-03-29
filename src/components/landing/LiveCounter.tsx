'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export default function LiveCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setCount(0);
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const fetchCount = async () => {
      const { count: n, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      if (!error && n !== null) setCount(n);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (count === null) {
    return (
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          animation: 'skeletonPulse 1.4s ease-in-out infinite',
        }}
      />
    );
  }

  const dotColor = count === 0 ? '#22c55e' : '#ef4444';

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          display: 'inline-block',
          animation: 'liveDot 1.5s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes liveDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.3; }
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
