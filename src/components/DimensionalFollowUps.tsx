
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Dimension {
  name: string;
  label: string;
  values: string[];
}

interface DimensionalFollowUpsProps {
  availableDimensions: Dimension[];
  onDimensionSelect: (dimension: string, value?: string) => void;
  className?: string;
}

export function DimensionalFollowUps({ 
  availableDimensions, 
  onDimensionSelect, 
  className = "" 
}: DimensionalFollowUpsProps) {
  if (availableDimensions.length === 0) return null;

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Explore by Dimension
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {availableDimensions.map((dimension) => (
            <Button
              key={dimension.name}
              variant="outline"
              size="sm"
              onClick={() => onDimensionSelect(dimension.name)}
              className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              View by {dimension.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
