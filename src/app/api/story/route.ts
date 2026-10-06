import { NextRequest, NextResponse } from "next/server";
import { searchRelevantQuotes } from "@/lib/vectorSearch";
import { groqChatCompletion } from "@/lib/groq";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { problem } = await req.json();

    if (!problem || typeof problem !== "string" || !problem.trim()) {
      return NextResponse.json(
        { error: "Problem description is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    // 1. Vector Search for top matched Swami Vivekananda quotes
    const matchedQuotes = searchRelevantQuotes(problem, 3);

    // Format quote context for LLM prompt
    const quotesContext = matchedQuotes
      .map(
        (q, idx) =>
          `Quote #${idx + 1}:\nTitle: ${q.title}\nQuote: "${q.quote}"\nLink: ${q.link}`
      )
      .join("\n\n");

    const systemPrompt = `You are a wise, compassionate spiritual guide and master storyteller inspired by the life and teachings of Swami Vivekananda.

Your mission is to read the user's personal situation/problem (which may be written in Hindi, English, or Hinglish) and craft a deeply moving, inspiring story or wisdom parable tailored to their exact emotional state and struggle.

CRITICAL INSTRUCTIONS:
1. LANGUAGE IDENTIFICATION: Detect the language of the user's input. If the user wrote in Hindi or Hinglish, write the ENTIRE story and advice in HINDI (Hindi script). If written in English, write in ENGLISH.
2. INTEGRATE QUOTE: Naturally weave the provided Swami Vivekananda quote(s) into the narrative as the turning point or spiritual illumination of the story.
3. EMPATHY & CLARITY: Offer compassionate empathy first, followed by a powerful story of resilience, courage, and self-belief.
4. REFERENCES AT THE END: At the very end of your response, include a distinct Reference section formatted exactly as:

---
### 📖 Reference & Belur Math Sources

For each quote referenced in the story, list:
- **Title**: [Title of quote]
- **Belur Math Link**: [Official URL]
- **Quote**: "[Quote text]"
`;

    const userPrompt = `User Problem / Situation:
"${problem}"

Relevant Swami Vivekananda Quotes (Retrieved via Local Vector Search):
${quotesContext}

Please generate the inspiring story now in the appropriate language (Hindi or English).`;

    // 2. Call Groq API with streaming
    const groqRes = await groqChatCompletion({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      temperature: 0.7,
      maxTokens: 1500,
    });

    // 3. Stream response back to client using ReadableStream
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!groqRes.body) {
          controller.close();
          return;
        }

        const reader = groqRes.body.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") {
                  controller.close();
                  return;
                }
                try {
                  const json = JSON.parse(dataStr);
                  const content = json.choices[0]?.delta?.content || "";
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch {
                  // Skip invalid JSON chunks
                }
              }
            }
          }
        } catch (err) {
          console.error("Stream reading error:", err);
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
