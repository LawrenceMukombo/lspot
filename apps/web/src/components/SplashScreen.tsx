import React, { useEffect, useState } from 'react';
import { Utensils, ShieldCheck, Wifi, Sparkles, Fingerprint } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(8);
  const [statusLabel, setStatusLabel] = useState('Initializing LSpot Offline Storage Engine...');
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setProgress(42);
      setStatusLabel('Activating Thumbprint & Face Recognition Sensors...');
    }, 420);

    const t2 = window.setTimeout(() => {
      setProgress(78);
      setStatusLabel('Synchronizing Real-Time POS, Kitchen & Stock Ledgers...');
    }, 900);

    const t3 = window.setTimeout(() => {
      setProgress(100);
      setStatusLabel('Ready • Welcome to The LSpot Restaurant');
    }, 1350);

    const t4 = window.setTimeout(() => {
      setFadingOut(true);
    }, 1650);

    const t5 = window.setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
    };
  }, [onComplete]);

  return (
    <div
      onClick={() => {
        setFadingOut(true);
        window.setTimeout(onComplete, 200);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background:
          'radial-gradient(circle at 50% 28%, rgba(230, 168, 50, 0.22) 0%, rgba(15, 23, 42, 0.96) 48%, #060911 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px',
        color: '#f8fafc',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.35s ease-out',
        userSelect: 'none',
        cursor: 'pointer'
      }}
    >
      {/* Decorative Ambient Glow */}
      <div
        style={{
          position: 'relative',
          width: '132px',
          height: '132px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '26px'
        }}
      >
        {/* Outer rotating gold ring */}
        <div
          style={{
            position: 'absolute',
            inset: '-10px',
            borderRadius: '50%',
            border: '2px dashed rgba(230, 168, 50, 0.38)',
            animation: 'spin 12s linear infinite'
          }}
        />
        {/* Inner glowing halo */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            borderRadius: '34px',
            background: 'linear-gradient(135deg, rgba(230, 168, 50, 0.35), rgba(217, 119, 6, 0.08))',
            filter: 'blur(14px)'
          }}
        />
        {/* Main Brand Emblem */}
        <div
          style={{
            position: 'relative',
            width: '108px',
            height: '108px',
            borderRadius: '28px',
            background: 'linear-gradient(145deg, #f59e0b 0%, #d97706 55%, #b45309 100%)',
            boxShadow:
              '0 20px 50px rgba(217, 119, 6, 0.45), inset 0 2px 4px rgba(255, 255, 255, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#090d16'
          }}
        >
          <Utensils size={52} strokeWidth={2.4} />
        </div>
      </div>

      {/* Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 14px',
          borderRadius: '999px',
          background: 'rgba(230, 168, 50, 0.14)',
          border: '1px solid rgba(230, 168, 50, 0.35)',
          color: '#fbbf24',
          fontSize: '0.72rem',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '14px'
        }}
      >
        <Sparkles size={13} /> ENTERPRISE POS • KDS • OFFLINE ERP
      </div>

      {/* Restaurant Title */}
      <h1
        style={{
          margin: '0 0 8px 0',
          fontSize: '2.1rem',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          background: 'linear-gradient(90deg, #ffffff 0%, #fde68a 50%, #f59e0b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        The LSpot Restaurant
      </h1>

      <p
        style={{
          margin: '0 0 32px 0',
          fontSize: '0.9rem',
          color: '#94a3b8',
          textAlign: 'center',
          maxWidth: '360px',
          lineHeight: 1.5
        }}
      >
        Manyama • Kalumbila District • Northwestern Province, Zambia
      </p>

      {/* Progress Container */}
      <div style={{ width: '100%', maxWidth: '320px' }}>
        <div
          style={{
            width: '100%',
            height: '7px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #10b981 100%)',
              boxShadow: '0 0 14px rgba(245, 158, 11, 0.6)',
              transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.76rem',
            color: '#cbd5e1',
            fontWeight: 600
          }}
        >
          <span>{statusLabel}</span>
          <span style={{ color: '#fbbf24', fontWeight: 800 }}>{progress}%</span>
        </div>
      </div>

      {/* Bottom Capability Pills */}
      <div
        style={{
          marginTop: '42px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.72rem',
            color: '#94a3b8'
          }}
        >
          <Fingerprint size={13} color="#fbbf24" /> Biometric Auth Ready
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.72rem',
            color: '#94a3b8'
          }}
        >
          <Wifi size={13} color="#10b981" /> Auto-Sync Online & Offline
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.72rem',
            color: '#94a3b8'
          }}
        >
          <ShieldCheck size={13} color="#38bdf8" /> ZRA Smart Invoice Ready
        </div>
      </div>
    </div>
  );
}

