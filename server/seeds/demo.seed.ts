import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Clear demo data (order matters â€” FK constraints)
    // NOTE: audit_log blocks plain DELETE via an "ON DELETE DO INSTEAD
    // NOTHING" rule (append-only audit trail), so we TRUNCATE it instead â€”
    // TRUNCATE isn't intercepted by that rule, unlike DELETE.
    await client.query(`DELETE FROM cashback_transactions WHERE TRUE`);
    await client.query(`DELETE FROM attribution_sessions WHERE TRUE`);
    await client.query(`DELETE FROM ad_reviews WHERE TRUE`);
    await client.query(`DELETE FROM pool_balances WHERE TRUE`);
    await client.query(`DELETE FROM pool_configs WHERE TRUE`);
    await client.query(`DELETE FROM purchase_profiles WHERE TRUE`);
    await client.query(`DELETE FROM campaigns WHERE TRUE`);
    await client.query(`DELETE FROM advertisers WHERE TRUE`);
    await client.query(`TRUNCATE TABLE audit_log CASCADE`);
    await client.query(`DELETE FROM users WHERE TRUE`);
    await client.query(`DELETE FROM ngos WHERE TRUE`);

    // Users
    const consumerRes = await client.query(`
      INSERT INTO users (mobile, name, role, kyc_status, is_active)
      VALUES ('9876543210', 'Riya Sharma', 'consumer', 'verified', true)
      RETURNING id
    `);
    const consumerId: string = consumerRes.rows[0].id;

    const advertiserUserRes = await client.query(`
      INSERT INTO users (mobile, name, role, kyc_status, is_active)
      VALUES ('9123456789', 'Mamaearth Ads', 'advertiser', 'verified', true)
      RETURNING id
    `);
    const advertiserUserId: string = advertiserUserRes.rows[0].id;

    await client.query(`
      INSERT INTO users (mobile, name, role, kyc_status, is_active)
      VALUES ('9000000000', 'AdEarn Admin', 'admin', 'verified', true)
    `);

    // NGO
    const ngoRes = await client.query(`
      INSERT INTO ngos (name, registration_no, cause, bank_account)
      VALUES ('CRY â€” Child Rights and You', 'CRY-MH-001', 'education',
              '{"bank": "HDFC", "account": "12345678", "ifsc": "HDFC0001234"}'::jsonb)
      RETURNING id
    `);
    const ngoId: string = ngoRes.rows[0].id;

    // Advertiser
    const advertiserRes = await client.query(`
      INSERT INTO advertisers
        (user_id, company_name, gst_number, contact_email, contact_mobile,
         quality_score, status, pledge_signed, pledge_signed_at, pledge_ip)
      VALUES ($1, 'Mamaearth', '27AAACM1234F1ZP', 'ads@mamaearth.in', '9123456789',
              4.20, 'active', true, NOW(), '127.0.0.1')
      RETURNING id
    `, [advertiserUserId]);
    const advertiserId: string = advertiserRes.rows[0].id;

    // Campaign
    const startsAt = new Date();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 90);

    await client.query(`
      INSERT INTO campaigns
        (advertiser_id, name, description, creative_url, creative_type,
         target_profile, cashback_rate, daily_cap, total_budget,
         status, approved_at, starts_at, ends_at)
      VALUES ($1,
        'Mamaearth Vitamin C Serum Summer Sale',
        'Get 3% cashback on Vitamin C Serum purchase',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        'video',
        '{"categories": ["Health & Beauty"], "brands": ["Mamaearth"]}'::jsonb,
        0.03, 10000, 200000,
        'active', NOW(), $2, $3)
    `, [advertiserId, startsAt.toISOString(), endsAt.toISOString()]);

    // Consumer purchase profile
    await client.query(`
      INSERT INTO purchase_profiles (user_id, categories, is_active)
      VALUES ($1,
        '[{"category": "Health & Beauty", "brands": ["Mamaearth"], "spend_range": "â‚¹1Kâ€“5K", "frequency": "Monthly"}]'::jsonb,
        true)
    `, [consumerId]);

    // Consumer pool config
    await client.query(`
      INSERT INTO pool_configs
        (user_id, liquid_pct, savings_pct, parent_pct, charity_pct,
         savings_goal, savings_target, charity_ngo_id)
      VALUES ($1, 40, 30, 20, 10, 'Emergency Fund', 50000, $2)
    `, [consumerId, ngoId]);

    // Consumer pool balances (fresh â€” all zeros)
    await client.query(`
      INSERT INTO pool_balances (user_id) VALUES ($1)
    `, [consumerId]);

    await client.query('COMMIT');
    console.log('Demo seed complete.');
    console.log('Consumer:   9876543210 | OTP: 123456');
    console.log('Advertiser: 9123456789 | OTP: 123456');
    console.log('Admin:      9000000000 | OTP: 123456');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Demo seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

seed();
