
'use client';
import { useState, useTransition } from 'react';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cleanForFirestore } from '@/lib/utils';
import type { AppUser } from '@/lib/definitions';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2 } from 'lucide-react';

const teamMemberRoles = ['owner', 'supervisor', 'biller'] as const;

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

    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'owner' | 'supervisor' | 'biller'>('biller');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (phone.length < 10) {
            setError('Please enter a valid 10-digit phone number.');
            return;
        }

        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Could not add user: warehouse context is missing.', variant: 'destructive' });
            return;
        }
        
        if (users?.some(u => u.phone === phone)) {
            setError('A user with this phone number already exists.');
            return;
        }

        startTransition(async () => {
            try {
                await addDoc(collection(firestore, 'users'), cleanForFirestore({
                    phone: phone,
                    role: role,
                    warehouseId: appUser.warehouseId,
                }));
                toast({ title: 'Success', description: 'User added. They can now sign in with their phone number and a password of their choice.' });
                setPhone('');
                setRole('biller');
                setError('');
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
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 items-start gap-2 pt-4">
                <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="flex items-end gap-2 sm:col-span-2">
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select onValueChange={(value: 'owner' | 'supervisor' | 'biller') => setRole(value)} value={role}>
                            <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {teamMemberRoles.map(role => (
                                    <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" disabled={isPending} className="self-end h-10">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                    </Button>
                </div>
                {error && <p className="text-sm font-medium text-destructive col-span-3">{error}</p>}
            </form>

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
                        {users?.filter(user => user.role !== 'super-admin').map(user => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.phone || user.email}</TableCell>
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
