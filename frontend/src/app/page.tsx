import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative h-screen overflow-hidden bg-background text-white">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[24rem] w-[24rem] rounded-full bg-blue-500/20 blur-[130px]" />
      <div className="pointer-events-none absolute right-0 top-20 h-[20rem] w-[20rem] rounded-full bg-emerald-400/15 blur-[110px]" />

      <main className="relative mx-auto flex h-screen w-full max-w-7xl flex-col px-5 py-5 md:px-8 md:py-6 lg:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/interviewpilot-logo.svg" alt="InterviewPilot logo" width={52} height={52} priority />
            <span className="text-xl font-bold tracking-tight md:text-2xl">InterviewPilot</span>
          </div>
          <Link
            href="/login"
            className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-medium text-text-main transition-colors hover:bg-white/10"
          >
            Sign In
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-6 py-4 md:gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-10">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 md:mb-5 md:px-4 md:py-1.5 md:text-sm">
              AI-powered mock interviews for real outcomes
            </p>
            <h1 className="text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl xl:text-6xl">
              Build interview confidence with full-screen focus and instant feedback
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200 md:mt-6 md:text-lg">
              Generate role-specific questions, answer naturally by voice or text, and get structured AI evaluation
              after every response.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 md:mt-8 md:gap-4">
              <Link
                href="/register"
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_-15px_rgba(59,130,246,0.8)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover md:rounded-2xl md:px-8 md:py-4 md:text-base"
              >
                Start Free Session
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 md:rounded-2xl md:px-8 md:py-4 md:text-base"
              >
                Continue Practice
              </Link>
            </div>
          </div>

          <div className="hidden rounded-3xl border border-white/15 bg-surface/80 p-6 shadow-2xl backdrop-blur-md md:block md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Live Session Preview</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-300">Question 3 of 5</p>
                <p className="mt-2 text-lg font-semibold">
                  How would you design a resilient API rate-limiting system for a multi-tenant SaaS product?
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-400/15 p-3">
                  <p className="text-xs text-emerald-200">Clarity</p>
                  <p className="mt-1 text-xl font-bold text-emerald-100">8.9</p>
                </div>
                <div className="rounded-xl bg-blue-400/15 p-3">
                  <p className="text-xs text-blue-200">Depth</p>
                  <p className="mt-1 text-xl font-bold text-blue-100">8.5</p>
                </div>
                <div className="rounded-xl bg-orange-300/15 p-3">
                  <p className="text-xs text-orange-200">Impact</p>
                  <p className="mt-1 text-xl font-bold text-orange-100">9.1</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
