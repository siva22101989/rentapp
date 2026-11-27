
'use client';

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';

type BaseProps = {
    records: StorageRecord[];
    customers: Customer[];
    warehouseInfo: WarehouseInfo | null;
    title?: string;
};

/**
 * Section 1: Commodity-wise Stock (Internal Logic)
 */
const CommoditySummaryTable = ({ records }: { records: StorageRecord[] }) => {
    const summary = useMemo(() => {
        const active = records.filter(r => !r.storageEndDate && r.bagsStored > 0.1);
        const map: Record<string, { bags: number; weight: number; lots: Set<string> }> = {};
        
        active.forEach(r => {
            const cat = r.commodityDescription || 'Uncategorized';
            if (!map[cat]) map[cat] = { bags: 0, weight: 0, lots: new Set() };
            map[cat].bags += (Number(r.bagsStored) || 0);
            map[cat].weight += (Number(r.weight) || 0);
            if (r.location) map[cat].lots.add(r.location);
        });

        return Object.entries(map).sort((a, b) => b[1].bags - a[1].bags);
    }, [records]);

    const totalBags = summary.reduce((acc, [, d]) => acc + d.bags, 0);

    return (
        <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 border-l-4 border-primary pl-3">Part I: Commodity-wise Stock Summary</h3>
            <div className="table-scroll-container border-2 border-slate-200">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b-2 border-black">
                            <TableHead className="text-center font-black uppercase text-[10px]">Commodity Name</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px]">Unique Lots</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px]">Total Weight (Kg)</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px]">Current Stock (Bags)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summary.map(([name, data]) => (
                            <TableRow key={name} className="h-10 border-b">
                                <TableCell className="text-center font-bold uppercase">{name}</TableCell>
                                <TableCell className="text-center font-mono">{data.lots.size}</TableCell>
                                <TableCell className="text-center font-mono">{data.weight.toLocaleString()}</TableCell>
                                <TableCell className="text-center font-mono font-black text-lg text-primary">{data.bags}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black h-12">
                            <TableCell colSpan={3} className="text-right uppercase text-[10px] tracking-widest pr-6">Grand Godown Capacity Occupied</TableCell>
                            <TableCell className="text-center font-mono text-xl">{totalBags}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>
    );
};

/**
 * Section 2: Customer-wise Commodity (Internal Logic)
 */
