export default function GoogleMapEmbed({ address, embedUrl, className = 'h-64 w-full rounded-[var(--radius-card)] border border-brand-line' }) {
  if (!embedUrl && !address) return null;

  const src = embedUrl || `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

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
