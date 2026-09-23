import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DesignSpecSchema } from '../design-spec/schema.js';
import { designSpecFromFigmaFile } from '../design-spec/figma.js';
import { checkDesignSpec } from '../design-spec/check.js';
import { captureDesignSpec, newDesignSpec } from '../design-spec/capture.js';
import type { ScanResult } from '../scan.js';

async function jsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeSpec(path: string, spec: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(spec, null, 2)}\n`, { flag: 'wx' });
}

export function registerDesignSpecCommands(program: Command): void {
  program
    .command('spec:new')
    .description('Start a reviewable IBR design specification without Figma')
    .requiredOption('--title <text>', 'Page title and initial heading')
    .requiredOption('--view <id>', 'View ID')
    .requiredOption('--route <path>', 'Application route')
    .requiredOption('--width <px>', 'Viewport width in CSS pixels')
    .requiredOption('--height <px>', 'Viewport height in CSS pixels')
    .requiredOption('--out <file>', 'New design-spec JSON file')
    .action(async (options: { title: string; view: string; route: string; width: string; height: string; out: string }) => {
      try {
        const spec = newDesignSpec({ title: options.title, viewId: options.view, route: options.route,
          width: Number(options.width), height: Number(options.height) });
        await writeSpec(options.out, spec);
        console.log(`Wrote ${options.out}. Add page content and review rules before setting source.reviewed to true.`);
      } catch (error) {
        console.error('Design-spec authoring error:', error instanceof Error ? error.message : error);
        process.exitCode = 2;
      }
    });

  program
    .command('spec:capture')
    .description('Capture a local UI prototype as a reviewable IBR design-spec draft')
    .option('--url <url>', 'Live page URL')
    .option('--scan <file>', 'Saved ibr scan JSON with --content --full-text')
    .requiredOption('--title <text>', 'Design title')
    .requiredOption('--view <id>', 'View ID')
    .requiredOption('--route <path>', 'Application route to verify later')
    .option('--width <px>', 'Live capture viewport width in CSS pixels')
    .option('--height <px>', 'Live capture viewport height in CSS pixels')
    .option('--geometry <mode>', 'Draft geometry: free (default), exact, or bounded', 'free')
    .option('--tolerance <px>', 'Required for exact geometry')
    .option('--range <px>', 'Required for bounded geometry')
    .option('--copy <mode>', 'Draft copy: exact (default) or free', 'exact')
    .requiredOption('--out <file>', 'New design-spec JSON file')
    .action(async (options: { url?: string; scan?: string; title: string; view: string; route: string;
      width?: string; height?: string; geometry: string; tolerance?: string; range?: string; copy: string; out: string }) => {
      try {
        if (Boolean(options.url) === Boolean(options.scan)) throw new Error('Pass exactly one of --url or --scan');
        if (!['free', 'exact', 'bounded'].includes(options.geometry)) throw new Error('--geometry must be free, exact, or bounded');
        if (!['exact', 'free'].includes(options.copy)) throw new Error('--copy must be exact or free');
        let scanResult: ScanResult;
        if (options.scan) scanResult = await jsonFile(options.scan) as ScanResult;
        else {
          if (options.width === undefined || options.height === undefined) throw new Error('--url requires --width and --height');
          const { scan } = await import('../scan.js');
          scanResult = await scan(options.url!, {
            viewport: { name: 'design-capture', width: Number(options.width), height: Number(options.height) },
            content: true, fullText: true, rules: ['none'],
          });
        }
        const spec = captureDesignSpec(scanResult, { title: options.title, viewId: options.view, route: options.route,
          geometry: options.geometry as 'free' | 'exact' | 'bounded',
          ...(options.tolerance !== undefined ? { tolerance: Number(options.tolerance) } : {}),
          ...(options.range !== undefined ? { range: Number(options.range) } : {}),
          copy: options.copy as 'exact' | 'free' });
        await writeSpec(options.out, spec);
        console.log(`Wrote ${options.out}. Review measured rules and illustrative copy before setting source.reviewed to true.`);
      } catch (error) {
        console.error('Design-spec capture error:', error instanceof Error ? error.message : error);
        process.exitCode = 2;
      }
    });

  program
    .command('spec:from-figma <file>')
    .description('Turn a saved Figma file API JSON response into an unbound, measurable design-spec draft')
    .requiredOption('--frame <id>', 'Figma frame node ID')
    .requiredOption('--route <path>', 'Application route represented by the frame')
    .option('--routes <file>', 'JSON map from Figma prototype destination IDs to application routes')
    .requiredOption('--out <file>', 'Output design-spec JSON file')
    .action(async (file: string, options: { frame: string; route: string; routes?: string; out: string }) => {
      try {
        const rawRoutes = options.routes ? await jsonFile(options.routes) : {};
        if (!rawRoutes || typeof rawRoutes !== 'object' || Array.isArray(rawRoutes) ||
            Object.values(rawRoutes).some(value => typeof value !== 'string' || !value.startsWith('/'))) {
          throw new Error('--routes must be a JSON object mapping Figma node IDs to application paths beginning with /');
        }
        const spec = designSpecFromFigmaFile(await jsonFile(file), options.frame, options.route, file, rawRoutes as Record<string, string>);
        await writeSpec(options.out, spec);
        console.log(`Wrote ${options.out}. Bind each imported node to a semantic match before checking it.`);
      } catch (error) {
        console.error('Design-spec import error:', error instanceof Error ? error.message : error);
        process.exitCode = 2;
      }
    });

  program
    .command('spec:check <file> <view>')
    .description('Compare exact and bounded design rules with a live page or saved full-content scan')
    .option('--url <url>', 'Live page URL')
    .option('--scan <file>', 'Saved ibr scan JSON')
    .option('--json', 'Print structured findings')
    .action(async (file: string, viewId: string, options: { url?: string; scan?: string; json?: boolean }) => {
      try {
        if (Boolean(options.url) === Boolean(options.scan)) throw new Error('Pass exactly one of --url or --scan');
        const spec = DesignSpecSchema.parse(await jsonFile(file));
        const view = spec.views.find(v => v.id === viewId);
        if (!view) throw new Error(`Unknown design view: ${viewId}`);
        let scanResult: ScanResult;
        if (options.scan) {
          scanResult = await jsonFile(options.scan) as ScanResult;
        } else {
          const { scan } = await import('../scan.js');
          scanResult = await scan(options.url!, {
            viewport: { name: 'design-spec', ...view.viewport },
            content: true,
            fullText: true,
            rules: ['none'],
          });
        }
        const report = checkDesignSpec(spec, viewId, scanResult);
        if (options.json) console.log(JSON.stringify(report, null, 2));
        else {
          console.log(`${report.verdict}: ${report.counts.pass} passed, ${report.counts.fail} failed, ${report.counts.unmeasurable} unmeasurable, ${report.counts.free} free`);
          for (const finding of report.findings.filter(f => f.status === 'fail' || f.status === 'unmeasurable')) {
            console.log(`  ${finding.status}: ${finding.element ?? viewId}.${finding.property}${finding.reason ? ` — ${finding.reason}` : ''}`);
          }
        }
        if (report.verdict === 'FAIL') process.exitCode = 1;
        if (report.verdict === 'PARTIAL') process.exitCode = 2;
      } catch (error) {
        console.error('Design-spec check error:', error instanceof Error ? error.message : error);
        process.exitCode = 2;
      }
    });
}
