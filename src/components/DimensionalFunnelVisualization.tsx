
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelVisualization } from "./FunnelVisualization";

interface DimensionalFunnelData {
  [dimensionValue: string]: {
    deliveries: number;
    opens: number;
    clicks: number;
    adoptions: number;
    openRate: number;
    clickThroughRate: number;
    clickThroughOpenRate: number;
    adoptionRate: number;
  };
}

interface DimensionalFunnelVisualizationProps {
  data: DimensionalFunnelData;
  title: string;
  className?: string;
}

export function DimensionalFunnelVisualization({ 
  data, 
  title, 
  className = "" 
}: DimensionalFunnelVisualizationProps) {
  const dimensionValues = Object.keys(data);
  
  if (dimensionValues.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-muted-foreground">No data available for breakdown.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dimensionValues.map((dimensionValue) => (
            <FunnelVisualization
              key={dimensionValue}
              data={data[dimensionValue]}
              title={dimensionValue}
              className="w-full"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
