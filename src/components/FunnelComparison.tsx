import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FunnelVisualization } from "./FunnelVisualization";

interface FunnelData {
  deliveries: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickThroughRate: number;
  clickThroughOpenRate: number;
}

interface FunnelPerformance {
  name: string;
  type: 'program' | 'lesson';
  totalFunnel: FunnelData;
  regionBreakdown: Record<string, FunnelData>;
  timeFilter?: string;
}

interface FunnelComparisonProps {
  performance1: FunnelPerformance;
  performance2: FunnelPerformance;
  className?: string;
}

export function FunnelComparison({ performance1, performance2, className = "" }: FunnelComparisonProps) {
  const p1 = performance1.totalFunnel;
  const p2 = performance2.totalFunnel;

  const getMetricComparison = (val1: number, val2: number, suffix = '%') => {
    const diff = val1 - val2;
    const isPositive = diff > 0;
    const absPercent = Math.abs((diff / val2) * 100);
    
    if (Math.abs(diff) < 0.1) return 'Even';
    
    return (
      <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        <span>{isPositive ? '↗' : '↘'}</span>
        <span>{absPercent.toFixed(1)}% {isPositive ? 'higher' : 'lower'}</span>
      </div>
    );
  };

  return (
    <div className={`space-y-4 w-full overflow-hidden ${className}`}>
      {/* Visual Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelVisualization 
          data={p1} 
          title={performance1.name}
        />
        <FunnelVisualization 
          data={p2} 
          title={performance2.name}
        />
      </div>

      {/* Metrics Comparison Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Side-by-Side Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 overflow-x-auto">
            <div className="grid grid-cols-4 gap-2 md:gap-4 text-xs font-medium text-muted-foreground border-b pb-2 min-w-[300px]">
              <div>Metric</div>
              <div className="text-center truncate">{performance1.name}</div>
              <div className="text-center truncate">{performance2.name}</div>
              <div className="text-center">Difference</div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 md:gap-4 text-xs items-center min-w-[300px]">
              <div className="font-medium">Deliveries</div>
              <div className="text-center font-mono text-xs">{p1.deliveries.toLocaleString()}</div>
              <div className="text-center font-mono text-xs">{p2.deliveries.toLocaleString()}</div>
              <div className="text-center">
                {getMetricComparison(p1.deliveries, p2.deliveries, '')}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 md:gap-4 text-xs items-center min-w-[300px]">
              <div className="font-medium">Open Rate</div>
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">{p1.openRate.toFixed(1)}%</Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">{p2.openRate.toFixed(1)}%</Badge>
              </div>
              <div className="text-center">
                {getMetricComparison(p1.openRate, p2.openRate)}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 md:gap-4 text-xs items-center min-w-[300px]">
              <div className="font-medium">Click Through Rate</div>
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">{p1.clickThroughRate.toFixed(1)}%</Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">{p2.clickThroughRate.toFixed(1)}%</Badge>
              </div>
              <div className="text-center">
                {getMetricComparison(p1.clickThroughRate, p2.clickThroughRate)}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 md:gap-4 text-xs items-center min-w-[300px]">
              <div className="font-medium">Click Through Open Rate</div>
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">{p1.clickThroughOpenRate.toFixed(1)}%</Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">{p2.clickThroughOpenRate.toFixed(1)}%</Badge>
              </div>
              <div className="text-center">
                {getMetricComparison(p1.clickThroughOpenRate, p2.clickThroughOpenRate)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
