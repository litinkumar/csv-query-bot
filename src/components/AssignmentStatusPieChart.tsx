import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface AssignmentData {
  name: string;
  value: number;
  percentage: number;
  spendTiers?: SpendTierData[];
}

interface SpendTierData {
  name: string;
  value: number;
  percentage: number;
}

interface AssignmentStatusPieChartProps {
  data: AssignmentData[];
  className?: string;
}

const ASSIGNMENT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
];

const SPEND_TIER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--muted))'
];

export function AssignmentStatusPieChart({ data, className = "" }: AssignmentStatusPieChartProps) {
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<SpendTierData[]>([]);

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Assignment Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No assignment status data available for visualization.</p>
        </CardContent>
      </Card>
    );
  }

  const handlePieClick = (entry: any) => {
    const assignmentData = data.find(item => item.name === entry.name);
    if (assignmentData && assignmentData.spendTiers) {
      setSelectedAssignment(entry.name);
      setDrillDownData(assignmentData.spendTiers);
    }
  };

  const handleBack = () => {
    setSelectedAssignment(null);
    setDrillDownData([]);
  };

  const renderCustomTooltip = (props: any) => {
    if (props.active && props.payload && props.payload[0]) {
      const data = props.payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Count: {data.value.toLocaleString()} ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const currentData = selectedAssignment ? drillDownData : data;
  const currentTitle = selectedAssignment 
    ? `Spend Tier Distribution - ${selectedAssignment}` 
    : "Assignment Status Distribution";
  const currentColors = selectedAssignment ? SPEND_TIER_COLORS : ASSIGNMENT_COLORS;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {selectedAssignment && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {currentTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={currentData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
              onClick={selectedAssignment ? undefined : handlePieClick}
              style={{ cursor: selectedAssignment ? 'default' : 'pointer' }}
            >
              {currentData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={currentColors[index % currentColors.length]} 
                />
              ))}
            </Pie>
            <Tooltip content={renderCustomTooltip} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        
        {!selectedAssignment && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Click on a slice to drill down into spend tier distribution
          </p>
        )}
      </CardContent>
    </Card>
  );
}