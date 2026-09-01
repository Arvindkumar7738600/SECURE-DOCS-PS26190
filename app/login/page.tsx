'use client';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck, Lock, Mail, KeyRound, AlertCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import LoginPageContent from './login-page-content';

type AuthHighlight = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

export default function LoginPage() {
  return (
    <AuthShell
      badge="Secure"
      title="Sign in to the case repository"
      description="Access cases, documents, search, and MFA-protected evidence workflows through the authenticated portal."
      highlights={[
        {
          title: "Security",
          description: "HTTP-only session cookies, RBAC, audit logging, and MFA challenge support.",
          icon: <ShieldCheck className="h-6 w-6" />
        },
        {
          title: "Navigation",
          description: "After sign-in, land on the dashboard and continue into cases or search.",
          icon: <ArrowRight className="h-6 w-6" />
        }
      ]}
    >
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading...</div>}>
        <LoginPageContent />
      </Suspense>
    </AuthShell>
  );
}