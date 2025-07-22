
import { supabase } from "@/integrations/supabase/client";

export interface QueryContext {
  type: 'funnel' | 'comparison' | 'trend' | 'segmentation' | 'geographic' | 'campaign' | 'general';
  entities: string[];
  dimensions: string[];
  timeFilter?: string;
  aggregationType?: 'sum' | 'avg' | 'count' | 'rate';
  comparisonType?: 'vs' | 'over_time' | 'by_segment';
}

export class QueryAnalyzer {
  private static DIMENSION_KEYWORDS = {
    region: ['region', 'geographic', 'location', 'area'],
    country: ['country', 'nation', 'countries'],
    program: ['program', 'course', 'training'],
    lesson: ['lesson', 'module', 'chapter'],
    product: ['product', 'item'],
    tier: ['tier', 'level', 'spend level'],
    language: ['language', 'lang'],
    quarter: ['quarter', 'q1', 'q2', 'q3', 'q4'],
    campaign: ['campaign', 'send', 'email'],
    funnel: ['funnel', 'deliveries', 'opens', 'clicks', 'conversion']
  };

  private static COMPARISON_KEYWORDS = ['vs', 'versus', 'compare', 'comparison', 'against', 'with'];
  private static TREND_KEYWORDS = ['trend', 'over time', 'timeline', 'progression', 'change'];
  private static SEGMENTATION_KEYWORDS = ['by', 'breakdown', 'segment', 'split', 'group'];

  static async analyzeQuery(query: string, recentContext?: any[]): Promise<QueryContext> {
    const lowerQuery = query.toLowerCase();
    
    // Detect query type
    let type: QueryContext['type'] = 'general';
    
    if (this.COMPARISON_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
      type = 'comparison';
    } else if (this.TREND_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
      type = 'trend';
    } else if (this.SEGMENTATION_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
      type = 'segmentation';
    } else if (Object.keys(this.DIMENSION_KEYWORDS).some(dim => 
      this.DIMENSION_KEYWORDS[dim as keyof typeof this.DIMENSION_KEYWORDS]
        .some(keyword => lowerQuery.includes(keyword))
    )) {
      type = 'funnel';
    }

    // Extract dimensions
    const dimensions: string[] = [];
    Object.entries(this.DIMENSION_KEYWORDS).forEach(([dim, keywords]) => {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        dimensions.push(dim);
      }
    });

    // Extract entities (programs, lessons, etc.)
    const entities = await this.extractEntities(query);

    // Extract time filter
    const timeFilter = this.extractTimeFilter(query);

    return {
      type,
      entities,
      dimensions,
      timeFilter,
      aggregationType: this.detectAggregationType(query),
      comparisonType: this.detectComparisonType(query)
    };
  }

  private static async extractEntities(query: string): Promise<string[]> {
    const entities: string[] = [];
    
    // Try to find program names
    const { data: programs } = await supabase
      .from('Onboarding_Dunmmy_Data')
      .select('program_name_1')
      .not('program_name_1', 'is', null)
      .limit(100);

    if (programs) {
      const uniquePrograms = [...new Set(programs.map(p => p.program_name_1).filter(Boolean))];
      uniquePrograms.forEach(program => {
        if (query.toLowerCase().includes(program.toLowerCase())) {
          entities.push(program);
        }
      });
    }

    // Try to find lesson names
    const { data: lessons } = await supabase
      .from('Onboarding_Dunmmy_Data')
      .select('lesson_name_1')
      .not('lesson_name_1', 'is', null)
      .limit(100);

    if (lessons) {
      const uniqueLessons = [...new Set(lessons.map(l => l.lesson_name_1).filter(Boolean))];
      uniqueLessons.forEach(lesson => {
        if (query.toLowerCase().includes(lesson.toLowerCase())) {
          entities.push(lesson);
        }
      });
    }

    return entities;
  }

  private static extractTimeFilter(query: string): string | undefined {
    const lowerQuery = query.toLowerCase();
    
    // Check for quarters
    const quarterMatch = lowerQuery.match(/q([1-4])|quarter\s*([1-4])/);
    if (quarterMatch) {
      const quarter = quarterMatch[1] || quarterMatch[2];
      const year = new Date().getFullYear();
      return `${year}-Q${quarter}`;
    }

    // Check for current quarter
    if (lowerQuery.includes('this quarter') || lowerQuery.includes('current quarter')) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const quarter = Math.ceil(month / 3);
      return `${year}-Q${quarter}`;
    }

    return undefined;
  }

  private static detectAggregationType(query: string): 'sum' | 'avg' | 'count' | 'rate' | undefined {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('total') || lowerQuery.includes('sum')) return 'sum';
    if (lowerQuery.includes('average') || lowerQuery.includes('avg')) return 'avg';
    if (lowerQuery.includes('count') || lowerQuery.includes('number')) return 'count';
    if (lowerQuery.includes('rate') || lowerQuery.includes('percentage')) return 'rate';
    
    return undefined;
  }

  private static detectComparisonType(query: string): 'vs' | 'over_time' | 'by_segment' | undefined {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('vs') || lowerQuery.includes('versus') || lowerQuery.includes('compare')) return 'vs';
    if (lowerQuery.includes('over time') || lowerQuery.includes('timeline')) return 'over_time';
    if (lowerQuery.includes('by') || lowerQuery.includes('breakdown')) return 'by_segment';
    
    return undefined;
  }
}
