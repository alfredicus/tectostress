# Workflows: specification (draft v0.1)

Status: **v0.3**. Recommendations of v0.1 and engine decisions (§10) approved. Implemented: phase 1, phase 2 except Google Drive (§11), control blocks (§12). Proposals in §11–§12 await review.

Every statement carries one of three tags:

| Tag | Meaning |
|---|---|
| **[SKETCH]** | Shown explicitly by the hand-drawn design (`tmp/IMG_2803.jpeg`) |
| **[DECIDED]** | Decided in discussion |
| **[PROPOSAL]** | New recommendation, to be confirmed or corrected |

---

## 1. Purpose

Let users build, run, inspect, save and share scientific analyses as graphs of blocks, and ship
predefined analyses as templates. A workflow orchestrates existing TectoStress functions: data
files, the stress inversion and the visualizations. It must not contain its own copy of any
scientific algorithm. **[DECIDED]**

A workflow is also a **record of how a result was obtained**: which data, which parameters, which
operations and which software versions. **[DECIDED]**

## 2. What the sketch establishes

- A workflow is a graph. One **Data** block feeds several independent branches. **[SKETCH]**
- Operations can be chained and repeated, e.g. Inversion → Filter → Inversion. **[SKETCH]**
- One result can feed several blocks (Inversion → Wulff, Histo, Summary). **[SKETCH]**
- Several blocks can be grouped into a new named block ("MyVisu 1", "Create bloc (made of blocs)"). **[SKETCH]**
- A block has its own parameters, e.g. Filter A: *Threshold* (slider) and *Active* (checkbox). **[SKETCH]**
- Block list: Data (+ Google Drive), Inversion, Filter, Create bloc, Script (filter), Load, Save,
  Generate PDF, Aggregate, and more to come. **[SKETCH]**
- The workflow editor is a panel docked below the main TectoStress view. **[SKETCH]**

The sketch does **not** establish:
- What an arrow carries.
- What Filter A or Filter B filter on.
- What "Active" does when unticked.
- Whether "MyVisu 1" groups views or operations.
- The direction of the arrow between Add Tags and MyVisu 1 in branch 2.

These were settled in review. See §9.

## 3. Decisions already taken

- Connections carry **typed payloads**. **[DECIDED]**
- Execution is **explicit**: the user presses Run. Nothing recomputes automatically. **[DECIDED]**
- First version: a **Workflow tab** next to Data / Field / Run, without replacing them. The docked
  bottom panel comes later. **[DECIDED]**
- Editor library: **React Flow** (`@xyflow/react`). **[DECIDED]**

---

## 4. Core model

### 4.1 Graph

- Directed acyclic graph (DAG). The editor refuses connections that would create a cycle. **[DECIDED]**
- Each input port accepts **one** connection unless it is declared multi-input (e.g. Aggregate,
  Dashboard). An output port can feed any number of inputs. **[DECIDED]**

### 4.2 What an arrow carries

An arrow carries a **value**: an immutable result produced by the upstream block during the last
run. It never carries a reference to a live view, a user selection or a "current state". **[DECIDED]**

Payload types:

| Type | Content | Notes |
|---|---|---|
| `Dataset` | A list of `DataFile` (same shape as the Data tab). Each row keeps an `_origin` = `{ fileId, rowIndex }`. | `_origin` keeps rows traceable through filters and merges. |
| `InversionResult` | A `Dataset` whose rows are enriched with `predicted_normal` / `predicted_striation` / `misfit_angle`, plus `stressAxes` and the `StressSolution`. | **Is a** `Dataset`, so it can go anywhere a `Dataset` is accepted. |
| `Report` | A generated document (PDF, HTML, …) plus its provenance. | Output of Generate report only. |

All types are **[DECIDED]**.

Connection rule: an output of type `A` may connect to an input of type `B` only if `A` is `B` or a
subtype of `B`. This is enforced in the editor with React Flow's `isValidConnection`, and checked
again before running. **[DECIDED]**

A `Selection` type (rows picked by the user in a plot) is **not** in v1. **[DECIDED]**

### 4.3 Block roles

Every block has exactly one role. **[DECIDED]**

