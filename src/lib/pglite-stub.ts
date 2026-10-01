/** Production bundle stand-in. The real package looks for pglite.data on disk. */
export class PGlite {
  constructor() {
    throw new Error(
      "PGlite is disabled in the production bundle. Set DATABASE_URL to a PostgreSQL database.",
    );
  }
}
