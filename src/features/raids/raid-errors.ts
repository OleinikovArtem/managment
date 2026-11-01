export class RaidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RaidOperationError";
  }
}
