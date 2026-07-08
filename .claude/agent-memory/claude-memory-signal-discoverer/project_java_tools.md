---
name: Java tool configuration (mkgmap and splitter)
description: JAR paths, JVM heap flags, and timeout values for the splitter and mkgmap tools
type: project
---

Both splitter and mkgmap are invoked as `java -Xmx4g -jar <JAR>` with a 300-second subprocess timeout. JAR paths default to `/opt/mkgmap/mkgmap.jar` and `/opt/splitter/splitter.jar` but are overridable via `MKGMAP_JAR` and `SPLITTER_JAR` env vars.

**Why:** The 4 GB heap limit (`-Xmx4g`) is intentional — OSM tile compilation is memory-intensive and can OOM without it. The paths under `/opt/` are baked into the Docker image at build time.

**How to apply:** If adding new mkgmap flags, keep `-Xmx4g` in place. When testing outside Docker, set `MKGMAP_JAR` and `SPLITTER_JAR` to local paths. The 300s timeout is generous — if a job hangs, check the OSM tile size rather than raising the timeout.
