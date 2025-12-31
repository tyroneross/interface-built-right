#!/usr/bin/env node

/**
 * Post-install script for interface-built-right
 * Shows onboarding message after installation
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

// Skip in CI environments
if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) {
  process.exit(0);
}

console.log('');
console.log(`${BOLD}${CYAN}╭─────────────────────────────────────────────────────────────╮${RESET}`);
console.log(`${BOLD}${CYAN}│${RESET}  ${BOLD}interface-built-right${RESET} installed successfully!            ${BOLD}${CYAN}│${RESET}`);
console.log(`${BOLD}${CYAN}│${RESET}  Visual regression testing for Claude Code                  ${BOLD}${CYAN}│${RESET}`);
console.log(`${BOLD}${CYAN}╰─────────────────────────────────────────────────────────────╯${RESET}`);
console.log('');
console.log(`${BOLD}Quick Start${RESET}`);
console.log(`${DIM}─────────────────────────────────────────────${RESET}`);
console.log(`  ${GREEN}1.${RESET} Capture baseline:    ${CYAN}npx ibr start http://localhost:3000${RESET}`);
console.log(`  ${GREEN}2.${RESET} Make UI changes...`);
console.log(`  ${GREEN}3.${RESET} Compare changes:     ${CYAN}npx ibr check${RESET}`);
console.log(`  ${GREEN}4.${RESET} View in browser:     ${CYAN}npx ibr serve${RESET}  ${DIM}→ localhost:4242${RESET}`);
console.log('');
console.log(`${BOLD}Claude Code Plugin${RESET}`);
console.log(`${DIM}─────────────────────────────────────────────${RESET}`);
console.log(`  Add to ${CYAN}.claude/settings.json${RESET}:`);
console.log(`  ${DIM}{ "plugins": ["node_modules/interface-built-right/plugin"] }${RESET}`);
console.log('');
console.log(`  Slash commands:  ${CYAN}/ibr:snapshot${RESET}  ${CYAN}/ibr:compare${RESET}  ${CYAN}/ibr:ui${RESET}`);
console.log('');
console.log(`${BOLD}Default Mode${RESET} ${DIM}(auto-capture)${RESET}`);
console.log(`${DIM}─────────────────────────────────────────────${RESET}`);
console.log(`  Claude automatically captures baselines before UI edits`);
console.log(`  and compares after changes. Self-iterates on obvious issues.`);
console.log('');
console.log(`${DIM}Docs: https://github.com/tyroneross/interface-built-right${RESET}`);
console.log(`${DIM}Init config: npx ibr init${RESET}`);
console.log('');
