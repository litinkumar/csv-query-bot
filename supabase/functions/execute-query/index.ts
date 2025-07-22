
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Executing query:', query);
    console.log('📊 Query type:', query.toLowerCase().includes('month') ? 'Month-over-month analysis' : 'Standard query');

    // For security, we'll parse and validate the query
    const sanitizedQuery = query.trim();
    
    // Only allow SELECT queries
    if (!sanitizedQuery.toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Additional validation for enhanced security
    const forbiddenKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate'];
    const queryLower = sanitizedQuery.toLowerCase();
    for (const keyword of forbiddenKeywords) {
      if (queryLower.includes(keyword)) {
        throw new Error(`Forbidden keyword detected: ${keyword}`);
      }
    }

    // Enhanced logging for ASG and Americas queries
    if (queryLower.includes('asg') || queryLower.includes('americas')) {
      console.log('🎯 Detected ASG/Americas query - enhanced tracking enabled');
      console.log('📋 Full query:', sanitizedQuery);
    }

    // Execute query using the Supabase client
    const { data, error } = await supabase.rpc('execute_safe_query', {
      query_text: sanitizedQuery
    });

    if (error) {
      console.error('❌ Query execution error:', error);
      console.log('🔍 Failed query was:', sanitizedQuery);
      throw error;
    }

    console.log('✅ Query executed successfully, rows returned:', data?.length || 0);
    
    // Enhanced logging for debugging data issues
    if ((!data || data.length === 0) && (queryLower.includes('asg') || queryLower.includes('americas'))) {
      console.log('⚠️  No data returned for ASG/Americas query - investigating...');
      
      // Quick validation query to check data availability
      const validationQuery = `SELECT DISTINCT program_name_1, acq_region_1 FROM "sample_engagement_data" WHERE program_name_1 ILIKE '%ASG%' OR acq_region_1 = 'Americas' LIMIT 10`;
      const { data: validationData } = await supabase.rpc('execute_safe_query', {
        query_text: validationQuery
      });
      console.log('🔍 Validation data sample:', validationData);
    }

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in execute-query:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
