
import Link from 'next/link';
import { Package } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-3" aria-label="Back to homepage">
      <div className="bg-primary text-primary-foreground p-2 rounded-lg shadow-md shadow-primary/20">
        <Package size={24} />
      </div>
      <span className="hidden sm:inline font-headline font-semibold text-lg text-primary">GrainDost</span>
    </div>
  );
}
