import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uxAgentDir = path.resolve(__dirname, '..');
const REPORT_INDEX_PATH = path.join(uxAgentDir, 'artifacts', 'playwright', 'html', 'index.html');
const JSON_REPORT_PATH = path.join(uxAgentDir, 'artifacts', 'playwright', 'report.json');
const BLOCK_START = '<!-- UX_SUMMARY_START -->';
const BLOCK_END = '<!-- UX_SUMMARY_END -->';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function firstErrorLine(errorValue) {
  if (!errorValue) return '';
  if (typeof errorValue === 'string') return errorValue.split('\n')[0].trim();
  if (typeof errorValue === 'object' && errorValue.message) {
    return String(errorValue.message).split('\n')[0].trim();
  }
  return '';
}

function descriptionFor(title) {
  const lowered = title.toLowerCase();

  if (lowered.includes('auth flow smoke')) {
    return 'Prueft den Login/Registrierung-Flow auf grundlegende UI-Stabilitaet ohne Runtime-Crash.';
  }
  if (lowered.includes('ux baseline')) {
    return 'Prueft die UX-Baseline auf /reset-done (kein horizontaler Overflow, primaere Aktion touch-freundlich).';
  }
  if (lowered.includes('view smoke')) {
    return 'Prueft zentrale Views (Reset, Passwort-Reset, Auth-Verified, Auth-Seite) auf Renderbarkeit und Runtime-Stabilitaet.';
  }
  if (lowered.includes('form flow: fangformular')) {
    return 'Prueft das Fangformular end-to-end mit Testfisch Aal (200 cm), inkl. Dialogfluss und Insert-Request.';
  }
  if (lowered.includes('password-recovery')) {
    return 'Prueft, dass auf der Route fuer Passwort-Reset die Kern-Controls sichtbar sind.';
  }
  if (lowered.includes('a11y audit')) {
    return 'Prueft mit axe auf /reset-done, dass keine serious/critical Accessibility-Verstoesse vorliegen.';
  }

  return 'Allgemeiner UI/UX-Check fuer den jeweiligen Testfall.';
}

function emptyCounts() {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,
    flaky: 0,
    interrupted: 0,
    unknown: 0,
  };
}

function overallAssessmentProse(counts, tests) {
  const hasFailures = counts.failed > 0 || counts.timedOut > 0 || counts.interrupted > 0 || counts.unknown > 0;
  const hasFlaky = counts.flaky > 0;
  const hasSkips = counts.skipped > 0;

  const total = counts.total;
  const executed = counts.passed + counts.failed + counts.timedOut + counts.flaky + counts.interrupted + counts.unknown;

  let verdict;
  if (hasFailures) {
    verdict =
      'Die Testlage ist aktuell nicht release-reif: Mindestens ein Test ist fehlgeschlagen oder in ein Timeout gelaufen.';
  } else if (hasFlaky) {
    verdict =
      'Die Testlage ist funktional stabil, zeigt aber Flaky-Verhalten und sollte vor einem Release weiter gehaertet werden.';
  } else if (counts.passed > 0) {
    verdict = 'Die Testlage ist aktuell stabil und ohne erkennbare funktionale oder kritische UX-/A11y-Regressionssignale.';
  } else {
    verdict = 'Es liegen keine verwertbaren ausgefuehrten Tests vor, daher ist keine belastbare Qualitaetsaussage moeglich.';
  }

  const coveragePart =
    total > 0
      ? `Von ${total} Testfaellen wurden ${executed} ausgefuehrt und ${counts.passed} erfolgreich abgeschlossen.`
      : 'Es wurden keine Testfaelle im Report gefunden.';

  const skipPart = hasSkips
    ? ` ${counts.skipped} Testfall/Tests sind uebersprungen worden; diese gelten als offene Abhaengigkeit und sollten bei Bedarf explizit nachgezogen werden.`
    : '';

  const failPart = hasFailures
    ? ` Es gibt ${counts.failed} fehlgeschlagene und ${counts.timedOut} timeout-bezogene Ergebnisse, die vor einer Freigabe behoben werden sollten.`
    : '';

  const flakyPart = hasFlaky
    ? ` Zusaetzlich wurden ${counts.flaky} flakey Ergebnisse festgestellt, was auf nicht-deterministisches Verhalten hindeutet.`
    : '';

  const a11yHint = tests.some((test) => test.title.toLowerCase().includes('a11y'))
    ? ' Ein A11y-Check ist Bestandteil dieses Laufs und in die Gesamtbeurteilung eingeflossen.'
    : '';

  return `${verdict} ${coveragePart}${skipPart}${failPart}${flakyPart}${a11yHint}`.trim();
}

