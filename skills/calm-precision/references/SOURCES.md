# Calm Precision — Sources

Every principle in `SKILL.md` names a theory. This file carries the citation behind
each name, so a rule can be checked against its origin rather than taken on trust.

Anchors `[S1]`–`[S14]` map 1:1 to the 14 principles. `[T…]` are the standards and
craft sources the rules quantify against.

**Verified 2026-08-28** by HTTP check plus publisher cross-reference.

- **HTTP 200 on check:** Wertheimer (psychclassics.yorku.ca), NN/g, W3C WCAG 2.2,
  Apple HIG, A List Apart, Grice PDF (sfu.ca), jnd.org, archive.org, duarte.com.
- **HTTP 403 to an automated client, page is live:** all three `doi.org` links and
  `edwardtufte.com`. Publishers bot-block; the DOIs were confirmed against the
  publishers' own listings — Taylor & Francis for Hick, Wiley for Sweller, and the
  APA record for Fitts. A 403 here means "blocked", not "dead".

Re-verify before citing externally — link rot is the expected failure mode.

## How to read the tiers

| Tier | Meaning |
|---|---|
| **T1** | Primary source — the original paper, book, or normative standard. |
| **T2** | Authoritative practitioner source — recognised expert or standards body, not peer-reviewed. |
| **COINED** | **No external source exists.** The term was coined or borrowed for Calm Precision. Named honestly so nobody hunts for a citation that was never there. |

---

## Principle → source map

### [S1] Group, Don't Isolate — *Gestalt*
**T1** — Wertheimer, M. (1923). "Untersuchungen zur Lehre von der Gestalt II."
*Psychologische Forschung*, 4, 301–350. Translated as "Laws of organization in
perceptual forms" in Ellis, W. (1938), *A source book of Gestalt psychology*,
pp. 71–88. Routledge & Kegan Paul.
<https://psychclassics.yorku.ca/Wertheimer/Forms/forms.htm>

Proximity, similarity, closure, and simplicity are the grouping laws the rule
"single border around related; dividers between" implements.

