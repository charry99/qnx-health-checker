// Analysis orchestration + scoring for qnx-health-checker.
import { collectFiles, isSourceFile, isBuildfile, isMakefile } from './scan.mjs';
import { CHECKS, scanMarkers } from './rules.mjs';

export const CATEGORY_WEIGHTS = {
  'build-system': 30,
  buildfile: 25,
  source: 30,
  hygiene: 15,
};

const DEDUCTION = { error: 10, warning: 5, info: 0 };

export async function analyzeProject(rootDir) {
  const { files, dirs } = await collectFiles(rootDir);
  const sourceFiles = files.filter((f) => isSourceFile(f.rel));
  const buildfiles = files.filter((f) => isBuildfile(f.rel));
  const commonMk = files.find((f) =>
    f.rel === 'common.mk' || f.rel.endsWith('/common.mk'));
  const cmakeLists = files.find((f) =>
    f.rel.toLowerCase().endsWith('cmakelists.txt'));
  const cmakeFiles = files.filter((f) =>
    /\.cmake$/i.test(f.rel) || f.rel.toLowerCase().endsWith('cmakelists.txt'));
  const markers = scanMarkers(sourceFiles);

  const ctx = {
    root: rootDir, files, dirs, sourceFiles, buildfiles, commonMk,
    cmakeLists, cmakeFiles, markers,
    hasCmake: Boolean(cmakeLists),
  };

  const findings = [];
  for (const check of CHECKS) findings.push(...check(ctx));

  // --- scoring -------------------------------------------------------------
  const applicable = new Set(['build-system', 'hygiene']);
  if (buildfiles.length > 0) applicable.add('buildfile');
  if (sourceFiles.length > 0) applicable.add('source');

  const categories = {};
  for (const cat of applicable) {
    const weight = CATEGORY_WEIGHTS[cat];
    let lost = 0;
    for (const f of findings) {
      if (f.category === cat) lost += DEDUCTION[f.severity] ?? 0;
    }
    categories[cat] = {
      weight,
      score: Math.max(0, weight - lost),
    };
  }
  const totalWeight = Object.values(categories)
    .reduce((s, c) => s + c.weight, 0);
  const totalScore = Object.values(categories)
    .reduce((s, c) => s + c.score, 0);
  const rawScore = totalWeight === 0
    ? 0 : Math.round((100 * totalScore) / totalWeight);

  // --- verdict -------------------------------------------------------------
  const cmakeQnx = findings.some((f) => f.id === 'CMK-002');
  const hasEvidence = markers.size > 0 || Boolean(commonMk) ||
    buildfiles.length > 0 || cmakeQnx;
  // No QNX evidence at all (no markers, no common.mk, no buildfile, no QNX
  // CMake setup) caps the score: a project that shows nothing QNX cannot
  // be more than 19% "ready", whatever the category maths say.
  const score = hasEvidence ? rawScore : Math.min(rawScore, 19);
  let verdict;
  if (!hasEvidence) verdict = 'Not a QNX project';
  else if (score >= 80) verdict = 'Ready';
  else if (score >= 50) verdict = 'Needs work';
  else verdict = 'Not a QNX project';

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const infos = findings.filter((f) => f.severity === 'info').length;

  return {
    project: rootDir,
    filesScanned: files.length,
    score,
    verdict,
    categories,
    counts: { errors, warnings, infos, total: findings.length },
    markers: [...markers.keys()].sort(),
    findings,
  };
}

/** Exit code convention: 0 Ready, 1 Needs work, 2 Not a QNX project. */
export function exitCodeFor(verdict) {
  if (verdict === 'Ready') return 0;
  if (verdict === 'Needs work') return 1;
  return 2;
}
