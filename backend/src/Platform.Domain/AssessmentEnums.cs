namespace Platform.Domain;

/// <summary>Publication status of an Assessment (Assessment and Submission Aggregate Design §13).</summary>
public enum AssessmentStatus { Draft, Published, Closed }

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
