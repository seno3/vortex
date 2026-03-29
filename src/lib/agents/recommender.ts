import { getExitsForBuilding } from '@/lib/db/exits';
import { generateJSON } from './llm';

export interface RecommenderResult {
  evacuationDirection: string;
  shelterAdvice: string;
  areasToAvoid: string[];
  immediateActions: string[];
  reasoning: string;
}

export async function recommendActions(
  synthesis: string,
  severity: string,
  location: [number, number],
  buildingId?: string,
): Promise<RecommenderResult> {
  let exitContext = 'No mapped exits for this building. Recommend general evacuation directions based on building orientation.';
  if (buildingId) {
    try {
      const exits = await getExitsForBuilding(buildingId);
      if (exits.length > 0) {
        exitContext = `Known exits for this building:\n${exits
          .map(
            (e) =>
              `- ${e.exitType} exit: ${e.description || 'no description'}, floor ${e.floor}${e.accessible ? ', wheelchair accessible' : ''}${e.status !== 'active' ? ` [${e.status.toUpperCase()}]` : ''}`,
          )
          .join('\n')}`;
      }
    } catch {
      // Non-fatal
    }
  }

  const prompt = `You are a community safety AI recommending immediate actions based on a verified threat.
Use specific exit information in your evacuation guidance when available.
If exits are marked BLOCKED or LOCKED, warn people to avoid them.
Prioritize wheelchair-accessible exits. If no exits are mapped, give directional guidance.

SITUATION: ${synthesis}
SEVERITY: ${severity}
LOCATION: [${location[1].toFixed(4)}, ${location[0].toFixed(4)}]
EXIT DATA: ${exitContext}

Return JSON:
{
  "evacuationDirection": "brief directional guidance, or empty string if shelter-in-place",
  "shelterAdvice": "where to go or stay",
  "areasToAvoid": ["list of area descriptions to avoid"],
  "immediateActions": ["list of 2-3 immediate action items"],
  "reasoning": "one sentence explaining the priority and rationale behind these recommendations"
}`;

  return generateJSON<RecommenderResult>(prompt);
}
