export default function GoogleMapEmbed({ address, className = 'h-64 w-full rounded-[var(--radius-card)] border border-brand-line' }) {
  if (!address) return null;

  const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

  return (
    <iframe
      title="Hospital location map"
      src={src}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
