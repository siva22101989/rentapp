
import type { FC, ReactNode } from 'react';

export const PageHeader: FC<PageHeaderProps> = ({ title, description, children }) => {
  return (
    <div className="mb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div className="flex-1 space-y-0">
        <h1 className="text-lg md:text-xl font-bold tracking-tight font-headline">{title}</h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};
