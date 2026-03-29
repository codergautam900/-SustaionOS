const crypto = require("crypto");

const ROLE_ORDER = ["VIEWER", "ANALYST", "OPERATOR", "ADMIN", "OWNER"];
const PLAN_ORDER = ["STARTER", "GROWTH", "ENTERPRISE"];

const roleAliases = {
  user: "ADMIN",
  member: "ADMIN",
  admin: "ADMIN",
  owner: "OWNER",
  analyst: "ANALYST",
  operator: "OPERATOR",
  viewer: "VIEWER",
};

const normalizeRole = (value = "ADMIN") => {
  const normalized = String(value || "").trim().toLowerCase();
  return roleAliases[normalized] || "ADMIN";
};

const normalizePlan = (value = "STARTER") => {
  const normalized = String(value || "").trim().toUpperCase();
  return PLAN_ORDER.includes(normalized) ? normalized : "STARTER";
};

const normalizeStatus = (value = "ACTIVE") => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["ACTIVE", "SUSPENDED", "INVITED"].includes(normalized)) return normalized;
  return "ACTIVE";
};

const buildOrganizationSlug = (seed = "") => {
  const cleaned = String(seed || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const suffix = crypto.randomBytes(2).toString("hex");
  return cleaned ? `${cleaned}-${suffix}` : `workspace-${suffix}`;
};

const buildWorkspaceDefaults = ({ name = "", email = "", organizationName = "" } = {}) => {
  const localPart = String(email || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();
  const fallbackOrg = organizationName || (name ? `${name}'s Workspace` : localPart ? `${localPart} Workspace` : "SustainOS Workspace");
  const trimmedOrg = String(fallbackOrg).trim().slice(0, 80) || "SustainOS Workspace";

  return {
    organizationName: trimmedOrg,
    organizationSlug: buildOrganizationSlug(trimmedOrg),
    teamName: "Operations",
    industry: "Smart Buildings",
    timezone: "Asia/Kolkata",
    plan: "STARTER",
    role: "ADMIN",
    status: "ACTIVE",
    apiAccessEnabled: true,
    mfaEnabled: false,
    dataRetentionDays: 365,
    lastLoginAt: null,
  };
};

const hasAnyRole = (userRole, allowedRoles = []) => {
  const normalizedUserRole = normalizeRole(userRole);
  const normalizedAllowed = (allowedRoles || []).map((role) => normalizeRole(role));
  return normalizedAllowed.includes(normalizedUserRole);
};

const hasMinimumRole = (userRole, minimumRole = "VIEWER") => {
  const currentIndex = ROLE_ORDER.indexOf(normalizeRole(userRole));
  const requiredIndex = ROLE_ORDER.indexOf(normalizeRole(minimumRole));
  return currentIndex >= requiredIndex;
};

const getRoleCapabilities = (role = "ADMIN") => {
  const normalized = normalizeRole(role);
  const capabilities = ["view:analytics", "view:alerts", "view:reports"];

  if (hasMinimumRole(normalized, "ANALYST")) {
    capabilities.push("view:audit", "view:workspace");
  }
  if (hasMinimumRole(normalized, "OPERATOR")) {
    capabilities.push("write:telemetry", "write:alerts", "run:workflows");
  }
  if (hasMinimumRole(normalized, "ADMIN")) {
    capabilities.push("manage:workspace", "manage:api-keys", "train:model");
  }
  if (hasMinimumRole(normalized, "OWNER")) {
    capabilities.push("manage:billing", "manage:security");
  }

  return capabilities;
};

module.exports = {
  ROLE_ORDER,
  PLAN_ORDER,
  normalizeRole,
  normalizePlan,
  normalizeStatus,
  buildWorkspaceDefaults,
  buildOrganizationSlug,
  hasAnyRole,
  hasMinimumRole,
  getRoleCapabilities,
};
