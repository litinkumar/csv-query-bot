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

interface FunnelVisualizationProps {
  data: FunnelData;
  title: string;
  className?: string;
}

export function FunnelVisualization({ data, title, className = "" }: FunnelVisualizationProps) {
  const maxValue = Math.max(data.deliveries, data.opens, data.clicks);
  
  const getBarWidth = (value: number) => {
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  };

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <Card className={`${className} overflow-hidden`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Funnel Bars */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1">
                📧 <span className="font-medium">Deliveries</span>
              </span>
              <span className="font-mono">{formatNumber(data.deliveries)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-700 ease-out"
                style={{ width: `${getBarWidth(data.deliveries)}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1">
                📖 <span className="font-medium">Opens</span>
              </span>
              <span className="font-mono">{formatNumber(data.opens)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-700 ease-out"
                style={{ width: `${getBarWidth(data.opens)}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1">
                🖱️ <span className="font-medium">Clicks</span>
              </span>
              <span className="font-mono">{formatNumber(data.clicks)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-700 ease-out"
                style={{ width: `${getBarWidth(data.clicks)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="pt-2 border-t space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Key Metrics</h4>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs">Open Rate</span>
              <Badge variant="secondary" className="text-xs">
                {data.openRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs">Click Through Rate</span>
              <Badge variant="secondary" className="text-xs">
                {data.clickThroughRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs">Click Through Open Rate</span>
              <Badge variant="secondary" className="text-xs">
                {data.clickThroughOpenRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}