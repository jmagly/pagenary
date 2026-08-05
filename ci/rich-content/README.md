# Rich-content qualification image

This image executes real LaTeXML and PlantUML adapters against the committed
corpus and compiles the optional Tectonic PDF sibling from an immutable,
build-warmed cache. It is intentionally separate
from ordinary publisher builds: external renderers are local, pinned, and run
inside a disposable non-root container.

```sh
docker build -f ci/rich-content/Dockerfile -t pagenary-rich-content:2026-08-05 .
docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,mode=1777,size=256m \
  --tmpfs /home/renderer/.cache/fontconfig:rw,nosuid,nodev,mode=0700,uid=10001,gid=10001,size=16m \
  --cpus 2 --memory 2g --pids-limit 512 \
  -v "$PWD:/workspace:ro" \
  pagenary-rich-content:2026-08-05
```

Pinned inputs:

- Ubuntu 24.04 image digest `sha256:561618e…c538ea`
- Node 20.20.2 image digest `sha256:8f693e…c9ba5`
- LaTeXML `0.8.8-1`
- PlantUML MIT JAR `1.2026.4`, SHA-256 `08588d…a00ff`
- Tectonic `0.16.9` musl binary, SHA-256 `60b13a…a4a902`

Recorded upstream licenses for the renderer stack are LaTeXML public domain
(with LPPL/GPL packaging components), PlantUML MIT, Tectonic MIT, Graphviz
EPL-1.0 (plus the component notices in its distribution), and Latin Modern
fonts under the GUST Font License/LPPL 1.3c-or-later. The Ubuntu package
copyright files remain installed in the image under `/usr/share/doc`.

The runtime command disables networking, mounts the repository read-only,
provides only a bounded temporary filesystem, and limits CPU, memory, and PIDs.
The fixture source is copied into the temporary filesystem before conversion.
