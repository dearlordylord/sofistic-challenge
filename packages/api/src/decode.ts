import { Either, Schema } from "effect"

export class DecodeError extends Error {
  override readonly name = "DecodeError"

  constructor(readonly issue: string) {
    super(issue)
  }
}

export function decodeUnknown<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: unknown
): Either.Either<A, DecodeError> {
  return Schema.decodeUnknownEither(schema)(value).pipe(
    Either.mapLeft((error) => new DecodeError(String(error)))
  )
}
