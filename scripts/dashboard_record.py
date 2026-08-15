#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Append-only event record for dashboards that capture actions (DB301-DB306).

The dashboard HTML is disposable; this record is canonical. State is never stored
in a rendered page — it is replayed from events on demand.

Why one file per writer (DB302): sync systems move files, they do not merge them.
iCloud/Dropbox resolve a concurrent edit by picking a winner or writing a conflict
copy, and git conflicts on any mutable document. If no two writers ever append to
the same file, there is nothing to resolve under any sync system. The writer id is
minted locally on first use, so a new machine, person, or agent needs no
registration and no roster - that is the whole of the "machine should not matter"
requirement.

Stdlib only. No network.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

__version__ = "0.1.0"

RECORD_DIRNAME = "record"
WRITER_ID_PATH = Path(".dashboard") / "writer-id"
EVENT_SCHEMA = "ibr.dashboard.event/v1"

# DB303. `set` carries an arbitrary field/value; the rest are conveniences over it.
OPS = ("check", "uncheck", "set", "note", "decide", "defer")

# Ops that assert a value for a field, in replay precedence terms. `note` is
# additive (many notes coexist) and never overwrites a field.
_FIELD_OPS = {"check", "uncheck", "set", "decide", "defer"}


class RecordError(Exception):
    """Operator-facing failure: bad scope, bad op, or an unreadable segment."""


