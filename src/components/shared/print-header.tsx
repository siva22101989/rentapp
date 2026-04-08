
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
            const { default: html2canvas } = await import('html2canvas');

            const canvas = await html2canvas(printableArea, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowHeight: printableArea.scrollHeight,
                windowWidth: printableArea.scrollWidth,
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();
            
            const imgHeight = imgProps.height;
            const imgWidth = imgProps.width;
            
            const ratio = imgWidth / pdfWidth;
            const totalPdfHeight = imgHeight / ratio;

            let position = 0;
            let heightLeft = totalPdfHeight;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeight);
            heightLeft -= pdfPageHeight;

            while (heightLeft > 0) {
                position -= pdfPageHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeight);
                heightLeft -= pdfPageHeight;
            }

            pdf.save(filename);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
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
