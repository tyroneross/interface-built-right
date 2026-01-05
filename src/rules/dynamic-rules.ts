/**
 * Dynamic Rules Generator
 *
 * Converts design frameworks parsed from CLAUDE.md into auditable rules.
 * Rules are generated dynamically based on the user's framework, not hardcoded.
 *
 * This is the core of context-aware validation - IBR doesn't enforce
 * generic standards, it validates against what the USER specified.
 */

import type { EnhancedElement, Violation } from '../schemas.js';
import type { Rule, RuleContext, RulePreset } from './engine.js';
import type { DesignFramework, DesignPrinciple } from '../framework-parser.js';

/**
 * Extended rule with framework context
 */
export interface DynamicRule extends Rule {
  principleId: string;
  framework: string;
  principleIndex: number;
}

/**
 * Generate rules from a design framework
 */
export function generateRulesFromFramework(framework: DesignFramework): DynamicRule[] {
  const rules: DynamicRule[] = [];

  for (let i = 0; i < framework.principles.length; i++) {
    const principle = framework.principles[i];
    const principleRules = generateRulesForPrinciple(principle, framework.name, i);
    rules.push(...principleRules);
  }

  return rules;
}

/**
 * Create a preset from a design framework
 */
export function createPresetFromFramework(framework: DesignFramework): RulePreset {
  const rules = generateRulesFromFramework(framework);
  const defaults: Record<string, 'warn' | 'error'> = {};

  for (const rule of rules) {
    defaults[rule.id] = rule.defaultSeverity;
  }

  return {
    name: framework.name.toLowerCase().replace(/\s+/g, '-'),
    description: `Rules generated from ${framework.name}`,
    rules,
    defaults,
  };
}

/**
 * Generate rules for a single principle
 */
