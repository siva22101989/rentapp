
'use client';

import { useTransition, useState, useMemo } from 'react';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import type { Lot } from '@/lib/definitions';
import { deleteLot } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cleanForFirestore } from '@/lib/utils';
import { useAppUser } from '@/firebase/auth/use-user';


function DeleteLotDialog({ lot, onConfirm }: { lot: Lot, onConfirm: () => void }) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(() => {
            onConfirm();
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the lot: <span className="font-bold">{lot.name}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Lot
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function LotsClient() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const { toast } = useToast();
  
  const [isAdding, startAddingTransition] = useTransition();
  const [isRangeAdding, startRangeAddingTransition] = useTransition();
  
  // State for single lot form
  const [lotName, setLotName] = useState('');
  const [lotCapacity, setLotCapacity] = useState<number | ''>('');

  // State for range lot form
  const [rangePrefix, setRangePrefix] = useState('');
  const [rangeStart, setRangeStart] = useState<number | ''>(1);
  const [rangeEnd, setRangeEnd] = useState<number | ''>('');
  const [rangeSuffix, setRangeSuffix] = useState('');
  const [rangeCapacity, setRangeCapacity] = useState<number | ''>('');


  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'lots') : null),
    [firestore, appUser]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const existingLotNames = useMemo(() => new Set(lots?.map(l => l.name.toLowerCase())), [lots]);

  const onAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !appUser) return;
    const trimmedName = lotName.trim();

    if (!trimmedName) {
        toast({ title: 'Validation Error', description: 'Lot name cannot be empty.', variant: 'destructive' });
        return;
    }
    if (existingLotNames.has(trimmedName.toLowerCase())) {
        toast({ title: 'Validation Error', description: 'This lot name already exists.', variant: 'destructive' });
        return;
    }
    
    startAddingTransition(async () => {
      try {
        const collectionRef = collection(firestore, 'lots');
        await addDoc(collectionRef, cleanForFirestore({ name: trimmedName, capacity: Number(lotCapacity) || null }));
        toast({ title: 'Success', description: `Lot "${trimmedName}" added.` });
        setLotName('');
        setLotCapacity('');
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to add lot.', variant: 'destructive' });
      }
    });
  };

  const onRangeAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !appUser) return;
    const startNum = Number(rangeStart);
    const endNum = Number(rangeEnd);

    if (isNaN(startNum) || isNaN(endNum) || endNum < startNum) {
        toast({ title: 'Validation Error', description: 'End number must be greater than or equal to start number.', variant: 'destructive' });
        return;
    }
    
    startRangeAddingTransition(async () => {
        const { prefix = '', suffix = '', capacity } = { prefix: rangePrefix, suffix: rangeSuffix, capacity: rangeCapacity };
        const lotsToAdd: { name: string; capacity: number | null }[] = [];
        let skippedCount = 0;

        for (let i = startNum; i <= endNum; i++) {
            const name = `${prefix}${i}${suffix}`.trim();
            if (existingLotNames.has(name.toLowerCase())) {
                skippedCount++;
            } else {
                lotsToAdd.push({ name, capacity: Number(capacity) || null });
                existingLotNames.add(name.toLowerCase()); 
            }
        }

        if (lotsToAdd.length === 0) {
            toast({
                title: 'No lots to add',
                description: `All lots in the specified range already exist (skipped ${skippedCount}).`,
                variant: 'default',
            });
            return;
        }

        const batch = writeBatch(firestore);
        const collectionRef = collection(firestore, 'lots');
        lotsToAdd.forEach(lot => {
            const docRef = doc(collectionRef);
            batch.set(docRef, cleanForFirestore(lot));
        });

        try {
            await batch.commit();
            toast({
                title: 'Range Add Complete',
                description: `${lotsToAdd.length} lots added. ${skippedCount > 0 ? `${skippedCount} skipped (duplicates).` : ''}`,
            });
            setRangePrefix('');
            setRangeStart(1);
            setRangeEnd('');
            setRangeSuffix('');
            setRangeCapacity('');
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to add lots from range.', variant: 'destructive' });
        }
    });
  };


  const handleDeleteLot = (lotId: string) => {
    if (!firestore) return;
    deleteLot(firestore, lotId)
      .then(() => toast({ title: 'Success', description: 'Lot deleted.' }))
      .catch(() => toast({ title: 'Error', description: 'Failed to delete lot.', variant: 'destructive' }));
  };

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 items-start">
        <div className="lg:col-span-1 space-y-8">
            <Card>
                <form onSubmit={onAddSubmit}>
                    <CardHeader>
                        <CardTitle>Add Single Lot</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="lot-name">Lot Name</Label>
                            <Input id="lot-name" placeholder="e.g. A1/Top" value={lotName} onChange={(e) => setLotName(e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="lot-capacity">Capacity (bags)</Label>
                            <Input id="lot-capacity" type="number" placeholder="e.g. 1000" value={lotCapacity} onChange={(e) => setLotCapacity(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isAdding}>
                            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Lot
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <Card>
                <form onSubmit={onRangeAddSubmit}>
                  <CardHeader>
                    <CardTitle>Add Lots by Range</CardTitle>
                    <CardDescription>E.g., A1 to A6 becomes A1, A2, etc.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="range-prefix">Prefix</Label>
                            <Input id="range-prefix" placeholder="e.g. A" value={rangePrefix} onChange={(e) => setRangePrefix(e.target.value)} />
                        </div>
                       <div className="space-y-2">
                            <Label htmlFor="range-suffix">Suffix</Label>
                            <Input id="range-suffix" placeholder="e.g. /Top" value={rangeSuffix} onChange={(e) => setRangeSuffix(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="range-start">Start No.</Label>
                            <Input id="range-start" type="number" value={rangeStart} onChange={(e) => setRangeStart(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="range-end">End No.</Label>
                            <Input id="range-end" type="number" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="range-capacity">Capacity (for all)</Label>
                        <Input id="range-capacity" type="number" placeholder="e.g. 1000" value={rangeCapacity} onChange={(e) => setRangeCapacity(e.target.value === '' ? '' : Number(e.target.value))} />
                     </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isRangeAdding}>
                        {isRangeAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Range
                    </Button>
                  </CardFooter>
                </form>
            </Card>
        </div>

        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Existing Lots</CardTitle>
                 <CardDescription>Total lots: {lots?.length || 0}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Lot Name</TableHead>
                            <TableHead className="text-right">Capacity (bags)</TableHead>
                            <TableHead className="w-[50px] text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loadingLots ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : (lots || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((lot) => (
                            <TableRow key={lot.id}>
                                <TableCell className="font-medium">{lot.name}</TableCell>
                                <TableCell className="text-right font-mono">{lot.capacity ?? 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                    <DeleteLotDialog lot={lot} onConfirm={() => handleDeleteLot(lot.id)} />
                                </TableCell>
                            </TableRow>
                        ))}
                         {!loadingLots && (!lots || lots.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                    No lots have been added yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
