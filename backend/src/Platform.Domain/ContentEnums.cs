namespace Platform.Domain;

/// <summary>
/// Publication status of a Curriculum (Curriculum Aggregate Design).
/// A Curriculum is the pedagogical shape of a Learning Product; its own
/// publication is distinct from the Product's (Learning Product §16).
/// </summary>
public enum CurriculumStatus { Draft, Published, Archived }

/// <summary>
/// Publication status of a Lesson — its business identity, not its content
/// (Lesson Aggregate Design §19: identity and publication live here, while
/// instructional content and its evolution live on Lesson Revision).
/// </summary>
public enum LessonStatus { Draft, Published, Archived }

/// <summary>
/// Status of one Lesson Revision. Revisions are the unit of authoring: a
/// published Lesson keeps serving its current revision while the next one is
/// still being written.
/// </summary>
public enum LessonRevisionStatus { Draft, Published, Superseded }
