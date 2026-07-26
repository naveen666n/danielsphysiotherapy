export default function EmptyState({ label }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-brand-line bg-brand-ice px-6 py-14 text-center">
      <p className="text-brand-ink-soft">{label} coming soon — check back shortly.</p>
    </div>
  );
}
