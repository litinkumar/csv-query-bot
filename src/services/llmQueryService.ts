
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
- Columns: customers_1, campaign_id_1, lesson_number_1, funnel_order_1, category_1, lesson_name_1, program_name_1, send_date_quarter_1, acq_region_1, country_code_1, language_1
- Programs: ASG Primary Path, LPW Path  
- Regions: Americas, Europe, Asia Pacific, Latin America, Africa
- Categories: Delivered, Opened, Clicked
- Sample quarters: 2024-Q1, 2024-Q2, 2024-Q3, 2024-Q4
`;

    const prompt = `
You are a data analyst AI. Analyze this natural language query and create a structured query plan.

Query: "${query}"

${schemaInfo}

Respond with a JSON object containing:
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
`;

    try {
      const response = await this.callLLM(prompt);
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to analyze query:', error);
      // Fallback to basic analysis
      return {
        intent: "general data query",
        entities: [query],
        filters: {},
        sqlQuery: "SELECT * FROM Onboarding_Dunmmy_Data LIMIT 10",
        expectedVisualization: "table" as const,
        explanation: "Showing sample data"
      };
    }
  }

  static async executeQueryPlan(plan: QueryPlan): Promise<LLMQueryResult> {
    try {
      console.log('Executing query plan:', plan);
      
      // Execute the SQL query
      const { data: queryData, error } = await supabase.functions.invoke('execute-query', {
        body: { query: plan.sqlQuery }
      });

      if (error) {
        console.error('Query execution error:', error);
        throw error;
      }

      // Ensure queryData is an array
      const safeQueryData = Array.isArray(queryData) ? queryData : [];

      // Generate intelligent response
      const responsePrompt = `
Query: "${plan.intent}"
Data results: ${JSON.stringify(safeQueryData.slice(0, 5))}
Total records: ${safeQueryData.length}

Generate a natural language response that:
1. Directly answers the user's question
2. Highlights key insights from the data
3. Suggests 2-3 relevant follow-up questions

Respond with JSON:
{
  "answer": "natural language answer with insights",
  "insights": ["key insight 1", "key insight 2"],
  "followUps": ["follow up question 1", "follow up question 2", "follow up question 3"]
}
`;

      const llmResponse = await this.callLLM(responsePrompt);
      const parsedResponse = JSON.parse(llmResponse);

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
        answer: parsedResponse.answer,
        data: safeQueryData,
        visualData,
        followUps: parsedResponse.followUps || [],
        insights: parsedResponse.insights || []
      };

    } catch (error) {
      console.error('Failed to execute query plan:', error);
      return {
        answer: `I encountered an error processing your query: "${plan.intent}". The data might not be available in the expected format.`,
        followUps: [
          "What data is available?",
          "Show me available programs",
          "List all regions"
        ],
        insights: []
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
    const prompt = `
Based on the conversation context: ${context.join(', ')}

Suggest 3-5 intelligent data exploration questions that would provide valuable insights about customer onboarding data.

Consider:
- Program performance comparisons
- Regional analysis
- Funnel optimization opportunities
- Time-based trends
- Customer segmentation

Return as JSON array: ["question 1", "question 2", "question 3"]
`;

    try {
      const response = await this.callLLM(prompt);
      return JSON.parse(response);
    } catch (error) {
      return [
        "Which program has the highest completion rate?",
        "How do conversion rates compare across regions?",
        "What are the biggest drop-off points in the funnel?"
      ];
    }
  }
}
