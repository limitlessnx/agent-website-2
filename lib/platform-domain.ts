export type EntityStatus = "active" | "inactive" | "paused" | "suspended" | "archived";
export type AgentStatus = "draft" | "testing" | "published" | "paused" | "deprecated";
export type MembershipStatus = "invited" | "active" | "suspended" | "removed";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Branch = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: "active" | "inactive" | "archived";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Role = {
  id: string;
  organization_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: string;
  key: string;
  description?: string | null;
  created_at: string;
};

export type OrganizationMembership = {
  id: string;
  organization_id: string;
  branch_id?: string | null;
  user_id: string;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
};

export type AgentTemplate = {
  id: string;
  name: string;
  slug: string;
  industry?: string | null;
  description?: string | null;
  status: "draft" | "published" | "deprecated";
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AgentFamily = {
  id: string;
  organization_id: string;
  template_id?: string | null;
  branch_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  status: "draft" | "active" | "paused" | "archived";
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  organization_id: string;
  agent_family_id: string;
  branch_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  status: "draft" | "active" | "paused" | "archived";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Agent = {
  id: string;
  organization_id: string;
  agent_family_id: string;
  project_id: string;
  branch_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  system_prompt?: string | null;
  status: AgentStatus;
  current_version: number;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TenantContext = {
  organization: Organization;
  agentFamily: AgentFamily;
  project: Project;
  agent?: Agent | null;
  branch?: Branch | null;
};
