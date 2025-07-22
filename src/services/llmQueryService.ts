
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

  static async analyzeQuery(query: string, availableData?: any): Promise<QueryPlan> {
    const schemaInfo = `
Available data schema:
- Table: "sample_engagement_data" (IMPORTANT: Always use double quotes around this table name in SQL queries)
- Columns: customers_1, campaign_id_1, lesson_number_1, funnel_order_1, spend_tier_grouped_1, assignment_status_1, category_1, lesson_name_1, program_name_1, primary_product_1, send_date_quarter_1, send_date_week_1, send_date_1, acq_region_1, country_code_1, language_1
- Programs: ASG Primary Path, LPW Path, MCG ASG Path, PMax ASG Path
- Regions: Americas, EMEA, APAC
- Categories: Deliveries, Opens, Clicks
- Sample quarters: 2024-Q1, 2024-Q2, 2024-Q3, 2024-Q4, 2025-Q1, 2025-Q2, 2025-Q3
`;

    const prompt = `You are a data analyst AI powered by Google Gemini. Analyze this natural language query and create a structured query plan.

Query: "${query}"

${schemaInfo}

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
- Never write: FROM sample_engagement_data
- Always write: FROM "sample_engagement_data"
- Use proper SQL aggregation functions (SUM, COUNT, etc.)
- Map region synonyms: "US" -> "Americas", "America" -> "Americas", "Europe" -> "EMEA", "Asia" -> "APAC"
- Map program variations: "ASG Primary", "ASG" -> "ASG Primary Path"
- For performance queries, aggregate by category_1 (Deliveries/Opens/Clicks) 
- Use appropriate GROUP BY and aggregation
- Prefer funnel visualization for performance metrics
- Use table for lists and breakdowns

Example SQL patterns:
- SELECT category_1, SUM(customers_1) as total FROM "sample_engagement_data" WHERE program_name_1 = 'ASG Primary Path' GROUP BY category_1
- SELECT * FROM "sample_engagement_data" WHERE acq_region_1 = 'Americas' LIMIT 10

Respond with ONLY the JSON object, no other text.`;

    try {
      const response = await this.callLLM(prompt);
      // Clean the response to extract only JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : response;
      const parsedPlan = JSON.parse(cleanResponse);
      
      // Double-check that the SQL query has proper table name quoting
      if (parsedPlan.sqlQuery && !parsedPlan.sqlQuery.includes('"sample_engagement_data"')) {
        console.warn('SQL query missing proper table name quoting, fixing...');
        parsedPlan.sqlQuery = parsedPlan.sqlQuery.replace(/FROM\s+sample_engagement_data/gi, 'FROM "sample_engagement_data"');
      }
      
      return parsedPlan;
    } catch (error) {
      console.error('Failed to analyze query:', error);
      // Enhanced fallback with properly quoted table name
      return {
        intent: `Find information about: ${query}`,
        entities: [query],
        filters: {},
        sqlQuery: 'SELECT * FROM "sample_engagement_data" LIMIT 10',
        expectedVisualization: "table" as const,
        explanation: "Showing sample data due to query analysis error"
      };
    }
  }

  static async executeQueryPlan(plan: QueryPlan): Promise<LLMQueryResult> {
    try {
      console.log('Executing query plan:', plan);
      
      // Execute the SQL query using the safe query function
      const { data: queryResponse, error } = await supabase.functions.invoke('execute-query', {
        body: { query: plan.sqlQuery }
      });

      console.log('Edge function response:', queryResponse);

      if (error) {
        console.error('Query execution error:', error);
        throw error;
      }

      // Check if the response contains an error
      if (queryResponse?.error) {
        console.error('Database query error:', queryResponse);
        throw new Error(queryResponse.message || 'Database query failed');
      }

      // Extract the actual data from the edge function response
      // The edge function returns { data: [rows] }, so we need to access the data property
      const actualData = queryResponse?.data || [];
      console.log('Extracted data:', actualData);

      // Ensure actualData is an array
      const safeData = Array.isArray(actualData) ? actualData : [];
      console.log('Safe data array:', safeData, 'Length:', safeData.length);

      // Generate intelligent response with Gemini
      const responsePrompt = `You are a helpful data analyst powered by Google Gemini. Based on the following query results, provide insights and analysis.

Original Query Intent: "${plan.intent}"
Data Results (showing first 5 rows): ${JSON.stringify(safeData.slice(0, 5))}
Total Records Found: ${safeData.length}

Provide a natural language response that:
1. Directly answers the user's question with specific numbers and insights
2. Highlights the most important findings from the data
3. Suggests 2-3 relevant follow-up questions they might want to ask

Respond with ONLY a valid JSON object in this format:
{
  "answer": "natural language answer with specific insights and numbers from the data",
  "insights": ["key insight 1 with specific data", "key insight 2 with specific data"],
  "follow_ups": ["follow up question 1", "follow up question 2", "follow up question 3"]
}

Respond with ONLY the JSON object, no other text.`;

      const llmResponse = await this.callLLM(responsePrompt);
      // Clean the response to extract only JSON
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : llmResponse;
      const parsedResponse = JSON.parse(cleanResponse);

      // Prepare visualization data
      let visualData = null;
      if (plan.expectedVisualization === 'funnel' && safeData.length > 0) {
        visualData = {
          type: 'funnel',
          data: this.prepareFunnelData(safeData)
        };
      } else if (plan.expectedVisualization === 'table' && safeData.length > 0) {
        visualData = {
          type: 'table',
          data: safeData
        };
      }

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
      console.error('Failed to execute query plan:', error);
      return {
        answer: `I found some data related to "${plan.intent}", but encountered an issue processing the full analysis. The query returned ${plan.sqlQuery.includes('COUNT') ? 'aggregate' : 'detailed'} information about your request.`,
        followUps: [
          "Can you show me the raw data?",
          "What programs are available?",
          "Show me performance by region"
        ],
        insights: ["Data retrieval partially successful, but analysis encountered an error"]
      };
    }
  }

  private static prepareFunnelData(data: any[]): any {
    // Convert query results to funnel format
    const funnelData = { deliveries: 0, opens: 0, clicks: 0 };
    
    data.forEach(row => {
      const category = row.category_1?.toLowerCase() || '';
      const customers = row.total_customers || row.customers_1 || 0;
      
      if (category.includes('deliver')) {
        funnelData.deliveries += customers;
      } else if (category.includes('open')) {
        funnelData.opens += customers;
      } else if (category.includes('click')) {
        funnelData.clicks += customers;
      }
    });

    // Calculate rates
    const openRate = funnelData.deliveries > 0 ? (funnelData.opens / funnelData.deliveries) * 100 : 0;
    const clickThroughRate = funnelData.deliveries > 0 ? (funnelData.clicks / funnelData.deliveries) * 100 : 0;
    const clickThroughOpenRate = funnelData.opens > 0 ? (funnelData.clicks / funnelData.opens) * 100 : 0;

    return {
      ...funnelData,
      openRate,
      clickThroughRate,
      clickThroughOpenRate
    };
  }

  static async generateDataExploration(context: string[]): Promise<string[]> {
    const prompt = `You are a data exploration assistant powered by Google Gemini. Based on the conversation context below, suggest intelligent follow-up questions.

Conversation Context: ${context.join(', ')}

Available Data:
- Customer onboarding programs (ASG Primary Path, LPW Path)
- Regional data (Americas, Europe, Asia Pacific, Latin America, Africa)
- Funnel metrics (Deliveries, Opens, Clicks)
- Time periods (Quarters: 2024-Q1 through Q4)

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
        "Which program has the highest conversion rate?",
        "How do regional performance metrics compare?",
        "What are the biggest funnel drop-off points?",
        "Which quarter showed the best overall performance?"
      ];
    }
  }
}
