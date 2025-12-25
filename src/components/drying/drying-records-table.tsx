
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Customer, DryingRecord } from "@/lib/definitions";
import { format } from 'date-fns';
import { formatCurrency, toDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusColors = {
    'Unloaded': 'bg-blue-100 text-blue-800',
    'Drying': 'bg-yellow-100 text-yellow-800',
    'Packed': 'bg-green-100 text-green-800',
    'Billed': 'bg-gray-100 text-gray-800',
};

export function DryingRecordsTable({ records, customers }: { records: DryingRecord[], customers: Customer[] }) {
    
    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name || 'Unknown';
    };

    if (records.length === 0) {
        return <p className="text-muted-foreground text-center">No drying records found.</p>
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Paddy Type</TableHead>
                    <TableHead>Unload Date</TableHead>
                    <TableHead className="text-right">Bags In</TableHead>
                    <TableHead className="text-right">Drying Hamali</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {records.map(record => (
                    <TableRow key={record.id}>
                        <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                        <TableCell>{record.paddyType}</TableCell>
                        <TableCell>{format(toDate(record.unloadingDate), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right">{record.unloadedBags}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.totalDryingHamali || 0)}</TableCell>
                        <TableCell>
                            <Badge className={statusColors[record.status]}>{record.status}</Badge>
                        </TableCell>
                        <TableCell>
                            {/* Actions menu will go here */}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
