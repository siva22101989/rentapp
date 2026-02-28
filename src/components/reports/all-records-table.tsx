'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ActionsMenu } from "@/components/dashboard/actions-menu";
import { toDate } from "@/lib/utils";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useMemo } from "react";

export function AllRecordsTable({ allRecords, allCustomers }: { allRecords: StorageRecord[], allCustomers: Customer[] }) {

  const getCustomerName = (customerId: string) => {
    return allCustomers?.find(c => c.id === customerId)?.name ?? 'Unknown';
  };

  if (!allRecords || !allCustomers) {
    return <div>Loading table...</div>;
  }

  const sortedRecords = useMemo(() => {
    return [...allRecords].sort((a,b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime())
  }, [allRecords]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Commodity</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Balance Bags</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRecords.map((record) => {
            const customerName = getCustomerName(record.customerId);
            const startDate = toDate(record.storageStartDate);
            const endDate = record.storageEndDate ? toDate(record.storageEndDate) : null;
            
            return (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{customerName}</TableCell>
                <TableCell>{record.commodityDescription}</TableCell>
                <TableCell>{startDate ? format(startDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                <TableCell>{endDate ? format(endDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant={record.storageEndDate ? "secondary" : "default"} className={record.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                    {record.storageEndDate ? 'Completed' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-bold">{record.bagsStored}</TableCell>
                <TableCell>
                    <ActionsMenu record={record} customers={allCustomers} allRecords={allRecords} />
                </TableCell>
              </TableRow>
            )
        })}
      </TableBody>
    </Table>
  );
}
