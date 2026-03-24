const mongoose = require("mongoose");

const conversationTurnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, default: "" },
    intent: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationMemorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    summary: { type: String, default: "" },
    profile: {
      displayName: { type: String, default: "" },
      preferredName: { type: String, default: "" },
    },
    style: {
      language: { type: String, default: "hinglish" },
      tone: { type: String, default: "friendly" },
    },
    topics: [
      {
        name: { type: String, required: true },
        count: { type: Number, default: 0 },
      },
    ],
    recentTurns: { type: [conversationTurnSchema], default: [] },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConversationMemory", conversationMemorySchema);
