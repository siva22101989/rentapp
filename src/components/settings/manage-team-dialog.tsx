'use client';
import { useState, useTransition } from 'react';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cleanForFirestore } from '@/lib/utils';
import type { AppUser } from '@/lib/definitions';
import { useAppUser } from '@/firebase/auth/use-user';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const teamMemberRoles = ['owner', 'supervisor', 'biller'] as const;

const AddUserSchema = z.object({
    phone: z.string().min(10, 'Please enter a valid phone number.'),
    role: z.enum(teamMemberRoles, { required_error: 'Please select a role.' }),
});

type AddUserFormData = z.infer<typeof AddUserSchema>;


export function ManageTeamDialog({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const appUser = useAppUser();

    const usersQuery = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'users'), where('warehouseId', '==', appUser.warehouseId)) : null),
        [firestore, appUser]
    );
    const { data: users, loading } = useCollection<AppUser>(usersQuery);

    const form = useForm<AddUserFormData>({
        resolver: zodResolver(AddUserSchema),
        defaultValues: { phone: '', role: 'biller' },
    });

    const onAddUser = (data: AddUserFormData) => {
        if (!firestore || !appUser?.warehouseId) return;
        
        if (users?.some(u => u.phone === data.phone)) {
            form.setError('phone', { message: 'A user with this phone number already exists.' });
            return;
        }

        startTransition(async () => {
            try {
                await addDoc(collection(firestore, 'users'), cleanForFirestore({
                    phone: data.phone,
                    role: data.role,
                    warehouseId: appUser.warehouseId,
                }));
                toast({ title: 'Success', description: 'User added to the team. They can now sign in with their phone number and a password of their choice.' });
                form.reset();
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to add user.', variant: 'destructive' });
            }
        });
    };

    const onDeleteUser = (userId: string) => {
        if (!firestore) return;
        startTransition(async () => {
            try {
                await deleteDoc(doc(firestore, 'users', userId));
                toast({ title: 'Success', description: 'User removed from the team.' });
            } catch (error) {
                 toast({ title: 'Error', description: 'Failed to remove user.', variant: 'destructive' });
            }
        });
    }

  return (
    <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Manage Team</DialogTitle>
                <DialogDescription>
                    Add or remove users. The user will use their phone number and a password of their choosing to sign in.
                </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddUser)} className="grid grid-cols-1 sm:grid-cols-3 items-end gap-2">
                     <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem className="sm:col-span-1">
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl><Input placeholder="+91..." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex items-end gap-2 sm:col-span-2">
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {teamMemberRoles.map(role => (
                                                <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isPending} className="self-end h-9">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                        </Button>
                    </div>
                </form>
            </Form>

            <div className="max-h-64 overflow-y-auto mt-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Identifier</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
                        {users?.map(user => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.phone || user.email}</TableCell>
                                <TableCell className="capitalize">{user.role}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => onDeleteUser(user.id)} disabled={isPending || user.role === 'owner' || user.role === 'super-admin'}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
