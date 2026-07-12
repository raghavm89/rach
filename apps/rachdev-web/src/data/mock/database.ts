export interface TableInfo {
  name: string;
  rowCount: number;
  sizeBytes: number;
  columnsCount: number;
}

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface TableRow {
  [key: string]: string | number | boolean | null;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: string;
}

export interface Backup {
  id: string;
  date: string;
  sizeBytes: number;
  status: "completed" | "in_progress" | "failed";
  type: "automatic" | "manual";
}

export const mockTables: TableInfo[] = [
  { name: "users", rowCount: 1248, sizeBytes: 2_400_000, columnsCount: 8 },
  { name: "products", rowCount: 456, sizeBytes: 1_800_000, columnsCount: 12 },
  { name: "orders", rowCount: 3890, sizeBytes: 5_600_000, columnsCount: 10 },
  { name: "order_items", rowCount: 8920, sizeBytes: 3_200_000, columnsCount: 6 },
  { name: "categories", rowCount: 24, sizeBytes: 48_000, columnsCount: 4 },
  { name: "reviews", rowCount: 672, sizeBytes: 890_000, columnsCount: 7 },
  { name: "sessions", rowCount: 340, sizeBytes: 120_000, columnsCount: 5 },
];

export const mockUsersColumns: ColumnDef[] = [
  { name: "id", type: "uuid", nullable: false, defaultValue: "gen_random_uuid()", isPrimaryKey: true, isForeignKey: false },
  { name: "email", type: "varchar(255)", nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false },
  { name: "name", type: "varchar(255)", nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false },
  { name: "password_hash", type: "text", nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false },
  { name: "avatar_url", type: "text", nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false },
  { name: "role", type: "varchar(50)", nullable: false, defaultValue: "'user'", isPrimaryKey: false, isForeignKey: false },
  { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()", isPrimaryKey: false, isForeignKey: false },
  { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()", isPrimaryKey: false, isForeignKey: false },
];

export const mockUsersRows: TableRow[] = [
  { id: "a1b2c3d4", email: "alice@example.com", name: "Alice Johnson", role: "admin", created_at: "2026-01-10", updated_at: "2026-04-20" },
  { id: "e5f6g7h8", email: "bob@example.com", name: "Bob Smith", role: "user", created_at: "2026-01-15", updated_at: "2026-04-18" },
  { id: "i9j0k1l2", email: "carol@test.com", name: "Carol Williams", role: "user", created_at: "2026-02-01", updated_at: "2026-03-30" },
  { id: "m3n4o5p6", email: "dave@demo.com", name: "Dave Brown", role: "user", created_at: "2026-03-10", updated_at: "2026-03-10" },
  { id: "q7r8s9t0", email: "eve@sample.com", name: "Eve Davis", role: "moderator", created_at: "2026-03-15", updated_at: "2026-04-25" },
];

export const mockSavedQueries: SavedQuery[] = [
  { id: "sq_1", name: "Active users last 30d", sql: "SELECT * FROM users WHERE updated_at > now() - interval '30 days' ORDER BY updated_at DESC;", createdAt: "2026-04-01T10:00:00Z" },
  { id: "sq_2", name: "Revenue by month", sql: "SELECT date_trunc('month', created_at) AS month, SUM(total) AS revenue FROM orders GROUP BY month ORDER BY month DESC;", createdAt: "2026-03-15T14:00:00Z" },
  { id: "sq_3", name: "Top products", sql: "SELECT p.name, COUNT(oi.id) AS order_count FROM products p JOIN order_items oi ON p.id = oi.product_id GROUP BY p.name ORDER BY order_count DESC LIMIT 10;", createdAt: "2026-02-20T09:00:00Z" },
];

export const mockBackups: Backup[] = [
  { id: "bk_1", date: "2026-04-27T03:00:00Z", sizeBytes: 12_400_000, status: "completed", type: "automatic" },
  { id: "bk_2", date: "2026-04-26T03:00:00Z", sizeBytes: 12_350_000, status: "completed", type: "automatic" },
  { id: "bk_3", date: "2026-04-25T03:00:00Z", sizeBytes: 12_300_000, status: "completed", type: "automatic" },
  { id: "bk_4", date: "2026-04-24T03:00:00Z", sizeBytes: 12_250_000, status: "completed", type: "automatic" },
  { id: "bk_5", date: "2026-04-23T15:30:00Z", sizeBytes: 12_200_000, status: "completed", type: "manual" },
  { id: "bk_6", date: "2026-04-22T03:00:00Z", sizeBytes: 12_180_000, status: "failed", type: "automatic" },
];

export const mockConnectionString = "postgresql://user:********@db.rachdev.com:5432/myapp_prod?sslmode=require";
