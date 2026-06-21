type AiwgFortemiRecordType = 'crm.contact' | 'crm.organization' | 'crm.event' | 'crm.interaction' | 'aiwg.artifact' | 'docs.page';
type AiwgPrivacyClassification = 'private' | 'sanitized' | 'public';
type AiwgProvenanceConfidence = 'source' | 'candidate' | 'reviewed' | 'rejected';
type AiwgReviewAction = 'accept' | 'reject' | 'defer';
interface AiwgFortemiRecordSource {
    path: string;
    repo_relative_path: string;
    locator: string;
}
interface AiwgFortemiRelationship {
    type: string;
    target_id: string;
    source_path?: string;
    label?: string;
    confidence?: number;
    privacy?: AiwgPrivacyClassification;
    metadata?: Record<string, unknown>;
}
interface AiwgFortemiProvenance {
    field: string;
    source: string;
    path: string;
    confidence: AiwgProvenanceConfidence;
    privacy: AiwgPrivacyClassification;
}
type AiwgFortemiSkosRelationType = 'broader' | 'narrower' | 'related' | string;
interface AiwgFortemiSkosConcept {
    id: string;
    prefLabel: string;
    definition?: string;
    scheme?: string;
    notation?: string;
    uri?: string;
    altLabels?: string[];
    metadata?: Record<string, unknown>;
}
interface AiwgFortemiSkosRelation {
    type: AiwgFortemiSkosRelationType;
    source_id: string;
    target_id: string;
    source_path?: string;
    metadata?: Record<string, unknown>;
}
interface AiwgFortemiProvenanceEvent {
    id?: string;
    activity: string;
    agent?: string;
    started_at?: string;
    ended_at?: string;
    source?: string;
    path?: string;
    confidence?: AiwgProvenanceConfidence;
    privacy?: AiwgPrivacyClassification;
    attributes?: Record<string, unknown>;
}
interface AiwgFortemiRecord {
    schema_version: 'aiwg.fortemi.index.record.v1';
    id: string;
    type: AiwgFortemiRecordType;
    source: AiwgFortemiRecordSource;
    title: string;
    text: string;
    facets: Record<string, string[]>;
    tags: string[];
    concepts: string[];
    relationships: AiwgFortemiRelationship[];
    provenance: AiwgFortemiProvenance[];
    /** Optional rich SKOS metadata for static consumers that need labels/definitions without opening a shard. */
    skos_concepts?: AiwgFortemiSkosConcept[];
    /** Optional SKOS relationship edges among concepts referenced by this record. */
    skos_relations?: AiwgFortemiSkosRelation[];
    /** Optional W3C PROV-style activity chain for this record. */
    provenance_events?: AiwgFortemiProvenanceEvent[];
    privacy: {
        classification: AiwgPrivacyClassification;
        pii: boolean;
    };
    updated_at: string;
}
interface AiwgFortemiIndexExport {
    schema_version: 'aiwg.fortemi.index.export.v1';
    generated_at: string;
    source: {
        repo: string;
        privacy: AiwgPrivacyClassification;
    };
    items: AiwgFortemiRecord[];
}
interface AiwgFortemiChunkPartRef {
    href: string;
    offset: number;
    count: number;
}
declare const AIWG_SCAN_REQUIRED_FIELDS: Array<keyof AiwgFortemiRecord>;
type AiwgFortemiProjectedRecord = Pick<AiwgFortemiRecord, 'schema_version' | 'id' | 'type' | 'title' | 'text' | 'facets' | 'tags' | 'concepts' | 'privacy'> & Partial<AiwgFortemiRecord>;
type AiwgDetailIdEncoding = 'uri' | 'base64url';
interface AiwgFortemiChunkDetailRef {
    href: string;
    encoding?: AiwgDetailIdEncoding;
}
interface AiwgFortemiChunkManifest {
    schema_version: 'aiwg.fortemi.index.chunk-manifest.v1';
    generated_at: string;
    source: AiwgFortemiIndexExport['source'];
    total: number;
    part_size: number;
    facets?: Record<string, Record<string, number>>;
    projection?: Array<keyof AiwgFortemiRecord>;
    detail?: AiwgFortemiChunkDetailRef;
    parts: AiwgFortemiChunkPartRef[];
}
interface AiwgFortemiChunkPart {
    schema_version: 'aiwg.fortemi.index.chunk.v1';
    manifest_schema_version: 'aiwg.fortemi.index.chunk-manifest.v1';
    offset: number;
    items: AiwgFortemiRecord[];
}
interface AiwgIndexValidationResult {
    valid: boolean;
    errors: string[];
    counts: Partial<Record<AiwgFortemiRecordType, number>>;
}
interface AiwgChunkedIndexValidationResult {
    valid: boolean;
    errors: string[];
}
interface AiwgIndexQueryOptions {
    types?: AiwgFortemiRecordType[];
    facets?: Record<string, string[]>;
    tags?: string[];
    concepts?: string[];
    privacy?: AiwgPrivacyClassification[];
    relationshipTargetId?: string;
    limit?: number;
    offset?: number;
    rank?: boolean;
    snippets?: boolean;
    snippetLength?: number;
    weights?: Partial<AiwgIndexQueryWeights>;
    includeMatches?: boolean;
}
interface AiwgIndexQueryWeights {
    title: number;
    text: number;
    tag: number;
    concept: number;
}
interface AiwgIndexQueryMatch {
    field: 'title' | 'text' | 'tag' | 'concept';
    value: string;
}
interface AiwgIndexQueryRankedItem {
    item: AiwgFortemiRecord;
    rank: number;
    snippet?: string;
    matches?: AiwgIndexQueryMatch[];
}
interface AiwgIndexQueryResult {
    items: AiwgFortemiRecord[];
    total: number;
    facets: Record<string, Record<string, number>>;
    rankedItems?: AiwgIndexQueryRankedItem[];
}
type AiwgChunkedIndexLoader = (part: AiwgFortemiChunkPartRef, manifest: AiwgFortemiChunkManifest) => Promise<unknown>;
type AiwgChunkedIndexDetailLoader = (id: string, manifest: AiwgFortemiChunkManifest) => Promise<unknown>;
interface AiwgChunkedIndexLoadOptions {
    maxCachedParts?: number;
    detailLoader?: AiwgChunkedIndexDetailLoader;
    maxCachedDetails?: number;
    maxCachedMatches?: number;
}
type AiwgChunkedIndexProgressPhase = 'part' | 'query';
interface AiwgChunkedIndexProgress {
    phase: AiwgChunkedIndexProgressPhase;
    done: number;
    total: number;
    href?: string;
}
interface AiwgChunkedIndexQueryOptions extends AiwgIndexQueryOptions {
    onProgress?: (progress: AiwgChunkedIndexProgress) => void;
}
interface AiwgChunkedIndexQueryResult extends AiwgIndexQueryResult {
    manifestTotal: number;
    scannedParts: number;
    fetchedParts: number;
    complete: boolean;
}
interface AiwgReviewDecision {
    item_id: string;
    action: AiwgReviewAction;
    reason?: string;
    updated_at: string;
}
interface AiwgReviewDecisionExport {
    schema_version: 'aiwg.fortemi.review-decisions.v1';
    generated_at: string;
    source_export_schema_version: string;
    decisions: AiwgReviewDecision[];
}
interface AiwgIndexGraphOptions {
    communityFacet?: string;
    communityTagPrefix?: string;
    relationshipWeights?: Record<string, number>;
    includeDanglingRelationships?: boolean;
}
interface AiwgReviewInput {
    item_id: string;
    action: AiwgReviewAction;
    reason?: string;
}
interface AiwgIndexControllerSnapshot {
    index: AiwgFortemiIndexExport | null;
    chunked: {
        manifest: AiwgFortemiChunkManifest;
        cachedParts: number;
        maxCachedParts: number;
    } | null;
    data: AiwgIndexQueryResult | null;
    error: Error | null;
    reviewDecisions: AiwgReviewDecision[];
}
type AiwgIndexControllerListener = (snapshot: AiwgIndexControllerSnapshot) => void;
interface AiwgIndexController {
    loadIndex(value: unknown): AiwgFortemiIndexExport;
    loadChunkedIndex(manifest: unknown, loader: AiwgChunkedIndexLoader, options?: AiwgChunkedIndexLoadOptions): AiwgFortemiChunkManifest;
    getIndex(): AiwgFortemiIndexExport | null;
    getChunkedManifest(): AiwgFortemiChunkManifest | null;
    getSnapshot(): AiwgIndexControllerSnapshot;
    query(query?: string, options?: AiwgIndexQueryOptions): AiwgIndexQueryResult;
    queryChunked(query?: string, options?: AiwgChunkedIndexQueryOptions): Promise<AiwgChunkedIndexQueryResult>;
    getRecord(id: string): Promise<AiwgFortemiRecord>;
    clearChunkCache(): void;
    toCommunityGraph(options?: AiwgIndexGraphOptions): ReturnType<typeof aiwgFortemiIndexToCommunityGraph>;
    setReviewDecision(input: AiwgReviewInput): AiwgReviewDecision;
    clearReviewDecision(itemId: string): void;
    createReviewDecisionExport(generatedAt?: string): AiwgReviewDecisionExport;
    subscribe(listener: AiwgIndexControllerListener): () => void;
}
declare function validateAiwgFortemiIndexExport(value: unknown): AiwgIndexValidationResult;
declare function assertAiwgFortemiIndexExport(value: unknown): AiwgFortemiIndexExport;
declare function validateAiwgFortemiChunkManifest(value: unknown): AiwgChunkedIndexValidationResult;
declare function assertAiwgFortemiChunkManifest(value: unknown): AiwgFortemiChunkManifest;
declare function validateAiwgFortemiChunkPart(value: unknown, partRef?: AiwgFortemiChunkPartRef, manifest?: AiwgFortemiChunkManifest): AiwgChunkedIndexValidationResult;
declare function assertAiwgFortemiChunkPart(value: unknown, partRef?: AiwgFortemiChunkPartRef, manifest?: AiwgFortemiChunkManifest): AiwgFortemiChunkPart;
declare function createAiwgFetchChunkLoader(baseUrl?: string | URL): AiwgChunkedIndexLoader;
declare function encodeAiwgDetailId(id: string, encoding?: AiwgDetailIdEncoding): string;
declare function aiwgDetailHrefForId(detail: AiwgFortemiChunkDetailRef, id: string): string;
declare function createAiwgFetchDetailLoader(baseUrl?: string | URL): AiwgChunkedIndexDetailLoader;
declare function getAiwgFortemiFacets(items: AiwgFortemiRecord[]): Record<string, Record<string, number>>;
interface AiwgChunkedIndexBuildOptions {
    partSize?: number;
    projection?: Array<keyof AiwgFortemiRecord>;
    detailHref?: string;
    idEncoding?: AiwgDetailIdEncoding;
    generatedAt?: string;
}
interface AiwgChunkedIndexBuildResult {
    manifest: AiwgFortemiChunkManifest;
    parts: Array<{
        href: string;
        part: AiwgFortemiChunkPart;
    }>;
    details: Array<{
        id: string;
        href: string;
        record: AiwgFortemiRecord;
    }>;
}
declare function buildAiwgChunkedIndex(index: AiwgFortemiIndexExport, options?: AiwgChunkedIndexBuildOptions): AiwgChunkedIndexBuildResult;
declare function queryAiwgFortemiIndex(index: AiwgFortemiIndexExport, query?: string, options?: AiwgIndexQueryOptions): AiwgIndexQueryResult;
declare function createAiwgReviewDecisionExport(source: Pick<AiwgFortemiIndexExport, 'schema_version'>, decisions: AiwgReviewDecision[], generatedAt?: string): AiwgReviewDecisionExport;
declare function createAiwgIndexController(initialIndex?: AiwgFortemiIndexExport): AiwgIndexController;
declare function aiwgFortemiIndexToCommunityGraph(index: AiwgFortemiIndexExport, options?: AiwgIndexGraphOptions): {
    nodes: {
        id: string;
    }[];
    edges: {
        source: string;
        target: string;
        kind: string;
        weight: number;
    }[];
    communities: {
        id: string;
        nodes: string[];
    }[];
};

