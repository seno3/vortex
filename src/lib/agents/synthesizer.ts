import { generateJSON } from './llm';

export interface SynthesizerResult {
  summary: string;
  affectedArea: string;
  estimatedSeverity: string;
  confidence: number;
  keyFacts: string[];
}

export async function synthesizeTips(
  tips: Array<{ description: string; category: string; credibilityScore: number }>,
  location: [number, number],
): Promise<SynthesizerResult> {
  const prompt = `You are a safety AI synthesizing multiple corroborated community tips into a unified situation report.

LOCATION: [${location[1].toFixed(4)}, ${location[0].toFixed(4)}]
TIPS (${tips.length} total):
${tips.map(t => `- [credibility:${t.credibilityScore}] "${t.description}"`).join('\n')}

Return JSON:
{
  "summary": "2-3 sentence unified situation report",
  "affectedArea": "brief description of affected area",
  "estimatedSeverity": "low|medium|high|critical",
  "confidence": number (0-100),
  "keyFacts": ["2-4 bullet-point facts extracted from the reports, each under 60 chars"]
}`;

  return generateJSON<SynthesizerResult>(prompt);
}
