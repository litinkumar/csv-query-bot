
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

    console.log('Executing query:', query);

    // For security, we'll parse and validate the query
    const sanitizedQuery = query.trim();
    
    // Only allow SELECT queries
    if (!sanitizedQuery.toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Execute query using the Supabase client
    const { data, error } = await supabase.rpc('execute_safe_query', {
      query_text: sanitizedQuery
    });

    if (error) {
      console.error('Query execution error:', error);
      throw error;
    }

    console.log('Query executed successfully, rows:', data?.length || 0);

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in execute-query:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