### [S2] Size = Importance — *Fitts*
**T1** — Fitts, P. M. (1954). "The information capacity of the human motor system in
controlling the amplitude of movement." *Journal of Experimental Psychology*, 47(6),
381–391. DOI: [10.1037/h0055392](https://doi.org/10.1037/h0055392)

Acquisition time falls as target size rises. This is the measured basis for
"button size = intent weight", not an aesthetic preference.

### [S3] Three-Line Hierarchy + Page-Level Cascade — *Cognitive Load + Attentional Cascade*
**T1** — Sweller, J. (1988). "Cognitive load during problem solving: Effects on
learning." *Cognitive Science*, 12(2), 257–285.
DOI: [10.1207/s15516709cog1202_4](https://doi.org/10.1207/s15516709cog1202_4)

**COINED — "Attentional Cascade."** No UI-design source exists for this term. In the
literature it names an unrelated computer-vision structure (Viola–Jones rejection
cascade) and a model of attentional blink in RSVP. The L1→L4 page cascade is a Calm
Precision construct. Sweller supports the load argument; the cascade is house
vocabulary and should not be cited as established theory.

### [S4] Progressive Disclosure — *Hick*
**T1** — Hick, W. E. (1952). "On the rate of gain of information." *Quarterly Journal
of Experimental Psychology*, 4(1), 11–26.
DOI: [10.1080/17470215208416600](https://doi.org/10.1080/17470215208416600)
**T1** — Hyman, R. (1953). "Stimulus information as a determinant of reaction time."
*Journal of Experimental Psychology*, 45(3), 188–196.
DOI: [10.1037/h0056940](https://doi.org/10.1037/h0056940)
**T2** — Nielsen, J. (2006). "Progressive Disclosure." Nielsen Norman Group.
<https://www.nngroup.com/articles/progressive-disclosure/>

Hick–Hyman gives the log relationship between choice count and decision time;
Nielsen gives the interface move that exploits it.

### [S5] Text Over Decoration — *Signal-to-Noise*
**T1** — Tufte, E. R. (2001). *The Visual Display of Quantitative Information*, 2nd
ed. Graphics Press. ISBN 9780961392147.
<https://www.edwardtufte.com/book/the-visual-display-of-quantitative-information/>

Data-ink ratio and chartjunk. "Status = text color only, no background badges" is
the data-ink rule applied to status.

### [S6] Content Over Chrome — *Information Density*
**T1** — Tufte (2001), as [S5]. The ≥70% content ratio is a house threshold, not a
Tufte number — the *direction* is his, the cutoff is ours.

### [S7] Natural Language — *Mental Models*
**T1** — Norman, D. A. (1988). *The Psychology of Everyday Things*. Basic Books.
Reissued as *The Design of Everyday Things*.
<https://jnd.org/affordances-and-design/>

### [S8] Rhythm & Alignment — *Continuity*
**T1** — Wertheimer (1923), as [S1]. Continuity/good-continuation is one of the
grouping laws in the same source.

### [S9] Functional Integrity — *Affordance + Data Integrity*
**T1** — Gibson, J. J. (1977). "The theory of affordances." In Shaw, R. E. &
Bransford, J. (Eds.), *Perceiving, Acting, and Knowing*. Lawrence Erlbaum.
**T1** — Norman (1988), as [S7]. Norman later corrected his own usage to
**perceived** affordance — what the user believes is actionable, not what is.
<https://jnd.org/affordances-and-design/>

"No fake buttons" is the perceived-affordance rule stated as a prohibition: a control
that looks actionable and is not, is a false affordance.

### [S10] Content Resilience + Error Strategy — *Fault Tolerance + Dual-Coding + Cooperative Principle*
**T1** — Paivio, A. (1986). *Mental Representations: A Dual Coding Approach*. Oxford
University Press. <https://archive.org/details/mentalrepresenta0000paiv>
**T1** — Grice, H. P. (1975). "Logic and Conversation." In Cole, P. & Morgan, J.
(Eds.), *Syntax and Semantics 3: Speech Acts*. Academic Press.
<https://www.sfu.ca/~jeffpell/Cogs300/GriceLogicConvers75.pdf>

Dual-coding is why an error carries both icon and text, never colour alone. Grice's
maxims (quantity, quality, relation, manner) are why error copy states what happened
and what to do, and stops.

### [S11] Mobile-First Structure — *Responsive Design*
**T2** — Marcotte, E. (2010). "Responsive Web Design." *A List Apart*, 25 May 2010.
<https://alistapart.com/article/responsive-web-design/>

### [S12] Purposeful Motion — *Temporal Gestalt*
**T1** — Wertheimer (1923), as [S1] — common fate, the grouping law that motion
exploits.
**COINED — "Temporal Gestalt"** as a UI term. Common fate is real Gestalt; extending
it to lift/stagger/press-in semantics is house vocabulary.

### [S13] Voice Calibration — *Pragmatic Inference*
**T1** — Grice (1975), as [S10]. Implicature: what a UI string implies beyond what it
says. Overstating certainty in copy violates the maxim of quality.

### [S14] Provenance & Authority — *Epistemic Integrity*
**COINED.** No external source. This principle is native to Calm Precision and
encodes a house rule: a surface projecting canonical state is a view, never a second
source of truth. Related in spirit to Grice's maxim of quality [S10], but the
verified-vs-asserted distinction and the saturated-chip reservation are ours.

---

## Standards the rules quantify against

### [T1] Apple Human Interface Guidelines
**T1 (normative for Apple platforms)** — Apple Inc. *Human Interface Guidelines —
Accessibility*. <https://developer.apple.com/design/human-interface-guidelines/accessibility>

Source of the **44×44 pt minimum hit target**. The 44px mobile figure in
`~/.claude/CLAUDE.md` and in `references/native-apple-platforms.md` traces here.

### [T2] WCAG 2.2
**T1 (W3C Recommendation, 5 October 2023)** — *Web Content Accessibility Guidelines
(WCAG) 2.2*. <https://www.w3.org/TR/WCAG22/>

- **1.4.3 Contrast (Minimum)** — the 4.5:1 body-text ratio.
- **2.5.8 Target Size (Minimum)** — 24×24 CSS px. Note this is **weaker** than
  Apple's 44 pt [T1]; Calm Precision follows the stricter of the two per platform.

### [T3] Nancy Duarte — presentation & data storytelling
**T2** — Duarte, N. (2008). *slide:ology: The Art and Science of Creating Great
Presentations*. O'Reilly. ISBN 9780596522346.
<https://www.duarte.com/resources/books/slideology/>
**T2** — Duarte, N. (2010). *Resonate: Present Visual Stories that Transform
Audiences*. Wiley. ISBN 9780470632017.
**T2** — Duarte, N. (2019). *DataStory: Explain Data and Inspire Action Through
Story*. Ideapress. ISBN 9781940858982.
<https://www.duarte.com/resources/books/>

Behind the deck presets in `references/type-scale.md` and the data-storytelling
sequencing in `references/data-visualization-patterns.md`.

---

## Honest accounting

Three of the fourteen principle names — **Attentional Cascade [S3]**, **Temporal
Gestalt [S12]**, and **Epistemic Integrity [S14]** — have **no external source**.
They read like established theory and are not. They are kept because the rules they
carry are useful, and labelled COINED so no one cites them as literature.

Two numbers are house thresholds, not findings: the **≥70% content ratio [S6]** and
the **L1–L4 cascade [S3]**. Treat them as conventions to hold consistently, not as
measured optima.
