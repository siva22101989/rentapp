'use client';

import { MoreHorizontal, Pencil, Trash2, IndianRupee } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../ui/dropdown-menu";
import type { Borrowing } from "@/lib/definitions";
import { EditBorrowingDialog } from "./edit-borrowing-dialog";
import { DeleteBorrowingDialog } from "./delete-borrowing-dialog";
import { AddBorrowingPaymentDialog } from "./add-borrowing-payment-dialog";

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
                <AddBorrowingPaymentDialog borrowing={borrowing}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <IndianRupee className="mr-2 h-4 w-4" />
                        Add Payment
                    </DropdownMenuItem>
                </AddBorrowingPaymentDialog>
                <EditBorrowingDialog borrowing={borrowing}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                </EditBorrowingDialog>
                <DropdownMenuSeparator />
                <DeleteBorrowingDialog borrowingId={borrowing.id}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DeleteBorrowingDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
