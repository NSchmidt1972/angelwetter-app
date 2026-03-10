import { useMemo } from 'react';
import { useLocalStorageValue } from '@/hooks/useLocalStorageValue';
import { isMarilouAngler, isTrustedAngler } from '@/utils/visibilityPolicy';

export function useViewerContext({ defaultName = 'Unbekannt', defaultFilter = 'recent' } = {}) {
  const [storedAnglerName] = useLocalStorageValue('anglerName', defaultName);
  const [filterSetting] = useLocalStorageValue('dataFilter', defaultFilter);

  const anglerName = (storedAnglerName || defaultName).trim();
  const anglerNameNorm = useMemo(() => anglerName.toLowerCase(), [anglerName]);
  const isTrustedViewer = useMemo(() => isTrustedAngler(anglerName), [anglerName]);
  const isMarilouViewer = useMemo(() => isMarilouAngler(anglerName), [anglerName]);

  return {
    anglerName,
    anglerNameNorm,
    filterSetting,
    isTrustedViewer,
    isMarilouViewer,
  };
}
