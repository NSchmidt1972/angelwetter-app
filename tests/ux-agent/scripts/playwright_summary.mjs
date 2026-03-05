#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const defaultPath = path.join('tests', 'ux-agent', 'artifacts', 'playwright', 'report.json');
const reportPath = process.argv[2] || defaultPath;

function msToSeconds(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function shortError(errorValue) {
  if (!errorValue) return '';
  if (typeof errorValue === 'string') return errorValue.split('\n')[0].trim();
  if (typeof errorValue === 'object' && errorValue.message) {
    return String(errorValue.message).split('\n')[0].trim();
  }
  return '';
}

function emptyCounts() {
  return {
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,
    interrupted: 0,
    flaky: 0,
    unknown: 0,
  };
}

function normalizeStatus(test, results) {
  const outcome = test.status || '';
  const lastResultStatus = results.at(-1)?.status || '';

  if (outcome === 'skipped' || test.expectedStatus === 'skipped') return 'skipped';
  if (outcome === 'expected') return 'passed';
  if (outcome === 'flaky') return 'flaky';
  if (outcome === 'interrupted') return 'interrupted';

  if (outcome === 'unexpected') {
    if (lastResultStatus === 'timedOut') return 'timedOut';
    if (lastResultStatus === 'interrupted') return 'interrupted';
    return 'failed';
  }

  if (outcome === 'passed') return 'passed';
  if (outcome === 'failed') return 'failed';
  if (outcome === 'timedOut') return 'timedOut';
  return 'unknown';
}

if (!fs.existsSync(reportPath)) {
  console.error(`No Playwright JSON report found at: ${reportPath}`);
  console.error('Run `npm run test:ux:func` first.');
  process.exit(1);
}

const raw = fs.readFileSync(reportPath, 'utf8');
const report = JSON.parse(raw);

const flatTests = [];

function walkSuites(suites = [], titlePath = []) {
  for (const suite of suites) {
    const nextPath = suite.title ? [...titlePath, suite.title] : [...titlePath];

    for (const spec of suite.specs || []) {
      const fullTitle = [...nextPath, spec.title].filter(Boolean).join(' > ');
      for (const test of spec.tests || []) {
        const results = test.results || [];
        const durationMs = results.reduce((sum, result) => sum + (result.duration || 0), 0);
        const status = normalizeStatus(test, results);
        const projectName = test.projectName || test.projectId || 'unknown-project';
        const failedAttempt = [...results]
          .reverse()
          .find((result) => result?.status === 'failed' || result?.status === 'timedOut' || result?.error);

        flatTests.push({
          title: fullTitle,
          file: spec.file || 'n/a',
          line: spec.line ?? null,
          projectName,
          status,
          durationMs,
          retries: Math.max(0, results.length - 1),
          error: shortError(failedAttempt?.error),
        });
      }
    }

    walkSuites(suite.suites || [], nextPath);
  }
}

walkSuites(report.suites || []);

const counts = emptyCounts();

const byProject = new Map();
let summedDuration = 0;

for (const t of flatTests) {
  const key = Object.hasOwn(counts, t.status) ? t.status : 'unknown';
  counts[key] += 1;
  summedDuration += t.durationMs;

  if (!byProject.has(t.projectName)) {
    byProject.set(t.projectName, { ...emptyCounts(), total: 0 });
  }
  const bucket = byProject.get(t.projectName);
  bucket.total += 1;
  bucket[key] += 1;
}

const failedTests = flatTests.filter((t) =>
  ['failed', 'timedOut', 'interrupted', 'unknown'].includes(t.status),
);
const slowestTests = [...flatTests]
  .sort((a, b) => b.durationMs - a.durationMs)
  .slice(0, 5);

const durationFromReport = report.stats?.duration || 0;
const totalDurationMs = durationFromReport > 0 ? durationFromReport : summedDuration;

console.log('');
console.log('Playwright Standard Report');
console.log(`Report file: ${reportPath}`);
console.log(
  `Total ${flatTests.length} | Passed ${counts.passed} | Failed ${counts.failed} | TimedOut ${counts.timedOut} | Skipped ${counts.skipped} | Flaky ${counts.flaky}`,
);
console.log(`Duration: ${msToSeconds(totalDurationMs)}`);

if (byProject.size > 0) {
  console.log('');
  console.log('Per project:');
  for (const [name, data] of byProject.entries()) {
    console.log(
      `- ${name}: total ${data.total}, passed ${data.passed}, failed ${data.failed}, timedOut ${data.timedOut}, skipped ${data.skipped}, flaky ${data.flaky}`,
    );
  }
}

if (failedTests.length > 0) {
  console.log('');
  console.log('Failures:');
  for (const [idx, test] of failedTests.entries()) {
    const lineSuffix = test.line != null ? `:${test.line}` : '';
    const retrySuffix = test.retries > 0 ? `, retries ${test.retries}` : '';
    console.log(
      `${idx + 1}. [${test.projectName}] ${test.title} (${test.status}, ${msToSeconds(test.durationMs)}${retrySuffix})`,
    );
    console.log(`   at ${test.file}${lineSuffix}`);
    if (test.error) {
      console.log(`   error: ${test.error}`);
    }
  }
}

if (slowestTests.length > 0) {
  console.log('');
  console.log('Top 5 slowest tests:');
  for (const [idx, test] of slowestTests.entries()) {
    console.log(`${idx + 1}. [${test.projectName}] ${test.title} - ${msToSeconds(test.durationMs)}`);
  }
}

console.log('');
