'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ShieldCheck, UserPlus, Lock, Mail, Building2, ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    department: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/login?registered=1');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Registration"
      title="Create a safe default user account"
      description="Public registration creates a restricted viewer account. Privileged access continues to be granted through case and role assignment workflows."
      highlights={[
        {
          title: "Default Access",
          description: "New users receive the safe default role only. No role escalation can be requested through this form.",
          icon: <UserPlus className="h-6 w-6" />
        },
        {
          title: "Security",
          description: "All accounts are protected by standard security policies and audit logging.",
          icon: <ShieldCheck className="h-6 w-6" />
        }
      ]}
    >
      <div className="w-full">
        <div className="mb-8 space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-sky-400 font-semibold">Register</p>
          <h2 className="text-2xl font-bold tracking-tight text-white">Start your account</h2>
          <p className="text-sm text-slate-400">All fields are required to create a viewer account.</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Full name</span>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
              placeholder="Investigating Officer Name"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Department</span>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-10 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                placeholder="Special Crime Branch"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email Address</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-10 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                placeholder="officer@example.gov"
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-2 flex items-center justify-between">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Password</span>
              <span className="text-[10px] font-medium text-slate-500">Min 8 chars</span>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-10 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3 text-[11px] font-semibold tracking-wide uppercase text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{loading ? 'Creating account...' : 'Create Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-sm text-slate-500 text-center">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-sky-400 transition hover:text-sky-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}