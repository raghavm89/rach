// Type declarations for @rachbase/js (supabase-js-shaped).

export interface RachbaseError { message: string; status?: number; details?: unknown; }
export interface Result<T = any> { data: T | null; error: RachbaseError | null; status?: number; count?: number | null; }

export interface FilterBuilder<T = any> extends PromiseLike<Result<T>> {
  eq(c: string, v: any): this; neq(c: string, v: any): this;
  gt(c: string, v: any): this; gte(c: string, v: any): this;
  lt(c: string, v: any): this; lte(c: string, v: any): this;
  like(c: string, v: any): this; ilike(c: string, v: any): this;
  is(c: string, v: any): this; in(c: string, v: any[]): this;
  contains(c: string, v: any): this; filter(c: string, op: string, v: any): this;
  select(cols?: string): this; order(c: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this;
  limit(n: number): this; offset(n: number): this; range(from: number, to: number): this;
  single(): this; maybeSingle(): this;
}
export interface QueryBuilder<T = any> {
  select(cols?: string): FilterBuilder<T[]>;
  insert(values: any): FilterBuilder<T[]>;
  upsert(values: any): FilterBuilder<T[]>;
  update(values: any): FilterBuilder<T[]>;
  delete(): FilterBuilder<T[]>;
}

export interface Session { access_token: string; refresh_token?: string; token_type?: string; expires_in?: number; user?: any; }
export interface AuthClient {
  signUp(c: { email: string; password: string }): Promise<Result<{ user: any; session: Session | null }>>;
  signInWithPassword(c: { email: string; password: string }): Promise<Result<{ user: any; session: Session | null }>>;
  signInAnonymously(): Promise<Result<{ user: any; session: Session | null }>>;
  verifyOtp(c: { email?: string; token: string; type?: string }): Promise<Result>;
  refreshSession(): Promise<Result>;
  getUser(token?: string): Promise<Result<{ user: any }>>;
  getSession(): Result<{ session: Session | null }>;
  setSession(s: Session): Result;
  onAuthStateChange(cb: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe(): void } } };
  signOut(): Promise<Result>;
}

export interface BucketClient {
  upload(path: string, body: any, opts?: { contentType?: string; upsert?: boolean }): Promise<Result>;
  download(path: string): Promise<Result>;
  remove(paths: string | string[]): Promise<Result>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}
export interface StorageClient {
  from(bucket: string): BucketClient;
  createBucket(name: string, visibility?: 'public' | 'private'): Promise<Result>;
  listBuckets(): Promise<Result<any[]>>;
}

export interface RealtimeChannel {
  on(type: 'postgres_changes' | 'broadcast' | 'presence', filter: any, cb: (payload: any) => void): this;
  subscribe(statusCb?: (status: string) => void): this;
  send(msg: { type: 'broadcast'; event: string; payload: any }): this;
  track(state: any, key?: string): this; untrack(key?: string): this; unsubscribe(): this;
}

export interface RachbaseClient {
  from<T = any>(table: string): QueryBuilder<T>;
  auth: AuthClient;
  storage: StorageClient;
  functions: { invoke(name: string, opts?: { body?: any; headers?: Record<string, string> }): Promise<Result> };
  channel(topic: string): RealtimeChannel;
  removeAllChannels(): void;
}

export interface CreateClientOptions {
  fetch?: typeof fetch;
  ref?: string;
  realtimeUrl?: string;
  WebSocket?: any;
  auth?: { storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } };
}

export function createClient(url: string, key: string, opts?: CreateClientOptions): RachbaseClient;
