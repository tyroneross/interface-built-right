/**
 * integration.ts
 * Extract API calls from TypeScript/React component files
 *
 * Detects:
 * - fetch() calls
 * - axios methods (get, post, put, delete, patch, etc.)
 * - Template literals and variable URLs
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ApiCall {
  endpoint: string;       // "/api/users" or "https://..." or "${dynamic}"
  method: string;         // GET, POST, PUT, DELETE, PATCH, etc.
  sourceFile: string;     // File where call was found
  lineNumber?: number;    // Line number in source
  callerContext?: string; // Function/component name containing the call
  isDynamic?: boolean;    // True if endpoint uses template literals or variables
}

/**
 * Represents an API route discovered in the project
 */
export interface ApiRoute {
  route: string;          // "/api/users", "/api/posts/[id]"
  method: string[];       // ["GET", "POST"] based on exports
  sourceFile: string;     // "app/api/users/route.ts"
  isDynamic: boolean;     // Has [param] segments
}

/**
 * Extract the function/component context around a line number
 */
function extractCallerContext(content: string, targetLine: number): string | undefined {
  const lines = content.split('\n');

  // Search backwards from target line to find function/component declaration
  for (let i = targetLine - 1; i >= Math.max(0, targetLine - 30); i--) {
    const line = lines[i];

    // Match function declarations, arrow functions, and React components
    const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/);
    const componentMatch = line.match(/(?:export\s+)?(?:const|function)\s+([A-Z]\w+)/);

    if (functionMatch) return functionMatch[1];
    if (arrowMatch) return arrowMatch[1];
    if (componentMatch) return componentMatch[1];
  }

  return undefined;
}

/**
 * Parse endpoint string, detecting dynamic parts
 */
