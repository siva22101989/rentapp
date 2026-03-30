
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
        printableArea.classList.add('pdf-generating');

        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');

            const canvas = await html2canvas(printableArea, {
                scale: 2, // Higher scale for better quality
            });
            
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / pdfWidth;
            const imgHeight = canvasHeight / ratio;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(filename);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            printableArea.classList.remove('pdf-generating');
            setIsDownloading(false);
        }
    };


    return (
        <div className="p-4 bg-gray-100 border-b flex items-center justify-between sticky top-0 z-10 print-hide">
            <h1 className="text-lg font-semibold">{title}</h1>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePrint} disabled={isDownloading}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
                 <Button onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Download PDF
                </Button>
            </div>
        </div>
    );
}
