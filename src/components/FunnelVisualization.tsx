import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FunnelData {
  deliveries: number;
  opens: number;
  clicks: number;
  adoptions: number;
  openRate: number;
  clickRate: number;
  clickThroughOpenRate: number;
  adoptionRate: number;
}

interface FunnelVisualizationProps {
  data: FunnelData;
  title: string;
  className?: string;
}

export function FunnelVisualization({ data, title, className = "" }: FunnelVisualizationProps) {
  const formatNumber = (num: number) => num.toLocaleString();

  // Calculate widths as percentage of deliveries (top of funnel)
  const getWidth = (value: number) => {
    return data.deliveries > 0 ? (value / data.deliveries) * 100 : 0;
  };

  const funnelSteps = [
    { 
      label: "Deliveries", 
      value: data.deliveries, 
      icon: "📧", 
      color: "bg-blue-500",
      width: 100 
    },
    { 
      label: "Opens", 
      value: data.opens, 
      icon: "📖", 
      color: "bg-yellow-500",
      width: getWidth(data.opens) 
    },
    { 
      label: "Clicks", 
      value: data.clicks, 
      icon: "🖱️", 
      color: "bg-pink-500",
      width: getWidth(data.clicks) 
    },
    { 
      label: "Adoptions", 
      value: data.adoptions, 
      icon: "✅", 
      color: "bg-green-500",
      width: getWidth(data.adoptions) 
    }
  ];

  return (
    <Card className={`${className} overflow-hidden`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Funnel Visualization */}
        <div className="flex flex-col items-center space-y-2 py-4">
          {funnelSteps.map((step, index) => (
            <div 
              key={step.label}
              className="flex flex-col items-center"
              style={{ width: `${step.width}%`, minWidth: '40%' }}
            >
              <div 
                className={`${step.color} rounded-xl flex items-center justify-center py-3 px-4 text-white text-sm font-medium transition-all duration-500 w-full`}
              >
                <span className="mr-2">{step.icon}</span>
                <span className="mr-2">{step.label}</span>
                <span className="font-mono">{formatNumber(step.value)}</span>
              </div>
              {index < funnelSteps.length - 1 && (
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-300 mt-1" />
              )}
            </div>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground">Key Metrics</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs">Open Rate</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {data.openRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs">Click Rate</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {data.clickRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs">Click Through Open Rate</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {data.clickThroughOpenRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs">Adoption Rate</span>
              <Badge variant="secondary" className="text-xs font-mono">
                {data.adoptionRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}