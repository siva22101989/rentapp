
'use client';

import { MoreHorizontal, FileText, Trash2, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { Customer, StorageRecord, Outflow, WarehouseInfo } from "@/lib/definitions";
import { OutflowReceiptDialog } from "./outflow-receipt-dialog";
import { DeleteOutflowDialog } from "./delete-outflow-dialog";
import { EditOutflowDialog } from "./edit-outflow-dialog";

type ActionsMenuProps = {
  record: StorageRecord;
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  outflow: Outflow;
  outflowIndex: number;
  deliveryOrderNo: string;
  deliveryOrderDate: Date;
}

export function OutflowActionsMenu({ record, customer, warehouseInfo, outflow, outflowIndex, deliveryOrderNo, deliveryOrderDate }: ActionsMenuProps) {

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <OutflowReceiptDialog
                    record={record}
                    customer={customer}
                    warehouseInfo={warehouseInfo}
                    outflow={outflow}
                    deliveryOrderNo={deliveryOrderNo}
                    deliveryOrderDate={deliveryOrderDate}
                >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Bill
                    </DropdownMenuItem>
                </OutflowReceiptDialog>

                <EditOutflowDialog record={record} outflow={outflow} outflowIndex={outflowIndex}>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Date/Discount
                    </DropdownMenuItem>
                </EditOutflowDialog>

                <DropdownMenuSeparator />
                
                <DeleteOutflowDialog recordId={record.id} outflow={outflow} outflowIndex={outflowIndex}>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Outflow
                    </DropdownMenuItem>
                </DeleteOutflowDialog>

            </DropdownMenuContent>
        </DropdownMenu>
    );
}
