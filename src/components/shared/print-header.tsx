'use client';

import { Printer, FileDown, Loader2, MonitorPlay, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PrintHeader({ title, filename = 'document.pdf' }: { title: string, filename?: string }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

    useEffect(() => {
        // Apply orientation class to body for global CSS selectors
        document.body.classList.remove('portrait', 'landscape');
        document.body.classList.add(orientation);
        return () => document.body.classList.remove('portrait', 'landscape');
    }, [orientation]);

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
                orientation: orientation === 'portrait' ? 'p' : 'l',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = orientation === 'portrait' ? 190 : 277;

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
                width: pdfWidth,
                windowWidth: orientation === 'portrait' ? 800 : 1200 // Virtual browser width for rendering
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
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">A4 Print Control Console</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <span className="text-[10px] font-black uppercase px-2 text-slate-500">Page:</span>
                    <Tabs value={orientation} onValueChange={(v) => setOrientation(v as any)}>
                        <TabsList className="h-8 p-0 bg-transparent">
                            <TabsTrigger value="portrait" className="h-7 text-[10px] uppercase font-bold px-3">
                                Portrait
                            </TabsTrigger>
                            <TabsTrigger value="landscape" className="h-7 text-[10px] uppercase font-bold px-3">
                                Landscape
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="default" onClick={handlePrint} disabled={isDownloading} className="font-bold h-9 text-xs uppercase tracking-wider px-4">
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    <Button variant="outline" onClick={handleDownload} disabled={isDownloading} className="font-bold h-9 text-xs uppercase tracking-wider px-4">
                        {isDownloading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Save PDF
                    </Button>
                </div>
            </div>
        </div>
    );
}