const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

function formatGroqError(status: number, rawBody: string): string {
  if (status === 429) {
    let message = "";
    try {
      message = JSON.parse(rawBody)?.error?.message || "";
    } catch {
      message = rawBody;
    }
    const match = message.match(/try again in ([\d.]+)s/i);
    if (match) {
      const seconds = Math.ceil(parseFloat(match[1]));
      return `Groq is rate-limited right now — try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
    }
    return "Groq is rate-limited right now — try again in a moment.";
  }
  return `Groq API error (${status}): ${rawBody}`;
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqChatOptions {
  messages: GroqMessage[];
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  stream?: boolean;
  /**
   * gpt-oss reasons before answering and that hidden thinking counts against max_tokens.
   * "low" keeps long prompts from spending the whole budget thinking and returning nothing.
   */
  reasoningEffort?: "low" | "medium" | "high";
}

export async function groqChatCompletion({
  messages,
  apiKey,
  temperature = 0.7,
  maxTokens = 1500,
  json = false,
  stream = false,
  reasoningEffort,
}: GroqChatOptions): Promise<Response> {
  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(formatGroqError(res.status, errText));
  }

  return res;
}

export async function groqChatJson(options: Omit<GroqChatOptions, "json" | "stream">): Promise<string> {
  const res = await groqChatCompletion({ ...options, json: true, stream: false });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function groqChatText(options: Omit<GroqChatOptions, "json" | "stream">): Promise<string> {
  const res = await groqChatCompletion({ ...options, json: false, stream: false });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
