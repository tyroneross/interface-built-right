---
description: Build UI from an uploaded reference image or extracted HTML. Use when user has uploaded a design mockup and wants Claude to recreate it in code.
---

# /ibr:replicate

Replicate a reference design into working code.

## When to Use

Use this command when:
- User has uploaded a reference image via IBR web UI
- User wants to recreate a design from a mockup
- User mentions "replicate", "recreate", "build from image", or similar

## Workflow

### Step 1: List Reference Sessions

```bash
npx ibr list --format json | grep -A 20 '"type": "reference"'
```

Or check the `.ibr/sessions/` directory for sessions with `type: "reference"` in their `session.json`.

### Step 2: Get Session Details

If there are multiple reference sessions, ask the user which one to replicate.

Then read the session metadata:

```bash
cat .ibr/sessions/<session-id>/session.json
```

### Step 3: Analyze the Reference

For **image uploads**, read the reference image:
- Path: `.ibr/sessions/<session-id>/reference.png`
- Use Claude's vision to analyze layout, colors, spacing, components

For **URL extractions**, you have richer data:
- `reference.png` — Screenshot
- `reference.html` — Full HTML content
- `reference.json` — Extracted elements with computed styles, CSS variables

Read the extraction data for detailed styling:
```bash
cat .ibr/sessions/<session-id>/reference.json
```

### Step 4: Check Metadata

The session's `referenceMetadata` contains hints:
- `framework` — Target framework (React, Vue, etc.) or auto-detect from `package.json`
- `componentLibrary` — UI library (Tailwind, shadcn, MUI)
- `targetPath` — Where to create the component
- `notes` — Additional context from user

If `framework` or `componentLibrary` are empty, detect from:
```bash
cat package.json | grep -E '"react"|"vue"|"svelte"|"tailwindcss"|"@mui"'
```

### Step 5: Build the Component

Create the UI component following:
1. Use the detected/specified framework
2. Match visual design from reference image
3. Apply extracted styles (colors, spacing, typography) if available
4. Follow existing code patterns in the project
5. Create at the `targetPath` if specified

### Step 6: Verify (Optional)

After building, optionally compare the result:

1. Start a dev server if not running
2. Capture the built component:
   ```bash
   npx ibr start http://localhost:<port>/<route> --name "replicate-verify"
   ```
3. Compare visually or use IBR comparison

## Example Session

```
User: "Replicate the header design I uploaded"

Claude:
1. Lists reference sessions → finds sess_abc123 "Header Design"
2. Reads reference image at .ibr/sessions/sess_abc123/reference.png
3. Sees metadata: framework=React, componentLibrary=Tailwind, targetPath=src/components/Header.tsx
4. Analyzes image: sees nav bar with logo, menu items, CTA button
5. Creates Header.tsx matching the design
6. Reports: "Created Header component at src/components/Header.tsx based on your reference design"
```

## Tips for Better Replication

1. **Extracted HTML is gold**: If the reference came from a URL, use the extracted HTML and CSS as a starting point
2. **Check CSS variables**: The `cssVariables` in `reference.json` contain design tokens (colors, spacing)
3. **Element bounds matter**: The `elements` array shows exact positions and dimensions
4. **Iterate if needed**: Visual replication often requires 2-3 iterations to match perfectly

## Error Handling

- If no reference sessions exist: Tell the user to upload a reference via IBR web UI first
- If extraction failed: Check `.ibr/sessions/<id>/` for partial data or error logs
- If framework not detected: Ask the user to specify
