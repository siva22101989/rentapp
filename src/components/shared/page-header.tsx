import type { FC, ReactNode } from 'react';

export const PageHeader: FC<{title: string, description?: string, children?: ReactNode}> = ({ title, description, children }) => {
  return (
    <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print-hide">
      <div className="flex-1 space-y-0.5">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight font-headline text-slate-900">{title}</h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
};
