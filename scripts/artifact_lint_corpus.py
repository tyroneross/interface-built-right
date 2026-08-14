#!/usr/bin/env python3
"""artifact_lint_corpus — measure rule firing rates across a corpus of real pages.

Stdlib only. No network.

    python3 artifact_lint_corpus.py ~/dev/git-folder --glob '*/mockups/*.html'
    python3 artifact_lint_corpus.py --from-file corpus.txt --samples AD202 --json

Why this exists
---------------
`artifact_lint.py` ships every heuristic rule at `warn`/`info` because its precision
is unmeasured, and AGENTS.md forbids promoting one to `error` without measuring it
first. A policy with no tool behind it is a wish, so this is the tool.

Firing rate is not precision — it is the cheap proxy that tells you *where to look*.
A rule firing on 80% of hand-authored pages is almost certainly matching something
other than what it claims to; a rule firing on 3% is worth reading instance by
instance. Use `--samples <RULE>` to print real evidence strings and judge them.

Worked example (2026-08-13, 476 hand-authored mockups): AD202 fired on 80.7% of the
corpus. Reading the samples showed it was matching `Product — Variant` titles, which
are names, not captions. After the rule was rewritten to require a clause-linking
word it fired on 11.1%, and the survivors were genuine taglines. Same session:
AS506/AS508 were firing on bar charts, which the data-visualization skill says are
*correctly* multi-coloured; gating them on the presence of an arrow dropped them
from 44 and 43 findings to 1 each.
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path
from typing import Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artifact_lint as AL  # noqa: E402

__version__ = "1.0.0"


def collect(roots: Sequence[str], glob: str, from_file: str | None) -> list[Path]:
    paths: list[Path] = []
    if from_file:
        paths += [Path(l.strip()) for l in Path(from_file).read_text().splitlines() if l.strip()]
    for root in roots:
        p = Path(root)
        if p.is_file():
            paths.append(p)
        elif p.is_dir():
            paths += sorted(p.glob(glob))
    seen: set[Path] = set()
    out: list[Path] = []
    for p in paths:
        rp = p.resolve()
        if rp not in seen and rp.is_file():
            seen.add(rp)
            out.append(p)
    return out


def measure(paths: Sequence[Path], profile: str = "auto", sample_limit: int = 12) -> dict:
    files_fired: collections.Counter = collections.Counter()
    total: collections.Counter = collections.Counter()
    profiles: collections.Counter = collections.Counter()
    samples: dict[str, list[dict]] = collections.defaultdict(list)
    errors: list[dict] = []

    for p in paths:
        try:
            src = p.read_text(encoding="utf-8", errors="replace")
            profiles[AL.detect_profile(p, src) if profile == "auto" else profile] += 1
            findings = AL.lint(p, profile)
        except Exception as exc:  # a corpus file we cannot read is data, not a crash
            errors.append({"file": str(p), "error": f"{type(exc).__name__}: {exc}"})
            continue
        for rule in {f.rule for f in findings}:
            files_fired[rule] += 1
        for f in findings:
            total[f.rule] += 1
            if len(samples[f.rule]) < sample_limit:
                samples[f.rule].append({
                    "file": str(p), "line": f.line,
                    "message": f.message, "evidence": f.evidence,
                })

    n = len(paths) - len(errors)
    rules = []
    for r in AL.RULES:
        ff = files_fired[r.id]
        rules.append({
            "id": r.id, "title": r.title, "severity": r.severity,
            "heuristic": r.heuristic,
            "files_fired": ff,
            "firing_rate": round(ff / n, 4) if n else 0.0,
            "findings": total[r.id],
            "findings_per_firing_file": round(total[r.id] / ff, 2) if ff else 0.0,
        })
    return {
        "tool": "artifact_lint_corpus", "version": __version__,
        "corpus_size": n, "parse_errors": errors,
        "profiles": dict(profiles),
        "total_findings": sum(total.values()),
        "rules": rules, "samples": dict(samples),
    }


def print_report(data: dict, sample_rules: Sequence[str]) -> None:
    print(f"corpus={data['corpus_size']} files  profiles={data['profiles']}  "
          f"total_findings={data['total_findings']}")
    if data["parse_errors"]:
        print(f"parse errors: {len(data['parse_errors'])}")
    print()
    print(f"{'rule':7} {'sev':5} {'H':1} {'files':>6} {'rate':>7} {'finds':>6} {'per':>5}  title")
    for r in data["rules"]:
        if not r["files_fired"]:
            continue
        print(f"{r['id']:7} {r['severity']:5} {'H' if r['heuristic'] else ' ':1} "
              f"{r['files_fired']:6} {r['firing_rate'] * 100:6.1f}% {r['findings']:6} "
              f"{r['findings_per_firing_file']:5.1f}  {r['title']}")
    quiet = [r["id"] for r in data["rules"] if not r["files_fired"]]
    if quiet:
        print(f"\nnever fired ({len(quiet)}): {' '.join(quiet)}")
    print("\nFiring rate is a proxy, not precision. Read samples before acting:")
    print("  high rate on hand-authored pages -> likely matching the wrong thing")
    print("  low rate -> read instances one by one and judge each")

    for rid in sample_rules:
        print(f"\n=== samples: {rid} ===")
        for s in data["samples"].get(rid, []):
            short = s["file"].split("/")[-1]
            print(f"  {short[:44]:44} L{s['line']:<5} {s['message'][:70]}")
            if s["evidence"]:
                print(f"      ev: {s['evidence'][:88]}")


def main(argv: Sequence[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="artifact_lint_corpus",
        description="Measure artifact_lint rule firing rates across a corpus.")
    p.add_argument("roots", nargs="*", help="files or directories to scan")
    p.add_argument("--glob", default="**/*.html", help="glob applied to directory roots")
    p.add_argument("--from-file", help="newline-separated list of paths")
    p.add_argument("--profile", choices=("auto",) + AL.PROFILES, default="auto")
    p.add_argument("--samples", default="", help="comma-separated rule ids to show evidence for")
    p.add_argument("--sample-limit", type=int, default=12)
    p.add_argument("--json", action="store_true")
    p.add_argument("--version", action="version", version=f"artifact_lint_corpus {__version__}")
    args = p.parse_args(argv)

    if not args.roots and not args.from_file:
        print("artifact_lint_corpus: give a root directory or --from-file", file=sys.stderr)
        return 2
    paths = collect(args.roots, args.glob, args.from_file)
    if not paths:
        print("artifact_lint_corpus: corpus is empty", file=sys.stderr)
        return 2

    data = measure(paths, args.profile, args.sample_limit)
    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print_report(data, [s.strip().upper() for s in args.samples.split(",") if s.strip()])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
