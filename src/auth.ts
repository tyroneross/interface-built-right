import { EngineDriver } from './engine/driver.js';
import { CompatPage } from './engine/compat.js';
import { mkdir, access, readFile, writeFile, unlink, chmod, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { userInfo, homedir } from 'os';
import { createHash, randomBytes } from 'crypto';
import type { LoginOptions } from './types.js';

// Auth state file name (reserved for future use)
// const AUTH_STATE_FILE = 'auth.json';

/**
 * Auth state with metadata for security
 */
interface StoredAuthState {
  state: object; // Playwright storage state
  metadata: {
    createdAt: number;
    expiresAt: number;
    username: string;
    projectPath: string;
  };
}

/**
 * Check if running in a CI/CD or deployed environment
 * Auth operations should be blocked in these environments
 */
export function isDeployedEnvironment(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL ||
    process.env.TRAVIS ||
    process.env.HEROKU ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AZURE_FUNCTIONS_ENVIRONMENT
  );
}

/**
 * Get the path to the auth state file
 * Uses per-user isolation to prevent credential sharing
 */
export function getAuthStatePath(outputDir: string): string {
  const username = userInfo().username;
  // Include username in filename for user isolation
  return join(outputDir, `auth.${username}.json`);
}

/**
 * Get a secure auth path in user's home directory (alternative)
 * This keeps auth completely outside the project directory
 */
export function getSecureAuthPath(projectPath: string): string {
  const username = userInfo().username;
  // Hash project path to create unique identifier
  const projectHash = createHash('sha256')
    .update(resolve(projectPath))
    .digest('hex')
    .substring(0, 16);

  return join(
    homedir(),
    '.config',
    'ibr',
    'auth',
    `${projectHash}.${username}.json`
  );
}

/**
 * Check if .gitignore properly excludes .ibr directory
 */
function validateGitignore(projectDir: string): void {
  const gitignorePath = join(projectDir, '.gitignore');

  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    const lines = gitignore.split('\n').map(l => l.trim());

    const hasIbrIgnore = lines.some(line =>
      line === '.ibr/' ||
      line === '.ibr' ||
      line === '**/.ibr/' ||
      line === '**/.ibr'
    );

    if (!hasIbrIgnore) {
      console.warn('\n⚠️  WARNING: .ibr/ is not in .gitignore!');
      console.warn('   Add ".ibr/" to .gitignore to prevent credential leaks.\n');
    }
  } else {
    console.warn('\n⚠️  No .gitignore found. Create one with ".ibr/" entry.\n');
  }
}

/**
 * Check if auth state exists
 */
