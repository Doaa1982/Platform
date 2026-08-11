namespace Platform.Domain;

/// <summary>Publication status of an Assessment (Assessment and Submission Aggregate Design §13).</summary>
public enum AssessmentStatus { Draft, Published, Closed }

/// <summary>
/// Which of the (at most) two Assessments a Lesson Revision may carry this
/// one is:
///   Interactive — the in-video checkpoint quiz (Assessment.cs's original
///                 design); questions may carry a VideoTimestampSeconds to
///                 pause playback, or none to be asked once the video ends.
///   Standalone  — a separate, non-video-synced lesson quiz a tutor can
///                 author in addition to (or instead of) Interactive
///                 questions — its own title, passing threshold, and
///                 Submissions, taken by a learner in one sitting rather
///                 than interleaved with video playback.
/// A Lesson Revision may have zero, one, or both kinds — never two of the
/// same kind (enforced by the (LessonRevisionId, Kind) unique index).
/// </summary>
public enum AssessmentKind { Interactive, Standalone }

/// <summary>
/// The four Question Event types Learning Delivery Context §4.1 and AI
/// Interactive Video Lesson Generator §5 both define:
///   MultipleChoice       — knowledge checking, concept understanding.
///   TrueFalse             — misconception detection.
///   CompleteTheSentence   — vocabulary, definitions, terminology.
///   OpenAnswer            — reasoning, explanation, reflection; not
///                           auto-gradable (see Assessment.Grade).
/// </summary>
public enum QuestionType { MultipleChoice, TrueFalse, CompleteTheSentence, OpenAnswer }
