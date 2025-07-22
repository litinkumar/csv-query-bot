
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
- Table: Onboarding_Dunmmy_Data
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

Important guidelines:
- Map region synonyms: "Americas" -> "Americas", "US" -> "Americas", "America" -> "Americas"
- Map program variations: "ASG Primary Path", "ASG Primary", "ASG" all refer to "ASG Primary Path"
- For performance queries, aggregate by category_1 (Delivered/Opened/Clicked) 
- Use appropriate GROUP BY and aggregation
- Prefer funnel visualization for performance metrics
- Use table for lists and breakdowns

Respond with ONLY the JSON object, no other text.`;

    try {
      const response = await this.callLLM(prompt);
      // Clean the response to extract only JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : response;
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Failed to analyze query:', error);
      // Enhanced fallback with more intelligent defaults
      return {
        intent: `Find information about: ${query}`,
        entities: [query],
        filters: {},
        sqlQuery: "SELECT * FROM Onboarding_Dunmmy_Data LIMIT 10",
        expectedVisualization: "table" as const,
        explanation: "Showing sample data due to query analysis error"
      };
    }
  }

  static async executeQueryPlan(plan: QueryPlan): Promise<LLMQueryResult> {
    try {
      console.log('Executing query plan:', plan);
      
      // Execute the SQL query using the safe query function
      const { data: queryData, error } = await supabase.functions.invoke('execute-query', {
        body: { query: plan.sqlQuery }
      });

      if (error) {
        console.error('Query execution error:', error);
        throw error;
      }

      // Ensure queryData is an array
      const safeQueryData = Array.isArray(queryData) ? queryData : [];

      // Generate intelligent response with Gemini
      const responsePrompt = `You are a helpful data analyst powered by Google Gemini. Based on the following query results, provide insights and analysis.

Original Query Intent: "${plan.intent}"
Data Results (showing first 5 rows): ${JSON.stringify(safeQueryData.slice(0, 5))}
Total Records Found: ${safeQueryData.length}

Provide a natural language response that:
1. Directly answers the user's question with specific numbers and insights
2. Highlights the most important findings from the data
3. Suggests 2-3 relevant follow-up questions they might want to ask

Respond with ONLY a valid JSON object in this format:
{
  "answer": "natural language answer with specific insights and numbers from the data",
  "insights": ["key insight 1 with specific data", "key insight 2 with specific data"],
  "followUps": ["follow up question 1", "follow up question 2", "follow up question 3"]
}

Respond with ONLY the JSON object, no other text.`;

      const llmResponse = await this.callLLM(responsePrompt);
      // Clean the response to extract only JSON
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      const cleanResponse = jsonMatch ? jsonMatch[0] : llmResponse;
      const parsedResponse = JSON.parse(cleanResponse);

      // Prepare visualization data
      let visualData = null;
      if (plan.expectedVisualization === 'funnel' && safeQueryData.length > 0) {
        visualData = {
          type: 'funnel',
          data: this.prepareFunnelData(safeQueryData)
        };
      } else if (plan.expectedVisualization === 'table' && safeQueryData.length > 0) {
        visualData = {
          type: 'table',
          data: safeQueryData
        };
      }

      return {
        answer: parsedResponse.answer || `Found ${safeQueryData.length} results for: ${plan.intent}`,
        data: safeQueryData,
        visualData,
        followUps: parsedResponse.followUps || [
          "What other insights can you show me?",
          "How does this compare to other segments?",
          "Show me more detailed breakdowns"
        ],
        insights: parsedResponse.insights || [`Found ${safeQueryData.length} records matching your criteria`]
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
      const customers = row.customers_1 || 0;
      
      if (category.includes('deliver')) {
        funnelData.deliveries += customers;
      } else if (category.includes('open')) {
        funnelData.opens += customers;
      } else if (category.includes('click')) {
        funnelData.clicks += customers;
      }
    });

    return funnelData;
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