export async function hasAuthState(outputDir: string): Promise<boolean> {
  try {
    await access(getAuthStatePath(outputDir));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load auth state if it exists and is valid
 */
export async function loadAuthState(outputDir: string): Promise<object | null> {
  // Block in deployed environments
  if (isDeployedEnvironment()) {
    console.warn('⚠️  Deployed environment detected. Auth state not available.');
    return null;
  }

  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await readFile(authPath, 'utf-8');
    const stored: StoredAuthState = JSON.parse(content);

    // Validate metadata exists
    if (!stored.metadata) {
      console.warn('⚠️  Legacy auth format detected. Please re-authenticate with `ibr login`.');
      return null;
    }

    // Check user matches
    const currentUser = userInfo().username;
    if (stored.metadata.username !== currentUser) {
      console.warn(`⚠️  Auth state belongs to different user (${stored.metadata.username}).`);
      return null;
    }

    // Check expiration
    if (Date.now() > stored.metadata.expiresAt) {
      console.warn('⚠️  Auth state expired. Please re-authenticate with `ibr login`.');
      await clearAuthState(outputDir);
      return null;
    }

    // Warn if auth is getting old (> 24 hours)
    const ageHours = (Date.now() - stored.metadata.createdAt) / (1000 * 60 * 60);
    if (ageHours > 24) {
      console.warn(`⚠️  Auth state is ${Math.floor(ageHours)} hours old. Consider re-authenticating.`);
    }

    return stored.state;
  } catch {
    return null;
  }
}

/**
 * Open a browser for manual login and save the state
 *
 * This opens a visible browser window where the user can:
 * 1. Navigate to login page
 * 2. Enter credentials
 * 3. Complete any 2FA or other auth steps
 *
 * When done, close the browser or press Ctrl+C to save the state.
 */
export async function performLogin(options: LoginOptions): Promise<string> {
  const { url, outputDir, timeout = 300000 } = options; // 5 min default timeout

  // Block in deployed environments
  if (isDeployedEnvironment()) {
    throw new Error(
      'Authentication cannot be performed in deployed environments.\n' +
      'Run `ibr login` locally on your development machine.'
    );
  }

  // Validate .gitignore before storing credentials
  validateGitignore(process.cwd());

  // Ensure output directory exists with restricted permissions
  await mkdir(outputDir, { recursive: true, mode: 0o700 }); // rwx------

  // Fix permissions on existing directory
  try {
    await chmod(outputDir, 0o700);
  } catch {
    // Ignore if chmod fails (e.g., on Windows)
  }

  const authStatePath = getAuthStatePath(outputDir);
  const currentUser = userInfo().username;

  console.log('\n🔐 Opening browser for login...');
  console.log(`   User: ${currentUser}`);
  console.log('   Navigate to your login page and complete authentication.');
  console.log('   When finished, close the browser window to save your session.\n');

  const driver = new EngineDriver();
  await driver.launch({
    headless: false, // Visible browser for manual login
    viewport: { width: 1280, height: 800 },
  });
  const page = new CompatPage(driver);

  try {
    // Navigate to the provided URL
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for the timeout duration — user performs login in the visible browser
    await Promise.race([
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Login timeout exceeded')), timeout);
      }),
    ]);

  } catch (error) {
    // If driver is still running, save state before closing
    if (driver.isLaunched) {
      await saveAuthState(driver, authStatePath, outputDir);
      await driver.close();
    }

    // Check if it was a timeout or browser close
    if (error instanceof Error && error.message.includes('timeout')) {
      throw error;
    }
  }

  // Save state and close
  if (driver.isLaunched) {
    await saveAuthState(driver, authStatePath, outputDir);
    await driver.close();
  }

  console.log(`\n✅ Auth state saved for user: ${currentUser}`);
  console.log(`   Location: ${authStatePath}`);
  console.log('   Expires: 7 days from now');
  console.log('   Future captures will use this authentication.\n');

  return authStatePath;
}

/**
 * Save auth state with metadata and secure permissions
 */
async function saveAuthState(
  driver: EngineDriver,
  authStatePath: string,
  _outputDir: string
): Promise<void> {
  const cookies = await driver.getCookies();
  const state = { cookies, origins: [] };
  const currentUser = userInfo().username;

  const storedState: StoredAuthState = {
    state,
    metadata: {
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      username: currentUser,
      projectPath: resolve(process.cwd()),
    }
  };

  // Write with restricted permissions (owner read/write only)
  await writeFile(
    authStatePath,
    JSON.stringify(storedState, null, 2),
    { mode: 0o600 } // rw-------
  );

  // Ensure permissions are correct (in case file existed)
  try {
    await chmod(authStatePath, 0o600);
  } catch {
    // Ignore if chmod fails (e.g., on Windows)
  }
}

/**
 * Clear saved auth state with secure deletion
 */
export async function clearAuthState(outputDir: string): Promise<void> {
  const authPath = getAuthStatePath(outputDir);

  try {
    // Get file stats for size
    const stats = await stat(authPath);

    // Overwrite with random data before deletion (secure delete)
    const randomData = randomBytes(stats.size);
    await writeFile(authPath, randomData, { mode: 0o600 });

    // Now delete the file
    await unlink(authPath);

    console.log('✅ Auth state securely cleared');
  } catch {
    console.log('ℹ️  No auth state to clear');
  }
}

/**
 * Get auth state info without loading the full state
 */
export async function getAuthStateInfo(outputDir: string): Promise<{
  exists: boolean;
  username?: string;
  createdAt?: Date;
  expiresAt?: Date;
  expired?: boolean;
} | null> {
  try {
    const authPath = getAuthStatePath(outputDir);
    const content = await readFile(authPath, 'utf-8');
    const stored: StoredAuthState = JSON.parse(content);

    if (!stored.metadata) {
      return { exists: true };
    }

    return {
      exists: true,
      username: stored.metadata.username,
      createdAt: new Date(stored.metadata.createdAt),
      expiresAt: new Date(stored.metadata.expiresAt),
      expired: Date.now() > stored.metadata.expiresAt,
    };
  } catch {
    return null;
  }
}
