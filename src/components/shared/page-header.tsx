
import type { FC, ReactNode } from 'react';

export const PageHeader: FC<PageHeaderProps> = ({ title, description, children }) => {
  return (
    <div className="mb-1 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div className="flex-1 space-y-0.5">
        <h1 className="text-lg font-bold tracking-tight font-headline">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};
