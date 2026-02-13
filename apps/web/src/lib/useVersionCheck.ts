import { useQuery } from '@tanstack/react-query';

export const APP_VERSION = '1.3.2';

interface VersionCheck {
  latestVersion: string | null;
  updateAvailable: boolean;
}

function parseVersion(version: string): number[] {
  return version.split('.').map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

async function fetchLatestVersion(): Promise<VersionCheck> {
  const res = await fetch(
    'https://raw.githubusercontent.com/sbennell/Asset_System/main/VERSION_HISTORY.md',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('Failed to fetch version');
  const text = await res.text();
  const match = text.match(/##\s*\[(\d+\.\d+\.\d+)\]/);
  const latestVersion = match ? match[1] : null;
  return {
    latestVersion,
    updateAvailable: latestVersion ? isNewer(latestVersion, APP_VERSION) : false
  };
}

export function useVersionCheck() {
  return useQuery({
    queryKey: ['version-check'],
    queryFn: fetchLatestVersion,
    staleTime: 1000 * 60 * 60,      // check once per hour
    refetchInterval: 1000 * 60 * 60, // re-check every hour
    retry: false,
    refetchOnWindowFocus: false
  });
}
