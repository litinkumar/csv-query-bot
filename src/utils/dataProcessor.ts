
import { supabase } from "@/integrations/supabase/client";
import { QueryContext } from "./queryAnalyzer";

export interface ProcessedData {
  type: 'table' | 'chart' | 'funnel' | 'comparison';
  data: any;
  insights: string[];
  followUpSuggestions: string[];
}

export class DataProcessor {
  static async processQuery(queryContext: QueryContext, originalQuery: string): Promise<ProcessedData> {
    console.log('Processing query context:', queryContext);

    switch (queryContext.type) {
      case 'segmentation':
        return this.processSegmentationQuery(queryContext, originalQuery);
      case 'geographic':
        return this.processGeographicQuery(queryContext);
      case 'trend':
        return this.processTrendQuery(queryContext);
      case 'campaign':
        return this.processCampaignQuery(queryContext);
      default:
        return this.processGeneralQuery(queryContext, originalQuery);
    }
  }

  private static async processSegmentationQuery(queryContext: QueryContext, originalQuery: string): Promise<ProcessedData> {
    const dimension = queryContext.dimensions[0] || 'acq_region_1';
    const column = this.mapDimensionToColumn(dimension);
    
    const { data, error } = await supabase
      .from('sample_engagement_data')
      .select(`${column}, category_1, customers_1`)
      .not(column, 'is', null);

    if (error) {
      return {
        type: 'table',
        data: { error: error.message },
        insights: ['Unable to process segmentation query'],
        followUpSuggestions: []
      };
    }

    // Group by dimension
    const grouped = this.groupByDimension(data, column);
    const insights = this.generateSegmentationInsights(grouped, dimension);

    return {
      type: 'table',
      data: grouped,
      insights,
      followUpSuggestions: [
        `Would you like to see ${dimension} performance over time?`,
        `How about comparing the top ${dimension} segments?`,
        `Want to drill down into specific ${dimension} categories?`
      ]
    };
  }

  private static async processGeographicQuery(queryContext: QueryContext): Promise<ProcessedData> {
    const { data, error } = await supabase
      .from('sample_engagement_data')
      .select('acq_region_1, country_code_1, category_1, customers_1')
      .not('acq_region_1', 'is', null);

    if (error || !data) {
      return {
        type: 'table',
        data: { error: 'Unable to fetch geographic data' },
        insights: [],
        followUpSuggestions: []
      };
    }

    const regionData = this.aggregateGeographicData(data);
    const insights = this.generateGeographicInsights(regionData);

    return {
      type: 'chart',
      data: regionData,
      insights,
      followUpSuggestions: [
        'Would you like to see country-level breakdown?',
        'How about regional performance trends?',
        'Want to compare specific regions?'
      ]
    };
  }

  private static async processTrendQuery(queryContext: QueryContext): Promise<ProcessedData> {
    const { data, error } = await supabase
      .from('sample_engagement_data')
      .select('send_date_quarter_1, send_date_week_1, category_1, customers_1')
      .not('send_date_quarter_1', 'is', null)
      .order('send_date_quarter_1');

    if (error || !data) {
      return {
        type: 'table',
        data: { error: 'Unable to fetch trend data' },
        insights: [],
        followUpSuggestions: []
      };
    }

    const trendData = this.aggregateTrendData(data);
    const insights = this.generateTrendInsights(trendData);

    return {
      type: 'chart',
      data: trendData,
      insights,
      followUpSuggestions: [
        'Would you like to see weekly trends instead?',
        'How about trend analysis by program?',
        'Want to compare trends across regions?'
      ]
    };
  }

  private static async processCampaignQuery(queryContext: QueryContext): Promise<ProcessedData> {
    const { data, error } = await supabase
      .from('sample_engagement_data')
      .select('*')
      .not('campaign_id_1', 'is', null);

    if (error || !data) {
      return {
        type: 'table',
        data: { error: 'Unable to fetch campaign data' },
        insights: [],
        followUpSuggestions: []
      };
    }

    const campaignData = this.aggregateCampaignData(data);
    const insights = this.generateCampaignInsights(campaignData);

    return {
      type: 'table',
      data: campaignData,
      insights,
      followUpSuggestions: [
        'Would you like to see campaign performance by region?',
        'How about top performing campaigns?',
        'Want to analyze campaign funnel metrics?'
      ]
    };
  }

