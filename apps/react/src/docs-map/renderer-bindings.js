import { useCallback } from 'react';
import { labelFor, sectionIdFromNode } from './graph-data.js';

export function routeFromNode(nodeId) {
  const sectionId = sectionIdFromNode(nodeId);
  return sectionId === 'index' ? '#overview' : `#${sectionId}`;
}

function navigateHash(hash) {
  window.location.hash = hash;
}

export function useRendererBindings(labels, navigate = navigateHash) {
  const graphLabelFor = useCallback((id) => labelFor(id, labels), [labels]);
  const openNode = useCallback((id) => {
    navigate(routeFromNode(id));
  }, [navigate]);
  return { graphLabelFor, openNode };
}
