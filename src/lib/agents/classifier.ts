import { generateJSON } from './llm';

export interface ClassifierResult {
  classification: string;
  threatLevel: 'info' | 'advisory' | 'warning' | 'critical';
  credibilityAdjustment: number;
  urgencyDecayMinutes: number;
  sourceType: string[];
  reasoning: string;
}

export async function classifyTip(
  description: string,
  category: string,
  location: [number, number],
): Promise<ClassifierResult> {
  const prompt = `You are a community safety AI classifying a public safety tip.

TIP: "${description}"
CATEGORY: ${category}
LOCATION: [${location[1].toFixed(4)}, ${location[0].toFixed(4)}]

Classify this tip and return JSON:
{
  "classification": "string (e.g. 'active_shooter', 'flooding', 'road_hazard')",
  "threatLevel": "info" | "advisory" | "warning" | "critical",
  "credibilityAdjustment": number (-20 to +20, based on specificity and plausibility),
  "urgencyDecayMinutes": number (how many minutes until tip is stale: 15-240),
  "sourceType": ["array of applicable tags from: firsthand, secondhand, specific, vague, immediate, past, emotional"],
  "reasoning": "one sentence"
}

sourceType rules:
- "firsthand" if reporter witnessed directly ("I saw", "I heard", "I'm watching")
- "secondhand" if relaying someone else's report ("someone said", "I was told")
- "specific" if report includes specific location details or identifiers
- "vague" if location or event is unclear
- "immediate" if language suggests it's happening now (present tense, urgency)
- "past" if it happened earlier (past tense, "earlier today")
- "emotional" if language is panicked or highly emotional (noted, does not reduce credibility)`;

  return generateJSON<ClassifierResult>(prompt);
}
