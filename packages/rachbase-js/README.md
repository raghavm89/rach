# @rachbase/js

A **supabase-js-shaped** JavaScript/TypeScript client for the [RachBase](https://rachbase.app) BaaS —
data (PostgREST), auth, storage, edge functions, and realtime. If you know `@supabase/supabase-js`,
you already know this.

## Install

```
npm install @rachbase/js
```

## Quickstart

```js
import { createClient } from '@rachbase/js';

const db = createClient('https://<ref>.rachbase.app', '<publishable-key>');

// Data — PostgREST
const { data, error } = await db
  .from('todos')
  .select('id, title, done')
  .eq('done', false)
  .order('created_at', { ascending: false })
  .limit(20);

await db.from('todos').insert({ title: 'Ship it' });
await db.from('todos').update({ done: true }).eq('id', 1);
await db.from('todos').delete().eq('id', 1);

// Auth
await db.auth.signUp({ email, password });
await db.auth.signInWithPassword({ email, password });
const { data: { session } } = db.auth.getSession();
db.auth.onAuthStateChange((event, session) => { /* SIGNED_IN | SIGNED_OUT */ });
await db.auth.signOut();

// Storage
await db.storage.from('avatars').upload('me.png', fileBytes, { contentType: 'image/png' });
const { data: blob } = await db.storage.from('avatars').download('me.png');
const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl('me.png');

// Edge Functions
const { data } = await db.functions.invoke('hello', { body: { name: 'world' } });

// Realtime — postgres changes, broadcast, presence
db.channel('room1')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (change) => console.log(change))
  .on('broadcast', { event: 'cursor' }, ({ payload }) => console.log(payload))
  .on('presence', { event: 'sync' }, (state) => console.log(state))
  .subscribe((status) => status === 'SUBSCRIBED' && console.log('live'));

db.channel('room1').send({ type: 'broadcast', event: 'cursor', payload: { x: 10 } });

// Data-principal rights (DPDP) — self-service for the signed-in end-user
const { data } = await db.auth.exportData();          // right to access
await db.auth.updateUser({ email: 'new@example.com' }); // right to correction
await db.auth.deleteUser();                             // right to erasure (clears the session)
```

## Migrating from Supabase

The surfaces mirror `@supabase/supabase-js`, so most apps move with **one import change + new URL/key**:

```diff
- import { createClient } from '@supabase/supabase-js';
- const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
+ import { createClient } from '@rachbase/js';
+ const db = createClient(RACHBASE_URL, RACHBASE_PUBLISHABLE_KEY);
```

`from().select()/insert()/update()/delete()` + filters, `auth`, `storage`, `functions.invoke`, and
`channel().on().subscribe()` all match. (To move your **data** across, use the RachBase import tooling —
schema + rows + auth users — separately.)

## Notes

- **Node < 18**: pass `opts.fetch` (a `fetch` implementation). Node 18+ and browsers use the global.
- **Realtime endpoint**: realtime runs on the RachBase control plane, not the per-project gateway. It
  defaults to `wss://<host>/realtime/v1`; override with `createClient(url, key, { realtimeUrl, ref })`
  if your project URL doesn't front it. A `WebSocket` implementation can be injected via `opts.WebSocket`.
- **Errors don't throw** — every call returns `{ data, error }` (PostgREST/Supabase convention).
- **Session persistence**: uses `localStorage` in the browser; pass `opts.auth.storage` elsewhere.

## API surface

| Area | Methods |
|---|---|
| Data | `from(t).select/insert/upsert/update/delete` + `eq/neq/gt/gte/lt/lte/like/ilike/is/in/contains/filter`, `order/limit/range/offset/single/maybeSingle` |
| Auth | `signUp`, `signInWithPassword`, `signInAnonymously`, `verifyOtp`, `refreshSession`, `getUser`, `getSession`, `setSession`, `onAuthStateChange`, `signOut`, `exportData`, `updateUser`, `deleteUser` (DPDP data-principal rights) |
| Storage | `from(bucket).upload/download/remove/getPublicUrl`, `createBucket`, `listBuckets` |
| Functions | `functions.invoke(name, { body })` |
| Realtime | `channel(topic).on(...).subscribe()`, `.send()`, `.track()/.untrack()`, `.unsubscribe()` |
