import type { Question } from "@/data/questions";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"; // Changed from x.ai to groq
const GROQ_MODEL = (import.meta.env.VITE_GROK_MODEL as string | undefined) || "llama-3.3-70b-versatile";
const GROQ_FAST_MODEL = (import.meta.env.VITE_GROQ_FAST_MODEL as string | undefined) || "llama-3.1-8b-instant";

async function callGroq(body: unknown): Promise<any | null> {
  const apiKey = import.meta.env.VITE_GROK_API_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let err: any = undefined;
      try { err = await res.json(); } catch {}
      console.warn("Groq API error", res.status, err);
    }
    return res.json();
  } catch (e) {
    console.warn("Groq API network error", e);
    return null;
  }
}

// Streaming chat completion (SSE) for Groq
export type StreamOptions = {
  mode: "fast" | "detailed";
  onDelta: (text: string) => void;
  onDone?: (fullText: string, diagramPlan: DiagramPlan | null) => void;
  onError?: (err: any) => void;
};

export type DiagramShape =
  | { type: "line"; x: number; y: number; x2: number; y2: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "circle"; x: number; y: number; r: number }
  | { type: "label"; x: number; y: number; text: string };

export type DiagramPlan = { shapes: DiagramShape[] };

export function parseDiagramPlanFromText(full: string): DiagramPlan | null {
  // Look for ```json ... ``` or a JSON blob following JSON:/DiagramPlan:
  const codeFence = full.match(/```json\s*([\s\S]*?)```/i);
  const jsonMatch = codeFence?.[1]
    || full.match(/(?:JSON|DiagramPlan)\s*:\s*(\{[\s\S]*\})/i)?.[1];
  if (!jsonMatch) return null;
  try {
    const obj = JSON.parse(jsonMatch);
    if (obj && Array.isArray(obj.shapes)) return obj as DiagramPlan;
  } catch {}
  return null;
}

export function aiSolveShortIndianStream(q: Question, opts: StreamOptions): { cancel: () => void } | null {
  const apiKey = import.meta.env.VITE_GROK_API_KEY as string | undefined;
  if (!apiKey) return null;
  const needsDiagram = /\b(triangle|circle|rectangle|square|perimeter|area|angle|angles|line|lines|ray|segment|arc|chord|parallel|perpendicular|geometry|diagram|polygon|radius|diameter|length|breadth|width|height)\b/i.test(q.question);
  const simpleKeywords = /(sum|add|plus|difference|minus|subtract|product|multiply|times|divide|quotient|remainder|table|units? digit|ones|tens|hundreds|simple|easy)/i;
  const isSimple = simpleKeywords.test(q.question) && q.question.length < 140;
  const model = opts.mode === "fast" ? GROQ_FAST_MODEL : GROQ_MODEL;
  const maxTokens = opts.mode === "fast" ? (isSimple ? 260 : 380) : (isSimple ? 420 : 640);
  const sysPrompt = needsDiagram
    ? "You are a friendly Indian math tutor for a 6th standard student. Provide only the steps needed: 4–6 steps for simple problems, 8–12 for harder ones, and never more than 14 lines. Start each line with 'Step 1:', 'Step 2:' … Use very easy words and small arithmetic. Include a tiny ASCII diagram (max width 30 chars) only if it helps. Use Indian style (lakh/crore if relevant, ₹ for rupees, and symbols ×, ÷, +, −). Do NOT use LaTeX. Choose the correct option letter from the list only. End with EXACT: 'Final: <option letter> - <answer text>'. At the end, add a JSON code block with a diagram plan like: ```json { \"shapes\": [ { \"type\": \"line\", \"x\": 0.1, \"y\": 0.2, \"x2\": 0.9, \"y2\": 0.2 } ] } ```"
    : "You are a friendly Indian math tutor for a 6th standard student. Provide only the steps needed: 4–6 steps for simple problems, 8–12 for harder ones, and never more than 14 lines. Start each line with 'Step 1:', 'Step 2:' … Use very easy words and small arithmetic. Do NOT include any diagram or JSON plan. Use Indian style (lakh/crore if relevant, ₹ for rupees, and symbols ×, ÷, +, −). Do NOT use LaTeX. Choose the correct option letter from the list only. End with EXACT: 'Final: <option letter> - <answer text>'.";

  const controller = new AbortController();
  const body = {
    model,
    temperature: 0.2,
    top_p: 0.3,
    stream: true,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: sysPrompt },
      {
        role: "user",
        content: `Question: ${q.question}\nOptions (choose only from these):\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`,
      },
    ],
  } as const;

  (async () => {
    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await (async () => { try { return await res.json(); } catch { return {}; } })();
        opts.onError?.(err);
        opts.onDone?.("", null);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // SSE lines like: data: {json}\n\n
        for (const line of chunk.split(/\n/)) {
          const m = line.match(/^data:\s*(.*)$/);
          if (!m) continue;
          const payload = m[1].trim();
          if (payload === "[DONE]") { continue; }
          try {
            const obj = JSON.parse(payload);
            const delta = obj?.choices?.[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              opts.onDelta(delta);
            }
          } catch {
            // ignore decode errors for partial lines
          }
        }
      }
      const plan = parseDiagramPlanFromText(full);
      opts.onDone?.(full, plan);
    } catch (e) {
      opts.onError?.(e);
      opts.onDone?.("", null);
    }
  })();

  return { cancel: () => controller.abort() };
}

