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
      "X-Title": "Quest Coin Rise",
    },
    body: JSON.stringify(body),
  });
  return res.json();
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
