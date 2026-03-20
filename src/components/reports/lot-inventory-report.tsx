
'use client';

import React, { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

type LotInventoryReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

type GroupedLots = {
    [key: string]: {
        records: StorageRecord[];
        totalBags: number;
    }
}

function LotInventoryTable({ groupedLots, customers, title }: { groupedLots: GroupedLots, customers: Customer[], title: string }) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const lotNames = Object.keys(groupedLots).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    
    if (lotNames.length === 0) {
        return (
             <div className="bg-white p-4 rounded-lg">
                <div className="mb-4">
                    <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
                    <p className="text-muted-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
                </div>
                <div className="text-center py-8 text-muted-foreground">
                    No active stock found in any lots.
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-4 rounded-lg">
            <div className="mb-4">
                <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px]">Lot No.</TableHead>
                        <TableHead>Patti No.</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Inflow Date</TableHead>
                        <TableHead className="text-right">Bags</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lotNames.map(lotName => (
                        <React.Fragment key={lotName}>
                            <TableRow className="bg-secondary hover:bg-secondary">
                                <TableCell colSpan={5} className="font-bold">{lotName || 'Unassigned'}</TableCell>
                                <TableCell className="text-right font-bold font-mono">{groupedLots[lotName].totalBags}</TableCell>
                            </TableRow>
                            {groupedLots[lotName].records.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell></TableCell>
                                    <TableCell>{record.id}</TableCell>
                                    <TableCell>{getCustomerName(record.customerId)}</TableCell>
                                    <TableCell>{record.commodityDescription}</TableCell>
                                    <TableCell>{format(toDate(record.storageStartDate), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="text-right font-mono">{record.bagsStored}</TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}


export function LotInventoryReport({ records, customers }: LotInventoryReportProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const groupedLots = useMemo(() => {
        const activeRecords = records.filter(r => r.storageEndDate === null && r.bagsStored > 0);
        
        const lots: GroupedLots = activeRecords.reduce((acc, record) => {
            const lotKey = record.location || 'Unassigned';
            if (!acc[lotKey]) {
                acc[lotKey] = { records: [], totalBags: 0 };
            }
            acc[lotKey].records.push(record);
            acc[lotKey].totalBags += record.bagsStored;
            return acc;
        }, {} as GroupedLots);

        // Sort records within each lot by customer name
        for (const lotKey in lots) {
            const customerMap = new Map(customers.map(c => [c.id, c.name]));
            lots[lotKey].records.sort((a, b) => {
                const nameA = customerMap.get(a.customerId) || '';
                const nameB = customerMap.get(b.customerId) || '';
                return nameA.localeCompare(nameB);
            });
        }

        return lots;
    }, [records, customers]);

    const handleDownloadPdf = async () => {
        const element = reportRef.current;
        if (!element) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const ratio = pdfWidth / imgWidth;
            const canvasHeight = imgHeight * ratio;

            let position = 0;
            let heightLeft = canvasHeight;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = position - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
                heightLeft -= pdfHeight;
            }
            pdf.save(`lot-inventory-report-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const title = `Lot-wise Inventory Report`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Lot Inventory Report</CardTitle>
                    <CardDescription>A summary of active stock present in each lot.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button>
                                <FileText className="mr-2 h-4 w-4" />
                                Generate Report
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>{title}</DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-y-auto">
                                <div ref={reportRef}>
                                    <LotInventoryTable 
                                        groupedLots={groupedLots} 
                                        customers={customers}
                                        title={title}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => window.print()}>Print</Button>
                                <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Save as PDF
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-16">
                    <FileText className="mx-auto h-12 w-12" />
                    <p className="mt-4">
                        Click "Generate Report" to view the lot inventory.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
