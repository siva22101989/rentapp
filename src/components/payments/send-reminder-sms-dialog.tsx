'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { Loader2, MessageSquareWarning, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { StorageRecord, Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { doc } from 'firebase/firestore';
import { sendSms } from '@/lib/sms';
import { Checkbox } from '@/components/ui/checkbox';
import { calculateFinalRent } from '@/lib/billing';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

type SendReminderSmsDialogProps = {
    customers: Customer[];
    storageRecords: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
};

type CustomerDueSummary = {
    id: string;
    name: string;
    phone: string;
    totalDue: number;
    rentDue: number;
    hamaliDue: number;
};

export function SendReminderSmsDialog({ customers, storageRecords, unloadingRecords }: SendReminderSmsDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSendingIndex, setCurrentSendingIndex] = useState(0);
  
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

  // 1. Calculate the accurate dues map (Account-wide aggregation)
  const dueSummaries: CustomerDueSummary[] = useMemo(() => {
    const duesMap: Record<string, { hLiability: number, hPaid: number, rLiability: number, rPaid: number }> = {};
    const today = new Date();

    const getCust = (id: string) => {
        if (!duesMap[id]) duesMap[id] = { hLiability: 0, hPaid: 0, rLiability: 0, rPaid: 0 };
        return duesMap[id];
    }

    storageRecords.forEach(rec => {
        const c = getCust(rec.customerId);
        c.hLiability += rec.hamaliPayable || 0;
        c.hPaid += (rec.payments || []).filter(p => p.type === 'hamali' || p.type === 'unloading').reduce((acc, p) => acc + p.amount, 0);
        
        let accruedRent = 0;
        if (rec.bagsStored > 0 && !rec.storageEndDate) {
            const { rent } = calculateFinalRent({ ...rec, storageStartDate: toDate(rec.storageStartDate) }, today, rec.bagsStored);
            accruedRent = rent;
        }
        c.rLiability += (rec.totalRentBilled || 0) + (rec.khataAmount || 0) + accruedRent;
        c.rPaid += (rec.payments || []).filter(p => p.type === 'rent' || p.type === 'other' || !p.type || p.type === 'discount').reduce((acc, p) => acc + p.amount, 0);
    });

    unloadingRecords.forEach(rec => {
        const c = getCust(rec.customerId);
        const remainingBags = Math.max(0, (rec.bagsUnloaded || 0) - (rec.bagsSentToDrying || 0));
        c.hLiability += remainingBags * (rec.hamaliPerBag || 0);
        c.hPaid += (rec.payments || []).reduce((acc, p) => acc + p.amount, 0);
    });

    return customers
        .map(cust => {
            const d = duesMap[cust.id];
            if (!d) return null;
            const rentDue = Math.max(0, d.rLiability - d.rPaid);
            const hamaliDue = Math.max(0, d.hLiability - d.hPaid);
            const totalDue = rentDue + hamaliDue;
            
            if (totalDue < 0.5) return null; // Skip those with no dues

            return {
                id: cust.id,
                name: cust.name,
                phone: cust.phone,
                totalDue,
                rentDue,
                hamaliDue
            };
        })
        .filter((s): s is CustomerDueSummary => s !== null)
        .sort((a, b) => b.totalDue - a.totalDue);
  }, [customers, storageRecords, unloadingRecords]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(dueSummaries.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleBulkSend = async () => {
    if (!warehouseInfo?.textbeeApiKey) {
        toast({ title: "Configuration Error", description: "Please set your textbee.dev API key in Settings > SMS first.", variant: "destructive" });
        return;
    }

    const selectedList = dueSummaries.filter(s => selectedIds.has(s.id));
    if (selectedList.length === 0) return;

    setIsSending(true);
    setProgress(0);
    setCurrentSendingIndex(0);

    let successCount = 0;
    let failCount = 0;

    const defaultTemplate = 'Dear {customerName}, this is a reminder that you have an outstanding balance. Rent Due: {rentDue}, Hamali Due: {hamaliDue}, Total Due: {totalDue}. Please pay at your earliest convenience. Thank you. - {warehouseName}';
    const template = warehouseInfo.smsPendingDuesTemplate || defaultTemplate;

    for (let i = 0; i < selectedList.length; i++) {
        const item = selectedList[i];
        setCurrentSendingIndex(i + 1);
        
        const message = template
            .replace('{customerName}', item.name)
            .replace('{rentDue}', formatCurrency(item.rentDue))
            .replace('{hamaliDue}', formatCurrency(item.hamaliDue))
            .replace('{totalDue}', formatCurrency(item.totalDue))
            .replace('{warehouseName}', warehouseInfo.name || 'GrainDost');

        const result = await sendSms({
            apiKey: warehouseInfo.textbeeApiKey,
            deviceId: warehouseInfo.textbeeDeviceId,
            to: item.phone,
            message,
        });

        if (result.success) successCount++;
        else failCount++;

        setProgress(((i + 1) / selectedList.length) * 100);
        
        // Minor delay between messages to prevent rate limiting
        await new Promise(r => setTimeout(r, 300));
    }

    setIsSending(false);
    setIsOpen(false);
    setSelectedIds(new Set());
    
    toast({
        title: "Bulk Reminders Processed",
        description: `Successfully sent: ${successCount}. Failed: ${failCount}.`,
        variant: failCount > 0 ? "destructive" : "default",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => { if (!isSending) setIsOpen(val); }}>
      <DialogTrigger asChild>
         <Button variant="outline">
            <MessageSquareWarning className="mr-2 h-4 w-4" />
            Send Reminders
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
                <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Bulk Dues Reminders
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Select customers from the list below to send an automated SMS reminder about their outstanding balances.
                    </DialogDescription>
                </div>
                {selectedIds.size > 0 && (
                    <Badge variant="secondary" className="h-7 px-3 text-xs font-bold uppercase tracking-tight">
                        {selectedIds.size} Selected
                    </Badge>
                )}
            </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6">
            <div className="border rounded-xl overflow-hidden bg-card shadow-inner h-[400px] flex flex-col">
                <Table className="text-[13px]">
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                            <TableHead className="w-[50px] text-center">
                                <Checkbox 
                                    checked={dueSummaries.length > 0 && selectedIds.size === dueSummaries.length}
                                    onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                                />
                            </TableHead>
                            <TableHead className="uppercase text-[10px] font-black text-slate-500">Customer Name</TableHead>
                            <TableHead className="text-right uppercase text-[10px] font-black text-slate-500">Hamali Due</TableHead>
                            <TableHead className="text-right uppercase text-[10px] font-black text-slate-500">Rent Due</TableHead>
                            <TableHead className="text-right uppercase text-[10px] font-black text-slate-500">Total Due</TableHead>
                        </TableRow>
                    </TableHeader>
                </Table>
                <ScrollArea className="flex-1">
                    <Table className="text-[13px]">
                        <TableBody>
                            {dueSummaries.map((s) => (
                                <TableRow key={s.id} className="hover:bg-muted/30 border-b last:border-0 h-10">
                                    <TableCell className="w-[50px] text-center p-0">
                                        <Checkbox 
                                            checked={selectedIds.has(s.id)}
                                            onCheckedChange={(checked) => toggleSelect(s.id, Boolean(checked))}
                                        />
                                    </TableCell>
                                    <TableCell className="font-bold py-1">{s.name}</TableCell>
                                    <TableCell className="text-right font-mono text-orange-600 py-1">{formatCurrency(s.hamaliDue)}</TableCell>
                                    <TableCell className="text-right font-mono text-blue-600 py-1">{formatCurrency(s.rentDue)}</TableCell>
                                    <TableCell className="text-right font-mono font-black text-destructive py-1">{formatCurrency(s.totalDue)}</TableCell>
                                </TableRow>
                            ))}
                            {dueSummaries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                                        No pending dues found for any customer.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>

        {isSending && (
            <div className="px-6 py-4 space-y-2 border-t bg-slate-50">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary">
                    <span>Sending Reminders...</span>
                    <span>{currentSendingIndex} of {selectedIds.size}</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>
        )}

        <DialogFooter className="p-6 pt-4 border-t bg-slate-50/50 gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending}>
                Cancel
            </Button>
            <Button 
                onClick={handleBulkSend} 
                disabled={isSending || selectedIds.size === 0}
                className="min-w-[180px]"
            >
                {isSending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                    <><MessageSquareWarning className="mr-2 h-4 w-4" /> Send {selectedIds.size} Reminders</>
                )}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
