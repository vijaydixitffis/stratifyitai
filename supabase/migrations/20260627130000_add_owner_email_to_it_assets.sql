-- Add owner_email to it_assets for questionnaire assignment
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS owner_email text;
