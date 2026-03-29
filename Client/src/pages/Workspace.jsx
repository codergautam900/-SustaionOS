import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  BadgeCheck,
  Building2,
  Copy,
  Cpu,
  KeyRound,
  RefreshCcw,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Waypoints,
} from "lucide-react";

import Card from "../components/ui/Card";
import { AuthContext } from "../context/auth-context";
import { getAuthToken } from "../utils/auth";
import { apiUrl, getApiBase } from "../utils/api";

const scopeOptions = [
  { value: "ingest:telemetry", label: "Telemetry ingest" },
  { value: "alerts:write", label: "Alert writeback" },
  { value: "analytics:read", label: "Analytics read" },
];

const toneMap = {
  "Enterprise Ready": "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  "Operationally Strong": "border-cyan-500/20 bg-cyan-500/10 text-cyan-600",
  "Scaling Up": "border-amber-500/20 bg-amber-500/10 text-amber-600",
  Foundational: "border-orange-500/20 bg-orange-500/10 text-orange-500",
};

const Workspace = () => {
  const { updateUser } = useContext(AuthContext);
  const token = getAuthToken();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState({
    organizationName: "",
    teamName: "",
    industry: "",
    timezone: "",
    building: "",
    apiAccessEnabled: true,
    mfaEnabled: false,
    dataRetentionDays: 365,
  });
  const [keyForm, setKeyForm] = useState({
    label: "Primary gateway key",
    expiresInDays: 90,
    scopes: ["ingest:telemetry"],
  });

  const apiBase = useMemo(() => getApiBase() || window.location.origin, []);

  const sampleCurl = useMemo(() => {
    if (!generatedSecret) return "";
    return `curl -X POST "${apiBase}/api/iot/webhook/ingest" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${generatedSecret}" \\
  -d '{"sensorId":"campus-gateway-01","building":"Hostel A","water":420,"energy":188}'`;
  }, [apiBase, generatedSecret]);

  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [overviewRes, keysRes, auditRes, profileRes] = await Promise.all([
        fetch(apiUrl("/api/platform/overview"), { headers }),
        fetch(apiUrl("/api/platform/api-keys"), { headers }),
        fetch(apiUrl("/api/platform/audit?limit=8"), { headers }),
        fetch(apiUrl("/api/user/profile"), { headers }),
      ]);

      const overviewJson = await overviewRes.json();
      const keysJson = await keysRes.json();
      const auditJson = await auditRes.json();
      const profileJson = await profileRes.json();

      if (!overviewRes.ok) throw new Error(overviewJson.msg || "Workspace overview failed");
      if (!keysRes.ok) throw new Error(keysJson.msg || "API key load failed");
      if (!auditRes.ok) throw new Error(auditJson.msg || "Audit feed load failed");
      if (!profileRes.ok) throw new Error(profileJson.msg || "Profile load failed");

      setOverview(overviewJson);
      setApiKeys(Array.isArray(keysJson.apiKeys) ? keysJson.apiKeys : []);
      setAuditLogs(Array.isArray(auditJson.logs) ? auditJson.logs : []);
      setWorkspaceForm({
        organizationName: profileJson.user?.organizationName || "",
        teamName: profileJson.user?.teamName || "Operations",
        industry: profileJson.user?.industry || "Smart Buildings",
        timezone: profileJson.user?.timezone || "Asia/Kolkata",
        building: profileJson.user?.building || "",
        apiAccessEnabled: Boolean(profileJson.user?.apiAccessEnabled),
        mfaEnabled: Boolean(profileJson.user?.mfaEnabled),
        dataRetentionDays: Number(profileJson.user?.dataRetentionDays || 365),
      });
      updateUser(profileJson.user);
    } catch (err) {
      console.error("Workspace load failed:", err);
      toast.error(err.message || "Workspace load failed");
    } finally {
      setLoading(false);
    }
  }, [token, updateUser]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const onWorkspaceChange = (event) => {
    const { name, value, type, checked } = event.target;
    setWorkspaceForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const toggleScope = (scope) => {
    setKeyForm((prev) => {
      const nextScopes = prev.scopes.includes(scope)
        ? prev.scopes.filter((item) => item !== scope)
        : [...prev.scopes, scope];
      return { ...prev, scopes: nextScopes.length ? nextScopes : ["ingest:telemetry"] };
    });
  };

  const saveWorkspace = async (event) => {
    event.preventDefault();
    if (!token) return;

    try {
      setSavingWorkspace(true);
      const res = await fetch(apiUrl("/api/user/update"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...workspaceForm,
          dataRetentionDays: Number(workspaceForm.dataRetentionDays),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Workspace update failed");
      updateUser(json.user);
      toast.success("Workspace updated");
      await loadWorkspace();
    } catch (err) {
      console.error("Workspace update failed:", err);
      toast.error(err.message || "Workspace update failed");
    } finally {
      setSavingWorkspace(false);
    }
  };

  const createKey = async (event) => {
    event.preventDefault();
    if (!token) return;

    try {
      setCreatingKey(true);
      setGeneratedSecret("");
      const res = await fetch(apiUrl("/api/platform/api-keys"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label: keyForm.label,
          expiresInDays: Number(keyForm.expiresInDays),
          scopes: keyForm.scopes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "API key creation failed");
      setGeneratedSecret(json.secret || "");
      toast.success("API key created");
      await loadWorkspace();
    } catch (err) {
      console.error("API key creation failed:", err);
      toast.error(err.message || "API key creation failed");
    } finally {
      setCreatingKey(false);
    }
  };

  const revokeKey = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/api/platform/api-keys/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Revoke failed");
      toast.success("API key revoked");
      await loadWorkspace();
    } catch (err) {
      console.error("API key revoke failed:", err);
      toast.error(err.message || "API key revoke failed");
    }
  };

  const copyText = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Copy failed");
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading workspace console...</div>;
  }

  return (
    <div className="space-y-8">
      <Toaster />

      <Card className="border border-gray-200/80 dark:border-gray-800/80 bg-gradient-to-br from-white via-cyan-50/60 to-emerald-50/60 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              <Sparkles size={14} />
              SaaS workspace console
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
              Manage integrations, security posture, and auditability from one workspace.
            </h1>
          </div>
          <button onClick={loadWorkspace} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black">
            <RefreshCcw size={16} />
            Refresh workspace
          </button>
        </div>
      </Card>

      {overview ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Workspace readiness", value: `${overview.readiness?.score || 0}%`, meta: overview.readiness?.label || "Foundational", icon: BadgeCheck },
              { label: "Active API keys", value: overview.operations?.apiKeys?.active || 0, meta: `${overview.operations?.apiKeys?.expiringSoon || 0} expiring soon`, icon: KeyRound },
              { label: "Sensor coverage", value: overview.operations?.sensors?.total || 0, meta: `${overview.operations?.sensors?.online || 0} online now`, icon: Cpu },
              { label: "Audit events", value: overview.operations?.auditEvents || 0, meta: `${overview.operations?.alerts?.critical || 0} critical alerts`, icon: ScrollText },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} className="p-5 border border-gray-200/80 dark:border-gray-800/80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                    <Icon size={18} className="text-primary" />
                  </div>
                  <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{item.value}</p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.meta}</p>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="p-6 border border-gray-200/80 dark:border-gray-800/80">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneMap[overview.readiness?.label] || toneMap.Foundational}`}>
                  {overview.readiness?.label || "Foundational"}
                </span>
                <span className="inline-flex rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  {overview.workspace?.plan || "STARTER"}
                </span>
                <span className="inline-flex rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  {overview.workspace?.role || "ADMIN"}
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{overview.workspace?.organizationName}</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                `{overview.workspace?.organizationSlug}` · {overview.workspace?.industry} · {overview.workspace?.teamName}
              </p>
              <div className="mt-6 space-y-2">
                {overview.readiness?.recommendations?.length ? (
                  overview.readiness.recommendations.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-2xl border border-gray-200/80 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300">
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                    Workspace is operating in a strong enterprise-ready state.
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 border border-gray-200/80 dark:border-gray-800/80">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Waypoints size={16} />
                Integration endpoints
              </div>
              <div className="mt-4 space-y-3">
                {overview.integrations?.map((item) => (
                  <div key={item.path} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.method} {item.path}</p>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Auth: {item.auth.join(" or ")}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="p-6 border border-gray-200/80 dark:border-gray-800/80">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={18} className="text-primary" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workspace profile</h3>
              </div>
              <form onSubmit={saveWorkspace} className="space-y-3">
                {["organizationName", "teamName", "industry", "timezone", "building"].map((field) => (
                  <input
                    key={field}
                    name={field}
                    value={workspaceForm[field]}
                    onChange={onWorkspaceChange}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder={field}
                  />
                ))}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                    <input name="apiAccessEnabled" type="checkbox" checked={workspaceForm.apiAccessEnabled} onChange={onWorkspaceChange} />
                    Enable API access
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                    <input name="mfaEnabled" type="checkbox" checked={workspaceForm.mfaEnabled} onChange={onWorkspaceChange} />
                    Mark MFA enabled
                  </label>
                </div>
                <input
                  name="dataRetentionDays"
                  type="number"
                  min="30"
                  max="3650"
                  value={workspaceForm.dataRetentionDays}
                  onChange={onWorkspaceChange}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="Data retention days"
                />
                <button className="w-full rounded-xl bg-primary py-3 font-semibold text-black">
                  {savingWorkspace ? "Saving..." : "Save workspace"}
                </button>
              </form>
            </Card>

            <Card className="p-6 border border-gray-200/80 dark:border-gray-800/80">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound size={18} className="text-primary" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create API key</h3>
              </div>
              <form onSubmit={createKey} className="space-y-3">
                <input
                  value={keyForm.label}
                  onChange={(event) => setKeyForm((prev) => ({ ...prev, label: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="Key label"
                />
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={keyForm.expiresInDays}
                  onChange={(event) => setKeyForm((prev) => ({ ...prev, expiresInDays: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="Expires in days"
                />
                <div className="space-y-2">
                  {scopeOptions.map((scope) => (
                    <label key={scope.value} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                      <input type="checkbox" checked={keyForm.scopes.includes(scope.value)} onChange={() => toggleScope(scope.value)} />
                      {scope.label}
                    </label>
                  ))}
                </div>
                <button className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white dark:bg-white dark:text-slate-950">
                  {creatingKey ? "Creating..." : "Generate API key"}
                </button>
              </form>
              {generatedSecret ? (
                <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">One-time secret</p>
                    <button onClick={() => copyText(generatedSecret, "API key copied")} className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <Copy size={12} />
                      Copy
                    </button>
                  </div>
                  <code className="mt-3 block overflow-x-auto rounded-xl bg-black/80 px-4 py-3 text-sm text-emerald-200">{generatedSecret}</code>
                </div>
              ) : null}
            </Card>
          </div>

          {generatedSecret ? (
            <Card className="p-6 border border-gray-200/80 dark:border-gray-800/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick-start curl</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Use this key for webhook or gateway ingestion.</p>
                </div>
                <button onClick={() => copyText(sampleCurl, "Sample curl copied")} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  <Copy size={16} />
                  Copy sample
                </button>
              </div>
              <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">{sampleCurl}</pre>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="p-6 border border-gray-200/80 dark:border-gray-800/80">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert size={18} className="text-primary" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active API keys</h3>
              </div>
              <div className="space-y-3">
                {apiKeys.length ? apiKeys.map((item) => (
                  <div key={item._id} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{item.label}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.prefix}...{item.lastFour}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(item.scopes || []).map((scope) => (
                            <span key={`${item._id}-${scope}`} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                      {item.status === "ACTIVE" ? (
                        <button onClick={() => revokeKey(item._id)} className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500">
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No API keys issued yet.
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 border border-gray-200/80 dark:border-gray-800/80">
              <div className="flex items-center gap-2 mb-4">
                <ScrollText size={18} className="text-primary" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit feed</h3>
              </div>
              <div className="space-y-3">
                {auditLogs.length ? auditLogs.map((log) => (
                  <div key={log._id} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{log.action}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {log.category} · {log.status} · {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No audit events yet.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Workspace;
