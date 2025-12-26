
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
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { formatCurrency } from "@/lib/utils";
import { CommodityActionsMenu } from "./commodity-actions-menu";

export function CommoditiesTable() {
  const firestore = useFirestore();
  const commoditiesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'commodities') : null),
    [firestore]
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
              <TableHead className="text-right">6-Month Rate</TableHead>
              <TableHead className="text-right">1-Year Rate</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commodities?.map((commodity) => (
              <TableRow key={commodity.id}>
                <TableCell className="font-medium">{commodity.name}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(commodity.rate6Months)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(commodity.rate1Year)}</TableCell>
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
