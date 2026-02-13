'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils';


interface FinancialSummaryChartProps {
    data: {
        month: string;
        income: number;
        expenses: number;
    }[];
}

const chartConfig = {
    income: {
        label: 'Income',
        color: 'hsl(var(--chart-2))',
    },
    expenses: {
        label: 'Expenses',
        color: 'hsl(var(--chart-5))',
    },
} satisfies ChartConfig;


export function FinancialSummaryChart({ data }: FinancialSummaryChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[350px] flex items-center justify-center">
                <p className="text-muted-foreground">Not enough data to display chart.</p>
            </div>
        );
    }
    
    return (
        <div className="h-[350px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={12}
                        />
                         <YAxis
                            tickFormatter={(value) => formatCurrency(Number(value))}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={12}
                            width={80}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent
                                labelClassName="font-bold"
                                formatter={(value) => formatCurrency(Number(value))}
                            />}
                        />
                        <Legend />
                        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartContainer>
        </div>
    );
}
