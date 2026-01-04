# API Integration Module

## Overview

The integration module provides functionality to discover and analyze API routes in your Next.js project, helping you identify orphaned endpoints and maintain consistency between frontend API calls and backend routes.

## Features

1. **API Call Parsing**: Extract API calls from TypeScript/React component files
2. **Route Discovery**: Discover API routes from Next.js file structure (App Router & Pages Router)
3. **Orphan Detection**: Cross-reference API calls against routes to find orphaned endpoints
4. **Dynamic Route Matching**: Handle dynamic segments like `[id]`, `[slug]`, etc.

## Installation

```typescript
import {
  extractApiCalls,
  scanDirectoryForApiCalls,
  discoverApiRoutes,
  filePathToRoute,
  findOrphanEndpoints,
  type ApiCall,
  type ApiRoute
} from '@tyroneross/interface-built-right';
```

## API Reference

### Types

#### `ApiCall`

Represents an API call found in the codebase:

```typescript
interface ApiCall {
  endpoint: string;       // "/api/users" or "https://..." or "${dynamic}"
  method: string;         // GET, POST, PUT, DELETE, PATCH, etc.
  sourceFile: string;     // File where call was found
  lineNumber?: number;    // Line number in source
  callerContext?: string; // Function/component name containing the call
  isDynamic?: boolean;    // True if endpoint uses template literals or variables
}
```

#### `ApiRoute`

Represents an API route discovered in the project:

```typescript
interface ApiRoute {
  route: string;          // "/api/users", "/api/posts/[id]"
  method: string[];       // ["GET", "POST"] based on exports
  sourceFile: string;     // "app/api/users/route.ts"
  isDynamic: boolean;     // Has [param] segments
}
```

### Functions

#### `extractApiCalls(filePath: string): Promise<ApiCall[]>`

Extract API calls from a single file.

**Supported patterns:**
- `fetch('/api/users')`
- `fetch('/api/users', { method: 'POST' })`
- `axios.get('/api/users')`
- `axios.post('/api/users', data)`
- `axios({ url: '/api/users', method: 'POST' })`
- Template literals: `` fetch(`/api/users/${id}`) ``

**Example:**

```typescript
const calls = await extractApiCalls('./src/components/UserList.tsx');
console.log(calls);
// [
//   {
//     endpoint: '/api/users',
//     method: 'GET',
//     sourceFile: './src/components/UserList.tsx',
//     lineNumber: 15,
//     callerContext: 'UserList',
//     isDynamic: false
//   }
// ]
```

#### `scanDirectoryForApiCalls(dir: string): Promise<ApiCall[]>`

Recursively scan a directory for API calls in all TypeScript/React files.

**Example:**

```typescript
const allCalls = await scanDirectoryForApiCalls('./src');
console.log(`Found ${allCalls.length} API calls`);
```

#### `discoverApiRoutes(projectDir: string): Promise<ApiRoute[]>`

Discover API routes from Next.js file structure.

**Supported patterns:**
- Next.js App Router: `app/api/**/route.ts`
- Next.js Pages Router: `pages/api/**/*.ts`
- With `src` directory: `src/app/api/**/route.ts`, `src/pages/api/**/*.ts`

**Example:**

```typescript
const routes = await discoverApiRoutes('./');
console.log(routes);
// [
//   {
//     route: '/api/users',
//     method: ['GET', 'POST'],
//     sourceFile: 'app/api/users/route.ts',
//     isDynamic: false
//   },
//   {
//     route: '/api/users/[id]',
//     method: ['GET', 'PUT', 'DELETE'],
//     sourceFile: 'app/api/users/[id]/route.ts',
//     isDynamic: true
//   }
// ]
```

#### `filePathToRoute(filePath: string, projectDir: string): string`

Convert a file path to an API route.

**Examples:**

```typescript
filePathToRoute('/project/app/api/users/route.ts', '/project')
// => '/api/users'

filePathToRoute('/project/app/api/users/[id]/route.ts', '/project')
// => '/api/users/[id]'

filePathToRoute('/project/pages/api/posts.ts', '/project')
// => '/api/posts'

filePathToRoute('/project/src/app/api/auth/login/route.ts', '/project')
// => '/api/auth/login'
```

#### `findOrphanEndpoints(apiCalls: ApiCall[], apiRoutes: ApiRoute[]): OrphanEndpoint[]`

Cross-reference API calls against routes to find orphaned endpoints.

**Dynamic route matching:**
- `/api/users/123` matches route `/api/users/[id]`
- `/api/posts/my-post/comments` matches route `/api/posts/[slug]/comments`

**Example:**

```typescript
const calls = await scanDirectoryForApiCalls('./src');
const routes = await discoverApiRoutes('./');
const orphans = findOrphanEndpoints(calls, routes);

orphans.forEach(orphan => {
  console.log(`Orphan: ${orphan.call.method} ${orphan.call.endpoint}`);
  console.log(`Called from: ${orphan.call.sourceFile}:${orphan.call.lineNumber}`);
  console.log(`Expected locations:`);
  orphan.searchedLocations.forEach(loc => console.log(`  - ${loc}`));
});
```

