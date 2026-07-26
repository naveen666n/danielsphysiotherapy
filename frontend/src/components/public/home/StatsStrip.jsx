const stats = [
  { value: '500+', label: 'Patients Recovered' },
  { value: '10+', label: 'Years of Care' },
  { value: '98%', label: 'Satisfaction Rate' },
];

export default function StatsStrip() {
  return (
    <div className="border-b border-brand-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-[var(--radius-card)] bg-brand-ice px-6 py-5">
            <span className="font-display text-3xl text-brand-navy">{stat.value}</span>
            <span className="font-mono-brand text-xs tracking-[0.08em] text-brand-ink-soft uppercase">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
