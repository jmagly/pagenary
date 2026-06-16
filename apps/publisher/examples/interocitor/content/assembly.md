# Assembly

Every interocitor ships as a component kit. Assembly is deliberate, sequential,
and unforgiving of skipped steps — the array tells you immediately when something
is out of tolerance.

## Bill of materials

| Qty | Component | Notes |
| --- | --- | --- |
| 3 | Focal emitter | Matched set; do not mix lots |
| 1 | Reference oscillator | The heart of the phase lock |
| 1 | Triad mount | Equilateral, pre-lapped |
| 1 | Containment ring | Defines the exclusion zone |
| 1 | Control plate | Where you actually work |

## Sequence

1. **Seat the mount.** Level it to within an arc-minute. The triad geometry is
   only as good as the bench it sits on.
2. **Install the reference oscillator.** Let it warm for a full thermal cycle
   before you trust its phase.
3. **Mount the three emitters.** Torque to spec, in a star pattern, in one pass.
4. **Fit the containment ring.** No power flows until the ring reports closed.
5. **Connect the control plate** and proceed to [Calibration](#calibration).

> Never energize an array with the containment ring removed. The interlock exists
> because someone, once, learned why.
