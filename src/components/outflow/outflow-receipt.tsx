
'use client';

import { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Separator } from '@/components/ui/separator';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Button } from '../ui/button';
import { Download, Loader2 } from 'lucide-react';
import { calculateFinalRent } from '@/lib/billing';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';


type OutflowReceiptProps = {
  record: StorageRecord;
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  withdrawnBags: number;
  finalRent: number;
  paidNow: number;
  discount: number;
};

export function OutflowReceipt({ record, customer, warehouseInfo, withdrawnBags, finalRent, paidNow, discount }: OutflowReceiptProps) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [formattedStartDate, setFormattedStartDate] = useState('');
    const [formattedEndDate, setFormattedEndDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [duration, setDuration] = useState({ days: 0, months: 0 });
    const [rentBreakdown, setRentBreakdown] = useState({ rentPerBag: 0 });
    const [hamaliPending, setHamaliPending] = useState(0);

    useEffect(() => {
        if (!record) return;
        const startDate = toDate(record.storageStartDate);
        const endDate = record.storageEndDate ? toDate(record.storageEndDate) : new Date();
        
        setFormattedStartDate(format(startDate, 'dd MMM yyyy'));
        setFormattedEndDate(format(endDate, 'dd/MM/yy, hh:mm a'));

        setDuration({
            days: differenceInDays(endDate, startDate),
            months: differenceInMonths(endDate, startDate) || 1
        });

        const safeRecord = {
            ...record,
            storageStartDate: startDate,
        }

        const { rentPerBag } = calculateFinalRent(safeRecord, endDate, withdrawnBags);
        setRentBreakdown({ rentPerBag });

        const originalHamaliPayable = record.hamaliPayable || 0;
        const hamaliPaid = (record.payments || [])
            .filter(p => p.type === 'hamali')
            .reduce((acc, p) => acc + p.amount, 0);
        
        const pending = originalHamaliPayable - hamaliPaid;
        setHamaliPending(pending > 0 ? pending : 0);
        
    }, [record, withdrawnBags]);

    const subtotal = finalRent + hamaliPending;
    const totalPayable = subtotal - discount;
    const balanceDue = totalPayable - paidNow;

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
            pdf.save(`outflow-bill-${record.id}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!record) {
        return <div className="max-w-3xl mx-auto">Loading receipt...</div>;
    }

    return (
        <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
             <div ref={receiptRef} className="printable-area bg-white p-4 border-2 border-blue-800 font-sans text-xs" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <div className="text-center mb-2">
                    <div className="text-xs">Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</div>
                    <h1 className="text-xl font-bold text-blue-900">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                    {warehouseInfo?.ownerName && <p className="text-xs">Prop: {warehouseInfo.ownerName}</p>}
                    <p className="text-xs">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                    <p className="text-xs">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'}</p>
                </div>
                
                <h2 className="font-bold underline text-center">OUTFLOW BILL</h2>

                <div className="flex justify-between items-baseline my-2">
                    <div><span className="font-bold">Bill No.</span> {record.id}</div>
                    <div><span className="font-bold">Date:</span> {formattedEndDate}</div>
                </div>

                <div className="space-y-1 mb-2">
                    <div className="flex"><span className="w-1/3 font-bold">CUSTOMER</span><span>: {customer.name}</span></div>
                    {customer.fatherName && <div className="flex"><span className="w-1/3 font-bold">FATHER'S NAME</span><span>: {customer.fatherName}</span></div>}
                    <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                    <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
                    <div className="flex"><span className="w-1/3 font-bold">LOT No.</span><span>: {record.location}</span></div>
                    <div className="flex"><span className="w-1/3 font-bold">STORAGE DURATION</span><span>: {duration.months} months ({duration.days} days)</span></div>
                </div>

                <div className="mb-2 p-2 bg-gray-100 rounded-lg text-black">
                    <h3 className="text-xs font-bold mb-1">STOCK SUMMARY</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs">Bags Before</p>
                            <p className="font-bold">{(record.bagsStored || 0) + withdrawnBags}</p>
                        </div>
                        <div>
                            <p className="text-xs">Bags Withdrawn</p>
                            <p className="font-bold">-{withdrawnBags}</p>
                        </div>
                        <div>
                            <p className="text-xs">Bags Remaining</p>
                            <p className="font-bold">{record.bagsStored}</p>
                        </div>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50%] text-black">Description</TableHead>
                            <TableHead className="text-black">Quantity</TableHead>
                            <TableHead className="text-black">Rate</TableHead>
                            <TableHead className="text-right text-black">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Rent</TableCell>
                            <TableCell>{withdrawnBags} bags</TableCell>
                            <TableCell>{formatCurrency(rentBreakdown.rentPerBag)} / bag</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(finalRent)}</TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell>Pending Hamali Charges</TableCell>
                            <TableCell> - </TableCell>
                            <TableCell> - </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(hamaliPending)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <div className="flex justify-end mt-2">
                    <div className="w-full max-w-xs space-y-1">
                         <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span className="font-mono">{formatCurrency(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                             <div className="flex justify-between">
                                <span>Discount</span>
                                <span className="font-mono text-green-600">- {formatCurrency(discount)}</span>
                            </div>
                        )}
                        <Separator className="bg-gray-400" />
                        <div className="flex justify-between font-bold">
                            <span>Total Due</span>
                            <span className="font-mono">{formatCurrency(totalPayable)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Amount Paid</span>
                            <span className="font-mono">{formatCurrency(paidNow)}</span>
                        </div>
                        <Separator className="bg-gray-400" />
                        <div className="flex justify-between font-bold text-sm">
                            <span>Balance Due</span>
                            <span className="font-mono">{formatCurrency(balanceDue)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-16 pt-8 flex justify-between text-center">
                    <div className="w-1/2">
                        <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Manager Signature</div>
                    </div>
                    <div className="w-1/2">
                        <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Customer Signature</div>
                    </div>
                </div>
                 <div className="text-xs mt-2 pt-2 text-center">
                    <p>This bill reflects the final settlement for the withdrawal of goods.</p>
                    <p className="mt-1 font-semibold">Thank you for your business!</p>
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
