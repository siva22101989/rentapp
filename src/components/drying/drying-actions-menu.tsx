
'use client';

import { MoreHorizontal, DollarSign, Package, FileCheck } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/dropdown-menu";
import type { DryingRecord, UnloadingRecord, Lot } from "@/lib/definitions";
import { ManageHamaliDialog } from "./manage-hamali-dialog";
import { UpdatePackingDialog } from "./update-packing-dialog";
import { BillProcessDialog } from "./bill-process-dialog";

export function DryingActionsMenu({ record, unloadingRecord, lots }: { record: DryingRecord, unloadingRecord?: UnloadingRecord, lots: Lot[] }) {

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
                <ManageHamaliDialog record={record} unloadingRecord={unloadingRecord}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isBilled}>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Manage Hamali
                    </DropdownMenuItem>
                </ManageHamaliDialog>

                <UpdatePackingDialog record={record}>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isBilled}>
                        <Package className="mr-2 h-4 w-4" />
                        Update Packing
                    </DropdownMenuItem>
                </UpdatePackingDialog>

                <DropdownMenuSeparator />
                
                <BillProcessDialog record={record} unloadingRecord={unloadingRecord} lots={lots}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isBilled || !record.packingDate}>
                        <FileCheck className="mr-2 h-4 w-4" />
                        Bill & Create Inflow
                    </DropdownMenuItem>
                </BillProcessDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
