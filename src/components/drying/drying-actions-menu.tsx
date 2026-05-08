'use client';

import { MoreHorizontal, FileCheck, Trash2, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/dropdown-menu";
import type { DryingRecord, UnloadingRecord, Lot, StorageRecord } from "@/lib/definitions";
import { EditDryingDialog } from "./manage-drying-charges-dialog";
import { BillProcessDialog } from "./bill-process-dialog";
import { DeleteDryingRecordDialog } from "./delete-drying-record-dialog";

export function DryingActionsMenu({ record, unloadingRecord, lots, storageRecords }: { record: DryingRecord, unloadingRecord?: UnloadingRecord, lots: Lot[], storageRecords: StorageRecord[] }) {

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <EditDryingDialog record={record} unloadingRecord={unloadingRecord}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit / Manage
                    </DropdownMenuItem>
                </EditDryingDialog>
                
                <BillProcessDialog record={record} unloadingRecord={unloadingRecord} lots={lots} storageRecords={storageRecords}>
                    <DropdownMenuItem 
                        onSelect={(e) => e.preventDefault()} 
                        disabled={record.status === 'Billed' || !record.packingDate}
                        className="text-green-600 focus:text-green-700"
                    >
                        <FileCheck className="mr-2 h-4 w-4" />
                        Bill & Create Inflow
                    </DropdownMenuItem>
                </BillProcessDialog>

                <DropdownMenuSeparator />
                
                <DeleteDryingRecordDialog recordId={record.id}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DeleteDryingRecordDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}