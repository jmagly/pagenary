type AiwgFortemiRecordType = string;
type AiwgFortemiRecordSchemaVersion = 'aiwg.fortemi.index.record.v1' | 'aiwg.fortemi.index.record.v2';
type AiwgFortemiIndexExportSchemaVersion = 'aiwg.fortemi.index.export.v1' | 'aiwg.fortemi.index.export.v2';
type AiwgPrivacyClassification = 'private' | 'sanitized' | 'public';
type AiwgProvenanceConfidence = 'source' | 'candidate' | 'reviewed' | 'rejected';
type AiwgReviewAction = 'accept' | 'reject' | 'defer';
type AiwgFortemiRelationshipDirection = 'upstream' | 'downstream' | 'related';
interface AiwgFortemiRecordSource {
    path: string;
    repo_relative_path: string;
    locator: string;
    origin?: string;
    generated?: boolean;
    checksum?: string;
    updated_at?: string;
}
interface AiwgFortemiRelationship {
    type: string;
    target_id: string;
    source_path?: string;
    target_path?: string;
    direction?: AiwgFortemiRelationshipDirection;
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
interface AiwgFortemiSearchProjection {
    title?: string;
    name?: string;
    summary?: string;
    body?: string;
    triggers?: string[];
    aliases?: string[];
    capability?: string;
    tags?: string[];
    phase?: string;
    type?: string;
    frontmatter?: Record<string, unknown>;
}
interface AiwgFortemiChunk {
    id?: string;
    text?: string;
    body?: string;
    summary?: string;
    source_path?: string;
    metadata?: Record<string, unknown>;
}
interface AiwgFortemiRecordEmbedding {
    id?: string;
    embedding?: number[];
    vector?: number[];
    model?: string;
    granularity?: string;
    input_hash?: string;
    source_path?: string;
    metadata?: Record<string, unknown>;
}
interface AiwgFortemiAttachmentReference {
    id: string;
    path: string;
    mime: string | null;
    checksum: string;
    bytes: number;
}
interface AiwgFortemiBinarySource {
    extracted_text: string | null;
    created_at?: string;
    deleted_at?: string | null;
    extraction_status?: 'extracted' | 'pending' | 'failed' | 'blocked' | 'deferred';
    reason?: null | 'extraction_pending' | 'extractor_failed' | 'quarantined' | 'large_binary' | 'unsupported_mime' | 'no_extracted_text';
    attachment: AiwgFortemiAttachmentReference;
}
interface AiwgFortemiRecord {
    schema_version: AiwgFortemiRecordSchemaVersion;
    id: string;
    type: AiwgFortemiRecordType;
    source: AiwgFortemiRecordSource;
    title?: string;
    text?: string;
    facets: Record<string, string[]>;
    tags: string[];
    concepts: string[];
    relationships: AiwgFortemiRelationship[];
    provenance: AiwgFortemiProvenance[];
    search?: AiwgFortemiSearchProjection;
    chunks?: AiwgFortemiChunk[];
    binary_sources?: AiwgFortemiBinarySource[];
    embeddings?: AiwgFortemiRecordEmbedding[];
    compatibility?: Record<string, unknown>;
    /** Optional rich SKOS metadata for static consumers that need labels/definitions without opening a shard. */
    skos_concepts?: AiwgFortemiSkosConcept[];
    /** Optional SKOS relationship edges among concepts referenced by this record. */
    skos_relations?: AiwgFortemiSkosRelation[];
    /** Optional W3C PROV-style activity chain for this record. */
    provenance_events?: AiwgFortemiProvenanceEvent[];
    privacy: {
        classification: AiwgPrivacyClassification;
        pii: boolean;
        locality?: string;
    };
    updated_at: string;
}
interface AiwgFortemiIndexExport {
    schema_version: AiwgFortemiIndexExportSchemaVersion;
    generated_at: string;
    source: {
        repo: string;
        privacy: AiwgPrivacyClassification;
        graph?: string;
    };
    items: AiwgFortemiRecord[];
    compatibility?: {
        previous_schema_version: 'aiwg.fortemi.index.export.v1';
        strategy: 'supported';
    };
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
    source_export_schema_version?: AiwgFortemiIndexExportSchemaVersion;
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
    counts: Partial<Record<string, number>>;
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
    searchProfile?: 'default' | 'aiwg-discovery';
}
interface AiwgIndexQueryWeights {
    title: number;
    text: number;
    tag: number;
    concept: number;
    facet: number;
    id: number;
    source: number;
}
interface AiwgIndexQueryMatch {
    field: 'title' | 'text' | 'tag' | 'concept' | 'facet' | 'id' | 'source';
    value: string;
    score?: number;
    reason?: string;
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
    source_export_schema_version: AiwgFortemiIndexExportSchemaVersion;
    decisions: AiwgReviewDecision[];
}
interface AiwgIndexGraphOptions {
    communityFacet?: string;
    communityTagPrefix?: string;
    relationshipWeights?: Record<string, number>;
    includeDanglingRelationships?: boolean;
}
type AiwgRelationshipDirection = 'in' | 'out' | 'both';
type AiwgRelationshipSetOperation = 'intersection' | 'union' | 'difference';
interface AiwgRelationshipTraversalOptions {
    direction?: AiwgRelationshipDirection;
    relationshipType?: string;
    relationshipDirection?: AiwgFortemiRelationshipDirection;
    limit?: number;
}
interface AiwgRelationshipQueryOptions extends AiwgRelationshipTraversalOptions {
    sourceId?: string;
    targetId?: string;
    endpointId?: string;
    type?: string;
}
interface AiwgRelationshipEdgeSummary {
    source_id: string;
    target_id: string;
    type: string;
    source_path?: string;
    target_path?: string;
    direction?: AiwgFortemiRelationshipDirection;
}
interface AiwgRelationshipNodeSummary {
    id: string;
    type: AiwgFortemiRecordType;
    title: string;
}
interface AiwgRelationshipTraversalResult {
    nodes: AiwgRelationshipNodeSummary[];
    edges: AiwgRelationshipEdgeSummary[];
    complete: boolean;
    scannedParts?: number;
    fetchedParts?: number;
}
interface AiwgRelationshipSetOptions extends AiwgRelationshipTraversalOptions {
    op: AiwgRelationshipSetOperation;
    a: string;
    b: string;
}
interface AiwgRelationshipSetResult {
    ids: string[];
    op: AiwgRelationshipSetOperation;
}
interface AiwgStaticEmbeddingRecord {
    record_id: string;
    embedding: number[];
    embedding_id?: string;
    granularity?: string;
    input_hash: string;
    source_path?: string;
}
interface AiwgStaticEmbeddingSet {
    schema_version: 'aiwg.fortemi.embedding.set.v1';
    id: string;
    model: string;
    dimensions: number;
    generated_at: string;
    granularity: 'title-summary' | 'body' | 'chunked-body' | string;
    metric?: 'cosine' | 'dot' | 'euclidean';
    input_hash_algorithm?: string;
    embeddings: AiwgStaticEmbeddingRecord[];
}
interface AiwgHeadlessEmbeddingBackend {
    model: string;
    dimensions: number;
    embed(input: string, record: AiwgFortemiRecord): number[] | Promise<number[]>;
}
interface AiwgPrivacyFilterOptions {
    /** Include records classified `private` (default false). */
    includePrivate?: boolean;
    /** Include records flagged `pii` (default false). */
    includePii?: boolean;
}
/** Drop `private`/`pii` records unless explicitly opted in (SEC6, default-safe). */
declare function filterAiwgRecordsByPrivacy(records: AiwgFortemiRecord[], options?: AiwgPrivacyFilterOptions): AiwgFortemiRecord[];
interface BuildAiwgStaticEmbeddingSetOptions {
    id: string;
    backend: AiwgHeadlessEmbeddingBackend;
    records?: AiwgFortemiRecord[];
    generatedAt?: string | Date;
    granularity?: AiwgStaticEmbeddingSet['granularity'];
    metric?: AiwgStaticEmbeddingSet['metric'];
    textForRecord?: (record: AiwgFortemiRecord) => string;
    /** Privacy filtering (SEC6). Default-safe: excludes `private`/`pii` records. */
    privacy?: AiwgPrivacyFilterOptions;
}
interface AiwgStaticSemanticQueryOptions {
    limit?: number;
    offset?: number;
    minScore?: number;
}
interface AiwgStaticSemanticResult {
    item: AiwgFortemiRecord;
    score: number;
    embedding?: AiwgStaticEmbeddingRecord;
}
interface AiwgStaticHybridQueryOptions extends AiwgStaticSemanticQueryOptions, AiwgIndexQueryOptions {
    lexicalWeight?: number;
    semanticWeight?: number;
}
interface AiwgStaticDuplicatePair {
    left: AiwgFortemiRecord;
    right: AiwgFortemiRecord;
    score: number;
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
    neighbors(id: string, options?: AiwgRelationshipTraversalOptions): Promise<AiwgRelationshipTraversalResult>;
    relationshipQuery(options?: AiwgRelationshipQueryOptions): Promise<AiwgRelationshipTraversalResult>;
    relationshipSet(options: AiwgRelationshipSetOptions): Promise<AiwgRelationshipSetResult>;
    clearChunkCache(): void;
    toCommunityGraph(options?: AiwgIndexGraphOptions): ReturnType<typeof aiwgFortemiIndexToCommunityGraph>;
    toCommunityGraphChunked(options?: AiwgIndexGraphOptions & {
        onProgress?: (progress: AiwgChunkedIndexProgress) => void;
    }): Promise<ReturnType<typeof aiwgFortemiIndexToCommunityGraph>>;
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
declare function resolveAiwgFetchUrl(href: string, baseUrl?: string | URL): string;
declare function createAiwgFetchChunkLoader(baseUrl?: string | URL): AiwgChunkedIndexLoader;
declare function encodeAiwgDetailId(id: string, encoding?: AiwgDetailIdEncoding): string;
declare function aiwgDetailHrefForId(detail: AiwgFortemiChunkDetailRef, id: string): string;
declare function createAiwgFetchDetailLoader(baseUrl?: string | URL): AiwgChunkedIndexDetailLoader;
declare function getAiwgFortemiFacets(items: AiwgFortemiRecord[]): Record<string, Record<string, number>>;
declare function buildAiwgStaticEmbeddingSet(index: AiwgFortemiIndexExport, options: BuildAiwgStaticEmbeddingSetOptions): Promise<AiwgStaticEmbeddingSet>;
interface AiwgChunkedIndexBuildOptions {
    partSize?: number;
    projection?: Array<keyof AiwgFortemiRecord>;
    detailHref?: string;
    idEncoding?: AiwgDetailIdEncoding;
    generatedAt?: string;
    /** Privacy filtering (SEC6). Default-safe: excludes `private`/`pii` records. */
    privacy?: AiwgPrivacyFilterOptions;
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
declare function validateAiwgStaticEmbeddingSet(value: unknown): AiwgChunkedIndexValidationResult;
declare function assertAiwgStaticEmbeddingSet(value: unknown): AiwgStaticEmbeddingSet;
declare function queryAiwgSemanticIndex(index: AiwgFortemiIndexExport, embeddingSet: AiwgStaticEmbeddingSet, queryEmbedding: number[], options?: AiwgStaticSemanticQueryOptions): AiwgStaticSemanticResult[];
declare function queryAiwgHybridIndex(index: AiwgFortemiIndexExport, embeddingSet: AiwgStaticEmbeddingSet, query: string, queryEmbedding: number[], options?: AiwgStaticHybridQueryOptions): AiwgStaticSemanticResult[];
declare const DEFAULT_AIWG_DUPLICATE_SCAN_MAX_EMBEDDINGS = 5000;
declare function findAiwgStaticDuplicatePairs(index: AiwgFortemiIndexExport, embeddingSet: AiwgStaticEmbeddingSet, threshold?: number, options?: {
    maxEmbeddings?: number;
}): AiwgStaticDuplicatePair[];
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

export { AIWG_SCAN_REQUIRED_FIELDS, type AiwgChunkedIndexBuildOptions, type AiwgChunkedIndexBuildResult, type AiwgChunkedIndexDetailLoader, type AiwgChunkedIndexLoadOptions, type AiwgChunkedIndexLoader, type AiwgChunkedIndexProgress, type AiwgChunkedIndexProgressPhase, type AiwgChunkedIndexQueryOptions, type AiwgChunkedIndexQueryResult, type AiwgChunkedIndexValidationResult, type AiwgDetailIdEncoding, type AiwgFortemiAttachmentReference, type AiwgFortemiBinarySource, type AiwgFortemiChunk, type AiwgFortemiChunkDetailRef, type AiwgFortemiChunkManifest, type AiwgFortemiChunkPart, type AiwgFortemiChunkPartRef, type AiwgFortemiIndexExport, type AiwgFortemiIndexExportSchemaVersion, type AiwgFortemiProjectedRecord, type AiwgFortemiProvenance, type AiwgFortemiProvenanceEvent, type AiwgFortemiRecord, type AiwgFortemiRecordEmbedding, type AiwgFortemiRecordSchemaVersion, type AiwgFortemiRecordSource, type AiwgFortemiRecordType, type AiwgFortemiRelationship, type AiwgFortemiRelationshipDirection, type AiwgFortemiSearchProjection, type AiwgFortemiSkosConcept, type AiwgFortemiSkosRelation, type AiwgFortemiSkosRelationType, type AiwgHeadlessEmbeddingBackend, type AiwgIndexController, type AiwgIndexControllerListener, type AiwgIndexControllerSnapshot, type AiwgIndexGraphOptions, type AiwgIndexQueryMatch, type AiwgIndexQueryOptions, type AiwgIndexQueryRankedItem, type AiwgIndexQueryResult, type AiwgIndexQueryWeights, type AiwgIndexValidationResult, type AiwgPrivacyClassification, type AiwgPrivacyFilterOptions, type AiwgProvenanceConfidence, type AiwgRelationshipDirection, type AiwgRelationshipEdgeSummary, type AiwgRelationshipNodeSummary, type AiwgRelationshipQueryOptions, type AiwgRelationshipSetOperation, type AiwgRelationshipSetOptions, type AiwgRelationshipSetResult, type AiwgRelationshipTraversalOptions, type AiwgRelationshipTraversalResult, type AiwgReviewAction, type AiwgReviewDecision, type AiwgReviewDecisionExport, type AiwgReviewInput, type AiwgStaticDuplicatePair, type AiwgStaticEmbeddingRecord, type AiwgStaticEmbeddingSet, type AiwgStaticHybridQueryOptions, type AiwgStaticSemanticQueryOptions, type AiwgStaticSemanticResult, type BuildAiwgStaticEmbeddingSetOptions, DEFAULT_AIWG_DUPLICATE_SCAN_MAX_EMBEDDINGS, aiwgDetailHrefForId, aiwgFortemiIndexToCommunityGraph, assertAiwgFortemiChunkManifest, assertAiwgFortemiChunkPart, assertAiwgFortemiIndexExport, assertAiwgStaticEmbeddingSet, buildAiwgChunkedIndex, buildAiwgStaticEmbeddingSet, createAiwgFetchChunkLoader, createAiwgFetchDetailLoader, createAiwgIndexController, createAiwgReviewDecisionExport, encodeAiwgDetailId, filterAiwgRecordsByPrivacy, findAiwgStaticDuplicatePairs, getAiwgFortemiFacets, queryAiwgFortemiIndex, queryAiwgHybridIndex, queryAiwgSemanticIndex, resolveAiwgFetchUrl, validateAiwgFortemiChunkManifest, validateAiwgFortemiChunkPart, validateAiwgFortemiIndexExport, validateAiwgStaticEmbeddingSet };
