
'use client';

import { MoreHorizontal, IndianRupee } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { UnloadingRecord } from "@/lib/definitions";
import { AddUnloadingPaymentDialog } from "./add-unloading-payment-dialog";

type ActionsMenuProps = {
    record: UnloadingRecord & { hamaliPending: number; };
}

export function UnloadingTableActionsMenu({ record }: ActionsMenuProps) {

    if (record.hamaliPending <= 0) {
        return null; // Don't show menu if nothing is pending
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
                <AddUnloadingPaymentDialog record={record}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <IndianRupee className="mr-2 h-4 w-4" />
                        Add Payment
                    </DropdownMenuItem>
                </AddUnloadingPaymentDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
