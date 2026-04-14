import type { RegionDefinition } from '@/types/offline';

export const REGIONS: RegionDefinition[] = [
  {
    key: 'us-west',
    name: 'US West',
    description: 'California, Oregon, Washington',
    pmtiles_url: 'https://build.protomaps.com/20240101.pmtiles',
    size_bytes_approx: 1_200_000_000,
  },
  {
    key: 'us-northeast',
    name: 'US Northeast',
    description: 'New England, New York, Pennsylvania',
    pmtiles_url: 'https://build.protomaps.com/20240101.pmtiles',
    size_bytes_approx: 900_000_000,
  },
  {
    key: 'europe-alps',
    name: 'European Alps',
    description: 'Switzerland, Austria, northern Italy, southern France',
    pmtiles_url: 'https://build.protomaps.com/20240101.pmtiles',
    size_bytes_approx: 800_000_000,
  },
];
