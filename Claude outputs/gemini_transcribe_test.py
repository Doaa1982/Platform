#!/usr/bin/env python3
"""
Validation script: send an audio file directly to Gemini and check whether
its transcript + topic-chapter output is good enough to justify building
GeminiTranscriptionProvider (IAudioTranscriptionProvider) in Platform.Api.

Usage:
    export GEMINI_API_KEY="your-key-here"
    python3 gemini_transcribe_test.py /path/to/audio.mp3

Does NOT store the key anywhere - reads it from the environment only.
Requires: pip install requests
"""
import base64
import json
import mimetypes
import os
import sys

MODEL = "gemini-2.5-flash"  # matches the confirmed no-card free-tier model;
                            # switch to "gemini-3.5-flash" to test the newer default
                            # your GeminiOptions.cs currently points at.

SYSTEM_PROMPT = """You are transcribing audio from an educational platform whose
lessons are predominantly Egyptian Arabic with natural English code-switching
(English methodology names, technical terms, numbers, variable/point labels,
and formulas spoken inline within Arabic sentences).

Produce:
1. A full, accurate transcript preserving the code-switching exactly as
   spoken (do not translate Arabic to English or vice versa; do not convert
   Egyptian Arabic to Modern Standard Arabic). Label speaker turns as
   "SPEAKER: S1" / "SPEAKER: S2" etc. where you can distinguish speakers.
2. Topic-segmented chapters: break the content into logical topic/problem
   segments (e.g. "Trapezium Area Formula Setup", "Solving for Base 2").
   For each chapter give your best-effort start and end time in seconds
   from the beginning of the audio.

Respond with JSON only, matching exactly this shape:
{
  "transcript": "full transcript text with SPEAKER labels",
  "chapters": [
    {"title": "string", "summary": "string", "startSeconds": 0.0, "endSeconds": 0.0}
  ]
}
"""

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 gemini_transcribe_test.py /path/to/audio.mp3", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: set GEMINI_API_KEY in your environment first (export GEMINI_API_KEY=...).", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.isfile(audio_path):
        print(f"ERROR: file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    mime_type, _ = mimetypes.guess_type(audio_path)
    if not mime_type:
        mime_type = "audio/mpeg"

    size_mb = os.path.getsize(audio_path) / (1024 * 1024)
    print(f"Audio file: {audio_path} ({size_mb:.1f} MB, {mime_type})", file=sys.stderr)
    if size_mb > 19:
        print("WARNING: file is close to/over the ~20MB inline request limit. "
              "For larger files you'd need Gemini's Files API (upload first, "
              "then reference by file URI) instead of inline base64 like this script does.",
              file=sys.stderr)

    with open(audio_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("ascii")

    import requests

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": mime_type, "data": audio_b64}},
                {"text": "Transcribe this audio and produce the JSON described in your instructions."},
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    print("Calling Gemini...", file=sys.stderr)
    resp = requests.post(url, headers=headers, data=json.dumps(body), timeout=300)
    if resp.status_code != 200:
        print(f"ERROR {resp.status_code}: {resp.text}", file=sys.stderr)
        sys.exit(1)

    parsed = resp.json()
    text = parsed["candidates"][0]["content"]["parts"][0]["text"]

    out_path = "gemini_transcript_result.json"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)

    print(f"\nSaved raw result to {out_path}\n")

    try:
        result = json.loads(text)
        print("=== TRANSCRIPT ===")
        print(result.get("transcript", "(missing)"))
        print("\n=== CHAPTERS ===")
        for ch in result.get("chapters", []):
            print(f"[{ch.get('startSeconds')}s - {ch.get('endSeconds')}s] {ch.get('title')}")
            if ch.get("summary"):
                print(f"    {ch['summary']}")
    except json.JSONDecodeError:
        print("Response was not valid JSON - see the raw saved file. Print it below:\n")
        print(text)

    print("\n--- What to check manually ---")
    print("1. Does the transcript preserve Arabic/English code-switching accurately")
    print("   (compare against what you know was actually said)?")
    print("2. Open the audio at each chapter's startSeconds - does the topic")
    print("   actually change there, within a couple seconds? This is the")
    print("   critical check before trusting Gemini-sourced TranscriptChapter data.")


if __name__ == "__main__":
    main()
