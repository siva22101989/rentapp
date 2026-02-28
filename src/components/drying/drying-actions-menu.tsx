
'use client';

import { MoreHorizontal, FileCheck, IndianRupee } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/dropdown-menu";
import type { DryingRecord, UnloadingRecord, Lot, StorageRecord } from "@/lib/definitions";
import { ManageDryingChargesDialog } from "./manage-drying-charges-dialog";
import { BillProcessDialog } from "./bill-process-dialog";

export function DryingActionsMenu({ record, unloadingRecord, lots, storageRecords }: { record: DryingRecord, unloadingRecord?: UnloadingRecord, lots: Lot[], storageRecords: StorageRecord[] }) {

    const isBilled = record.status === 'Billed';

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
                
                <ManageDryingChargesDialog record={record}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isBilled}>
                        <IndianRupee className="mr-2 h-4 w-4" />
                        Update Packing & Charges
                    </DropdownMenuItem>
                </ManageDryingChargesDialog>

                <DropdownMenuSeparator />
                
                <BillProcessDialog record={record} unloadingRecord={unloadingRecord} lots={lots} storageRecords={storageRecords}>
                    <DropdownMenuItem 
                        onSelect={(e) => e.preventDefault()} 
                        disabled={isBilled || !record.packingDate}
                        className="text-green-600 focus:text-green-700"
                    >
                        <FileCheck className="mr-2 h-4 w-4" />
                        Bill & Create Inflow
                    </DropdownMenuItem>
                </BillProcessDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
