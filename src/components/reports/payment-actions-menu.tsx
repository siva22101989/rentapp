'use client';

import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import Link from 'next/link';
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { PaymentEvent } from "./payment-report-table";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { DeletePaymentDialog } from "./delete-payment-dialog";
import { useAppUser } from "@/firebase/auth/use-user";

export function PaymentActionsMenu({ event }: { event: PaymentEvent }) {
    const appUser = useAppUser();
    const canEdit = appUser?.role === 'owner' || appUser?.role === 'super-admin';
    
    const receiptLink = event.recordType === 'storage' 
        ? `/inflow/receipt?recordId=${event.recordId}` 
        : `/unloading/receipt?unloadingId=${event.recordId}`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={receiptLink} target="_blank">
                        <Eye className="mr-2 h-4 w-4" />
                        View Parent Bill
                    </Link>
                </DropdownMenuItem>
                
                {canEdit && (
                    <>
                        <DropdownMenuSeparator />
                        <EditPaymentDialog event={event}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Entry
                            </DropdownMenuItem>
                        </EditPaymentDialog>
                        <DeletePaymentDialog event={event}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Entry
                            </DropdownMenuItem>
                        </DeletePaymentDialog>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}