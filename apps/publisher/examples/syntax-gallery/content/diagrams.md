---
title: Diagrams
summary: Offline Mermaid runtime rendering and bounded local PlantUML build rendering.
---

# Diagrams

Every diagram has a human-readable title and retains its source as fallback text.
The gallery uses the pinned local Mermaid runtime and never calls a rendering CDN.

## Mermaid families

### Mermaid flowchart

```mermaid title="Flowchart: publishing path"
flowchart LR
  Source --> Publisher
  Publisher --> StaticSite[Static site]
```

### Mermaid sequence

```mermaid title="Sequence: local build"
sequenceDiagram
  Author->>Pagenary: Build source
  Pagenary-->>Author: Static output
```

### Mermaid class

```mermaid title="Class diagram: page renderer"
classDiagram
  Page --> Renderer
  class Page
  class Renderer
```

### Mermaid state

```mermaid title="State diagram: publication lifecycle"
stateDiagram-v2
  [*] --> Draft
  Draft --> Published
  Published --> [*]
```

### Mermaid ER

```mermaid title="Entity relationship: pages and assets"
erDiagram
  PAGE ||--o{ ASSET : owns
```

## PlantUML families

PlantUML is optional local software. With this gallery's `warn` policy, a machine
without it preserves source and reports the unavailable renderer without a network
request. The examples below cover every qualified family.

### PlantUML sequence

```plantuml title="Sequence: bounded local renderer"
@startuml
Author -> Pagenary: fenced diagram
Pagenary -> PlantUML: bounded local process
PlantUML --> Pagenary: SVG
@enduml
```

### PlantUML class

```plantuml title="Class diagram: content pipeline"
@startuml
class Page
class Renderer
Page --> Renderer
@enduml
```

### PlantUML component

```plantuml title="Component diagram: static publishing"
@startuml
component Publisher
database Index
Publisher --> Index
@enduml
```

### PlantUML activity

```plantuml title="Activity diagram: build stages"
@startuml
start
:Parse content;
:Render page;
stop
@enduml
```

### PlantUML state

```plantuml title="State diagram: document lifecycle"
@startuml
[*] --> Draft
Draft --> Published
Published --> [*]
@enduml
```

### PlantUML ER

```plantuml title="Entity relationship: local assets"
@startuml
entity Page { * id : string }
entity Asset { * path : string }
Page ||--o{ Asset
@enduml
```

### PlantUML JSON

```plantuml title="JSON data diagram"
@startjson
{"page":{"title":"Qualified","published":true}}
@endjson
```

### PlantUML YAML

```plantuml title="YAML data diagram"
@startyaml
page:
  title: Qualified
  published: true
@endyaml
```

### puml alias and omitted wrapper

The shorter fence name is equivalent. For UML-family source, omitted
`@startuml`/`@enduml` wrappers are synthesized safely:

```puml title="Alias: synthesized UML wrapper"
Publisher -> Output: static assets
```

## Bounds and fallback

Mermaid source is limited to 50,000 bytes and 500 estimated edges; build SVG is
bounded to 1 MiB by default. PlantUML applies configured source, include-count,
include-byte, SVG, and optional PNG limits. `warn` emits escaped source with a
diagnostic, `strict` fails the build, and `off` omits failed output. Generated SVG
is sanitized and content-addressed before publication.
