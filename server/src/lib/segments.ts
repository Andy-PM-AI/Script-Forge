/** 分段大小（DESIGN_SPEC §3.5）：≤40 跳过；其余按表。 */
const SEGMENT_SIZE: Record<number, number> = {
  50: 10,
  60: 15,
  70: 14,
  80: 20,
  90: 15,
  100: 20,
};

export function getSegmentSize(episodes: number): number {
  if (episodes <= 40) return 0;
  return SEGMENT_SIZE[episodes] ?? 20;
}

/** 分集粗纲（第四步）每小段集数。 */
export const GROUP_SIZE = 5;

/** ≤40 集时跳过第三步，第四步直接分小段的每小段集数（DESIGN_SPEC §3.5）。 */
const DIRECT_GROUP_SIZE: Record<number, number> = { 20: 5, 30: 6, 40: 8 };

export function getDirectGroupSize(episodes: number): number {
  return DIRECT_GROUP_SIZE[episodes] ?? 0;
}

export interface Range {
  start: number;
  end: number;
}

/** 计算分段区间。 */
export function computeSegmentRanges(episodes: number): Range[] {
  const size = getSegmentSize(episodes);
  if (size === 0) return [];
  const ranges: Range[] = [];
  for (let start = 1; start <= episodes; start += size) {
    ranges.push({ start, end: Math.min(start + size - 1, episodes) });
  }
  return ranges;
}

/** 计算某分段下的分集粗纲小区间。 */
export function computeGroupRanges(range: Range): Range[] {
  const groups: Range[] = [];
  for (let start = range.start; start <= range.end; start += GROUP_SIZE) {
    groups.push({ start, end: Math.min(start + GROUP_SIZE - 1, range.end) });
  }
  return groups;
}

export function rangeLabel(range: Range): string {
  return `第 ${range.start}–${range.end} 集`;
}

/** 计算 ≤40 集时第四步直接分小段的区间（不依赖分段）。 */
export function computeDirectGroupRanges(episodes: number): Range[] {
  const size = getDirectGroupSize(episodes);
  if (size <= 0) return [];
  const ranges: Range[] = [];
  for (let start = 1; start <= episodes; start += size) {
    ranges.push({ start, end: Math.min(start + size - 1, episodes) });
  }
  return ranges;
}
