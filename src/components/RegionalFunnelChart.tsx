import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FunnelData {
  deliveries: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickThroughRate: number;
  clickThroughOpenRate: number;
}

interface RegionalFunnelChartProps {
  regionBreakdown: Record<string, FunnelData>;
  className?: string;
}

export function RegionalFunnelChart({ regionBreakdown, className = "" }: RegionalFunnelChartProps) {
  const regions = Object.keys(regionBreakdown);
  
  if (regions.length === 0) {
    return null;
  }

  const maxDeliveries = Math.max(...regions.map(region => regionBreakdown[region].deliveries));
  const sortedRegions = regions.sort((a, b) => 
    regionBreakdown[b].deliveries - regionBreakdown[a].deliveries
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Regional Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedRegions.map((region) => {
          const data = regionBreakdown[region];
          const barWidth = maxDeliveries > 0 ? (data.deliveries / maxDeliveries) * 100 : 0;
          
          return (
            <div key={region} className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-sm">{region}</h4>
                <Badge variant="outline" className="text-xs">
                  {data.deliveries.toLocaleString()} deliveries
                </Badge>
              </div>
              
              {/* Delivery bar */}
              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700 ease-out"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              
              {/* Metrics row */}
              <div className="flex gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Open: {data.openRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>CTR: {data.clickThroughRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>CTOR: {data.clickThroughOpenRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}