import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen overflow-x-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/campus.jpg"
          alt="School of Field Artillery campus"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-login-overlay" />
        <div className="bg-command-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
              <Image
                src="/school-of-artillery.png"
                alt="School of Artillery crest"
                width={56}
                height={44}
                className="h-auto w-full"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
                School of Field Artillery
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-highlight">
                Tanzania People&apos;s Defence Force
              </p>
            </div>
          </div>

          <div className="max-w-lg">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="size-1.5 rounded-full bg-highlight" />
              Training Records Management System
            </span>
            <h1 className="mt-5 text-4xl leading-tight font-semibold xl:text-5xl">
              Precision in training.
              <br />
              <span className="text-highlight">Excellence in records.</span>
            </h1>
            <p className="mt-4 text-base text-white/75">
              Students, courses, intakes, results and certificates — managed securely in one place.
            </p>
          </div>

          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} School of Field Artillery. Authorised personnel only.
          </p>
        </div>
        <span className="bg-regimental-ribbon absolute inset-x-0 bottom-0 h-2" />
      </aside>

      <main className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-card p-2 shadow-md ring-1 ring-foreground/5 lg:hidden">
              <Image
                src="/school-of-artillery.png"
                alt="School of Artillery crest"
                width={64}
                height={50}
                className="h-auto w-full"
                priority
              />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in with your account to continue.
            </p>
          </div>

          <LoginForm />

          <div className="mt-8 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" />
            Secure session · activity on this system is logged.
          </div>
        </div>
      </main>
    </div>
  );
}
