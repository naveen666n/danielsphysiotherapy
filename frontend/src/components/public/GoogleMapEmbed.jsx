export default function GoogleMapEmbed({ address, className = 'h-64 w-full rounded-xl border border-slate-200' }) {
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
