import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RegionalData {
  region: string;
  deliveries: number;
  opens: number;
  clicks: number;
  adoptions: number;
}

interface RegionalBarChartProps {
  data: RegionalData[];
  className?: string;
}

export function RegionalBarChart({ data, className = "" }: RegionalBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Regional Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No regional data available for visualization.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Regional Performance Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="region" />
            <YAxis />
            <Tooltip 
              formatter={(value: number, name: string) => [
                value.toLocaleString(), 
                name.charAt(0).toUpperCase() + name.slice(1)
              ]}
            />
            <Legend />
            <Bar dataKey="deliveries" fill="hsl(var(--chart-1))" name="Deliveries" />
            <Bar dataKey="opens" fill="hsl(var(--chart-2))" name="Opens" />
            <Bar dataKey="clicks" fill="hsl(var(--chart-3))" name="Clicks" />
            <Bar dataKey="adoptions" fill="hsl(var(--chart-4))" name="Adoptions" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}