// Short step-by-step full solution in Indian style (plain text)
export async function aiSolveShortIndian(q: Question): Promise<string> {
  try {
    const needsDiagram = /\b(triangle|circle|rectangle|square|perimeter|area|angle|angles|line|lines|ray|segment|arc|chord|parallel|perpendicular|geometry|diagram|polygon|radius|diameter|length|breadth|width|height)\b/i.test(q.question);
    const sysPrompt = needsDiagram
      ? "You are a friendly Indian math tutor for a 6th standard student. Provide only the steps needed: 4–6 steps for simple problems, 8–12 for harder ones, and never more than 14 lines. Start each line with 'Step 1:', 'Step 2:' … Use very easy words and small arithmetic. Include a tiny ASCII diagram (max width 30 chars) only if it helps, using plain characters. Use Indian style (lakh/crore if relevant, ₹ for rupees, and symbols ×, ÷, +, −). Do NOT use LaTeX. Choose the correct option letter from the list only. End with EXACT: 'Final: <option letter> - <answer text>'."
      : "You are a friendly Indian math tutor for a 6th standard student. Provide only the steps needed: 4–6 steps for simple problems, 8–12 for harder ones, and never more than 14 lines. Start each line with 'Step 1:', 'Step 2:' … Use very easy words and small arithmetic. Do not include any diagram. Use Indian style (lakh/crore if relevant, ₹ for rupees, and symbols ×, ÷, +, −). Do NOT use LaTeX. Choose the correct option letter from the list only. End with EXACT: 'Final: <option letter> - <answer text>'.";
    const data = await callGroq({
      model: GROQ_FAST_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: sysPrompt,
        },
        {
          role: "user",
          content: `Question: ${q.question}\nOptions (choose only from these):\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`,
        },
      ],
      max_tokens: 640,
      top_p: 0.3,
    });
    if (!data) {
      return "Add Groq API key to .env as VITE_GROK_API_KEY and retry.\nFinal: <answer>";
    }
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!text || !text.includes("Final:")) {
      const retry = await callGroq({
        model: GROQ_FAST_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: needsDiagram
              ? "Re-answer for a 6th standard student. Provide only the steps needed: 4–6 for simple, 8–12 for harder, max 14 lines. Start each line with 'Step 1:' … Use very simple words. Include a tiny ASCII diagram only if it helps. End with EXACT: 'Final: <option letter> - <answer text>'."
              : "Re-answer for a 6th standard student. Provide only the steps needed: 4–6 for simple, 8–12 for harder, max 14 lines. Start each line with 'Step 1:' … Use very simple words. Do not include any diagram. End with EXACT: 'Final: <option letter> - <answer text>'.",
          },
          {
            role: "user",
            content: `Question: ${q.question}\nOptions (choose only from these):\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`,
          },
        ],
        max_tokens: 640,
        top_p: 0.3,
      });
      const text2 = retry?.choices?.[0]?.message?.content?.trim();
      return text2 || "Steps: Write the numbers, do the operation step by step, simplify neatly.\nFinal: <answer>";
    }
    return text;
  } catch {
    return "Steps: Do simple calculations step by step and keep units.\nFinal: <answer>";
  }
}

export async function aiTaunt(): Promise<string> {
  const data = await callGroq({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: "You are a playful rival bot for a math quiz game. Reply with a short, energetic taunt (max 20 words)." },
      { role: "user", content: "Give me one taunt to start a quiz battle." },
    ],
    temperature: 0.8,
    max_tokens: 64,
  });
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || "Let's see if you can keep up!";
}

export async function aiBattlePick(q: Question): Promise<{ index: number; commentary?: string }> {
  const data = await callGroq({
    model: GROQ_MODEL,
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
    const data = await callGroq({
      model: GROQ_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a friendly math tutor for kids (ages 8-12). Explain how to solve the question in 2-4 very short bullet points. Keep it simple, concrete, and encouraging. Do NOT reveal the final answer.",
        },
        {
          role: "user",
          content: `Question: ${q.question}\nOptions:\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`,
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