/**
 * Fake "typing" stream for the scripted demo. Reveals a canned string word by
 * word so a pre-authored reply feels like a live model is responding — with no
 * actual network/LLM call.
 */
export function streamWords(
  full: string,
  onUpdate: (partial: string) => void,
  opts: { wordsPerTick?: number; intervalMs?: number } = {}
): () => void {
  const { wordsPerTick = 2, intervalMs = 38 } = opts;
  const words = full.split(/(\s+)/); // keep whitespace tokens so spacing is preserved
  let i = 0;
  let cancelled = false;

  const timer = setInterval(() => {
    if (cancelled) return;
    i += wordsPerTick * 2; // *2 because whitespace tokens are interleaved
    if (i >= words.length) {
      onUpdate(full);
      clearInterval(timer);
      return;
    }
    onUpdate(words.slice(0, i).join(""));
  }, intervalMs);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

/** Roughly how long a reply will take to "type", for pacing the typing dots. */
export function estimateTypingMs(text: string, opts: { wordsPerTick?: number; intervalMs?: number } = {}): number {
  const { wordsPerTick = 2, intervalMs = 38 } = opts;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.min(2600, Math.ceil(wordCount / wordsPerTick) * intervalMs + 250);
}
