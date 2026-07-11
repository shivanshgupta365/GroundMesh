import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PGlite, type Transaction as PGliteTransaction } from "@electric-sql/pglite";
import postgres, { type Sql } from "postgres";

import { LOCAL_SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export type DatabaseDialect = "pglite" | "postgres";

export interface QueryResultRow {
  [column: string]: unknown;
}

export interface DatabaseExecutor {
  readonly dialect: DatabaseDialect;
  query<T extends QueryResultRow = QueryResultRow>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<T[]>;
  execute(statement: string, parameters?: readonly unknown[]): Promise<number>;
}

export interface GroundMeshDatabase extends DatabaseExecutor {
  transaction<T>(work: (transaction: DatabaseExecutor) => Promise<T>): Promise<T>;
  executeScript(script: string): Promise<void>;
  close(): Promise<void>;
}

function normaliseParameters(parameters: readonly unknown[]): unknown[] {
  return parameters.map((parameter) => (parameter === undefined ? null : parameter));
}

class PGliteExecutor implements DatabaseExecutor {
  readonly dialect = "pglite" as const;

  constructor(protected readonly client: PGlite | PGliteTransaction) {}

  async query<T extends QueryResultRow>(
    statement: string,
    parameters: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.client.query<T>(statement, normaliseParameters(parameters));
    return [...result.rows];
  }

  async execute(statement: string, parameters: readonly unknown[] = []): Promise<number> {
    const result = await this.client.query(statement, normaliseParameters(parameters));
    return result.affectedRows ?? 0;
  }
}

class PGliteDatabase extends PGliteExecutor implements GroundMeshDatabase {
  constructor(private readonly database: PGlite) {
    super(database);
  }

  async transaction<T>(work: (transaction: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.database.transaction((transaction) => work(new PGliteExecutor(transaction)));
  }

  async executeScript(script: string): Promise<void> {
    await this.database.exec(script);
  }

  async close(): Promise<void> {
    await this.database.close();
  }
}

type PostgresClient = Sql<Record<string, never>>;

class PostgresExecutor implements DatabaseExecutor {
  readonly dialect = "postgres" as const;

  constructor(protected readonly client: PostgresClient) {}

  async query<T extends QueryResultRow>(
    statement: string,
    parameters: readonly unknown[] = [],
  ): Promise<T[]> {
    const rows = await this.client.unsafe<T[]>(statement, normaliseParameters(parameters) as never[]);
    return Array.from(rows);
  }

  async execute(statement: string, parameters: readonly unknown[] = []): Promise<number> {
    const result = await this.client.unsafe(statement, normaliseParameters(parameters) as never[]);
    return result.count;
  }
}

class PostgresDatabase extends PostgresExecutor implements GroundMeshDatabase {
  constructor(private readonly database: PostgresClient) {
    super(database);
  }

  async transaction<T>(work: (transaction: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.database.begin((transaction) =>
      work(new PostgresExecutor(transaction as unknown as PostgresClient)),
    ) as Promise<T>;
  }

  async executeScript(script: string): Promise<void> {
    await this.database.unsafe(script, [], { prepare: false });
  }

  async close(): Promise<void> {
    await this.database.end({ timeout: 5 });
  }
}

async function createDatabase(): Promise<GroundMeshDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  let database: GroundMeshDatabase;

  if (databaseUrl) {
    const client = postgres(databaseUrl, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => undefined,
    });
    database = new PostgresDatabase(client);
  } else {
    const configuredPath =
      process.env.GROUNDMESH_DB_PATH?.trim() || process.env.GROUND_MESH_LOCAL_DB?.trim();
    if (configuredPath) {
      const storagePath = path.resolve(configuredPath);
      await mkdir(path.dirname(storagePath), { recursive: true });
      database = new PGliteDatabase(new PGlite(storagePath));
    } else {
      database = new PGliteDatabase(new PGlite());
    }
  }

  if (database.dialect === "pglite") {
    await database.executeScript(LOCAL_SCHEMA_SQL);
  } else {
    // Remote databases must use the checked-in migration. Bootstrapping the
    // portable JSON embedding column here would prevent pgvector installation.
    const migrationTable = await database.query<{ migration_table: string | null }>(
      `SELECT to_regclass('public.groundmesh_schema_migrations')::text AS migration_table`,
    );
    if (!migrationTable[0]?.migration_table) {
      await database.close();
      throw new Error(
        "GroundMesh database is not migrated. Apply supabase/migrations/202607110001_groundmesh.sql before startup.",
      );
    }
    const versions = await database.query<{ version: string }>(
      `SELECT version FROM groundmesh_schema_migrations WHERE version = $1`,
      [SCHEMA_VERSION],
    );
    if (!versions[0]) {
      await database.close();
      throw new Error(`GroundMesh database migration ${SCHEMA_VERSION} is required before startup.`);
    }
  }

  return database;
}

let databasePromise: Promise<GroundMeshDatabase> | undefined;

/** Lazily opens and migrates the process-wide database connection. */
export function getDatabase(): Promise<GroundMeshDatabase> {
  databasePromise ??= createDatabase().catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

/** Test/dev hook that closes the lazy singleton so a new location can be selected. */
export async function closeDatabase(): Promise<void> {
  const active = databasePromise;
  databasePromise = undefined;
  if (active) {
    await (await active).close();
  }
}
