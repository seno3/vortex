import { classifyTip } from './classifier';
import { corroborateTip } from './corroborator';
import { synthesizeTips } from './synthesizer';
import { recommendActions } from './recommender';
import { setAgentField, setAnalysisMeta, updateTipAnalysis, getTipsInArea } from '@/lib/db/tips';
import { emitTipAnalysis } from '@/lib/socket';
import type { ITip } from '@/lib/db/tips';
import type { TipStatus } from '@/types';

const log = (tipId: string, msg: string) =>
  console.log(`[agent:${tipId.slice(-6)}] ${msg}`);

export async function processTip(tip: ITip): Promise<void> {
  const tipId = String(tip._id);
  const [lng, lat] = tip.location.coordinates;
  const startMs = Date.now();

  log(tipId, `▶ starting pipeline — "${tip.description.slice(0, 60)}"`);

  try {
    // ── Step 1: Classify ────────────────────────────────────────────────────
    log(tipId, '1/4 classifier → calling Gemini…');
    emitTipAnalysis(tipId, { event: 'agent_start', agent: 'classifier' });

    const classification = await classifyTip(tip.description, tip.category, [lng, lat]);
    const classifierData = {
      category: classification.classification,
      threatLevel: classification.threatLevel,
      credibility: tip.credibilityScore,
      sourceType: classification.sourceType ?? [],
      decayMinutes: classification.urgencyDecayMinutes,
      reasoning: classification.reasoning,
      completedAt: new Date().toISOString(),
    };

    await setAgentField(tipId, 'classifier', classifierData);
    log(tipId, `1/4 classifier ✓ threat=${classifierData.threatLevel} source=[${classifierData.sourceType.join(',')}]`);
    emitTipAnalysis(tipId, { event: 'agent_done', agent: 'classifier', data: classifierData });

    const status: TipStatus =
      classification.threatLevel === 'critical' || classification.threatLevel === 'warning'
        ? 'corroborated'
        : 'pending';
    await updateTipAnalysis(
      tipId,
      { classification: classification.classification, threatLevel: classification.threatLevel, reasoning: classification.reasoning },
      status,
    );

    // ── Step 2: Corroborate ─────────────────────────────────────────────────
    const nearbyTips = await getTipsInArea(lng, lat, 500, new Date(Date.now() - 30 * 60 * 1000));
    const others = nearbyTips.filter((t) => String(t._id) !== tipId).slice(0, 10);

    log(tipId, `2/4 corroborator → ${others.length} nearby tip(s) found, calling Gemini…`);
    emitTipAnalysis(tipId, { event: 'agent_start', agent: 'corroborator' });

    if (others.length === 0) {
      // No nearby tips — skip with a minimal record
      const skipData = {
        confidence: 0,
        corroboratingTips: [],
        contradictions: 0,
        isEscalation: false,
        reasoning: 'No nearby reports to cross-reference. Monitoring for corroboration.',
        completedAt: new Date().toISOString(),
      };
      await setAgentField(tipId, 'corroborator', skipData);
      await setAnalysisMeta(tipId, { totalProcessingMs: Date.now() - startMs, agentsRun: 2 });
      log(tipId, `2/4 corroborator ✓ skipped (no nearby tips) — done in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
      emitTipAnalysis(tipId, { event: 'agent_done', agent: 'corroborator', data: skipData });
      emitTipAnalysis(tipId, { event: 'complete', totalMs: Date.now() - startMs, agentsRun: 2 });
      return;
    }

    const corroboration = await corroborateTip(
      { _id: tipId, description: tip.description, category: tip.category },
      others.map((t) => ({
        _id: String(t._id),
        description: t.description,
        category: t.category,
        credibilityScore: t.credibilityScore,
      })),
    );

    // Compute time offsets relative to the current tip's createdAt
    const tipCreatedAt = tip.createdAt.getTime();
    const corroboratingTipsData = corroboration.corroborationIds.map((id) => {
      const other = others.find((o) => String(o._id) === id);
      return {
        tipId: id,
        timeOffsetMs: other ? other.createdAt.getTime() - tipCreatedAt : 0,
      };
    });

    const corroboratorData = {
      confidence: corroboration.confidenceScore,
      corroboratingTips: corroboratingTipsData,
      contradictions: corroboration.contradictionIds.length,
      isEscalation: corroboration.shouldEscalate,
      reasoning: corroboration.reasoning,
      completedAt: new Date().toISOString(),
    };

    await setAgentField(tipId, 'corroborator', corroboratorData);
    log(tipId, `2/4 corroborator ✓ confidence=${corroboratorData.confidence}% escalate=${corroboratorData.isEscalation} corroborated=${corroboratorData.corroboratingTips.length}`);
    emitTipAnalysis(tipId, { event: 'agent_done', agent: 'corroborator', data: corroboratorData });

    if (!corroboration.shouldEscalate) {
      await setAnalysisMeta(tipId, { totalProcessingMs: Date.now() - startMs, agentsRun: 2 });
      log(tipId, `✓ pipeline complete (no escalation) in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
      emitTipAnalysis(tipId, { event: 'complete', totalMs: Date.now() - startMs, agentsRun: 2 });
      return;
    }

    // ── Step 3: Synthesize ──────────────────────────────────────────────────
    log(tipId, '3/4 synthesizer → escalation triggered, calling Gemini…');
    emitTipAnalysis(tipId, { event: 'agent_start', agent: 'synthesizer' });

    const allTips = [tip, ...others].slice(0, 8);
    const synthesis = await synthesizeTips(
      allTips.map((t) => ({
        description: t.description,
        category: t.category,
        credibilityScore: t.credibilityScore,
      })),
      [lng, lat],
    );

    const synthesizerData = {
      summary: synthesis.summary,
      affectedArea: synthesis.affectedArea,
      confidence: synthesis.confidence,
      keyFacts: synthesis.keyFacts ?? [],
      completedAt: new Date().toISOString(),
    };

    await setAgentField(tipId, 'synthesizer', synthesizerData);
    log(tipId, `3/4 synthesizer ✓ severity=${synthesis.estimatedSeverity} confidence=${synthesis.confidence}%`);
    emitTipAnalysis(tipId, { event: 'agent_done', agent: 'synthesizer', data: synthesizerData });

    // ── Step 4: Recommend ───────────────────────────────────────────────────
    log(tipId, '4/4 recommender → generating guidance…');
    emitTipAnalysis(tipId, { event: 'agent_start', agent: 'recommender' });

    const recommendation = await recommendActions(
      synthesis.summary,
      synthesis.estimatedSeverity,
      [lng, lat],
      tip.buildingId,
    );

    // Map flat recommender output → structured actions array
    const actions: Array<{ type: string; instruction: string }> = [
      ...(recommendation.evacuationDirection
        ? [{ type: 'EVACUATE', instruction: recommendation.evacuationDirection }]
        : []),
      ...(recommendation.shelterAdvice
        ? [{ type: 'SHELTER', instruction: recommendation.shelterAdvice }]
        : []),
      ...recommendation.areasToAvoid.map((a) => ({ type: 'AVOID', instruction: a })),
    ];

    const recommenderData = {
      actions,
      exitsUsed: 0, // populated below if exits exist
      reasoning: recommendation.reasoning,
      completedAt: new Date().toISOString(),
    };

    await setAgentField(tipId, 'recommender', recommenderData);
    await setAnalysisMeta(tipId, { totalProcessingMs: Date.now() - startMs, agentsRun: 4 });

    log(tipId, `4/4 recommender ✓ ${actions.length} action(s) — pipeline complete in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
    emitTipAnalysis(tipId, { event: 'agent_done', agent: 'recommender', data: recommenderData });
    emitTipAnalysis(tipId, { event: 'complete', totalMs: Date.now() - startMs, agentsRun: 4 });

    // Update tip to escalated
    await updateTipAnalysis(
      tipId,
      { classification: classification.classification, threatLevel: 'critical', reasoning: synthesis.summary },
      'escalated',
    );
  } catch (err) {
    log(tipId, `✗ pipeline failed: ${err}`);
  }
}
