
'use client';

import { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';

export function UnloadingReceipt({ record, customer, warehouseInfo }: { record: UnloadingRecord, customer: Customer, warehouseInfo: WarehouseInfo | null }) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [formattedDate, setFormattedDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (record && record.unloadingDate) {
            const unloadingDate = toDate(record.unloadingDate);
            setFormattedDate(format(unloadingDate, 'dd/MM/yy'));
        }
    }, [record]);

    const handleDownloadPdf = async () => {
        const element = receiptRef.current;
        if (!element) return;

        setIsGenerating(true);

        try {
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#ffffff',
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });
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
            pdf.save(`unloading-bill-${record.billNo}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!record || !customer) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
                <p>Loading receipt...</p>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
            <div ref={receiptRef} className="printable-area bg-white p-6 border-2 border-blue-800 font-sans text-sm" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <div className="text-center mb-4">
                    <div className="text-xs">Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</div>
                    <h1 className="text-2xl font-bold text-blue-900">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                    {warehouseInfo?.ownerName && <p className="text-xs">Prop: {warehouseInfo.ownerName}</p>}
                    <p className="text-xs">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                    <p className="text-xs">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'}</p>
                </div>
                
                <h2 className="font-bold underline text-center">UNLOADING BILL</h2>
                
                <div className="flex justify-between items-baseline my-4">
                    <div><span className="font-bold">Bill No.</span> {record.billNo}</div>
                    <div><span className="font-bold">Date:</span> {formattedDate}</div>
                </div>

                <div className="space-y-2 mb-4">
                    <div className="flex"><span className="w-1/3 font-bold">CUSTOMER</span><span>: {customer.name}</span></div>
                    {customer.fatherName && <div className="flex"><span className="w-1/3 font-bold">FATHER'S NAME</span><span>: {customer.fatherName}</span></div>}
                    <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                    <div className="flex"><span className="w-1/3 font-bold">LORRY/TRACTOR No.</span><span>: {record.lorryTractorNo || 'N/A'}</span></div>
                    <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-black">Description</TableHead>
                            <TableHead className="text-center text-black">Bags</TableHead>
                            <TableHead className="text-center text-black">Rate</TableHead>
                            <TableHead className="text-right text-black">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Hamali Charges</TableCell>
                            <TableCell className="text-center">{record.bagsUnloaded}</TableCell>
                            <TableCell className="text-center font-mono">{formatCurrency(record.hamaliPerBag)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.totalHamali)}</TableCell>
                        </TableRow>
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="text-right font-bold">Total Hamali</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatCurrency(record.totalHamali)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
                
                <div className="mt-20 pt-10 flex justify-between text-center">
                    <div className="w-1/2">
                        <div className="mt-16 border-t border-gray-400 mx-4 pt-2">Manager Signature</div>
                    </div>
                    <div className="w-1/2">
                        <div className="mt-16 border-t border-gray-400 mx-4 pt-2">Customer Signature</div>
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
