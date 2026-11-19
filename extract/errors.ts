/** A hard failure of the extraction, with a message meant for the maintainer. */
export class ExtractError extends Error {
  override name = "ExtractError";
}
