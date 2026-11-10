// Terminal report rendering for qnx-health-checker.
import path from 'node:path';

const SEV_LABEL = { error: 'ERROR', warning: 'WARN', info: 'INFO' };

export function renderTerminal(report) {
  const lines = [];
  const name = path.basename(report.project.replace(/\/$/, '')) || report.project;
  lines.push(`QNX Health Checker — ${name}`);
  lines.push(`Directory: ${report.project}`);
  lines.push(`Files scanned: ${report.filesScanned}`);
  lines.push('');
  const bar = scoreBar(report.score);
  lines.push(`Score: ${report.score}/100 ${bar}  Verdict: ${report.verdict}`);
  lines.push('');
  lines.push('Categories:');
  const order = ['build-system', 'buildfile', 'source', 'hygiene'];
  for (const cat of order) {
    const c = report.categories[cat];
    if (!c) continue;
    lines.push(`  ${cat.padEnd(13)} ${String(c.score).padStart(2)}/${c.weight}`);
  }
  lines.push('');
  const { errors, warnings, infos } = report.counts;
  lines.push(`Findings: ${report.counts.total} (${errors} errors, ${warnings} warnings, ${infos} info)`);
  if (report.markers.length > 0) {
    lines.push(`QNX markers: ${report.markers.join(', ')}`);
  }
  lines.push('');
  const sorted = [...report.findings].sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id);
  });
  for (const f of sorted) {
    const where = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '(project)';
    lines.push(`  [${SEV_LABEL[f.severity]}] ${f.id} ${where}`);
    lines.push(`    ${f.message}`);
    if (f.hint) {
      for (const hintLine of f.hint.split('\n')) {
        lines.push(`    Hint: ${hintLine}`);
      }
    }
  }
  if (sorted.length === 0) lines.push('  No findings — clean bill of health.');
  return lines.join('\n');
}

function scoreBar(score) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}