function generateRulesForPrinciple(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule[] {
  const rules: DynamicRule[] = [];
  const baseId = principle.id || `principle-${index + 1}`;

  // Generate rules based on principle keywords and patterns
  const keywords = extractKeywords(principle);

  // Grouping/Border rules (Gestalt)
  if (keywords.has('group') || keywords.has('border') || keywords.has('isolate')) {
    rules.push(createBorderGroupingRule(principle, frameworkName, index));
  }

  // Size/Importance rules (Fitts' Law)
  if (keywords.has('size') || keywords.has('importance') || keywords.has('button') || keywords.has('fitts')) {
    rules.push(createButtonSizingRule(principle, frameworkName, index));
  }

  // Touch target rules
  if (keywords.has('touch') || keywords.has('target') || keywords.has('44px') || keywords.has('mobile')) {
    rules.push(createTouchTargetRule(principle, frameworkName, index));
  }

  // Hierarchy rules
  if (keywords.has('hierarchy') || keywords.has('title') || keywords.has('description') || keywords.has('metadata')) {
    rules.push(createHierarchyRule(principle, frameworkName, index));
  }

  // Status/Color rules
  if (keywords.has('status') || keywords.has('color') || keywords.has('background')) {
    rules.push(createStatusColorRule(principle, frameworkName, index));
  }

  // Content-chrome ratio
  if (keywords.has('content') || keywords.has('chrome') || keywords.has('70%')) {
    rules.push(createContentChromeRule(principle, frameworkName, index));
  }

  // If no specific rules were generated, create a generic principle reminder rule
  if (rules.length === 0) {
    rules.push(createGenericPrincipleRule(principle, frameworkName, index));
  }

  return rules;
}

/**
 * Extract keywords from a principle for rule mapping
 */
function extractKeywords(principle: DesignPrinciple): Set<string> {
  const text = [
    principle.name,
    principle.description,
    ...(principle.foundation || []),
    ...principle.implementation,
  ].join(' ').toLowerCase();

  return new Set(text.match(/\b\w+\b/g) || []);
}

/**
 * Create a border grouping rule from a principle
 */
function createBorderGroupingRule(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule {
  return {
    id: `${principle.id}-border`,
    name: `${principle.name}: Border Usage`,
    description: principle.description,
    defaultSeverity: 'warn',
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
      // Check if element has individual border when it might be part of a list
      const style = element.computedStyles;
      if (!style) return null;

      const hasBorder = style.border && style.border !== 'none' && style.border !== '0px';
      const isListItem = element.tagName === 'li' || element.selector?.includes('item');

      if (hasBorder && isListItem) {
        return {
          ruleId: `${principle.id}-border`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: 'warn',
          message: `Individual borders on list items may isolate rather than group. Consider single group border per "${principle.name}".`,
          element: element.selector,
          bounds: element.bounds,
          fix: 'Use single border around group with dividers between items.',
        };
      }

      return null;
    },
  };
}

/**
 * Create a button sizing rule from a principle
 */
function createButtonSizingRule(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule {
  return {
    id: `${principle.id}-button-size`,
    name: `${principle.name}: Button Sizing`,
    description: principle.description,
    defaultSeverity: 'warn',
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element: EnhancedElement, context: RuleContext): Violation | null => {
      if (element.tagName !== 'button' && element.role !== 'button') return null;

      const width = element.bounds?.width || 0;
      const height = element.bounds?.height || 0;

      // Check if button has text suggesting it's a primary action
      const text = (element.text || element.innerText || '').toLowerCase();
      const isPrimaryAction = /submit|save|confirm|checkout|buy|sign|login|register|continue/i.test(text);

      // Very small buttons for primary actions
      if (isPrimaryAction && width < 120) {
        return {
          ruleId: `${principle.id}-button-size`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: 'warn',
          message: `Primary action button "${text}" is ${width}px wide. Per "${principle.name}", primary actions should be more prominent.`,
          element: element.selector,
          bounds: element.bounds,
          fix: 'Increase button width to match importance of the action.',
        };
      }

      return null;
    },
  };
}

/**
 * Create a touch target rule from a principle
 */
function createTouchTargetRule(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule {
  return {
    id: `${principle.id}-touch-target`,
    name: `${principle.name}: Touch Targets`,
    description: principle.description,
    defaultSeverity: 'warn',
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element: EnhancedElement, context: RuleContext): Violation | null => {
      if (!element.interactive?.isInteractive) return null;

      const width = element.bounds?.width || 0;
      const height = element.bounds?.height || 0;
      const minSize = context.isMobile ? 44 : 24;

      if (width < minSize || height < minSize) {
        return {
          ruleId: `${principle.id}-touch-target`,
          ruleName: `${frameworkName}: ${principle.name}`,
          severity: 'warn',
          message: `Interactive element is ${width}x${height}px, below ${minSize}px minimum per "${principle.name}".`,
          element: element.selector,
          bounds: element.bounds,
          fix: `Increase to at least ${minSize}x${minSize}px for ${context.isMobile ? 'mobile' : 'desktop'}.`,
        };
      }

      return null;
    },
  };
}

/**
 * Create a hierarchy rule from a principle
 */
function createHierarchyRule(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule {
  return {
    id: `${principle.id}-hierarchy`,
    name: `${principle.name}: Content Hierarchy`,
    description: principle.description,
    defaultSeverity: 'warn',
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (_element: EnhancedElement, _context: RuleContext): Violation | null => {
      // Hierarchy checks are more complex and require analyzing multiple elements
      // This is a placeholder for future implementation
      return null;
    },
  };
}

/**
 * Create a status color rule from a principle
 */
function createStatusColorRule(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule {
  return {
    id: `${principle.id}-status`,
    name: `${principle.name}: Status Indication`,
    description: principle.description,
    defaultSeverity: 'warn',
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (element: EnhancedElement, _context: RuleContext): Violation | null => {
      // Check for status badges with heavy backgrounds
      const style = element.computedStyles;
      if (!style) return null;

      const text = (element.text || element.innerText || '').toLowerCase();
      const isStatusText = /success|error|warning|pending|active|inactive|status/i.test(text);

      if (isStatusText && style.backgroundColor && style.backgroundColor !== 'transparent') {
        // Check if it's a heavy background (not subtle)
        // This is a simplified check - could be more sophisticated
        const bgColor = style.backgroundColor;
        if (bgColor && !bgColor.includes('rgba') && !bgColor.includes('0.1') && !bgColor.includes('0.05')) {
          return {
            ruleId: `${principle.id}-status`,
            ruleName: `${frameworkName}: ${principle.name}`,
            severity: 'warn',
            message: `Status element "${text}" has heavy background. Per "${principle.name}", consider text color only.`,
            element: element.selector,
            bounds: element.bounds,
            fix: 'Use text color only for status indication, not background.',
          };
        }
      }

      return null;
    },
  };
}

/**
 * Create a content-chrome ratio rule from a principle
 */
function createContentChromeRule(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule {
  return {
    id: `${principle.id}-content-chrome`,
    name: `${principle.name}: Content Ratio`,
    description: principle.description,
    defaultSeverity: 'warn',
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (_element: EnhancedElement, _context: RuleContext): Violation | null => {
      // Content-chrome ratio requires page-level analysis
      // This is a placeholder for future implementation
      return null;
    },
  };
}

/**
 * Create a generic principle reminder rule
 */
function createGenericPrincipleRule(
  principle: DesignPrinciple,
  frameworkName: string,
  index: number
): DynamicRule {
  return {
    id: `${principle.id}-reminder`,
    name: `${principle.name}`,
    description: principle.description,
    defaultSeverity: 'warn',
    principleId: principle.id,
    framework: frameworkName,
    principleIndex: index,
    check: (_element: EnhancedElement, _context: RuleContext): Violation | null => {
      // Generic rules don't check anything - they're for documentation
      // Could be used to remind about principles during manual review
      return null;
    },
  };
}

/**
 * Get a summary of rules generated from a framework
 */
export function getRulesSummary(rules: DynamicRule[]): string {
  const byPrinciple = new Map<string, DynamicRule[]>();

  for (const rule of rules) {
    const existing = byPrinciple.get(rule.principleId) || [];
    existing.push(rule);
    byPrinciple.set(rule.principleId, existing);
  }

  const lines: string[] = [];
  lines.push(`Generated ${rules.length} rules from ${byPrinciple.size} principles:`);
  lines.push('');

  for (const [principleId, principleRules] of byPrinciple) {
    lines.push(`  ${principleId}: ${principleRules.length} rules`);
    for (const rule of principleRules) {
      lines.push(`    - ${rule.name}`);
    }
  }

  return lines.join('\n');
}
