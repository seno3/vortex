import { generateJSON } from './llm';

export interface CorroboratorResult {
  corroborationIds: string[];
  contradictionIds: string[];
  confidenceScore: number;
  shouldEscalate: boolean;
  reasoning: string;
}

export async function corroborateTip(
  newTip: { _id: string; description: string; category: string },
  nearbyTips: Array<{ _id: string; description: string; category: string; credibilityScore: number }>,
): Promise<CorroboratorResult> {
  const prompt = `You are a safety AI corroborating a new community tip against nearby recent tips.

NEW TIP (id: ${newTip._id}): "${newTip.description}" [${newTip.category}]

NEARBY TIPS:
${nearbyTips.map(t => `- id:${t._id} credibility:${t.credibilityScore} "${t.description}" [${t.category}]`).join('\n')}

Return JSON:
{
  "corroborationIds": ["tip ids that support the new tip"],
  "contradictionIds": ["tip ids that contradict the new tip"],
  "confidenceScore": number (0-100),
  "shouldEscalate": boolean (true if 3+ active_threat tips from different users suggest real danger),
  "reasoning": "one sentence"
}`;

  return generateJSON<CorroboratorResult>(prompt);
}
