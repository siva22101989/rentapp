
'use client';

import { Printer, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function PrintHeader({ title, filename = 'document.pdf' }: { title: string, filename?: string }) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        const printableArea = document.querySelector<HTMLElement>('.printable-area');
        if (!printableArea) {
            console.error("Printable area not found!");
            return;
        }

        setIsDownloading(true);

        try {
            const { default: jsPDF } = await import('jspdf');
            
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            await pdf.html(printableArea, {
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    height: printableArea.scrollHeight,
                    windowHeight: printableArea.scrollHeight,
                },
                margin: [10, 10, 10, 10],
                autoPaging: 'text',
                width: 190, // A4 width (210mm) - 2*10mm margin
                windowWidth: printableArea.scrollWidth
            });
            
            pdf.save(filename);

        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsDownloading(false);
        }
    };


    return (
        <div className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10 print-hide shadow-sm">
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
            <div className="flex items-center gap-2">
                <Button variant="default" onClick={handlePrint} disabled={isDownloading} className="font-bold">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Bill
                </Button>
                 <Button variant="outline" onClick={handleDownload} disabled={isDownloading} className="font-bold">
                    {isDownloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Save PDF
                </Button>
            </div>
        </div>
    );
}
