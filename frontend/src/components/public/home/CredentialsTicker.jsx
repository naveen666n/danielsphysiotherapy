const credentials = [
  '10+ Years of Clinical Experience',
  'Certified Physiotherapists',
  '500+ Patients Treated',
  'Evidence-Based Rehabilitation',
];

export default function CredentialsTicker() {
  return (
    <div className="border-b border-brand-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 sm:px-6">
        {credentials.map((item, i) => (
          <span key={item} className="flex items-center gap-2.5 font-mono-brand text-[11.5px] tracking-[0.08em] text-brand-ink-soft uppercase">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-brand-blue" aria-hidden="true" />}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