| Role | Does | Inputs → outputs | Examples |
|---|---|---|---|
| **Source** | Brings data into the graph | none → `Dataset` | Data |
| **Computation** | Produces a new scientific value | payloads → payloads | Filter, Inversion, Add Tags, Aggregate, Script |
| **View** | Displays its input. Never changes it and never triggers a computation. | payloads → **none** | Stereonet, Histogram, Mohr, Sphere, Rose, Summary, Dashboard |
| **Report** | Exports or documents results | tagged items → `Report` | Generate report |

Views are **leaves**: they have no outputs. Grouping or restyling views therefore can never cause
an inversion to re-run. **[DECIDED]**

### 4.4 Parameters: scientific and presentation

Every parameter is declared as one of two kinds. **[DECIDED]**

- **Scientific**, e.g. inversion method, misfit threshold, filtered data type. Changing one marks
  the block and everything downstream as **stale**. They only take effect at the next Run.
- **Presentation**, e.g. colours, projection (Wulff / Schmidt), contour levels, titles. These apply
  immediately and never make anything stale. Only View blocks have them.

### 4.5 Inactive ("Active" unticked)

The default is safe: an inactive block **stops its branch**. It produces nothing, and every block
downstream is shown as *blocked*, never fed an old or bypassed value. **[DECIDED]**

A block type may explicitly allow **bypass** (its input is passed through unchanged). This is only
possible when its input type equals its output type, and it is clearly marked on the node. **[DECIDED]**

| Block | Inactive behaviour |
|---|---|
| Filter, Misfit filter | **Bypass** (input passed through) |
| Add Tags | **Bypass** (input passed through, nothing tagged) |
| Inversion | Stops the branch. Never bypassable. |
| Aggregate, Script | Stops the branch |
| View, Dashboard | Not rendered |
| Generate report | Not generated |

### 4.6 Execution

- **Run**: runs every stale block in dependency order. **Run to here**: runs only what the
  selected block needs. **[DECIDED]**
- Block states: `idle` (never run), `stale`, `running`, `done`, `error`, `blocked` (an upstream
  block failed, is inactive in stop mode, or is stale). **[DECIDED]**
- An `error` blocks everything downstream. Downstream blocks are never fed the result of a previous
  successful run. **[DECIDED]**
- Results are cached **in memory** per block. The cache key is the block type and version, its
  scientific parameters and its input hashes. Changing Filter B does not re-run the first inversion.
  **[DECIDED]**
- A running workflow can be cancelled. Each block reports its progress, starting with the
  inversion. **[DECIDED]**

### 4.7 Provenance

Every value produced by a block carries a provenance record: **[DECIDED]**

```ts
{ blockId, blockType, blockVersion, scientificParams,
  inputs: [provenance ids of the input values],
  sourceFiles: [{ id, name, rowCount, contentHash }],   // for Source blocks
  stressLibVersion, appVersion, startedAt, durationMs }
```

It is shown in the block inspector and embedded in every generated report, so a report can always
be traced back to its data and parameters.

### 4.8 Persistence and versioning

- A saved workflow is a JSON file: `{ schemaVersion, name, description, nodes, edges }`. Each node
  stores `{ id, type, typeVersion, active, scientificParams, presentationParams, position }`.
  **[DECIDED]**
- Results are **not** saved in v1. Reloading a workflow and pressing Run reproduces them. **[DECIDED]**
- Data blocks store file **references** (name and content hash), not the data itself. On load, a
  missing or changed file is flagged, not silently replaced. **[DECIDED]**
- Migrations are keyed on `schemaVersion` and each block's `typeVersion`. **[DECIDED]**
- **Predefined workflows** are bundled JSON files in this same format, opened as editable copies.
  **[DECIDED]**
- The sketch's **Load / Save** are editor commands on workflows, not blocks in the graph.
  **[DECIDED]**

### 4.9 Dashboards and composite blocks: two separate features

The sketch's "MyVisu 1" can mean two different things. Each gets its own feature. **[DECIDED]**

| | **Dashboard** | **Composite block** |
|---|---|---|
| What it is | Several views of the same input(s), laid out together | A saved sub-graph that is reused as one block |
| Role | View (a leaf) | Whatever its exposed ports make it |
| Computes anything? | No | Yes, it runs its inner blocks |
| Example | Stereonet + Histogram + Summary + Sphere of one inversion | Misfit filter → Inversion, reused in several workflows |
| Phase | 1 | 2 |

My reading of the sketch: Wulff + Histo + Summary + Sphere → "MyVisu 1" is a **Dashboard**.
**[DECIDED]**

### 4.10 Tags: keeping results for a report

