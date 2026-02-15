
'use client';

import { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
            <div ref={receiptRef} className="printable-area bg-white p-6 border border-primary">
                <Card className="w-full shadow-none border-0">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</CardTitle>
                        {warehouseInfo?.ownerName && <p className="text-sm text-muted-foreground">Prop: {warehouseInfo.ownerName}</p>}
                        <p className='text-sm text-muted-foreground'>{warehouseInfo?.phone || 'MOBILE NO 9160606633'}</p>
                        <CardDescription>Unloading Bill</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <h3 className="font-semibold mb-2">Customer Details</h3>
                                <p>{customer.name}</p>
                                {customer.fatherName && <p>S/o {customer.fatherName}</p>}
                                <p>{customer.village || customer.address}</p>
                                <p>Phone: {customer.phone}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">Billing Details</h3>
                                <p><span className="font-medium">Bill No:</span> {record.billNo}</p>
                                <p><span className="font-medium">Date:</span> {formattedDate}</p>
                                <p><span className="font-medium">Lorry/Tractor No:</span> {record.lorryTractorNo || 'N/A'}</p>
                                <p><span className="font-medium">Commodity:</span> {record.commodityDescription}</p>
                            </div>
                        </div>

                        <Separator />

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-center">Bags</TableHead>
                                    <TableHead className="text-center">Rate</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
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
                        
                        <div className="mt-20 pt-10 flex justify-between text-center text-sm">
                            <div className="w-1/2">
                                <div className="border-t border-gray-400 mx-4 pt-2">Manager Signature</div>
                            </div>
                            <div className="w-1/2">
                                <div className="border-t border-gray-400 mx-4 pt-2">Customer Signature</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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
