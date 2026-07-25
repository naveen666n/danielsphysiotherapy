export default function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  const alignment = align === 'center' ? 'text-center items-center' : 'text-left items-start';
  return (
    <div className={`mx-auto mb-10 flex max-w-2xl flex-col ${alignment}`}>
      {eyebrow && <span className="text-sm font-semibold uppercase tracking-wide text-teal-600">{eyebrow}</span>}
      <h2 className="mt-1 text-3xl font-bold text-slate-800 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-slate-500">{subtitle}</p>}
    </div>
  );
}
