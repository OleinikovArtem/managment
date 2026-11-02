export class PaymentOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentOperationError";
  }
}

export class PaymentIdempotencyConflictError extends PaymentOperationError {
  constructor() {
    super("Этот ключ операции уже использован для выплаты с другими данными.");
    this.name = "PaymentIdempotencyConflictError";
  }
}

export class PaymentTemporaryDatabaseError extends PaymentOperationError {
  constructor() {
    super("База данных занята. Выплата не проведена; подождите и повторите попытку.");
    this.name = "PaymentTemporaryDatabaseError";
  }
}
