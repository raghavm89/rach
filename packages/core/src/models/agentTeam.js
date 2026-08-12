'use strict';

const crypto = require('crypto');
const pool = require('../config/db');

/**
 * AgentTeam — the multi-agent "canvas" unit (migration 082). A team owns a
 * `graph` ({ nodes, edges }) authored on the React-Flow canvas. Tenant-scoped;
 * publishing freezes the graph into agent_team_versions for immutable deploys.
 */

const EMPTY_GRAPH = { nodes: [], edges: [] };

function normalizeGraph(g) {
  const graph = g && typeof g === 'object' ? g : EMPTY_GRAPH;
  return {
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
  };
}

const AgentTeam = {
  async create({ tenant_id, key, name, description = null, industry = null, graph = EMPTY_GRAPH, created_by = null }) {
    const { rows } = await pool.query(
      `INSERT INTO agent_teams (tenant_id, key, name, description, industry, graph, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING *`,
      [tenant_id, key, name, description, industry, JSON.stringify(normalizeGraph(graph)), created_by]
    );
    return rows[0];
  },

  async listForTenant(tenantId) {
    const { rows } = await pool.query(
      'SELECT * FROM agent_teams WHERE tenant_id = $1 ORDER BY updated_at DESC',
      [tenantId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM agent_teams WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /** Patch name/description/industry/graph. Editing resets a published team to draft. */
  async update(id, patch = {}) {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const col of ['name', 'description', 'industry']) {
      if (patch[col] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(patch[col]); }
    }
    if (patch.graph !== undefined) {
      sets.push(`graph = $${i++}::jsonb`);
      vals.push(JSON.stringify(normalizeGraph(patch.graph)));
      // An edit supersedes the published build until re-published.
      sets.push(`status = CASE WHEN status = 'disabled' THEN 'disabled' ELSE 'draft' END`);
    }
    if (patch.status !== undefined) { sets.push(`status = $${i++}`); vals.push(patch.status); }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = NOW()');
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE agent_teams SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return rows[0] || null;
  },

  /** Freeze the current graph as the next version and mark published. */
  async publish(id, userId = null) {
    const team = await this.findById(id);
    if (!team) return null;
    const version = (team.version || 0) + 1;
    await pool.query(
      `INSERT INTO agent_team_versions (team_id, tenant_id, version, graph, published_by)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [id, team.tenant_id, version, JSON.stringify(team.graph), userId]
    );
    const { rows } = await pool.query(
      `UPDATE agent_teams SET status = 'published', version = $2, published_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, version]
    );
    return rows[0];
  },

  async remove(id) {
    await pool.query('DELETE FROM agent_teams WHERE id = $1', [id]);
  },

  // ── Website widget channel (Phase C) ────────────────────────────────────────

  /** Look up a team by its public widget token (unauthenticated embed path). */
  async findByPublicToken(token) {
    if (!token) return null;
    const { rows } = await pool.query('SELECT * FROM agent_teams WHERE public_token = $1', [token]);
    return rows[0] || null;
  },

  /** Mint a public token if the team doesn't have one yet; returns the token. */
  async ensurePublicToken(id) {
    const team = await this.findById(id);
    if (!team) return null;
    if (team.public_token) return team.public_token;
    const token = `wgt_${crypto.randomBytes(16).toString('hex')}`;
    const { rows } = await pool.query(
      'UPDATE agent_teams SET public_token = $2, updated_at = NOW() WHERE id = $1 RETURNING public_token',
      [id, token]
    );
    return rows[0] ? rows[0].public_token : token;
  },

  /** Replace the public token (invalidates existing embeds); returns the new one. */
  async rotatePublicToken(id) {
    const token = `wgt_${crypto.randomBytes(16).toString('hex')}`;
    const { rows } = await pool.query(
      'UPDATE agent_teams SET public_token = $2, updated_at = NOW() WHERE id = $1 RETURNING public_token',
      [id, token]
    );
    return rows[0] ? rows[0].public_token : null;
  },

  /**
   * The graph a deployed team should serve publicly: the frozen snapshot for its
   * current version (immutable), falling back to the live graph if no snapshot
   * exists (older teams). Editing resets status to draft, so a `deployed` team's
   * version always points at a published snapshot.
   */
  async getPublishedGraph(team) {
    if (team && team.version) {
      const { rows } = await pool.query(
        'SELECT graph FROM agent_team_versions WHERE team_id = $1 AND version = $2',
        [team.id, team.version]
      );
      if (rows[0] && rows[0].graph) return rows[0].graph;
    }
    return (team && team.graph) || EMPTY_GRAPH;
  },
};

module.exports = AgentTeam;
