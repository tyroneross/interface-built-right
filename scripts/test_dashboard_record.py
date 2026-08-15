#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Tests for the dashboard event record (DB301-DB306, DB401).

The contract these defend: several writers on several machines append to one
logical record and every one of them derives the same state, with no
coordination, no registration, and no merge step.
"""

from __future__ import annotations

import json
import random
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parent))

import dashboard_record as R  # noqa: E402


class WriterIdentity(unittest.TestCase):
    def test_writer_id_is_minted_once_and_reused(self):
        """DB302: identity is local state, so a new machine needs no registration."""
        with TemporaryDirectory() as home:
            first = R.writer_id(Path(home))
            second = R.writer_id(Path(home))
            self.assertEqual(first, second)
            self.assertTrue(first.startswith("w_"))
            self.assertTrue((Path(home) / R.WRITER_ID_PATH).is_file())

    def test_a_different_home_is_a_different_writer(self):
        with TemporaryDirectory() as a, TemporaryDirectory() as b:
            self.assertNotEqual(R.writer_id(Path(a)), R.writer_id(Path(b)))

    def test_unwritable_home_still_yields_an_id(self):
        """A read-only or missing home must not stop someone recording work."""
        with TemporaryDirectory() as home:
            blocker = Path(home) / ".dashboard"
            blocker.write_text("not a directory", encoding="utf-8")
            self.assertTrue(R.writer_id(Path(home)).startswith("w_"))


class AppendIsolation(unittest.TestCase):
    def test_each_writer_owns_one_file(self):
        """DB302: no two writers share a file, so no sync system can conflict."""
        with TemporaryDirectory() as d:
            scope = Path(d) / "proj"
            for w in ("w_laptop", "w_workmac", "w_phone"):
                R.append(scope, "t1", "check", writer=w)
            names = sorted(p.name for p in R.segments(scope))
            self.assertEqual(
                names,
                ["events-w_laptop.jsonl", "events-w_phone.jsonl", "events-w_workmac.jsonl"],
            )

    def test_append_never_rewrites_existing_lines(self):
        """DB301: append-only. Earlier bytes are untouched by later writes."""
        with TemporaryDirectory() as d:
            scope = Path(d) / "proj"
            R.append(scope, "t1", "check", writer="w_a")
            seg = R.segment_path(scope, "w_a")
            before = seg.read_bytes()
            R.append(scope, "t2", "check", writer="w_a")
            self.assertTrue(seg.read_bytes().startswith(before))

    def test_unknown_op_is_refused(self):
        with TemporaryDirectory() as d:
            with self.assertRaises(R.RecordError):
                R.append(Path(d) / "p", "t1", "promote", writer="w_a")

    def test_set_requires_a_field(self):
        with TemporaryDirectory() as d:
            with self.assertRaises(R.RecordError):
                R.append(Path(d) / "p", "t1", "set", writer="w_a")

    def test_scope_id_travels_on_every_event(self):
        """DB201: an aggregate view can separate projects from the events alone."""
        with TemporaryDirectory() as d:
            scope = Path(d) / "proj-a"
            ev = R.append(scope, "t1", "check", writer="w_a")
            self.assertEqual(ev["scope_id"], "proj-a")


class Replay(unittest.TestCase):
    def _scope(self, d: str) -> Path:
        return Path(d) / "proj"

    def test_later_event_wins_across_writers(self):
        """DB304: last-write-wins per (entity, field), by timestamp not by file."""
        with TemporaryDirectory() as d:
            s = self._scope(d)
            R.append(s, "t1", "check", writer="w_a", ts="2026-01-01T10:00:00Z")
            R.append(s, "t1", "uncheck", writer="w_b", ts="2026-01-01T11:00:00Z")
            state = R.replay(s)
            self.assertFalse(state["entities"][0]["fields"]["done"]["value"])

    def test_earlier_event_does_not_clobber_a_later_one(self):
        """A machine syncing late must not resurrect stale state."""
        with TemporaryDirectory() as d:
            s = self._scope(d)
            R.append(s, "t1", "check", writer="w_a", ts="2026-01-01T11:00:00Z")
            R.append(s, "t1", "uncheck", writer="w_late", ts="2026-01-01T09:00:00Z")
            self.assertTrue(R.replay(s)["entities"][0]["fields"]["done"]["value"])

    def test_replay_is_order_independent(self):
        """DB304: whatever order files arrive in, the state is identical."""
        with TemporaryDirectory() as d:
            s = self._scope(d)
            writers = [f"w_{i}" for i in range(5)]
            for i, w in enumerate(writers):
                R.append(s, "t1", "set", field="stage", value=i,
                         writer=w, ts=f"2026-01-01T1{i}:00:00Z")
            baseline = R.replay(s)["entities"]

            # Shuffle the bytes across files; the events are the same set.
            lines = []
            for seg in R.segments(s):
                lines.extend(seg.read_text().splitlines())
                seg.unlink()
            random.shuffle(lines)
            for n, line in enumerate(lines):
                p = s / R.RECORD_DIRNAME / f"events-w_shuf{n}.jsonl"
                p.write_text(line + "\n", encoding="utf-8")

            self.assertEqual(R.replay(s)["entities"], baseline)
            self.assertEqual(baseline[0]["fields"]["stage"]["value"], 4)

    def test_same_timestamp_resolves_deterministically(self):
        """Clock skew must not make the view flap between machines."""
        with TemporaryDirectory() as d:
            s = self._scope(d)
            for w in ("w_b", "w_a", "w_c"):
                R.append(s, "t1", "set", field="owner", value=w,
                         writer=w, ts="2026-01-01T10:00:00Z")
            first = R.replay(s)["entities"][0]["fields"]["owner"]["value"]
            self.assertEqual(first, R.replay(s)["entities"][0]["fields"]["owner"]["value"])
            self.assertEqual(first, "w_c")  # highest writer id breaks the tie

    def test_duplicate_event_id_is_ignored(self):
        """A file copied twice by a sync client is a non-event, not a conflict."""
        with TemporaryDirectory() as d:
            s = self._scope(d)
            R.append(s, "t1", "note", note="hello", writer="w_a")
            seg = R.segment_path(s, "w_a")
            dupe = s / R.RECORD_DIRNAME / "events-w_a-copy.jsonl"
            dupe.write_text(seg.read_text(), encoding="utf-8")
            state = R.replay(s)
            self.assertEqual(state["event_count"], 1)
            self.assertEqual(len(state["entities"][0]["notes"]), 1)

    def test_malformed_line_warns_and_the_rest_survives(self):
        """One writer's bad line must not blind the view to everyone else's work."""
        with TemporaryDirectory() as d:
            s = self._scope(d)
            R.append(s, "t1", "check", writer="w_good")
            bad = s / R.RECORD_DIRNAME / "events-w_bad.jsonl"
            bad.write_text('{"not":"an event"}\nnot json at all\n', encoding="utf-8")
            state = R.replay(s)
            self.assertEqual(len(state["entities"]), 1)
            self.assertEqual(len(state["warnings"]), 2)

    def test_notes_accumulate_and_never_overwrite(self):
        with TemporaryDirectory() as d:
            s = self._scope(d)
            R.append(s, "t1", "note", note="one", writer="w_a", ts="2026-01-01T10:00:00Z")
            R.append(s, "t1", "note", note="two", writer="w_b", ts="2026-01-01T11:00:00Z")
            notes = R.replay(s)["entities"][0]["notes"]
            self.assertEqual([n["note"] for n in notes], ["one", "two"])

    def test_record_hash_is_order_independent_but_content_sensitive(self):
        """DB305: two machines holding the same events agree on the hash."""
        with TemporaryDirectory() as d:
            s = self._scope(d)
            R.append(s, "t1", "check", writer="w_a", ts="2026-01-01T10:00:00Z")
            R.append(s, "t2", "check", writer="w_b", ts="2026-01-01T11:00:00Z")
            h1 = R.record_hash(s)
            self.assertEqual(h1, R.record_hash(s))
            R.append(s, "t3", "check", writer="w_c", ts="2026-01-01T12:00:00Z")
            self.assertNotEqual(h1, R.record_hash(s))

    def test_empty_scope_replays_to_empty_state(self):
        with TemporaryDirectory() as d:
            state = R.replay(Path(d) / "nothing-here")
            self.assertEqual(state["event_count"], 0)
            self.assertEqual(state["entities"], [])


class Aggregate(unittest.TestCase):
    def test_scopes_stay_separate(self):
        """DB202: aggregate replays side by side; it never merges entity lists."""
        with TemporaryDirectory() as d:
            a, b = Path(d) / "proj-a", Path(d) / "proj-b"
            R.append(a, "t1", "check", writer="w_a")
            R.append(b, "t1", "check", writer="w_a")
            agg = R.aggregate([a, b])
            self.assertEqual(agg["scope_count"], 2)
            self.assertEqual([s["scope_id"] for s in agg["scopes"]], ["proj-a", "proj-b"])
            # Same entity id in both scopes must remain two distinct rows.
            for scope in agg["scopes"]:
                self.assertEqual(len(scope["entities"]), 1)


class Materialize(unittest.TestCase):
    def test_writes_both_files_with_identical_payload(self):
        """DB401: data.json for tools, data.js for a file:// page. One truth."""
        with TemporaryDirectory() as d:
            s = Path(d) / "proj"
            R.append(s, "t1", "check", writer="w_a")
            out = Path(d) / "out"
            R.materialize(R.replay(s), out)

            from_json = json.loads((out / "data.json").read_text())
            js = (out / "data.js").read_text()
            self.assertTrue(js.startswith("window.DASHBOARD_DATA = "))
            from_js = json.loads(js[len("window.DASHBOARD_DATA = "):].rstrip().rstrip(";"))
            self.assertEqual(from_json, from_js)

    def test_script_close_tag_in_data_cannot_break_the_page(self):
        """A note containing </script> would otherwise end the host page's tag."""
        with TemporaryDirectory() as d:
            s = Path(d) / "proj"
            R.append(s, "t1", "note", note="danger </script><script>x=1</script>", writer="w_a")
            out = Path(d) / "out"
            R.materialize(R.replay(s), out)
            js = (out / "data.js").read_text()
            self.assertNotIn("</script>", js)
            self.assertIn("<\\/script>", js)

    def test_custom_global_name(self):
        with TemporaryDirectory() as d:
            s = Path(d) / "proj"
            R.append(s, "t1", "check", writer="w_a")
            out = Path(d) / "out"
            R.materialize(R.replay(s), out, var="MY_DATA")
            self.assertTrue((out / "data.js").read_text().startswith("window.MY_DATA = "))


if __name__ == "__main__":
    unittest.main(verbosity=2)
