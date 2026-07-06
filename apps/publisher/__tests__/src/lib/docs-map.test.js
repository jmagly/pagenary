import { layout, layoutSize } from '../../../src/lib/docs-map.js';

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
    expect(layoutSize(graph)).toEqual({ width: 1000, height: 700 });
    expect(first.width).toBe(1000);
    expect(first.height).toBe(700);

    for (const [id, pos] of first.positions.entries()) {
      const radius = first.radii.get(id);
      expect(radius).toBeGreaterThanOrEqual(7);
      expect(pos.x).toBeGreaterThanOrEqual(radius + 8);
      expect(pos.x).toBeLessThanOrEqual(first.width - radius - 8);
      expect(pos.y).toBeGreaterThanOrEqual(radius + 8);
      expect(pos.y).toBeLessThanOrEqual(first.height - radius - 8);
    }

    expect(first.positions.get('docs:page:a')).not.toEqual({ x: 500, y: 196, community: 0 });
  });

  test('expands dense graph layouts instead of pinning nodes to the border', () => {
    const communities = Array.from({ length: 40 }, (_, communityIndex) => ({
      id: `community-${communityIndex}`,
      nodes: Array.from({ length: 10 }, (_, nodeIndex) => `docs:page:${communityIndex}-${nodeIndex}`)
    }));
    const nodes = communities.flatMap((community) => (
      community.nodes.map((id) => ({ id }))
    ));
    const edges = [];
    communities.forEach((community, communityIndex) => {
      community.nodes.forEach((nodeId, nodeIndex) => {
        edges.push({
          source: nodeId,
          target: community.nodes[(nodeIndex + 1) % community.nodes.length],
          weight: 2
        });
        edges.push({
          source: nodeId,
          target: `docs:page:${(communityIndex + 1) % communities.length}-${nodeIndex}`,
          weight: 1
        });
      });
    });
    const graph = { nodes, edges, communities };
    const result = layout(graph);

    expect(result.width).toBeGreaterThan(1000);
    expect(result.height).toBeGreaterThan(700);

    let pinned = 0;
    for (const [id, pos] of result.positions.entries()) {
      const radius = result.radii.get(id);
      const min = radius + 8;
      if (
        pos.x === min ||
        pos.y === min ||
        pos.x === Number((result.width - min).toFixed(2)) ||
        pos.y === Number((result.height - min).toFixed(2))
      ) {
        pinned += 1;
      }
    }

    expect(pinned / nodes.length).toBeLessThan(0.2);
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
