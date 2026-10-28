# Match explorer

Choose **Explore match** beside a dataset or saved run, or **Inspect this moment**
on commentary. Opening a dataset creates a download-only run and fetches missing
files; commentary generation is optional. Open an existing generated run to keep
its commentary attached to the explorer.

## Linked inspection

Enter a GT timestamp (`mm:ss` or `hh:mm:ss`), scrub the timeline, or step through
recorded snapshots. The snapshot window bounds stay visible: sparse data is not
interpolated into invented positions. Events retain their original millisecond
timestamps. **Whole match** shows the full event stream instead of the current
window. Selecting an event seeks to its timestamp and highlights its subject and
object entities. A yellow marker shows the selected row's recorded coordinates,
even when its participants are absent from the sampled state.

Drag the map to pan, scroll to zoom, click a marker, or Shift-drag a selection.
Arrow keys pan, +/- zoom, R fits the map, and Escape clears selection. Map
selection filters the entity table through **Selected entities only** (first 500
IDs for large selections). Table selections also highlight map markers. Row
details expose every raw field. Terrain and entity markers are schematic.

The latest earlier commentary stays visible with its original timestamp and age.
Lookup covers the entire selected run, independently of feed pagination. Future,
failed, skipped and deferred control text is excluded. New runs record analysis
coverage, distinguishing pending, processing, partial, analyzed and failed
sections. Coverage for older runs is explicitly unknown. Download-only and
single-prompt comparison runs do not imply analysis of the match. Scrubbing never
starts generation. The evidence action opens the saved pipeline trace at that
commentary's own timestamp.

## Video

Load a YouTube URL/ID or select a local video. **Follow video** updates the game
cursor; jumps from data/commentary seek the player. Calibration uses
`video seconds = offset + game seconds / rate`. The four study fixtures have the
original demo's YouTube IDs and calibrations as defaults; user-saved values win.
Associations and settings are saved locally per dataset and shared across runs.
Local videos use object URLs; only the filename and calibration are saved, so
reselect the file after reopening. Selecting a new local file resets its offset
to zero. YouTube needs a network connection and permits embedding only when the
video owner allows it.

Simple offset/rate calibration cannot account for edited recordings, pauses or
speed changes. Video analysis, OCR, tracking and segmented calibration are future
work.

## Rendering and data boundaries

- luma.gl 9.4 uses WebGPU where available, with WebGL2 shaders and an adapter
  fallback. Terrain, entities and selection each use one instanced batch.
- Reusable typed buffers grow geometrically; selection updates its own buffer.
  Camera changes update uniforms and redraw without uploading all entity data.
  Terrain is uploaded once per match. Picking uses a spatial grid. GPU resources,
  animation requests, resize observers and object URLs are released on teardown.
- Queries run in a reusable local worker, separate from generation. Requests are
  serialized and the connection closes after 30 idle seconds. DuckDB filters,
  counts and pages before returning data; arbitrary client SQL is not accepted.
- Tables return at most 100 rows (30 in the UI). Spatial batches cap at 200,000
  entities and terrain at 1,000,000 cells, with visible truncation notices. Player
  filters narrow entity batches. Inactive browser snapshot caches expire after
  ten seconds. Commentary indexes are cached for at most ten inspected runs.
- Inspection blocks concurrent deletion of source files while queries run.
  `_rowId` identifies a source-file row within its dataset revision, not a global
  identity. Entity IDs link the recorded event participants to sampled entities.

## Validation

`pnpm typecheck`, `pnpm --filter @sage/local-service test`, and
`pnpm --filter sage-core test:data` cover contracts, paging, filtering, selected
entities, safe event predicates, commentary coverage/fallback, video persistence,
and the existing data pipeline. `pnpm --filter @sage/web build` checks the web
bundle. For the desktop export use `SAGE_DESKTOP_BUILD=1` before the web build,
then `node apps/desktop/scripts/build.mjs --runtime-only` from the repository root.

Manual Safari verification exercised WebGPU rendering, opening a match without
commentary, YouTube loading, local MP4 playback, video following, GT seeking, and
fallback from 10:50 GT to earlier commentary at 10:33. WebGL2 fallback and packaged
Windows playback require platform qualification; no frame-rate guarantee is
claimed from these functional checks.