def utc_now() -> str:
    """ISO-8601 UTC to whole seconds. Stable across platforms."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def writer_id(home: Path | None = None) -> str:
    """This writer's id, minted on first use and cached (DB302).

    No registration, no central roster: the id is local state. A fresh machine or
    a new person gets a fresh id and therefore a fresh segment, which is exactly
    why concurrent writers never collide.
    """
    base = Path(home) if home else Path.home()
    path = base / WRITER_ID_PATH
    try:
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    except FileNotFoundError:
        pass
    except OSError as exc:  # unreadable cache is not fatal; mint an ephemeral id
        print(f"dashboard_record: cannot read {path}: {exc}", file=sys.stderr)
        return f"w_{uuid.uuid4().hex[:12]}"
    minted = f"w_{uuid.uuid4().hex[:12]}"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(minted + "\n", encoding="utf-8")
    except OSError as exc:
        print(f"dashboard_record: cannot persist writer id: {exc}", file=sys.stderr)
    return minted


def segment_path(scope: Path, writer: str) -> Path:
    return Path(scope) / RECORD_DIRNAME / f"events-{writer}.jsonl"


def segments(scope: Path) -> list[Path]:
    d = Path(scope) / RECORD_DIRNAME
    if not d.is_dir():
        return []
    return sorted(p for p in d.glob("events-*.jsonl") if p.is_file())


def append(
    scope: Path,
    entity_id: str,
    op: str,
    *,
    field: str | None = None,
    value: Any = None,
    note: str | None = None,
    evidence: str | None = None,
    actor: str | None = None,
    scope_id: str | None = None,
    writer: str | None = None,
    ts: str | None = None,
) -> dict[str, Any]:
    """Append one event to this writer's segment and return it (DB301)."""
    if op not in OPS:
        raise RecordError(f"unknown op {op!r}; expected one of {', '.join(OPS)}")
    if not entity_id:
        raise RecordError("entity_id is required: an event must name what it acted on")

    w = writer or writer_id()
    if op == "check":
        field, value = field or "done", True if value is None else value
    elif op == "uncheck":
        field, value = field or "done", False if value is None else value
    elif op in ("decide", "defer"):
        field = field or op
        value = op if value is None else value
    elif op == "set" and not field:
        raise RecordError("op 'set' requires --field")

    event = {
        "schema": EVENT_SCHEMA,
        "event_id": f"ev_{uuid.uuid4().hex[:16]}",
        "ts": ts or utc_now(),
        "writer": w,
        "actor": actor,
        # DB201: the scope travels on every event so an aggregate view can keep
        # projects separate without consulting anything outside the record.
        "scope_id": scope_id or Path(scope).resolve().name,
        "entity_id": entity_id,
        "op": op,
        "field": field,
        "value": value,
        "note": note,
        "evidence": evidence,
    }

    path = segment_path(scope, w)
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(event, ensure_ascii=False, sort_keys=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
        fh.flush()
        os.fsync(fh.fileno())
    return event


def read_events(scope: Path) -> tuple[list[dict[str, Any]], list[str]]:
    """Every event across every segment, plus one warning per unreadable line.

    A malformed line is skipped and reported, never dropped silently and never
    fatal: the file stays append-only and repairable, and one bad line from one
    writer must not blind the view to every other writer's work.
    """
    events: list[dict[str, Any]] = []
    warnings: list[str] = []
    for seg in segments(scope):
        try:
            text = seg.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            warnings.append(f"{seg.name}: unreadable ({exc})")
            continue
        for n, raw in enumerate(text.splitlines(), start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError as exc:
                warnings.append(f"{seg.name}:{n}: malformed JSON ({exc.msg})")
                continue
            if not isinstance(obj, dict) or "entity_id" not in obj or "op" not in obj:
                warnings.append(f"{seg.name}:{n}: not an event (missing entity_id/op)")
                continue
            events.append(obj)
    return events, warnings


def _order_key(e: dict[str, Any]) -> tuple[str, str, str]:
    # DB304: (ts, writer) totally orders concurrent events. event_id breaks the
    # remaining tie so replay is deterministic even at identical timestamps.
    return (str(e.get("ts") or ""), str(e.get("writer") or ""), str(e.get("event_id") or ""))


def replay(scope: Path) -> dict[str, Any]:
    """Derive current state from every segment (DB304).

    Deterministic: same events in any file order produce the same result.
    """
    events, warnings = read_events(scope)
    seen: set[str] = set()
    ordered: list[dict[str, Any]] = []
    for e in sorted(events, key=_order_key):
        eid = e.get("event_id")
        if eid:
            if eid in seen:  # duplicate delivery is a non-event, not a conflict
                continue
            seen.add(eid)
        ordered.append(e)

    entities: dict[str, dict[str, Any]] = {}
    for e in ordered:
        ent = entities.setdefault(
            str(e["entity_id"]),
            {"entity_id": str(e["entity_id"]), "scope_id": e.get("scope_id"),
             "fields": {}, "notes": [], "last_ts": None, "last_writer": None},
        )
        op = e.get("op")
        if op == "note":
            if e.get("note"):
                ent["notes"].append(
                    {"ts": e.get("ts"), "writer": e.get("writer"),
                     "actor": e.get("actor"), "note": e["note"],
                     "evidence": e.get("evidence")}
                )
        elif op in _FIELD_OPS and e.get("field"):
            # last-write-wins per (entity_id, field)
            ent["fields"][str(e["field"])] = {
                "value": e.get("value"), "ts": e.get("ts"),
                "writer": e.get("writer"), "actor": e.get("actor"),
                "evidence": e.get("evidence"),
            }
        ent["last_ts"] = e.get("ts")
        ent["last_writer"] = e.get("writer")

    writers = sorted({str(e.get("writer")) for e in ordered if e.get("writer")})
    return {
        "schema": "ibr.dashboard.state/v1",
        "scope_id": Path(scope).resolve().name,
        "record_hash": record_hash(scope),
        "as_of": utc_now(),
        "event_count": len(ordered),
        "writer_count": len(writers),
        "writers": writers,
        "entities": [entities[k] for k in sorted(entities)],
        "warnings": warnings,
    }


def record_hash(scope: Path) -> str:
    """Content hash of the record, order-independent across segments (DB305).

    Hashing sorted per-segment digests means two machines that hold the same
    events agree on the hash regardless of which files sync first.
    """
    digests = []
    for seg in segments(scope):
        try:
            digests.append(hashlib.sha256(seg.read_bytes()).hexdigest())
        except OSError:
            continue
    h = hashlib.sha256()
    for d in sorted(digests):
        h.update(d.encode("ascii"))
    return "sha256:" + h.hexdigest()


def aggregate(scopes: Iterable[Path]) -> dict[str, Any]:
    """Replay several scopes side by side (DB202).

    Scopes are kept separate on purpose. This returns a list of per-scope states,
    never one merged entity list — merging is what destroys the ownership that
    makes a multi-project dashboard actionable.
    """
    states = [replay(Path(s)) for s in scopes]
    return {
        "schema": "ibr.dashboard.aggregate/v1",
        "as_of": utc_now(),
        "scope_count": len(states),
        "scopes": states,
        "warnings": [f"{s['scope_id']}: {w}" for s in states for w in s["warnings"]],
    }


def materialize(state: dict[str, Any], out_dir: Path, var: str = "DASHBOARD_DATA") -> list[Path]:
    """Write `data.json` + `data.js` so a page can read state with no server (DB401).

    Two files, one truth, written together in the same call so they cannot drift:

    * `data.json` — canonical. What agents, scripts, and `fetch()` over http read.
    * `data.js`   — the identical object as `window.<var> = {...};`. A `file://` page
      cannot `fetch()` (origin restriction, measured), but it can always load a
      script tag. This is what makes a double-clicked dashboard work offline.

    Regenerating these is deterministic and costs no model tokens; the HTML shell
    is never touched to change a number.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True)
    json_path = out / "data.json"
    js_path = out / "data.js"
    json_path.write_text(payload + "\n", encoding="utf-8")
    # `</script>` inside data would close the host page's tag early; JSON escaping
    # of the forward slash is valid JSON and neutralises it.
    js_path.write_text(
        f"window.{var} = " + payload.replace("</", "<\\/") + ";\n", encoding="utf-8"
    )
    return [json_path, js_path]


def _emit(obj: Any, as_json: bool) -> None:
    if as_json:
        print(json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True))
        return
    if obj.get("schema") == "ibr.dashboard.state/v1":
        print(f"scope {obj['scope_id']} · {obj['event_count']} events "
              f"· {obj['writer_count']} writer(s) · {obj['record_hash'][:23]}…")
        for ent in obj["entities"]:
            fields = " ".join(f"{k}={v['value']}" for k, v in sorted(ent["fields"].items()))
            notes = f" · {len(ent['notes'])} note(s)" if ent["notes"] else ""
            print(f"  {ent['entity_id']:<24} {fields}{notes}")
    else:
        print(json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True))
    for w in obj.get("warnings", []):
        print(f"  warning: {w}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="dashboard_record",
        description="Append-only dashboard event record (DB301-DB306).",
    )
    p.add_argument("--version", action="version", version=f"dashboard_record {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("append", help="append one event to this writer's segment")
    a.add_argument("--scope", required=True, help="scope directory (holds record/)")
    a.add_argument("--entity", required=True, help="entity id the action applies to")
    a.add_argument("--op", required=True, choices=OPS)
    a.add_argument("--field")
    a.add_argument("--value", help="JSON literal if parseable, else a string")
    a.add_argument("--note")
    a.add_argument("--evidence")
    a.add_argument("--actor")
    a.add_argument("--scope-id")
    a.add_argument("--json", action="store_true")

    r = sub.add_parser("replay", help="derive current state from every segment")
    r.add_argument("--scope", required=True)
    r.add_argument("--out", help="also write data.json + data.js here (DB401)")
    r.add_argument("--var", default="DASHBOARD_DATA", help="global name in data.js")
    r.add_argument("--json", action="store_true")

    g = sub.add_parser("aggregate", help="replay several scopes, kept separate")
    g.add_argument("--scope", required=True, action="append",
                   help="repeat per scope directory")
    g.add_argument("--out", help="also write data.json + data.js here (DB401)")
    g.add_argument("--var", default="DASHBOARD_DATA")
    g.add_argument("--json", action="store_true")

    w = sub.add_parser("whoami", help="print this writer's id")
    w.add_argument("--json", action="store_true")

    args = p.parse_args(argv)

    try:
        if args.cmd == "whoami":
            wid = writer_id()
            print(json.dumps({"writer": wid}) if args.json else wid)
            return 0
        if args.cmd == "append":
            value: Any = args.value
            if args.value is not None:
                try:
                    value = json.loads(args.value)
                except json.JSONDecodeError:
                    value = args.value
            ev = append(
                Path(args.scope), args.entity, args.op,
                field=args.field, value=value, note=args.note,
                evidence=args.evidence, actor=args.actor, scope_id=args.scope_id,
            )
            if args.json:
                print(json.dumps(ev, indent=2, ensure_ascii=False, sort_keys=True))
            else:
                print(f"appended {ev['op']} {ev['entity_id']} → "
                      f"{segment_path(Path(args.scope), ev['writer']).name}")
            return 0
        if args.cmd in ("replay", "aggregate"):
            state = (
                replay(Path(args.scope))
                if args.cmd == "replay"
                else aggregate([Path(s) for s in args.scope])
            )
            if args.out:
                written = materialize(state, Path(args.out), var=args.var)
                if not args.json:
                    print("wrote " + " ".join(p.name for p in written) + f" → {args.out}")
            _emit(state, args.json)
            return 0
    except RecordError as exc:
        print(f"dashboard_record: {exc}", file=sys.stderr)
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
