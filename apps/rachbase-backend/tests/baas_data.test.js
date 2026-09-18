'use strict';

/** BaaS Data console — SQL runner + table listing against a project DB (pglite as the project DB). */

const test = require('node:test');
const assert = require('node:assert/strict');
const baasData = require('../src/services/baasData');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

async function projectClient() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  return { query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) };
}

test('runQuery returns fields/rows/rowCount; listTables sees created tables', { skip: !HAVE_PGLITE }, async () => {
  const c = await projectClient();
  const connect = async () => c;

  await baasData.runQuery({ sql: 'CREATE TABLE todos (id serial primary key, title text)' }, { connect });
  await baasData.runQuery({ sql: "INSERT INTO todos (title) VALUES ('a'), ('b')" }, { connect });

  const sel = await baasData.runQuery({ sql: 'SELECT id, title FROM todos ORDER BY id' }, { connect });
  assert.deepEqual(sel.fields, ['id', 'title']);
  assert.equal(sel.rowCount, 2);
  assert.equal(sel.rows[0].title, 'a');

  const t = await baasData.listTables({}, { connect });
  assert.ok(t.tables.some((x) => x.table_name === 'todos'));
});

test('empty SQL and SQL errors are surfaced', { skip: !HAVE_PGLITE }, async () => {
  const c = await projectClient();
  const connect = async () => c;
  await assert.rejects(() => baasData.runQuery({ sql: '   ' }, { connect }), /empty_sql/);
  await assert.rejects(() => baasData.runQuery({ sql: 'SELECT * FROM does_not_exist' }, { connect }));
});
