import { layout } from '../../../src/lib/docs-map.js';

describe('lib/docs-map.js', () => {
  test('settles graph nodes into bounded deterministic positions', () => {
    const graph = {
      nodes: [
        { id: 'docs:page:a' },
        { id: 'docs:page:b' },
        { id: 'docs:page:c' },
        { id: 'docs:page:d' }
      ],
      edges: [
        { source: 'docs:page:a', target: 'docs:page:b', weight: 3 },
        { source: 'docs:page:a', target: 'docs:page:c', weight: 2 },
        { source: 'docs:page:b', target: 'docs:page:d', weight: 1 }
      ],
      communities: [
        { id: 'guides', nodes: ['docs:page:a', 'docs:page:b'] },
        { id: 'reference', nodes: ['docs:page:c', 'docs:page:d'] }
      ]
    };

    const first = layout(graph);
    const second = layout(graph);
    expect(Array.from(first.positions.entries())).toEqual(Array.from(second.positions.entries()));
    expect(Array.from(first.radii.entries())).toEqual(Array.from(second.radii.entries()));

    for (const [id, pos] of first.positions.entries()) {
      const radius = first.radii.get(id);
      expect(radius).toBeGreaterThanOrEqual(7);
      expect(pos.x).toBeGreaterThanOrEqual(radius + 8);
      expect(pos.x).toBeLessThanOrEqual(1000 - radius - 8);
      expect(pos.y).toBeGreaterThanOrEqual(radius + 8);
      expect(pos.y).toBeLessThanOrEqual(700 - radius - 8);
    }

    expect(first.positions.get('docs:page:a')).not.toEqual({ x: 500, y: 196, community: 0 });
  });

  test('sizes highly connected nodes above leaf nodes', () => {
    const graph = {
      nodes: [
        { id: 'docs:page:hub' },
        { id: 'docs:page:leaf-a' },
        { id: 'docs:page:leaf-b' }
      ],
      edges: [
        { source: 'docs:page:hub', target: 'docs:page:leaf-a', weight: 4 },
        { source: 'docs:page:hub', target: 'docs:page:leaf-b', weight: 4 }
      ],
      communities: [{ id: 'all', nodes: ['docs:page:hub', 'docs:page:leaf-a', 'docs:page:leaf-b'] }]
    };

    const { radii } = layout(graph);
    expect(radii.get('docs:page:hub')).toBeGreaterThan(radii.get('docs:page:leaf-a'));
    expect(radii.get('docs:page:hub')).toBeGreaterThan(radii.get('docs:page:leaf-b'));
  });
});
