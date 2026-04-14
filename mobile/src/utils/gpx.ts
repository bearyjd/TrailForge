import type { SavedRoute } from '@/types/route';

export function generateGpx(route: SavedRoute): string {
  const toIso = (ms: number) => new Date(ms).toISOString();

  const trkpts = route.points
    .map((p) => {
      const ele = p.altitude !== null
        ? `\n      <ele>${p.altitude.toFixed(1)}</ele>`
        : '';
      return `    <trkpt lat="${p.latitude}" lon="${p.longitude}">${ele}\n      <time>${toIso(p.timestamp)}</time>\n    </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailForge" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <time>${toIso(route.created_at)}</time>
  </metadata>
  <trk>
    <name>${escapeXml(route.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
