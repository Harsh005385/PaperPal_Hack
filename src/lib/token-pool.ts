import { MODEL_TIERS, type ModelConfig } from "./models";

interface TokenState {
  token: string;
  errorCount: number;
  lastUsed: number;
  cooldownUntil: number;
}

const COOLDOWN_MS = 60_000;
const MAX_ERRORS_BEFORE_COOLDOWN = 3;

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

function loadTokens(): TokenState[] {
  const envTokens = [
    process.env.HF_TOKEN_1,
    process.env.HF_TOKEN_2,
    process.env.HF_TOKEN_3,
    process.env.HF_TOKEN_4,
    process.env.HF_TOKEN_5,
  ].filter((t): t is string => !!t && t.startsWith("hf_"));

  return envTokens.map((token) => ({
    token,
    errorCount: 0,
    lastUsed: 0,
    cooldownUntil: 0,
  }));
}

class TokenPool {
  private tokens: TokenState[];
  private roundRobinIndex = 0;

  constructor(tokens: TokenState[]) {
    this.tokens = tokens;
  }

  private getNextToken(): TokenState | null {
    const now = Date.now();
    const available = this.tokens.filter((t) => t.cooldownUntil < now);
    if (available.length === 0) return null;

    const idx = this.roundRobinIndex % available.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % available.length;
    return available[idx];
  }

  async callWithFallback(
    prompt: string,
    systemPrompt: string,
    preferredModel?: ModelConfig
  ): Promise<{ text: string; model: string; tokenIndex: number }> {
    const models = preferredModel
      ? [preferredModel, ...MODEL_TIERS.filter((m) => m.id !== preferredModel.id)]
      : MODEL_TIERS;

    if (this.tokens.length === 0) {
      throw new Error(
        "No HuggingFace tokens found. Add HF_TOKEN_1..HF_TOKEN_5 to your environment variables."
      );
    }

    let lastError: Error | null = null;

    for (const model of models) {
      for (let attempt = 0; attempt < this.tokens.length; attempt++) {
        const tokenState = this.getNextToken();
        if (!tokenState) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        try {
          const res = await fetch(HF_CHAT_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenState.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model.id,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
              ],
              max_tokens: model.maxNewTokens,
              temperature: 0.3,
              stream: false,
            }),
          });

          if (!res.ok) {
            const errBody = await res.text();
            const status = res.status;

            tokenState.errorCount++;
            tokenState.lastUsed = Date.now();
            if (tokenState.errorCount >= MAX_ERRORS_BEFORE_COOLDOWN) {
              tokenState.cooldownUntil = Date.now() + COOLDOWN_MS;
              tokenState.errorCount = 0;
            }

            console.warn(
              `[TokenPool] ${model.name} returned ${status}: ${errBody.slice(0, 150)}`
            );

            if (status === 429 || status === 503 || status === 500) continue;
            if (status === 404 || status === 422) break;
            continue;
          }

          const data = await res.json();
          const text = data.choices?.[0]?.message?.content || "";

          tokenState.errorCount = 0;
          tokenState.lastUsed = Date.now();

          const tokenIdx = this.tokens.indexOf(tokenState);
          return { text, model: model.name, tokenIndex: tokenIdx };
        } catch (err: unknown) {
          tokenState.errorCount++;
          tokenState.lastUsed = Date.now();
          if (tokenState.errorCount >= MAX_ERRORS_BEFORE_COOLDOWN) {
            tokenState.cooldownUntil = Date.now() + COOLDOWN_MS;
            tokenState.errorCount = 0;
          }
          lastError = err instanceof Error ? err : new Error(String(err));
          console.error(`[TokenPool] Network error with ${model.name}:`, lastError.message);
        }
      }
    }

    throw lastError || new Error("All tokens and models exhausted");
  }

  getStatus() {
    const now = Date.now();
    return this.tokens.map((t, i) => ({
      index: i,
      available: t.cooldownUntil < now,
      errorCount: t.errorCount,
      cooldownRemaining: Math.max(0, t.cooldownUntil - now),
    }));
  }
}

export function getTokenPool(): TokenPool {
  return new TokenPool(loadTokens());
}
