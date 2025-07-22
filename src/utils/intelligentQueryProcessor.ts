
import { supabase } from "@/integrations/supabase/client";

export interface QueryIntent {
  action: 'list' | 'count' | 'compare' | 'analyze' | 'show' | 'find' | 'what' | 'how' | 'which' | 'when';
  entity: 'lessons' | 'programs' | 'regions' | 'campaigns' | 'customers' | 'performance' | 'data';
  filters: {
    program?: string;
    lesson?: string;
    region?: string;
    quarter?: string;
    category?: string;
  };
  modifiers: string[];
}

export class IntelligentQueryProcessor {
  private static ACTION_KEYWORDS = {
    list: ['list', 'show me', 'what are', 'give me', 'display'],
    count: ['how many', 'count', 'number of', 'total'],
    compare: ['compare', 'vs', 'versus', 'difference', 'better'],
    analyze: ['analyze', 'analysis', 'performance', 'metrics'],
    show: ['show', 'display', 'present'],
    find: ['find', 'search', 'locate', 'get'],
    what: ['what', 'which'],
    how: ['how'],
    when: ['when', 'time']
  };

  private static ENTITY_KEYWORDS = {
    lessons: ['lesson', 'lessons', 'module', 'modules', 'chapter', 'chapters'],
    programs: ['program', 'programs', 'course', 'courses', 'training'],
    regions: ['region', 'regions', 'area', 'areas', 'location', 'locations'],
    campaigns: ['campaign', 'campaigns', 'send', 'sends', 'email', 'emails'],
    customers: ['customer', 'customers', 'user', 'users', 'people'],
    performance: ['performance', 'funnel', 'metrics', 'results', 'data'],
    data: ['data', 'information', 'records', 'entries']
  };

  static parseQuery(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();
    
    // Detect action
    let action: QueryIntent['action'] = 'show';
    for (const [actionType, keywords] of Object.entries(this.ACTION_KEYWORDS)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        action = actionType as QueryIntent['action'];
        break;
      }
    }

