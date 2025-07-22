
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FunnelData {
  deliveries: number;
  opens: number;
  clicks: number;
  adoptions: number;
  openRate: number;
  clickThroughRate: number;
  clickThroughOpenRate: number;
  adoptionRate: number;
}

interface FunnelVisualizationProps {
  data: FunnelData;
  title: string;
  className?: string;
}

export function FunnelVisualization({ data, title, className = "" }: FunnelVisualizationProps) {
  const maxValue = Math.max(data.deliveries, data.opens, data.clicks, data.adoptions);
  
  const getBarWidth = (value: number) => {
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  };

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <Card className={`${className} overflow-hidden`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Funnel Bars */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                📧 <span>Deliveries</span>
              </span>
              <span className="font-mono text-lg">{formatNumber(data.deliveries)}</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${getBarWidth(data.deliveries)}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                📖 <span>Opens</span>
              </span>
              <span className="font-mono text-lg">{formatNumber(data.opens)}</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${getBarWidth(data.opens)}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                🖱️ <span>Clicks</span>
              </span>
              <span className="font-mono text-lg">{formatNumber(data.clicks)}</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${getBarWidth(data.clicks)}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                ✅ <span>Adoptions</span>
              </span>
              <span className="font-mono text-lg">{formatNumber(data.adoptions)}</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-700 ease-out rounded-full"
                style={{ width: `${getBarWidth(data.adoptions)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Conversion Rates */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Open Rate</div>
              <Badge variant="secondary" className="text-sm font-semibold">
                {data.openRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Click Rate</div>
              <Badge variant="secondary" className="text-sm font-semibold">
                {data.clickThroughRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">CTOR</div>
              <Badge variant="secondary" className="text-sm font-semibold">
                {data.clickThroughOpenRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Adoption Rate</div>
              <Badge variant="secondary" className="text-sm font-semibold">
                {data.adoptionRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
