namespace Platform.Api.AI;

/// <summary>
/// A single binary attachment (a PDF or an image) to send alongside a
/// prompt to a model that supports multimodal input. <paramref
/// name="MediaType"/> is the attachment's declared MIME type
/// (<c>application/pdf</c>, <c>image/png</c>, <c>image/jpeg</c>, …) — it
/// decides which Claude content-block type wraps the bytes
/// (<c>document</c> for PDFs, <c>image</c> for everything else), so it must
/// be accurate, not guessed from a file extension.
/// </summary>
public record AiAttachment(byte[] Data, string MediaType);
