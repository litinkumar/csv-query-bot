-- Create a safe query execution function that only allows SELECT statements
CREATE OR REPLACE FUNCTION public.execute_safe_query(query_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    clean_query text;
BEGIN
    -- Remove leading/trailing whitespace and convert to lowercase for checking
    clean_query := lower(trim(query_text));
    
    -- Security check: only allow SELECT statements
    IF NOT clean_query LIKE 'select%' THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;
    
    -- Additional security: prevent certain dangerous keywords
    IF clean_query ~* '\b(insert|update|delete|drop|create|alter|truncate|grant|revoke)\b' THEN
        RAISE EXCEPTION 'Query contains forbidden keywords';
    END IF;
    
    -- Execute the query and return results as JSON
    EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
    
    -- Return empty array if no results
    IF result IS NULL THEN
        result := '[]'::json;
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information as JSON
        RETURN json_build_object(
            'error', true,
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_safe_query(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_safe_query(text) TO service_role;