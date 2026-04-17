import type { SensorContext, SensorReport } from './types.js';
import { collectVisualPatterns } from './visual-patterns.js';
import { collectComponentCensus } from './component-census.js';
import { collectInteractionMap } from './interaction-map.js';
import { collectContrastReport } from './contrast-report.js';
import { collectNavigationMap } from './navigation.js';

export function runSensors(ctx: SensorContext): SensorReport {
  const visualPatterns = collectVisualPatterns(ctx);
  const componentCensus = collectComponentCensus(ctx);
  const interactionMap = collectInteractionMap(ctx);
  const contrast = collectContrastReport(ctx);
  const navigation = collectNavigationMap(ctx);

  const oneLiners: string[] = [];

  for (const vp of visualPatterns) {
    if (vp.distinctPatterns > 1) {
      const dominantNote = vp.dominant
        ? ` (${vp.dominant.count}/${vp.totalElements} share dominant pattern)`
        : '';
      oneLiners.push(
        `${vp.category}: ${vp.totalElements} total, ${vp.distinctPatterns} distinct patterns${dominantNote}`
      );
    }
  }

  if (interactionMap.withoutHandlers > 0) {
    oneLiners.push(
      `${interactionMap.withoutHandlers}/${interactionMap.total} interactive-looking elements have no handler`
    );
  }

  if (contrast.fail > 0) {
    oneLiners.push(`Contrast: ${contrast.fail}/${contrast.totalChecked} text elements fail WCAG AA`);
  }

  if (componentCensus.orphanInteractive.length > 0) {
    oneLiners.push(
      `${componentCensus.orphanInteractive.length} cursor:pointer elements have no handler`
    );
  }

  if (navigation) {
    if (navigation.navs.length > 0) {
      oneLiners.push(
        `Nav: ${navigation.navs.length} nav region(s), max depth ${navigation.depth}, ${navigation.totalLinks} total links`
      );
    } else {
      oneLiners.push(`Navigation: ${navigation.totalLinks} links, ${navigation.depth} level(s) deep`);
    }
  }

  // Component census one-liner (only when meaningful component names were detected)
  const namedComponents = componentCensus.topComponents.filter(
    c => !/^[a-z]/.test(c.name) || c.name.includes('-') // PascalCase or testid-derived names
  );
  if (namedComponents.length > 0) {
    const top3 = namedComponents.slice(0, 3).map(c => `${c.name}×${c.count}`).join(', ');
    const totalNamed = namedComponents.length;
    oneLiners.push(`Components: ${top3}${totalNamed > 3 ? ` (top 3 of ${totalNamed})` : ''}`);
  }

  const report: SensorReport = {
    visualPatterns,
    navigation,
    componentCensus,
    interactionMap,
    contrast,
    oneLiners,
  };

  // Wrap semantic result into the condensed semanticState shape
  if (ctx.semantic) {
    const sem = ctx.semantic;
    const states: string[] = [];
    if (sem.state.auth.authenticated === true) states.push('authenticated');
    if (sem.state.auth.authenticated === false) states.push('not authenticated');
    if (sem.state.loading.loading) states.push(`loading:${sem.state.loading.type}`);
    if (sem.state.errors.hasErrors) {
      for (const e of sem.state.errors.errors) states.push(`error:${e.type}`);
    }

    report.semanticState = {
      pageIntent: sem.pageIntent.intent,
      states,
      availableActions: sem.availableActions.map(a => a.action),
    };
  }

  return report;
}

export type { SensorReport, SensorContext } from './types.js';
export type {
  VisualPatternReport,
  VisualPatternGroup,
  NavigationMap,
  NavigationNode,
  ComponentCensus,
  InteractionMap,
  ContrastReport,
  ContrastReportEntry,
} from './types.js';
