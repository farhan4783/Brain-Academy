import { QdrantClient } from "@qdrant/js-client-rest";

export interface MemoryDocument {
  id: string;
  repo: string;
  filePath?: string;
  snippet: string;
  metadata?: Record<string, unknown>;
}

export class QdrantMemoryStore {
  private client: QdrantClient;
  private collectionName: string;

  constructor(url = process.env.QDRANT_URL || "http://localhost:6333", collectionName = "hermes_code_memory") {
    this.client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
    this.collectionName = collectionName;
  }

  public async initialize(): Promise<void> {
    const collections = await this.client.getCollections().catch(() => ({ collections: [] }));
    const exists = collections.collections.some((c) => c.name === this.collectionName);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: 1536, // Standard embedding dimension
          distance: "Cosine",
        },
      });
    }
  }

  public async storeMemory(doc: MemoryDocument, vector: number[]): Promise<void> {
    await this.client.upsert(this.collectionName, {
      points: [
        {
          id: doc.id,
          vector,
          payload: {
            repo: doc.repo,
            filePath: doc.filePath,
            snippet: doc.snippet,
            ...doc.metadata,
          },
        },
      ],
    });
  }

  public async searchSimilar(vector: number[], limit = 5): Promise<MemoryDocument[]> {
    const searchResult = await this.client.search(this.collectionName, {
      vector,
      limit,
    });

    return searchResult.map((res) => ({
      id: String(res.id),
      repo: String(res.payload?.repo ?? ""),
      filePath: res.payload?.filePath ? String(res.payload.filePath) : undefined,
      snippet: String(res.payload?.snippet ?? ""),
      metadata: res.payload as Record<string, unknown>,
    }));
  }
}
