---
name: OSM-to-Garmin pipeline architecture
description: End-to-end pipeline steps, tools, and ordering for converting OSM data into a Garmin IMG file
type: project
---

The four-stage pipeline is: Overpass download → osmium (XML→PBF) → splitter JAR (tile chunks) → mkgmap JAR (gmapsupp.img).

**Why:** Each step is necessary in order. osmium converts and *sorts* by entity type+ID — splitter requires sorted PBF input and will silently produce bad tiles if not sorted. splitter outputs a `template.args` file that mkgmap prefers over raw PBF paths because it preserves tile metadata. mkgmap is invoked with `--gmapsupp` to collapse all tiles into a single IMG file.

**How to apply:** Never skip or reorder steps. When adding mkgmap flags, always verify `--gmapsupp` and `-c template.args` remain present. If splitter produces no `template.args`, mkgmap falls back to raw `.osm.pbf` glob — this is handled in `map_compiler.py:run_mkgmap`.
