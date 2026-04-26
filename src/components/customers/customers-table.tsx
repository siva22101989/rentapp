'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { Customer } from "@/lib/definitions";
import { CustomerActionsMenu } from "@/components/customers/customer-actions-menu";
import { useAppUser } from "@/firebase/auth/use-user";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Eye } from "lucide-react";

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const appUser = useAppUser();
  const canEdit = appUser?.role === 'owner' || appUser?.role === 'super-admin';

  if (!customers || customers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No customers found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                     <Button asChild variant="outline" size="icon" className="h-8 w-8">
                        <Link href={`/reports?report=inflow-register&customerId=${customer.id}`} title="View Records">
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View Records</span>
                        </Link>
                     </Button>
                    {canEdit && <CustomerActionsMenu customer={customer} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
