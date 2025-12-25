
'use client';

import { MoreHorizontal, Wind, Package, CircleCheck } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/dropdown-menu";
import type { DryingRecord, DryingStatus } from "@/lib/definitions";
import { dryingStatus } from "@/lib/definitions";
import { useTransition } from "react";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, Timestamp } from "firebase/firestore";

export function DryingActionsMenu({ record }: { record: DryingRecord }) {
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleStatusChange = (newStatus: DryingStatus) => {
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
    const nextStatus = currentIndex < dryingStatus.length - 1 ? dryingStatus[currentIndex + 1] : null;

    const statusIcons = {
        "Packing": <Package className="mr-2 h-4 w-4" />,
        "Billed": <CircleCheck className="mr-2 h-4 w-4" />,
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {dryingStatus.map(status => (
                    <DropdownMenuItem
                        key={status}
                        disabled={isPending || record.status === status}
                        onClick={() => handleStatusChange(status)}
                    >
                        {record.status === status && <CircleCheck className="mr-2 h-4 w-4 text-green-600" />}
                        {status}
                    </DropdownMenuItem>
                ))}
                {nextStatus && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="bg-primary/10 text-primary focus:bg-primary/20"
                            disabled={isPending}
                            onClick={() => handleStatusChange(nextStatus)}
                        >
                            {statusIcons[nextStatus as keyof typeof statusIcons]}
                            Move to {nextStatus}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

    