function collectTestsFromJson(report) {
  const collected = [];

  function walkSuites(suites = [], titlePath = []) {
    for (const suite of suites) {
      const nextPath = suite.title ? [...titlePath, suite.title] : [...titlePath];

      for (const spec of suite.specs || []) {
        const fullTitle = [...nextPath, spec.title].filter(Boolean).join(' > ');
        for (const test of spec.tests || []) {
          const results = test.results || [];
          const status = normalizeStatus(test, results);
          const durationMs = results.reduce((sum, result) => sum + (result.duration || 0), 0);
          const failedAttempt = [...results]
            .reverse()
            .find((result) => result?.status === 'failed' || result?.status === 'timedOut' || result?.error);
          const skipNote = (test.annotations || [])
            .filter((item) => item?.type === 'skip' && item?.description)
            .map((item) => String(item.description).trim())
            .find(Boolean);

          collected.push({
            title: fullTitle,
            projectName: test.projectName || test.projectId || 'unknown-project',
            status,
            durationMs,
            description: descriptionFor(fullTitle),
            note: skipNote || firstErrorLine(failedAttempt?.error),
          });
        }
      }

      walkSuites(suite.suites || [], nextPath);
    }
  }

  walkSuites(report.suites || []);
  return collected;
}

function renderSummaryBlock(report, tests) {
  const counts = emptyCounts();
  const perProject = new Map();

  for (const test of tests) {
    counts.total += 1;
    const key = Object.hasOwn(counts, test.status) ? test.status : 'unknown';
    counts[key] += 1;

    if (!perProject.has(test.projectName)) {
      perProject.set(test.projectName, emptyCounts());
    }
    const bucket = perProject.get(test.projectName);
    bucket.total += 1;
    bucket[key] += 1;
  }

  const prose = overallAssessmentProse(counts, tests);

  const generatedAt = new Date().toISOString();
  const durationMs = Number(report?.stats?.duration || 0);
  const durationLabel = durationMs > 0 ? `${(durationMs / 1000).toFixed(2)}s` : 'n/a';

  const projectRows = [...perProject.entries()]
    .map(
      ([name, data]) =>
        `<tr>
          <td>${escapeHtml(name)}</td>
          <td>${data.total}</td>
          <td>${data.passed}</td>
          <td>${data.failed}</td>
          <td>${data.timedOut}</td>
          <td>${data.skipped}</td>
          <td>${data.flaky}</td>
        </tr>`,
    )
    .join('\n');

  const testRows = tests
    .map((test) => {
      const note = test.note ? `<div style="margin-top:4px;color:#6b7280;">Hinweis: ${escapeHtml(test.note)}</div>` : '';
      return `<tr>
        <td>${escapeHtml(test.projectName)}</td>
        <td><strong>${escapeHtml(test.title)}</strong><div style="margin-top:4px;color:#374151;">${escapeHtml(test.description)}</div>${note}</td>
        <td><code>${escapeHtml(test.status)}</code></td>
        <td>${(test.durationMs / 1000).toFixed(2)}s</td>
      </tr>`;
    })
    .join('\n');

  const html = `
${BLOCK_START}
<section id="ux-standard-report" style="max-width:1200px;margin:20px auto;padding:16px;border:1px solid #d1d5db;border-radius:12px;background:#ffffff;color:#111827;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <h2 style="margin:0 0 10px 0;">Standardisierte Auswertung</h2>
  <p style="margin:0 0 10px 0;">Generiert: <code>${escapeHtml(generatedAt)}</code> | Dauer: <code>${escapeHtml(durationLabel)}</code></p>
  <p style="margin:0 0 16px 0;">
    Gesamt: <strong>${counts.total}</strong>,
    Passed: <strong>${counts.passed}</strong>,
    Failed: <strong>${counts.failed}</strong>,
    TimedOut: <strong>${counts.timedOut}</strong>,
    Skipped: <strong>${counts.skipped}</strong>,
    Flaky: <strong>${counts.flaky}</strong>
  </p>

  <h3 style="margin:0 0 8px 0;">Gesamtbeurteilung (Prosa)</h3>
  <p style="margin:0 0 16px 0;line-height:1.5;">${escapeHtml(prose)}</p>

  <h3 style="margin:0 0 8px 0;">Status-Legende</h3>
  <ul style="margin:0 0 16px 18px;padding:0;">
    <li><code>passed</code>: Testziel erreicht, kein erkennbarer Regressionshinweis.</li>
    <li><code>failed</code>: Erwartung verletzt oder Laufzeitfehler im Test.</li>
    <li><code>timedOut</code>: Test hat Zeitlimit ueberschritten.</li>
    <li><code>skipped</code>: Test wurde bewusst uebersprungen (z. B. Preconditions nicht erfuellt).</li>
    <li><code>flaky</code>: Erst fehlgeschlagen, dann mit Retry erfolgreich.</li>
  </ul>

  <h3 style="margin:0 0 8px 0;">Pro Projekt</h3>
  <div style="overflow:auto;margin-bottom:16px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left">Projekt</th>
          <th align="left">Total</th>
          <th align="left">Passed</th>
          <th align="left">Failed</th>
          <th align="left">TimedOut</th>
          <th align="left">Skipped</th>
          <th align="left">Flaky</th>
        </tr>
      </thead>
      <tbody>${projectRows}</tbody>
    </table>
  </div>

  <h3 style="margin:0 0 8px 0;">Test-Ergebnisse mit Beschreibung</h3>
  <div style="overflow:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left">Projekt</th>
          <th align="left">Testfall</th>
          <th align="left">Status</th>
          <th align="left">Dauer</th>
        </tr>
      </thead>
      <tbody>${testRows}</tbody>
    </table>
  </div>
</section>
${BLOCK_END}
`;

  return html;
}

