export function ScanlineOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan/5 to-transparent h-1 animate-scan" />
    </div>
  );
}
