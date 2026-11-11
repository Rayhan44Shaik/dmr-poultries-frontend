const perFile = require('./per-file.json');
const show = (rule) => {
  console.log('=== ' + rule + ' ===');
  for (const f of perFile) {
    const ms = f.messages.filter((m) => m.rule === rule);
    if (ms.length) console.log((f.dirty ? 'DIRTY' : 'clean') + (f.test ? ':TEST' : '') + ' ' + f.file + ' x' + ms.length + ' @' + ms.map((m) => m.line + ':' + m.col).join(','));
  }
};
const rules = process.argv.slice(2);
if (!rules.length) rules.push('no-useless-assignment', 'no-useless-escape', 'react-hooks/immutability');
for (const r of rules) show(r);
console.log('=== deleted_files_backup ===');
for (const f of perFile) {
  if (f.file.includes('deleted_files_backup')) {
    const by = {};
    for (const m of f.messages) by[m.rule] = (by[m.rule] || 0) + 1;
    console.log(f.file + ' E=' + f.E + ' W=' + f.W + ' ' + JSON.stringify(by));
  }
}