async function injectIntoHtmlReport() {
  const [indexHtml, jsonRaw] = await Promise.all([
    fs.readFile(REPORT_INDEX_PATH, 'utf8'),
    fs.readFile(JSON_REPORT_PATH, 'utf8'),
  ]);

  const report = JSON.parse(jsonRaw);
  const tests = collectTestsFromJson(report);
  const summaryBlock = renderSummaryBlock(report, tests);

  let nextHtml;
  if (indexHtml.includes(BLOCK_START) && indexHtml.includes(BLOCK_END)) {
    const pattern = new RegExp(`${BLOCK_START}[\\s\\S]*${BLOCK_END}`, 'm');
    nextHtml = indexHtml.replace(pattern, summaryBlock);
  } else if (indexHtml.includes('</body>')) {
    nextHtml = indexHtml.replace('</body>', `${summaryBlock}\n</body>`);
  } else {
    nextHtml = `${indexHtml}\n${summaryBlock}\n`;
  }

  await fs.writeFile(REPORT_INDEX_PATH, nextHtml, 'utf8');
}

export default class PlaywrightReportEnricher {
  async onEnd() {
    try {
      await injectIntoHtmlReport();
      console.log('[playwright-report-enricher] Standardisierte Auswertung in HTML-Report eingebettet.');
    } catch (error) {
      console.warn('[playwright-report-enricher] Konnte HTML-Report nicht erweitern:', error?.message || error);
    }
  }
}
