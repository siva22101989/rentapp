
'use client';

import { Download, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { EditStorageDialog } from "./edit-storage-dialog";
import { BillReceiptDialog } from "./bill-receipt-dialog";
import { toDate } from "@/lib/utils";
import { DeleteRecordDialog } from "./delete-record-dialog";

export function ActionsMenu({ record, customers, allRecords }: { record: StorageRecord, customers: Customer[], allRecords: StorageRecord[] }) {
    const customer = customers.find(c => c.id === record.customerId);

    // Ensure record dates are Date objects before passing to children
    const safeRecord = {
        ...record,
        storageStartDate: toDate(record.storageStartDate),
        storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null,
        payments: (record.payments || []).map(p => ({...p, date: toDate(p.date)}))
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <EditStorageDialog record={safeRecord} customers={customers} allRecords={allRecords}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </EditStorageDialog>
                {customer && (
                    <BillReceiptDialog record={safeRecord} customer={customer}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Bill
                        </DropdownMenuItem>
                    </BillReceiptDialog>
                )}
                <DropdownMenuSeparator />
                <DeleteRecordDialog recordId={safeRecord.id}>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DeleteRecordDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
