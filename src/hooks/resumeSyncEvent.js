const RESUME_SYNC_EVENT = 'angelwetter:resume-sync';
const RESUME_SYNC_SEQUENCE_KEY = '__aw_resume_sync_sequence';

function readSequenceFromWindow() {
  if (typeof window === 'undefined') return 0;
  const raw = Number(window[RESUME_SYNC_SEQUENCE_KEY] ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function writeSequenceToWindow(sequence) {
  if (typeof window === 'undefined') return;
  window[RESUME_SYNC_SEQUENCE_KEY] = sequence;
}

export function readResumeSyncSequence() {
  return readSequenceFromWindow();
}

export function dispatchResumeSync(detail = {}) {
  if (typeof window === 'undefined') return;
  const nextSequence = readSequenceFromWindow() + 1;
  writeSequenceToWindow(nextSequence);
  window.dispatchEvent(
    new CustomEvent(RESUME_SYNC_EVENT, {
      detail: {
        sequence: nextSequence,
        at: Date.now(),
        ...detail,
      },
    })
  );
}

export { RESUME_SYNC_EVENT };
