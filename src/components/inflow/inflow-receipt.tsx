
'use client';

import { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Separator } from '@/components/ui/separator';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toDate } from '@/lib/utils';

export function InflowReceipt({ record, customer }: { record: StorageRecord, customer: Customer }) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [formattedDate, setFormattedDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const startDate = toDate(record.storageStartDate);
        setFormattedDate(format(startDate, 'dd/MM/yy'));
    }, [record.storageStartDate]);

    const handleDownloadPdf = async () => {
        const element = receiptRef.current;
        if (!element) return;

        setIsGenerating(true);

        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight;
            let widthInPdf = pdfWidth - 20;
            let heightInPdf = widthInPdf / ratio;

            if (heightInPdf > pdfHeight - 20) {
                heightInPdf = pdfHeight - 20;
                widthInPdf = heightInPdf * ratio;
            }

            const x = (pdfWidth - widthInPdf) / 2;
            const y = 10;

            pdf.addImage(imgData, 'PNG', x, y, widthInPdf, heightInPdf);
            pdf.save(`receipt-${record.id}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const bagsToShow = record.inflowType === 'Plot' ? record.loadBags : record.bagsStored;

    return (
        <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
            <div ref={receiptRef} className="printable-area bg-white p-6 border-2 border-blue-800 font-sans text-sm" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <div className="text-center mb-4">
                    <div className="text-xs">Cell: 9703503423, 9160606633</div>
                    <h1 className="text-2xl font-bold text-blue-900">SRI LAKSHMI WAREHOUSE</h1>
                    <p className="text-xs">Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,</p>
                    <p className="text-xs">Owk (M), Kurnool (Dt.), A.P.</p>
                </div>
                
                <div className="flex justify-between items-center mb-2">
                    <h2 className="font-bold underline">GODOWN RECEIPT</h2>
                </div>

                <div className="flex justify-between items-baseline mb-4">
                    <div><span className="font-bold">Serial No.</span> {record.id}</div>
                    <div><span className="font-bold">Date:</span> {formattedDate}</div>
                </div>

                <div className="space-y-2">
                    <div className="flex">
                        <span className="w-1/3 font-bold">LORRY / TRACTOR No.</span>
                        <span>: {record.lorryTractorNo || 'N/A'}</span>
                    </div>
                    <div className="flex">
                        <span className="w-1/3 font-bold">NAME OF THE FARMER</span>
                        <span>: {customer.name}</span>
                    </div>
                    {customer.fatherName && (
                        <div className="flex">
                            <span className="w-1/3 font-bold">FATHER'S NAME</span>
                            <span>: {customer.fatherName}</span>
                        </div>
                    )}
                    <div className="flex">
                        <span className="w-1/3 font-bold">VILLAGE</span>
                        <span>: {customer.village || 'N/A'}</span>
                    </div>
                    <div className="flex">
                        <span className="w-1/3 font-bold">PRODUCT</span>
                        <span>: {record.commodityDescription}</span>
                    </div>
                    <div className="flex">
                        <span className="w-1/3 font-bold">No. OF BAGS</span>
                        <div className="flex-1 flex justify-between">
                           <span>: {bagsToShow}</span>
                           <div><span className="font-bold">WEIGHT :</span> {record.weight ? `${record.weight} kgs` : '____'}</div>
                        </div>
                    </div>
                    <div className="flex">
                        <span className="w-1/3 font-bold">LOT No.</span>
                        <span>: {record.location}</span>
                    </div>
                     <div className="flex">
                        <span className="w-1/3 font-bold">WAREHOUSE RECEIPT No.</span>
                        <span>: {record.id}</span>
                    </div>
                </div>

                <div className="mt-20 flex justify-between text-center">
                    <div className="w-1/2">
                        <div className="font-bold">STOCK RECEIVED</div>
                         <div className="mt-12 border-t border-gray-400 mx-4">GODOWN INCHARGE SIGNATURE</div>
                    </div>
                    <div className="w-1/2">
                         <div className="mt-16 border-t border-gray-400 mx-4">FARMER / AGENT SIGNATURE</div>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-center print-hide">
                <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                    {isGenerating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Downloading...
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
