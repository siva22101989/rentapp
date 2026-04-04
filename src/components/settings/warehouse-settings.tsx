'use client';

import { WarehouseInfoForm } from './warehouse-info-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function WarehouseSettings() {
    return (
        <div className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Warehouse Information</CardTitle>
                    <CardDescription>
                        Edit your warehouse name, address, and phone number. This information will appear on all receipts and reports.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <WarehouseInfoForm />
                </CardContent>
            </Card>
        </div>
    );
}
