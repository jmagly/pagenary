# How It Works

The interocitor relays across the **Metaluna band** by triangulating three focal
emitters against a shared reference phase. Get the geometry right and the channel
holds; get it wrong and you spend an afternoon chasing ghosts.

## The focal triad

Three emitters sit at the vertices of an equilateral mount. Each projects a
phase-locked carrier toward a common focus a few centimetres above the plate.
Where the three carriers meet, the aperture opens.

```text
        A
       / \
      /   \
     /  •  \      • = focus / aperture
    /       \
   B ------- C
```

- **A, B, C** — focal emitters, phase-locked to the reference oscillator.
- **•** — the aperture, where the channel forms.

## Why three

Two emitters give you a line; three give you a point you can hold steady. The
third carrier is what turns a noisy interference fringe into an addressable
focus. Lose any one emitter and the aperture collapses — by design.

## Latency

Channel latency is dominated by phase-settling, not distance. A well-calibrated
triad settles in under 400&nbsp;ms regardless of range, which is the whole reason
the array exists.
