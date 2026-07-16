-- Scratch card rewards: one card per completed cashback transaction.
-- A card "exists" implicitly for every completed transaction; scratching it
-- creates the row here (UNIQUE transaction_id makes double-scratching
-- impossible) and credits the reward to the user's liquid pool.
CREATE TABLE scratch_cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL UNIQUE REFERENCES cashback_transactions(id) ON DELETE CASCADE,
  reward_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  scratched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scratch_cards_user ON scratch_cards(user_id, scratched_at DESC);
