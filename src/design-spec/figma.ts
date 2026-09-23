import { DesignSpecSchema, type DesignSpec, type NumberRule, type TextRule } from './schema.js';

interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  opacity?: number;
  characters?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  /** Native size is returned by Figma when geometry=paths was requested. */
  size?: { x: number; y: number };
  style?: { fontFamily?: string; fontSize?: number; fontWeight?: number };
  fills?: Array<{ type?: string; visible?: boolean; opacity?: number; imageRef?: string; color?: { r: number; g: number; b: number; a?: number } }>;
  reactions?: Array<{ action?: { type?: string; destinationId?: string } }>;
  children?: FigmaNode[];
}

const exactNumber = (value: number): NumberRule => ({ mode: 'exact', value, tolerance: 0 });
const exactText = (value: string): TextRule => ({ mode: 'exact', value });

function findNode(node: FigmaNode, id: string): FigmaNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const match = findNode(child, id);
    if (match) return match;
  }
  return undefined;
}

function solidColor(node: FigmaNode, ancestorsOpaque: boolean): string | undefined {
  if (!ancestorsOpaque || node.opacity !== undefined && node.opacity !== 1) return undefined;
  const visible = node.fills?.filter(f => f.visible !== false) ?? [];
  if (visible.length !== 1 || visible[0].type !== 'SOLID') return undefined;
  const fill = visible[0];
  if (!fill?.color) return undefined;
  const { r, g, b } = fill.color;
  if (![r, g, b].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) return undefined;
  if ((fill.color.a ?? 1) * (fill.opacity ?? 1) !== 1) return undefined;
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

/**
 * Import measurements from a saved Figma GET-file response. The result is a
 * draft: layer names do not establish accessible names or routes. Each node
 * remains unbound until an author adds `match` and maps prototype links.
 */
export function designSpecFromFigmaFile(
  input: unknown,
  frameId: string,
  route: string,
  ref?: string,
  routeMap: Record<string, string> = {},
): DesignSpec {
  for (const [destination, path] of Object.entries(routeMap)) {
    if (typeof path !== 'string' || !path.startsWith('/')) throw new Error(`Invalid application route for Figma node ${destination}`);
  }
  if (!input || typeof input !== 'object' || !('document' in input)) throw new Error('Expected a Figma file JSON object with document');
  const document = (input as { document: FigmaNode }).document;
  const frame = findNode(document, frameId);
  if (!frame) throw new Error(`Figma frame ${frameId} was not found`);
  const origin = frame.absoluteBoundingBox;
  if (!origin || origin.width <= 0 || origin.height <= 0) throw new Error('Selected frame has no measurable absoluteBoundingBox');
  const elements: DesignSpec['views'][number]['elements'] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  let considered = 0;
  const walk = (node: FigmaNode, ancestorsOpaque: boolean) => {
    if (node.visible === false) return;
    considered++;
    const box = node.absoluteBoundingBox;
    if (node.id && box && box.width > 0 && box.height > 0) {
      const geometry: NonNullable<DesignSpec['views'][number]['elements'][number]['geometry']> = {
        x: exactNumber(box.x - origin.x),
        y: exactNumber(box.y - origin.y),
        width: exactNumber(box.width),
        height: exactNumber(box.height),
      };
      if (node.type === 'ELLIPSE') {
        if (node.size && Math.abs(node.size.x - node.size.y) < 0.01) {
          geometry.circumference = exactNumber(Math.PI * node.size.x);
        } else {
          geometry.circumference = { mode: 'free', guidance: 'Confirm native circle dimensions; an axis-aligned bounding box alone cannot prove an ellipse is circular' };
        }
      }
      const style: NonNullable<DesignSpec['views'][number]['elements'][number]['style']> = {};
      const visibleFills = node.fills?.filter(fill => fill.visible !== false) ?? [];
      if (node.type === 'TEXT') {
        if (node.style?.fontFamily) style.fontFamily = exactText(node.style.fontFamily);
        if (node.style?.fontSize !== undefined) style.fontSize = exactNumber(node.style.fontSize);
        if (node.style?.fontWeight !== undefined) style.fontWeight = exactText(String(node.style.fontWeight));
        const color = solidColor(node, ancestorsOpaque);
        if (color) style.color = exactText(color);
        else if (visibleFills.length) style.color = { mode: 'free', guidance: `Review Figma text paint on node ${node.id}; non-opaque or layered fills need an authored CSS rule` };
      } else {
        const color = solidColor(node, ancestorsOpaque);
        if (color) style.backgroundColor = exactText(color);
        else if (visibleFills.length) style.backgroundColor = { mode: 'free', guidance: `Review Figma paint on node ${node.id}; non-opaque or layered fills need an authored CSS rule` };
      }
      const hasGradient = node.fills?.some(fill => fill.visible !== false && fill.type?.startsWith('GRADIENT_'));
      if (hasGradient) style.backgroundImage = { mode: 'free', guidance: `Gradient from Figma node ${node.id}; set an exact or bounded rule if needed` };
      const destination = node.reactions?.map(r => r.action?.destinationId).find(Boolean);
      const mappedRoute = destination ? routeMap[destination] : undefined;
      elements.push({
        id: node.id,
        sourceNode: {
          id: node.id,
          name: node.name || '',
          type: node.type || '',
          fillTypes: (node.fills ?? []).filter(fill => fill.visible !== false).map(fill => fill.type || 'UNKNOWN'),
          imageRefs: (node.fills ?? []).filter(fill => fill.visible !== false && fill.imageRef).map(fill => fill.imageRef!),
          ...(destination ? { prototypeDestinationId: destination } : {}),
        },
        ...(node.type === 'TEXT' && node.characters !== undefined ? { text: exactText(node.characters) } : {}),
        ...(destination ? { href: mappedRoute ? exactText(mappedRoute) :
          { mode: 'free' as const, guidance: `Map Figma prototype destination ${destination} to a route` } } : {}),
        geometry,
        ...(Object.keys(style).length ? { style } : {}),
      });
    } else {
      skipped.push({ id: node.id || '(missing id)', reason: 'missing id or positive absoluteBoundingBox' });
    }
    const childrenOpaque = ancestorsOpaque && (node.opacity ?? 1) === 1;
    for (const child of node.children ?? []) walk(child, childrenOpaque);
  };
  for (const child of frame.children ?? []) walk(child, (frame.opacity ?? 1) === 1);
  if (!elements.length) throw new Error('Selected frame has no measurable visible leaf nodes');
  return DesignSpecSchema.parse({
    version: 1,
    title: frame.name || frame.id || 'Figma design',
    source: { kind: 'figma', ...(ref ? { ref } : {}), coverage: { considered, imported: elements.length, skipped } },
    views: [{
      id: frame.id || frameId,
      route,
      viewport: { width: origin.width, height: origin.height },
      elements,
      freeRegions: [],
    }],
  });
}
