-- Change default balance for new users from 1000 to 0
ALTER TABLE public.profiles 
ALTER COLUMN balance SET DEFAULT 0;