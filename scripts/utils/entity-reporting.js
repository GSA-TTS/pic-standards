// Compact entity breakdown: only print top-level entity counts
function printEntityBreakdown(data, logFn) {
  if (!data || typeof data !== 'object') return;
  const arrayKeys = Object.keys(data).filter(k => Array.isArray(data[k]));
  arrayKeys.forEach(type => {
    const count = data[type].length;
    logFn(`  ${type}: ${count} records`);
  });
}

module.exports = { printEntityBreakdown };
