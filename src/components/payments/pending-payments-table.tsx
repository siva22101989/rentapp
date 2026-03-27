
'use client';
import { useMemo, useRef, useState } from "react";
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { Button } from "../ui/button";
import { Download, Loader2, Printer } from "lucide-react";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { printElement } from "@/lib/print-util";

type PendingRecord = (StorageRecord | UnloadingRecord) & {
    recordType: 'storage' | 'unloading';
    totalBilled: number;
    amountPaid: number;
    balanceDue: number;
    hamaliPending: number;
    rentPending: number;
};

export function PendingPaymentsTable({ records, customers, unloadingRecords }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[] }) {

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

    const handleGenerate = () => {
        const element = reportRef.current;
        if (!element) return;
        printElement(element, "Pending Dues Report");
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between print-hide">
                <CardTitle>Outstanding Balances</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleGenerate}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    <Button size="sm" onClick={handleGenerate}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={reportRef}>
                    <PendingDuesReportTable
                        records={pendingRecords as any[]}
                        customers={customers}
                        title="Pending Dues Report"
                    />
                </div>
            </CardContent>
        </Card>
  );
}
