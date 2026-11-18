import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// R3.6, R6.7: nothing in the repo sends mail or files with CBP. The app drafts and exports; the user files.
const ROOT = resolve(import.meta.dirname, '..');
const SELF = relative(ROOT, import.meta.filename);
const SKIP = new Set(['node_modules', '.next', '.git', 'test-results', 'playwright-report', '.cache', 'dist']);
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function files(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name) || e.name.startsWith('.e2e-data')) return [];
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p, keep);
    return keep(e.name) ? [p] : [];
  });
}

const MAIL: [string, RegExp][] = [
  ['SMTP', /\bsmtps?\b/i],
  ['nodemailer', /\bnodemailer\b/i],
  ['sendmail', /\bsendmail\b/i],
  ['mail transport', /\bcreateTransport\s*\(/],
  ['mailto link', /\bmailto:/i],
  ['SendGrid', /sendgrid/i],
  ['Mailgun', /mailgun/i],
  ['Postmark', /postmark/i],
  ['Resend', /api\.resend\.com|from\s+['"]resend['"]/],
  ['Amazon SES', /client-sesv?2?\b|\bSend(Raw)?EmailCommand\b/],
  ['other mail API', /mandrillapp|sparkpost|mailjet/i],
];

const FILING: [string, RegExp][] = [
  ['ACE portal', /aceportal|\bace\.cbp\b/i],
  ['ABI (Automated Broker Interface)', /\bABI\b|automated broker interface/i],
];

/** CBP hosts the code may name: only CROSS, which is read, never posted to. */
const CBP_READ = new Set(['rulings.cbp.gov']);

/** The mail and filing paths a source names. */
function sendPaths(code: string): string[] {
  const hits = [...MAIL, ...FILING].filter(([, re]) => re.test(code)).map(([name]) => name);
  for (const m of code.matchAll(/(?:[\w-]+\.)*cbp\.(?:dhs\.)?gov\b/gi)) if (!CBP_READ.has(m[0].toLowerCase())) hits.push(`CBP host ${m[0]}`);
  return hits;
}

describe('no code path sends mail or files with CBP', () => {
  it('flags mail libraries, SMTP, mail APIs and CBP filing endpoints, not CROSS lookups', () => {
    expect(sendPaths("import nodemailer from 'nodemailer'; nodemailer.createTransport({ host: 'smtp.example.com', port: 587 })")).toEqual(['SMTP', 'nodemailer', 'mail transport']);
    expect(sendPaths("await transporter.sendMail({ to })")).toEqual(['sendmail']);
    expect(sendPaths('<a href={`mailto:${to}?body=${draft}`}>')).toEqual(['mailto link']);
    expect(sendPaths("import sg from '@sendgrid/mail'")).toEqual(['SendGrid']);
    expect(sendPaths("fetch('https://api.resend.com/emails', { method: 'POST' })")).toEqual(['Resend']);
    expect(sendPaths("import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'")).toEqual(['Amazon SES']);
    expect(sendPaths("fetch('https://ace.cbp.dhs.gov/abi/entry', { method: 'POST' })")).toEqual(['ACE portal', 'ABI (Automated Broker Interface)', 'CBP host ace.cbp.dhs.gov']);
    expect(sendPaths("const filing = 'https://www.cbp.gov/trade/protest'")).toEqual(['CBP host www.cbp.gov']);
    expect(sendPaths("const url = `https://rulings.cbp.gov/ruling/${n}`; // read a CROSS ruling")).toEqual([]);
    expect(sendPaths("const mail = parseEml(bytes); // inbound only, never a reply")).toEqual([]);
  });

  it('no source file names one', () => {
    const code = files(ROOT, (n) => CODE.test(n)).filter((f) => relative(ROOT, f) !== SELF);
    expect(code.length).toBeGreaterThan(100);
    const hits = code.flatMap((f) => sendPaths(readFileSync(f, 'utf8')).map((h) => `${relative(ROOT, f)}: ${h}`));
    expect(hits).toEqual([]);
  });

  it('no package depends on a mail library', () => {
    const manifests = files(ROOT, (n) => n === 'package.json');
    expect(manifests.length).toBeGreaterThanOrEqual(5);
    const hits = manifests.flatMap((f) => {
      const pkg = JSON.parse(readFileSync(f, 'utf8')) as Record<string, Record<string, string> | undefined>;
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies });
      return deps.flatMap((d) => sendPaths(`import x from '${d}'`).map((h) => `${relative(ROOT, f)}: ${d} (${h})`));
    });
    expect(hits).toEqual([]);
  });
});
