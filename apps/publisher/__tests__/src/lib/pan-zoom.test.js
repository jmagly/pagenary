import { clampViewportScale } from '../../../src/lib/pan-zoom.js';

describe('shared pan/zoom scale bounds (#159)', () => {
  it('clamps zoom to the documented 50–300 percent range', () => {
    expect(clampViewportScale(-1)).toBe(0.5);
    expect(clampViewportScale(0.75)).toBe(0.75);
    expect(clampViewportScale(4)).toBe(3);
  });
});