  private static async processGeneralQuery(queryContext: QueryContext, originalQuery: string): Promise<ProcessedData> {
    // Fallback to a general data overview
    const { data, error } = await supabase
      .from('sample_engagement_data')
      .select('*')
      .limit(1000);

    if (error || !data) {
      return {
        type: 'table',
        data: { error: 'Unable to process query' },
        insights: [`I couldn't find specific data for: "${originalQuery}"`],
        followUpSuggestions: [
          'Try asking about program performance',
          'How about regional analysis?',
          'Want to see campaign metrics?'
        ]
      };
    }

    const summary = this.generateDataSummary(data);
    
    return {
      type: 'table',
      data: summary,
      insights: [
        `I found ${data.length} records that might be relevant to your query.`,
        'Here\'s a summary of the available data dimensions.'
      ],
      followUpSuggestions: [
        'Would you like to see specific program analysis?',
        'How about geographic performance breakdown?',
        'Want to analyze trends over time?',
        'Interested in campaign-level metrics?'
      ]
    };
  }

  // Helper methods
  private static mapDimensionToColumn(dimension: string): string {
    const mapping: Record<string, string> = {
      'region': 'acq_region_1',
      'country': 'country_code_1',
      'program': 'program_name_1',
      'lesson': 'lesson_name_1',
      'product': 'primary_product_1',
      'tier': 'spend_tier_grouped_1',
      'language': 'language_1'
    };
    return mapping[dimension] || 'acq_region_1';
  }

  private static groupByDimension(data: any[], column: string) {
    const grouped = data.reduce((acc, record) => {
      const key = record[column] || 'Unknown';
      if (!acc[key]) {
        acc[key] = { deliveries: 0, opens: 0, clicks: 0 };
      }
      
      const category = record.category_1?.toLowerCase() || '';
      const count = record.customers_1 || 0;
      
      if (category.includes('deliver')) {
        acc[key].deliveries += count;
      } else if (category.includes('open')) {
        acc[key].opens += count;
      } else if (category.includes('click')) {
        acc[key].clicks += count;
      }
      
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, values]: [string, any]) => ({
      segment: key,
      ...values,
      openRate: values.deliveries > 0 ? (values.opens / values.deliveries * 100).toFixed(1) : '0.0',
      clickRate: values.deliveries > 0 ? (values.clicks / values.deliveries * 100).toFixed(1) : '0.0'
    }));
  }

  private static aggregateGeographicData(data: any[]) {
    // Similar grouping logic for geographic data
    return this.groupByDimension(data, 'acq_region_1');
  }

  private static aggregateTrendData(data: any[]) {
    return this.groupByDimension(data, 'send_date_quarter_1');
  }

  private static aggregateCampaignData(data: any[]) {
    return this.groupByDimension(data, 'campaign_id_1');
  }

  private static generateDataSummary(data: any[]) {
    const programs = [...new Set(data.map(d => d.program_name_1).filter(Boolean))];
    const regions = [...new Set(data.map(d => d.acq_region_1).filter(Boolean))];
    const quarters = [...new Set(data.map(d => d.send_date_quarter_1).filter(Boolean))];
    
    return {
      totalRecords: data.length,
      programs: programs.slice(0, 10),
      regions: regions.slice(0, 10),
      timeRange: quarters.sort(),
      availableMetrics: ['Deliveries', 'Opens', 'Clicks', 'Conversion Rates']
    };
  }

  private static generateSegmentationInsights(data: any[], dimension: string): string[] {
    const sorted = data.sort((a, b) => b.deliveries - a.deliveries);
    const top = sorted[0];
    const insights = [];
    
    if (top) {
      insights.push(`Top performing ${dimension}: ${top.segment} with ${top.deliveries.toLocaleString()} deliveries`);
      insights.push(`Best ${dimension} open rate: ${top.openRate}%`);
    }
    
    return insights;
  }

  private static generateGeographicInsights(data: any[]): string[] {
    const sorted = data.sort((a, b) => b.deliveries - a.deliveries);
    return [
      `Top region: ${sorted[0]?.segment} with ${sorted[0]?.deliveries.toLocaleString()} deliveries`,
      `${data.length} regions analyzed`
    ];
  }

  private static generateTrendInsights(data: any[]): string[] {
    return [
      `Analysis covers ${data.length} time periods`,
      'Trend data shows performance over quarters'
    ];
  }

  private static generateCampaignInsights(data: any[]): string[] {
    return [
      `${data.length} campaigns analyzed`,
      'Campaign performance varies significantly'
    ];
  }
}
