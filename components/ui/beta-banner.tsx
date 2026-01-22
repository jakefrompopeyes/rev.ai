'use client';

export function BetaBanner() {
  return (
    <div className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20 py-2 px-4 text-center text-sm text-foreground/80 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <span className="font-medium">Beta Mode</span>
        </span>
        <span className="text-xs text-foreground/60">This website is currently in beta. Features may change.</span>
      </div>
    </div>
  );
}
