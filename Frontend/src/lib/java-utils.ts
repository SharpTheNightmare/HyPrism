/**
 * Shared Java argument utility functions.
 * Used by useSettings and useJavaSettings hooks.
 */

export const parseJavaHeapMb = (args: string, flag: 'xmx' | 'xms'): number | null => {
  const match = args.match(new RegExp(`(?:^|\\s)-${flag}(\\d+(?:\\.\\d+)?)([kKmMgG])(?:\\s|$)`, 'i'));
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2].toUpperCase();
  if (unit === 'G') return Math.round(value * 1024);
  if (unit === 'K') return Math.max(1, Math.round(value / 1024));
  return Math.round(value);
};

export const upsertJavaHeapArgument = (args: string, flag: 'Xmx' | 'Xms', ramMb: number): string => {
  const pattern = new RegExp(`(?:^|\\s)-${flag}\\S+`, 'gi');
  const sanitized = args.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
  const heapArg = `-${flag}${ramMb}M`;
  return sanitized.length > 0 ? `${heapArg} ${sanitized}` : heapArg;
};

export const removeJavaFlag = (args: string, pattern: RegExp): string => {
  return args.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
};

export const upsertJavaGcMode = (args: string, mode: 'auto' | 'g1'): string => {
  const withoutGc = removeJavaFlag(args, /(?:^|\s)-XX:[+-]UseG1GC(?:\s|$)/gi);
  if (mode === 'auto') return withoutGc;
  return withoutGc.length > 0 ? `-XX:+UseG1GC ${withoutGc}` : '-XX:+UseG1GC';
};

export const detectJavaGcMode = (args: string): 'auto' | 'g1' => {
  return /(?:^|\s)-XX:\+UseG1GC(?:\s|$)/i.test(args) ? 'g1' : 'auto';
};

export const sanitizeAdvancedJavaArguments = (args: string): { sanitized: string; blocked: boolean } => {
  let result = args;

  const blockedPatterns = [
    /(?:^|\s)-javaagent:\S+/gi,
    /(?:^|\s)-agentlib:\S+/gi,
    /(?:^|\s)-agentpath:\S+/gi,
    /(?:^|\s)-Xbootclasspath(?::\S+)?/gi,
    /(?:^|\s)-jar(?:\s+\S+)?/gi,
    /(?:^|\s)-cp(?:\s+\S+)?/gi,
    /(?:^|\s)-classpath(?:\s+\S+)?/gi,
    /(?:^|\s)--class-path(?:\s+\S+)?/gi,
    /(?:^|\s)--module-path(?:\s+\S+)?/gi,
    /(?:^|\s)-Djava\.home=\S+/gi,
  ];

  const hadBlocked = blockedPatterns.some((pattern) => pattern.test(result));

  for (const pattern of blockedPatterns) {
    result = result.replace(pattern, ' ');
  }

  result = result.replace(/\s+/g, ' ').trim();
  return { sanitized: result, blocked: hadBlocked };
};

export const formatRamLabel = (ramMb: number): string => {
  const gb = ramMb / 1024;
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
};
