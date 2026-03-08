
import type { FC, ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export const PageHeader: FC<PageHeaderProps> = ({ title, description, children }) => {
  return (
    <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};
