# Calibration

Calibration is where an assembled kit becomes a working interocitor. You are
tuning three carriers until they agree on a single focus.

## Pre-flight

- Reference oscillator through a full thermal cycle.
- Containment ring reporting **closed**.
- Bench level confirmed since the last move.

## The focal sweep

1. Bring the reference oscillator to lock. Wait for the steady tone.
2. Energize emitter **A** alone and note the carrier null.
3. Add **B**, then **C**, adjusting each until the fringe pattern resolves to a
   point rather than a line.
4. Walk the triad in small, symmetric steps. The aperture should brighten and
   stabilize, not flicker.

## Acceptance

You are calibrated when:

- Phase error across the triad is under 2&nbsp;milliradians.
- The aperture holds focus for a full minute untouched.
- A loopback test returns your own carrier cleanly.

Record the settling time. If it climbs above 400&nbsp;ms on a known-good range,
recheck the mount before you blame the band.
