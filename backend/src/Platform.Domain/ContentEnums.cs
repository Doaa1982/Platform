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

/// <summary>
/// How a Lesson is delivered — recorded content a learner works through on
/// their own, or a live session the tutor runs (Learning Product Aggregate
/// Design's Instructor-Led pacing: "usually in live sessions arranged with
/// that learner"). Descriptive only, exactly like Pacing Model: it records
/// the tutor's intent and enforces nothing by itself — Scheduling Context,
/// which would act on it (booking, calendar, a join link), is not built yet.
/// </summary>
public enum LessonDeliveryMode { Recorded, LiveSession }
