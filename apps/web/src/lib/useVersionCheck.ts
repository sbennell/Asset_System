import { useQuery } from '@tanstack/react-query';

export const APP_VERSION = '1.4.0';

export interface ChangelogEntry {
  version: string;
  date: string;
  content: string;
}

interface VersionCheck {
  latestVersion: string | null;
  updateAvailable: boolean;
  changelog: ChangelogEntry[];
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

function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const sections = text.split(/(?=## \[\d+\.\d+\.\d+\])/);
  for (const section of sections) {
    const headerMatch = section.match(/## \[(\d+\.\d+\.\d+)\]\s*-\s*(\S+)/);
    if (!headerMatch) continue;
    const content = section
      .replace(/## \[.*?\].*\n/, '')
      .replace(/^---\s*$/gm, '')
      .trim();
    entries.push({
      version: headerMatch[1],
      date: headerMatch[2],
      content
    });
  }
  return entries;
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
    updateAvailable: latestVersion ? isNewer(latestVersion, APP_VERSION) : false,
    changelog: parseChangelog(text)
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
