import type { SensorContext, SensorReport } from './types.js';
import { collectVisualPatterns } from './visual-patterns.js';
import { collectComponentCensus } from './component-census.js';
import { collectInteractionMap } from './interaction-map.js';
import { collectContrastReport } from './contrast-report.js';
import { collectNavigationMap } from './navigation.js';
import { collectTypography } from './typography.js';
import { collectBreakpoints } from './breakpoints.js';
import { collectMotion } from './motion.js';
import { collectHierarchy } from './hierarchy.js';
import { collectInteractionStates } from './interaction-states.js';

export function runSensors(ctx: SensorContext): SensorReport {
  const visualPatterns = collectVisualPatterns(ctx);
  const componentCensus = collectComponentCensus(ctx);
  const interactionMap = collectInteractionMap(ctx);
  const contrast = collectContrastReport(ctx);
  const navigation = collectNavigationMap(ctx);
  const typography = collectTypography(ctx);
  const breakpoints = collectBreakpoints(ctx);
  const motion = collectMotion(ctx);
  const hierarchy = collectHierarchy(ctx);
  const interactionStates = collectInteractionStates(ctx);

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

  // New sensor one-liners (only emit when there's something to say)
  if (typography.rows.length > 0) {
    const top = typography.rows[0]!;
    oneLiners.push(
      `Typography: ${typography.rows.length} distinct fingerprints, dominant ${top.size_px}px/${top.weight} (${top.count} elements)${typography.font_loading_pending ? ' [fonts pending]' : ''}`,
    );
  }
  if (breakpoints.length > 0) {
    const viewportBreaks = breakpoints.filter((b) => b.type !== 'print' && b.type !== 'other');
    if (viewportBreaks.length > 0) {
      const summary = viewportBreaks
        .slice(0, 4)
        .map((b) => (b.type === 'range' ? `${b.min}-${b.max}` : `${b.value_px}`))
        .join('px, ');
      oneLiners.push(
        `Breakpoints: ${viewportBreaks.length} viewport breakpoints (${summary}px)`,
      );
    }
  }
  if (motion.transitions.length > 0 || motion.keyframes.length > 0) {
    const reducedNote = motion.reduced_motion_overrides.length > 0
      ? `, ${motion.reduced_motion_overrides.length} reduced-motion override(s)`
      : '';
    oneLiners.push(
      `Motion: ${motion.transitions.length} transition(s), ${motion.keyframes.length} keyframe(s)${reducedNote}`,
    );
  }
  if (
    hierarchy.h1.count > 0 ||
    hierarchy.h2.count > 0 ||
    hierarchy.h3.count > 0
  ) {
    const findingNote = hierarchy.h1.finding ? ` [${hierarchy.h1.finding}]` : '';
    const skipNote = hierarchy.level_skips.length > 0 ? `, ${hierarchy.level_skips.length} level skip(s)` : '';
    oneLiners.push(
      `Hierarchy: h1×${hierarchy.h1.count}, h2×${hierarchy.h2.count}, h3×${hierarchy.h3.count}${findingNote}${skipNote}`,
    );
  }
  if (interactionStates.states.length > 0 || interactionStates.findings.length > 0) {
    const findingNote = interactionStates.findings.length > 0
      ? ` (${interactionStates.findings.length} missing focus indicator)`
      : '';
    oneLiners.push(
      `Interaction states: ${interactionStates.states.length} declared${findingNote}`,
    );
  }

  const report: SensorReport = {
    visualPatterns,
    navigation,
    componentCensus,
    interactionMap,
    contrast,
    typography,
    breakpoints,
    motion,
    hierarchy,
    interactionStates,
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

export type { SensorReport, SensorContext, ExtractedCSSRule, DocumentMeta } from './types.js';
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
export type { TypographyReport, TypographyRow } from './typography.js';
export type { BreakpointEntry, BreakpointType } from './breakpoints.js';
export type { MotionReport, TransitionEntry, KeyframesEntry, ReducedMotionOverride } from './motion.js';
export type {
  HierarchyReport,
  HeadingLevelSummary,
  HeadingFinding,
  LandmarkCounts,
  AriaHeading,
  LevelSkip,
} from './hierarchy.js';
export type {
  InteractionStatesReport,
  StateRule,
  StateFinding,
  InteractionState,
} from './interaction-states.js';
