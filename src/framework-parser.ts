/**
 * Framework Parser - Extracts design frameworks from CLAUDE.md content
 *
 * Parses markdown to find design frameworks like:
 * - Calm Precision
 * - Material Design
 * - Human Interface Guidelines
 * - Custom frameworks defined by users
 *
 * Detection is based on:
 * 1. Framework name in headers (e.g., "# CALM PRECISION 6.1")
 * 2. Principles sections (e.g., "## CORE PRINCIPLES")
 * 3. Numbered design rules (e.g., "### 1. Group, Don't Isolate")
 */

export interface DesignFramework {
  name: string;
  version?: string;
  principles: DesignPrinciple[];
  source: string; // File path it was loaded from
  rawContent: string;
}

export interface DesignPrinciple {
  id: string;
  name: string;
  description: string;
  foundation?: string[]; // e.g., ["Gestalt Proximity", "Common Region"]
  implementation: string[]; // Implementation rules/guidelines
  category?: string;
}

// Common framework name patterns
const FRAMEWORK_PATTERNS = [
  /^#\s*(.+?)\s*(\d+\.?\d*)?$/m, // "# CALM PRECISION 6.1"
  /^\*\*(.+?)\*\*\s*v?(\d+\.?\d*)?/m, // "**Framework Name** v1.0"
  /^##?\s*(?:Design\s+)?Framework:\s*(.+?)(?:\s+v?(\d+\.?\d*))?$/im,
];

// Section patterns that indicate principles
const PRINCIPLES_SECTION_PATTERNS = [
  /^##\s*(?:CORE\s+)?PRINCIPLES?/im,
  /^##\s*DESIGN\s+PRINCIPLES?/im,
  /^##\s*GUIDELINES?/im,
  /^##\s*RULES?/im,
];

// Numbered principle pattern
const NUMBERED_PRINCIPLE = /^###\s*(\d+)\.\s*(.+)$/m;

/**
 * Parse a design framework from markdown content
 */
export function parseDesignFramework(
  content: string,
  sourcePath: string
): DesignFramework | null {
  // Try to detect framework name
  const frameworkInfo = detectFrameworkName(content);
  if (!frameworkInfo) {
    // Check if there are principles even without explicit framework name
    const principles = extractPrinciples(content);
    if (principles.length >= 3) {
      // At least 3 principles suggests a design framework
      return {
        name: 'Custom Design Framework',
        principles,
        source: sourcePath,
        rawContent: content,
      };
    }
    return null;
  }

  // Extract principles
  const principles = extractPrinciples(content);

  if (principles.length === 0) {
    // Framework name found but no principles extracted
    return null;
  }

  return {
    name: frameworkInfo.name,
    version: frameworkInfo.version,
    principles,
    source: sourcePath,
    rawContent: content,
  };
}

/**
 * Detect framework name from content
 */
function detectFrameworkName(
  content: string
): { name: string; version?: string } | null {
  // Check for common framework patterns
  for (const pattern of FRAMEWORK_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const name = match[1].trim();
      const version = match[2]?.trim();

      // Filter out generic headers
      if (
        !name.toLowerCase().includes('instructions') &&
        !name.toLowerCase().includes('readme') &&
        !name.toLowerCase().includes('overview')
      ) {
        return { name, version };
      }
    }
  }

  // Look for known framework names in content
  const knownFrameworks = [
    'calm precision',
    'material design',
    'human interface guidelines',
    'fluent design',
    'ant design',
    'carbon design',
    'atlassian design',
  ];

  const contentLower = content.toLowerCase();
  for (const framework of knownFrameworks) {
    if (contentLower.includes(framework)) {
      // Find the exact casing in the original content
      const regex = new RegExp(framework, 'i');
      const match = content.match(regex);
      if (match) {
        return { name: match[0] };
      }
    }
  }

  return null;
}

/**
 * Extract design principles from content
 */
