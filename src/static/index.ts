/**
 * Static HTML/CSS Analysis
 *
 * Export all static scanning utilities for use in IBR.
 */

export { parseStaticHTML, parseCSS, applyStyles, type StaticElement, type CSSRule } from './parser.js';
export { scanStatic, type StaticScanOptions, type StaticScanResult } from './scan.js';
