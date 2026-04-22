import { clearCache as clearPretextCache, layout, prepare } from '@chenglou/pretext';

const DEFAULT_CACHE_LIMIT = 1400;
const preparedCache = new Map();

function trimPreparedCache(limit = DEFAULT_CACHE_LIMIT) {
  while (preparedCache.size > limit) {
    const oldestKey = preparedCache.keys().next().value;
    if (!oldestKey) break;
    preparedCache.delete(oldestKey);
  }
}

function getPreparedText(text, font, whiteSpace = 'normal') {
  const safeText = String(text || '');
  const cacheKey = `${font}::${whiteSpace}::${safeText}`;
  const cachedPrepared = preparedCache.get(cacheKey);

  if (cachedPrepared) {
    preparedCache.delete(cacheKey);
    preparedCache.set(cacheKey, cachedPrepared);
    return cachedPrepared;
  }

  const prepared = prepare(safeText, font, { whiteSpace });
  preparedCache.set(cacheKey, prepared);
  trimPreparedCache();
  return prepared;
}

export function bucketWidth(width, step = 8) {
  const safeWidth = Math.max(40, Number(width || 0));
  return Math.max(40, Math.round(safeWidth / step) * step);
}

export function measureTextBlock(text, options = {}) {
  const {
    font = '500 16px Geist',
    maxWidth = 180,
    lineHeight = 22,
    maxLines,
    whiteSpace = 'normal',
  } = options;

  const safeText = String(text || '');
  if (!safeText.trim()) {
    return { height: lineHeight, lineCount: 1, truncated: false };
  }

  const targetWidth = bucketWidth(maxWidth, 6);

  try {
    const prepared = getPreparedText(safeText, font, whiteSpace);
    const measured = layout(prepared, targetWidth, lineHeight);
    const measuredLineCount = Math.max(1, Number(measured?.lineCount || 1));
    const visibleLineCount = Number.isFinite(maxLines)
      ? Math.max(1, Math.min(measuredLineCount, maxLines))
      : measuredLineCount;

    return {
      height: Math.max(lineHeight, visibleLineCount * lineHeight),
      lineCount: measuredLineCount,
      truncated: Number.isFinite(maxLines) ? measuredLineCount > maxLines : false,
    };
  } catch {
    const estimatedCharsPerLine = Math.max(8, Math.floor(targetWidth / 7.6));
    const measuredLineCount = Math.max(1, Math.ceil(safeText.length / estimatedCharsPerLine));
    const visibleLineCount = Number.isFinite(maxLines)
      ? Math.max(1, Math.min(measuredLineCount, maxLines))
      : measuredLineCount;

    return {
      height: Math.max(lineHeight, visibleLineCount * lineHeight),
      lineCount: measuredLineCount,
      truncated: Number.isFinite(maxLines) ? measuredLineCount > maxLines : false,
    };
  }
}

export function clearTextMetricsCache() {
  preparedCache.clear();
  clearPretextCache();
}
