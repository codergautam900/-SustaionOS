const crypto = require("crypto");

const { normalizeRole } = require("./accessControl.service");

const buildInviteToken = () => `invite_${crypto.randomBytes(18).toString("hex")}`;

const buildInviteResponse = (invite) => {
  if (!invite) return null;
  const source = typeof invite.toObject === "function" ? invite.toObject() : { ...invite };
  return {
    _id: source._id,
    organizationSlug: source.organizationSlug,
    organizationName: source.organizationName,
    invitedEmail: source.invitedEmail,
    role: normalizeRole(source.role),
    status: source.status,
    token: source.token,
    expiresAt: source.expiresAt,
    message: source.message || "",
    createdAt: source.createdAt,
    acceptedAt: source.acceptedAt,
  };
};

const isInviteExpired = (invite) =>
  Boolean(invite?.expiresAt && new Date(invite.expiresAt).getTime() < Date.now());

module.exports = {
  buildInviteToken,
  buildInviteResponse,
  isInviteExpired,
};
