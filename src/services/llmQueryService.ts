
import { supabase } from "@/integrations/supabase/client";

export interface QueryPlan {
  intent: string;
  entities: string[];
  filters: Record<string, any>;
  sqlQuery: string;
  expectedVisualization: 'table' | 'funnel' | 'chart' | 'text';
  explanation: string;
}

export interface LLMQueryResult {
  answer: string;
  data?: any[];
  visualData?: any;
  followUps: string[];
  insights: string[];
}

export class LLMQueryService {
  private static async callLLM(prompt: string): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('intelligent-query-llm', {
        body: { prompt }
      });

      if (error) throw error;
      return data.response;
    } catch (error) {
      console.error('LLM call failed:', error);
      throw new Error('Failed to process query with LLM');
    }
  }

  private static getEnhancedProgramMapping(): Record<string, string[]> {
    return {
      'ASG': ['ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path'],
      'ASG Primary': ['ASG Primary Path'],
      'ASG Primary Path': ['ASG Primary Path'],
      'MCG ASG': ['MCG ASG Path'],
      'MCG ASG Path': ['MCG ASG Path'],
      'PMax ASG': ['PMax ASG Path'],
      'PMax ASG Path': ['PMax ASG Path'],
      'LPW': ['LPW Path'],
      'LPW Path': ['LPW Path']
    };
  }

  private static getEnhancedRegionMapping(): Record<string, string> {
    return {
      'Americas': 'Americas',
      'EMEA': 'EMEA',
      'APAC': 'APAC',
      'Latin America': 'Latin America',
      'Africa': 'Africa'
    };
  }

  private static async validateDataAvailability(query: string): Promise<{
    hasData: boolean;
    suggestions: string[];
    availablePrograms: string[];
    availableRegions: string[];
    availableTimeRanges: string[];
  }> {
    try {
      // Get available programs
      const { data: programData } = await supabase
        .from('sample_engagement_data')
        .select('program_name_1')
        .not('program_name_1', 'is', null);
      
      const availablePrograms = [...new Set(programData?.map(p => p.program_name_1).filter(Boolean) || [])];

      // Get available regions
      const { data: regionData } = await supabase
        .from('sample_engagement_data')
        .select('acq_region_1')
        .not('acq_region_1', 'is', null);
      
      const availableRegions = [...new Set(regionData?.map(r => r.acq_region_1).filter(Boolean) || [])];

      // Get available time ranges
      const { data: timeData } = await supabase
        .from('sample_engagement_data')
        .select('send_date_quarter_1, send_date_1')
        .not('send_date_1', 'is', null)
        .order('send_date_1');
      
      const availableTimeRanges = [...new Set(timeData?.map(t => t.send_date_quarter_1).filter(Boolean) || [])];

      const suggestions = [];
      if (availablePrograms.length > 0) {
        suggestions.push(`Available programs: ${availablePrograms.slice(0, 3).join(', ')}`);
      }
      if (availableRegions.length > 0) {
        suggestions.push(`Available regions: ${availableRegions.join(', ')}`);
      }
      if (availableTimeRanges.length > 0) {
        suggestions.push(`Available time periods: ${availableTimeRanges.slice(0, 5).join(', ')}`);
      }

      return {
        hasData: true,
        suggestions,
        availablePrograms,
        availableRegions,
        availableTimeRanges
      };
    } catch (error) {
      console.error('Data validation failed:', error);
      return {
        hasData: false,
        suggestions: ['Unable to validate data availability'],
        availablePrograms: [],
        availableRegions: [],
        availableTimeRanges: []
      };
    }
  }

  static async analyzeQuery(query: string, availableData?: any): Promise<QueryPlan> {
    console.log('🔍 Analyzing query:', query);
    
    // Validate data availability first
    const dataValidation = await this.validateDataAvailability(query);
    console.log('📊 Data validation result:', dataValidation);

    const programMapping = this.getEnhancedProgramMapping();
    const regionMapping = this.getEnhancedRegionMapping();

    // Check if this is a dimensional breakdown query
    const isDimensionalBreakdown = query.toLowerCase().includes('broken down by') || 
                                  query.toLowerCase().includes('breakdown by') ||
                                  query.toLowerCase().includes('by region') ||
                                  query.toLowerCase().includes('by quarter') ||
                                  query.toLowerCase().includes('by program') ||
                                  query.toLowerCase().includes('by spend tier');

    const schemaInfo = `
Available data schema:
- Table: "sample_engagement_data" (IMPORTANT: Always use double quotes around this table name in SQL queries)
- Columns: customers_1, campaign_id_1, lesson_number_1, funnel_order_1, spend_tier_grouped_1, assignment_status_1, category_1, lesson_name_1, program_name_1, primary_product_1, send_date_quarter_1, send_date_week_1, send_date_1, acq_region_1, country_code_1, language_1

ACTUAL REGION VALUES IN DATABASE: ${dataValidation.availableRegions.join(', ')}
ACTUAL PROGRAM VALUES IN DATABASE: ${dataValidation.availablePrograms.join(', ')}
ACTUAL TIME PERIODS IN DATABASE: ${dataValidation.availableTimeRanges.join(', ')}

CATEGORY VALUES FOR FUNNEL STAGES:
- Use category_1 column directly without complex filtering
- Categories include: delivered, opened, clicked, adopted, etc.
`;

    let prompt = '';
    
    if (isDimensionalBreakdown) {
      prompt = `You are a data analyst AI. Create a query for dimensional breakdown analysis.

Query: "${query}"

${schemaInfo}

For dimensional breakdowns, create a query that returns data grouped by BOTH category_1 AND the dimension:
- If "by region": GROUP BY category_1, acq_region_1
- If "by quarter": GROUP BY category_1, send_date_quarter_1  
- If "by program": GROUP BY category_1, program_name_1
- If "by spend tier": GROUP BY category_1, spend_tier_grouped_1

Template for dimensional breakdown:
SELECT 
  category_1,
  [dimension_column] as dimension_value,
  SUM(customers_1) as customers
FROM "sample_engagement_data" 
WHERE [your filters here]
GROUP BY category_1, [dimension_column]
ORDER BY dimension_value, category_1

Respond with ONLY a valid JSON object:
{
  "intent": "brief description",
  "entities": ["key", "entities"],
  "filters": {"key": "value"},
  "sqlQuery": "SELECT statement with dimensional grouping",
  "expectedVisualization": "funnel",
  "explanation": "brief explanation"
}`;
    } else {
      prompt = `You are a data analyst AI. Create a query that returns funnel metrics (Deliveries, Opens, Clicks, Adoptions) for visualization.

Query: "${query}"

${schemaInfo}

Create a simple query that groups by category_1 only:
SELECT 
  category_1,
  SUM(customers_1) as customers
FROM "sample_engagement_data" 
WHERE [your filters here]
GROUP BY category_1
ORDER BY category_1

Only use exact values from the database. Do not use variations like 'US', 'USA' - use 'Americas' exactly.

Respond with ONLY a valid JSON object:
{
  "intent": "brief description",
  "entities": ["key", "entities"],
  "filters": {"key": "value"},
  "sqlQuery": "SELECT statement that groups by category_1",
  "expectedVisualization": "funnel",
  "explanation": "brief explanation"
}`;
    }

    try {
      console.log('🤖 Sending enhanced prompt to LLM');
      const response = await this.callLLM(prompt);
      console.log('📝 LLM raw response:', response);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : response;
      const parsedPlan = JSON.parse(cleanResponse);
      
      // Ensure funnel visualization
      parsedPlan.expectedVisualization = "funnel";
      
      console.log('✅ Parsed query plan:', parsedPlan);
      return parsedPlan;
    } catch (error) {
      console.error('❌ Failed to analyze query:', error);
      return {
        intent: `Funnel analysis for: ${query}`,
        entities: ['ASG', 'Americas'],
        filters: { program: 'ASG', region: 'Americas' },
        sqlQuery: `SELECT category_1, SUM(customers_1) as customers FROM "sample_engagement_data" WHERE program_name_1 IN ('ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path') AND acq_region_1 = 'Americas' GROUP BY category_1 ORDER BY category_1`,
        expectedVisualization: "funnel" as const,
        explanation: "Fallback: Showing ASG funnel metrics in Americas"
      };
    }
  }

  static async executeQueryPlan(plan: QueryPlan): Promise<LLMQueryResult> {
    try {
      console.log('🚀 Executing query plan:', plan);
      
      const { data: queryResponse, error } = await supabase.functions.invoke('execute-query', {
        body: { query: plan.sqlQuery }
      });

      if (error || queryResponse?.error) {
        throw new Error(queryResponse?.message || 'Database query failed');
      }

      const actualData = queryResponse?.data || [];
      console.log('✅ Query results:', actualData);

      // Check if this is dimensional data (has multiple dimensions)
      const hasDimensionalData = actualData.some(row => row.dimension_value !== undefined);
      
      if (hasDimensionalData) {
        // Process dimensional data
        const dimensionalData = this.processDimensionalData(actualData);
        console.log('📊 Dimensional data:', dimensionalData);

        return {
          answer: plan.intent,
          data: actualData,
          visualData: {
            type: 'dimensional-funnel',
            data: dimensionalData
          },
          followUps: [
            "View overall summary",
            "Compare top performers", 
            "View detailed breakdown"
          ],
          insights: []
        };
      } else {
        // Process single funnel data
        const funnelData = this.prepareFunnelData(actualData);
        console.log('📊 Funnel data:', funnelData);

        return {
          answer: plan.intent,
          data: actualData,
          visualData: {
            type: 'funnel',
            data: funnelData
          },
          followUps: [
            "View by Region",
            "View by Quarter", 
            "View by Program",
            "View by Spend Tier"
          ],
          insights: []
        };
      }

    } catch (error) {
      console.error('❌ Failed to execute query plan:', error);
      
      return {
        answer: `Unable to process: ${plan.intent}`,
        followUps: [
          "Try asking about ASG performance",
          "Show regional breakdown",
          "View quarterly trends"
        ],
        insights: ["Query processing failed"]
      };
    }
  }

  private static prepareChartData(data: any[]): any {
    if (data.length === 0) return null;
    
    // Check if this looks like time series data
    const hasTimeColumn = data[0].month || data[0].quarter || data[0].week;
    
    if (hasTimeColumn) {
      return {
        type: 'line',
        data: data.map(row => ({
          name: row.month || row.quarter || row.week,
          value: row.total_customers || row.customers_1 || 0,
          category: row.category_1 || row.program_name_1 || 'Unknown'
        }))
      };
    }
    
    // Default to bar chart
    return {
      type: 'bar',
      data: data.map(row => ({
        name: row.program_name_1 || row.acq_region_1 || 'Unknown',
        value: row.total_customers || row.customers_1 || 0
      }))
    };
  }

  private static prepareFunnelData(data: any[]): any {
    const funnelData = { 
      deliveries: 0, 
      opens: 0, 
      clicks: 0, 
      adoptions: 0 
    };
    
    console.log('🔄 Processing funnel data:', data);
    
    data.forEach(row => {
      const category = row.category_1?.toLowerCase() || '';
      // Handle different possible field names for customer count
      const customers = row.customers || row.total_customers || row.customers_1 || 0;
      
      console.log(`Processing row: category=${category}, customers=${customers}`);
      
      if (category.includes('deliver')) {
        funnelData.deliveries += customers;
      } else if (category.includes('open')) {
        funnelData.opens += customers;
      } else if (category.includes('click')) {
        funnelData.clicks += customers;
      } else if (category.includes('adopt') || category.includes('convert') || category.includes('complete')) {
        funnelData.adoptions += customers;
      }
    });

    console.log('📊 Final funnel data:', funnelData);

    // Calculate rates
    const openRate = funnelData.deliveries > 0 ? (funnelData.opens / funnelData.deliveries) * 100 : 0;
    const clickThroughRate = funnelData.deliveries > 0 ? (funnelData.clicks / funnelData.deliveries) * 100 : 0;
    const clickThroughOpenRate = funnelData.opens > 0 ? (funnelData.clicks / funnelData.opens) * 100 : 0;
    const adoptionRate = funnelData.deliveries > 0 ? (funnelData.adoptions / funnelData.deliveries) * 100 : 0;

    return {
      ...funnelData,
      openRate,
      clickThroughRate,
      clickThroughOpenRate,
      adoptionRate
    };
  }

  private static processDimensionalData(data: any[]): any {
    // Group data by dimension value
    const dimensionGroups: Record<string, any[]> = {};
    
    data.forEach(row => {
      const dimensionValue = row.dimension_value || 'Unknown';
      if (!dimensionGroups[dimensionValue]) {
        dimensionGroups[dimensionValue] = [];
      }
      dimensionGroups[dimensionValue].push(row);
    });

    // Process each dimension group into funnel data
    const processedData: Record<string, any> = {};
    Object.entries(dimensionGroups).forEach(([dimensionValue, rows]) => {
      processedData[dimensionValue] = this.prepareFunnelData(rows);
    });

    return processedData;
  }

  static async generateDataExploration(context: string[]): Promise<string[]> {
    const prompt = `You are a data exploration assistant powered by Google Gemini. Based on the conversation context below, suggest intelligent follow-up questions.

Conversation Context: ${context.join(', ')}

Available Data:
- Customer onboarding programs (ASG Primary Path, LPW Path, MCG ASG Path, PMax ASG Path)
- Regional data (Americas, EMEA, APAC, Latin America, Africa)
- Funnel metrics (Deliveries, Opens, Clicks)
- Time periods (Quarters and monthly data available)

Generate 3-4 smart, specific questions that would provide valuable business insights. Focus on:
- Program performance comparisons
- Regional analysis opportunities  
- Funnel optimization insights
- Time-based trend analysis

Respond with ONLY a JSON array of questions:
["question 1", "question 2", "question 3", "question 4"]

No other text, just the JSON array.`;

    try {
      const response = await this.callLLM(prompt);
      // Clean the response to extract only JSON array
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : response;
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Failed to generate exploration questions:', error);
      return [
        "Which ASG program has the highest month-over-month growth?",
        "How do regional performance metrics compare across Americas and EMEA?",
        "What are the biggest funnel drop-off points by program?",
        "Which time period showed the best overall ASG performance?"
      ];
    }
  }
}
