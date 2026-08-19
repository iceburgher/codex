import Anthropic from "@anthropic-ai/sdk";

/**
 * Serverklient mot Anthropics API.
 *
 * Nyckeln är hemlig och får bara läsas här — modulen importeras aldrig från
 * en klientkomponent. Saknas miljövariabeln är AI-sammanfattningen helt
 * enkelt inte påslagen, och knappen i gränssnittet döljs.
 */
export const ASSISTANT_MODEL = "claude-opus-5";

let cached: Anthropic | null = null;

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropic(): Anthropic | null {
  if (!anthropicConfigured()) return null;
  if (cached) return cached;

  cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return cached;
}
