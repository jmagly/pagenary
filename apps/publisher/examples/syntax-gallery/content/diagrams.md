---
title: Diagrams
summary: Offline Mermaid runtime rendering and bounded local PlantUML build rendering.
---

# Diagrams

## Mermaid

```mermaid title="Request flow"
flowchart LR
  Browser --> Publisher
  Publisher --> StaticSite[Static site]
```

Mermaid uses the pinned local browser bundle in the default runtime mode; it does not call a CDN.

## PlantUML

```plantuml title="Local renderer flow"
@startuml
Author -> Pagenary: fenced diagram
Pagenary -> PlantUML: bounded local process
PlantUML --> Pagenary: SVG
@enduml
```

PlantUML is optional software. With this gallery's `warn` policy, a machine without it preserves the
source and reports the missing renderer instead of making a network request.

The shorter fence name is an equivalent alias:

```puml
@startuml
Publisher -> Output: static assets
@enduml
```
