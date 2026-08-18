namespace Platform.Domain;

/// <summary>
/// What kind of digital resource a Learning Asset holds (Learning Asset
/// Aggregate Design §6). Video is a lesson's single teaching recording;
/// Resource is any supplementary file (slides, worksheet, handout) a tutor
/// attaches alongside it — see LessonRevision.Resources. Image is a cover
/// photo — a Learning Product's (LearningProduct.CoverImageAssetId) today.
/// </summary>
public enum LearningAssetCategory { Video, Resource, Image }

/// <summary>
/// Learning Asset Aggregate Design §15. No asynchronous processing pipeline
/// exists yet (no real transcoding or AI enrichment), so an asset moves
/// straight from Uploaded to Ready — the states are kept distinct so that
/// pipeline can be introduced later without renaming anything a client
/// already depends on.
/// </summary>
public enum LearningAssetStatus { Uploaded, Ready, Archived }
