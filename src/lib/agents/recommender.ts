import { GoogleGenerativeAI } from '@google/generative-ai';
import { getExitsForBuilding } from '@/lib/db/exits';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

export interface RecommenderResult {
  evacuationDirection: string;
  shelterAdvice: string;
  areasToAvoid: string[];
  immediateActions: string[];
}

export async function recommendActions(
  synthesis: string,
  severity: string,
  location: [number, number],
  buildingId?: string,
): Promise<RecommenderResult> {
  // Fetch exits for the affected building if we have a buildingId
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
      // Non-fatal — proceed without exit data
    }
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-04-17',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
  });

  const prompt = `You are a community safety AI recommending immediate actions based on a verified threat.
You have access to mapped emergency exits for the affected building.
Use specific exit information in your evacuation guidance when available.
If exits are marked as BLOCKED or LOCKED, warn people to avoid them.
Prioritize wheelchair-accessible exits when giving general guidance.
If no exits are mapped, give directional guidance (evacuate north, south, etc.) based on the threat location.

SITUATION: ${synthesis}
SEVERITY: ${severity}
LOCATION: [${location[1].toFixed(4)}, ${location[0].toFixed(4)}]

EXIT DATA:
${exitContext}

Return JSON:
{
  "evacuationDirection": "brief directional guidance or empty string if shelter-in-place",
  "shelterAdvice": "where to go or stay",
  "areasToAvoid": ["list of area descriptions to avoid"],
  "immediateActions": ["list of 2-3 immediate action items"]
}`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as RecommenderResult;
}
