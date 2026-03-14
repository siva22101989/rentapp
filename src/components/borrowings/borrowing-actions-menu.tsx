'use client';

import { MoreHorizontal, IndianRupee, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { Borrowing } from "@/lib/definitions";
import { AddBorrowingPaymentDialog } from "./add-borrowing-payment-dialog";
import { EditBorrowingDialog } from "./edit-borrowing-dialog";

export function BorrowingActionsMenu({ borrowing }: { borrowing: Borrowing }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <EditBorrowingDialog borrowing={borrowing}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                </EditBorrowingDialog>
                <AddBorrowingPaymentDialog borrowing={borrowing}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <IndianRupee className="mr-2 h-4 w-4" />
                        Add Payment
                    </DropdownMenuItem>
                </AddBorrowingPaymentDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
