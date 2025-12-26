
'use client';

import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { Commodity } from "@/lib/definitions";
import { EditCommodityDialog } from "./edit-commodity-dialog";
import { DeleteCommodityDialog } from "./delete-commodity-dialog";

export function CommodityActionsMenu({ commodity }: { commodity: Commodity }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <EditCommodityDialog commodity={commodity}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </EditCommodityDialog>
                <DropdownMenuSeparator />
                <DeleteCommodityDialog commodityId={commodity.id}>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DeleteCommodityDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
