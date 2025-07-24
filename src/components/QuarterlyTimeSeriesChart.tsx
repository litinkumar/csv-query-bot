import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface QuarterlyData {
  quarter: string;
  deliveries: number;
  opens: number;
  clicks: number;
  adoptions: number;
}

interface QuarterlyTimeSeriesChartProps {
  data: QuarterlyData[];
  className?: string;
}

export function QuarterlyTimeSeriesChart({ data, className = "" }: QuarterlyTimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Quarterly Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No quarterly data available for visualization.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Quarterly Performance Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="quarter" />
            <YAxis />
            <Tooltip 
              formatter={(value: number, name: string) => [
                value.toLocaleString(), 
                name.charAt(0).toUpperCase() + name.slice(1)
              ]}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="deliveries" 
              stroke="hsl(var(--chart-1))" 
              strokeWidth={2}
              name="Deliveries"
            />
            <Line 
              type="monotone" 
              dataKey="opens" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              name="Opens"
            />
            <Line 
              type="monotone" 
              dataKey="clicks" 
              stroke="hsl(var(--chart-3))" 
              strokeWidth={2}
              name="Clicks"
            />
            <Line 
              type="monotone" 
              dataKey="adoptions" 
              stroke="hsl(var(--chart-4))" 
              strokeWidth={2}
              name="Adoptions"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}