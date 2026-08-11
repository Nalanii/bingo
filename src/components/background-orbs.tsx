export function BackgroundOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
      <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />
    </div>
  );
}
