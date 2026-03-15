'use client';
import { MoreHorizontal, Pencil, Trash2, IndianRupee } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../ui/dropdown-menu";
import type { Lending } from "@/lib/definitions";
import { EditLendingDialog } from "./edit-lending-dialog";
import { DeleteLendingDialog } from "./delete-lending-dialog";
import { AddLendingPaymentDialog } from "./add-lending-payment-dialog";

export function LendingActionsMenu({ lending }: { lending: Lending }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <AddLendingPaymentDialog lending={lending}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <IndianRupee className="mr-2 h-4 w-4" />
                        Add Payment
                    </DropdownMenuItem>
                </AddLendingPaymentDialog>
                <DropdownMenuSeparator />
                <EditLendingDialog lending={lending}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                </EditLendingDialog>
                <DropdownMenuSeparator />
                <DeleteLendingDialog lendingId={lending.id}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DeleteLendingDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
