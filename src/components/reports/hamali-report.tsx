
'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CustomerHamaliReportTable } from './customer-hamali-report-table';
import { WorkerHamaliReportTable } from './worker-hamali-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

export type CustomerHamaliEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'charge' | 'payment';
    bags?: number;
}
export type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    payable: number;
    paid: number;
    bags?: number;
}

export function HamaliReport({ records, customers, unloadingRecords, expenses }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[] }) {
    const [reportView, setReportView] = useState<'customer' | 'worker'>('customer');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const reportRef = useRef<HTMLDivElement>(null);
    const { dateRange } = useDateFilter();

    const customerHamaliEvents = useMemo(() => {
        const events: CustomerHamaliEvent[] = [];

        // --- CHARGES ---
        // From all storage records
        records.forEach(sr => {
            if (sr.hamaliPayable > 0) {
                 events.push({
                    date: toDate(sr.storageStartDate),
                    customerId: sr.customerId,
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
                });
            }
        });
        
        // From unloading records that have not been fully processed
        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0) {
                const remainingHamali = bagsRemaining * ur.hamaliPerBag;
                 if (remainingHamali > 0) {
                    events.push({
                        date: toDate(ur.unloadingDate),
                        customerId: ur.customerId,
                        description: 'Unloading Hamali (pending finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        amount: remainingHamali,
                        type: 'charge',
                        bags: bagsRemaining
                    });
                }
            }
        });

        // --- PAYMENTS ---
        records.forEach(sr => {
            (sr.payments || []).filter(p => p.type === 'hamali').forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: 'Payment (Storage)',
                    recordId: sr.id,
                    amount: payment.amount,
                    type: 'payment',
                });
            });
        });

        unloadingRecords.forEach(ur => {
            (ur.payments || []).forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: ur.customerId,
                    description: 'Payment (Unloading)',
                    recordId: ur.billNo || ur.id.substring(0,5),
                    amount: payment.amount,
                    type: 'payment',
                });
            });
        });
        
        let filteredEvents = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filteredEvents = filteredEvents.filter(e => e.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999);
            filteredEvents = filteredEvents.filter(e => e.date <= toDateObj);
        }

        return filteredEvents.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, selectedCustomerId, dateRange]);

    const workerHamaliEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        // 1. Payable from Storage Records
        records.forEach(sr => {
            if (sr.workerHamaliPayable && sr.workerHamaliPayable > 0) {
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    customerId: sr.customerId,
                    payable: sr.workerHamaliPayable,
                    paid: 0,
                    bags: sr.bagsIn,
                });
            }
        });

        // 2. Payable from Unloading Records (for bags not yet finalized into storage)
        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0 && ur.workerHamaliPayable) {
                const hamaliPerBag = ur.hamaliPerBag || 0; // or calculate from total
                const remainingPayable = bagsRemaining * hamaliPerBag;
                if (remainingPayable > 0) {
                    events.push({
                        date: toDate(ur.unloadingDate),
                        description: 'Unloading Hamali (Pending Finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        customerId: ur.customerId,
                        payable: remainingPayable,
                        paid: 0,
                        bags: bagsRemaining,
                    });
                }
            }
        });

        // 3. Paid amounts from Expenses
        expenses.filter(e => e.category === 'Hamali').forEach(exp => {
            events.push({
                date: toDate(exp.date),
                description: exp.description,
                recordId: exp.id.substring(0,5),
                payable: 0,
                paid: exp.amount,
            });
        });

        let filtered = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filtered = filtered.filter(e => e.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filtered = filtered.filter(e => e.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999);
            filtered = filtered.filter(e => e.date <= toDateObj);
        }

        return filtered.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, expenses, selectedCustomerId, dateRange]);


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
            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgProps= pdf.getImageProperties(imgData);
            const imgWidth = imgProps.width;
            const imgHeight = imgProps.height;

            const ratio = imgWidth / pdfWidth;
            const canvasHeight = imgHeight / ratio;
            
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
            
            pdf.save(`hamali-report-${reportView}-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Hamali ${reportView === 'customer' ? 'Customer' : 'Worker'} Ledger ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Dialog>
            <Card>
                <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle>Hamali Register</CardTitle>
                        <CardDescription>View ledgers for customer charges or worker payments.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                        <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker')} value={reportView}>
                            <SelectTrigger className='w-full sm:w-auto'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="customer">Customer Ledger</SelectItem>
                                <SelectItem value="worker">Worker Ledger</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                            <SelectTrigger className="w-full sm:w-auto">
                                <SelectValue placeholder="All Customers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Customers</SelectItem>
                                {customers.map(customer => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DialogTrigger asChild>
                            <Button>View Report</Button>
                        </DialogTrigger>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Select options and click "View Report" to generate a printable summary.</p>
                </CardContent>
            </Card>

            <DialogContent className="max-w-6xl p-0">
                <div ref={reportRef} className="p-4 max-h-[80vh] overflow-y-auto">
                    {reportView === 'customer' ? (
                         <CustomerHamaliReportTable 
                            events={customerHamaliEvents} 
                            customers={customers}
                            title={title}
                        />
                    ) : (
                        <WorkerHamaliReportTable 
                            events={workerHamaliEvents}
                            customers={customers}
                            title={title}
                        />
                    )}
                </div>
                <DialogFooter className="p-4 border-t">
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                    <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Print PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
