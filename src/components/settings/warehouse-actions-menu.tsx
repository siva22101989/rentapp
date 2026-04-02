
'use client';

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { ManagedWarehouse } from "@/lib/definitions";
import { EditWarehouseDialog } from "./edit-warehouse-dialog";
import { DeleteWarehouseDialog } from "./delete-warehouse-dialog";

export function WarehouseActionsMenu({ warehouse }: { warehouse: ManagedWarehouse }) {

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <EditWarehouseDialog warehouse={warehouse}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Subscription
                    </DropdownMenuItem>
                </EditWarehouseDialog>
                <DropdownMenuSeparator />
                <DeleteWarehouseDialog warehouse={warehouse}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DeleteWarehouseDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
