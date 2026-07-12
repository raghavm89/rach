export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  region: string;
  status: "active" | "paused" | "provisioning";
  createdAt: string;
  plan: string;
}

export const mockProjects: Project[] = [
  {
    id: "proj_1",
    name: "MyApp Production",
    slug: "myapp-prod",
    description: "Main production application",
    region: "US East (Virginia)",
    status: "active",
    createdAt: "2025-11-15T10:00:00Z",
    plan: "Growth",
  },
  {
    id: "proj_2",
    name: "MyApp Staging",
    slug: "myapp-staging",
    description: "Staging environment",
    region: "US East (Virginia)",
    status: "active",
    createdAt: "2025-11-15T10:00:00Z",
    plan: "Starter",
  },
  {
    id: "proj_3",
    name: "Side Project",
    slug: "side-project",
    description: "Experimental side project",
    region: "India (Mumbai)",
    status: "active",
    createdAt: "2026-02-01T10:00:00Z",
    plan: "Starter",
  },
];
