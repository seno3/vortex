'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/types';
import CredibilityBadge from '@/components/CredibilityBadge';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(setUser).catch(() => {});
  }, []);

  if (!user) return (
    <div style={{ minHeight: '100dvh', maxHeight: '100dvh', overflow: 'auto', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.3)', fontSize: '12px', letterSpacing: '0.2em' }}>
      NOT SIGNED IN
    </div>
  );

  const scoreColor = user.credibilityScore >= 70 ? '#4ade80' : user.credibilityScore >= 40 ? '#facc15' : '#ef4444';

  return (
    <div style={{ minHeight: '100dvh', maxHeight: '100dvh', overflow: 'auto', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, monospace' }}>
      <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '40px', width: '360px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'rgba(255,255,255,0.8)', margin: '0 auto 16px' }}>
          {user.username[0].toUpperCase()}
        </div>
        <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.9)', marginBottom: '4px', letterSpacing: '0.1em' }}>{user.username}</div>
        <div style={{ fontSize: '48px', fontWeight: 300, color: scoreColor, margin: '20px 0 8px', lineHeight: 1 }}>{user.credibilityScore}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: '24px' }}>CREDIBILITY SCORE</div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {[{ label: 'TIPS', value: user.tipsSubmitted }, { label: 'CORROBORATED', value: user.tipsCorroborated }, { label: 'FLAGGED', value: user.tipsFlagged }].map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>{stat.value}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
