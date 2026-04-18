
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
import type { Commodity } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { formatCurrency } from "@/lib/utils";
import { CommodityActionsMenu } from "./commodity-actions-menu";
import { Badge } from "../ui/badge";
import { useAppUser } from "@/firebase/auth/use-user";

export function CommoditiesTable() {
  const firestore = useFirestore();
  const appUser = useAppUser();

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'commodities') : null),
    [firestore, appUser]
  );
  const { data: commodities, loading } = useCollection<Commodity>(commoditiesQuery);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commodity Name</TableHead>
              <TableHead>Billing Type</TableHead>
              <TableHead className="text-right">Rates</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commodities?.map((commodity) => (
              <TableRow key={commodity.id}>
                <TableCell className="font-medium">{commodity.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">{commodity.billingType || 'Slab'}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {commodity.billingType === 'monthly'
                    ? `${formatCurrency(commodity.monthlyRate || 0)}/mo ${commodity.insuranceRate ? `+ ${formatCurrency(commodity.insuranceRate)} ins/yr` : ''} ${commodity.minBillingMonths ? `(min ${commodity.minBillingMonths}m)` : ''}`
                    : `${formatCurrency(commodity.rate6Months || 0)} / 6M, ${formatCurrency(commodity.rate1Year || 0)} / 1Y`
                  }
                </TableCell>
                <TableCell>
                  <CommodityActionsMenu commodity={commodity} />
                </TableCell>
              </TableRow>
            ))}
            {commodities?.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No commodities found. Add one to get started.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
