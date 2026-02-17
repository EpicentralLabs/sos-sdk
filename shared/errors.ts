export class SdkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdkValidationError";
  }
}

export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new SdkValidationError(message);
  }
}
