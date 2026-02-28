'use client';

import { useTransition, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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


const AddLotSchema = z.object({
  name: z.string().min(1, 'Lot name cannot be empty.'),
  capacity: z.coerce.number().int().nonnegative('Capacity must be non-negative').optional(),
});
type AddLotFormData = z.infer<typeof AddLotSchema>;

const RangeAddLotsSchema = z.object({
    prefix: z.string().optional(),
    start: z.coerce.number().int(),
    end: z.coerce.number().int(),
    suffix: z.string().optional(),
    capacity: z.coerce.number().int().nonnegative('Capacity must be non-negative').optional(),
}).refine(data => data.end >= data.start, {
    message: "End number must be greater than or equal to start number.",
    path: ["end"],
});
type RangeAddLotsFormData = z.infer<typeof RangeAddLotsSchema>;


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
  const { toast } = useToast();
  
  const [isAdding, startAddingTransition] = useTransition();
  const [isRangeAdding, startRangeAddingTransition] = useTransition();


  const lotsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'lots') : null),
    [firestore]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const existingLotNames = useMemo(() => new Set(lots?.map(l => l.name.toLowerCase())), [lots]);

  const addForm = useForm<AddLotFormData>({
    resolver: zodResolver(AddLotSchema),
    defaultValues: { name: '', capacity: '' },
  });

  const rangeAddForm = useForm<RangeAddLotsFormData>({
    resolver: zodResolver(RangeAddLotsSchema),
    defaultValues: { prefix: '', start: 1, end: '', suffix: '', capacity: '' },
  });


  const onAddSubmit = (data: AddLotFormData) => {
    if (!firestore) return;
    const trimmedName = data.name.trim();
    if (existingLotNames.has(trimmedName.toLowerCase())) {
        addForm.setError('name', { message: 'This lot name already exists.' });
        return;
    }
    startAddingTransition(async () => {
      try {
        await addDoc(collection(firestore, 'lots'), { name: trimmedName, capacity: data.capacity || null });
        toast({ title: 'Success', description: `Lot "${trimmedName}" added.` });
        addForm.reset();
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to add lot.', variant: 'destructive' });
      }
    });
  };

  const onRangeAddSubmit = (data: RangeAddLotsFormData) => {
    if (!firestore) return;
    startRangeAddingTransition(async () => {
        const { prefix = '', start, end, suffix = '', capacity } = data;
        const lotsToAdd: { name: string; capacity: number | null }[] = [];
        let skippedCount = 0;

        for (let i = start; i <= end; i++) {
            const name = `${prefix}${i}${suffix}`.trim();
            if (existingLotNames.has(name.toLowerCase())) {
                skippedCount++;
            } else {
                lotsToAdd.push({ name, capacity: capacity ?? null });
                existingLotNames.add(name.toLowerCase()); // Prevent adding duplicates from the same range
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
        lotsToAdd.forEach(lot => {
            const docRef = doc(collection(firestore, 'lots'));
            batch.set(docRef, lot);
        });

        try {
            await batch.commit();
            toast({
                title: 'Range Add Complete',
                description: `${lotsToAdd.length} lots added. ${skippedCount > 0 ? `${skippedCount} skipped (duplicates).` : ''}`,
            });
            rangeAddForm.reset();
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
                <Form {...addForm}>
                    <form onSubmit={addForm.handleSubmit(onAddSubmit)}>
                        <CardHeader>
                            <CardTitle>Add Single Lot</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <FormField
                                control={addForm.control}
                                name="name"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Lot Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. A1/Top" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={addForm.control}
                                name="capacity"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Capacity (bags)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g. 1000" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isAdding}>
                                {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Lot
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>

            <Card>
              <Form {...rangeAddForm}>
                <form onSubmit={rangeAddForm.handleSubmit(onRangeAddSubmit)}>
                  <CardHeader>
                    <CardTitle>Add Lots by Range</CardTitle>
                    <CardDescription>E.g., A1 to A6 becomes A1, A2, etc.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <FormField control={rangeAddForm.control} name="prefix" render={({ field }) => (<FormItem><FormLabel>Prefix</FormLabel><FormControl><Input placeholder="e.g. A" {...field} /></FormControl><FormMessage /></FormItem>)} />
                       <FormField control={rangeAddForm.control} name="suffix" render={({ field }) => (<FormItem><FormLabel>Suffix</FormLabel><FormControl><Input placeholder="e.g. /Top" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={rangeAddForm.control} name="start" render={({ field }) => (<FormItem><FormLabel>Start No.</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={rangeAddForm.control} name="end" render={({ field }) => (<FormItem><FormLabel>End No.</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                     <FormField control={rangeAddForm.control} name="capacity" render={({ field }) => (<FormItem><FormLabel>Capacity (for all)</FormLabel><FormControl><Input type="number" placeholder="e.g. 1000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isRangeAdding}>
                        {isRangeAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Range
                    </Button>
                  </CardFooter>
                </form>
              </Form>
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
