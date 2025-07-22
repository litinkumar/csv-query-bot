
import { supabase } from "@/integrations/supabase/client";

export interface QueryContext {
  type: 'funnel' | 'comparison' | 'trend' | 'segmentation' | 'geographic' | 'campaign' | 'general';
  entities: string[];
  dimensions: string[];
  timeFilter?: string;
  aggregationType?: 'sum' | 'avg' | 'count' | 'rate';
  comparisonType?: 'vs' | 'over_time' | 'by_segment';
  programs?: string[];
  regions?: string[];
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
    month: ['month', 'monthly', 'month over month', 'mom'],
    campaign: ['campaign', 'send', 'email'],
    funnel: ['funnel', 'deliveries', 'opens', 'clicks', 'conversion']
  };

  private static COMPARISON_KEYWORDS = ['vs', 'versus', 'compare', 'comparison', 'against', 'with'];
  private static TREND_KEYWORDS = ['trend', 'over time', 'timeline', 'progression', 'change', 'month over month', 'mom'];
  private static SEGMENTATION_KEYWORDS = ['by', 'breakdown', 'segment', 'split', 'group'];

  // Enhanced program mapping to handle ASG queries better
  private static PROGRAM_MAPPINGS = {
    'asg': ['ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path'],
    'asg primary': ['ASG Primary Path'],
    'asg primary path': ['ASG Primary Path'],
    'mcg asg': ['MCG ASG Path'],
    'mcg asg path': ['MCG ASG Path'],
    'pmax asg': ['PMax ASG Path'], 
    'pmax asg path': ['PMax ASG Path'],
    'lpw': ['LPW Path'],
    'lpw path': ['LPW Path']
  };

  // Enhanced region mapping
  private static REGION_MAPPINGS = {
    'america': 'Americas',
    'americas': 'Americas',
    'us': 'Americas',
    'usa': 'Americas',
    'north america': 'Americas',
    'europe': 'EMEA',
    'emea': 'EMEA',
    'asia': 'APAC',
    'asia pacific': 'APAC',
    'apac': 'APAC',
    'latin america': 'Latin America',
    'africa': 'Africa'
  };

  static async analyzeQuery(query: string, recentContext?: any[]): Promise<QueryContext> {
    const lowerQuery = query.toLowerCase();
    console.log('🔍 Analyzing query with enhanced logic:', query);
    
    // Detect query type with enhanced trend detection
    let type: QueryContext['type'] = 'general';
    
    if (this.COMPARISON_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
      type = 'comparison';
    } else if (this.TREND_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
      type = 'trend';
      console.log('📈 Detected trend query type');
    } else if (this.SEGMENTATION_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
      type = 'segmentation';
    } else if (Object.keys(this.DIMENSION_KEYWORDS).some(dim => 
      this.DIMENSION_KEYWORDS[dim as keyof typeof this.DIMENSION_KEYWORDS]
        .some(keyword => lowerQuery.includes(keyword))
    )) {
      type = 'funnel';
    }

    // Enhanced dimension extraction
    const dimensions: string[] = [];
    Object.entries(this.DIMENSION_KEYWORDS).forEach(([dim, keywords]) => {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        dimensions.push(dim);
      }
    });

    // Enhanced program extraction using mappings
    const programs: string[] = [];
    Object.entries(this.PROGRAM_MAPPINGS).forEach(([key, mappedPrograms]) => {
      if (lowerQuery.includes(key)) {
        programs.push(...mappedPrograms);
        console.log(`🎯 Mapped "${key}" to programs:`, mappedPrograms);
      }
    });

    // Enhanced region extraction using mappings  
    const regions: string[] = [];
    Object.entries(this.REGION_MAPPINGS).forEach(([key, mappedRegion]) => {
      if (lowerQuery.includes(key)) {
        regions.push(mappedRegion);
        console.log(`🌍 Mapped "${key}" to region:`, mappedRegion);
      }
    });

    // Extract entities (programs, lessons, etc.) - now enhanced
    const entities = await this.extractEntities(query);
    
    // Add mapped programs and regions to entities
    entities.push(...programs, ...regions);

    // Extract time filter with enhanced month detection
    const timeFilter = this.extractTimeFilter(query);

    const context: QueryContext = {
      type,
      entities: [...new Set(entities)], // Remove duplicates
      dimensions,
      timeFilter,
      aggregationType: this.detectAggregationType(query),
      comparisonType: this.detectComparisonType(query),
      programs: [...new Set(programs)],
      regions: [...new Set(regions)]
    };

    console.log('✅ Enhanced query context:', context);
    return context;
  }

  private static async extractEntities(query: string): Promise<string[]> {
    const entities: string[] = [];
    
    // Try to find program names from database
    const { data: programs } = await supabase
      .from('sample_engagement_data')
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

    // Try to find lesson names from database
    const { data: lessons } = await supabase
      .from('sample_engagement_data')
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

    // Try to find region names from database
    const { data: regions } = await supabase
      .from('sample_engagement_data')
      .select('acq_region_1')
      .not('acq_region_1', 'is', null)
      .limit(50);

    if (regions) {
      const uniqueRegions = [...new Set(regions.map(r => r.acq_region_1).filter(Boolean))];
      uniqueRegions.forEach(region => {
        if (query.toLowerCase().includes(region.toLowerCase())) {
          entities.push(region);
        }
      });
    }

    return entities;
  }

  private static extractTimeFilter(query: string): string | undefined {
    const lowerQuery = query.toLowerCase();
    
    // Enhanced month-over-month detection
    if (lowerQuery.includes('month over month') || lowerQuery.includes('mom') || lowerQuery.includes('monthly')) {
      return 'month-over-month';
    }
    
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

    // Check for specific months
    const monthMatch = lowerQuery.match(/january|february|march|april|may|june|july|august|september|october|november|december/);
    if (monthMatch) {
      return `month-${monthMatch[0]}`;
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
    if (lowerQuery.includes('over time') || lowerQuery.includes('timeline') || lowerQuery.includes('month over month')) return 'over_time';
    if (lowerQuery.includes('by') || lowerQuery.includes('breakdown')) return 'by_segment';
    
    return undefined;
  }
}
