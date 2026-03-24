const Data = require("../models/Data");
const Alert = require("../models/Alert");
const executiveInsights = require("./executiveInsights.service");
const root = require("../ai/rootCause.engine");
const suggest = require("../ai/suggestion.engine");
const predictService = require("../services/prediction.service");
const intentEngine = require("../ai/intent.engine");

const convoMemory = new Map();
const MAX_MEMORY = 12;

const addToMemory = (userId, role, text) => {
  if (!userId) return;
  const key = String(userId);
  const arr = convoMemory.get(key) || [];
  arr.push({ role, text, time: Date.now() });
  if (arr.length > MAX_MEMORY) arr.shift();
  convoMemory.set(key, arr);
};

const getMemory = (userId) => {
  if (!userId) return [];
  return convoMemory.get(String(userId)) || [];
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const detectPeriod = (q) => {
  if (q.includes("year")) return "year";
  if (q.includes("month")) return "month";
  if (q.includes("week") || q.includes("last 7")) return "week";
  return "week";
};

const summarizeComparison = (insights) => {
  if (!insights?.previous) return null;
  const energyDelta = insights.deltas?.energy;
  const waterDelta = insights.deltas?.water;
  return {
    energyDelta,
    waterDelta,
    text: `Energy is ${energyDelta == null ? "not comparable" : `${Math.abs(energyDelta).toFixed(1)}% ${energyDelta >= 0 ? "higher" : "lower"}`} than the previous window, while water is ${waterDelta == null ? "not comparable" : `${Math.abs(waterDelta).toFixed(1)}% ${waterDelta >= 0 ? "higher" : "lower"}`}.`,
  };
};

const buildGeneralHelp = () => ({
  status: "success",
  intent: "general_help",
  answer:
    "I can read your latest data, compare periods, explain spikes, forecast usage, or suggest actions. Try asking for a comparison, a diagnosis, a forecast, or the top next step.",
});

const buildStructuredAnswer = (payload) => ({
  status: "success",
  ...payload,
});

const computeConfidence = (intent, parsed, insights, hasHistory) => {
  let score = 55;
  if (intent && intent !== "general_help" && intent !== "unknown") score += 15;
  if (parsed?.hasEnergy || parsed?.hasWater || parsed?.hasCarbon || parsed?.hasScore) score += 10;
  if (parsed?.hasCompare || parsed?.hasAction || parsed?.hasBuilding || parsed?.hasAlert) score += 10;
  if (insights?.totalRecords > 0) score += 5;
  if (hasHistory) score += 5;
  return Math.min(95, Math.max(50, score));
};

const parseQuery = (q) => {
  const hasEnergy = /\benergy|electricity|power|kwh|load|units\b/.test(q);
  const hasWater = /\bwater|leak|pipeline|tank|flow|litre|liter\b/.test(q);
  const hasCarbon = /\bcarbon|co2|footprint|emission\b/.test(q);
  const hasScore = /\bscore|efficiency|sustainability|rating\b/.test(q);
  const hasAlert = /\balert|warning|issue|fault|error\b/.test(q);
  const hasCompare = /\bcompare|versus|vs|better|worse|trend\b/.test(q);
  const hasAction = /\baction|next step|what should i do|fix|resolve|recommend\b/.test(q);
  const hasBuilding = /\bbuilding|site|campus|floor|property\b/.test(q);
  const hasCurrent = /\bcurrent|latest|now|today|current data|my data|abhi|aaj\b/.test(q);
  const hasSuggestion = /\bsuggest|suggestion|recommend|tip|improve|optimize|save\b/.test(q);

  let timeframe = "current";
  if (q.includes("today")) timeframe = "today";
  else if (q.includes("tomorrow")) timeframe = "tomorrow";
  else if (q.includes("yesterday")) timeframe = "yesterday";
  else if (q.includes("week")) timeframe = "week";
  else if (q.includes("month")) timeframe = "month";
  else if (q.includes("year")) timeframe = "year";

  let comparisonTarget = null;
  const compareMatch = q.match(/\b(vs|versus|compare)\b(.*)$/);
  if (compareMatch?.[2]) comparisonTarget = compareMatch[2].trim().slice(0, 60);

  return {
    hasEnergy,
    hasWater,
    hasCarbon,
    hasScore,
    hasAlert,
    hasCompare,
    hasAction,
    hasBuilding,
    hasCurrent,
    hasSuggestion,
    timeframe,
    comparisonTarget,
  };
};

const generateAnswer = async ({ question, userId, context = {} }) => {
  const qRaw = (question || "").toString();
  const q = qRaw.toLowerCase().trim();
  const detectedIntent = intentEngine.detectIntent ? intentEngine.detectIntent(qRaw) : "unknown";
  const parsed = parseQuery(q);

  addToMemory(userId, "user", qRaw);
  const memory = getMemory(userId);

  if (!userId) {
    return buildStructuredAnswer({
      intent: "unauthorized",
      answer: "Unauthorized: user context missing.",
    });
  }

  const period = detectPeriod(q);
  const summaryPromise = executiveInsights.getExecutiveInsights(userId, period);
  const latestPromise = context.latest || Data.findOne({ userId }).sort({ timestamp: -1, createdAt: -1 });
  const alertsPromise = context.alerts || Alert.find({ userId }).sort({ time: -1 }).limit(5);
  const historyPromise = context.history || Data.find({ userId }).sort({ timestamp: -1 }).limit(48);
  const [insights, latest, alerts, recentHistory] = await Promise.all([
    summaryPromise,
    Promise.resolve(latestPromise),
    Promise.resolve(alertsPromise),
    Promise.resolve(historyPromise),
  ]);

  const prediction = predictService.predictNext(recentHistory) || {};
  const rootCause = await root.findCause(userId);
  const tips = await suggest.getSuggestions(userId);

  const isFollowUp = q.length < 25 && memory.length > 1;
  const comparison = summarizeComparison(insights);
  const topBuilding = insights?.buildingBenchmarks?.[0];
  const shouldUseCurrentSnapshot =
    parsed.hasCurrent ||
    ((parsed.hasEnergy || parsed.hasWater || parsed.hasScore || parsed.hasCarbon) &&
      !parsed.hasCompare &&
      !q.includes("history") &&
      !q.includes("forecast") &&
      !q.includes("predict") &&
      !q.includes("report"));

  let payload = null;

  if (shouldUseCurrentSnapshot || q.includes("current") || q.includes("latest") || q.includes("now") || q.includes("today")) {
    payload = buildStructuredAnswer({
      intent: "current_snapshot",
      answer:
        latest
          ? `Latest reading: ${latest.building || "Unknown"} - energy ${toNumber(latest.energy)}, water ${toNumber(latest.water)}. Current score ${insights?.score ?? "N/A"}/100.`
          : "No current reading is available yet.",
      source: "current_data",
      current: latest
        ? {
            building: latest.building || "Unknown",
            energy: toNumber(latest.energy),
            water: toNumber(latest.water),
            timestamp: latest.timestamp || latest.createdAt || null,
          }
        : null,
      report: {
        score: insights?.score ?? 0,
        carbon: insights?.carbon ?? 0,
        savings: insights?.monthlySavingsPotential ?? 0,
      },
      parsed,
    });
  } else if (detectedIntent === "prediction" || q.includes("forecast") || q.includes("predict")) {
    payload = buildStructuredAnswer({
      intent: "forecast",
      answer:
        `Forecast snapshot: next hour energy ${prediction.predictedEnergyNextHour ?? prediction.predictedEnergyAvg ?? "N/A"}, water ${prediction.predictedWaterNextHour ?? prediction.predictedWaterAvg ?? "N/A"}. Next day energy ${prediction.predictedEnergyNextDay ?? "N/A"}, water ${prediction.predictedWaterNextDay ?? "N/A"}.`,
      forecast: prediction,
      suggestion: "Use this to plan peak-load shifting before the next interval.",
      parsed,
    });
  } else if (detectedIntent === "compare" || q.includes("compare") || q.includes("vs") || q.includes("versus")) {
    payload = buildStructuredAnswer({
      intent: "compare",
      answer: comparison?.text || "Not enough historical data to compare periods yet.",
      comparison,
      insights,
      parsed,
    });
  } else if (detectedIntent === "action" || q.includes("what should i do") || q.includes("next best action") || q.includes("action") || q.includes("fix")) {
    payload = buildStructuredAnswer({
      intent: "action_plan",
      answer: `Priority action: ${insights?.nextBestAction || "Continue monitoring"}`,
      actionPlan: insights?.priorityActions || [],
      riskLevel: insights?.riskLevel || "Low",
      parsed,
    });
  } else if (detectedIntent === "report" || q.includes("report") || q.includes("summary") || q.includes("overview") || q.includes("dashboard")) {
    payload = buildStructuredAnswer({
      intent: "report_summary",
      answer:
        `Current sustainability score is ${insights?.score ?? "N/A"}/100 with ${insights?.riskLevel || "Low"} risk. Estimated monthly savings: Rs. ${insights?.monthlySavingsPotential || 0}.`,
      report: {
        score: insights?.score ?? 0,
        carbon: insights?.carbon ?? 0,
        savings: insights?.monthlySavingsPotential ?? 0,
        building: topBuilding?.building || null,
      },
      parsed,
    });
  } else if (parsed.hasSuggestion || detectedIntent === "suggestion" || q.includes("suggest") || q.includes("tip") || q.includes("optimize") || q.includes("improve")) {
    payload = buildStructuredAnswer({
      intent: "suggestions",
      answer: tips.length
        ? tips.join("\n")
        : "Keep monitoring the current window. System is operating within normal range.",
      suggestions: (tips.length ? tips : [
        "Check for small leaks or idle draws.",
        "Shift heavy loads to off-peak hours.",
        "Review buildings with repeated spikes first.",
        "Use alerts to catch waste before it repeats.",
      ]).map((message, index) => ({
        title: `Tip ${index + 1}`,
        message,
      })),
      parsed,
    });
  } else if (detectedIntent === "score" || q.includes("score") || q.includes("sustainability score") || q.includes("efficiency")) {
    payload = buildStructuredAnswer({
      intent: "score",
      answer:
        `Sustainability score: ${insights?.score ?? "N/A"}/100. Risk level: ${insights?.riskLevel || "Low"}. ${insights?.nextBestAction ? `Next action: ${insights.nextBestAction}` : ""}`,
      score: {
        value: insights?.score ?? 0,
        riskLevel: insights?.riskLevel || "Low",
        savings: insights?.monthlySavingsPotential ?? 0,
      },
      parsed,
    });
  } else if (detectedIntent === "carbon" || q.includes("carbon") || q.includes("co2") || q.includes("footprint")) {
    payload = buildStructuredAnswer({
      intent: "carbon",
      answer:
        `Estimated carbon footprint is ${insights?.carbon ?? 0} kg CO2 for the current window. To reduce it, cut peak energy usage, shift heavy loads off-peak, and inspect repeated spikes.`,
      carbon: {
        value: insights?.carbon ?? 0,
        savings: insights?.monthlySavingsPotential ?? 0,
      },
      parsed,
    });
  } else if (detectedIntent === "building" || q.includes("building") || q.includes("site") || q.includes("worst")) {
    payload = buildStructuredAnswer({
      intent: "benchmark",
      answer: topBuilding
        ? `${topBuilding.building} is the highest-load building in the current window with score ${topBuilding.efficiency}%.`
        : "No building benchmark available yet.",
      benchmark: insights?.buildingBenchmarks || [],
      parsed,
    });
  } else if (detectedIntent === "cause" || q.includes("why") || q.includes("cause") || q.includes("root") || q.includes("problem")) {
    payload = buildStructuredAnswer({
      intent: "diagnosis",
      answer: rootCause,
      diagnosis: {
        cause: rootCause,
        latest: latest
          ? { energy: toNumber(latest.energy), water: toNumber(latest.water), building: latest.building }
          : null,
      },
      parsed,
    });
  } else if (detectedIntent === "alert" || q.includes("alert")) {
    payload = buildStructuredAnswer({
      intent: "alert",
      answer:
        alerts.length > 0
          ? `Latest alert: ${alerts[0].message}`
          : "No active alerts in your account right now.",
      alerts: alerts.map((a) => ({
        message: a.message,
        severity: a.severity,
        status: a.status,
      })),
      parsed,
    });
  } else if (isFollowUp) {
    const lastAssistant = [...memory].reverse().find((m) => m.role === "assistant");
    payload = buildStructuredAnswer({
      intent: "follow_up",
      answer: `Following up on the previous point: ${lastAssistant?.text || "I can expand on the current analytics or recommend the top action."}`,
      parsed,
    });
  } else {
    const hints = [];
    if (q.includes("current") || q.includes("latest") || q.includes("today") || q.includes("now")) hints.push("current data snapshot");
    if (parsed.hasScore) hints.push("sustainability score");
    if (parsed.hasEnergy) hints.push("energy usage");
    if (parsed.hasWater) hints.push("water usage");
    if (parsed.hasCarbon) hints.push("carbon footprint");
    if (parsed.hasCompare) hints.push("period comparison");
    if (parsed.hasAction) hints.push("next best action");
    if (parsed.hasBuilding) hints.push("building benchmark");

    payload = buildStructuredAnswer({
      intent: "general_help",
      answer:
        hints.length > 0
          ? `I can help with ${hints.join(", ")}. Ask me to compare periods, explain a spike, or show the next best action.`
          : `Ask me about score, carbon footprint, building comparison, forecast, or actions.`,
      hints,
      parsed,
    });
  }

  if (payload?.answer) {
    const isFirstAssistant = (memory || []).filter((m) => m.role === "assistant").length === 0;
    const lead = isFirstAssistant ? "Hi - " : "";
    payload.answer = `${lead}${payload.answer}`;
  }

  payload.confidence = computeConfidence(payload.intent, parsed, insights, memory.length > 0);

  addToMemory(userId, "assistant", payload.answer || JSON.stringify(payload));

  return { ...payload, conversation: getMemory(userId).slice(-6), insights };
};

module.exports = { generateAnswer, getMemory };
