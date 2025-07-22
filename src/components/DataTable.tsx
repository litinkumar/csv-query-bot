
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DataTableProps {
  data: any[];
  title: string;
  className?: string;
}

export function DataTable({ data, title, className = "" }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const columns = Object.keys(data[0]);
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                {columns.map((column) => (
                  <th key={column} className="text-left p-2 font-medium">
                    {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, index) => (
                <tr key={index} className="border-b">
                  {columns.map((column) => (
                    <td key={column} className="p-2">
                      {typeof row[column] === 'number' && column.includes('Rate') ? (
                        <Badge variant="secondary" className="text-xs">
                          {row[column]}%
                        </Badge>
                      ) : typeof row[column] === 'number' ? (
                        row[column].toLocaleString()
                      ) : (
                        row[column]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 10 && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Showing 10 of {data.length} results
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
