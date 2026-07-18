// ============================================================
//  llm-client.ts — Cliente unificado: Anthropic API u Ollama local
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { OLLAMA_MODEL, OLLAMA_URL } from "./config.js";

export type LLMProvider = "anthropic" | "ollama" | "regex";

export function getLLMProvider(): LLMProvider {
  if (process.env.LLM_PROVIDER === "regex") return "regex";
  if (process.env.LLM_PROVIDER === "ollama") return "ollama";
  if (process.env.LLM_PROVIDER === "anthropic") return "anthropic";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "ollama";
}

export function getProviderLabel(): string {
  const p = getLLMProvider();
  if (p === "regex") return "Regex local (sin LLM)";
  return p === "ollama" ? `Ollama (${OLLAMA_MODEL})` : "Claude API (claude-sonnet-4-6)";
}

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function chatWithAnthropic(prompt: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
}

async function chatWithOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      format: "json",
      options: { num_predict: 1000, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama respondió ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Ollama devolvió una respuesta vacía");
  return content;
}

export async function chat(prompt: string): Promise<string> {
  return getLLMProvider() === "ollama"
    ? chatWithOllama(prompt)
    : chatWithAnthropic(prompt);
}