    // Detect entity
    let entity: QueryIntent['entity'] = 'data';
    for (const [entityType, keywords] of Object.entries(this.ENTITY_KEYWORDS)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        entity = entityType as QueryIntent['entity'];
        break;
      }
    }

    // Extract filters
    const filters: QueryIntent['filters'] = {};
    
    // Program filters
    if (lowerQuery.includes('asg primary path') || lowerQuery.includes('asg primary') || lowerQuery.includes('asg')) {
      filters.program = 'ASG Primary Path';
    } else if (lowerQuery.includes('lwp path') || lowerQuery.includes('lwp')) {
      filters.program = 'LPW Path';
    }

    // Quarter filters
    const quarterMatch = lowerQuery.match(/q([1-4])|quarter\s*([1-4])/);
    if (quarterMatch) {
      const quarter = quarterMatch[1] || quarterMatch[2];
      const year = new Date().getFullYear();
      filters.quarter = `${year}-Q${quarter}`;
    }

    // Region filters
    const regions = ['north america', 'europe', 'asia', 'latin america', 'africa'];
    for (const region of regions) {
      if (lowerQuery.includes(region)) {
        filters.region = region;
        break;
      }
    }

    // Extract modifiers
    const modifiers = [];
    if (lowerQuery.includes('different') || lowerQuery.includes('unique') || lowerQuery.includes('distinct')) {
      modifiers.push('distinct');
    }
    if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('highest')) {
      modifiers.push('top');
    }
    if (lowerQuery.includes('detailed') || lowerQuery.includes('details')) {
      modifiers.push('detailed');
    }

    return { action, entity, filters, modifiers };
  }

  static async executeQuery(intent: QueryIntent, originalQuery: string): Promise<{
    answer: string;
    data?: any[];
    visualData?: any;
    followUps: string[];
  }> {
    console.log('Executing query with intent:', intent);

    try {
      switch (intent.entity) {
        case 'lessons':
          return await this.handleLessonsQuery(intent, originalQuery);
        case 'programs':
          return await this.handleProgramsQuery(intent, originalQuery);
        case 'regions':
          return await this.handleRegionsQuery(intent, originalQuery);
        case 'customers':
          return await this.handleCustomersQuery(intent, originalQuery);
        case 'performance':
          return await this.handlePerformanceQuery(intent, originalQuery);
        default:
          return await this.handleGeneralQuery(intent, originalQuery);
      }
    } catch (error) {
      console.error('Error executing query:', error);
      return {
        answer: `I encountered an error while processing your question: "${originalQuery}". Could you try rephrasing it?`,
        followUps: []
      };
    }
  }

  private static async handleLessonsQuery(intent: QueryIntent, originalQuery: string) {
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('lesson_name_1, program_name_1')
      .not('lesson_name_1', 'is', null);

    // Apply filters
    if (intent.filters.program) {
      query = query.eq('program_name_1', intent.filters.program);
    }

    const { data, error } = await query;

    if (error) {
      return {
        answer: `I couldn't retrieve lesson information: ${error.message}`,
        followUps: []
      };
    }

    if (!data || data.length === 0) {
      return {
        answer: `I couldn't find any lessons${intent.filters.program ? ` for ${intent.filters.program}` : ''}.`,
        followUps: ['What programs are available?', 'Show me all available data']
      };
    }

    const uniqueLessons = [...new Set(data.map(d => d.lesson_name_1).filter(Boolean))];
    
    if (intent.action === 'count') {
      return {
        answer: `There are **${uniqueLessons.length} different lessons**${intent.filters.program ? ` in ${intent.filters.program}` : ''}.`,
        data: uniqueLessons.map(lesson => ({ lesson_name: lesson })),
        followUps: [
          'Show me the lesson names',
          'Which lesson has the best performance?',
          'How do these lessons compare?'
        ]
      };
    }

    // List action
    let answer = `Here are the **${uniqueLessons.length} lessons**${intent.filters.program ? ` in ${intent.filters.program}` : ''}:\n\n`;
    answer += uniqueLessons.map((lesson, index) => `${index + 1}. ${lesson}`).join('\n');

    return {
      answer,
      data: uniqueLessons.map(lesson => ({ lesson_name: lesson })),
      followUps: [
        'Show me performance for these lessons',
        'Which lesson performs best?',
        'How many customers completed each lesson?'
      ]
    };
  }

  private static async handleProgramsQuery(intent: QueryIntent, originalQuery: string) {
    const { data, error } = await supabase
      .from('Onboarding_Dunmmy_Data')
      .select('program_name_1')
      .not('program_name_1', 'is', null);

    if (error || !data) {
      return {
        answer: `I couldn't retrieve program information.`,
        followUps: []
      };
    }

    const uniquePrograms = [...new Set(data.map(d => d.program_name_1).filter(Boolean))];

    if (intent.action === 'count') {
      return {
        answer: `There are **${uniquePrograms.length} different programs** available.`,
        data: uniquePrograms.map(program => ({ program_name: program })),
        followUps: [
          'Show me the program names',
          'Which program performs best?',
          'How many lessons in each program?'
        ]
      };
    }

    let answer = `Here are the **${uniquePrograms.length} programs** available:\n\n`;
    answer += uniquePrograms.map((program, index) => `${index + 1}. ${program}`).join('\n');

    return {
      answer,
      data: uniquePrograms.map(program => ({ program_name: program })),
      followUps: [
        'Show me lessons in ASG Primary Path',
        'Compare program performance',
        'Which program has more customers?'
      ]
    };
  }

  private static async handleRegionsQuery(intent: QueryIntent, originalQuery: string) {
    const { data, error } = await supabase
      .from('Onboarding_Dunmmy_Data')
      .select('acq_region_1, customers_1')
      .not('acq_region_1', 'is', null);

    if (error || !data) {
      return {
        answer: `I couldn't retrieve regional information.`,
        followUps: []
      };
    }

    const regionStats = data.reduce((acc, record) => {
      const region = record.acq_region_1;
      if (!acc[region]) {
        acc[region] = 0;
      }
      acc[region] += record.customers_1 || 0;
      return acc;
    }, {} as Record<string, number>);

    const regions = Object.keys(regionStats);

    if (intent.action === 'count') {
      return {
        answer: `There are **${regions.length} different regions** in the data.`,
        data: regions.map(region => ({ region_name: region, customers: regionStats[region] })),
        followUps: [
          'Show me the region names',
          'Which region has the most customers?',
          'Compare regional performance'
        ]
      };
    }

    let answer = `Here are the **${regions.length} regions** with customer counts:\n\n`;
    answer += Object.entries(regionStats)
      .sort(([,a], [,b]) => b - a)
      .map(([region, customers], index) => 
        `${index + 1}. **${region}**: ${customers.toLocaleString()} customers`
      ).join('\n');

    return {
      answer,
      data: regions.map(region => ({ region_name: region, customers: regionStats[region] })),
      followUps: [
        'Show me regional performance details',
        'Which region converts best?',
        'Compare top 3 regions'
      ]
    };
  }

  private static async handleCustomersQuery(intent: QueryIntent, originalQuery: string) {
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('customers_1, category_1, acq_region_1, program_name_1');

    // Apply filters
    if (intent.filters.program) {
      query = query.eq('program_name_1', intent.filters.program);
    }
    if (intent.filters.region) {
      query = query.ilike('acq_region_1', `%${intent.filters.region}%`);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        answer: `I couldn't retrieve customer information.`,
        followUps: []
      };
    }

    const totalCustomers = data.reduce((sum, record) => sum + (record.customers_1 || 0), 0);

    let answer = `There are **${totalCustomers.toLocaleString()} total customers**`;
    
    if (intent.filters.program) {
      answer += ` in ${intent.filters.program}`;
    }
    if (intent.filters.region) {
      answer += ` in ${intent.filters.region}`;
    }
    
    answer += '.';

    return {
      answer,
      data: [{ total_customers: totalCustomers }],
      followUps: [
        'Break this down by region',
        'Show me customer engagement metrics',
        'How are customers distributed across programs?'
      ]
    };
  }

  private static async handlePerformanceQuery(intent: QueryIntent, originalQuery: string) {
    // For performance queries, we can still use some funnel logic but make it more intelligent
    let query = supabase
      .from('Onboarding_Dunmmy_Data')
      .select('*');

    if (intent.filters.program) {
      query = query.eq('program_name_1', intent.filters.program);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        answer: `I couldn't retrieve performance data.`,
        followUps: []
      };
    }

    const funnel = data.reduce((acc, record) => {
      const category = record.category_1?.toLowerCase() || '';
      const count = record.customers_1 || 0;
      
      if (category.includes('deliver')) {
        acc.deliveries += count;
      } else if (category.includes('open')) {
        acc.opens += count;
      } else if (category.includes('click')) {
        acc.clicks += count;
      }
      
      return acc;
    }, { deliveries: 0, opens: 0, clicks: 0 });

    const openRate = funnel.deliveries > 0 ? (funnel.opens / funnel.deliveries * 100).toFixed(1) : '0.0';
    const clickRate = funnel.deliveries > 0 ? (funnel.clicks / funnel.deliveries * 100).toFixed(1) : '0.0';

    let answer = `**Performance Summary**${intent.filters.program ? ` for ${intent.filters.program}` : ''}:\n\n`;
    answer += `📧 **Deliveries**: ${funnel.deliveries.toLocaleString()}\n`;
    answer += `📖 **Opens**: ${funnel.opens.toLocaleString()} (${openRate}% open rate)\n`;
    answer += `🖱️ **Clicks**: ${funnel.clicks.toLocaleString()} (${clickRate}% click rate)`;

    return {
      answer,
      data: [funnel],
      visualData: {
        type: 'funnel',
        data: funnel
      },
      followUps: [
        'Compare this to other programs',
        'Show me regional breakdown',
        'What about trends over time?'
      ]
    };
  }

  private static async handleGeneralQuery(intent: QueryIntent, originalQuery: string) {
    // For general queries, provide helpful guidance
    return {
      answer: `I can help you explore your marketing data! Here are some things you can ask me:\n\n**About Programs & Lessons:**\n• "What are the different lessons in ASG Primary Path?"\n• "How many programs do we have?"\n• "List all available programs"\n\n**About Regions & Geography:**\n• "What regions do we operate in?"\n• "How many customers in each region?"\n• "Which region performs best?"\n\n**About Performance:**\n• "Show me performance metrics for ASG Primary Path"\n• "How many customers clicked in Q3?"\n• "Compare program performance"\n\n**General Data Questions:**\n• "How many total customers do we have?"\n• "What data is available?"\n• "Show me campaign results"`,
      followUps: [
        'What programs are available?',
        'Show me regional breakdown',
        'How is performance looking?'
      ]
    };
  }
}
