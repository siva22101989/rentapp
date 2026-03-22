
'use client';
import { useState, useTransition } from 'react';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cleanForFirestore } from '@/lib/utils';
import type { AppUser, UserRole } from '@/lib/definitions';
import { userRoles } from '@/lib/definitions';

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

const AddUserSchema = z.object({
    email: z.string().email('Please enter a valid email address.'),
    role: z.enum(userRoles, { required_error: 'Please select a role.' }),
});

type AddUserFormData = z.infer<typeof AddUserSchema>;


export function ManageTeamDialog({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const usersQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'users') : null),
        [firestore]
    );
    const { data: users, loading } = useCollection<AppUser>(usersQuery);

    const form = useForm<AddUserFormData>({
        resolver: zodResolver(AddUserSchema),
        defaultValues: { email: '', role: 'biller' },
    });

    const onAddUser = (data: AddUserFormData) => {
        if (!firestore) return;
        
        // Check if user already exists
        if (users?.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
            form.setError('email', { message: 'This user already exists in the team.' });
            return;
        }

        startTransition(async () => {
            try {
                await addDoc(collection(firestore, 'users'), cleanForFirestore({
                    email: data.email.toLowerCase(),
                    role: data.role,
                }));
                toast({ title: 'Success', description: 'User added to the team.' });
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
                    Add or remove users and assign their roles. Users will need to sign in with the exact Google account email.
                </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddUser)} className="flex items-end gap-2">
                     <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel className="sr-only">Email</FormLabel>
                                <FormControl><Input placeholder="user@example.com" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                                 <FormLabel className="sr-only">Role</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {userRoles.map(role => (
                                            <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <Button type="submit" disabled={isPending}>
                         {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                    </Button>
                </form>
            </Form>

            <div className="max-h-64 overflow-y-auto mt-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
                        {users?.map(user => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.email}</TableCell>
                                <TableCell className="capitalize">{user.role}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => onDeleteUser(user.id)} disabled={isPending || user.role === 'owner'}>
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
