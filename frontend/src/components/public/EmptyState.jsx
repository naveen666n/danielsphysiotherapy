export default function EmptyState({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
      <p className="text-slate-500">{label} coming soon — check back shortly.</p>
    </div>
  );
}
