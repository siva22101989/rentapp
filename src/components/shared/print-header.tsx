
'use client';

import { Printer, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintHeader({ title }: { title: string }) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-4 bg-gray-100 border-b flex items-center justify-between sticky top-0 z-10 print-hide">
            <h1 className="text-lg font-semibold">{title}</h1>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
                 <Button onClick={handlePrint}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Save as PDF
                </Button>
            </div>
        </div>
    );
}
