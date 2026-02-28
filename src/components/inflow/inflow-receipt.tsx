
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Separator } from '@/components/ui/separator';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
import { Button } from '../ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';


export function InflowReceipt({ record, customer, warehouseInfo }: { record: StorageRecord, customer: Customer, warehouseInfo: WarehouseInfo | null }) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [formattedDate, setFormattedDate] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [dryingDays, setDryingDays] = useState<number | null>(null);

    const handleDownloadPdf = useCallback(async () => {
        const element = receiptRef.current;
        if (!element || isGenerating) return;

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
            pdf.save(`receipt-${record.id}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    }, [isGenerating, record]);
    
    useEffect(() => {
        if (record && record.storageStartDate) {
            const startDate = toDate(record.storageStartDate);
            setFormattedDate(format(startDate, 'dd/MM/yy'));
        }
        if (record?.inflowType === 'Plot' && record.dryingStartDate && record.dryingEndDate) {
            const start = toDate(record.dryingStartDate);
            const end = toDate(record.dryingEndDate);
            if (end >= start) {
                setDryingDays(differenceInDays(end, start) + 1);
            }
        }
    }, [record]);


    if (!record || !customer) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
                <p>Loading receipt...</p>
            </div>
        );
    }
    
    const downloadButton = (
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
    );

    if (record.inflowType === 'Plot') {
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

                    <h2 className="font-bold underline text-center">INFLOW BILL (FROM PLOT)</h2>
                    
                    <div className="flex justify-between items-baseline my-4">
                        <div><span className="font-bold">Serial No.</span> {record.id}</div>
                        <div><span className="font-bold">Date:</span> {formattedDate}</div>
                    </div>

                    <div className="space-y-2 mb-4">
                        <div className="flex"><span className="w-1/3 font-bold">CUSTOMER</span><span>: {customer.name}</span></div>
                        {customer.fatherName && <div className="flex"><span className="w-1/3 font-bold">FATHER'S NAME</span><span>: {customer.fatherName}</span></div>}
                        <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                        <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
                        <div className="flex"><span className="w-1/3 font-bold">DRYING DAYS</span><span>: {dryingDays ?? 'N/A'} days</span></div>
                        <div className="flex"><span className="w-1/3 font-bold">LOT No.</span><span>: {record.location}</span></div>
                    </div>

                    <div className="mb-4 p-4 bg-gray-100 rounded-lg text-black">
                        <h3 className="text-xs font-bold mb-2">STOCK SUMMARY</h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-xs">Bags for Plot</p>
                                <p className="font-bold">{record.bagsForDrying || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs">Bags Packed (Stock)</p>
                                <p className="font-bold">{record.bagsIn}</p>
                            </div>
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-black">Description</TableHead>
                                <TableHead className="text-center text-black">Calculation</TableHead>
                                <TableHead className="text-right text-black">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {record.hamaliDetails && record.hamaliDetails.length > 0 ? (
                                record.hamaliDetails.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell className="text-center font-mono text-xs">{`${item.bags} bags x ${formatCurrency(item.rate)}`}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2}>Total Hamali Charges</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(record.hamaliPayable)}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="text-right font-bold">Total Hamali</TableCell>
                                <TableCell className="text-right font-bold font-mono">{formatCurrency(record.hamaliPayable)}</TableCell>
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
                {downloadButton}
            </div>
        );
    }

    // Original Godown Receipt for Direct inflow
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
                           <span>: {record.bagsIn || 0}</span>
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
            {downloadButton}
        </div>
    );
}
