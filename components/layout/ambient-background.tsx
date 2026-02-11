export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-[110px]" />
      <div className="absolute right-0 top-12 h-80 w-80 rounded-full bg-cyan-500/15 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-[130px]" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
