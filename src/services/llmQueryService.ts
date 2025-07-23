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

IMPORTANT FUNNEL CATEGORY VALUES IN category_1:
- Deliveries: Email delivery count
- Opens: Email open count  
- Clicks: Email click count
- Adoptions: Adoption/conversion count

CRITICAL: For dimensional breakdowns, create a query that uses PIVOT logic to show each dimension value with its complete funnel metrics.
`;

    let prompt = '';
    
    if (isDimensionalBreakdown) {
      prompt = `You are a data analyst AI. Create a query for dimensional breakdown analysis that shows COMPLETE funnel metrics for each dimension value.

Query: "${query}"

${schemaInfo}

For dimensional breakdowns, create a query that returns separate funnel metrics for EACH dimension value using this EXACT template:

SELECT 
  [dimension_column] as dimension_value,
  SUM(CASE WHEN category_1 = 'Deliveries' THEN customers_1 ELSE 0 END) as deliveries,
  SUM(CASE WHEN category_1 = 'Opens' THEN customers_1 ELSE 0 END) as opens,
  SUM(CASE WHEN category_1 = 'Clicks' THEN customers_1 ELSE 0 END) as clicks,
  SUM(CASE WHEN category_1 = 'Adoptions' THEN customers_1 ELSE 0 END) as adoptions
FROM "sample_engagement_data" 
WHERE [your filters here]
GROUP BY [dimension_column]
ORDER BY dimension_value

Replace [dimension_column] with:
- If "by region": acq_region_1
- If "by quarter": send_date_quarter_1  
- If "by program": program_name_1
- If "by spend tier": spend_tier_grouped_1

This will give each dimension value its own complete funnel metrics.

Respond with ONLY a valid JSON object:
{
  "intent": "brief description",
  "entities": ["key", "entities"],
  "filters": {"key": "value"},
  "sqlQuery": "SELECT statement with CASE WHEN pivoting",
  "expectedVisualization": "funnel",
  "explanation": "brief explanation"
}`;
    } else {
      prompt = `You are a data analyst AI. Create a query that returns aggregated funnel metrics for visualization.

Query: "${query}"

${schemaInfo}

Create a query that aggregates all funnel stages using this template:
SELECT 
  SUM(CASE WHEN category_1 = 'Deliveries' THEN customers_1 ELSE 0 END) as deliveries,
  SUM(CASE WHEN category_1 = 'Opens' THEN customers_1 ELSE 0 END) as opens,
  SUM(CASE WHEN category_1 = 'Clicks' THEN customers_1 ELSE 0 END) as clicks,
  SUM(CASE WHEN category_1 = 'Adoptions' THEN customers_1 ELSE 0 END) as adoptions
FROM "sample_engagement_data" 
WHERE [your filters here]

Only use exact values from the database. Do not use variations like 'US', 'USA' - use 'Americas' exactly.

Respond with ONLY a valid JSON object:
{
  "intent": "brief description",
  "entities": ["key", "entities"],
  "filters": {"key": "value"},
  "sqlQuery": "SELECT statement with aggregated funnel metrics",
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
        sqlQuery: `SELECT SUM(CASE WHEN category_1 = 'Deliveries' THEN customers_1 ELSE 0 END) as deliveries, SUM(CASE WHEN category_1 = 'Opens' THEN customers_1 ELSE 0 END) as opens, SUM(CASE WHEN category_1 = 'Clicks' THEN customers_1 ELSE 0 END) as clicks, SUM(CASE WHEN category_1 = 'Adoptions' THEN customers_1 ELSE 0 END) as adoptions FROM "sample_engagement_data" WHERE program_name_1 IN ('ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path') AND acq_region_1 = 'Americas'`,
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

      // Check if this is dimensional data (has dimension_value column)
      const hasDimensionalData = actualData.length > 0 && actualData[0].dimension_value !== undefined;
      
      if (hasDimensionalData) {
        // Process dimensional data - each row is a complete funnel for one dimension value
        console.log('📊 Processing dimensional data');
        const dimensionalData = this.processDimensionalData(actualData);
        console.log('📊 Processed dimensional data:', dimensionalData);

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
        // Process single aggregated funnel data
        console.log('📊 Processing single funnel data');
        const funnelData = this.prepareFunnelData(actualData);
        console.log('📊 Processed funnel data:', funnelData);

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
    console.log('🔄 Processing funnel data:', data);
    
    // For aggregated queries, data should be a single row with deliveries, opens, clicks, adoptions
    if (data.length === 1 && data[0].deliveries !== undefined) {
      const row = data[0];
      const funnelData = {
        deliveries: row.deliveries || 0,
        opens: row.opens || 0,
        clicks: row.clicks || 0,
        adoptions: row.adoptions || 0
      };
      
      console.log('📊 Direct funnel data:', funnelData);
      return this.calculateRates(funnelData);
    }

    // Fallback: try to aggregate from category_1 rows (legacy support)
    const funnelData = { 
      deliveries: 0, 
      opens: 0, 
      clicks: 0, 
      adoptions: 0 
    };
    
    data.forEach(row => {
      const category = row.category_1?.toLowerCase() || '';
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

    console.log('📊 Aggregated funnel data:', funnelData);
    return this.calculateRates(funnelData);
  }

  private static processDimensionalData(data: any[]): any {
    console.log('🔄 Processing dimensional data:', data);
    
    // Each row should already have complete funnel metrics for one dimension value
    const processedData: Record<string, any> = {};
    
    data.forEach(row => {
      const dimensionValue = row.dimension_value || 'Unknown';
      const funnelData = {
        deliveries: row.deliveries || 0,
        opens: row.opens || 0,
        clicks: row.clicks || 0,
        adoptions: row.adoptions || 0
      };
      
      console.log(`Processing dimension ${dimensionValue}:`, funnelData);
      processedData[dimensionValue] = this.calculateRates(funnelData);
    });

    console.log('📊 Final processed dimensional data:', processedData);
    return processedData;
  }

  private static calculateRates(funnelData: any): any {
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