function parseEndpoint(rawEndpoint: string): { endpoint: string; isDynamic: boolean } {
  // Check for template literal patterns
  const hasTemplateLiteral = rawEndpoint.includes('${') || rawEndpoint.includes('`');

  // Check for concatenation patterns
  const hasConcatenation = /['"].*\+|^\w+$/.test(rawEndpoint);

  if (hasTemplateLiteral || hasConcatenation) {
    return {
      endpoint: rawEndpoint.replace(/`/g, '').replace(/\$\{[^}]+\}/g, '{dynamic}'),
      isDynamic: true
    };
  }

  // Clean up quotes
  return {
    endpoint: rawEndpoint.replace(/['"]/g, ''),
    isDynamic: false
  };
}

/**
 * Extract API calls from file content
 */
function extractFromContent(content: string, sourceFile: string): ApiCall[] {
  const calls: ApiCall[] = [];
  const lines = content.split('\n');

  // Pattern 1: fetch() calls
  // Matches: fetch('/api/users'), fetch("/api/users"), fetch(`/api/${id}`)
  const fetchPattern = /fetch\s*\(\s*(['"`])([^'"`]+)\1/g;
  const fetchWithOptionsPattern = /fetch\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*\{[^}]*method\s*:\s*['"](\w+)['"]/g;

  // Pattern 2: axios method calls
  // Matches: axios.get('/api/users'), axios.post('/api/users', data)
  const axiosPattern = /axios\.(get|post|put|delete|patch|head|options)\s*\(\s*(['"`])([^'"`]+)\2/g;

  // Pattern 3: axios with method in config
  // Matches: axios({ url: '/api/users', method: 'POST' })
  const axiosConfigPattern = /axios\s*\(\s*\{[^}]*url\s*:\s*(['"`])([^'"`]+)\1[^}]*method\s*:\s*['"](\w+)['"]/g;

  // Pattern 4: Template literals (more complex)
  const templateLiteralPattern = /(?:fetch|axios(?:\.\w+)?)\s*\(\s*`([^`]+)`/g;

  // Pattern 5: Variable URLs
  const urlVariablePattern = /const\s+(\w*[Uu]rl\w*)\s*=\s*(['"`])([^'"`]+)\2/g;
  const urlUsagePattern = /(?:fetch|axios(?:\.\w+)?)\s*\(\s*(\w+)/g;

  // Track URL variables
  const urlVariables = new Map<string, { endpoint: string; lineNumber: number }>();

  // First pass: collect URL variables
  lines.forEach((line, index) => {
    let match;
    const urlVarRegex = new RegExp(urlVariablePattern.source, 'g');
    while ((match = urlVarRegex.exec(line)) !== null) {
      urlVariables.set(match[1], {
        endpoint: match[3],
        lineNumber: index + 1
      });
    }
  });

  // Second pass: extract API calls
  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Match fetch with explicit method
    let match;
    const fetchOptsRegex = new RegExp(fetchWithOptionsPattern.source, 'g');
    while ((match = fetchOptsRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[2]);
      calls.push({
        endpoint,
        method: match[3].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }

    // Match basic fetch (default GET)
    const fetchRegex = new RegExp(fetchPattern.source, 'g');
    while ((match = fetchRegex.exec(line)) !== null) {
      // Skip if already matched with options
      if (!line.includes('method:')) {
        const { endpoint, isDynamic } = parseEndpoint(match[2]);
        calls.push({
          endpoint,
          method: 'GET',
          sourceFile,
          lineNumber,
          callerContext: extractCallerContext(content, lineNumber),
          isDynamic
        });
      }
    }

    // Match axios method calls
    const axiosRegex = new RegExp(axiosPattern.source, 'g');
    while ((match = axiosRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[3]);
      calls.push({
        endpoint,
        method: match[1].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }

    // Match axios config object
    const axiosConfigRegex = new RegExp(axiosConfigPattern.source, 'g');
    while ((match = axiosConfigRegex.exec(line)) !== null) {
      const { endpoint, isDynamic } = parseEndpoint(match[2]);
      calls.push({
        endpoint,
        method: match[3].toUpperCase(),
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic
      });
    }

    // Match template literals
    const templateRegex = new RegExp(templateLiteralPattern.source, 'g');
    while ((match = templateRegex.exec(line)) !== null) {
      const { endpoint } = parseEndpoint(match[1]);

      // Try to determine method
      let method = 'GET';
      const methodMatch = line.match(/method\s*:\s*['"](\w+)['"]/);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase();
      }

      calls.push({
        endpoint,
        method,
        sourceFile,
        lineNumber,
        callerContext: extractCallerContext(content, lineNumber),
        isDynamic: true // Template literals are always dynamic
      });
    }

    // Match variable usage
    const urlUsageRegex = new RegExp(urlUsagePattern.source, 'g');
    while ((match = urlUsageRegex.exec(line)) !== null) {
      const varName = match[1];
      if (urlVariables.has(varName)) {
        const urlInfo = urlVariables.get(varName)!;
        const { endpoint, isDynamic } = parseEndpoint(urlInfo.endpoint);

        // Try to determine method
        let method = 'GET';
        const methodMatch = line.match(/method\s*:\s*['"](\w+)['"]/);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }

        calls.push({
          endpoint,
          method,
          sourceFile,
          lineNumber,
          callerContext: extractCallerContext(content, lineNumber),
          isDynamic
        });
      }
    }
  });

  // Deduplicate calls (same endpoint, method, and line)
  const uniqueCalls = calls.filter((call, index, self) =>
    index === self.findIndex((c) =>
      c.endpoint === call.endpoint &&
      c.method === call.method &&
      c.lineNumber === call.lineNumber
    )
  );

  return uniqueCalls;
}

/**
 * Parse a single file for fetch/axios calls
 *
 * @param filePath - Absolute path to TypeScript/React file
 * @returns Array of API calls found in the file
 */
export async function extractApiCalls(filePath: string): Promise<ApiCall[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return extractFromContent(content, filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

/**
 * Recursively scan directory for TypeScript/React files and extract API calls
 *
 * @param dir - Directory to scan
 * @param pattern - File pattern to match (default: TypeScript/React files)
 * @returns Array of all API calls found
 */
export async function scanDirectoryForApiCalls(
  dir: string,
  _pattern: string = '**/*.{ts,tsx,js,jsx}'
): Promise<ApiCall[]> {
  const allCalls: ApiCall[] = [];

  async function scanDir(currentDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, dist, build, .next, etc.
          const skipDirs = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '__tests__', '__mocks__'];
          if (!skipDirs.includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          // Check if file matches pattern
          const ext = path.extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            // Skip test files, spec files, and files with example patterns
            const isTestFile = entry.name.includes('.test.') ||
                              entry.name.includes('.spec.') ||
                              entry.name.includes('.mock.') ||
                              entry.name === 'integration.ts'; // Skip self (contains example patterns)
            if (!isTestFile) {
              const calls = await extractApiCalls(fullPath);
              allCalls.push(...calls);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentDir}:`, error);
    }
  }

  await scanDir(dir);
  return allCalls;
}

/**
 * Group API calls by endpoint
 */
export function groupByEndpoint(calls: ApiCall[]): Map<string, ApiCall[]> {
  const grouped = new Map<string, ApiCall[]>();

  for (const call of calls) {
    const key = call.endpoint;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(call);
  }

  return grouped;
}

/**
 * Group API calls by source file
 */
export function groupByFile(calls: ApiCall[]): Map<string, ApiCall[]> {
  const grouped = new Map<string, ApiCall[]>();

  for (const call of calls) {
    const key = call.sourceFile;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(call);
  }

  return grouped;
}

/**
 * Filter calls to only include specific HTTP methods
 */
export function filterByMethod(calls: ApiCall[], methods: string[]): ApiCall[] {
  const upperMethods = methods.map(m => m.toUpperCase());
  return calls.filter(call => upperMethods.includes(call.method));
}

/**
 * Filter calls to only include specific endpoints (supports wildcards)
 */
export function filterByEndpoint(calls: ApiCall[], endpointPattern: string): ApiCall[] {
  const regex = new RegExp(
    '^' + endpointPattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  );
  return calls.filter(call => regex.test(call.endpoint));
}

/**
 * Discover API routes from Next.js/Remix file structure
 * Supports Next.js App Router (app/api) and Pages Router (pages/api)
 * Also searches subdirectories (like web-ui/) for nested Next.js apps
 */
export async function discoverApiRoutes(projectDir: string): Promise<ApiRoute[]> {
  const routes: ApiRoute[] = [];

  // Discover routes in a specific directory
  async function discoverInDir(dir: string): Promise<void> {
    // Check for Next.js App Router (app/api/**/route.ts)
    const appApiDir = path.join(dir, 'app', 'api');
    if (await directoryExists(appApiDir)) {
      const appRoutes = await discoverAppRouterRoutes(appApiDir, dir);
      routes.push(...appRoutes);
    }

    // Check for Next.js Pages Router (pages/api/**/*.ts)
    const pagesApiDir = path.join(dir, 'pages', 'api');
    if (await directoryExists(pagesApiDir)) {
      const pagesRoutes = await discoverPagesRouterRoutes(pagesApiDir, dir);
      routes.push(...pagesRoutes);
    }

    // Check for src directory variants
    const srcAppApiDir = path.join(dir, 'src', 'app', 'api');
    if (await directoryExists(srcAppApiDir)) {
      const srcAppRoutes = await discoverAppRouterRoutes(srcAppApiDir, dir);
      routes.push(...srcAppRoutes);
    }

    const srcPagesApiDir = path.join(dir, 'src', 'pages', 'api');
    if (await directoryExists(srcPagesApiDir)) {
      const srcPagesRoutes = await discoverPagesRouterRoutes(srcPagesApiDir, dir);
      routes.push(...srcPagesRoutes);
    }
  }

  // Discover in project root
  await discoverInDir(projectDir);

  // Also check subdirectories for nested apps (e.g., web-ui/, frontend/, client/)
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const skipDirs = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next'];

    for (const entry of entries) {
      if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
        const subDir = path.join(projectDir, entry.name);

        // Check if this subdir has a package.json (indicating it's a sub-project)
        const hasPackageJson = await fileExists(path.join(subDir, 'package.json'));
        if (hasPackageJson) {
          await discoverInDir(subDir);
        }
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  return routes;
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Convert file path to API route
 * Examples:
 * - app/api/users/route.ts -> /api/users
 * - app/api/users/[id]/route.ts -> /api/users/[id]
 * - pages/api/users.ts -> /api/users
 * - pages/api/users/[id].ts -> /api/users/[id]
 */
export function filePathToRoute(filePath: string, projectDir: string): string {
  // Normalize paths
  const normalizedFilePath = path.normalize(filePath);
  const normalizedProjectDir = path.normalize(projectDir);

  // Get relative path from project root
  const relativePath = path.relative(normalizedProjectDir, normalizedFilePath);

  // Remove file extension
  let routePath = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');

  // Handle App Router (remove 'route' filename)
  routePath = routePath.replace(/\/route$/, '');
  routePath = routePath.replace(/\\route$/, ''); // Windows paths

  // Extract the API portion
  let apiPath = '';

  if (routePath.includes('app/api/') || routePath.includes('app\\api\\')) {
    apiPath = routePath.split(/app[/\\]api[/\\]/)[1] || '';
  } else if (routePath.includes('src/app/api/') || routePath.includes('src\\app\\api\\')) {
    apiPath = routePath.split(/src[/\\]app[/\\]api[/\\]/)[1] || '';
  } else if (routePath.includes('pages/api/') || routePath.includes('pages\\api\\')) {
    apiPath = routePath.split(/pages[/\\]api[/\\]/)[1] || '';
  } else if (routePath.includes('src/pages/api/') || routePath.includes('src\\pages\\api\\')) {
    apiPath = routePath.split(/src[/\\]pages[/\\]api[/\\]/)[1] || '';
  }

  // Convert to route format (normalize path separators)
  const route = '/api/' + (apiPath ? apiPath.replace(/\\/g, '/') : '');

  return route;
}

/**
 * Cross-reference API calls against routes, return orphans
 */
export function findOrphanEndpoints(
  apiCalls: ApiCall[],
  apiRoutes: ApiRoute[]
): { call: ApiCall; searchedLocations: string[] }[] {
  const orphans: { call: ApiCall; searchedLocations: string[] }[] = [];

  for (const call of apiCalls) {
    const endpoint = call.endpoint;

    // Skip non-API endpoints (external URLs, relative paths without /api)
    if (!endpoint.startsWith('/api') && !endpoint.includes('/api/')) {
      continue;
    }

    // Skip dynamic endpoints that are just placeholders
    if (endpoint.includes('{dynamic}')) {
      continue;
    }

    // Extract the API path
    let apiPath = endpoint;
    if (endpoint.includes('/api/')) {
      apiPath = '/api/' + endpoint.split('/api/')[1].split('?')[0]; // Remove query params
    }

    // Try to match against routes
    const matchedRoute = apiRoutes.find(route => {
      // Check if methods match
      const methodMatches = route.method.includes(call.method) ||
                           route.method.includes('ALL');
      if (!methodMatches) {
        return false;
      }
      // Check if route pattern matches endpoint
      return routeMatchesEndpoint(route.route, apiPath);
    });

    if (!matchedRoute) {
      // Generate possible file locations
      const searchedLocations = generatePossibleRouteFiles(apiPath);

      orphans.push({
        call,
        searchedLocations
      });
    }
  }

  return orphans;
}

/**
 * Check if a route pattern matches an endpoint
 * Handles dynamic segments like [id], [slug], etc.
 */
function routeMatchesEndpoint(routePattern: string, endpoint: string): boolean {
  const routeParts = routePattern.split('/').filter(Boolean);
  const endpointParts = endpoint.split('/').filter(Boolean);

  if (routeParts.length !== endpointParts.length) {
    return false;
  }

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const endpointPart = endpointParts[i];

    // Dynamic segment matches anything
    if (routePart.startsWith('[') && routePart.endsWith(']')) {
      continue;
    }

    // Static segment must match exactly
    if (routePart !== endpointPart) {
      return false;
    }
  }

  return true;
}

/**
 * Generate possible file locations for an API endpoint
 */
function generatePossibleRouteFiles(apiPath: string): string[] {
  const pathWithoutApi = apiPath.replace(/^\/api\//, '');
  const locations: string[] = [];

  // Next.js App Router possibilities
  locations.push(`app/api/${pathWithoutApi}/route.ts`);
  locations.push(`app/api/${pathWithoutApi}/route.js`);
  locations.push(`src/app/api/${pathWithoutApi}/route.ts`);
  locations.push(`src/app/api/${pathWithoutApi}/route.js`);

  // Next.js Pages Router possibilities
  locations.push(`pages/api/${pathWithoutApi}.ts`);
  locations.push(`pages/api/${pathWithoutApi}.js`);
  locations.push(`src/pages/api/${pathWithoutApi}.ts`);
  locations.push(`src/pages/api/${pathWithoutApi}.js`);

  return locations;
}

/**
 * Discover routes in Next.js App Router format
 */
async function discoverAppRouterRoutes(
  apiDir: string,
  projectDir: string
): Promise<ApiRoute[]> {
  const routes: ApiRoute[] = [];

  try {
    const files = await findRouteFiles(apiDir, 'route');

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const methods = extractHttpMethods(content);
      const route = filePathToRoute(file, projectDir);
      const isDynamic = route.includes('[') && route.includes(']');

      if (methods.length > 0) {
        routes.push({
          route,
          method: methods,
          sourceFile: file,
          isDynamic
        });
      }
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
  }

  return routes;
}

/**
 * Discover routes in Next.js Pages Router format
 */
async function discoverPagesRouterRoutes(
  apiDir: string,
  projectDir: string
): Promise<ApiRoute[]> {
  const routes: ApiRoute[] = [];

  try {
    const files = await findRouteFiles(apiDir);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const methods = extractHttpMethods(content);
      const route = filePathToRoute(file, projectDir);
      const isDynamic = route.includes('[') && route.includes(']');

      // Pages Router typically uses default export with req.method check
      // If we find method checks or it has a default export, include it
      if (methods.length > 0 || content.includes('export default')) {
        routes.push({
          route,
          method: methods.length > 0 ? methods : ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          sourceFile: file,
          isDynamic
        });
      }
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
  }

  return routes;
}

/**
 * Find all route files in a directory recursively
 */
async function findRouteFiles(
  dir: string,
  filename?: string
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findRouteFiles(fullPath, filename);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const baseName = path.basename(entry.name, ext);

        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          if (filename) {
            // Looking for specific filename (e.g., 'route.ts')
            if (baseName === filename) {
              files.push(fullPath);
            }
          } else {
            // Include all TypeScript/JavaScript files
            files.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
  }

  return files;
}

/**
 * Extract HTTP method exports from file content
 */
function extractHttpMethods(content: string): string[] {
  const methods: string[] = [];
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  for (const method of httpMethods) {
    // Look for exported functions: export async function GET
    const exportPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, 'g');
    if (exportPattern.test(content)) {
      methods.push(method);
    }
  }

  return methods;
}

/**
 * Check if a directory exists
 */
async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// TODO: Iteration 3 - Add matching between frontend API calls and backend routes (DONE via findOrphanEndpoints)
// TODO: Iteration 4 - Add OpenAPI/Swagger schema generation from discovered routes
