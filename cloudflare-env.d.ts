interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1Result<T = unknown> {
  success: boolean;
  results: T[];
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2HTTPMetadata {
  contentType?: string;
}

interface R2ObjectBody {
  key: string;
  size: number;
  body: ReadableStream<Uint8Array>;
  httpMetadata?: R2HTTPMetadata;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2ListedObject {
  key: string;
  size: number;
}

interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: R2HTTPMetadata }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{ objects: R2ListedObject[]; truncated: boolean; cursor?: string }>;
}

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
