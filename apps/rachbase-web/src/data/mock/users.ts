export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: "email" | "google" | "github" | "apple";
  verified: boolean;
  createdAt: string;
  lastSignIn: string;
  status: "active" | "banned" | "unverified";
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "owner" | "admin" | "developer" | "viewer";
  status: "active" | "invited" | "inactive";
  lastActive: string;
}

export const mockCurrentUser = {
  id: "user_1",
  name: "Eshan Cheema",
  email: "eshan@rachdev.com",
  avatar: undefined,
  role: "owner" as const,
};

export const mockAuthUsers: AuthUser[] = [
  { id: "au_1", email: "alice@example.com", name: "Alice Johnson", provider: "email", verified: true, createdAt: "2026-01-10T08:00:00Z", lastSignIn: "2026-04-26T14:30:00Z", status: "active" },
  { id: "au_2", email: "bob@example.com", name: "Bob Smith", provider: "google", verified: true, createdAt: "2026-01-15T10:00:00Z", lastSignIn: "2026-04-25T09:15:00Z", status: "active" },
  { id: "au_3", email: "carol@test.com", name: "Carol Williams", provider: "github", verified: true, createdAt: "2026-02-01T12:00:00Z", lastSignIn: "2026-04-20T18:45:00Z", status: "active" },
  { id: "au_4", email: "dave@demo.com", name: "Dave Brown", provider: "email", verified: false, createdAt: "2026-03-10T16:00:00Z", lastSignIn: "2026-03-10T16:00:00Z", status: "unverified" },
  { id: "au_5", email: "eve@sample.com", name: "Eve Davis", provider: "google", verified: true, createdAt: "2026-03-15T09:00:00Z", lastSignIn: "2026-04-24T11:00:00Z", status: "active" },
  { id: "au_6", email: "frank@test.io", name: "Frank Miller", provider: "email", verified: true, createdAt: "2026-02-20T14:00:00Z", lastSignIn: "2026-04-10T08:00:00Z", status: "banned" },
  { id: "au_7", email: "grace@example.org", name: "Grace Lee", provider: "apple", verified: true, createdAt: "2026-04-01T10:00:00Z", lastSignIn: "2026-04-26T16:00:00Z", status: "active" },
  { id: "au_8", email: "henry@demo.io", name: "Henry Wilson", provider: "github", verified: true, createdAt: "2026-04-05T12:00:00Z", lastSignIn: "2026-04-26T12:30:00Z", status: "active" },
];

export const mockTeamMembers: TeamMember[] = [
  { id: "tm_1", name: "Eshan Cheema", email: "eshan@rachdev.com", role: "owner", status: "active", lastActive: "2026-04-27T10:00:00Z" },
  { id: "tm_2", name: "Raghav", email: "raghav@rachdev.com", role: "admin", status: "active", lastActive: "2026-04-27T09:30:00Z" },
  { id: "tm_3", name: "Sarah Kim", email: "sarah@client.com", role: "developer", status: "active", lastActive: "2026-04-26T17:00:00Z" },
  { id: "tm_4", name: "Mike Chen", email: "mike@client.com", role: "viewer", status: "active", lastActive: "2026-04-25T14:00:00Z" },
  { id: "tm_5", name: "Priya Patel", email: "priya@external.com", role: "developer", status: "invited", lastActive: "" },
];
