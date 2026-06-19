'use client';

import { MoreHorizontal, FileText, Trash2, Pencil } from "lucide-react";
import Link from 'next/link';
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { Customer, StorageRecord, Outflow, WarehouseInfo, Commodity, Lot } from "@/lib/definitions";
import { DeleteOutflowDialog } from "./delete-outflow-dialog";
import { EditOutflowDialog } from "./edit-outflow-dialog";
import { useMemo } from "react";

type ActionsMenuProps = {
  record: StorageRecord;
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  outflow: Outflow;
  outflowIndex: number;
  deliveryOrderNo: string;
  deliveryOrderDate: Date;
  commodities: Commodity[];
  lots: Lot[];
  allRecords: StorageRecord[];
}

export function OutflowActionsMenu({ 
    record, 
    customer, 
    warehouseInfo, 
    outflow, 
    outflowIndex, 
    deliveryOrderNo, 
    deliveryOrderDate,
    commodities,
    lots,
    allRecords
}: ActionsMenuProps) {

    // Numerical clean ID for the Bill
    const cleanBillNo = useMemo(() => String(deliveryOrderNo || '').replace(/\D/g, ''), [deliveryOrderNo]);

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
                    <Link href={`/outflow/receipt?pattiNo=${cleanBillNo}`} target="_blank">
                        <FileText className="mr-2 h-4 w-4" />
                        View/Print Bill
                    </Link>
                </DropdownMenuItem>

                <EditOutflowDialog 
                    record={record} 
                    outflow={outflow} 
                    outflowIndex={outflowIndex}
                    commodities={commodities}
                    lots={lots}
                    allRecords={allRecords}
                    deliveryOrderNo={deliveryOrderNo}
                >
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Full Bill
                    </DropdownMenuItem>
                </EditOutflowDialog>

                <DropdownMenuSeparator />
                
                <DeleteOutflowDialog pattiNo={cleanBillNo} outflow={outflow}>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Outflow
                    </DropdownMenuItem>
                </DeleteOutflowDialog>

            </DropdownMenuContent>
        </DropdownMenu>
    );
}