const CustomerCommodityTable = ({ records, customers }: { records: StorageRecord[], customers: Customer[] }) => {
    const summary = useMemo(() => {
        const active = records.filter(r => !r.storageEndDate && r.bagsStored > 0.1);
        const map: Record<string, Record<string, number>> = {};
        
        active.forEach(r => {
            if (!map[r.customerId]) map[r.customerId] = {};
            const cat = r.commodityDescription || 'Uncategorized';
            map[r.customerId][cat] = (map[r.customerId][cat] || 0) + (Number(r.bagsStored) || 0);
        });

        return Object.entries(map).map(([cId, stocks]) => ({
            customerName: customers.find(c => c.id === cId)?.name || 'Unknown',
            stocks: Object.entries(stocks).sort((a,b) => b[1] - a[1])
        })).sort((a, b) => a.customerName.localeCompare(b.customerName));
    }, [records, customers]);

    return (
        <div className="space-y-3 pt-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 border-l-4 border-primary pl-3">Part II: Customer-wise Commodity Breakdown</h3>
            <div className="table-scroll-container border-2 border-slate-200">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b-2 border-black">
                            <TableHead className="text-center font-black uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px]">Commodity</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px]">Stock Balance (Bags)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summary.map((group) => (
                            <React.Fragment key={group.customerName}>
                                {group.stocks.map(([commodity, bags], idx) => (
                                    <TableRow key={idx} className="h-9 border-b hover:bg-slate-50">
                                        <TableCell className="text-center font-bold uppercase">{idx === 0 ? group.customerName : ''}</TableCell>
                                        <TableCell className="text-center font-medium text-slate-600">{commodity}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-primary">{bags}</TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                        {summary.length === 0 && (
                             <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">No customer inventory found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

/**
 * Section 3: Lot-wise Register (Internal Logic)
 */
const LotInventoryTableInternal = ({ records, customers }: { records: StorageRecord[], customers: Customer[] }) => {
    const groupedLots = useMemo(() => {
        const active = records.filter(r => !r.storageEndDate && r.bagsStored > 0.1);
        const map: Record<string, { total: number; records: any[] }> = {};
        
        active.forEach(r => {
            const lot = r.location || 'Unassigned';
            if (!map[lot]) map[lot] = { total: 0, records: [] };
            map[lot].total += (Number(r.bagsStored) || 0);
            map[lot].records.push({
                ...r,
                customerName: customers.find(c => c.id === r.customerId)?.name || 'Unknown'
            });
        });

        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    }, [records, customers]);

    const grandTotal = groupedLots.reduce((acc, [, d]) => acc + d.total, 0);

    return (
        <div className="space-y-3 pt-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 border-l-4 border-primary pl-3">Part III: Physical Lot-wise Register (Newest First)</h3>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b-2 border-black">
                            <TableHead className="w-24 uppercase text-[10px] font-black text-center">Lot No</TableHead>
                            <TableHead className="uppercase text-[10px] font-black text-center">Inflow Date</TableHead>
                            <TableHead className="uppercase text-[10px] font-black text-center">Customer / Product</TableHead>
                            <TableHead className="uppercase text-[10px] font-black text-center">Storage ID</TableHead>
                            <TableHead className="uppercase text-[10px] font-black text-center">Bags</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedLots.map(([lotName, data]) => (
                            <React.Fragment key={lotName}>
                                <TableRow className="bg-primary/5 h-8">
                                    <TableCell className="text-center font-black text-primary border-r-2 border-primary/20">{lotName}</TableCell>
                                    <TableCell colSpan={3} className="text-right uppercase text-[9px] font-black text-slate-400 pr-4">Lot {lotName} Subtotal</TableCell>
                                    <TableCell className="text-center font-mono font-black text-primary border-l-2 border-primary/20">{data.total}</TableCell>
                                </TableRow>
                                {data.records.sort((a: any, b: any) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime()).map((r: any, idx: number) => (
                                    <TableRow key={idx} className="h-9 border-b last:border-b-2">
                                        <TableCell></TableCell>
                                        <TableCell className="text-center font-mono text-slate-500">{format(toDate(r.storageStartDate), 'dd/MM/yy')}</TableCell>
                                        <TableCell className="text-center leading-tight">
                                            <div className="font-bold uppercase">{r.customerName}</div>
                                            <div className="text-[10px] text-slate-400">{r.commodityDescription}</div>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-slate-400">{r.id}</TableCell>
                                        <TableCell className="text-center font-mono font-bold">{r.bagsStored}</TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                    <TableFooter>
                         <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-12">
                            <TableCell colSpan={4} className="text-right uppercase text-[10px] tracking-widest pr-6">Grand Total Warehouse Active Stock</TableCell>
                            <TableCell className="text-center font-mono text-2xl text-primary">{grandTotal}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>
    );
};

/**
 * MASTER CONSOLIDATED REPORT
 */
export function InventoryMasterAuditReport({ records, customers, warehouseInfo, title }: BaseProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);

    return (
        <div className="bg-white p-8 text-black font-sans text-sm border-2 border-black rounded-lg shadow-sm printable-area w-full mx-auto" style={{ width: '277mm' }}>
             <div className="text-center border-b-2 border-black pb-6 mb-8">
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-primary text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-2 text-center">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}</p>
                <h2 className="text-lg font-black underline uppercase mt-6 tracking-[0.2em] text-center">Consolidated Inventory Audit Report</h2>
                <p className="text-[10px] text-slate-400 mt-2 uppercase text-center font-bold">Full Godown Analysis • Generated: {generatedDate}</p>
            </div>

            <div className="space-y-12">
                <CommoditySummaryTable records={records} />
                <CustomerCommodityTable records={records} customers={customers} />
                <LotInventoryTableInternal records={records} customers={customers} />
            </div>

            <div className="mt-24 flex justify-between">
                <div className="w-64 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Auditor Signature</p>
                </div>
                <div className="w-64 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Manager Signature</p>
                </div>
            </div>

            <div className="mt-12 pt-6 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
                <p>This is a master stock audit document reconciling commodities, customers, and physical lots.</p>
                <p>Digital Token: INV-CON-{format(new Date(), 'yyyyMMdd')}</p>
            </div>
        </div>
    );
}

/**
 * Keep the standalone components for individual views
 */
export function CommodityStockReport(props: BaseProps) {
    return <InventoryMasterAuditReport {...props} />; // For simplicity, standalone calls now show the master, or we could keep original
}
export function CustomerCommodityStockReport(props: BaseProps) {
    return <InventoryMasterAuditReport {...props} />;
}
export function LotWiseInventoryReport(props: BaseProps) {
    return <InventoryMasterAuditReport {...props} />;
}
