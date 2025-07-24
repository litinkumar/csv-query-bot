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
      'US': 'Americas',
      'USA': 'Americas', 
      'America': 'Americas',
      'North America': 'Americas',
      'Americas': 'Americas',
      'Europe': 'EMEA',
      'EMEA': 'EMEA',
      'Asia': 'APAC',
      'Asia Pacific': 'APAC',
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

    const schemaInfo = `
Available data schema:
- Table: "sample_engagement_data" (IMPORTANT: Always use double quotes around this table name in SQL queries)
- Columns: customers_1, campaign_id_1, lesson_number_1, funnel_order_1, spend_tier_grouped_1, assignment_status_1, category_1, lesson_name_1, program_name_1, primary_product_1, send_date_quarter_1, send_date_week_1, send_date_1, acq_region_1, country_code_1, language_1

ENHANCED PROGRAM MAPPING (use this for better matching):
${Object.entries(programMapping).map(([key, values]) => `- "${key}" maps to: ${values.join(', ')}`).join('\n')}

ENHANCED REGION MAPPING (use this for better matching):  
${Object.entries(regionMapping).map(([key, value]) => `- "${key}" maps to: ${value}`).join('\n')}

AVAILABLE DATA SUMMARY:
- Programs: ${dataValidation.availablePrograms.join(', ')}
- Regions: ${dataValidation.availableRegions.join(', ')}
- Time Periods: ${dataValidation.availableTimeRanges.join(', ')}

MONTH-OVER-MONTH ANALYSIS GUIDELINES:
- For month-over-month queries, extract month from send_date_1 using DATE_TRUNC or EXTRACT functions
- Group by both the requested dimensions AND month/time period
- Use send_date_1 column for month-level analysis, not send_date_quarter_1
- Example: SELECT DATE_TRUNC('month', send_date_1::date) as month, program_name_1, acq_region_1, category_1, SUM(customers_1) FROM "sample_engagement_data" WHERE ... GROUP BY 1,2,3,4 ORDER BY 1
`;

    const prompt = `You are a data analyst AI powered by Google Gemini. Analyze this natural language query and create a structured query plan.

Query: "${query}"

${schemaInfo}

CRITICAL QUERY ANALYSIS RULES:
1. For "ASG" queries, include ALL ASG programs: 'ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path'
2. For regional queries, map input regions to exact database values using the region mapping above
3. For month-over-month analysis, use send_date_1 column and DATE_TRUNC('month', send_date_1::date)
4. Always validate that requested entities exist in the available data above
5. If requested data doesn't exist, suggest alternative queries using available data

VISUALIZATION SELECTION RULES:
- Use "funnel" for queries about program performance, conversion analysis, or customer journey stages
- Use "chart" for trend analysis over time (month-over-month, quarterly trends)
- Use "table" for detailed breakdowns and multi-dimensional analysis
- Use "text" for summary or explanatory responses

FUNNEL VISUALIZATION CRITERIA:
- When query asks about program performance (e.g., "How did [Program] perform", "ASG performance", "program effectiveness")
- When data includes category_1 column with values like 'Deliveries', 'Opens', 'Clicks', 'Adoptions'
- When analyzing conversion rates or customer journey stages
- When comparing program effectiveness

You must respond with ONLY a valid JSON object in this exact format:
{
  "intent": "brief description of what user wants",
  "entities": ["list", "of", "key", "entities", "mentioned"],
  "filters": {"key": "value pairs for filtering"},
  "sqlQuery": "SELECT statement to execute",
  "expectedVisualization": "table|funnel|chart|text",
  "explanation": "brief explanation of what the query will do"
}

CRITICAL SQL RULES:
- ALWAYS use double quotes around the table name: "sample_engagement_data"
- For ASG queries, use: WHERE program_name_1 IN ('ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path')
- For Americas queries, use: WHERE acq_region_1 = 'Americas'
- For month-over-month: GROUP BY DATE_TRUNC('month', send_date_1::date), other_columns
- Use proper SQL aggregation functions (SUM, COUNT, etc.)
- For performance queries, include category_1 in SELECT and GROUP BY to enable funnel visualization

EXAMPLE FOR ASG AMERICAS MONTH-OVER-MONTH:
SELECT 
  DATE_TRUNC('month', send_date_1::date) as month,
  program_name_1,
  category_1,
  SUM(customers_1) as total_customers
FROM "sample_engagement_data" 
WHERE program_name_1 IN ('ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path') 
  AND acq_region_1 = 'Americas'
GROUP BY 1, 2, 3 
ORDER BY 1, 2, 3

Respond with ONLY the JSON object, no other text.`;

    try {
      console.log('🤖 Sending enhanced prompt to LLM');
      const response = await this.callLLM(prompt);
      console.log('📝 LLM raw response:', response);
      
      // Clean the response to extract only JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : response;
      const parsedPlan = JSON.parse(cleanResponse);
      
      console.log('✅ Parsed query plan:', parsedPlan);
      
      // Double-check that the SQL query has proper table name quoting
      if (parsedPlan.sqlQuery && !parsedPlan.sqlQuery.includes('"sample_engagement_data"')) {
        console.warn('🔧 SQL query missing proper table name quoting, fixing...');
        parsedPlan.sqlQuery = parsedPlan.sqlQuery.replace(/FROM\s+sample_engagement_data/gi, 'FROM "sample_engagement_data"');
      }
      
      // Enhanced validation: Check if SQL includes proper ASG mapping
      if (query.toLowerCase().includes('asg') && !parsedPlan.sqlQuery.includes('ASG Primary Path')) {
        console.warn('🔧 ASG query missing proper program mapping, enhancing...');
        if (parsedPlan.sqlQuery.includes("program_name_1 = 'ASG'")) {
          parsedPlan.sqlQuery = parsedPlan.sqlQuery.replace(
            "program_name_1 = 'ASG'",
            "program_name_1 IN ('ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path')"
          );
        }
      }
      
      console.log('🚀 Final enhanced query plan:', parsedPlan);
      return parsedPlan;
    } catch (error) {
      console.error('❌ Failed to analyze query:', error);
      // Enhanced fallback with better ASG and Americas mapping
      return {
        intent: `Find month-over-month performance for: ${query}`,
        entities: ['ASG', 'Americas'],
        filters: { program: 'ASG', region: 'Americas' },
        sqlQuery: `SELECT 
          DATE_TRUNC('month', send_date_1::date) as month,
          program_name_1,
          category_1,
          SUM(customers_1) as total_customers
        FROM "sample_engagement_data" 
        WHERE program_name_1 IN ('ASG Primary Path', 'MCG ASG Path', 'PMax ASG Path') 
          AND acq_region_1 = 'Americas'
        GROUP BY 1, 2, 3 
        ORDER BY 1, 2, 3`,
        expectedVisualization: "table" as const,
        explanation: "Enhanced fallback: Showing ASG programs performance in Americas by month"
      };
    }
  }

  static async executeQueryPlan(plan: QueryPlan): Promise<LLMQueryResult> {
    try {
      console.log('🚀 Executing enhanced query plan:', plan);
      console.log('📊 SQL Query to execute:', plan.sqlQuery);
      
      // Execute the SQL query using the safe query function
      const { data: queryResponse, error } = await supabase.functions.invoke('execute-query', {
        body: { query: plan.sqlQuery }
      });

      console.log('📦 Edge function response:', queryResponse);

      if (error) {
        console.error('❌ Query execution error:', error);
        throw error;
      }

      // Check if the response contains an error
      if (queryResponse?.error) {
        console.error('❌ Database query error:', queryResponse);
        throw new Error(queryResponse.message || 'Database query failed');
      }

      // Extract the actual data from the edge function response
      const actualData = queryResponse?.data || [];
      console.log('✅ Extracted data:', actualData, 'Length:', actualData.length);

      // Ensure actualData is an array
      const safeData = Array.isArray(actualData) ? actualData : [];
      console.log('📋 Safe data array:', safeData, 'Length:', safeData.length);

      // Enhanced response generation focused on data-driven insights
      const responsePrompt = `You are a precise data analyst. Your ONLY job is to extract factual insights from the provided data.

Original Query Intent: "${plan.intent}"
SQL Query Executed: "${plan.sqlQuery}"
Data Results (showing first 10 rows): ${JSON.stringify(safeData.slice(0, 10))}
Total Records Found: ${safeData.length}

STRICT REQUIREMENTS FOR INSIGHTS:
- Every insight MUST reference specific numbers from the data
- Every insight MUST be based solely on the data provided above
- Include actual values, percentages, ratios, and calculations
- Do NOT make assumptions beyond what the data shows
- Do NOT provide general advice or context not in the data
- Focus on quantifiable findings only

REQUIRED INSIGHT STRUCTURE:
- For performance data: Include specific metrics like delivery rates, open rates, click rates
- For comparisons: Include exact numerical differences and percentage changes  
- For trends: Include specific growth/decline percentages between periods
- For rankings: Include actual values and relative positions

If no data was found, insights should state "No data available for the requested query parameters."

Respond with ONLY a valid JSON object in this format:
{
  "answer": "brief data summary",
  "insights": ["insight with specific number/percentage from data", "insight with specific calculation/comparison from data", "insight with specific metric/trend from data"],
  "follow_ups": ["follow up question 1", "follow up question 2", "follow up question 3"]
}

Respond with ONLY the JSON object, no other text.`;

      const llmResponse = await this.callLLM(responsePrompt);
      console.log('🤖 LLM analysis response:', llmResponse);
      
      // Clean the response to extract only JSON
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : llmResponse;
      const parsedResponse = JSON.parse(cleanResponse);

      // Prepare enhanced visualization data with auto-detection
      let visualData = null;
      
      // Auto-detect funnel if data contains category_1 with funnel stages
      const hasFunnelData = safeData.some(row => {
        const category = row.category_1?.toLowerCase() || '';
        return category.includes('deliver') || category.includes('open') || 
               category.includes('click') || category.includes('adopt');
      });
      
      // Override visualization type if funnel data is detected
      const actualVisualization = hasFunnelData && plan.expectedVisualization === 'table' 
        ? 'funnel' 
        : plan.expectedVisualization;
      
      if (actualVisualization === 'table' && safeData.length > 0) {
        visualData = {
          type: 'table',
          data: safeData
        };
      } else if (actualVisualization === 'chart' && safeData.length > 0) {
        visualData = {
          type: 'chart',
          data: this.prepareChartData(safeData)
        };
      } else if (actualVisualization === 'funnel' && safeData.length > 0) {
        visualData = {
          type: 'funnel',
          data: this.prepareFunnelData(safeData)
        };
      }

      console.log('📊 Prepared visualization data:', visualData);

      return {
        answer: parsedResponse.answer || `Found ${safeData.length} results for: ${plan.intent}`,
        data: safeData,
        visualData,
        followUps: parsedResponse.followUps || parsedResponse.follow_ups || [
          "What other insights can you show me?",
          "How does this compare to other segments?",
          "Show me more detailed breakdowns"
        ],
        insights: parsedResponse.insights || [`Found ${safeData.length} records matching your criteria`]
      };

    } catch (error) {
      console.error('❌ Failed to execute query plan:', error);
      
      // Enhanced error handling with helpful suggestions
      const dataValidation = await this.validateDataAvailability(plan.intent);
      
      return {
        answer: `I encountered an issue processing your query "${plan.intent}". ${dataValidation.suggestions.join('. ')}. Try asking about one of the available programs or regions.`,
        followUps: [
          "Show me available programs",
          "What regions can I analyze?", 
          "Show me ASG Primary Path performance",
          "How is performance in EMEA?"
        ],
        insights: ["Query processing failed - try using available program and region names"]
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
    // Convert query results to funnel format
    const funnelData = { deliveries: 0, opens: 0, clicks: 0, adoptions: 0 };
    
    data.forEach(row => {
      const category = row.category_1?.toLowerCase() || '';
      const customers = row.total_customers || row.customers_1 || 0;
      
      if (category.includes('deliver')) {
        funnelData.deliveries += customers;
      } else if (category.includes('open')) {
        funnelData.opens += customers;
      } else if (category.includes('click')) {
        funnelData.clicks += customers;
      } else if (category.includes('adopt') || category.includes('conversion') || category.includes('complete')) {
        funnelData.adoptions += customers;
      }
    });

    // Calculate rates according to user requirements
    const openRate = funnelData.deliveries > 0 ? (funnelData.opens / funnelData.deliveries) * 100 : 0;
    const clickRate = funnelData.deliveries > 0 ? (funnelData.clicks / funnelData.deliveries) * 100 : 0;
    const clickThroughOpenRate = funnelData.opens > 0 ? (funnelData.clicks / funnelData.opens) * 100 : 0;
    const adoptionRate = funnelData.clicks > 0 ? (funnelData.adoptions / funnelData.clicks) * 100 : 0;

    return {
      ...funnelData,
      openRate,
      clickRate,
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
