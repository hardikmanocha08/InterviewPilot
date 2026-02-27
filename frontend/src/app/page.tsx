import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-white flex items-center justify-center p-6">
      <main className="max-w-3xl w-full rounded-3xl border border-border bg-surface/90 p-10 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Image src="/interviewpilot-logo.svg" alt="InterviewPilot logo" width={56} height={56} priority />
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              InterviewPilot
            </h1>
            <p className="text-text-muted">Practice smarter with AI mock interviews.</p>
          </div>
        </div>

        <p className="text-lg text-text-main leading-relaxed mb-8">
          Build confidence with role-specific interview questions, instant AI feedback, and your choice of timed
          or untimed interview mode.
        </p>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/register"
            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover transition-colors font-semibold"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl border border-border hover:bg-white/5 transition-colors font-semibold"
          >
            Log In
          </Link>
        </div>
      </main>
    </div>
  );
}
