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
            
            // Hardcoded Landscape only for A4
            const pdf = new jsPDF({
                orientation: 'l',
                unit: 'mm',
                format: 'a4',
            });

            // Landscape virtual dimensions
            const pdfWidth = 277;
            const virtualWidth = 1440;

            await pdf.html(printableArea, {
                html2canvas: {
                    scale: 1,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    height: printableArea.scrollHeight,
                    windowHeight: printableArea.scrollHeight,
                },
                margin: [10, 10, 10, 10],
                autoPaging: 'text',
                width: pdfWidth,
                windowWidth: virtualWidth 
            });
            
            pdf.save(filename);

        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="p-4 bg-white border-b flex flex-col md:flex-row items-center justify-between sticky top-0 z-10 print-hide shadow-sm gap-4">
            <div className="flex flex-col gap-1 text-center md:text-left">
                <h1 className="text-lg font-bold tracking-tight">{title}</h1>
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Landscape Audit Control Console</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                    <Button variant="default" onClick={handlePrint} disabled={isDownloading} className="font-bold h-9 text-xs uppercase tracking-wider px-4">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Landscape
                    </Button>
                    <Button variant="outline" onClick={handleDownload} disabled={isDownloading} className="font-bold h-9 text-xs uppercase tracking-wider px-4">
                        {isDownloading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Save PDF (Wide)
                    </Button>
                </div>
            </div>
        </div>
    );
}