export { AIWG_SCAN_REQUIRED_FIELDS, type AiwgChunkedIndexBuildOptions, type AiwgChunkedIndexBuildResult, type AiwgChunkedIndexDetailLoader, type AiwgChunkedIndexLoadOptions, type AiwgChunkedIndexLoader, type AiwgChunkedIndexProgress, type AiwgChunkedIndexProgressPhase, type AiwgChunkedIndexQueryOptions, type AiwgChunkedIndexQueryResult, type AiwgChunkedIndexValidationResult, type AiwgDetailIdEncoding, type AiwgFortemiChunkDetailRef, type AiwgFortemiChunkManifest, type AiwgFortemiChunkPart, type AiwgFortemiChunkPartRef, type AiwgFortemiIndexExport, type AiwgFortemiProjectedRecord, type AiwgFortemiProvenance, type AiwgFortemiProvenanceEvent, type AiwgFortemiRecord, type AiwgFortemiRecordSource, type AiwgFortemiRecordType, type AiwgFortemiRelationship, type AiwgFortemiSkosConcept, type AiwgFortemiSkosRelation, type AiwgFortemiSkosRelationType, type AiwgIndexController, type AiwgIndexControllerListener, type AiwgIndexControllerSnapshot, type AiwgIndexGraphOptions, type AiwgIndexQueryMatch, type AiwgIndexQueryOptions, type AiwgIndexQueryRankedItem, type AiwgIndexQueryResult, type AiwgIndexQueryWeights, type AiwgIndexValidationResult, type AiwgPrivacyClassification, type AiwgProvenanceConfidence, type AiwgReviewAction, type AiwgReviewDecision, type AiwgReviewDecisionExport, type AiwgReviewInput, aiwgDetailHrefForId, aiwgFortemiIndexToCommunityGraph, assertAiwgFortemiChunkManifest, assertAiwgFortemiChunkPart, assertAiwgFortemiIndexExport, buildAiwgChunkedIndex, createAiwgFetchChunkLoader, createAiwgFetchDetailLoader, createAiwgIndexController, createAiwgReviewDecisionExport, encodeAiwgDetailId, getAiwgFortemiFacets, queryAiwgFortemiIndex, validateAiwgFortemiChunkManifest, validateAiwgFortemiChunkPart, validateAiwgFortemiIndexExport };
