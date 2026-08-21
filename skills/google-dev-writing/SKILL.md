---
name: google-dev-writing
description: The base writing style for everything you write for a person to read — gate summaries and questions, PR bodies, issue and review comments, status posts, handovers, docs and READMEs. The whole Google developer documentation style guide, not one section of it. Apply it to every piece of prose, then apply any project-specific writing rules on top.
---

# Google developer documentation style — the base layer

Source: **[Google developer documentation style guide](https://developers.google.com/style)**.
Where this file and that guide disagree, the guide wins and this file is wrong —
fix it. The [word list](https://developers.google.com/style/word-list) is the
guide's own reference for a single term's spelling, capitalisation and usage;
this file does not restate it, so look a word up there rather than guessing.

## Precedence — read this first

The guide states its own order, and it puts project style above itself:
prioritise project-specific guidelines, then this guide, then a general
reference such as Merriam-Webster. It also says to depart from it wherever
doing so improves the content.

So, for every piece of prose:

1. **This file applies first, to everything.** It is the mechanics — tense,
   voice, person, headings, lists, numbers, code font, links, punctuation.
2. **Then the project's own writing rules apply on top, and they win.** In this
   console that is `shape-issue`'s **"How to write — every word a human reads"**
   section, which governs gate summaries, gate questions, PR bodies, drafted
   comments and everything else a round produces. It decides what a gate card
   carries and how a finding reads; this file decides how the sentence is built.
   Where the two disagree, `shape-issue` wins — the disagreements that exist
   today are listed at the end of this file, so you never have to guess which
   one is in front.
3. **Accuracy beats both.** No rule here makes a report vaguer or less true. If
   a rule and accuracy genuinely conflict, accuracy wins and you say so in one
   line.

## What this does not touch

- **Code, identifiers, file contents and command output** are quoted exactly as
  they are. If a repository has a `master` branch or a `whitelist` variable,
  that is its name — write it, and never silently rename it in prose.
- **Quoted material** — Sam's words, a reviewer's finding, a QA verdict, an
  issue body — is reproduced verbatim. Never edit somebody's quote to fit this
  guide.
- **Established external terms** with no accepted replacement are used and
  explained, not avoided into vagueness.

## Voice and tone

Sound like a knowledgeable friend who understands what the reader wants to do.
Casual, natural, approachable — not frivolous, not pedantic, not formal.

- Too informal: "Dude! This API is totally awesome!"
- Right: "This API lets you collect data about user preferences."
- Too formal: "The API may enable acquisition of information pertaining to preferences."

Do not use: buzzwords, internet slang (`tl;dr`, `ymmv`), pop-culture references,
exclamation marks, placeholder phrases ("please note", "at this time"), "let's"
in a procedure, or "simply", "easy", "just" — they tell a stuck reader the
problem is them. Drop "please" from instructions: "Click **View** to open the
document", not "Please click **View**".

Read it aloud. Choppy sentences, sentences that all start the same way, and
sentences you run out of breath in are all findable that way.

## Write for a global audience

Most readers are not reading in their first language.

- **Simpler word, shorter sentence.** `start` not `commence`; `use` not
  `utilize`; `some` not `a number of`.
- **No phrasal verbs where one verb exists.** "This document uses the following
  terms", not "makes use of".
- **No cultural specificity** — holidays, sports, seasons, currencies, idioms
  ("ballpark figure", "on the back burner"), humour. Say "November and
  December", never "winter": the seasons are inverted for half the planet.
- **Place modifiers next to what they modify.** "Request only one token", not
  "Only request one token".
- **Do not stack more than two nouns.** "The dialog for editing user
  preferences" beats "the user preference edit dialog".
- **Keep the helper words** that English lets you drop — `that`, `then`, `of`.
  "Right-click the link that you want to open" is clearer than without.
- **Expand an abbreviation on first use**, and prefer a noun to a pronoun when
  the antecedent is more than a few words back: "make sure the ad is targeted",
  not "make sure it's targeted".
- **One term, one meaning, one capitalisation** throughout a document. Do not
  use a word as both noun and verb near itself.
- **No directional language.** "In the preceding table", not "in the table
  above"; "the navigation menu", not "the panel on the right". It breaks for
  screen readers and for anything reflowed to a phone.

## Language and grammar

**Active voice.** Name who does the thing.

- ✓ "Send a query to the service. The server sends an acknowledgment."
- ✗ "The service is queried, and an acknowledgment is sent."

Passive is right in three cases: the object matters more than the actor ("The
file is saved"), you are deliberately not blaming the reader ("Over 50 conflicts
were found in the file", not "You created over 50 conflicts"), or the actor is
irrelevant ("The database was purged in January").

**Present tense.** "The server sends an acknowledgment", not "will send". Use
`will` only for something genuinely later than the step being described ("the
file is archived the next time the backup runs") or for asynchronous behaviour.
Never use hypothetical `would`.

**Second person.** Address the reader as `you`. Not "we", not "the user", not
"let's".

- ✓ "This document shows you how to develop an app for your organization."
- ✗ "This document shows the user how to develop an app for their organization."

Use the imperative for instructions — the "you" is implied. Use `we` only where
the organisation is unambiguously the author.

**Pronouns.** Every pronoun has one obvious antecedent, and a demonstrative
carries a noun: "Set this value to `true`", not "Set this to `true`". Never use
he/she or (s)he; use singular *they* when a person's pronouns are not stated. A
name is not evidence of pronouns.

**Timeless.** Write as if the reader arrived today and knows nothing of what
came before. Cut: *as of this writing, currently, does not yet, eventually,
existing, future, latest, new, now, old, presently, soon*.

- ✓ "These subcommands let you interact with HTTP load balancing."
- ✗ "These **new** subcommands…"

The exception is content that is genuinely about a moment: a release note, a
status post, a changelog, a gate summary saying what you did this round.

**No anthropomorphism.** Software does not see, know, want or think.

- ✓ "A `Delimiter` object specifies where to split a string."
- ✗ "A `Delimiter` object tells the splitter where a string should be broken."

**No excessive claims.** Avoid *best, simplest, fastest, never, always*, and use
*ensure* and *guarantee* carefully. State what a thing does, with the reason
attached: "helps prevent account takeovers from phishing attacks", not "prevents
account takeovers".

**No jargon** you can write around, and define what you keep. The guide names
`blast radius` → affected area, `ingest` → import or load, `off-the-shelf` →
ready-made, `shifting left` → moving a task earlier, `post-mortem` → review of
what worked and what did not. Any term the reader did not write themselves gets
glossed the first time it appears.

**Contractions are fine and preferred** — *you're, don't, isn't, can't*.
Negative contractions are easier to spot when scanning than a stray "not". No
three-word contractions, no nonstandard ones.

**Sentence structure: condition first, instruction second.** The reader has to
know whether a sentence applies before they read it.

| ✓ | ✗ |
|---|---|
| For more information, see [Load balancing]. | See [Load balancing] for more information. |
| To delete the entire document, click **Delete**. | Click **Delete** if you want to delete the entire document. |
| If your app is in one of these regions, custom domains might add latency. | Custom domains might add latency if your app is in one of these regions. |

**Sentences under 26 words.** Subject, verb, object, in that order, with the
subject and verb near the front.

**Paragraphs: one idea, most important sentence first.** A single-sentence
paragraph is fine. A seven-sentence paragraph is fine if all seven serve one
idea. A wall of text carrying three ideas is not.

**That vs which.** `that` introduces a restrictive clause and takes no comma;
`which` introduces a nonrestrictive one and takes a comma.

## Punctuation

- **Serial comma, always.** "zones, regions, and multi-regions".
- **Comma after an introductory phrase**, and before a coordinating conjunction
  joining two independent clauses unless both are very short.
- **Comma before `which`** in a nonrestrictive clause; none before `because`.
- **Em dash, no spaces around it** — `sentence—interruption—sentence`. Do not
  use an en dash at all; use a hyphen or the word `to` for a range.
- **No dash between a term and its description.** "Example: this is an example",
  not "Example - this is an example".
- **Do not carry meaning in punctuation** — `!`, `?`, `;` are not read aloud
  reliably.
- **Write `and`, not `&`**, outside a UI label or code.
- Punctuation goes outside link text: "see [Test your code]." not "see [Test
  your code.]"

## Abbreviations

Spell out on first use with the abbreviation in parentheses, both in italics:
*Border Gateway Protocol* (*BGP*). Capitalise the spelled-out form only if it is
a proper noun. No periods in acronyms. Never abbreviate a term that is not the
document's subject. Do not use an abbreviation as a verb — "Use SSH to log in",
not "ssh into the box". Write **that is** and **for example** instead of *i.e.*
and *e.g.*, and avoid *etc.*

`AI`, `API`, `PDF`, `HTML`, `URL`, `USB`, `RAM`, `REST`, and unit abbreviations
rarely need spelling out.

## Formatting

**Capitalisation.** Sentence case everywhere — headings, titles, table headings,
list items, captions, figure labels. No title case, and no period on a heading.
Lowercase after a colon unless a proper noun follows. Do not use capitalisation
to distinguish meaning.

**Text formatting, in one table:**

| Format | For |
|---|---|
| `code font` | filenames, paths, class/method/function names, flags, env vars, HTTP verbs and status codes, data types, IP addresses, port numbers, command output, placeholders, literal input |
| **bold** | UI element names, run-in headings, the label at the start of a notice |
| *italic* | a term being introduced or discussed as a word, titles of full works, mathematical and version variables |
| regular | domain names, product and service names, URLs meant to be opened in a browser |

Never inflect a code element or use one as a verb: "call the `close` method",
not "`Close`ing the file". Do not underline anything except a link.

**Headings.** Sentence case. A task heading starts with a bare infinitive —
"Create an instance", never "Creating an instance"; a conceptual heading is a
noun phrase. Prefix an optional section with `Optional:` rather than trailing
`(optional)`. One `h1`. Never skip a level. Never put two headings back to back
with nothing between them. No links, no sequence numbers, no bare code items in
a heading. Say "the following sections", never "this section".

**Lists.**

- **Numbered** when the order matters; **bulleted** when it does not;
  **description** for term-and-definition pairs.
- **Introduce every list with a complete sentence**, ending in a colon: "Use the
  **Submit** button for any of the following purposes:" — never a fragment the
  list items complete ("Use the **Submit** button to:").
- Capitalise each item. End with a period only if the item contains a verb; a
  bare noun, a link, or an item entirely in code font takes none.
- Parallel syntax across every item. Never a list of one. Never end with "etc."
  or "and so on".
- In a description list, capitalise the term, no period after it, period at the
  end of the description.

**Procedures.**

- Introduce with a complete sentence: "To customize the buttons, follow these
  steps:"
- One action per step. Sub-steps take lowercase letters.
- Within a step the order is: what to do, the command, what the placeholders
  mean, then the result.
- **Goal before action, location before action**: "To start a new document,
  click **File > New**", and "In Google Docs, click **File > New**" — not the
  other way round.
- A single-step procedure is a bullet, not a numbered list of one.
- Prefix an optional step with `Optional:`.
- Combine a sequence of clicks with angle brackets: "Click **Next > Finish**".
- Put the result in the same step as the action that causes it.

**Notices.** Four kinds, and use them sparingly — a page of notices reads as a
page of nothing. **Note**: useful but not needed to succeed. **Caution**: go
carefully. **Warning**: do not do this, or this cannot be undone. **Success**:
interactive content only. Never put a prerequisite, a cross-reference, or a step
the reader must follow inside a note — if they need it to succeed, it belongs in
the flow.

**Numbers.** Spell out zero through nine and any ordinal (*first*, *fifth*, not
*1st*, *5th*); use numerals for 10 and up. Always numerals for versions,
technical quantities, step numbers, page numbers and prices. Spell out a number
that starts a sentence, or rewrite the sentence. `40%`, no space. Commas every
three digits: `1,532,784 bytes`. Ranges take a hyphen, no spaces: `2012-2016`.
Dimensions use a lowercase x, no spaces: `192x192`.

**Dates and times.** `January 19, 2017` — and a comma after the year mid
sentence: "the January 19, 2017, release". `January 2017`, no comma. Numeric
dates are ISO 8601 only: `2017-04-15`, never `04/06/2017`. Times use a 12-hour
clock with a space and capitals: `3:45 PM`, `3 PM` on the hour. Name a time zone
in full with its UTC offset, not `PST`. Never a season.

**Tables.** Use one for three or more related data points per row; use a list
for anything one-dimensional. Introduce it in the sentence before it. Sentence
case headings, no trailing punctuation. Do not merge cells. Do not put a table
inside a numbered step.

**Links.** Link text says where it goes — the page title or a descriptive
phrase, never "click here", "this document", or a raw URL. Link once per
destination per page. Introduce with "For more information, see …" or "For more
information about X, see …". Say so when a link downloads a file or opens a new
tab.

**Images.** Every image has alt text describing its intent; decorative images
get an empty `alt`. Never put information only in an image — say it in text too.
No images of text or code. Prefer SVG. Refer to a control by its label, not its
appearance: "Click **Notifications**", not "Click the bell icon".

## Accessibility

- Break text up with headings, lists and paragraphs; keep sentences under 26
  words; put the key information in the opening sentence.
- Say it positively: "You can continue without a path" beats "A missing path
  won't prevent you from continuing."
- No forced line breaks inside a sentence or paragraph. Left-align.
- No camel case or all caps in prose — some readers hear each letter.
- Never let colour, size, position or an icon be the only way to know something.
- Introduce an expandable or interactive section before it: "To see the
  requirements, expand the **Requirements** section."
- Heading levels descend without gaps, and every heading has content under it.

## Inclusive language

Source: [inclusive
documentation](https://developers.google.com/style/inclusive-documentation).
The eight rules: avoid unnecessarily gendered language; avoid figurative
language; avoid ableist language; avoid graphic or violent metaphors; write
diverse and inclusive examples (varied names, genders, ages and locations, and
no US-centric references, idioms or units); write about features and users in
inclusive ways; replace or write around non-inclusive industry terms; avoid bias
and harm when discussing disability and accessibility.

| Avoid | Use |
|---|---|
| sanity-check, sanity check | final check for completeness and clarity |
| crazy, insane | baffling, surprising, unexpected |
| cripple, crippled (verb) | slow down, degrade |
| dummy variable, dummy value | placeholder |
| hang, hung (a connection) | doesn't respond, stops responding |
| hit (a button) | click, select, press |
| whitelist | allowlist |
| blacklist | denylist, blocklist |
| master (of a system, branch, node) | controller, primary, parent node |
| slave | worker, replica, secondary |
| native (feature) | built-in, integrated |
| man-hours | person-hours |
| mankind | humanity |
| the elderly, seniors, 80 years young | older adults, aging population |
| STONITH | say what it does: stop the errant node |

| Avoid | Use |
|---|---|
| normal, healthy (meaning nondisabled) | nondisabled person, sighted person, hearing person |
| the disabled, a quadriplegic | people with disabilities, quadriplegic person |
| victim of, suffering from, afflicted by | experiencing, living with, has |
| wheelchair-bound, confined to a wheelchair | uses a wheelchair |
| physically challenged, special, differently abled | disabled, or name the specific access need |

Put the person first unless the community's own preference is identity-first.
Name the specific access need rather than a euphemism.

**One deliberate carve-out: `hang` and `hung` stay out of prose, and the
replacement is precision rather than a synonym.** "The job stopped responding
after 99 minutes" beats "the job hung", and is also more useful.

## Where this and `shape-issue`'s "How to write" disagree

`shape-issue` wins on every line of this list. They are recorded so you spend no
time deciding.

- **Em dashes are spaced in this codebase** — `word — word`, not `word—word`.
  The guide says no spaces; the house has thousands of spaced ones and the house
  wins.
- **Contractions.** The guide encourages them. `shape-issue` and the console's
  own copy mostly write them out, and a gate card is read once at speed, so
  match the surface you are writing on rather than converting anything.
- **"You" means the worker in `shape-issue`, and the reader on a gate card.**
  The guide's second-person rule is about the reader. When you write a gate
  summary, the reader is Sam.
- **A gate summary is deliberately not timeless.** It reports what you did this
  round. The timeless rule applies to docs, READMEs and PR contract sections,
  not to a status report.
- **Word counts.** `shape-issue` has none anywhere, on purpose. The 26-word
  sentence line here is a smell test you apply by reading, never a counter you
  hit.

## The check

Reread your own prose once before you post it, and fix what this file names. It
is a pass over the writing, not a licence to soften a finding: "the merge is not
on `test`, so QA tested code that never had the fix" is direct, plain and
inclusive already.
