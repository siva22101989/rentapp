
'use client';

import { MoreHorizontal, Pencil, Trash2, FileText } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { UnloadingRecord, Customer, Commodity, Lot, StorageRecord } from "@/lib/definitions";
import { EditUnloadingRecordDialog } from "./edit-unloading-record-dialog";
import { DeleteUnloadingRecordDialog } from "./delete-unloading-record-dialog";
import { ViewUnloadingReceiptDialog } from "./view-unloading-receipt-dialog";
import { useAppUser } from "@/firebase/auth/use-user";

type ActionsMenuProps = {
    record: UnloadingRecord & { hamaliPending: number; };
    customers: Customer[];
    commodities: Commodity[];
    lots: Lot[];
    storageRecords: StorageRecord[];
}

export function UnloadingTableActionsMenu({ record, customers, commodities, lots, storageRecords }: ActionsMenuProps) {
    const appUser = useAppUser();
    const canEdit = appUser?.role === 'owner' || appUser?.role === 'biller' || appUser?.role === 'supervisor';
    const canDelete = appUser?.role === 'owner' || appUser?.role === 'super-admin';
    const isDeletable = (record.bagsSentToDrying || 0) === 0;
    
    const customer = customers.find(c => c.id === record.customerId);
    
    if (!canEdit) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {customer && (
                    <ViewUnloadingReceiptDialog record={record} customer={customer}>
                         <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Receipt
                        </DropdownMenuItem>
                    </ViewUnloadingReceiptDialog>
                )}

                <EditUnloadingRecordDialog 
                    record={record} 
                    customers={customers} 
                    commodities={commodities}
                    lots={lots}
                    storageRecords={storageRecords}
                >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                </EditUnloadingRecordDialog>
                
                {canDelete && (
                    <>
                        <DropdownMenuSeparator />
                        <DeleteUnloadingRecordDialog recordId={record.id}>
                            <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                disabled={!isDeletable}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DeleteUnloadingRecordDialog>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
