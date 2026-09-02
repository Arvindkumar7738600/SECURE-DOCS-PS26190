import React from 'react';
import { cn } from '@/lib/ui';

type AuthHighlight = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

export function AuthShell({
  badge,
  title,
  description,
  highlights,
  footer,
  children,
  className,
}: {
  badge: string;
  title: string;
  description: string;
  highlights: AuthHighlight[];
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-slate-950 to-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8',
        className
      )}
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-8 text-slate-100 shadow-2xl backdrop-blur-md sm:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.1),transparent_40%,rgba(15,23,42,1))]" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-400 shadow-sm">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 animate-pulse" />
                  {badge}
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-xl text-[30px] font-semibold tracking-tight text-white sm:text-[34px]">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-[14px] leading-6 text-slate-300">{description}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-sky-400">
                          {item.icon}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-sm leading-5 text-slate-400">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {footer ? <div>{footer}</div> : null}
            </div>
          </section>

          <section className="flex items-center">
            <div className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
              {children}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
