
-- Add Row Level Security policy to sample_engagement_data table to allow public read access
-- This matches the existing policy on Onboarding_Dunmmy_Data
CREATE POLICY "Allow public read access" 
ON public.sample_engagement_data 
FOR SELECT 
USING (true);
