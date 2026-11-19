CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (userid, status);
CREATE INDEX IF NOT EXISTS idx_orders_instrument ON orders (instrumentid);
CREATE INDEX IF NOT EXISTS idx_marketdata_instrument_date ON marketdata (instrumentid, date DESC);
