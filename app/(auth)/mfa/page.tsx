'use client';
import React, { useState } from 'react';
import { ShieldCheck, KeyRound, ArrowRight, AlertCircle, Lock } from 'lucide-react';

export default function MfaPageContent() {
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const challengeToken = urlParams.get('challengeToken');

      if (!challengeToken) {
        setError('Missing MFA challenge token. Please login again.');
        setLoading(false);
        return;
      }

      const payload = useRecovery
        ? { challengeToken, recoveryCode: recoveryCode.trim() }
        : { challengeToken, totpCode: totpCode.trim() };

      const res = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'MFA verification failed');
      }

      // Redirect on success
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3 bg-emerald-950/60 rounded-full border border-emerald-500/40 text-emerald-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Multi-Factor Authentication
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            LAW-ENFORCEMENT SECURE ACCESS CHALLENGE
          </p>
        </div>
 
        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}
 
        <form onSubmit={handleSubmit} className="space-y-4">
          {!useRecovery ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                6-Digit Authenticator Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-center text-2xl tracking-[0.5em] font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Recovery Code (XXXX-XXXX-XXXX)
              </label>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="A1B2-C3D4-E5F6"
                required
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          )}
 
          <button
            type="submit"
            disabled={loading || (!totpCode && !recoveryCode)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50"
          >
            <span>{loading ? 'Verifying...' : 'Verify Session'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
 
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
          <button
            type="button"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setError(null);
            }}
            className="text-slate-400 hover:text-emerald-400 transition flex items-center space-x-1 font-mono"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{useRecovery ? 'Use Authenticator Code' : 'Use Recovery Code'}</span>
          </button>
 
          <span className="text-slate-600 font-mono text-[10px] flex items-center">
            <Lock className="w-3 h-3 mr-1" /> TOTP-2FA
          </span>
        </div>
      </div>
    </div>
  );
}