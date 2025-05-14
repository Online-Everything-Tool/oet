// FILE: app/lib/sessionStorageUtils.ts
const ITDE_SESSION_STORAGE_PREFIX = 'oet-itde-';

function getStorageKey(targetDirective: string): string {
  if (!targetDirective) {
    console.warn(
      '[ITDE Utils] Attempted to get storage key for empty targetDirective.'
    );
    return `${ITDE_SESSION_STORAGE_PREFIX}__invalid__`;
  }
  return `${ITDE_SESSION_STORAGE_PREFIX}${targetDirective}`;
}

/**
 * Signals a target tool that a source tool has output ready for it.
 * If the target already has signals, the source is added only if not already present.
 * @param targetDirective The directive of the tool to receive the signal.
 * @param sourceDirective The directive of the tool sending the signal.
 */
export function signalTargetTool(
  targetDirective: string,
  sourceDirective: string
): void {
  if (!targetDirective || !sourceDirective) {
    console.error(
      '[ITDE Utils] Invalid parameters for signalTargetTool. Both target and source directives are required.'
    );
    return;
  }

  const key = getStorageKey(targetDirective);
  let sources: string[] = [];

  try {
    const existing = sessionStorage.getItem(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'string')
      ) {
        sources = parsed;
      } else {
        console.warn(
          `[ITDE Utils] Corrupted data in sessionStorage for key ${key}. Resetting to signal from ${sourceDirective}.`
        );
        sources = []; // Reset if data is not a string array
      }
    }
  } catch (e) {
    console.warn(
      `[ITDE Utils] Error parsing sessionStorage for key ${key}. Resetting to signal from ${sourceDirective}.`,
      e
    );
    sources = []; // Reset on parse error
  }

  if (!sources.includes(sourceDirective)) {
    sources.push(sourceDirective);
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(sources));
    console.log(
      `[ITDE Utils] Signaled ${targetDirective} from ${sourceDirective}. Current signals: ${sources.join(', ')}`
    );
  } catch (e) {
    console.error('[ITDE Utils] Error setting sessionStorage item:', e);
  }
}

/**
 * Retrieves all source tool directives currently signaling a target tool.
 * @param targetDirective The directive of the target tool.
 * @returns An array of source tool directives, or an empty array if none.
 */
export function getSourceSignalsForTarget(targetDirective: string): string[] {
  if (!targetDirective) return [];
  const key = getStorageKey(targetDirective);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) {
      const sources = JSON.parse(existing);
      return Array.isArray(sources) &&
        sources.every((item) => typeof item === 'string')
        ? sources
        : [];
    }
  } catch (e) {
    console.warn(
      `[ITDE Utils] Error parsing sessionStorage for key ${key} during get.`,
      e
    );
  }
  return [];
}

/**
 * Clears a specific source signal for a target tool.
 * This is called when the target tool has processed or ignored a signal from a specific source.
 * @param targetDirective The directive of the target tool.
 * @param sourceDirective The directive of the source tool whose signal is to be cleared.
 */
export function clearSourceSignal(
  targetDirective: string,
  sourceDirective: string
): void {
  if (!targetDirective || !sourceDirective) return;

  const key = getStorageKey(targetDirective);
  let sources = getSourceSignalsForTarget(targetDirective);

  if (sources.length === 0) {
    return; // Nothing to clear
  }

  const initialLength = sources.length;
  sources = sources.filter((s) => s !== sourceDirective);

  if (sources.length < initialLength) {
    // Only update if something was actually removed
    if (sources.length === 0) {
      try {
        sessionStorage.removeItem(key);
        console.log(
          `[ITDE Utils] Cleared all signals for ${targetDirective} as last source ${sourceDirective} was removed.`
        );
      } catch (e) {
        console.error('[ITDE Utils] Error removing sessionStorage item:', e);
      }
    } else {
      try {
        sessionStorage.setItem(key, JSON.stringify(sources));
        console.log(
          `[ITDE Utils] Cleared signal from ${sourceDirective} for ${targetDirective}. Remaining: ${sources.join(', ')}`
        );
      } catch (e) {
        console.error('[ITDE Utils] Error setting sessionStorage item:', e);
      }
    }
  }
}

/**
 * Clears all ITDE signals for a specific target directive.
 * Useful if the user explicitly ignores all pending transfers for a tool.
 * @param targetDirective The directive of the target tool.
 */
export function clearAllSignalsForTarget(targetDirective: string): void {
  if (!targetDirective) return;
  try {
    sessionStorage.removeItem(getStorageKey(targetDirective));
    console.log(`[ITDE Utils] Cleared all signals for ${targetDirective}.`);
  } catch (e) {
    console.error('[ITDE Utils] Error removing sessionStorage item:', e);
  }
}
