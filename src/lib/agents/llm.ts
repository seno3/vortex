import { GoogleGenerativeAI, GoogleGenerativeAIResponseError } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const FEATHERLESS_MODEL = 'meta-llama/Meta-Llama-3.1-8B-Instruct';
const FEATHERLESS_BASE = 'https://api.featherless.ai/v1';

function isQuotaError(err: unknown): boolean {
  if (err instanceof GoogleGenerativeAIResponseError) {
    const status = (err as { status?: number }).status;
    if (status === 429) return true;
  }
  const msg = String(err);
  return msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
}

async function callFeatherless(prompt: string): Promise<string> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) throw new Error('FEATHERLESS_API_KEY not set');

  const res = await fetch(`${FEATHERLESS_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: FEATHERLESS_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no explanation, no extra text — just the raw JSON object.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Featherless error ${res.status}: ${body}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  let content = data.choices[0].message.content.trim();
  // Strip markdown fences if the model added them despite instructions
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) content = fenceMatch[1].trim();
  return content;
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  // Try Gemini first
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    });
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as T;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
    console.warn('[llm] Gemini quota hit — falling back to FeatherlessAI');
  }

  // Fallback: FeatherlessAI
  const text = await callFeatherless(prompt);
  return JSON.parse(text) as T;
}
