import Link from 'next/link';
import { Wheat } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-3" aria-label="Back to homepage">
      <div className="bg-logo text-logo-foreground p-2 rounded-lg shadow-md shadow-logo/20">
        <Wheat size={24} />
      </div>
      <span className="hidden sm:inline font-headline font-semibold text-lg text-logo">GrainDost</span>
    </div>
  );
}
