
'use client';

import { WarehouseInfoForm } from './warehouse-info-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function WarehouseSettings() {
    return (
        <div className="grid md:grid-cols-3 gap-8 mt-6">
            <div className="md:col-span-2">
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
            <div className="md:col-span-1">
                {/* Placeholder for future settings related to warehouse */}
            </div>
        </div>
    );
}
