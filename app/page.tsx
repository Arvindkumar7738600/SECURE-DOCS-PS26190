import React from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Search, 
  FileText, 
  Cpu, 
  ArrowRight, 
  Lock, 
  FolderOpen, 
  Server,
  CheckCircle2
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30 font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
              <Shield className="h-5 w-5 text-sky-400" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-white uppercase">Solvexa</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1 text-xs font-medium text-slate-300 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              System Operational
            </span>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 lg:pt-36 lg:pb-40">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-950 to-slate-950"></div>
          <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-medium text-sky-300 mb-8">
              <Lock className="h-3.5 w-3.5" />
              <span>Enterprise-Grade Security Architecture</span>
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-7xl">
              Secure Digital <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Case Management</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              An advanced, high-security platform designed for law enforcement and enterprise compliance. Centralize evidence, automate OCR processing, and leverage AI semantic search with strict RBAC auditing.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 px-8 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-400 hover:shadow-[0_0_20px_rgba(14,165,233,0.3)]"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="text-sm font-semibold leading-6 text-slate-300 transition hover:text-white">
                Sign In <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          
          {/* Visual Product/Dashboard Preview */}
          <div className="mx-auto mt-16 max-w-7xl px-6 sm:mt-24 lg:px-8 relative z-10">
            <div className="rounded-2xl border border-sky-500/30 bg-slate-900/60 p-2 shadow-[0_0_50px_rgba(14,165,233,0.15)] backdrop-blur-md lg:p-4 animate-border-glow">
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl relative">
                {/* Mock Browser/App Header */}
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-rose-500/80"></div>
                      <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
                      <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <span className="ml-3 text-xs font-medium text-slate-400 hidden sm:inline-block">Solvexa Secure Evidence Hub v1.0</span>
                  </div>
                  <div className="flex h-6 items-center justify-center rounded-lg bg-slate-800/80 px-3 text-[11px] font-mono text-sky-300 border border-slate-700">
                    <Lock className="mr-1.5 h-3 w-3 text-sky-400" /> AES-256-GCM ENCRYPTED SESSION
                  </div>
                </div>

                {/* Mock Interactive Content Panel */}
                <div className="relative p-6 bg-slate-950 min-h-[380px] overflow-hidden">
                  {/* Subtle scanning beam */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_rgba(56,189,248,0.8)] animate-scanline" />

                  {/* Header row in mock */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400">Case File #CR-2026-88912</span>
                      <h3 className="text-lg font-bold text-white">Cyber Fraud Investigation — Operations Division</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Audit Verified
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                        SHA-256 Intact
                      </span>
                    </div>
                  </div>

                  {/* Body grid in mock preview */}
                  <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
                    <div className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition duration-300 hover:border-sky-500/50 hover:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Digital Evidence</span>
                        <FolderOpen className="h-4 w-4 text-sky-400" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-white">48 Files</p>
                      <p className="mt-1 text-[11px] text-slate-500">Includes scanned FIRs & PDF filings</p>
                    </div>

                    <div className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition duration-300 hover:border-sky-500/50 hover:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">AI Vector Chunks</span>
                        <Cpu className="h-4 w-4 text-sky-400" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-white">1,420 Chunks</p>
                      <p className="mt-1 text-[11px] text-slate-500">Indexed for hybrid semantic search</p>
                    </div>

                    <div className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition duration-300 hover:border-sky-500/50 hover:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Chain of Custody</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-white">100% Valid</p>
                      <p className="mt-1 text-[11px] text-slate-500">Tamper-evident audit hash-chain</p>
                    </div>
                  </div>

                  {/* Mock search result item */}
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-sky-400" />
                        <span className="text-xs font-medium text-slate-300">Semantic Search Match (Score: 98.4%)</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">Tesseract OCR Conf: 97.2%</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 italic">
                      "...transaction log shows flagged IP transfer matching suspect wallet address listed in Appendix B of FIR..."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Section */}
        <section className="py-24 sm:py-32 bg-slate-900/30 border-t border-slate-800/50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-base font-semibold leading-7 text-sky-400">Advanced Capabilities</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need to manage cases securely</p>
            </div>
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-4">
                <div className="group flex flex-col items-start rounded-2xl border border-slate-800 bg-slate-950 p-6 transition-all duration-300 hover:border-sky-500/50 hover:shadow-[0_0_25px_rgba(14,165,233,0.15)]">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-sm mb-5 group-hover:border-sky-500/40 group-hover:bg-sky-500/10 transition">
                    <FolderOpen className="h-6 w-6 text-sky-400" />
                  </div>
                  <dt className="text-base font-semibold leading-7 text-white">Secure Case Repository</dt>
                  <dd className="mt-2 flex flex-auto flex-col text-sm leading-6 text-slate-400">
                    <p className="flex-auto">Centralized digital vault for all case files. Organize evidence, manage metadata, and track case progression with immutable audit trails.</p>
                  </dd>
                </div>
                <div className="group flex flex-col items-start rounded-2xl border border-slate-800 bg-slate-950 p-6 transition-all duration-300 hover:border-sky-500/50 hover:shadow-[0_0_25px_rgba(14,165,233,0.15)]">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-sm mb-5 group-hover:border-sky-500/40 group-hover:bg-sky-500/10 transition">
                    <FileText className="h-6 w-6 text-sky-400" />
                  </div>
                  <dt className="text-base font-semibold leading-7 text-white">Document Management</dt>
                  <dd className="mt-2 flex flex-auto flex-col text-sm leading-6 text-slate-400">
                    <p className="flex-auto">Streamlined upload and management of FIRs, court filings, and forensic reports with built-in version control and cryptographic integrity.</p>
                  </dd>
                </div>
                <div className="group flex flex-col items-start rounded-2xl border border-slate-800 bg-slate-950 p-6 transition-all duration-300 hover:border-sky-500/50 hover:shadow-[0_0_25px_rgba(14,165,233,0.15)]">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-sm mb-5 group-hover:border-sky-500/40 group-hover:bg-sky-500/10 transition">
                    <Search className="h-6 w-6 text-sky-400" />
                  </div>
                  <dt className="text-base font-semibold leading-7 text-white">AI Semantic Search</dt>
                  <dd className="mt-2 flex flex-auto flex-col text-sm leading-6 text-slate-400">
                    <p className="flex-auto">Instantly retrieve critical information across thousands of documents using natural language queries powered by pgvector embeddings.</p>
                  </dd>
                </div>
                <div className="group flex flex-col items-start rounded-2xl border border-slate-800 bg-slate-950 p-6 transition-all duration-300 hover:border-sky-500/50 hover:shadow-[0_0_25px_rgba(14,165,233,0.15)]">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-sm mb-5 group-hover:border-sky-500/40 group-hover:bg-sky-500/10 transition">
                    <Cpu className="h-6 w-6 text-sky-400" />
                  </div>
                  <dt className="text-base font-semibold leading-7 text-white">OCR & Intelligent Processing</dt>
                  <dd className="mt-2 flex flex-auto flex-col text-sm leading-6 text-slate-400">
                    <p className="flex-auto">Automated extraction of entities and metadata from scanned images and PDFs using advanced machine learning vision models.</p>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Security & Compliance Section */}
        <section className="py-24 border-t border-slate-800/50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-12 items-center">
              <div className="lg:w-1/2">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Security & Compliance</h2>
                <p className="mt-4 text-lg text-slate-400">
                  Built to meet strict government and enterprise compliance standards. Data is protected at rest and in transit with state-of-the-art encryption.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    'AES-256-GCM encryption for all stored files',
                    'SHA-256 cryptographic integrity verification',
                    'Strict Role-Based Access Control (RBAC)',
                    'Comprehensive and immutable audit logging'
                  ].map((feature, i) => (
                    <li key={i} className="flex gap-3 items-center text-sm text-slate-300">
                      <CheckCircle2 className="h-5 w-5 text-sky-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:w-1/2 w-full">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-inner">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 border border-slate-800">
                      <Server className="h-6 w-6 text-slate-300" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Dedicated Infrastructure</div>
                      <div className="text-xs text-slate-400">Isolated Vercel Serverless + PostgreSQL</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Data Residency</span>
                      <span className="text-white font-medium">Configurable</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Transport Security</span>
                      <span className="text-white font-medium">TLS 1.3 Strict</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pb-2">
                      <span className="text-slate-400">Authentication</span>
                      <span className="text-white font-medium">MFA Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Solvexa</span>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            © {new Date().getFullYear()} Secure Digital Case Management. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
