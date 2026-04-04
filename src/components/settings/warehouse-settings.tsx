
'use client';

import { WarehouseInfoForm } from './warehouse-info-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ManageTeamDialog } from './manage-team-dialog';
import { Button } from '../ui/button';
import { Users } from 'lucide-react';

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
                <Card>
                    <CardHeader>
                        <CardTitle>Team Management</CardTitle>
                        <CardDescription>
                            Add or remove team members and manage their roles.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ManageTeamDialog>
                            <Button variant="outline" className="w-full">
                                <Users className="mr-2 h-4 w-4" />
                                Manage Team Members
                            </Button>
                        </ManageTeamDialog>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
