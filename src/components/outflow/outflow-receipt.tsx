
'use client';

import { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Separator } from '@/components/ui/separator';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Button } from '../ui/button';
import { Download, Loader2 } from 'lucide-react';
import { calculateFinalRent } from '@/lib/billing';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';


type OutflowReceiptProps = {
  record: StorageRecord;
  customer: Customer;
  withdrawnBags: number;
  finalRent: number;
  paidNow: number;
  discount: number;
};

export function OutflowReceipt({ record, customer, withdrawnBags, finalRent, paidNow, discount }: OutflowReceiptProps) {
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
        setFormattedEndDate(format(endDate, 'dd MMM yyyy, hh:mm a'));

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

        // Calculate hamali pending.
        // This is the total hamali payable on the record minus all payments specifically for hamali.
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
        <div className="max-w-3xl mx-auto bg-background p-4 sm:p-6 rounded-lg">
            <div ref={receiptRef} className="printable-area bg-white p-6 sm:p-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">Srilakshmi Warehouse</h1>
                        <p className="text-sm text-muted-foreground">Your Company Address, City, State, ZIP</p>
                        <p className="text-sm text-muted-foreground">contact@yourwarehouse.com | (123) 456-7890</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-semibold uppercase text-muted-foreground">Outflow Bill</h2>
                        <p className="text-sm"><span className="font-medium">Bill #</span>: {record.id}</p>
                        <p className="text-sm"><span className="font-medium">Serial No:</span> {record.id}</p>
                        <p className="text-sm"><span className="font-medium">Date:</span> {formattedEndDate}</p>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">BILL TO</h3>
                        <p className="font-medium text-lg">{customer.name}</p>
                        {customer.village && <p>{customer.village}</p>}
                        <p>Phone: {customer.phone}</p>
                    </div>
                     <div>
                        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">WITHDRAWAL DETAILS</h3>
                        <p><span className="font-medium">Commodity:</span> {record.commodityDescription}</p>
                        <p><span className="font-medium">Date In:</span> {formattedStartDate}</p>
                        <p><span className="font-medium">Storage Duration:</span> {duration.months} months ({duration.days} days)</p>
                    </div>
                </div>

                {/* Storage Summary */}
                <div className="mb-8 p-4 bg-secondary/30 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground">STORAGE SUMMARY</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-muted-foreground">Bags Before</p>
                            <p className="text-lg font-bold">{(record.bagsStored || 0) + withdrawnBags}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Bags Withdrawn</p>
                            <p className="text-lg font-bold text-destructive">-{withdrawnBags}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Bags Remaining</p>
                            <p className="text-lg font-bold text-green-600">{record.bagsStored}</p>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50%]">Description</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>Rent</TableCell>
                                <TableCell>{withdrawnBags} bags</TableCell>
                                <TableCell>{formatCurrency(rentBreakdown.rentPerBag)} / bag</TableCell>
                                <TableCell className="text-right">{formatCurrency(finalRent)}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell>Pending Hamali Charges</TableCell>
                                <TableCell> - </TableCell>
                                <TableCell> - </TableCell>
                                <TableCell className="text-right">{formatCurrency(hamaliPending)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                 {/* Totals Section */}
                <div className="flex justify-end mb-8">
                    <div className="w-full max-w-sm space-y-2 text-sm">
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                             <div className="flex justify-between text-green-600">
                                <span className="text-muted-foreground">Discount</span>
                                <span>- {formatCurrency(discount)}</span>
                            </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-base">
                            <span>Total Due</span>
                            <span>{formatCurrency(totalPayable)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount Paid Now</span>
                            <span>{formatCurrency(paidNow)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg text-destructive">
                            <span>Balance Due</span>
                            <span>{formatCurrency(balanceDue)}</span>
                        </div>
                    </div>
                </div>

                <Separator className="my-8"/>

                {/* Footer */}
                <div className="text-xs text-muted-foreground">
                    <h4 className="font-semibold mb-2">Notes & Terms</h4>
                    <p>
                        This bill reflects the final settlement for the withdrawal of goods.
                    </p>
                    <p className="mt-4 text-center font-semibold">Thank you for your business!</p>
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
