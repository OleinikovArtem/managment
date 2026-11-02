declare module "better-sqlite3" {
  export default class Database {
    constructor(
      filename: string,
      options?: { readonly?: boolean },
    );
    backup(destination: string): Promise<void>;
    close(): void;
  }
}
