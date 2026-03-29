import { classifyTip } from './classifier';
import { corroborateTip } from './corroborator';
import { synthesizeTips } from './synthesizer';
import { recommendActions } from './recommender';
import { updateTipAnalysis, getTipsInArea } from '@/lib/db/tips';
import type { ITip } from '@/lib/db/tips';
import type { TipStatus } from '@/types';

export async function processTip(tip: ITip): Promise<void> {
  try {
    const [lng, lat] = tip.location.coordinates;

    // Step 1: Classify
    const classification = await classifyTip(tip.description, tip.category, [lng, lat]);
    const status: TipStatus = classification.threatLevel === 'critical' || classification.threatLevel === 'warning'
      ? 'corroborated'
      : 'pending';

    await updateTipAnalysis(String(tip._id), {
      classification: classification.classification,
      threatLevel: classification.threatLevel,
      reasoning: classification.reasoning,
    }, status);

    // Step 2: Corroborate against nearby tips
    const nearbyTips = await getTipsInArea(lng, lat, 500, new Date(Date.now() - 30 * 60 * 1000));
    const others = nearbyTips.filter(t => String(t._id) !== String(tip._id)).slice(0, 10);

    if (others.length === 0) return;

    const corroboration = await corroborateTip(
      { _id: String(tip._id), description: tip.description, category: tip.category },
      others.map(t => ({ _id: String(t._id), description: t.description, category: t.category, credibilityScore: t.credibilityScore })),
    );

    if (!corroboration.shouldEscalate) return;

    // Step 3: Synthesize
    const allTips = [tip, ...others].slice(0, 8);
    const synthesis = await synthesizeTips(
      allTips.map(t => ({ description: t.description, category: t.category, credibilityScore: t.credibilityScore })),
      [lng, lat],
    );

    // Step 4: Recommend (include building exit data if available)
    await recommendActions(synthesis.summary, synthesis.estimatedSeverity, [lng, lat], tip.buildingId);

    await updateTipAnalysis(String(tip._id), {
      classification: classification.classification,
      threatLevel: 'critical',
      reasoning: synthesis.summary,
    }, 'escalated');

  } catch (err) {
    console.error('[orchestrator] processTip failed:', err);
  }
}
