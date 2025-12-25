
'use client';

import { MoreHorizontal, Wind, Package, CircleCheck, IndianRupee } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/dropdown-menu";
import type { DryingRecord, DryingStatus } from "@/lib/definitions";
import { dryingStatus } from "@/lib/definitions";
import { useTransition } from "react";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { AddSecondDayHamaliDialog } from "./add-second-day-hamali-dialog";
import { UpdatePackingDialog } from "./update-packing-dialog";

export function DryingActionsMenu({ record }: { record: DryingRecord }) {
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleStatusChange = (newStatus: DryingStatus, bagsPacked?: number) => {
        if (!firestore) {
            toast({ title: "Error", description: "Firestore not available.", variant: "destructive" });
            return;
        }

        startTransition(async () => {
            try {
                const recordRef = doc(firestore, 'dryingRecords', record.id);
                
                const updates: Partial<DryingRecord> = { status: newStatus };
                if (newStatus === "Packing") {
                    updates.packingDate = Timestamp.now();
                    if (bagsPacked !== undefined) {
                      updates.bagsPacked = bagsPacked;
                    }
                } else if (newStatus === "Billed") {
                    updates.billingDate = Timestamp.now();
                }
                
                await updateDoc(recordRef, updates);
                toast({ title: "Success", description: `Record status updated to ${newStatus}.` });
            } catch (error) {
                console.error("Failed to update status:", error);
                toast({ title: "Error", description: "Failed to update record status.", variant: "destructive" });
            }
        });
    };

    const currentIndex = dryingStatus.indexOf(record.status);
    
    const canMoveToPacking = record.status === 'Drying';
    const canMoveToBilled = record.status === 'Packing';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                 <AddSecondDayHamaliDialog record={record}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <IndianRupee className="mr-2 h-4 w-4" />
                        Add 2nd Day Hamali
                    </DropdownMenuItem>
                </AddSecondDayHamaliDialog>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                
                {canMoveToPacking && (
                    <UpdatePackingDialog record={record} onUpdate={handleStatusChange}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Package className="mr-2 h-4 w-4" />
                            Move to Packing
                        </DropdownMenuItem>
                    </UpdatePackingDialog>
                )}

                {canMoveToBilled && (
                     <DropdownMenuItem onClick={() => handleStatusChange('Billed')} disabled={isPending}>
                        <CircleCheck className="mr-2 h-4 w-4" />
                        Move to Billed
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                 <DropdownMenuItem
                    disabled={isPending || record.status === 'Drying'}
                    onClick={() => handleStatusChange('Drying')}
                >
                    Set as Drying
                </DropdownMenuItem>

            </DropdownMenuContent>
        </DropdownMenu>
    );
}
