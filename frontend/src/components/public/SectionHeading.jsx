export default function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  const alignment = align === 'center' ? 'mx-auto text-center items-center' : 'text-left items-start';
  return (
    <div className={`mb-12 flex max-w-2xl flex-col ${alignment}`}>
      {eyebrow && (
        <span className="mb-4 flex items-center gap-2.5 font-mono-brand text-xs tracking-[0.14em] text-brand-blue uppercase">
          <span className="h-px w-7 bg-brand-blue" aria-hidden="true" />
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-3xl leading-[1.15] font-normal text-brand-navy sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base text-brand-ink-soft">{subtitle}</p>}
    </div>
  );
}
