const after = require('./lint-full-after.json');
const norm = (p) => String(p).split('\\').join('/');
for (const f of after) {
  const n = norm(f.filePath);
  if (n.includes('cumulativeLoadBreakdown')) console.log('NEW-EXTERNAL ' + n.split('src/').pop() + ' E=' + f.errorCount + ' W=' + f.warningCount);
}
const scope = ['PartsTable.tsx', 'ReportCard.tsx', 'fleet-operations/utils/helpers.ts', 'tripHeaderApiService.ts', 'memory.manager.ts', 'performance.monitor.ts', 'src/utils/validation.ts'];
for (const f of after) {
  const n = norm(f.filePath);
  if (scope.some((s) => n.endsWith(s))) {
    console.log('SCOPE ' + n.split('src/').pop() + ' E=' + f.errorCount + ' W=' + f.warningCount);
  }
}
