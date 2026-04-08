import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export const SectionCard = ({
  title,
  description,
  children,
  footer,
  className,
}: SectionCardProps): JSX.Element => {
  return (
    <section
      className={`rounded-card border border-surface-200 bg-white p-4 shadow-paper ${className ?? ''}`}
      aria-label={title}
    >
      <header className="mb-4">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
      </header>

      <div>{children}</div>

      {footer ? <footer className="mt-4 border-t border-neutral-100 pt-3">{footer}</footer> : null}
    </section>
  );
};
