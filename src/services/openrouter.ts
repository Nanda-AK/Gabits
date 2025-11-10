import type { Question } from "@/data/questions";

async function callOpenRouter(body: unknown): Promise<any | null> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!apiKey) return null;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "Let's Mine",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Short step-by-step full solution in Indian style (plain text)
export async function aiSolveShortIndian(q: Question): Promise<string> {
  try {
    const data = await callOpenRouter({
      model: "tngtech/deepseek-r1t2-chimera:free",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a friendly Indian math tutor. Solve the question with 4-8 short lines showing key calculation steps. Use plain text, Indian style (use lakh/crore separators where relevant, '₹' for rupees, and symbols ×, ÷, +, −). Avoid LaTeX. End with: 'Final: <answer> <unit if any>'. Keep under 80 words.",
        },
        {
          role: "user",
          content: `Question: ${q.question}\nOptions:\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`,
        },
      ],
      max_tokens: 180,
    });
    if (!data) {
      return "Add OpenRouter API key to .env as VITE_OPENROUTER_API_KEY and retry.\nFinal: <answer>";
    }
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || "Steps: Write the numbers, do the operation step by step, simplify neatly.\nFinal: <answer>";
  } catch {
    return "Steps: Do simple calculations step by step and keep units.\nFinal: <answer>";
  }
}

export async function aiTaunt(): Promise<string> {
  const data = await callOpenRouter({
    model: "tngtech/deepseek-r1t2-chimera:free",
    messages: [
      { role: "system", content: "You are a playful rival bot for a math quiz game. Reply with a short, energetic taunt (max 20 words)." },
      { role: "user", content: "Give me one taunt to start a quiz battle." },
    ],
    temperature: 0.8,
    max_tokens: 64,
  });
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || "Let’s see if you can keep up!";
}
export async function aiBattlePick(q: Question): Promise<{ index: number; commentary?: string }> {
  const data = await callOpenRouter({
    model: "tngtech/deepseek-r1t2-chimera:free",
    temperature: 0.2,
    messages: [
      { role: "system", content: "You are a concise competitive math player. Decide the best option and reply in JSON: {\"choice\": 'A'|'B'|'C'|'D', \"commentary\": string}. Keep commentary under 18 words." },
      { role: "user", content: `Question: ${q.question}\nOptions:\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}` },
    ],
    max_tokens: 120,
  });

  if (!data) {
    return { index: Math.floor(Math.random() * q.options.length) };
  }

  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const matchJson = text.match(/\{[\s\S]*\}/);
  if (matchJson) {
    try {
      const obj = JSON.parse(matchJson[0]);
      const letter = String(obj.choice || obj.answer || "").trim().toUpperCase();
      const idx = Math.max(0, Math.min(q.options.length - 1, letter.charCodeAt(0) - 65));
      return { index: Number.isFinite(idx) ? idx : 0, commentary: typeof obj.commentary === "string" ? obj.commentary : undefined };
    } catch {
      // fall through
    }
  }
  const letter = (text.match(/[A-D]/i)?.[0] || "A").toUpperCase();
  const idx = Math.max(0, Math.min(q.options.length - 1, letter.charCodeAt(0) - 65));
  return { index: Number.isFinite(idx) ? idx : 0 };
}

// Short kid-friendly explanation (no final answer). Returns plain text.
export async function aiExplainShort(q: Question): Promise<string> {
  try {
    const data = await callOpenRouter({
      model: "tngtech/deepseek-r1t2-chimera:free",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a friendly math tutor for kids (ages 8-12). Explain how to solve the question in 2-4 very short bullet points. Keep it simple, concrete, and encouraging. Do NOT reveal the final answer."
        },
        {
          role: "user",
          content:
            `Question: ${q.question}\nOptions:\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`,
        },
      ],
      max_tokens: 140,
    });
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || "Hint: Break the problem into small steps and try simple arithmetic to get close.";
  } catch {
    return "Hint: Think step by step. Write down the numbers, choose +, −, ×, or ÷, and check the units.";
  }
}
