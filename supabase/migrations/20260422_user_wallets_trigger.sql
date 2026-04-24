-- Create user wallets for all existing users if they don't have one
INSERT INTO public.user_wallets (profile_id, balance, currency)
SELECT id, 5.00, 'USD' FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_wallets WHERE public.user_wallets.profile_id = public.profiles.id
);

-- Function to handle new user signup and create wallet
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_wallets (profile_id, balance, currency)
  VALUES (new.id, 5.00, 'USD'); -- Give $5.00 initial credit for testing
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to fire on new profile creation
DROP TRIGGER IF EXISTS on_profile_created_wallet ON public.profiles;
CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();
