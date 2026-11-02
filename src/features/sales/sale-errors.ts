export class SaleOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleOperationError";
  }
}

export class SaleIdempotencyConflictError extends SaleOperationError {
  constructor() {
    super("Этот ключ операции уже использован для продажи с другими данными.");
    this.name = "SaleIdempotencyConflictError";
  }
}

export class SaleTemporaryDatabaseError extends SaleOperationError {
  constructor() {
    super("База данных занята. Продажа не проведена; подождите и повторите попытку.");
    this.name = "SaleTemporaryDatabaseError";
  }
}
