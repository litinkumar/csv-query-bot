
import { supabase } from "@/integrations/supabase/client";

export interface Dimension {
  name: string;
  label: string;
  values: string[];
}

export class DimensionService {
  private static dimensionConfig = {
    'acq_region_1': { label: 'Region', priority: 1 },
    'spend_tier_grouped_1': { label: 'Spend Tier', priority: 2 },
    'send_date_quarter_1': { label: 'Quarter', priority: 3 },
    'program_name_1': { label: 'Program', priority: 4 },
    'primary_product_1': { label: 'Product', priority: 5 },
    'country_code_1': { label: 'Country', priority: 6 },
    'language_1': { label: 'Language', priority: 7 }
  };

  static async getAvailableDimensions(currentContext?: any): Promise<Dimension[]> {
    const dimensions: Dimension[] = [];
    
    try {
      // Get unique values for each dimension
      for (const [columnName, config] of Object.entries(this.dimensionConfig)) {
        const { data, error } = await supabase
          .from('sample_engagement_data')
          .select(columnName)
          .not(columnName, 'is', null)
          .limit(20);

        if (!error && data) {
          const uniqueValues = [...new Set(data.map(row => row[columnName]).filter(Boolean))];
          
          if (uniqueValues.length > 1) {
            dimensions.push({
              name: columnName,
              label: config.label,
              values: uniqueValues.slice(0, 10) // Limit to top 10 values
            });
          }
        }
      }

      // Sort by priority and return top 6
      return dimensions
        .sort((a, b) => 
          (this.dimensionConfig[a.name as keyof typeof this.dimensionConfig]?.priority || 999) - 
          (this.dimensionConfig[b.name as keyof typeof this.dimensionConfig]?.priority || 999)
        )
        .slice(0, 6);

    } catch (error) {
      console.error('Error fetching dimensions:', error);
      return [];
    }
  }

  static generateFollowUpQuery(originalQuery: string, dimension: string, value?: string): string {
    const dimensionLabels = {
      'acq_region_1': 'region',
      'spend_tier_grouped_1': 'spend tier',
      'send_date_quarter_1': 'quarter',
      'program_name_1': 'program',
      'primary_product_1': 'product',
      'country_code_1': 'country',
      'language_1': 'language'
    };

    const dimensionLabel = dimensionLabels[dimension as keyof typeof dimensionLabels] || dimension;
    
    if (value) {
      return `${originalQuery} for ${dimensionLabel} ${value}`;
    } else {
      return `${originalQuery} broken down by ${dimensionLabel}`;
    }
  }
}
