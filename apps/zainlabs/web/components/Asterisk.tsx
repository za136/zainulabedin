// Brand mark taken from the Canva template: an eight-armed signal-red asterisk.
export function Asterisk({ size = 28, color = "var(--accent)" }: { size?: number; color?: string }) {
  const arms = [0, 45, 90, 135];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {arms.map((a) => (
        <rect key={a} x="45" y="4" width="10" height="92" rx="1" fill={color} transform={`rotate(${a} 50 50)`} />
      ))}
    </svg>
  );
}
