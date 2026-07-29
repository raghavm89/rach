const pool = require('@rach/core').pool;

// Razorpay subscription statuses:
// created | authenticated | active | pending | halted | cancelled | completed | expired

const Subscription = {
  async create({ user_id, plan_id, razorpay_sub_id, total_count }) {
    const { rows } = await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, razorpay_sub_id, total_count)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, plan_id, razorpay_sub_id, total_count || null]
    );
    return rows[0];
  },

  async findByUser(user_id, { limit, offset }) {
    const { rows } = await pool.query(
      `SELECT s.*, p.name AS plan_name, p.amount, p.currency, p.interval, p.interval_count
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM subscriptions WHERE user_id = $1',
      [user_id]
    );
    return { rows, total: countRows[0].total };
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT s.*, p.name AS plan_name, p.amount, p.currency, p.interval, p.interval_count
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByRazorpayId(razorpay_sub_id) {
    const { rows } = await pool.query(
      'SELECT * FROM subscriptions WHERE razorpay_sub_id = $1',
      [razorpay_sub_id]
    );
    return rows[0] || null;
  },

  /**
   * Find a subscription for the same user buying the same thing.
   *
   * The cart signature is the plan's (name, amount, currency). `plans.name` is
   * set from the priced cart description, which is deterministic for a given
   * cart — so this identifies "the same purchase" without needing an extra
   * fingerprint column.
   *
   * @param {number}   userId
   * @param {object}   signature  { name, amount, currency }
   * @param {string[]} statuses   subscription statuses to match
   * @param {number}   [withinMinutes]  only consider rows created this recently
   */
  async findByCartSignature(userId, signature, statuses, withinMinutes = null) {
    const params = [userId, signature.name, signature.amount, String(signature.currency).toUpperCase(), statuses];
    let ageClause = '';
    if (withinMinutes != null) {
      params.push(withinMinutes);
      ageClause = `AND s.created_at > NOW() - ($${params.length} || ' minutes')::interval`;
    }

    const { rows } = await pool.query(
      `SELECT s.*, p.name AS plan_name, p.amount, p.currency
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = $1
          AND p.name = $2
          AND p.amount = $3
          AND upper(p.currency) = $4
          AND s.status = ANY($5)
          ${ageClause}
        ORDER BY s.created_at DESC
        LIMIT 1`,
      params
    );
    return rows[0] || null;
  },

  /**
   * Subscriptions that were created for a checkout the customer never
   * completed. Razorpay does not charge a subscription in `created` state, but
   * the objects linger and an old checkout link stays live — so these get
   * cancelled by the cleanup job.
   */
  async findAbandoned(olderThanMinutes = 60) {
    const { rows } = await pool.query(
      `SELECT * FROM subscriptions
        WHERE status = 'created'
          AND created_at < NOW() - ($1 || ' minutes')::interval`,
      [olderThanMinutes]
    );
    return rows;
  },

  async findAll({ limit, offset }) {
    const { rows } = await pool.query(
      `SELECT s.*, p.name AS plan_name, u.name AS user_name, u.email
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM subscriptions'
    );
    return { rows, total: countRows[0].total };
  },

  /**
   * Persist the billing snapshot (jurisdiction + pre-tax line inputs) used for
   * this subscription's invoices. The `subscription.charged` webhook reissues
   * recurring invoices from it so every cycle is a proper GST tax invoice.
   */
  async saveBilling(razorpay_sub_id, billing) {
    const { rows } = await pool.query(
      `UPDATE subscriptions SET billing_json = $1::jsonb, updated_at = NOW()
        WHERE razorpay_sub_id = $2
        RETURNING *`,
      [JSON.stringify(billing), razorpay_sub_id]
    );
    return rows[0] || null;
  },

  /**
   * Persist the cart/fulfilment inputs captured at subscription creation, so the
   * `subscription.charged` webhook can fulfil a VM order even if the synchronous
   * activation call never runs.
   */
  async saveFulfilment(razorpay_sub_id, fulfilment) {
    const { rows } = await pool.query(
      `UPDATE subscriptions SET fulfilment_json = $1::jsonb, updated_at = NOW()
        WHERE razorpay_sub_id = $2
        RETURNING *`,
      [JSON.stringify(fulfilment), razorpay_sub_id]
    );
    return rows[0] || null;
  },

  async updateStatus(razorpay_sub_id, status, extra = {}) {
    const { rows } = await pool.query(
      `UPDATE subscriptions
       SET status = $1,
           current_start = COALESCE($3, current_start),
           current_end   = COALESCE($4, current_end),
           paid_count    = COALESCE($5, paid_count),
           updated_at    = NOW()
       WHERE razorpay_sub_id = $2
       RETURNING *`,
      [
        status,
        razorpay_sub_id,
        extra.current_start ?? null,
        extra.current_end ?? null,
        extra.paid_count ?? null,
      ]
    );
    return rows[0] || null;
  },
};

module.exports = Subscription;
