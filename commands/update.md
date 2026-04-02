---
description: Update IBR to the latest version
---

# IBR Update

Update Interface Built Right to the latest published version.

## Check Current Version

```bash
npx ibr --version
```

## Check for Updates

```bash
npm view @tyroneross/interface-built-right version
```

## Update to Latest

```bash
npm install -g @tyroneross/interface-built-right@latest
```

Or if installed locally in a project:

```bash
npm install @tyroneross/interface-built-right@latest
```

## Verify Update

After updating, verify the new version:

```bash
npx ibr --version
```

## What's New

After updating, check the changelog or release notes:
- GitHub releases: https://github.com/tyroneross/interface-built-right/releases
- npm page: https://www.npmjs.com/package/@tyroneross/interface-built-right

## Troubleshooting

If you encounter issues after updating:

1. **Clear npm cache**: `npm cache clean --force`
2. **Reinstall**: `npm uninstall @tyroneross/interface-built-right && npm install @tyroneross/interface-built-right`
3. **Check node version**: IBR requires Node.js 18+
