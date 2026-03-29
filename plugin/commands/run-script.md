---
name: ibr:run-script
description: Execute a Python test script with sandboxed CPU and memory limits
arguments:
  - name: script
    description: Path to the Python script to run
    required: true
---

# ibr:run-script

Execute a Python test script in a sandboxed environment with resource limits (CPU seconds, memory). The script runs in an isolated temp directory. Exit code matches the script's exit code.

## Usage

```bash
# Basic execution
npx ibr run-script tests/e2e.py

# Pass URL to the script as IBR_URL environment variable
npx ibr run-script tests/e2e.py --url http://localhost:3000

# Custom timeout (milliseconds)
npx ibr run-script tests/e2e.py --timeout 30000

# JSON output
npx ibr run-script tests/e2e.py --url http://localhost:3000 --json
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | Passed to script as `IBR_URL` env var | none |
| `--timeout <ms>` | Max wall-clock time in milliseconds | `60000` |
| `--memory <mb>` | Memory limit in MB (advisory on macOS, enforced on Linux) | `512` |
| `--cpu <seconds>` | CPU time limit in seconds | `30` |
| `--json` | Output full result as JSON | false |

## Environment Variables Available to Script

| Variable | Value |
|----------|-------|
| `IBR_URL` | URL passed via `--url` |
| `IBR_SESSION_DIR` | Temp directory (writable, cleaned up after run) |

## Script Requirements

The script is a standard Python 3 file. To return structured data, print JSON to stdout:

```python
import os, json

url = os.environ.get('IBR_URL', 'http://localhost:3000')

# Your test logic here
result = {
  "passed": True,
  "url": url,
  "checks": ["home page loaded", "nav visible"]
}

print(json.dumps(result))
```

## Output

```
[PASS] exit=0 duration=1420ms
stdout:
{"passed": true, "url": "http://localhost:3000", "checks": ["home page loaded"]}
```

## JSON Output Shape

```json
{
  "exitCode": 0,
  "stdout": "{\"passed\": true}",
  "stderr": "",
  "output": { "passed": true },
  "duration": 1420,
  "timedOut": false
}
```

The `output` field is the parsed JSON from stdout if valid, otherwise `null`.

## Resource Limits

| Limit | Default | Platform |
|-------|---------|----------|
| Wall-clock timeout | 60s | macOS + Linux |
| CPU time | 30s | macOS + Linux |
| Memory (virtual address space) | 512MB | Linux only (advisory on macOS) |

On timeout, the process group is killed with `SIGKILL` and `timedOut: true` is set.
