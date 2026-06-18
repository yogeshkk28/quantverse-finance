CREATE TABLE IF NOT EXISTS paper_wallet (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 1000000,
  total_invested NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE paper_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_wallet" ON paper_wallet FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_wallet" ON paper_wallet FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_wallet" ON paper_wallet FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_wallet" ON paper_wallet FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS paper_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  trade_type TEXT NOT NULL,
  quantity INT NOT NULL,
  price NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_trades" ON paper_trades FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_trades" ON paper_trades FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_trades" ON paper_trades FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_trades" ON paper_trades FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Keep existing portfolios table if it exists, otherwise create
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  buy_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sector TEXT NOT NULL DEFAULT 'Other',
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "select_own_portfolios" ON portfolios FOR SELECT TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY "insert_own_portfolios" ON portfolios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "update_own_portfolios" ON portfolios FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "delete_own_portfolios" ON portfolios FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN others THEN
  NULL;
END $$;
