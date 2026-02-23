-- 1. Create Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ref text UNIQUE NOT NULL,
    guest text NOT NULL,
    email text NOT NULL,
    phone text,
    room text NOT NULL,
    checkin date NOT NULL,
    checkout date NOT NULL,
    nights integer NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    "createdAt" timestamptz DEFAULT now() NOT NULL
);

-- 2. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id integer PRIMARY KEY DEFAULT 1,
    prices jsonb NOT NULL DEFAULT '{"single": 180, "deluxe": 320, "family": 420}'::jsonb,
    inventory jsonb NOT NULL DEFAULT '{"single": 10, "deluxe": 10, "family": 10}'::jsonb,
    tax_rate numeric DEFAULT 0,
    CONSTRAINT single_row CHECK (id = 1)
);

-- 3. Insert default settings if not exists
INSERT INTO public.settings (id, prices, inventory, tax_rate)
VALUES (1, '{"single": 180, "deluxe": 320, "family": 420}', '{"single": 10, "deluxe": 10, "family": 10}', 0)
ON CONFLICT (id) DO NOTHING;

-- 4. Disable RLS for public access (Simplified for this setup)
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
