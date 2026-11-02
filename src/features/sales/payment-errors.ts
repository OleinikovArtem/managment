export class PaymentOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentOperationError";
  }
}

export class PaymentIdempotencyConflictError extends PaymentOperationError {
  constructor() {
    super("Передача уже сохранена с другими данными. Проверьте сумму и историю.");
    this.name = "PaymentIdempotencyConflictError";
  }
}

export class PaymentTemporaryDatabaseError extends PaymentOperationError {
  constructor() {
    super("Не удалось записать передачу Adena. Подождите и повторите попытку.");
    this.name = "PaymentTemporaryDatabaseError";
  }
}
