import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are an expert code reviewer. Analyse the code and respond ONLY with a valid JSON object — no prose, no markdown fences.

Schema:
{
  "summary": "<1-2 sentence overall assessment>",
  "score": <integer 1-10>,
  "issues": [
    {
      "id": <integer>,
      "severity": "<error | warning | suggestion>",
      "title": "<short title>",
      "description": "<why this is a problem>",
      "line": <line number or null>,
      "suggestion": "<how to fix it>"
    }
  ],
  "positives": ["<thing done well>"],
  "improved_code": "<refactored code or null>"
}
`;

// ── Routes ─────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/review", async (req, res) => {
  const { code, context } = req.body;
  console.log(`Received review request for code (${code?.length || 0} chars)`);

  if (!code || !code.trim()) {
    return res.status(400).json({ detail: "Code cannot be empty." });
  }

  if (code.length > 50000) {
    return res
      .status(400)
      .json({ detail: "Code too long (max 50,000 chars)." });
  }

  const contextNote = context ? `\nContext: ${context}` : "";

  const userMessage = `
Review this code (detect the programming language automatically):${contextNote}

\`\`\`
${code}
\`\`\`

Respond ONLY with the JSON object.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ detail: error.message });
  }
});

// ── Start Server ───────────────────────────────────────

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