#### Helper Functions

**`groupByEndpoint(calls: ApiCall[]): Map<string, ApiCall[]>`**

Group API calls by endpoint.

**`groupByFile(calls: ApiCall[]): Map<string, ApiCall[]>`**

Group API calls by source file.

**`filterByMethod(calls: ApiCall[], methods: string[]): ApiCall[]`**

Filter calls to only include specific HTTP methods.

**`filterByEndpoint(calls: ApiCall[], endpointPattern: string): ApiCall[]`**

Filter calls by endpoint pattern (supports wildcards `*` and `?`).

## Complete Example

```typescript
import {
  scanDirectoryForApiCalls,
  discoverApiRoutes,
  findOrphanEndpoints,
  groupByEndpoint
} from '@tyroneross/interface-built-right';

async function analyzeApiIntegration() {
  // 1. Discover all API calls in frontend code
  console.log('Scanning for API calls...');
  const apiCalls = await scanDirectoryForApiCalls('./src');
  console.log(`Found ${apiCalls.length} API calls\n`);

  // 2. Discover all API routes in backend
  console.log('Discovering API routes...');
  const apiRoutes = await discoverApiRoutes('./');
  console.log(`Found ${apiRoutes.length} API routes\n`);

  // 3. Find orphaned endpoints
  console.log('Checking for orphaned endpoints...');
  const orphans = findOrphanEndpoints(apiCalls, apiRoutes);

  if (orphans.length === 0) {
    console.log('✓ All API calls have matching routes!');
  } else {
    console.log(`✗ Found ${orphans.length} orphaned endpoint(s):\n`);

    orphans.forEach(orphan => {
      console.log(`  ${orphan.call.method} ${orphan.call.endpoint}`);
      console.log(`    Called from: ${orphan.call.sourceFile}:${orphan.call.lineNumber}`);
      console.log(`    Expected at one of:`);
      orphan.searchedLocations.slice(0, 2).forEach(loc => {
        console.log(`      - ${loc}`);
      });
      console.log('');
    });
  }

  // 4. Show statistics
  const grouped = groupByEndpoint(apiCalls);
  console.log('\nAPI Call Statistics:');
  console.log(`Total unique endpoints: ${grouped.size}`);

  console.log('\nMost called endpoints:');
  Array.from(grouped.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .forEach(([endpoint, calls]) => {
      console.log(`  ${endpoint}: ${calls.length} call(s)`);
    });
}

analyzeApiIntegration().catch(console.error);
```

## Use Cases

### 1. Pre-deployment Checks

Add a script to your CI/CD pipeline to catch orphaned endpoints:

```json
{
  "scripts": {
    "check-api-integration": "tsx scripts/check-api-integration.ts"
  }
}
```

### 2. API Documentation

Generate documentation showing which endpoints are actually used:

```typescript
const calls = await scanDirectoryForApiCalls('./src');
const grouped = groupByEndpoint(calls);

grouped.forEach((calls, endpoint) => {
  console.log(`\n## ${endpoint}`);
  console.log(`Called ${calls.length} time(s) from:`);
  calls.forEach(call => {
    console.log(`- ${call.sourceFile} (${call.method})`);
  });
});
```

### 3. Refactoring Assistant

Find all places that call a specific endpoint before refactoring:

```typescript
import { filterByEndpoint } from '@tyroneross/interface-built-right';

const calls = await scanDirectoryForApiCalls('./src');
const userCalls = filterByEndpoint(calls, '/api/users*');

console.log('Files to update:');
userCalls.forEach(call => {
  console.log(`${call.sourceFile}:${call.lineNumber}`);
});
```

## Route Discovery Patterns

### Next.js App Router

File structure:
```
app/
  api/
    users/
      route.ts          → /api/users
      [id]/
        route.ts        → /api/users/[id]
    posts/
      [slug]/
        comments/
          route.ts      → /api/posts/[slug]/comments
```

Route file:
```typescript
// app/api/users/route.ts
export async function GET(request: Request) { /* ... */ }
export async function POST(request: Request) { /* ... */ }
```

### Next.js Pages Router

File structure:
```
pages/
  api/
    users.ts            → /api/users
    users/
      [id].ts           → /api/users/[id]
    posts/
      [slug]/
        comments.ts     → /api/posts/[slug]/comments
```

Route file:
```typescript
// pages/api/users.ts
export default function handler(req, res) {
  if (req.method === 'GET') { /* ... */ }
  if (req.method === 'POST') { /* ... */ }
}
```

## Limitations

- Only detects static imports (not dynamic imports)
- Template literals are marked as dynamic but pattern is extracted
- Doesn't analyze runtime-computed URLs
- Only supports Next.js file structures currently

## Future Enhancements

- Express.js route discovery
- OpenAPI/Swagger schema generation
- API versioning support
- Request/response type inference
