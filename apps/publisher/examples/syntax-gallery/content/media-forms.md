---
title: Media and forms
summary: Images, audio, video, privacy-gated hosted media, and hosted forms.
media:
  providers: [youtube, vimeo, peertube]
---

# Media and forms

## Responsive image and viewport

```media
type: image
src: assets/syntax-diagram.svg
portrait: assets/syntax-diagram.svg
landscape: assets/syntax-diagram.svg
alt: Blue and violet nodes connected as a syntax diagram
label: Syntax diagram viewer
caption: One local asset exercises responsive picture and accessible viewport markup.
description: Three labeled nodes represent source syntax, the publisher, and offline output.
zoom: true
width: 1200
height: 675
```

The same definition can be written as JSON:

```media
{"type":"image","src":"assets/syntax-diagram.svg","alt":"Compact JSON media example"}
```

## Native audio and video

```media
type: audio
src: data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=
title: Silent local audio fixture
caption: A zero-duration local WAV proves native audio markup without a network request.
transcript: assets/silent-transcript.txt
```

```media
type: video
src: assets/syntax-diagram.svg
poster: assets/syntax-diagram.svg
title: Native video markup example
caption: Replace the illustrative source with a local MP4 or WebM and add captions in production.
captions: assets/syntax-diagram.en.vtt
captionsLang: en
description: The poster shows source syntax flowing through Pagenary into an offline site.
```

## Privacy-gated hosted media

```media
type: youtube
id: dQw4w9WgXcQ
title: Hosted video example
caption: The iframe is not loaded until the reader activates it.
```

## Hosted form

```tally
id: example
mode: popup
button: Open example form
title: Example feedback form
```

Hosted media and forms are the two intentionally network-dependent features. Their static fallback links
remain usable without JavaScript; operators must permit the documented provider hosts in CSP.
