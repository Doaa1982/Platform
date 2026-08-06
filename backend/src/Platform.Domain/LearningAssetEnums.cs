namespace Platform.Domain;

/// <summary>
/// What kind of digital resource a Learning Asset holds (Learning Asset
/// Aggregate Design §6). Only Video is authored today; the enum exists so
/// future categories (Audio, Image, Document, …) do not change the aggregate.
/// </summary>
public enum LearningAssetCategory { Video }

/// <summary>
/// Learning Asset Aggregate Design §15. No asynchronous processing pipeline
/// exists yet (no real transcoding or AI enrichment), so an asset moves
/// straight from Uploaded to Ready — the states are kept distinct so that
/// pipeline can be introduced later without renaming anything a client
/// already depends on.
/// </summary>
public enum LearningAssetStatus { Uploaded, Ready, Archived }
