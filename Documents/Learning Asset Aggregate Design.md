# Learning Asset Aggregate Design

> Version: 1.0
>
> Status: Draft
>
> Domain: Learning Asset Management
>
> Aggregate: Learning Asset
>
> Related Documents:
>
> - Lesson Aggregate Design
> - Lesson Revision Aggregate Design
> - Learning Delivery Context
> - AI Authoring Assistant Architecture
> - AI Capability Architecture

---

# 1. Overview

The Learning Asset Aggregate represents a reusable educational resource that can be referenced by one or more Lesson Revisions.

A Learning Asset owns the digital resource, technical metadata, lifecycle, and processing status.

Lesson Revisions never own digital assets.

They reference Learning Assets.

---

# 2. Vision

Learning Assets are enterprise resources.

They should exist independently from any individual lesson.

A single asset may be reused across:

- Lessons
- Courses
- Learning Paths
- Assessments
- AI Workflows
- Future educational products

without duplication.

---

# 3. Responsibilities

The Learning Asset Aggregate is responsible for:

- Managing asset identity
- Managing digital files
- Managing technical metadata
- Managing processing status
- Managing AI enrichment
- Managing storage references
- Managing lifecycle

It is not responsible for instructional sequencing.

---

# 4. Aggregate Root

```text
LearningAsset
```

---

# 5. Aggregate Structure

```text
LearningAsset

├── Asset Metadata
├── Storage Information
├── Processing Status
├── AI Metadata
├── Technical Information
├── Security Information
└── Usage Information
```

---

# 6. Asset Categories

Examples include:

- Video
- Audio
- PDF
- Slide Deck
- Image
- SCORM Package
- HTML Activity
- External Resource
- Interactive Simulation
- Document
- ZIP Package

Future asset types may be added without changing the aggregate.

---

# 7. Aggregate Responsibilities

The Learning Asset Aggregate owns:

- uploaded file
- media type
- duration
- resolution
- encoding
- file size
- storage location
- AI processing results
- transcript generation status
- thumbnail generation
- captions
- accessibility metadata

---

# 8. Entities

## Asset File

Represents the stored digital resource.

Examples:

- Original File
- Optimized Version
- Streaming Version
- Thumbnail
- Caption File

---

## Asset Processing Job

Represents processing performed on the asset.

Examples:

- Video Encoding
- Audio Extraction
- OCR
- Thumbnail Generation
- Transcript Generation
- Translation
- Caption Generation

Each processing job has its own lifecycle.

---

## Asset Usage

Represents where the asset is referenced.

Examples:

- Lesson Revision
- Assessment
- Learning Path
- AI Workspace

This supports impact analysis.

---

# 9. Value Objects

## Asset Metadata

Contains:

- Title
- Description
- Author
- Language
- Copyright
- License
- Keywords

---

## Technical Metadata

Examples:

- Duration
- Resolution
- Codec
- Frame Rate
- File Size
- MIME Type

---

## Storage Information

Contains:

- Storage Provider
- Bucket
- Object Key
- Region
- Checksum

---

## Accessibility Metadata

Examples:

- Transcript Available
- Captions Available
- Audio Description
- Reading Level

---

## AI Metadata

Contains:

- Transcript
- AI Summary
- AI Keywords
- AI Chapters
- AI Topics
- AI Confidence Scores

---

# 10. AI Integration

AI enriches Learning Assets.

Examples:

Teacher uploads video

↓

AI generates transcript

↓

AI detects chapters

↓

AI generates keywords

↓

AI creates summary

↓

AI detects concepts

↓

AI stores enrichment

Lesson Revision later consumes these enrichments.

---

# 11. Relationships

```text
Learning Asset

↓

Referenced By

↓

Lesson Revision

Assessment

Learning Path

AI Collaboration
```

The Learning Asset never belongs to a Lesson.

---

# 12. Domain Events

Representative events include:

- LearningAssetUploaded
- LearningAssetUpdated
- LearningAssetArchived
- AssetProcessingStarted
- AssetProcessingCompleted
- TranscriptGenerated
- ThumbnailGenerated
- CaptionsGenerated
- AIAnalysisCompleted

---

# 13. Commands

Representative commands include:

- UploadLearningAsset
- ReplaceLearningAsset
- ArchiveLearningAsset
- StartProcessing
- GenerateTranscript
- GenerateCaptions
- GenerateThumbnail
- AnalyzeAsset
- TranslateAsset

---

# 14. Business Invariants

## INV-001

Every Learning Asset has exactly one identity.

---

## INV-002

Learning Assets may exist without being referenced.

---

## INV-003

Lesson Revisions reference Learning Assets by identifier only.

---

## INV-004

Replacing an asset creates a new asset revision rather than silently modifying published educational content.

---

## INV-005

AI enrichment belongs to the Learning Asset and may be reused across multiple Lesson Revisions.

---

## INV-006

Archived Learning Assets cannot be attached to new Lesson Revisions.

Existing references remain valid unless organizational policy states otherwise.

---

# 15. State Machine

```text
Uploaded

↓

Processing

↓

Ready

↓

Archived
```

Processing includes all asynchronous enrichment operations.

---

# 16. Aggregate References

The Learning Asset Aggregate may reference:

- WorkspaceId
- MembershipId (Owner)
- Storage Provider

Other aggregates reference LearningAssetId.

---

# 17. Architectural Rationale

Separating Learning Assets from Lesson Revisions provides:

- Enterprise asset reuse
- Independent asset lifecycle
- AI enrichment reuse
- Reduced storage duplication
- Better scalability
- Cleaner aggregate boundaries
- Simpler instructional models

Lesson Revisions focus on pedagogy.

Learning Assets focus on digital resources.

---

# 18. Future Evolution

The Learning Asset Aggregate supports future capabilities including:

- Asset collections
- Digital rights management
- Asset versioning
- AI-generated alternative formats
- Multi-language asset variants
- Content moderation
- Automatic quality scoring
- Asset recommendation
- Organization-wide asset libraries
- External content connectors

---

# Summary

The Learning Asset Aggregate represents the authoritative owner of reusable educational resources within the Learning Workspace Platform.

By separating digital asset management from instructional design, the platform enables scalable content reuse, centralized AI enrichment, and independent lifecycle management while allowing Lesson Revisions to remain focused on delivering effective learning experiences.