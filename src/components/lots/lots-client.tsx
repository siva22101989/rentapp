'use client';

import { useTransition, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import type { Lot } from '@/lib/definitions';
import { deleteLot } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
});
type AddLotFormData = z.infer<typeof AddLotSchema>;

const BulkAddLotsSchema = z.object({
  names: z.string().min(1, 'Lot names cannot be empty.'),
});
type BulkAddLotsFormData = z.infer<typeof BulkAddLotsSchema>;


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
  const [isBulkAdding, startBulkAddingTransition] = useTransition();

  const lotsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'lots') : null),
    [firestore]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const existingLotNames = useMemo(() => new Set(lots?.map(l => l.name.toLowerCase())), [lots]);

  const addForm = useForm<AddLotFormData>({
    resolver: zodResolver(AddLotSchema),
    defaultValues: { name: '' },
  });

  const bulkAddForm = useForm<BulkAddLotsFormData>({
    resolver: zodResolver(BulkAddLotsSchema),
    defaultValues: { names: '' },
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
        await addDoc(collection(firestore, 'lots'), { name: trimmedName });
        toast({ title: 'Success', description: `Lot "${trimmedName}" added.` });
        addForm.reset();
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to add lot.', variant: 'destructive' });
      }
    });
  };

  const onBulkAddSubmit = (data: BulkAddLotsFormData) => {
    if (!firestore) return;
    startBulkAddingTransition(async () => {
      const names = data.names.split('\n').map(name => name.trim()).filter(Boolean);
      const uniqueNames = [...new Set(names)];
      
      let addedCount = 0;
      let skippedCount = 0;
      const batch = writeBatch(firestore);

      uniqueNames.forEach(name => {
        if (!existingLotNames.has(name.toLowerCase())) {
          const docRef = doc(collection(firestore, 'lots'));
          batch.set(docRef, { name });
          addedCount++;
        } else {
          skippedCount++;
        }
      });

      try {
        if (addedCount > 0) {
            await batch.commit();
        }
        toast({
          title: 'Bulk Add Complete',
          description: `${addedCount} lots added, ${skippedCount} skipped (duplicates).`,
        });
        bulkAddForm.reset();
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to bulk add lots.', variant: 'destructive' });
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
                        <CardContent>
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
                <Form {...bulkAddForm}>
                    <form onSubmit={bulkAddForm.handleSubmit(onBulkAddSubmit)}>
                        <CardHeader>
                            <CardTitle>Bulk Add Lots</CardTitle>
                            <CardDescription>Enter one lot name per line.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={bulkAddForm.control}
                                name="names"
                                render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Textarea placeholder="B2/Middle&#10;C3/Bottom" {...field} rows={5} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isBulkAdding}>
                                {isBulkAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Multiple Lots
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
                            <TableHead className="w-[50px] text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loadingLots ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : (lots || []).sort((a,b) => a.name.localeCompare(b.name)).map((lot) => (
                            <TableRow key={lot.id}>
                                <TableCell className="font-medium">{lot.name}</TableCell>
                                <TableCell className="text-right">
                                    <DeleteLotDialog lot={lot} onConfirm={() => handleDeleteLot(lot.id)} />
                                </TableCell>
                            </TableRow>
                        ))}
                         {!loadingLots && (!lots || lots.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">
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
