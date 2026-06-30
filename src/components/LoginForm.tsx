import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

const demoUsers = [
  { orgCode: 'TECH1', email: 'john@company.com',     role: 'Client Manager',    name: 'John S.' },
  { orgCode: 'TECH1', email: 'sarah@company.com',    role: 'Client Architect',  name: 'Sarah L.' },
  { orgCode: 'STRAT', email: 'mike@stratifyit.ai',   role: 'Admin Consultant',  name: 'Mike R.' },
  { orgCode: 'STRAT', email: 'lisa@stratifyit.ai',   role: 'Admin Architect',   name: 'Lisa K.' },
];

const LoginForm: React.FC = () => {
  const [orgCode, setOrgCode]   = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (orgCode.length !== 5) {
      setError('Organisation code must be exactly 5 characters.');
      setLoading(false);
      return;
    }
    if (!/^[A-Z0-9]{5}$/.test(orgCode.toUpperCase())) {
      setError('Organisation code must be 5 alphanumeric characters.');
      setLoading(false);
      return;
    }

    try {
      await login(orgCode, email, password);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Login failed. Please check your credentials and organisation code.',
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    fontSize: 15,
    fontFamily: 'var(--font-text)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--fg-2)',
    outline: 'none',
    background: '#fff',
    transition: 'border-color .14s',
    display: 'block',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-text)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--fg-2)',
    marginBottom: 6,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr .95fr', fontFamily: 'var(--font-text)' }}>

      {/* ── Left: brand panel ─────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        background: 'var(--ink)',
        color: '#fff',
        padding: '56px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        minHeight: '100vh',
      }}>
        {/* Radial sky glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(120% 80% at 80% -10%, rgba(47,143,219,.28), transparent 60%)',
          pointerEvents: 'none',
        }} />
        {/* Subtle horizontal line texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px)',
          backgroundSize: '100% 38px',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <img
          src="/logo-full-white.svg"
          alt="StratifyIT.ai"
          style={{ height: 44, width: 'auto', position: 'relative' }}
          onError={e => {
            // Fallback wordmark if SVG fails to load
            const el = e.currentTarget;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) {
              const fallback = document.createElement('div');
              fallback.style.cssText = 'font-family:var(--font-display);font-weight:800;font-size:22px;color:#fff;position:relative';
              fallback.textContent = 'StratifyIT.ai';
              parent.insertBefore(fallback, el);
            }
          }}
        />

        {/* Hero copy */}
        <div style={{ position: 'relative', maxWidth: 440 }}>
          <p style={{
            fontFamily: 'var(--font-text)', fontSize: 12, fontWeight: 600,
            letterSpacing: '.14em', textTransform: 'uppercase',
            color: '#2f8fdb', margin: '0 0 18px',
          }}>
            The intelligence layer for enterprise IT strategy
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 'clamp(28px, 2.8vw, 40px)', lineHeight: 1.06,
            letterSpacing: '-.02em', color: '#fff',
            margin: '0 0 18px', textWrap: 'balance' as any,
          }}>
            From a tangled IT estate to a strategic advantage — at speed.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: '#c5d0dd', margin: '0 0 36px' }}>
            Autonomous agents assess, govern, and advise across your portfolio rationalisation and modernisation journey. Humans decide at every critical gate.
          </p>
          <div style={{ display: 'flex', gap: 32 }}>
            {[
              { num: '6',  label: 'strategy domains' },
              { num: '4',  label: 'agentic platforms' },
              { num: '4h', label: 'autonomous cycle' },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: '#2f8fdb', letterSpacing: '-.02em', lineHeight: 1 }}>
                  {stat.num}
                </div>
                <div style={{ fontSize: 13, color: '#8899aa', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: 'relative', fontSize: 13, color: '#5a6b7e', margin: 0 }}>
          StratifyIT.ai — the intelligence layer for enterprise IT strategy.
        </p>
      </div>

      {/* ── Right: sign-in panel ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 40px',
        background: '#fff',
        minHeight: '100vh',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 392 }}>

          <p style={{ fontFamily: 'var(--font-text)', fontSize: 12, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sky)', margin: '0 0 8px' }}>
            Sign in
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: 'var(--fg-2)', letterSpacing: '-.015em', margin: '0 0 6px' }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: 'var(--fg-3)', margin: '0 0 28px' }}>
            Access your organisation's rationalisation workspace.
          </p>

          {error && (
            <div style={{ background: '#f7e7e5', border: '1px solid #c0473a', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
              <AlertCircle size={16} style={{ color: '#c0473a', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: '#a23a2f' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label style={labelStyle} htmlFor="orgCode">Organisation code</label>
            <input
              id="orgCode"
              type="text"
              value={orgCode}
              onChange={e => setOrgCode(e.target.value.toUpperCase())}
              placeholder="e.g. TECH1, STRAT"
              maxLength={5}
              required
              style={{ ...inputStyle, letterSpacing: '.12em', fontWeight: 600, marginBottom: 16 }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--sky)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            />

            <label style={labelStyle} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{ ...inputStyle, marginBottom: 16 }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--sky)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            />

            <label style={labelStyle} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ ...inputStyle, marginBottom: 24 }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--sky)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? '#aab4c0' : 'var(--sky)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'var(--font-text)',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : 'var(--sh-sky)',
                transition: 'background .14s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--sky-bright)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--sky)'; }}
            >
              {loading ? 'Signing in…' : 'Sign in to StratifyIT'}
            </button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--fg-4)', textAlign: 'center', margin: '18px 0 0' }}>
            Three-factor org access · Human-in-the-loop governance
          </p>

          {/* Demo accounts (only when Supabase is not configured) */}
          {!isSupabaseConfigured() && (
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 10, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Demo accounts
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {demoUsers.map(u => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => { setOrgCode(u.orgCode); setEmail(u.email); setPassword('demo123'); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', background: 'var(--surface-sunk)',
                      border: '1px solid var(--border)', borderRadius: 8,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'border-color .14s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sky)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{u.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 1 }}>{u.role} · {u.orgCode}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: 'var(--sky-50)', color: 'var(--sky)' }}>
                      Use
                    </span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 10 }}>
                Password for all demo accounts: <code style={{ fontFamily: 'var(--font-mono)', background: '#f4f6f9', padding: '1px 6px', borderRadius: 4 }}>demo123</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
