import { usePageViewTracker } from '@/hooks/usePageViewTracker';

export default function PageViewTracker({
  enabled = true,
  clubId = null,
  anglerName = null,
}) {
  usePageViewTracker({
    enabled,
    clubId,
    anglerName,
  });

  return null;
}
