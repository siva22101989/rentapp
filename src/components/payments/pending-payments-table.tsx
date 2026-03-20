
'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useRef, useState } from "react";
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog";
import { formatCurrency } from "@/lib/utils";
import { Button } from "../ui/button";
import { Download, Loader2, FileText } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { AddUnloadingPaymentDialog } from "../unloading/add-unloading-payment-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type PendingRecord = (StorageRecord | UnloadingRecord) & {
    recordType: 'storage' | 'unloading';
    totalBilled: number;
    amountPaid: number;
    balanceDue: number;
    hamaliPending: number;
    rentPending: number;
};

export function PendingPaymentsTable({ records, customers, unloadingRecords }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[] }) {

    const [isGenerating, setIsGenerating] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const pendingRecords = useMemo(() => {
        if (!records || !unloadingRecords) return [];
        
        const storageRecordDues = records.map(record => {
            const hamaliPayable = record.hamaliPayable || 0;
            const totalRentBilled = record.totalRentBilled || 0;

            const hamaliPaid = (record.payments || [])
                .filter(p => p.type === 'hamali')
                .reduce((acc, p) => acc + p.amount, 0);

            const rentPaid = (record.payments || [])
                .filter(p => p.type === 'rent')
                .reduce((acc, p) => acc + p.amount, 0);
            
            const otherPaid = (record.payments || [])
                .filter(p => p.type === 'other' || !p.type || p.type === 'discount')
                .reduce((acc, p) => acc + p.amount, 0);

            const hamaliPending = hamaliPayable - hamaliPaid;
            const rentPending = totalRentBilled - rentPaid - otherPaid;
            
            const totalBilled = hamaliPayable + totalRentBilled;
            const amountPaid = hamaliPaid + rentPaid + otherPaid;
            const balanceDue = totalBilled - amountPaid;

            return { 
                ...record, 
                totalBilled, 
                amountPaid, 
                balanceDue,
                hamaliPending: Math.max(0, hamaliPending),
                rentPending: Math.max(0, rentPending),
                recordType: 'storage' as const
            };
        });

        const unloadingRecordDues = unloadingRecords.map(record => {
            const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const totalBilled = record.totalHamali || 0;
            const balanceDue = totalBilled - totalPaid;
            
            return {
                ...record,
                totalBilled,
                amountPaid: totalPaid,
                balanceDue,
                hamaliPending: Math.max(0, balanceDue),
                rentPending: 0,
                recordType: 'unloading' as const,
            };
        });
        
        const allDues: PendingRecord[] = [...storageRecordDues, ...unloadingRecordDues];

        return allDues.filter(record => record.balanceDue > 0.5); // Use a small buffer for floating point issues
    }, [records, unloadingRecords]);
    
    const getCustomerName = (customerId: string) => {
        return customers?.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

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
                orientation: 'l',
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
            
            pdf.save(`pending-dues-report-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

  return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Outstanding Balances</CardTitle>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button size="sm" disabled={pendingRecords.length === 0}>
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Report
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl">
                        <DialogHeader>
                            <DialogTitle>Pending Dues Report</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[70vh] overflow-y-auto">
                            <div ref={reportRef} className="printable-area">
                                <PendingDuesReportTable
                                    records={pendingRecords as any[]}
                                    customers={customers}
                                    title="Pending Dues Report"
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
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Record ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="hidden sm:table-cell">Status</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Bags</TableHead>
                            <TableHead className="text-right hidden lg:table-cell">Total Billed</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Hamali Pending</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Rent Pending</TableHead>
                            <TableHead className="text-right">Total Due</TableHead>
                            <TableHead className="w-[100px] text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pendingRecords.map((record) => {
                            const customerName = getCustomerName(record.customerId);
                            const recordId = record.recordType === 'storage' ? record.id : (record as UnloadingRecord).billNo || record.id;
                            const status = record.recordType === 'storage' 
                                ? ((record as StorageRecord).storageEndDate ? 'Completed' : 'Active') 
                                : `Unloading Bill`;

                            const bags = record.recordType === 'storage' ? (record as StorageRecord).bagsIn : (record as UnloadingRecord).bagsUnloaded;

                            return (
                            <TableRow key={`${record.recordType}-${record.id}`}>
                                <TableCell className="font-medium">{recordId}</TableCell>
                                <TableCell>{customerName}</TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <Badge variant={status === 'Active' ? "default" : "secondary"} className={status === 'Active' ? 'bg-green-100 text-green-800' : ''}>
                                        {status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono hidden md:table-cell">{bags || 0}</TableCell>
                                <TableCell className="text-right font-mono hidden lg:table-cell">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="text-right font-mono text-orange-600 hidden md:table-cell">{formatCurrency(record.hamaliPending)}</TableCell>
                                <TableCell className="text-right font-mono text-blue-600 hidden md:table-cell">{formatCurrency(record.rentPending)}</TableCell>
                                <TableCell className="text-right font-mono text-destructive">{formatCurrency(record.balanceDue)}</TableCell>
                                <TableCell className="text-right">
                                    {record.recordType === 'storage' ? (
                                        <AddPaymentDialog record={record as any} />
                                     ) : (
                                         <AddUnloadingPaymentDialog record={record as any}>
                                            <Button size="sm">Add Payment</Button>
                                        </AddUnloadingPaymentDialog>
                                     )}
                                </TableCell>
                            </TableRow>
                        )})}
                         {pendingRecords.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center text-muted-foreground">
                                    No outstanding balances found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
  );
}