function extractPrinciples(content: string): DesignPrinciple[] {
  const principles: DesignPrinciple[] = [];

  // Find principles section
  let principlesSection = content;
  for (const pattern of PRINCIPLES_SECTION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const startIndex = match.index || 0;
      // Extract content from this section until the next major section
      const afterMatch = content.slice(startIndex);
      const nextMajorSection = afterMatch.match(/^##\s+[A-Z]/m);
      if (nextMajorSection && nextMajorSection.index) {
        principlesSection = afterMatch.slice(0, nextMajorSection.index);
      } else {
        principlesSection = afterMatch;
      }
      break;
    }
  }

  // Extract numbered principles (### 1. Name format)
  const numberedMatches = principlesSection.matchAll(
    /###\s*(\d+)\.\s*(.+?)(?:\n|\r\n)([\s\S]*?)(?=###\s*\d+\.|##\s|$)/g
  );

  for (const match of numberedMatches) {
    const number = match[1];
    const name = match[2].trim();
    const body = match[3].trim();

    const principle = parsePrincipleBody(number, name, body);
    if (principle) {
      principles.push(principle);
    }
  }

  // If no numbered principles found, try bullet point format
  if (principles.length === 0) {
    const bulletMatches = principlesSection.matchAll(
      /[-*]\s*\*\*(.+?)\*\*[:\s]*(.+?)(?=\n[-*]|\n\n|$)/gs
    );

    let index = 1;
    for (const match of bulletMatches) {
      const name = match[1].trim();
      const description = match[2].trim();

      principles.push({
        id: `principle-${index}`,
        name,
        description,
        implementation: extractImplementationRules(description),
      });
      index++;
    }
  }

  return principles;
}

/**
 * Parse the body of a principle to extract details
 */
function parsePrincipleBody(
  number: string,
  name: string,
  body: string
): DesignPrinciple | null {
  // Generate ID from name
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Extract foundation (scientific basis)
  const foundationMatch = body.match(
    /\*\*(?:Foundation|Based on|Principle):\*\*\s*(.+?)(?:\n|$)/i
  );
  const foundation = foundationMatch
    ? foundationMatch[1]
        .split(/[,+]/)
        .map((f) => f.trim())
        .filter(Boolean)
    : undefined;

  // Extract description (first paragraph or sentence)
  const lines = body.split('\n').filter((l) => l.trim());
  let description = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip foundation line
    if (trimmed.toLowerCase().includes('foundation:')) continue;
    // Skip bullet points for description
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) continue;

    description = trimmed;
    break;
  }

  // Extract implementation rules (bullet points)
  const implementation = extractImplementationRules(body);

  return {
    id: `${number}-${id}`,
    name,
    description: description || name,
    foundation,
    implementation,
  };
}

/**
 * Extract implementation rules from principle body
 */
function extractImplementationRules(body: string): string[] {
  const rules: string[] = [];

  // Match bullet points
  const bulletMatches = body.matchAll(/^[-*]\s+(.+?)$/gm);
  for (const match of bulletMatches) {
    const rule = match[1].trim();
    if (rule && rule.length > 5) {
      // Skip very short rules
      rules.push(rule);
    }
  }

  // If no bullet points, extract sentences that sound like rules
  if (rules.length === 0) {
    const sentences = body.split(/[.!]\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      // Look for imperative or declarative rules
      if (
        trimmed.length > 10 &&
        (trimmed.match(/^(use|don't|never|always|avoid|prefer|ensure)/i) ||
          trimmed.match(/should|must|need to|better to/i))
      ) {
        rules.push(trimmed);
      }
    }
  }

  return rules;
}

/**
 * Format framework for display
 */
export function formatFramework(framework: DesignFramework): string {
  const lines: string[] = [];

  lines.push(`Framework: ${framework.name}${framework.version ? ` v${framework.version}` : ''}`);
  lines.push(`Source: ${framework.source}`);
  lines.push(`Principles: ${framework.principles.length}`);
  lines.push('');

  for (const principle of framework.principles) {
    lines.push(`  ${principle.id}: ${principle.name}`);
    if (principle.foundation) {
      lines.push(`    Foundation: ${principle.foundation.join(', ')}`);
    }
    lines.push(`    Rules: ${principle.implementation.length}`);
  }

  return lines.join('\n');
}
