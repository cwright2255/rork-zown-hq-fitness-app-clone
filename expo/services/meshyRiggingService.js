// services/meshyRiggingService.js
//
// Client for Meshy's Rigging API — used ONLY by the one-time reference-rig
// preparation step (scripts/generateReferenceRig.js), never at per-scan
// runtime. See lib/applySkeletonToMesh.js for how the resulting skeleton
// gets reused across every user's mesh without any further API calls.
//
// Docs: https://docs.meshy.ai/en/api/rigging-and-animation
// Requires a Meshy API key (Pro/Studio/Enterprise plan for a commercial
// license without CC-BY attribution — see the audit for why that matters).

const MESHY_API_URL = 'https://api.meshy.ai/openapi/v1/rigging';
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 180000;

/**
 * Submits a rigging task for a GLB model provided as a data URI (avoids
 * needing separate public file hosting for a one-time reference asset).
 * @param {{ apiKey: string, modelDataUri: string, heightMeters: number }} params
 * @returns {Promise<string>} the rigging task id
 */
export async function submitRiggingTask({ apiKey, modelDataUri, heightMeters }) {
  const res = await fetch(MESHY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_url: modelDataUri,
      height_meters: heightMeters,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Meshy rigging submit failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const taskId = data.result;
  if (!taskId) {
    throw new Error(`Meshy rigging submit did not return a task id: ${JSON.stringify(data)}`);
  }
  return taskId;
}

/**
 * Polls a rigging task until it succeeds or fails.
 * @returns {Promise<{ riggedGlbUrl: string, riggedFbxUrl: string, basicAnimations: object }>}
 */
export async function pollRiggingTask({ apiKey, taskId }) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await fetch(`${MESHY_API_URL}/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Meshy rigging poll failed: ${res.status}`);
    }
    const task = await res.json();

    if (task.status === 'SUCCEEDED') {
      return {
        riggedGlbUrl: task.result?.rigged_character_glb_url,
        riggedFbxUrl: task.result?.rigged_character_fbx_url,
        basicAnimations: task.result?.basic_animations ?? {},
      };
    }
    if (task.status === 'FAILED') {
      throw new Error(`Meshy rigging task failed: ${task.task_error?.message ?? 'unknown error'}`);
    }
    // PENDING / IN_PROGRESS — keep waiting
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Meshy rigging task timed out');
}

/**
 * Convenience wrapper: submit + poll in one call.
 */
export async function rigModel({ apiKey, modelDataUri, heightMeters }) {
  const taskId = await submitRiggingTask({ apiKey, modelDataUri, heightMeters });
  return pollRiggingTask({ apiKey, taskId });
}
