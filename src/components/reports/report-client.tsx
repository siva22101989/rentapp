'use client';

import { useState, useRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2, UserSearch } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CustomerStatement } from './customer-statement';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

export function ReportClient({ records, customers, unloadingRecords, initialCustomerId }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], initialCustomerId?: string }) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const firestore = useFirestore();
    
    const statementReportRef = useRef<HTMLDivElement>(null);

    const statementCustomer = customers.find(c => c.id === selectedCustomerId);
    const statementRecords = records.filter(r => r.customerId === selectedCustomerId);
    const statementUnloadingRecords = unloadingRecords.filter(r => r.customerId === selectedCustomerId);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore ? doc(firestore, 'settings', 'main') : null),
      [firestore]
    );
    const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const handleDownloadPdf = async () => {
        const element = statementReportRef.current;
        if (!element) return;

        setIsGenerating(true);

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgProps= pdf.getImageProperties(imgData);
            const imgWidth = imgProps.width;
            const imgHeight = imgProps.height;
            
            const ratio = imgWidth / imgHeight;
            
            let widthInPdf = pdfWidth; 
            let heightInPdf = widthInPdf / ratio;
            
            if (heightInPdf < pdfHeight) {
                // If it fits on one page, center it vertically
                const y = (pdfHeight - heightInPdf) / 2;
                pdf.addImage(imgData, 'PNG', 0, y, widthInPdf, heightInPdf);
            } else {
                // For multi-page, add page by page
                let position = 0;
                let heightLeft = heightInPdf;

                pdf.addImage(imgData, 'PNG', 0, position, widthInPdf, heightInPdf);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position = position - pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, widthInPdf, heightInPdf);
                    heightLeft -= pdfHeight;
                }
            }
            
            pdf.save(`statement-${selectedCustomerId}-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog>
            <Card>
                <CardHeader>
                    <CardTitle>
                        Customer Statement of Account
                    </CardTitle>
                     <CardDescription>Select a customer to generate a detailed statement of their account activity.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex items-center gap-4 w-full md:w-auto">
                        <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                            <SelectTrigger className="w-full md:w-[280px]">
                                <SelectValue placeholder="Select a customer..." />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(customer => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DialogTrigger asChild>
                            <Button disabled={!selectedCustomerId}>View Statement</Button>
                        </DialogTrigger>
                    </div>
                    {!selectedCustomerId && (
                        <div className="text-center text-muted-foreground py-16">
                            <UserSearch className="mx-auto h-12 w-12" />
                            <p className="mt-4">
                                Please select a customer to generate their statement.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <DialogContent className="max-w-6xl p-0">
                 {loadingWarehouseInfo && <div className="p-8 text-center">Loading statement...</div>}
                {!loadingWarehouseInfo && statementCustomer ? (
                    <div ref={statementReportRef} className="p-4 max-h-[80vh] overflow-y-auto">
                        <CustomerStatement 
                          customer={statementCustomer} 
                          records={statementRecords} 
                          unloadingRecords={statementUnloadingRecords} 
                          warehouseInfo={warehouseInfo}
                        />
                    </div>
                ) : (
                    <div className="p-8 text-center text-muted-foreground">Please select a customer.</div>
                )}
                 <DialogFooter className="p-4 border-t">
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                    <Button onClick={handleDownloadPdf} disabled={isGenerating || !selectedCustomerId}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Print PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