A **tag** marks a value (a data set or a result) to **keep in memory for a potential report**
(PDF, HTML or another format). It does not change the data. **[DECIDED]**

- **Add Tags** takes any payload and passes it through unchanged, so tagging can sit at the end of
  a branch or in the middle. After each run, it records the value under its tag in the workflow's
  **tagged items**: `{ tag, note, value, provenance }`. **[PROPOSAL]**
- Tagged items are listed in a **Tagged items** panel of the Workflow tab. Each entry shows its tag,
  type, size and provenance. **[PROPOSAL]**
- **Generate report** does not need a wire from every branch. It collects the tagged items, either
  all of them or those with the selected tags, and renders each one according to its type: **[PROPOSAL]**
  - `Dataset`: a table and summary statistics.
  - `InversionResult`: a summary plus default figures (stereonet, misfit histogram).
- A tagged item reflects its **last successful run**. If its branch becomes stale, blocked or
  errored, the item is marked as such and the report warns about it instead of silently using it.
  **[PROPOSAL]**
- Tagged items live in memory and are not saved with the workflow, consistent with §4.8. They are
  rebuilt by Run. **[PROPOSAL]**

---

## 5. Block catalogue

"Sci." = scientific parameters. "Pres." = presentation parameters.

| Block | Role | In → Out | Sci. params | Pres. params | Inactive | Phase |
|---|---|---|---|---|---|---|
| **Data** | Source | none → `Dataset` | Files picked from the Data tab | none | Stops | 1 |
| **Filter** (generic; e.g. the sketch's Filter A) | Computation | `Dataset` → `Dataset` | Data types to keep; optional column condition (e.g. `dip > 30`) | none | Bypass | 1 |
| **Misfit filter** (e.g. the sketch's Filter B) | Computation | `InversionResult` → `Dataset` **kept** + `Dataset` **rejected** | Threshold (°); keep `misfit_angle ≤ threshold` | none | Bypass (everything goes to *kept*) | 1 |
| **Inversion** | Computation | `Dataset` → `InversionResult` | Same as the Run tab: method + its parameters, misfit criterion | none | Stops | 1 |
| **Add Tags** | Computation | any payload → same payload | Tag name, optional note. Keeps the value for a report (§4.10). | none | Bypass, nothing tagged | 1 |
| **Stereonet / Histogram / Mohr / Sphere / Rose** | View | `Dataset` or `InversionResult` → none | none | The existing visualization settings | Hidden | 1 |
| **Summary** | View | `InversionResult` → none | none | Fields shown | Hidden | 1 |
| **Dashboard** | View | several inputs → none | none | Which views, layout | Hidden | 1 |
| **Aggregate** | Computation | N × `Dataset` → `Dataset` | Merge mode (concatenate; drop rows with the same `_origin`) | none | Stops | 2 |
| **Generate report** | Report | tagged items → `Report` | Tags to include | Format (PDF, HTML, …), sections, title | Not generated | 2 |
| **Composite** | Its ports | Its ports | Exposed inner parameters | none | Stops | 2 |
| **Data from Google Drive** | Source | none → `Dataset` | Drive file | none | Stops | 2 |
| **Script (filter)** | Computation | `Dataset` → `Dataset` | A user function `row => boolean` (keep / drop), sandboxed | none | Bypass | 3 |

All rows are **[DECIDED]**.

Filter A and Filter B in the sketch are **examples**. *Filter* and *Misfit filter* are the first two
filter blocks; more can be added the same way. **[DECIDED]**

The Misfit filter's two outputs are deliberate. *rejected* → a view lets the user check what was
discarded, and → Add Tags `outlier` keeps it for the report, instead of it just disappearing. **[DECIDED]**

The Script block's contract is limited to **filtering rows** in v1, as "Script (filter)" in the
sketch suggests. More general scripting waits for a concrete scientific need. **[DECIDED]**

---

## 6. Architecture

Three layers. The editor only orchestrates; scientific code stays where it is. **[DECIDED]**

```
Workflow editor     (React Flow canvas, palette, inspector, results pane)
        │  workflow JSON + "Run"
Execution engine    (validation, order, states, cache, provenance; plain TS, no React)
        │  calls
TectoStress science (DataFile, inversion service, visualization components)
```

Mapping to the existing code:

- **Inversion**: today it lives inside `RunComponent.tsx`: `startSimulation`, plus the enrichment
  of rows with predictions around lines 1000–1250. It must first be extracted into a service,
  `runInversion(dataset, method, params, misfitStrategy, onProgress) → InversionResult`, used by
  **both** the Run tab and the Inversion block. Prerequisite: the Run tab gives identical results
  before and after. **[DECIDED]**
- **Views**: wrap the existing visualization descriptors (from the visualization registry). They
  already consume rows enriched with `predicted_*` / `stressAxes`. **[DECIDED]**
- **Data**: the files of the Data tab (`DataFile`). **[DECIDED]**
- **Known limitation**: the inversion runs on the main thread, so a workflow with several
  inversions freezes the UI while it runs. The service is designed so it can move to a Web Worker
  later. **[DECIDED]**

## 7. Smallest version that validates the architecture

Target workflow, run end to end: **[DECIDED]**

```
Data ──► Inversion ──► Misfit filter ──kept──► Inversion ──► Dashboard (Stereonet + Histogram + Summary)
                              └──rejected──► Add Tags "outlier" ──► Stereonet
```

In phase 1, tagged items appear in the Tagged items panel. Generate report comes in phase 2.

Order:
1. Extract the inversion service. Check that the Run tab is unchanged.
2. Engine: block model, payload types, validation, execution, states, cache, provenance, with unit
   tests on the target workflow (no UI).
3. Workflow tab: React Flow canvas, palette, inspector (generated from parameter declarations),
   Run, block states, results pane for views.
4. Save / Load JSON, and the target workflow shipped as the first predefined template.

Then phase 2: Composite blocks, Aggregate, Generate report, Google Drive. Phase 3: Script, docked
bottom panel, Web Worker.

## 8. Out of scope for v1

Cycles and iterative loops, a `Selection` type (picking rows in a plot), general scripting, saving
results inside workflow files, a third-party plugin system, running automatically on change.
**[DECIDED]**

---

## 9. Decisions

### 9.1 Settled in review of v0.1

| # | Question | Decision |
|---|---|---|
| 1 | Is "MyVisu 1" a dashboard of views, a reusable sub-workflow, or both? | Both, as **two separate features** (§4.9). The sketch's MyVisu 1 is a Dashboard. |
| 2 | What do Filter A and Filter B filter on? | They are examples. Filter = data type / column condition. Misfit filter = misfit threshold after an inversion (§5). |
| 3 | Branch 2: Add Tags **←** MyVisu 1. Real or a slip of the pen? | Slip of the pen. A view has no outputs (§4.3). |
| 4 | Branch 3: MyVisu 1 → Script. What does Script receive? | Script connects to the same upstream as MyVisu 1 (the Inversion). |
| 5 | What does "Active" unticked do? | Stops the branch by default. Bypass only for Filter / Misfit filter / Add Tags (§4.5). |
| 6 | Is Add Tags meant to feed back into the Data tab? | No. A tag keeps a value in memory for a report (§4.10). An "Export to Data tab" block can come later. |
| 7 | Does the Inversion block take one input or several? | One `Dataset`. Combining sources is Aggregate's job. |
| 8 | Script language (phase 3)? | Sandboxed JS with the `row => boolean` contract. |
| 9 | Are results saved with the workflow? | No: save the graph and parameters, and reproduce by Run. |

### 9.2 Open (raised by the meaning of tags)

| # | Question | My recommendation |
|---|---|---|
| 10 | Can a **figure** be kept for the report exactly as configured (projection, contours, colours)? Views have no outputs, so they can't be wired to Add Tags. | Give every View and Dashboard an **"Include in report"** option with a tag name. The report then uses the figure as configured, not a default rendering. Views stay leaves. |
| 11 | Which report format first? | **HTML** first: easy to generate, and the existing SVG figures embed directly. PDF follows, generated from the same content. |
| 12 | The same tag name used by Add Tags in two branches? | Allowed: a tag is a group, and the report shows every item in it, each with its own provenance. |

---

## 10. Engine decisions (step 2)

Choices made while building the engine (`src/workflow/`) that the spec did not settle. All
**[DECIDED]**: approved in review.

| # | Decision | Why |
|---|---|---|
| 13 | **Filter** output has the type of its input. Filtering an `InversionResult` gives an `InversionResult` (fewer rows, same solution). | The remaining rows' predictions are still those of that solution, so views stay truthful. |
| 14 | **Misfit filter**: *kept* is a plain `Dataset` (predictions and stress axes removed), *rejected* stays an `InversionResult`. | *kept* is meant to be re-inverted; *rejected* is meant to be inspected with its predictions. |
| 15 | **Misfit filter**: data the inversion could not predict are kept by default (parameter "Data without prediction": keep / reject). | They have no misfit to compare with the threshold. The choice is made visible instead of being implicit. |
| 16 | The **Inversion** block ignores fields written by an earlier inversion (`predicted_*`, `misfit_*`, stress axes) in its input. | An inversion is always computed from measurements only, whatever is wired into it. |
| 17 | **Add Tags** passes its input through unchanged, with its provenance. It is never cached, and renaming a tag never makes anything stale. | A tag is report metadata, not a computation. |
| 18 | A **Data** block whose file content changed since it was chosen fails with "has changed… select it again". A file with the same name and content but a new id (a new session) is accepted. | §4.8: a changed file is flagged, never silently used. |
| 19 | Extra block state **inactive** (switched off), shown as *bypassed* when it passes its input through. | Distinguishes "switched off" from "blocked". |
| 20 | **Planning** (dry run): the editor can ask which blocks are up to date without computing anything (cache hits = up to date). | Shows stale blocks right after a parameter edit, before Run. |
| 21 | The cache keeps the **100** most recently used results in memory. | Bounds memory: an inversion result holds the library's data and engine objects. |
| 22 | Each row carries `_origin = { fileId, rowIndex }` from the Data block on, and inversion results add `misfit_category` to each row. | Traceability through filters; the misfit histogram survives filtering. |

Known limitation: the misfit category comes from the stress library's class names, which are
mangled in the installed (minified) build. The histogram groups currently show names like `qi`.
This bug predates the workflow work and also affects the Run tab.

---

## 11. Phase 2 plan

Status: Aggregate, Generate report and Composite blocks implemented as described below (still
**[PROPOSAL]** until reviewed). Google Drive not started.

Order: Aggregate → Generate report → Composite blocks. Google Drive needs a Google Cloud project
(OAuth client id) owned by the TectoStress team, so it waits for that. **[PROPOSAL]**

### 11.1 Aggregate
- Several `Dataset` inputs (in connection order) → one `Dataset`. **[PROPOSAL]**
- Rows of the same Data-tab file are merged into one file (same id), because predictions and views
  identify rows by file id and position. **[PROPOSAL]**
- Mode: *concatenate* (keep everything), or *unique* (drop a row already received from another
  input, compared by `_origin`). **[PROPOSAL]**
- The output is plain data: inversion fields are removed, since the inputs may come from different
  inversions. Inactive: stops its branch (as in §4.5). **[PROPOSAL]**

### 11.2 Generate report
- No input wire: it collects the tagged items of the run (all, or only the listed tags) and runs
  after every other block. **[PROPOSAL]**
- The engine produces a **report document** (title, items, warnings, provenance chain of each
  item). The Workflow tab turns it into **HTML** with figures (#11 recommendation), offered for
  download and for printing to **PDF** from the browser. **[PROPOSAL]**
- Each item is rendered according to its type: a `Dataset` as a table and counts; an
  `InversionResult` as a summary (stress ratio, fit, misfit, σ1/σ2/σ3 trend and plunge), a
  stereonet with predictions and stress axes, and a misfit histogram. **[PROPOSAL]**
- Outdated items are included but flagged, and listed in a warning at the top. **[PROPOSAL]**
- Each item ends with its **provenance chain**: every block from the Data files to the item, with
  its parameters and versions. **[PROPOSAL]**
- Figures use the default view settings for now: views do not save their display state yet, so
  #10 ("Include in report" on views) waits for that. **[PROPOSAL]**

### 11.3 Composite blocks
- Select several blocks on the canvas → **Group as block**, with a name. Connections that cross the
  selection become the block's inputs and outputs. **[PROPOSAL]**
- The group also outputs its final results: every inner output that no inner *processing* block
  consumes (a view inside the group does not count), so it can be connected onwards even when its
  result is only displayed inside. **[DECIDED]** (requested by the user)
- The group also gets inputs from its first blocks (requested by the user, **[DECIDED]**):
  - an inner input port fed by nothing becomes a **required** group input of that port's type
    (Dataset for an Inversion or a Filter, InversionResult for a Misfit filter);
  - an inner **Data** block gets an **optional** group input (“Instead of Data”): unconnected, the
    group reads its own data; connected, the dataset received replaces the Data block's output and
    the Data block is left out. Optional inputs are drawn hollow.
- A composite block appears in the palette under **My blocks** (kept in the browser), and is
  embedded in every workflow file that uses it, so files stay self-contained. **[PROPOSAL]**
- Its inspector shows the parameters of every inner block, grouped by inner block. **[PROPOSAL]**
- At run time the engine expands it into its inner blocks, so cache, provenance and states work as
  for ordinary blocks; the composite shows the worst state of its inner blocks. **[PROPOSAL]**
- **Ungroup** puts the inner blocks back on the canvas. **[PROPOSAL]**
- Views may go inside a group: selecting the group shows its inner views (dashboards included),
  and its panel lets you choose what they display. Report blocks may not, since a report covers
  the whole workflow. **[DECIDED]** (option 1, chosen by the user)
- Not in this phase: composites containing composites, editing a composite's inner graph in place.

---

## 12. Control blocks: ForLoop, ExitLoop, Conditional

Requested by the user. This lifts the "no loops" limit of §8, without cycles in the graph.
**[DECIDED]**: a ForLoop *repeats until exit* (no "for each value" mode).

### 12.1 ForLoop: a container, like a group
- Select the blocks to repeat → **Make a loop**. The selection becomes a loop block, like a group
  (§11.3), so the graph on the canvas stays acyclic. **[PROPOSAL]**
- **Carried value**: the loop's first input (e.g. the Dataset entering an Inversion) is fed, at each
  iteration, with the value the previous iteration produced on the chosen **carried output** (e.g.
  the Misfit filter's *kept*). Its type must fit the input's type. **[PROPOSAL]**
- The loop stops when an ExitLoop inside asks for it, or after **Maximum iterations** (parameter,
  default 10). Its outputs are those of the **last** iteration. **[PROPOSAL]**
- Every iteration goes through the normal engine: cached, with provenance chaining the iterations,
  so the lineage of the result shows each one. **[PROPOSAL]**
- The loop's result shows a table of the iterations (data count, misfit, stress ratio, why it
  stopped), then its inner views and outputs as for a group. **[PROPOSAL]**
- **Collected output**: optionally, one inner output is gathered over **all** iterations into a
  single dataset, each row with an `iteration` column. Tags placed inside the loop are kept for every
  iteration, each marked with its iteration number. **[PROPOSAL]**
- The loop also stops, cleanly, when the carried value has no data left. **[PROPOSAL]**
- Not supported: loops inside loops or groups, groups inside loops. **[PROPOSAL]**

**Reference use case: separating tectonic phases** (the user's goal: write algorithms on the data).
Body: Inversion → Misfit filter → (*kept* → Inversion = solution of the phase → Add Tags "phase");
the *rejected* data are carried to the next iteration; ExitLoop stops when too few data are left.
The collected output gives every datum with its phase number; the report lists each phase with its
solution. Shipped as a predefined workflow. **[PROPOSAL]**

### 12.2 Conditions (ExitLoop and Conditional)
A condition is *quantity · comparison · value*, evaluated on the block's input. **[PROPOSAL]**

| Quantity | Applies to |
|---|---|
| Number of data | any data |
| Misfit (° for the angle criterion), fit (%), stress ratio | inversion results |
| Change of stress ratio since the previous iteration | inside a loop |
| Rotation of σ1/σ3 since the previous iteration (°) | inside a loop |
| Iteration number | inside a loop |

The "since the previous iteration" quantities are false on the first iteration.

### 12.3 ExitLoop
- One input (any value), no output; condition parameters. Inside a ForLoop, when its condition holds,
  the loop stops after the current iteration. Outside a loop it has no effect (warning). **[PROPOSAL]**
- Typical use: on the Misfit filter's *rejected* output, "number of data = 0": stop when nothing more
  is rejected. **[PROPOSAL]**

### 12.4 Conditional
- One input, two outputs **then** / **else** of the input's type; the input goes to one of them,
  unchanged. **[PROPOSAL]**
- Blocks on the branch not taken are **skipped** (new state, grey), not blocked: it is a normal
  outcome. A block with several inputs (Aggregate, Dashboard) uses the branches that produced
  something, so both branches can be merged again. **[PROPOSAL]**
- Like Add Tags, ExitLoop and Conditional hand values over unchanged: never cached, and they are
  evaluated even when only checking what is out of date. **[PROPOSAL]**
