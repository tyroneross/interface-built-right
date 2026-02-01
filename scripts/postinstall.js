#!/usr/bin/env node

/**
 * Post-install script for interface-built-right
 * Shows onboarding message and auto-adds .ibr/ to .gitignore
 */

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const WHITE = '\x1b[37m';
const BG_BLUE = '\x1b[44m';

// Skip in CI environments
if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) {
  process.exit(0);
}

// ============================================================================
// LOGO
// ============================================================================

console.log('');
console.log(`${BOLD}${CYAN}    ╦╔╗ ╦═╗${RESET}`);
console.log(`${BOLD}${CYAN}    ║╠╩╗╠╦╝${RESET}  ${BOLD}Interface Built Right${RESET}`);
console.log(`${BOLD}${CYAN}    ╩╚═╝╩╚═${RESET}  ${DIM}Visual regression testing for Claude Code${RESET}`);
console.log('');
console.log(`${BOLD}${CYAN}╭─────────────────────────────────────────────────────────────╮${RESET}`);
console.log(`${BOLD}${CYAN}│${RESET}  ${GREEN}Installed successfully!${RESET}                                    ${BOLD}${CYAN}│${RESET}`);
console.log(`${BOLD}${CYAN}╰─────────────────────────────────────────────────────────────╯${RESET}`);

// ============================================================================
// AUTO-GITIGNORE .ibr/
// ============================================================================

// Walk up from node_modules to find the user's project root
let projectRoot = process.cwd();
try {
  // When run as postinstall, cwd is the package dir inside node_modules
  // Walk up to find the nearest .git or package.json
  let dir = path.resolve(__dirname, '..');
  for (let i = 0; i < 10; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    if (fs.existsSync(path.join(dir, 'package.json')) && !dir.includes('node_modules')) {
      projectRoot = dir;
      break;
    }
  }
} catch {
  // Fall back to cwd
}

const gitignorePath = path.join(projectRoot, '.gitignore');
const ibrEntry = '.ibr/';

try {
  let gitignoreContent = '';
  let needsAdd = true;

  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    // Check if .ibr/ is already in .gitignore
    const lines = gitignoreContent.split('\n').map(l => l.trim());
    if (lines.includes('.ibr/') || lines.includes('.ibr') || lines.includes('/.ibr/') || lines.includes('/.ibr')) {
      needsAdd = false;
    }
  }

  if (needsAdd) {
    const separator = gitignoreContent && !gitignoreContent.endsWith('\n') ? '\n' : '';
    const block = `${separator}\n# IBR - Visual regression testing sessions\n.ibr/\n`;
    fs.appendFileSync(gitignorePath, block);
    console.log('');
    console.log(`${GREEN}+${RESET} Added ${CYAN}.ibr/${RESET} to .gitignore ${DIM}(sessions stay local)${RESET}`);
  }
} catch {
  // Non-critical - just remind the user
  console.log('');
  console.log(`${YELLOW}!${RESET} Remember to add ${CYAN}.ibr/${RESET} to your .gitignore`);
}

// ============================================================================
// QUICK START
// ============================================================================

console.log('');
console.log(`${BOLD}Quick Start${RESET}`);
console.log(`${DIM}─────────────────────────────────────────────${RESET}`);
console.log(`  ${GREEN}1.${RESET} Capture baseline:    ${CYAN}npx ibr start http://localhost:3000${RESET}`);
console.log(`  ${GREEN}2.${RESET} Make UI changes...`);
console.log(`  ${GREEN}3.${RESET} Compare changes:     ${CYAN}npx ibr check${RESET}`);
console.log(`  ${GREEN}4.${RESET} View in browser:     ${CYAN}npx ibr serve${RESET}  ${DIM}→ localhost:4242${RESET}`);
console.log('');
console.log(`${BOLD}Memory${RESET} ${DIM}(remember UI preferences)${RESET}`);
console.log(`${DIM}─────────────────────────────────────────────${RESET}`);
console.log(`  ${CYAN}npx ibr memory add "Buttons blue" --property background-color --value "#3b82f6"${RESET}`);
console.log(`  ${CYAN}npx ibr memory list${RESET}  ${DIM}→ see all stored preferences${RESET}`);
console.log('');
console.log(`${BOLD}Claude Code Plugin${RESET}`);
console.log(`${DIM}─────────────────────────────────────────────${RESET}`);
console.log(`  Add to ${CYAN}.claude/settings.json${RESET}:`);
console.log(`  ${DIM}{ "plugins": ["node_modules/@tyroneross/interface-built-right/plugin"] }${RESET}`);
console.log('');
console.log(`  Slash commands:  ${CYAN}/ibr:snapshot${RESET}  ${CYAN}/ibr:compare${RESET}  ${CYAN}/ibr:ui${RESET}`);
console.log('');
console.log(`${DIM}Docs: https://github.com/tyroneross/interface-built-right${RESET}`);
console.log('');
