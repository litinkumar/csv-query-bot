-- Create a policy to allow public read access to the Onboarding_Dunmmy_Data table
CREATE POLICY "Allow public read access" 
ON public."Onboarding_Dunmmy_Data" 
FOR SELECT 
USING (true);