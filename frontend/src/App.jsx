import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, BookOpen, PlayCircle, MessageSquare, MessageCircle, Megaphone,
  Award, Upload, Wand2, CheckCircle2, XCircle, Pencil, Send, ArrowRight, ArrowLeft,
  Bot, Users, BarChart3, Clock, Mic, Sparkles, Check, Circle, RotateCcw, Settings,
  CreditCard, Calendar, ClipboardCheck, TrendingUp, UserCircle, X, Plus,
  Rocket, Palette, SlidersHorizontal, Building2, Mail, UserCheck, UserX, PauseCircle, Activity,
  Video, FileText, Layers, Lightbulb
} from "lucide-react";

/* =========================================================================
   TOKEN SYSTEMS — one per Academy (Learning Workspace).
   Every business capability below renders through the SAME components,
   driven entirely by these tokens + the CONTENT data. That is the concrete
   proof of "Branded Experience" / "Workspace-Native AI" as architected.
   ========================================================================= */

const THEMES = {
  lumen: {
    "--bg": "#F3ECDD", "--surface": "#FFFFFF", "--surface-2": "#EAE0C8",
    "--ink": "#223046", "--ink-soft": "#6B7280", "--accent": "#A6612A",
    "--accent-2": "#3F6E5B", "--line": "#DBCCA9", "--danger": "#B14232",
    "--radius": "20px", "--radius-sm": "12px",
    "--nav-bg": "#223046", "--nav-text": "#F3ECDD",
    "--font-display": "'Fraunces', serif", "--font-body": "'Karla', sans-serif",
    "--font-mono": "'IBM Plex Mono', monospace",
  },
  vantage: {
    "--bg": "#EEF2F6", "--surface": "#FFFFFF", "--surface-2": "#E2E8EF",
    "--ink": "#161A1F", "--ink-soft": "#5B6470", "--accent": "#2454C7",
    "--accent-2": "#1E8E63", "--line": "#D3DBE3", "--danger": "#C1362B",
    "--radius": "6px", "--radius-sm": "4px",
    "--nav-bg": "#161A1F", "--nav-text": "#EEF2F6",
    "--font-display": "'Space Grotesk', sans-serif", "--font-body": "'IBM Plex Sans', sans-serif",
    "--font-mono": "'IBM Plex Mono', monospace",
  },
};

const GLOBAL_IDENTITY = {
  fullName: "Jordan Byrne",
  email: "jordan.byrne@example.com",
  memberSince: "2024",
};

/* =========================================================================
   WORKSPACE SETUP WIZARD — supporting data
   Branding presets a new Workspace Owner can pick during onboarding
   (Workspace Context lifecycle: Draft → Configuring → Published → Active).
   ========================================================================= */

const BRAND_PRESETS = [
  {
    id: "botanical",
    label: "Botanical Studio",
    description: "Organic, warm, creative — for hands-on or craft-led teaching.",
    tokens: {
      "--bg": "#EEF0E7", "--surface": "#FFFFFF", "--surface-2": "#E1E6D6",
      "--ink": "#1F2A1D", "--ink-soft": "#5C6B58", "--accent": "#4C7A4F",
      "--accent-2": "#A85338", "--line": "#D6DECB", "--danger": "#B14232",
      "--radius": "24px", "--radius-sm": "14px",
      "--nav-bg": "#1F2A1D", "--nav-text": "#EEF0E7",
      "--font-display": "'Fraunces', serif", "--font-body": "'Karla', sans-serif",
      "--font-mono": "'IBM Plex Mono', monospace",
    },
  },
  {
    id: "afterhours",
    label: "After Hours",
    description: "Dark, focused, technical — for coding, data, or skills tracks.",
    tokens: {
      "--bg": "#14171B", "--surface": "#1D2126", "--surface-2": "#262B31",
      "--ink": "#E8EAED", "--ink-soft": "#9096A0", "--accent": "#2FB6C4",
      "--accent-2": "#E0A83E", "--line": "#31363D", "--danger": "#E0615A",
      "--radius": "8px", "--radius-sm": "5px",
      "--nav-bg": "#0D0F12", "--nav-text": "#E8EAED",
      "--font-display": "'Space Grotesk', sans-serif", "--font-body": "'IBM Plex Sans', sans-serif",
      "--font-mono": "'IBM Plex Mono', monospace",
    },
  },
  {
    id: "editorial",
    label: "Minimal Editorial",
    description: "Clean, quiet, confident — for academic or professional cohorts.",
    tokens: {
      "--bg": "#FAFAF8", "--surface": "#FFFFFF", "--surface-2": "#F0EFEA",
      "--ink": "#17181A", "--ink-soft": "#6B6D70", "--accent": "#D6455B",
      "--accent-2": "#2D3142", "--line": "#E4E3DE", "--danger": "#C1362B",
      "--radius": "3px", "--radius-sm": "2px",
      "--nav-bg": "#17181A", "--nav-text": "#FAFAF8",
      "--font-display": "'Space Grotesk', sans-serif", "--font-body": "'IBM Plex Sans', sans-serif",
      "--font-mono": "'IBM Plex Mono', monospace",
    },
  },
];

const CATEGORY_COURSES = {
  Language: ["Getting Started: Core Vocabulary", "Everyday Conversation", "Confidence Building"],
  "Exam Prep": ["Diagnostic & Foundations", "Core Skills Practice", "Timed Mock Practice"],
  General: ["Module 1: Introduction", "Module 2: Core Skills", "Module 3: Applied Practice"],
};

const CATEGORY_CAPABILITIES = {
  // Language academies lean conversational/social early — messaging matters from day one,
  // community usually doesn't exist yet with zero learners.
  Language: { aiTutor: true, assessments: true, certificates: true, schedule: true, messages: true, community: false },
  // Exam prep leans structured/scored — assessments and certificates matter immediately,
  // live scheduling and messaging are typically added once there's a cohort.
  "Exam Prep": { aiTutor: true, assessments: true, certificates: true, schedule: false, messages: false, community: false },
  // Unknown category — most conservative defaults, everything opt-in except the AI assistant.
  General: { aiTutor: true, assessments: false, certificates: false, schedule: false, messages: false, community: false },
};

/* Builds a full CONTENT-shaped object for a brand-new Workspace on day one:
   one owner, zero learners, zero revenue — an honest empty state rather
   than pre-seeded demo data, since that is what WorkspacePublished
   actually looks like before any Membership or Enrollment exists. */
const PRESET_LOGO_STYLE = { botanical: "leaf", afterhours: "circuit", editorial: "bracket" };

function buildAcademyContent(form) {
  const courseNames = CATEGORY_COURSES[form.category] || CATEGORY_COURSES.General;
  return {
    name: form.name || "New Academy",
    tagline: form.tagline || "A new learning workspace.",
    mark: (form.name || "N").trim()[0]?.toUpperCase() || "N",
    logoStyle: PRESET_LOGO_STYLE[form.presetId] || "geometric",
    aiName: form.aiName || "Aria",
    aiRole: "your workspace AI",
    ownerRole: form.ownerRole || "Instructor",
    learnerName: "Jordan",
    ownerPerson: form.ownerPerson || "You",
    teachingStyle: form.teachingStyle,
    feedbackStyle: form.feedbackStyle,
    capabilities: { ...(CATEGORY_CAPABILITIES[form.category] || CATEGORY_CAPABILITIES.General) },
    courses: courseNames.map((title, i) => ({
      id: `new-c${i}`, title, lessons: 0, progress: 0, price: "Not priced yet", enrolled: 0,
    })),
    activeLesson: {
      title: "No lesson published yet", course: courseNames[0], duration: "—",
      events: [], question: { prompt: "", options: [], correct: 0 },
    },
    uploadFile: "your_first_lesson.mp4",
    aiDraft: {
      title: "Your first AI-drafted lesson will appear here",
      objectives: [], questions: [],
    },
    members: [{ name: form.ownerPerson || "You", role: form.ownerRole || "Instructor", status: "Active" }],
    sessions: [], orders: [],
    revenue: { total: "$0", mrr: "$0", trend: "Just launched" },
    insight: "No learner activity yet — insights will appear once your first learners enrol.",
    announcements: [], assessmentsOwner: [], certificatesIssued: [], communityPosts: [],
    learnerAssessments: [], learnerCertificates: [], learnerSessions: [], messagesThread: [],
  };
}

/* =========================================================================
   CONTENT — every bounded context's data, per Academy.
   ========================================================================= */

const CONTENT = {
  lumen: {
    name: "Lumen Language Academy", tagline: "Learn to speak, not just study.", mark: "L",
    logoStyle: "stamp",
    aiName: "Mira", aiRole: "your conversation partner", ownerRole: "Mentor",
    learnerName: "Jordan", ownerPerson: "Fatima N.",
    capabilities: { aiTutor: true, assessments: true, certificates: true, schedule: true, messages: true, community: true },

    courses: [
      { id: "c1", title: "Everyday Conversation A2", lessons: 12, progress: 64, price: "$99", enrolled: 34 },
      { id: "c2", title: "Confident Speaking B1", lessons: 9, progress: 30, price: "$29/mo", enrolled: 21 },
      { id: "c3", title: "Travel & Culture Immersion", lessons: 15, progress: 8, price: "$149", enrolled: 9 },
    ],
    activeLesson: {
      title: "Ordering at a Parisian Café", course: "Travel & Culture Immersion", duration: "07:40",
      events: [
        { t: "01:15", label: "Vocabulary: l'addition" },
        { t: "03:40", label: "Question · listening check" },
        { t: "05:55", label: "Practice: your turn to order" },
      ],
      question: {
        prompt: "In this scene, what does the waiter mean by “l'addition”?",
        options: ["The menu", "The bill", "A recommendation", "The tip"], correct: 1,
      },
    },
    uploadFile: "cafe_conversation_take3.mp4",
    aiDraft: {
      title: "Ordering Confidently in French Cafés",
      objectives: [
        "Recognise café vocabulary in natural speech",
        "Respond appropriately when the bill arrives",
        "Practise polite requests using conditional phrasing",
      ],
      questions: [
        { t: "01:15", type: "Vocabulary", text: "What does “l'addition” mean here?", status: "pending" },
        { t: "03:40", type: "Listening", text: "What did the customer order first?", status: "pending" },
        { t: "05:55", type: "Practice", text: "Record yourself ordering the same item.", status: "pending" },
      ],
    },

    members: [
      { name: "Jordan Byrne", role: "Learner", status: "Active" },
      { name: "Diego R.", role: "Learner", status: "Active" },
      { name: "Fatima N.", role: "Mentor", status: "Active" },
      { name: "Yuki T.", role: "Learner", status: "Invited" },
    ],
    sessions: [
      { title: "Conversation Circle: Café Culture", when: "Tue · 5:00 PM", people: 6 },
      { title: "1:1 Speaking Practice — Jordan", when: "Wed · 6:30 PM", people: 1 },
      { title: "Travel Immersion Workshop", when: "Sat · 10:00 AM", people: 14 },
    ],
    orders: [
      { learner: "Jordan Byrne", product: "Travel & Culture Immersion", amount: "$149", status: "Paid" },
      { learner: "Diego R.", product: "Confident Speaking B1", amount: "$29/mo", status: "Active subscription" },
      { learner: "Yuki T.", product: "Everyday Conversation A2", amount: "$99", status: "Pending" },
    ],
    revenue: { total: "$4,280", mrr: "$610", trend: "+12% this month" },
    insight: "Learners drop off after Lesson 9 in Travel & Culture Immersion — consider adding a shorter practice checkpoint there.",
    announcements: [
      { title: "New immersion weekend added for October", date: "2 days ago", audience: "All learners" },
      { title: "Café Culture circle moves to Tuesdays", date: "5 days ago", audience: "Travel Immersion" },
    ],
    assessmentsOwner: [{ name: "Speaking Fluency Check", type: "AI + Mentor", avgScore: "82%" }],
    certificatesIssued: [{ learner: "Diego R.", cert: "Everyday Conversation A2 — Completed" }],
    communityPosts: [
      { author: "Diego R.", text: "Finally ordered a full meal in French without switching to English 🎉", replies: 4 },
      { author: "Mira (AI)", text: "This week's challenge: record yourself asking for directions.", replies: 9 },
    ],

    learnerAssessments: [{ name: "Speaking Fluency Check — Week 4", status: "Graded", score: "82%", feedback: "Strong vocabulary — work on liaison sounds." }],
    learnerCertificates: [
      { name: "Café Culture Basics", issued: "Aug 2025", status: "earned" },
      { name: "Everyday Conversation A2", issued: null, status: "68% complete" },
    ],
    learnerSessions: [
      { title: "Conversation Circle: Café Culture", when: "Tue · 5:00 PM" },
      { title: "1:1 Speaking Practice", when: "Wed · 6:30 PM" },
    ],
    messagesThread: [
      { from: "mentor", text: "Great progress this week — keep practicing the café dialogue!" },
      { from: "user", text: "Thank you! Can we add an extra session before my trip?" },
      { from: "mentor", text: "Of course — I'll add one for Saturday." },
    ],
  },

  vantage: {
    name: "Vantage Exam Prep", tagline: "Precision practice. Measurable results.", mark: "V",
    logoStyle: "ledger",
    aiName: "Scout", aiRole: "your prep analyst", ownerRole: "Instructor",
    learnerName: "Jordan", ownerPerson: "Dr. Chen",
    capabilities: { aiTutor: true, assessments: true, certificates: true, schedule: true, messages: true, community: true },

    courses: [
      { id: "c1", title: "IELTS Full Mastery", lessons: 24, progress: 71, price: "$220", enrolled: 58 },
      { id: "c2", title: "SAT Math Intensive", lessons: 18, progress: 45, price: "$45/mo", enrolled: 42 },
      { id: "c3", title: "GRE Verbal Bootcamp", lessons: 20, progress: 12, price: "$180", enrolled: 15 },
    ],
    activeLesson: {
      title: "IELTS Speaking Part 2: Fluency Under Pressure", course: "IELTS Full Mastery", duration: "11:20",
      events: [
        { t: "02:05", label: "Concept: cue card structure" },
        { t: "05:30", label: "Question · scored check" },
        { t: "08:45", label: "Practice: 2-minute timed response" },
      ],
      question: {
        prompt: "A strong cue-card answer should be structured around:",
        options: ["One long anecdote", "Topic, detail, reflection", "Only opinions", "Memorised phrases"], correct: 1,
      },
    },
    uploadFile: "ielts_speaking_part2_raw.mp4",
    aiDraft: {
      title: "IELTS Speaking Part 2 — Structuring Under Time Pressure",
      objectives: [
        "Apply the topic → detail → reflection structure in 2 minutes",
        "Identify filler-word patterns that cost fluency points",
        "Self-score a response against the band descriptors",
      ],
      questions: [
        { t: "02:05", type: "Concept", text: "Which structural element is missing from the sample answer?", status: "pending" },
        { t: "05:30", type: "Scored", text: "Score this response's coherence 1–9.", status: "pending" },
        { t: "08:45", type: "Practice", text: "Record a 2-minute timed response.", status: "pending" },
      ],
    },

    members: [
      { name: "Jordan Byrne", role: "Learner", status: "Active" },
      { name: "Michael O.", role: "Learner", status: "Active" },
      { name: "Dr. Chen", role: "Instructor", status: "Active" },
      { name: "Sara W.", role: "Learner", status: "Invited" },
    ],
    sessions: [
      { title: "Timed Mock — Full IELTS", when: "Mon · 4:00 PM", people: 22 },
      { title: "1:1 Score Review — Jordan", when: "Thu · 6:00 PM", people: 1 },
      { title: "SAT Math Drill Group", when: "Sat · 9:00 AM", people: 11 },
    ],
    orders: [
      { learner: "Jordan Byrne", product: "IELTS Full Mastery", amount: "$220", status: "Paid" },
      { learner: "Michael O.", product: "SAT Math Intensive", amount: "$45/mo", status: "Active subscription" },
      { learner: "Sara W.", product: "GRE Verbal Bootcamp", amount: "$180", status: "Pending" },
    ],
    revenue: { total: "$9,140", mrr: "$1,320", trend: "+18% this month" },
    insight: "Coherence scores dip sharply after 90 seconds in timed drills — consider a mid-response pacing cue.",
    announcements: [
      { title: "New timed mock exam released for IELTS", date: "1 day ago", audience: "IELTS Full Mastery" },
      { title: "SAT drill group moved to Saturdays", date: "4 days ago", audience: "SAT Math Intensive" },
    ],
    assessmentsOwner: [{ name: "Timed Coherence Rubric", type: "AI + Instructor", avgScore: "7.1 / 9" }],
    certificatesIssued: [{ learner: "Michael O.", cert: "SAT Math Intensive — Diagnostic Passed" }],
    communityPosts: [
      { author: "Michael O.", text: "Hit 720 on the practice SAT math section today.", replies: 6 },
      { author: "Scout (AI)", text: "This week's drill: 3 timed responses, self-scored against the rubric.", replies: 11 },
    ],

    learnerAssessments: [{ name: "Timed Coherence Rubric — Attempt 3", status: "Graded", score: "7.1 / 9", feedback: "Strong structure — reduce filler words under time pressure." }],
    learnerCertificates: [
      { name: "IELTS Diagnostic Badge", issued: "Jun 2025", status: "earned" },
      { name: "IELTS Full Mastery", issued: null, status: "71% complete" },
    ],
    learnerSessions: [
      { title: "Timed Mock — Full IELTS", when: "Mon · 4:00 PM" },
      { title: "1:1 Score Review", when: "Thu · 6:00 PM" },
    ],
    messagesThread: [
      { from: "mentor", text: "Your last mock improved 0.5 bands — solid work." },
      { from: "user", text: "Thanks — can you review my speaking recording before Thursday?" },
      { from: "mentor", text: "Sending feedback tonight." },
    ],
  },
};

/* =========================================================================
   GENERATED VISUAL IDENTITY — logo mark + curriculum cover art.
   Deterministic (seeded by name), on-brand (uses this Workspace's own
   tokens), and network-free — the safer default for a prototype vs.
   hotlinking stock photography. Both accept a real image URL and will
   render that instead the moment one exists (see `logoUrl` / `imageUrl`),
   so swapping in real brand assets later is a one-line change.
   ========================================================================= */

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function BrandMark({ c, size = 34 }) {
  if (c.logoUrl) return <img src={c.logoUrl} alt={`${c.name} logo`} className="lw-brandmark" style={{ width: size, height: size, borderRadius: "var(--radius-sm)", objectFit: "cover" }} />;

  const style = c.logoStyle || "geometric";
  const s = size;
  const inner = {
    stamp: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="10" fill="var(--accent)" />
        <circle cx="20" cy="20" r="12" fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="2.6 2.6" opacity="0.9" />
        <path d="M13 17 L20 23 L27 17" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="13" y="14" width="14" height="10" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.8" />
      </svg>
    ),
    ledger: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="6" fill="var(--accent)" />
        <rect x="10" y="12" width="20" height="3" rx="1.5" fill="#fff" opacity="0.95" />
        <rect x="10" y="18" width="14" height="3" rx="1.5" fill="#fff" opacity="0.7" />
        <rect x="10" y="24" width="17" height="3" rx="1.5" fill="#fff" opacity="0.5" />
        <path d="M27 23 L30 26 L34 20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    leaf: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="14" fill="var(--accent)" />
        <path d="M12 27 C12 15 22 10 30 11 C29 20 24 27 12 27 Z" fill="#fff" opacity="0.95" />
        <path d="M13 26 C18 21 22 17 29 12" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    circuit: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="6" fill="#0D0F12" />
        <circle cx="14" cy="14" r="2.4" fill="var(--accent)" />
        <circle cx="27" cy="14" r="2.4" fill="var(--accent-2)" />
        <circle cx="14" cy="27" r="2.4" fill="var(--accent-2)" />
        <circle cx="27" cy="27" r="2.4" fill="var(--accent)" />
        <path d="M14 14 L27 14 M14 14 L14 27 M27 14 L27 27 M14 27 L27 27 M14 14 L27 27" stroke="#3A3F47" strokeWidth="1.1" />
      </svg>
    ),
    bracket: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="3" fill="var(--accent)" />
        <path d="M16 11 L10 20 L16 29" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 11 L30 20 L24 29" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    geometric: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="10" fill="var(--accent)" />
        <text x="20" y="26" fontSize="18" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="var(--font-display)">{c.mark}</text>
      </svg>
    ),
  };
  return <div className="lw-brandmark">{inner[style] || inner.geometric}</div>;
}

/* Deterministic abstract cover art for a course/product, standing in for
   curriculum photography until real images are uploaded. Seeded by title
   so the same course always renders the same cover. */
function CourseCover({ title, imageUrl, height = 72, width = "100%" }) {
  if (imageUrl) return <div className="lw-cover" style={{ height, width }}><img src={imageUrl} alt={title} /></div>;

  const h = hashStr(title || "course");
  const angle = h % 360;
  const variant = h % 3;
  const cx1 = 20 + (h % 30), cy1 = 15 + ((h >> 3) % 25);
  const cx2 = 60 + ((h >> 5) % 30), cy2 = 55 + ((h >> 7) % 25);

  return (
    <div className="lw-cover" style={{ height, width }}>
      <svg viewBox="0 0 100 72" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <rect width="100" height="72" fill="var(--surface-2)" />
        <g transform={`rotate(${angle % 40} 50 36)`} opacity="0.9">
          <circle cx={cx1} cy={cy1} r="26" fill="var(--accent)" opacity="0.55" />
          <circle cx={cx2} cy={cy2} r="22" fill="var(--accent-2)" opacity="0.55" />
          {variant === 0 && <rect x="30" y="10" width="40" height="40" rx="8" fill="var(--ink)" opacity="0.12" />}
          {variant === 1 && <circle cx="50" cy="36" r="16" fill="none" stroke="var(--ink)" strokeWidth="1.5" opacity="0.25" strokeDasharray="3 3" />}
          {variant === 2 && <path d="M10 55 L40 25 L60 45 L90 15" fill="none" stroke="var(--ink)" strokeWidth="1.5" opacity="0.2" />}
        </g>
      </svg>
    </div>
  );
}

function useFonts() {
  useEffect(() => {
    const href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Karla:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = href;
    document.head.appendChild(link);
  }, []);
}

/* =========================================================================
   PROTOTYPE CONTROL STRIP — demo harness, never seen by a real learner.
   ========================================================================= */

/* =========================================================================
   ACADEMY HEADER — full-width, bright identity bar for the Learner
   section only. Sits above the Nav/Content shell rather than being
   confined to the sidebar corner, so the academy's name and mark read
   immediately on entry (Workspace Resolution activating branding first).
   ========================================================================= */

function AcademyHeader({ c }) {
  return (
    <div className="lw-academyheader">
      <div className="lw-academyheader__mark"><BrandMark c={c} size={40} /></div>
      <div className="lw-academyheader__text">
        <div className="lw-academyheader__name">{c.name}</div>
        <div className="lw-academyheader__tagline">{c.tagline}</div>
      </div>
    </div>
  );
}

function ControlStrip({ academyList, academy, setAcademy, role, setRole, onReset, onNewAcademy, ownerRole }) {
  return (
    <div className="lw-controlstrip">
      <span className="lw-controlstrip__label">PROTOTYPE · demo harness, not part of the product</span>
      <div className="lw-controlstrip__group">
        <span>Academy</span>
        {academyList.map((a) => (
          <button key={a.key} className={academy === a.key ? "active" : ""} onClick={() => setAcademy(a.key)}>{a.label}</button>
        ))}
        <button className="lw-controlstrip__new" onClick={onNewAcademy}><Plus size={12} /> New academy</button>
      </div>
      <div className="lw-controlstrip__group">
        <span>Viewing as</span>
        <button className={role === "learner" ? "active" : ""} onClick={() => setRole("learner")}>Learner</button>
        <button className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")}>{ownerRole}</button>
      </div>
      <button className="lw-controlstrip__reset" onClick={onReset} title="Reset content studio flow">
        <RotateCcw size={13} /> Reset studio
      </button>
    </div>
  );
}

/* =========================================================================
   NAV
   ========================================================================= */

const LEARNER_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "lesson", label: "Continue Lesson", icon: PlayCircle },
  { id: "assessments", label: "Assessments", icon: ClipboardCheck, capability: "assessments" },
  { id: "certificates", label: "Certificates", icon: Award, capability: "certificates" },
  { id: "schedule", label: "Schedule", icon: Calendar, capability: "schedule" },
  { id: "messages", label: "Messages", icon: MessageSquare, capability: "messages" },
  { id: "community", label: "Community", icon: MessageCircle, capability: "community" },
  { id: "ai", label: "__AI__", icon: Bot, capability: "aiTutor" },
];

/* Maps a Learner nav id to the Workspace capability that gates it — the
   single source of truth used by both Nav (to hide items) and App (to
   redirect away from a screen an Owner just turned off). */
const NAV_CAPABILITY = Object.fromEntries(LEARNER_NAV.filter((i) => i.capability).map((i) => [i.id, i.capability]));

const OWNER_NAV = [
  { divider: "Grow" },
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "products", label: "Learning Products", icon: BookOpen },
  { id: "studio", label: "Content Studio", icon: Wand2 },
  { divider: "Operate" },
  { id: "members", label: "Members", icon: Users },
  { id: "scheduling", label: "Scheduling", icon: Calendar },
  { id: "commerce", label: "Commerce", icon: CreditCard },
  { id: "communication", label: "Communication", icon: Megaphone },
  { divider: "Prove" },
  { id: "assessment", label: "Assessment & Certificates", icon: Award },
  { divider: "Configure" },
  { id: "settings", label: "Workspace Settings", icon: Settings },
];

function Nav({ c, role, screen, setScreen, onOpenProfile }) {
  const items = role === "learner"
    ? LEARNER_NAV.filter((it) => !it.capability || c.capabilities[it.capability] !== false)
    : OWNER_NAV;
  return (
    <div className="lw-nav">
      <div className="lw-nav__brand">
        <BrandMark c={c} size={34} />
        <div>
          <div className="lw-nav__name">{c.name}</div>
          <div className="lw-nav__tagline">{c.tagline}</div>
        </div>
      </div>
      <div className="lw-nav__items">
        {items.map((it, i) =>
          it.divider ? (
            <div className="lw-nav__divider" key={`d${i}`}>{it.divider}</div>
          ) : (
            <button
              key={it.id}
              className={`lw-nav__item ${screen === it.id ? "is-active" : ""}`}
              onClick={() => setScreen(it.id)}
            >
              <it.icon size={16} />
              {it.label === "__AI__" ? c.aiName : it.label}
            </button>
          )
        )}
      </div>
      <button className="lw-nav__profile" onClick={onOpenProfile}>
        <UserCircle size={16} /> My professional profile
      </button>
      <div className="lw-nav__person">
        <div className="lw-nav__avatar">{(role === "learner" ? c.learnerName : c.ownerPerson)[0]}</div>
        <div>
          <div className="lw-nav__personname">{role === "learner" ? c.learnerName : c.ownerPerson}</div>
          <div className="lw-nav__personrole">{role === "learner" ? "Learner" : c.ownerRole}</div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   LEARNER SCREENS
   ========================================================================= */

function LearnerDashboard({ c, academy, setScreen }) {
  return (
    <div className="lw-page">
      <div className="lw-greeting">
        <div>
          <div className="lw-eyebrow">Welcome back</div>
          <h1>{academy === "lumen" ? `Bonjour, ${c.learnerName}.` : `Let's raise that score, ${c.learnerName}.`}</h1>
          <p>{academy === "lumen" ? "You practised 4 days this week — your best streak yet." : "3 practice sessions logged this week. Consistency is compounding."}</p>
        </div>
        <button className="lw-btn lw-btn--accent" onClick={() => setScreen("lesson")}>Continue lesson <ArrowRight size={16} /></button>
      </div>

      <div className={c.capabilities.aiTutor ? "lw-grid3" : "lw-grid2"}>
        <div className="lw-card lw-stampcard">
          <div className="lw-card__eyebrow"><Clock size={14} /> In progress</div>
          <div className="lw-card__title">{c.activeLesson.title}</div>
          <div className="lw-card__meta">{c.activeLesson.course} · {c.activeLesson.duration}</div>
        </div>
        <div className="lw-card">
          <div className="lw-card__eyebrow"><BarChart3 size={14} /> This month</div>
          <div className="lw-meter">{Array.from({ length: 12 }).map((_, i) => <span key={i} className={i < 8 ? "filled" : ""} />)}</div>
          <div className="lw-card__meta">8 of 12 sessions complete</div>
        </div>
        {c.capabilities.aiTutor && (
          <div className="lw-card">
            <div className="lw-card__eyebrow"><Bot size={14} /> {c.aiName}</div>
            <div className="lw-card__title" style={{ fontSize: "1rem" }}>
              {academy === "lumen" ? "“Ready to practise ordering food today?”" : "“Your coherence score dipped in timed drills — let's fix that.”"}
            </div>
            <button className="lw-btn lw-btn--ghost" onClick={() => setScreen("ai")}>Open chat</button>
          </div>
        )}
      </div>

      <h2 className="lw-sectiontitle">Your courses</h2>
      <div className="lw-grid3">
        {c.courses.map((course) => (
          <div className="lw-card lw-coursecard" key={course.id} onClick={() => setScreen("courses")}>
            <CourseCover title={course.title} imageUrl={course.imageUrl} height={78} />
            <div className="lw-card__title" style={{ marginTop: 12 }}>{course.title}</div>
            <div className="lw-card__meta">{course.lessons} lessons</div>
            <div className="lw-progressbar"><span style={{ width: `${course.progress}%` }} /></div>
            <div className="lw-card__meta">{course.progress}% complete</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearnerCourses({ c, published, setScreen }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Your Academy</div>
      <h1>Courses</h1>
      <div className="lw-list">
        {published.length > 0 && (
          <div className="lw-listrow lw-listrow--new">
            <div className="lw-listrow__icon"><Sparkles size={18} /></div>
            <div className="lw-listrow__body">
              <div className="lw-listrow__title">{published[published.length - 1].title} <span className="lw-tag lw-tag--new">New</span></div>
              <div className="lw-listrow__meta">Just published by your {c.ownerRole.toLowerCase()} · added to {c.courses[0].title}</div>
            </div>
            <button className="lw-btn lw-btn--sm" onClick={() => setScreen("lesson")}>Start</button>
          </div>
        )}
        {c.courses.map((course) => (
          <div className="lw-listrow" key={course.id}>
            <CourseCover title={course.title} imageUrl={course.imageUrl} width={44} height={44} />
            <div className="lw-listrow__body">
              <div className="lw-listrow__title">{course.title}</div>
              <div className="lw-listrow__meta">{course.lessons} lessons · {course.progress}% complete</div>
            </div>
            <button className="lw-btn lw-btn--sm" onClick={() => setScreen("lesson")}>Open</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearnerLesson({ c, academy }) {
  const [answered, setAnswered] = useState(false);
  const [choice, setChoice] = useState(null);
  const q = c.activeLesson.question;
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">{c.activeLesson.course}</div>
      <h1>{c.activeLesson.title}</h1>
      <div className="lw-player">
        <div className="lw-player__frame"><PlayCircle size={52} /><span>{c.activeLesson.duration} · interactive lesson</span></div>
        <div className="lw-timeline">
          {c.activeLesson.events.map((ev, i) => (
            <div className="lw-timeline__event" key={i}>
              <span className="lw-timeline__dot" /><span className="lw-timeline__time">{ev.t}</span><span className="lw-timeline__label">{ev.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="lw-card lw-questioncard">
        <div className="lw-card__eyebrow"><Mic size={14} /> Question event · 03:40</div>
        <div className="lw-questioncard__prompt">{q.prompt}</div>
        <div className="lw-options">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct, isChosen = i === choice;
            return (
              <button key={i} className={`lw-option ${answered && isCorrect ? "is-correct" : ""} ${answered && isChosen && !isCorrect ? "is-wrong" : ""}`}
                onClick={() => { setChoice(i); setAnswered(true); }} disabled={answered}>
                <span>{opt}</span>
                {answered && isCorrect && <Check size={16} />}
                {answered && isChosen && !isCorrect && <XCircle size={16} />}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="lw-feedback">
            <Bot size={15} />
            {academy === "lumen" ? `${c.aiName}: Exactement — "l'addition" is how you ask for the bill.` : `${c.aiName}: Correct. Structure drives coherence score — log this pattern.`}
          </div>
        )}
      </div>
    </div>
  );
}

function LearnerAssessments({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Assessment Context</div>
      <h1>Assessments</h1>
      <p className="lw-sub">How your achievement is measured — kept separate from the lessons themselves.</p>
      <div className="lw-list">
        {c.learnerAssessments.map((a, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon"><ClipboardCheck size={18} /></div>
            <div className="lw-listrow__body">
              <div className="lw-listrow__title">{a.name} <span className="lw-tag">{a.status}</span></div>
              <div className="lw-listrow__meta">{a.feedback}</div>
            </div>
            <div className="lw-scorepill">{a.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearnerCertificates({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Achievement</div>
      <h1>Certificates</h1>
      <div className="lw-badgegrid">
        {c.learnerCertificates.map((cert, i) => (
          <div className={`lw-badge ${cert.status === "earned" ? "is-earned" : ""}`} key={i}>
            <Award size={26} />
            <div className="lw-badge__name">{cert.name}</div>
            <div className="lw-badge__meta">{cert.status === "earned" ? `Earned · ${cert.issued}` : cert.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearnerSchedule({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Scheduling Context</div>
      <h1>Your schedule</h1>
      <div className="lw-list">
        {c.learnerSessions.map((s, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon"><Calendar size={18} /></div>
            <div className="lw-listrow__body">
              <div className="lw-listrow__title">{s.title}</div>
              <div className="lw-listrow__meta">{s.when}</div>
            </div>
            <button className="lw-btn lw-btn--sm">Add to calendar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearnerMessages({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Communication Context</div>
      <h1>Messages</h1>
      <div className="lw-chat">
        {c.messagesThread.map((m, i) => (
          <div key={i} className={`lw-bubble lw-bubble--${m.from === "user" ? "user" : "ai"}`}>
            {m.from !== "user" && <span className="lw-bubble__avatar">{c.ownerPerson[0]}</span>}
            {m.text}
          </div>
        ))}
        <div className="lw-chatinput"><input placeholder={`Message ${c.ownerPerson}…`} /><button className="lw-btn lw-btn--accent lw-btn--sm"><Send size={14} /></button></div>
      </div>
    </div>
  );
}

function LearnerCommunity({ c }) {
  const [posts, setPosts] = useState(c.communityPosts);
  const [draft, setDraft] = useState("");
  const add = () => { if (!draft.trim()) return; setPosts([{ author: c.learnerName, text: draft, replies: 0 }, ...posts]); setDraft(""); };
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Community Context</div>
      <h1>Community</h1>
      <div className="lw-composer">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Share something with the academy…" />
        <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={add}><Send size={14} /></button>
      </div>
      <div className="lw-list">
        {posts.map((p, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon">{p.author.includes("AI") ? <Bot size={18} /> : p.author[0]}</div>
            <div className="lw-listrow__body">
              <div className="lw-listrow__title">{p.author}</div>
              <div className="lw-listrow__meta">{p.text}</div>
            </div>
            <div className="lw-tag">{p.replies} replies</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearnerAI({ c, academy }) {
  const convo = academy === "lumen"
    ? [{ from: "ai", text: "Salut! Want to practise ordering dessert next?" }, { from: "user", text: "Yes — but I always forget how to ask for the bill politely." }, { from: "ai", text: "Try: “L'addition, s'il vous plaît.” Want to record yourself saying it?" }]
    : [{ from: "ai", text: "Your last timed response scored 6.5 on coherence. Want to see why?" }, { from: "user", text: "Yes, I think I ran out of structure halfway through." }, { from: "ai", text: "Correct — you dropped the reflection step. Let's drill that specifically." }];
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">AI Context · scoped to {c.name} only</div>
      <h1>{c.aiName}</h1>
      <p className="lw-sub">{c.aiRole}, tuned to this academy's teaching style. {c.aiName} never sees data from any other workspace.</p>
      <div className="lw-chat">
        {convo.map((m, i) => (<div key={i} className={`lw-bubble lw-bubble--${m.from}`}>{m.from === "ai" && <Bot size={14} />}{m.text}</div>))}
        <div className="lw-chatinput"><input placeholder={academy === "lumen" ? "Ask Mira anything…" : "Ask Scout for a drill or score breakdown…"} /><button className="lw-btn lw-btn--accent lw-btn--sm"><Send size={14} /></button></div>
      </div>
    </div>
  );
}

/* =========================================================================
   OWNER / WORKSPACE-OWNER SCREENS
   ========================================================================= */

function OwnerOverview({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Analytics + AI Business Assistant</div>
      <h1>Overview</h1>
      <div className="lw-grid3">
        <div className="lw-card"><div className="lw-card__eyebrow"><TrendingUp size={14} /> Revenue</div><div className="lw-stat">{c.revenue.total}</div><div className="lw-card__meta">{c.revenue.trend}</div></div>
        <div className="lw-card"><div className="lw-card__eyebrow"><CreditCard size={14} /> MRR</div><div className="lw-stat">{c.revenue.mrr}</div><div className="lw-card__meta">Recurring commerce</div></div>
        <div className="lw-card"><div className="lw-card__eyebrow"><Users size={14} /> Members</div><div className="lw-stat">{c.members.length}</div><div className="lw-card__meta">Across all roles</div></div>
      </div>
      <div className="lw-principle" style={{ marginTop: 24 }}>
        <Sparkles size={16} />
        <span><strong>AI Business Assistant:</strong> {c.insight}</span>
      </div>
      <h2 className="lw-sectiontitle">Top learning products</h2>
      <div className="lw-list">
        {c.courses.map((course) => (
          <div className="lw-listrow" key={course.id}>
            <div className="lw-listrow__icon"><BookOpen size={18} /></div>
            <div className="lw-listrow__body"><div className="lw-listrow__title">{course.title}</div><div className="lw-listrow__meta">{course.enrolled} enrolled · {course.price}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   PSEUDO-AI HELPERS for the Product Builder.
   These simulate what the AI Content Assistant / AI Business Assistant
   would return (per AI Context §4.5 and the Product Content Strategy
   docs) — templated rather than a live model call, since this is a
   prototype, but the SHAPE of every suggestion matches what the docs
   describe the real AI Context returning.
   ========================================================================= */

const UNIT_THEME_BANK = {
  Language: ["Foundations & Greetings", "Everyday Situations", "Building Fluency", "Real-World Immersion"],
  "Exam Prep": ["Diagnostic & Foundations", "Core Skills Drilling", "Timed Practice", "Final Review & Mock Exams"],
  General: ["Getting Started", "Core Concepts", "Applied Practice", "Mastery & Review"],
};

function aiOutline(topic, category) {
  const bank = UNIT_THEME_BANK[category] || UNIT_THEME_BANK.General;
  const title = topic.trim() ? topic.trim() : "Untitled Product";
  const description =
    category === "Language"
      ? `A structured path to help learners build real conversational confidence in ${topic || "this topic"}.`
      : category === "Exam Prep"
      ? `A focused, scored path to help learners achieve their target result in ${topic || "this exam"}.`
      : `A guided path to help learners master ${topic || "this subject"} step by step.`;
  return {
    title, description,
    units: bank.slice(0, 3).map((theme, i) => ({
      title: theme,
      lessons: [`Introduction to ${theme}`, i < 2 ? `Practicing ${theme}` : `Review: ${theme}`],
    })),
  };
}

function aiNextUnit(existingTitles, category) {
  const bank = UNIT_THEME_BANK[category] || UNIT_THEME_BANK.General;
  const next = bank.find((t) => !existingTitles.includes(t)) || `Advanced: ${category || "Topic"}`;
  const basis = existingTitles[existingTitles.length - 1];
  return {
    title: next,
    rationale: basis
      ? `Suggested because your last unit was "${basis}" — this is the natural next step for ${category || "this"} learners.`
      : `Suggested as a strong starting point for a new ${category || ""} product.`,
  };
}

function aiLessonObjective(title) {
  const t = title.toLowerCase();
  if (t.includes("practi")) return `By the end of this lesson, learners can apply "${title}" in a realistic scenario.`;
  if (t.includes("review")) return `By the end of this lesson, learners can self-assess their progress on "${title}".`;
  return `By the end of this lesson, learners can recognise and explain the core idea behind "${title}".`;
}

function aiVideoDraft(filename) {
  const cleanTitle = (filename || "lesson").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
  return {
    title: `${cleanTitle} — AI Draft`,
    questions: [
      { t: "01:20", type: "Concept Check", text: "What is the main idea introduced so far?", rationale: "Placed right after the explanation, to check understanding immediately." },
      { t: "04:10", type: "Prediction", text: "What do you think happens next?", rationale: "Placed before the example, to prompt an active prediction." },
      { t: "07:00", type: "Application", text: "Try applying this yourself now.", rationale: "Placed after the example, to check the learner can apply it." },
    ],
  };
}

/* =========================================================================
   PRODUCT BUILDER — Units → Lessons → Interactive Videos,
   with AI assistance surfaced at every step.
   ========================================================================= */

function AiSuggestBanner({ icon: Icon = Lightbulb, children, onAccept, onDismiss, acceptLabel = "Accept" }) {
  return (
    <div className="lw-aicard">
      <Icon size={16} />
      <div className="lw-aicard__body">{children}</div>
      <div className="lw-aicard__actions">
        {onAccept && <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onAccept}>{acceptLabel}</button>}
        {onDismiss && <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onDismiss}>Dismiss</button>}
      </div>
    </div>
  );
}

function NewProductPanel({ onCreate, onCancel }) {
  const [mode, setMode] = useState("choose"); // choose | blank | ai | ai-loading | ai-review
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("General");
  const [draft, setDraft] = useState(null);
  const [blankTitle, setBlankTitle] = useState("");
  const [blankDesc, setBlankDesc] = useState("");

  const runAi = () => {
    setMode("ai-loading");
    setTimeout(() => { setDraft(aiOutline(topic, category)); setMode("ai-review"); }, 1200);
  };

  return (
    <div className="lw-card" style={{ marginBottom: 20 }}>
      {mode === "choose" && (
        <>
          <div className="lw-card__eyebrow">New learning product</div>
          <div className="lw-wizardnav" style={{ justifyContent: "flex-start", gap: 10, marginTop: 8 }}>
            <button className="lw-btn lw-btn--accent" onClick={() => setMode("ai")}><Sparkles size={15} /> Draft with AI</button>
            <button className="lw-btn lw-btn--ghost" onClick={() => setMode("blank")}>Start blank</button>
            <button className="lw-btn lw-btn--ghost" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}

      {mode === "ai" && (
        <div className="lw-wizardbody" style={{ gap: 10 }}>
          <div className="lw-card__eyebrow"><Sparkles size={13} style={{ verticalAlign: "-2px" }} /> AI Content Assistant</div>
          <div className="lw-wfield"><label>What's this product about?</label><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Business English for meetings" /></div>
          <div className="lw-wfield">
            <label>Category</label>
            <div className="lw-segctrl">{Object.keys(UNIT_THEME_BANK).map((cat) => <button key={cat} className={category === cat ? "active" : ""} onClick={() => setCategory(cat)}>{cat}</button>)}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lw-btn lw-btn--accent" onClick={runAi}>Generate outline <ArrowRight size={15} /></button>
            <button className="lw-btn lw-btn--ghost" onClick={() => setMode("choose")}>Back</button>
          </div>
        </div>
      )}

      {mode === "ai-loading" && (
        <div className="lw-analyzing"><div className="lw-spinner" /><div>AI Content Assistant is drafting a product outline for "{topic || "your topic"}"…</div></div>
      )}

      {mode === "ai-review" && draft && (
        <div className="lw-wizardbody" style={{ gap: 12 }}>
          <AiSuggestBanner>AI drafted a full outline below. Nothing is created until you approve it — you stay the source of truth (AI assists, you own it).</AiSuggestBanner>
          <div className="lw-wfield"><label>Product title</label><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="lw-wfield"><label>Description</label><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div className="lw-list">
            {draft.units.map((u, i) => (
              <div className="lw-listrow" key={i}>
                <div className="lw-listrow__icon"><Layers size={16} /></div>
                <div className="lw-listrow__body"><div className="lw-listrow__title">{u.title}</div><div className="lw-listrow__meta">{u.lessons.join(" · ")}</div></div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lw-btn lw-btn--accent" onClick={() => onCreate({ title: draft.title, description: draft.description, category, units: draft.units.map((u, ui) => ({ id: `u${ui}`, title: u.title, lessons: u.lessons.map((lt, li) => ({ id: `l${ui}-${li}`, title: lt, type: "text", status: "Draft" })) })) }, true)}>
              <Check size={15} /> Create product from draft
            </button>
            <button className="lw-btn lw-btn--ghost" onClick={() => setMode("ai")}>Regenerate</button>
          </div>
        </div>
      )}

      {mode === "blank" && (
        <div className="lw-wizardbody" style={{ gap: 10 }}>
          <div className="lw-wfield"><label>Product title</label><input value={blankTitle} onChange={(e) => setBlankTitle(e.target.value)} placeholder="e.g. Business English for Meetings" /></div>
          <div className="lw-wfield"><label>Description</label><input value={blankDesc} onChange={(e) => setBlankDesc(e.target.value)} placeholder="One line describing this product" /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lw-btn lw-btn--accent" disabled={!blankTitle.trim()} onClick={() => onCreate({ title: blankTitle, description: blankDesc, category: "General", units: [] }, false)}>Create product</button>
            <button className="lw-btn lw-btn--ghost" onClick={() => setMode("choose")}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   VIDEO SOURCE PICKER — shared by Content Studio and the Product Builder.
   Matches AI Context §13.3 "Supported Content Sources": Video Upload
   (MP4 / recorded session) or Video URL (YouTube / Vimeo / other).
   ========================================================================= */

/* =========================================================================
   IMAGE PICKER — lets a Workspace Owner set a real logo or curriculum
   cover. "Upload file" reads the file client-side via FileReader into a
   data URL (works with no backend); "Paste URL" takes any image link.
   Either overrides the generated brand art from BrandMark / CourseCover.
   ========================================================================= */

function ImagePicker({ value, onChange }) {
  const [mode, setMode] = useState("upload");
  const [url, setUrl] = useState(value && value.startsWith("http") ? value : "");
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(f);
  };

  const applyUrl = () => { if (url.trim()) onChange(url.trim()); };

  return (
    <div className="lw-imagepicker">
      <div className="lw-segctrl">
        <button className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}>Upload file</button>
        <button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>Paste URL</button>
      </div>
      {mode === "upload" ? (
        <>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => fileRef.current && fileRef.current.click()}><Upload size={13} /> Choose image</button>
        </>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <input className="lw-inlineinput" style={{ flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={!url.trim()} onClick={applyUrl}>Apply</button>
        </div>
      )}
      {value && <button className="lw-inlineai" onClick={() => { onChange(null); setUrl(""); }}>Remove — use generated art instead</button>}
    </div>
  );
}

function VideoSourcePicker({ onChange }) {
  const [mode, setMode] = useState("upload");
  const [file, setFile] = useState("");
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef(null);

  const detectSource = (u) => {
    if (/youtube\.com|youtu\.be/i.test(u)) return "YouTube";
    if (/vimeo\.com/i.test(u)) return "Vimeo";
    if (/^https?:\/\//i.test(u)) return "Video URL";
    return "";
  };
  const source = mode === "url" ? detectSource(url) : "Upload";

  const labelFor = () => {
    if (mode === "upload") return file;
    try {
      const parsed = new URL(url);
      const seg = parsed.pathname.split("/").filter(Boolean).pop();
      return (seg || parsed.hostname.replace("www.", "")).replace(/[-_]+/g, " ");
    } catch {
      return "Imported Video";
    }
  };

  const ready = mode === "upload" ? !!file && !uploading : /^https?:\/\/.+\..+/i.test(url.trim());

  useEffect(() => {
    onChange({ ready, label: labelFor(), sourceType: mode === "upload" ? "Upload" : (source || "URL") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, file, uploading, url]);

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setUploading(true);
    setTimeout(() => { setFile(f.name); setUploading(false); }, 900);
  };

  return (
    <div className="lw-videosource">
      <div className="lw-segctrl">
        <button className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}>Upload file</button>
        <button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>Paste URL</button>
      </div>

      {mode === "upload" ? (
        <>
          <input ref={fileRef} type="file" accept="video/*,.mp4,.mov" style={{ display: "none" }} onChange={handleFile} />
          <div className="lw-dropzone lw-dropzone--compact" onClick={() => fileRef.current && fileRef.current.click()}>
            {uploading ? (
              <><div className="lw-spinner" /> Uploading…</>
            ) : file ? (
              <><Check size={20} /><div className="lw-dropzone__title">{file}</div><div className="lw-dropzone__meta">Click to replace</div></>
            ) : (
              <><Upload size={22} /><div className="lw-dropzone__title">Click to choose a video file</div><div className="lw-dropzone__meta">MP4 or MOV from your computer</div></>
            )}
          </div>
        </>
      ) : (
        <div className="lw-wfield">
          <label>Video URL {source && <span className="lw-tag lw-tag--source">{source} detected</span>}</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…" />
        </div>
      )}
    </div>
  );
}

function AddLessonPanel({ unitTitle, onAddText, onAddVideo }) {
  const [mode, setMode] = useState("choose"); // choose | text | video-form | video-analyzing | video-review
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [source, setSource] = useState({ ready: false, label: "", sourceType: "Upload" });
  const [videoDraft, setVideoDraft] = useState(null);
  const [questions, setQuestions] = useState([]);

  const draftObjective = () => setObjective(aiLessonObjective(title || unitTitle));

  const startVideoAi = () => {
    setMode("video-analyzing");
    setTimeout(() => {
      const d = aiVideoDraft(source.label);
      setVideoDraft({ ...d, sourceType: source.sourceType });
      setQuestions(d.questions.map((q) => ({ ...q, status: "pending" })));
      setMode("video-review");
    }, 1400);
  };

  const setQStatus = (i, status) => setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, status } : q)));

  if (mode === "choose") {
    return (
      <div className="lw-wizardnav" style={{ justifyContent: "flex-start", gap: 8 }}>
        <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setMode("text")}><FileText size={14} /> Blank lesson</button>
        <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setMode("video-form")}><Video size={14} /> Interactive video lesson</button>
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div className="lw-wizardbody" style={{ gap: 8, background: "var(--surface-2)", padding: 14, borderRadius: "var(--radius-sm)" }}>
        <div className="lw-wfield"><label>Lesson title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Asking for Directions" /></div>
        <div className="lw-wfield">
          <label>Objective <button className="lw-inlineai" onClick={draftObjective} disabled={!title.trim()}><Sparkles size={12} /> Draft with AI</button></label>
          <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="AI can draft this from the title" />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={!title.trim()} onClick={() => { onAddText(title, objective); setMode("choose"); setTitle(""); setObjective(""); }}>Add lesson</button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setMode("choose")}>Cancel</button>
        </div>
      </div>
    );
  }

  if (mode === "video-form") {
    return (
      <div className="lw-wizardbody" style={{ gap: 10, background: "var(--surface-2)", padding: 14, borderRadius: "var(--radius-sm)" }}>
        <VideoSourcePicker onChange={setSource} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={!source.ready} onClick={startVideoAi}><Sparkles size={14} /> Analyse with AI</button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setMode("choose")}>Cancel</button>
        </div>
      </div>
    );
  }

  if (mode === "video-analyzing") {
    return (
      <div className="lw-analyzing" style={{ background: "var(--surface-2)", padding: 14, borderRadius: "var(--radius-sm)" }}>
        <div className="lw-spinner" />
        <ul className="lw-analyzing__steps">
          <li className="done"><Check size={13} /> Transcribing speech</li>
          <li className="done"><Check size={13} /> Extracting key concepts</li>
          <li className="active"><Circle size={13} /> Placing interactive questions</li>
        </ul>
      </div>
    );
  }

  if (mode === "video-review" && videoDraft) {
    return (
      <div className="lw-wizardbody" style={{ gap: 10, background: "var(--surface-2)", padding: 14, borderRadius: "var(--radius-sm)" }}>
        <div className="lw-wfield"><label>Lesson title <span className="lw-tag lw-tag--source">Source: {videoDraft.sourceType}</span></label><input value={videoDraft.title} onChange={(e) => setVideoDraft({ ...videoDraft, title: e.target.value })} /></div>
        <div className="lw-list">
          {questions.map((q, i) => (
            <div className={`lw-listrow lw-questionrow ${q.status}`} key={i}>
              <div className="lw-listrow__icon lw-timestamp">{q.t}</div>
              <div className="lw-listrow__body">
                <span className="lw-tag">{q.type}</span>
                <div className="lw-listrow__title">{q.text}</div>
                <div className="lw-rationale"><Bot size={11} /> {q.rationale}</div>
              </div>
              <div className="lw-rowactions">
                <button className={q.status === "accepted" ? "active" : ""} onClick={() => setQStatus(i, "accepted")}><Check size={14} /></button>
                <button className={q.status === "removed" ? "active danger" : ""} onClick={() => setQStatus(i, "removed")}><XCircle size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => { onAddVideo(videoDraft.title, questions.filter((q) => q.status !== "removed").length); setMode("choose"); setSource({ ready: false, label: "", sourceType: "Upload" }); }}>
            <Check size={14} /> Publish to unit
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setMode("choose")}>Cancel</button>
        </div>
      </div>
    );
  }
  return null;
}

function ProductDetail({ product, onUpdate, onBack, fire }) {
  const [addingLessonFor, setAddingLessonFor] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const update = (fn) => onUpdate((p) => fn({ ...p, units: p.units.map((u) => ({ ...u, lessons: [...u.lessons] })) }));

  const addUnit = (title) => {
    update((p) => ({ ...p, units: [...p.units, { id: `u${Date.now()}`, title, lessons: [] }] }));
    fire("ProductContentUpdated");
  };

  const removeUnit = (id) => { update((p) => ({ ...p, units: p.units.filter((u) => u.id !== id) })); fire("ProductContentUpdated"); };
  const removeLesson = (unitId, lessonId) => {
    update((p) => ({ ...p, units: p.units.map((u) => (u.id === unitId ? { ...u, lessons: u.lessons.filter((l) => l.id !== lessonId) } : u)) }));
    fire("ProductContentUpdated");
  };

  const addTextLesson = (unitId, title, objective) => {
    update((p) => ({ ...p, units: p.units.map((u) => (u.id === unitId ? { ...u, lessons: [...u.lessons, { id: `l${Date.now()}`, title, type: "text", status: "Published", objective }] } : u)) }));
    fire("LearningAssetCreated"); fire("LessonPublished");
  };

  const addVideoLesson = (unitId, title, questionCount) => {
    update((p) => ({ ...p, units: p.units.map((u) => (u.id === unitId ? { ...u, lessons: [...u.lessons, { id: `l${Date.now()}`, title, type: "video", status: "Published", questionCount }] } : u)) }));
    fire("VideoUploaded"); fire("VideoProcessingStarted"); fire("TranscriptGenerated");
    fire("AIAnalysisCompleted"); fire("InteractiveQuestionsGenerated"); fire("LearningAssetApproved"); fire("LessonPublished");
  };

  const suggestNextUnit = () => {
    setSuggestLoading(true);
    setTimeout(() => { setSuggestion(aiNextUnit(product.units.map((u) => u.title), product.category)); setSuggestLoading(false); }, 900);
  };

  const totalLessons = product.units.reduce((s, u) => s + u.lessons.length, 0);

  return (
    <div className="lw-page">
      <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onBack} style={{ marginBottom: 16 }}><ArrowLeft size={14} /> All products</button>
      <CourseCover title={product.title} imageUrl={product.imageUrl} height={140} />
      <div style={{ marginTop: 10 }}>
        <ImagePicker value={product.imageUrl} onChange={(url) => update((p) => ({ ...p, imageUrl: url }))} />
      </div>
      <div className="lw-eyebrow" style={{ marginTop: 16 }}>Learning Product Context · Product Content Strategy</div>
      <h1>{product.title}</h1>
      <p className="lw-sub">{product.description || "No description yet."} · {product.units.length} units · {totalLessons} lessons · <em style={{ fontStyle: "normal", color: "var(--ink-soft)" }}>curriculum cover shown to learners on their Courses page</em></p>

      <AiSuggestBanner icon={Bot}>
        AI Content Assistant: {totalLessons === 0
          ? "This product has no lessons yet — start with a unit, then add your first lesson below."
          : totalLessons < 4
          ? "Good start — most published products in this category have 8–12 lessons across 3+ units."
          : "Solid structure. Consider whether an assessment should sit at the end of the final unit."}
      </AiSuggestBanner>

      <h2 className="lw-sectiontitle">Units</h2>
      <div className="lw-unitlist">
        {product.units.map((u) => (
          <div className="lw-unitcard" key={u.id}>
            <div className="lw-unitcard__head">
              <Layers size={15} /> <span>{u.title}</span>
              <button className="lw-unitcard__remove" onClick={() => removeUnit(u.id)}><X size={13} /></button>
            </div>
            <div className="lw-list">
              {u.lessons.map((l) => (
                <div className="lw-listrow" key={l.id}>
                  <div className="lw-listrow__icon">{l.type === "video" ? <Video size={15} /> : <FileText size={15} />}</div>
                  <div className="lw-listrow__body">
                    <div className="lw-listrow__title">{l.title}</div>
                    <div className="lw-listrow__meta">{l.type === "video" ? `Interactive video · ${l.questionCount} AI-placed questions` : (l.objective || "Text lesson")}</div>
                  </div>
                  <span className="lw-tag">{l.status}</span>
                  <button className="lw-rowactions__single" onClick={() => removeLesson(u.id, l.id)}><X size={13} /></button>
                </div>
              ))}
              {u.lessons.length === 0 && <div className="lw-empty" style={{ padding: 14 }}>No lessons in this unit yet.</div>}
            </div>
            {addingLessonFor === u.id ? (
              <AddLessonPanel unitTitle={u.title}
                onAddText={(title, obj) => addTextLesson(u.id, title, obj)}
                onAddVideo={(title, qc) => addVideoLesson(u.id, title, qc)} />
            ) : (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" style={{ marginTop: 10 }} onClick={() => setAddingLessonFor(u.id)}><Plus size={13} /> Add lesson</button>
            )}
          </div>
        ))}
        {product.units.length === 0 && <div className="lw-empty">No units yet — add one to start structuring this product.</div>}
      </div>

      {suggestion && (
        <AiSuggestBanner icon={Lightbulb} acceptLabel="Add this unit"
          onAccept={() => { addUnit(suggestion.title); fire("AIRecommendationGenerated"); setSuggestion(null); }}
          onDismiss={() => setSuggestion(null)}>
          <strong>Suggested unit: {suggestion.title}</strong><br />{suggestion.rationale}
        </AiSuggestBanner>
      )}

      <div className="lw-wizardnav" style={{ justifyContent: "flex-start", gap: 8, marginTop: 14 }}>
        <ManualAddUnit onAdd={addUnit} />
        <button className="lw-btn lw-btn--ghost" onClick={suggestNextUnit} disabled={suggestLoading}>
          <Sparkles size={15} /> {suggestLoading ? "Thinking…" : "AI: suggest next unit"}
        </button>
      </div>
    </div>
  );
}

function ManualAddUnit({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open) return <button className="lw-btn lw-btn--ghost" onClick={() => setOpen(true)}><Plus size={15} /> Add unit</button>;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input className="lw-inlineinput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unit title" autoFocus />
      <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={!title.trim()} onClick={() => { onAdd(title); setTitle(""); setOpen(false); }}>Add</button>
    </div>
  );
}

function OwnerProducts({ c }) {
  const [products, setProducts] = useState(() =>
    c.courses.map((course, i) => ({
      ...course,
      description: course.description || "",
      category: "General",
      units: i === 0
        ? [{ id: "u0", title: "Live Lessons", lessons: [{ id: "l0", title: c.activeLesson.title, type: "video", status: "Published", questionCount: c.activeLesson.events.length }] }]
        : [],
    }))
  );
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [log, setLog] = useState([]);

  const fire = (event) => setLog((l) => [{ event, id: Date.now() + Math.random() }, ...l].slice(0, 6));

  const updateProduct = (id, fn) => setProducts((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));

  const createProduct = (data, viaAi) => {
    const id = `p${Date.now()}`;
    setProducts((ps) => [...ps, { id, price: "Not priced yet", enrolled: 0, lessons: 0, progress: 0, ...data }]);
    if (viaAi) { fire("AIContentGenerationRequested"); fire("AILessonDraftCreated"); }
    fire("LearningProductCreated");
    setCreating(false);
    setSelectedId(id);
  };

  const selected = products.find((p) => p.id === selectedId);

  if (selected) {
    return (
      <>
        <ProductDetail product={selected} onUpdate={(fn) => updateProduct(selected.id, fn)} onBack={() => setSelectedId(null)} fire={fire} />
        {log.length > 0 && (
          <div className="lw-page" style={{ marginTop: -8 }}>
            <h2 className="lw-sectiontitle">Recent domain events</h2>
            <div className="lw-eventlog">{log.map((l) => <div className="lw-eventlog__item" key={l.id}><Activity size={12} /> {l.event}</div>)}</div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Learning Product Context</div>
      <h1>Learning products</h1>
      <p className="lw-sub">What you offer — structured as reusable content composed into products, independent of pricing or delivery. AI can help draft the outline, but you approve everything.</p>

      {creating ? (
        <NewProductPanel onCreate={createProduct} onCancel={() => setCreating(false)} />
      ) : (
        <button className="lw-btn lw-btn--ghost" style={{ marginBottom: 20 }} onClick={() => setCreating(true)}><Plus size={15} /> New learning product</button>
      )}

      <div className="lw-table">
        <div className="lw-table__row lw-table__row--head"><span>Product</span><span>Units</span><span>Lessons</span><span>Price</span></div>
        {products.map((p) => (
          <div className="lw-table__row lw-table__row--click" key={p.id} onClick={() => setSelectedId(p.id)}>
            <span>{p.title}</span><span>{p.units.length}</span><span>{p.units.reduce((s, u) => s + u.lessons.length, 0)}</span><span>{p.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerMembers({ c }) {
  const seedActive = c.members.filter((m) => m.status !== "Invited").map((m, i) => ({ ...m, id: `m${i}` }));
  const seedInvites = c.members.filter((m) => m.status === "Invited").map((m, i) => ({ id: `i${i}`, email: m.name, status: "Issued" }));

  const [members, setMembers] = useState(seedActive);
  const [invitations, setInvitations] = useState(seedInvites);
  const [emailDraft, setEmailDraft] = useState("");
  const [log, setLog] = useState([]);

  const fire = (event) => setLog((l) => [{ event, id: Date.now() + Math.random() }, ...l].slice(0, 5));

  const sendInvite = () => {
    if (!emailDraft.trim()) return;
    setInvitations((inv) => [{ id: `i${Date.now()}`, email: emailDraft.trim(), status: "Issued" }, ...inv]);
    fire("WorkspaceInvitationCreated");
    setEmailDraft("");
  };

  const acceptInvite = (id) => {
    const invite = invitations.find((i) => i.id === id);
    if (!invite) return;
    setInvitations((inv) => inv.filter((i) => i.id !== id));
    fire("WorkspaceInvitationAccepted");
    setMembers((ms) => [{ id: `m${Date.now()}`, name: invite.email, role: "Learner", status: "Active" }, ...ms]);
    fire("WorkspaceMembershipCreated");
  };

  const cancelInvite = (id) => {
    setInvitations((inv) => inv.map((i) => (i.id === id ? { ...i, status: "Cancelled" } : i)));
    fire("WorkspaceInvitationCancelled");
  };

  const expireInvite = (id) => {
    setInvitations((inv) => inv.map((i) => (i.id === id ? { ...i, status: "Expired" } : i)));
    fire("WorkspaceInvitationExpired");
  };

  const setMemberStatus = (id, status, event) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, status } : m)));
    fire(event);
  };

  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Identity & Membership Context</div>
      <h1>Members</h1>
      <p className="lw-sub">Membership belongs to this Workspace only — Identity survives even if Membership is removed (BR-MB-004). The same person may hold a different role in another academy.</p>

      <h2 className="lw-sectiontitle" style={{ marginTop: 0 }}>Active members</h2>
      <div className="lw-list">
        {members.map((m) => (
          <div className={`lw-listrow ${m.status === "Removed" ? "lw-listrow--dim" : ""}`} key={m.id}>
            <div className="lw-listrow__icon">{m.name[0]}</div>
            <div className="lw-listrow__body">
              <div className="lw-listrow__title">{m.name}</div>
              <div className="lw-listrow__meta">
                {m.role}
                {m.status === "Removed" && " · Identity preserved — only Membership ended"}
              </div>
            </div>
            <span className={`lw-tag ${m.status === "Suspended" ? "lw-tag--warn" : ""} ${m.status === "Removed" ? "lw-tag--off" : ""}`}>{m.status}</span>
            {m.role === "Learner" && m.status === "Active" && (
              <div className="lw-rowactions">
                <button title="Suspend membership" onClick={() => setMemberStatus(m.id, "Suspended", "WorkspaceMembershipSuspended")}><PauseCircle size={15} /></button>
                <button title="Remove membership" onClick={() => setMemberStatus(m.id, "Removed", "WorkspaceMembershipRemoved")}><UserX size={15} /></button>
              </div>
            )}
            {m.role === "Learner" && m.status === "Suspended" && (
              <div className="lw-rowactions">
                <button title="Reactivate membership" onClick={() => setMemberStatus(m.id, "Active", "WorkspaceMembershipActivated")}><UserCheck size={15} /></button>
                <button title="Remove membership" onClick={() => setMemberStatus(m.id, "Removed", "WorkspaceMembershipRemoved")}><UserX size={15} /></button>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && <div className="lw-empty">No active members yet.</div>}
      </div>

      <h2 className="lw-sectiontitle">Pending invitations</h2>
      <div className="lw-list">
        {invitations.map((inv) => (
          <div className="lw-listrow" key={inv.id}>
            <div className="lw-listrow__icon"><Mail size={16} /></div>
            <div className="lw-listrow__body"><div className="lw-listrow__title">{inv.email}</div><div className="lw-listrow__meta">Invitation · {inv.status}</div></div>
            {inv.status === "Issued" && (
              <div className="lw-rowactions">
                <button title="Simulate learner accepting" onClick={() => acceptInvite(inv.id)}><Check size={15} /></button>
                <button title="Mark expired" onClick={() => expireInvite(inv.id)}><Clock size={15} /></button>
                <button title="Cancel invitation" onClick={() => cancelInvite(inv.id)}><X size={15} /></button>
              </div>
            )}
            {inv.status !== "Issued" && <span className="lw-tag lw-tag--off">{inv.status}</span>}
          </div>
        ))}
        {invitations.length === 0 && <div className="lw-empty">No pending invitations.</div>}
      </div>

      <div className="lw-composer" style={{ marginTop: 16 }}>
        <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="Email address to invite…" />
        <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={sendInvite}><Send size={14} /> Send invite</button>
      </div>

      {log.length > 0 && (
        <>
          <h2 className="lw-sectiontitle">Recent domain events</h2>
          <div className="lw-eventlog">
            {log.map((l) => (
              <div className="lw-eventlog__item" key={l.id}><Activity size={12} /> {l.event}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OwnerScheduling({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Scheduling Context</div>
      <h1>Sessions</h1>
      <div className="lw-list">
        {c.sessions.map((s, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon"><Calendar size={18} /></div>
            <div className="lw-listrow__body"><div className="lw-listrow__title">{s.title}</div><div className="lw-listrow__meta">{s.when}</div></div>
            <span className="lw-tag">{s.people} {s.people === 1 ? "person" : "people"}</span>
          </div>
        ))}
      </div>
      <button className="lw-btn lw-btn--ghost" style={{ marginTop: 16 }}><Plus size={15} /> New session</button>
    </div>
  );
}

function OwnerCommerce({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Commerce Context</div>
      <h1>Orders & revenue</h1>
      <div className="lw-grid3" style={{ marginBottom: 24 }}>
        <div className="lw-card"><div className="lw-card__eyebrow">Total revenue</div><div className="lw-stat">{c.revenue.total}</div></div>
        <div className="lw-card"><div className="lw-card__eyebrow">MRR</div><div className="lw-stat">{c.revenue.mrr}</div></div>
        <div className="lw-card"><div className="lw-card__eyebrow">Trend</div><div className="lw-stat">{c.revenue.trend}</div></div>
      </div>
      <div className="lw-table">
        <div className="lw-table__row lw-table__row--head"><span>Learner</span><span>Product</span><span>Amount</span><span>Status</span></div>
        {c.orders.map((o, i) => (
          <div className="lw-table__row" key={i}><span>{o.learner}</span><span>{o.product}</span><span>{o.amount}</span><span>{o.status}</span></div>
        ))}
      </div>
    </div>
  );
}

function OwnerCommunication({ c }) {
  const [items, setItems] = useState(c.announcements);
  const [draft, setDraft] = useState("");
  const publish = () => { if (!draft.trim()) return; setItems([{ title: draft, date: "Just now", audience: "All learners" }, ...items]); setDraft(""); };
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Communication Context</div>
      <h1>Announcements</h1>
      <div className="lw-composer">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write an announcement…" />
        <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={publish}><Send size={14} /> Publish</button>
      </div>
      <div className="lw-list">
        {items.map((a, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon"><Megaphone size={18} /></div>
            <div className="lw-listrow__body"><div className="lw-listrow__title">{a.title}</div><div className="lw-listrow__meta">{a.date} · {a.audience}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerAssessment({ c }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Assessment Context</div>
      <h1>Assessment & certificates</h1>
      <h2 className="lw-sectiontitle">Rubrics in use</h2>
      <div className="lw-list">
        {c.assessmentsOwner.map((a, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon"><ClipboardCheck size={18} /></div>
            <div className="lw-listrow__body"><div className="lw-listrow__title">{a.name}</div><div className="lw-listrow__meta">Evaluation: {a.type}</div></div>
            <div className="lw-scorepill">{a.avgScore}</div>
          </div>
        ))}
      </div>
      <h2 className="lw-sectiontitle">Certificates issued</h2>
      <div className="lw-list">
        {c.certificatesIssued.map((cert, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon"><Award size={18} /></div>
            <div className="lw-listrow__body"><div className="lw-listrow__title">{cert.learner}</div><div className="lw-listrow__meta">{cert.cert}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

const WIDGET_META = [
  { key: "aiTutor", label: "AI Tutor", consequence: "AI chat tab hidden from learners" },
  { key: "assessments", label: "Assessments", consequence: "Assessments tab and scores hidden from learners" },
  { key: "certificates", label: "Certificates", consequence: "Certificates tab hidden from learners" },
  { key: "schedule", label: "Schedule", consequence: "Schedule tab and session times hidden from learners" },
  { key: "messages", label: "Messages", consequence: "1:1 messaging hidden from learners" },
  { key: "community", label: "Community", consequence: "Community feed hidden from learners" },
];

function OwnerSettings({ c, theme, capabilities, onToggleCapability, onSetLogo }) {
  return (
    <div className="lw-page">
      <div className="lw-eyebrow">Workspace Management Context</div>
      <h1>Workspace settings</h1>
      <p className="lw-sub">Changes here are isolated to {c.name} only — no other Workspace is affected (ER-005 / BR-WS-004).</p>
      <div className="lw-card">
        <div className="lw-card__eyebrow">Identity</div>
        <div className="lw-settingsrow"><label>Workspace name</label><input defaultValue={c.name} /></div>
        <div className="lw-settingsrow"><label>Tagline</label><input defaultValue={c.tagline} /></div>
      </div>
      <div className="lw-card" style={{ marginTop: 16 }}>
        <div className="lw-card__eyebrow">Logo</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <BrandMark c={c} size={56} />
          <div style={{ flex: 1 }}>
            <p className="lw-sub" style={{ marginBottom: 10 }}>Upload a logo or paste a URL. Without one, {c.name} uses a generated mark that matches your brand colors — shown to the left.</p>
            <ImagePicker value={c.logoUrl} onChange={onSetLogo} />
          </div>
        </div>
      </div>
      <div className="lw-card" style={{ marginTop: 16 }}>
        <div className="lw-card__eyebrow">Branding</div>
        <div className="lw-swatchrow">
          {["--accent", "--accent-2", "--bg", "--ink"].map((k) => (
            <div className="lw-swatch" key={k}><span style={{ background: theme[k] }} /><div>{k.replace("--", "")}<br />{theme[k]}</div></div>
          ))}
        </div>
        <div className="lw-settingsrow"><label>Display font</label><input defaultValue={theme["--font-display"]} readOnly /></div>
        <div className="lw-settingsrow"><label>Body font</label><input defaultValue={theme["--font-body"]} readOnly /></div>
      </div>
      <div className="lw-card" style={{ marginTop: 16 }}>
        <div className="lw-card__eyebrow">AI configuration</div>
        <div className="lw-settingsrow"><label>Assistant name</label><input defaultValue={c.aiName} /></div>
        <div className="lw-settingsrow"><label>Owner-role terminology</label><input defaultValue={c.ownerRole} /></div>
      </div>
      <div className="lw-card" style={{ marginTop: 16 }}>
        <div className="lw-card__eyebrow">Student dashboard widgets</div>
        <p className="lw-sub" style={{ marginBottom: 14 }}>Turn capabilities on or off for learners in this academy only. Data is preserved when a widget is off — turning it back on restores it.</p>
        {WIDGET_META.map((w) => (
          <div className="lw-widgetrow" key={w.key}>
            <div>
              <div className="lw-widgetrow__label">{w.label}</div>
              <div className="lw-widgetrow__consequence">{capabilities[w.key] ? "Visible to learners" : w.consequence}</div>
            </div>
            <button
              className={`lw-toggle ${capabilities[w.key] ? "is-on" : ""}`}
              onClick={() => onToggleCapability(w.key)}
              aria-pressed={capabilities[w.key]}
            ><span /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   CONTENT STUDIO (AI-Assisted Learning Content Lifecycle)
   ========================================================================= */

function Stepper({ step }) {
  const steps = ["upload", "analyzing", "review", "published"];
  const labels = ["Upload", "AI Analysis", "Review", "Publish"];
  const idx = steps.indexOf(step);
  return (
    <div className="lw-stepper">
      {labels.map((l, i) => (
        <div key={l} className={`lw-stepper__item ${i <= idx ? "done" : ""} ${i === idx ? "active" : ""}`}>
          <span>{i < idx ? <Check size={12} /> : i + 1}</span>{l}
        </div>
      ))}
    </div>
  );
}

function StudioUpload({ c, step, setStep }) {
  const [source, setSource] = useState({ ready: false, label: "", sourceType: "Upload" });
  useEffect(() => {
    if (step === "analyzing") { const t = setTimeout(() => setStep("review"), 1700); return () => clearTimeout(t); }
  }, [step, setStep]);

  if (step === "analyzing") {
    return (
      <div className="lw-page">
        <Stepper step={step} />
        <div className="lw-eyebrow">AI Content Assistant</div>
        <h1>Analysing your video…</h1>
        <div className="lw-card lw-analyzing">
          <div className="lw-spinner" />
          <div>
            <div className="lw-card__title" style={{ fontSize: "1rem" }}>{source.label || c.uploadFile} <span className="lw-tag lw-tag--source">{source.sourceType}</span></div>
            <ul className="lw-analyzing__steps">
              <li className="done"><Check size={14} /> Transcribing speech</li>
              <li className="done"><Check size={14} /> Extracting key concepts</li>
              <li className="active"><Circle size={14} /> Drafting interactive questions</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="lw-page">
      <Stepper step={step} />
      <div className="lw-eyebrow">{c.ownerRole} tools · {c.name}</div>
      <h1>Turn a recording into an interactive lesson</h1>
      <p className="lw-sub">Upload a video you already have, or paste a link. {c.aiName} will draft the title, objectives and questions — you approve everything before learners see it.</p>
      <VideoSourcePicker onChange={setSource} />
      <button className="lw-btn lw-btn--accent lw-btn--lg" disabled={!source.ready} onClick={() => setStep("analyzing")}>
        <Sparkles size={16} /> Analyse with AI
      </button>
      <div className="lw-principle"><Sparkles size={16} /><span><strong>AI assists, you own it.</strong> {c.aiName} never publishes directly to learners.</span></div>
    </div>
  );
}

function StudioReview({ c, onPublish }) {
  const [title, setTitle] = useState(c.aiDraft.title);
  const [questions, setQuestions] = useState(c.aiDraft.questions.map((q) => ({ ...q })));
  const setStatus = (i, status) => setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, status } : q)));
  const remaining = questions.filter((q) => q.status !== "removed");
  return (
    <div className="lw-page">
      <Stepper step="review" />
      <div className="lw-eyebrow"><Wand2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />AI-generated draft · awaiting your review</div>
      <h1><input className="lw-titleinput" value={title} onChange={(e) => setTitle(e.target.value)} /></h1>
      <div className="lw-card">
        <div className="lw-card__eyebrow">Learning objectives</div>
        <ul className="lw-objectives">{c.aiDraft.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
      </div>
      <h2 className="lw-sectiontitle">Suggested interactive questions</h2>
      <div className="lw-list">
        {questions.map((q, i) => (
          <div className={`lw-listrow lw-questionrow ${q.status}`} key={i}>
            <div className="lw-listrow__icon lw-timestamp">{q.t}</div>
            <div className="lw-listrow__body">
              <span className="lw-tag">{q.type}</span>
              <div className="lw-listrow__title">{q.text}</div>
              {q.status === "removed" && <div className="lw-listrow__meta">Removed — won't appear to learners</div>}
              {q.status === "accepted" && <div className="lw-listrow__meta">Accepted</div>}
            </div>
            <div className="lw-rowactions">
              <button title="Accept" className={q.status === "accepted" ? "active" : ""} onClick={() => setStatus(i, "accepted")}><Check size={15} /></button>
              <button title="Edit"><Pencil size={15} /></button>
              <button title="Remove" className={q.status === "removed" ? "active danger" : ""} onClick={() => setStatus(i, "removed")}><XCircle size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="lw-principle"><Sparkles size={16} /><span>{remaining.length} of {questions.length} questions will publish. You stay the source of truth for correctness and teaching style.</span></div>
      <button className="lw-btn lw-btn--accent lw-btn--lg" onClick={() => onPublish({ title, questions: remaining })}>Publish lesson <ArrowRight size={16} /></button>
    </div>
  );
}

function StudioPublished({ c, published, setStep }) {
  return (
    <div className="lw-page">
      <Stepper step="published" />
      <div className="lw-eyebrow">Published</div>
      <h1>Live in {c.name}</h1>
      <p className="lw-sub">Learners in this academy only will see these lessons — fully isolated from every other workspace on the platform.</p>
      <div className="lw-list">
        {published.length === 0 && <div className="lw-empty">No lessons published yet in this session.</div>}
        {published.map((p, i) => (
          <div className="lw-listrow" key={i}>
            <div className="lw-listrow__icon"><Award size={18} /></div>
            <div className="lw-listrow__body"><div className="lw-listrow__title">{p.title}</div><div className="lw-listrow__meta">{p.questions.length} interactive questions · published just now</div></div>
          </div>
        ))}
      </div>
      <button className="lw-btn lw-btn--ghost" onClick={() => setStep("upload")}><ArrowLeft size={15} /> Author another lesson</button>
    </div>
  );
}

/* =========================================================================
   PROFESSIONAL PROFILE OVERLAY (Identity Context, Section III)
   One Global Identity — achievements aggregated across every Workspace.
   ========================================================================= */

function ProfessionalProfile({ onClose }) {
  const earned = Object.entries(CONTENT).flatMap(([key, c]) =>
    c.learnerCertificates.filter((cert) => cert.status === "earned").map((cert) => ({ ...cert, academy: c.name, key }))
  );
  return (
    <div className="lw-overlay">
      <div className="lw-overlay__panel">
        <button className="lw-overlay__close" onClick={onClose}><X size={18} /></button>
        <div className="lw-eyebrow" style={{ color: "#8A8F97" }}>Identity Context · platform-level, not Workspace-owned</div>
        <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>My professional profile</h1>
        <div className="lw-idcard">
          <div className="lw-idcard__avatar">{GLOBAL_IDENTITY.fullName[0]}</div>
          <div>
            <div className="lw-idcard__name">{GLOBAL_IDENTITY.fullName}</div>
            <div className="lw-idcard__meta">{GLOBAL_IDENTITY.email} · member since {GLOBAL_IDENTITY.memberSince}</div>
          </div>
        </div>
        <p className="lw-sub">One Identity, many Workspace Memberships (GP-005). Achievements travel with the person, not the academy.</p>
        <h2 className="lw-sectiontitle" style={{ marginTop: 24 }}>Memberships</h2>
        <div className="lw-list">
          {Object.entries(CONTENT).map(([key, c]) => (
            <div className="lw-listrow" key={key}>
              <div className="lw-listrow__icon">{c.mark}</div>
              <div className="lw-listrow__body"><div className="lw-listrow__title">{c.name}</div><div className="lw-listrow__meta">Role: Learner · independent membership</div></div>
            </div>
          ))}
        </div>
        <h2 className="lw-sectiontitle">Portable achievements</h2>
        <div className="lw-badgegrid">
          {earned.map((cert, i) => (
            <div className="lw-badge is-earned" key={i}>
              <Award size={26} />
              <div className="lw-badge__name">{cert.name}</div>
              <div className="lw-badge__meta">{cert.academy} · {cert.issued}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   WORKSPACE SETUP WIZARD (Value Stream 1: "Launch Learning Business")
   Business Basics → Branding → AI Persona → Publish trace.
   Runs OUTSIDE any academy's branding since no Workspace Session exists
   yet — this mirrors WE-004: Workspace Resolution happens before a
   branded experience can be shown at all.
   ========================================================================= */

const PUBLISH_EVENTS = [
  "WorkspaceCreated",
  "WorkspaceConfigured",
  "WorkspaceBrandUpdated",
  "WorkspaceAIProfileConfigured",
  "WorkspacePublished",
];

function WorkspaceWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", tagline: "", ownerPerson: "", category: "Language",
    presetId: "botanical", aiName: "", ownerRole: "Instructor",
    teachingStyle: "Friendly", feedbackStyle: "Encouraging",
  });
  const [eventIdx, setEventIdx] = useState(-1);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const canProceedBasics = form.name.trim().length > 0 && form.ownerPerson.trim().length > 0;

  useEffect(() => {
    if (step !== 3) return;
    setEventIdx(0);
    const timers = PUBLISH_EVENTS.map((_, i) =>
      setTimeout(() => setEventIdx(i + 1), 500 * (i + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const preset = BRAND_PRESETS.find((p) => p.id === form.presetId) || BRAND_PRESETS[0];

  const finish = () => {
    const key = (form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "academy") + "-" + Date.now().toString(36).slice(-4);
    const content = buildAcademyContent(form);
    onComplete(key, preset.tokens, content);
  };

  return (
    <div className="lw-overlay">
      <div className="lw-overlay__panel lw-overlay__panel--wizard">
        <button className="lw-overlay__close" onClick={onClose}><X size={18} /></button>
        <div className="lw-eyebrow" style={{ color: "#8A8F97" }}>Workspace Management Context · Launch Learning Business</div>
        <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>Set up a new academy</h1>

        <div className="lw-wizardsteps">
          {["Basics", "Branding", "AI Persona", "Publish"].map((l, i) => (
            <div key={l} className={`lw-wizardsteps__item ${i <= step ? "done" : ""} ${i === step ? "active" : ""}`}>
              <span>{i < step ? <Check size={11} /> : i + 1}</span>{l}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="lw-wizardbody">
            <div className="lw-wfield"><label><Building2 size={13} /> Academy name</label><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Riverside Coding School" /></div>
            <div className="lw-wfield"><label>Tagline</label><input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="One line describing your academy" /></div>
            <div className="lw-wfield"><label>Your name (Workspace Owner)</label><input value={form.ownerPerson} onChange={(e) => set("ownerPerson", e.target.value)} placeholder="e.g. Sam Rivera" /></div>
            <div className="lw-wfield">
              <label>Category</label>
              <div className="lw-segctrl">
                {Object.keys(CATEGORY_COURSES).map((cat) => (
                  <button key={cat} className={form.category === cat ? "active" : ""} onClick={() => set("category", cat)}>{cat}</button>
                ))}
              </div>
            </div>
            <button className="lw-btn lw-btn--accent lw-btn--lg" disabled={!canProceedBasics} onClick={() => setStep(1)}>
              Continue to branding <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="lw-wizardbody">
            <p className="lw-sub" style={{ color: "#666" }}><Palette size={13} style={{ verticalAlign: "-2px" }} /> Pick a starting brand — fully editable later in Workspace Settings.</p>
            <div className="lw-presetgrid">
              {BRAND_PRESETS.map((p) => (
                <div key={p.id} className={`lw-presetcard ${form.presetId === p.id ? "is-selected" : ""}`} onClick={() => set("presetId", p.id)}>
                  <div className="lw-presetcard__swatches">
                    <span style={{ background: p.tokens["--bg"] }} />
                    <span style={{ background: p.tokens["--accent"] }} />
                    <span style={{ background: p.tokens["--accent-2"] }} />
                    <span style={{ background: p.tokens["--ink"] }} />
                  </div>
                  <div className="lw-presetcard__label">{p.label}</div>
                  <div className="lw-presetcard__desc">{p.description}</div>
                </div>
              ))}
            </div>
            <div className="lw-wizardnav">
              <button className="lw-btn lw-btn--ghost" onClick={() => setStep(0)}><ArrowLeft size={15} /> Back</button>
              <button className="lw-btn lw-btn--accent lw-btn--lg" onClick={() => setStep(2)}>Continue to AI persona <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="lw-wizardbody">
            <p className="lw-sub" style={{ color: "#666" }}><SlidersHorizontal size={13} style={{ verticalAlign: "-2px" }} /> AI behaviour is Workspace-native — two academies never sound the same.</p>
            <div className="lw-wfield"><label>AI assistant name</label><input value={form.aiName} onChange={(e) => set("aiName", e.target.value)} placeholder="e.g. Nova" /></div>
            <div className="lw-wfield"><label>What learners call you</label><input value={form.ownerRole} onChange={(e) => set("ownerRole", e.target.value)} placeholder="e.g. Instructor, Mentor, Coach" /></div>
            <div className="lw-wfield">
              <label>Teaching style</label>
              <div className="lw-segctrl">
                {["Friendly", "Balanced", "Structured"].map((s) => (
                  <button key={s} className={form.teachingStyle === s ? "active" : ""} onClick={() => set("teachingStyle", s)}>{s}</button>
                ))}
              </div>
            </div>
            <div className="lw-wfield">
              <label>Feedback style</label>
              <div className="lw-segctrl">
                {["Encouraging", "Balanced", "Detailed"].map((s) => (
                  <button key={s} className={form.feedbackStyle === s ? "active" : ""} onClick={() => set("feedbackStyle", s)}>{s}</button>
                ))}
              </div>
            </div>
            <div className="lw-wizardnav">
              <button className="lw-btn lw-btn--ghost" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button>
              <button className="lw-btn lw-btn--accent lw-btn--lg" onClick={() => setStep(3)}>Review & publish <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="lw-wizardbody">
            <div className="lw-wizardsummary">
              <div><span>Academy</span>{form.name || "—"}</div>
              <div><span>Category</span>{form.category}</div>
              <div><span>Brand</span>{preset.label}</div>
              <div><span>AI assistant</span>{form.aiName || "Aria"} · {form.teachingStyle}, {form.feedbackStyle}</div>
            </div>
            <div className="lw-eventtrace">
              {PUBLISH_EVENTS.map((ev, i) => (
                <div key={ev} className={`lw-eventtrace__item ${i < eventIdx ? "done" : ""}`}>
                  {i < eventIdx ? <Check size={13} /> : <Circle size={13} />} {ev}
                </div>
              ))}
            </div>
            {eventIdx >= PUBLISH_EVENTS.length ? (
              <button className="lw-btn lw-btn--accent lw-btn--lg" onClick={finish}>
                <Rocket size={16} /> Enter your new academy
              </button>
            ) : (
              <div className="lw-sub" style={{ color: "#888" }}>Publishing…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   ROOT APP
   ========================================================================= */

export default function App() {
  useFonts();
  const [academy, setAcademy] = useState("lumen");
  const [role, setRole] = useState("learner");
  const [learnerScreen, setLearnerScreen] = useState("dashboard");
  const [ownerScreen, setOwnerScreen] = useState("overview");
  const [profileOpen, setProfileOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [customAcademies, setCustomAcademies] = useState({}); // { key: { theme, content } }
  const [capabilityOverrides, setCapabilityOverrides] = useState({}); // { [academyKey]: { ...capability flags } }
  const [logoOverrides, setLogoOverrides] = useState({}); // { [academyKey]: dataUrl | httpUrl | null }
  const [studioFlow, setStudioFlow] = useState({
    lumen: { step: "upload", published: [] },
    vantage: { step: "upload", published: [] },
  });

  const isCustom = !!customAcademies[academy];
  const baseContent = isCustom ? customAcademies[academy].content : CONTENT[academy];
  const theme = isCustom ? customAcademies[academy].theme : THEMES[academy];
  const flow = studioFlow[academy] || { step: "upload", published: [] };

  // Capabilities and the logo are held here (not on the base content) so
  // toggling a widget or swapping a logo never deletes anything underlying —
  // flip it back and everything (posts, sessions, the generated mark…) is
  // exactly as it was.
  const capabilities = { ...baseContent.capabilities, ...(capabilityOverrides[academy] || {}) };
  const logoUrl = academy in logoOverrides ? logoOverrides[academy] : baseContent.logoUrl;
  const c = { ...baseContent, capabilities, logoUrl };

  const toggleCapability = (key) =>
    setCapabilityOverrides((prev) => ({
      ...prev,
      [academy]: { ...capabilities, [key]: !capabilities[key] },
    }));

  const setLogo = (url) => setLogoOverrides((prev) => ({ ...prev, [academy]: url }));

  const academyList = [
    ...Object.entries(CONTENT).map(([key, ct]) => ({ key, label: ct.name.split(" ")[0] })),
    ...Object.entries(customAcademies).map(([key, a]) => ({ key, label: a.content.name.split(" ")[0] || "New" })),
  ];

  const setStudioStep = (step) => setStudioFlow((f) => ({ ...f, [academy]: { ...(f[academy] || { published: [] }), step } }));
  const publish = (lesson) => setStudioFlow((f) => ({ ...f, [academy]: { step: "published", published: [...(f[academy]?.published || []), lesson] } }));
  const resetFlow = () => setStudioFlow((f) => ({ ...f, [academy]: { step: "upload", published: f[academy]?.published || [] } }));

  const finishWizard = (key, tokens, content) => {
    setCustomAcademies((prev) => ({ ...prev, [key]: { theme: tokens, content } }));
    setStudioFlow((f) => ({ ...f, [key]: { step: "upload", published: [] } }));
    setAcademy(key);
    setRole("owner");
    setOwnerScreen("overview");
    setWizardOpen(false);
  };

  useEffect(() => { setLearnerScreen("dashboard"); setOwnerScreen("overview"); }, [academy, role]);

  // If the Owner just switched off the capability behind the screen the
  // Learner nav is currently sitting on, fall back to Dashboard rather
  // than showing a dead screen with no nav item pointing at it.
  useEffect(() => {
    const requiredCapability = NAV_CAPABILITY[learnerScreen];
    if (requiredCapability && capabilities[requiredCapability] === false) setLearnerScreen("dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities, learnerScreen]);

  const activeNavScreen = role === "learner" ? learnerScreen : (ownerScreen === "studio" ? "studio" : ownerScreen);

  return (
    <div className="lw-root" style={theme}>
      <style>{CSS}</style>
      <ControlStrip academyList={academyList} academy={academy} setAcademy={setAcademy} role={role} setRole={setRole}
        onReset={resetFlow} onNewAcademy={() => setWizardOpen(true)} ownerRole={c.ownerRole} />
      {role === "learner" && <AcademyHeader c={c} />}
      <div className="lw-shell" data-academy={academy}>
        <Nav c={c} role={role} screen={activeNavScreen}
          setScreen={role === "learner" ? setLearnerScreen : setOwnerScreen}
          onOpenProfile={() => setProfileOpen(true)} />
        <div className="lw-content">
          {role === "learner" && learnerScreen === "dashboard" && <LearnerDashboard c={c} academy={academy} setScreen={setLearnerScreen} />}
          {role === "learner" && learnerScreen === "courses" && <LearnerCourses c={c} published={flow.published} setScreen={setLearnerScreen} />}
          {role === "learner" && learnerScreen === "lesson" && <LearnerLesson c={c} academy={academy} />}
          {role === "learner" && learnerScreen === "assessments" && <LearnerAssessments c={c} />}
          {role === "learner" && learnerScreen === "certificates" && <LearnerCertificates c={c} />}
          {role === "learner" && learnerScreen === "schedule" && <LearnerSchedule c={c} />}
          {role === "learner" && learnerScreen === "messages" && <LearnerMessages c={c} />}
          {role === "learner" && learnerScreen === "community" && <LearnerCommunity key={academy} c={c} />}
          {role === "learner" && learnerScreen === "ai" && <LearnerAI c={c} academy={academy} />}

          {role === "owner" && ownerScreen === "overview" && <OwnerOverview c={c} />}
          {role === "owner" && ownerScreen === "products" && <OwnerProducts key={academy} c={c} />}
          {role === "owner" && ownerScreen === "studio" && flow.step !== "review" && flow.step !== "published" && (
            <StudioUpload c={c} step={flow.step} setStep={setStudioStep} />
          )}
          {role === "owner" && ownerScreen === "studio" && flow.step === "review" && <StudioReview c={c} onPublish={publish} />}
          {role === "owner" && ownerScreen === "studio" && flow.step === "published" && <StudioPublished c={c} published={flow.published} setStep={setStudioStep} />}
          {role === "owner" && ownerScreen === "members" && <OwnerMembers key={academy} c={c} />}
          {role === "owner" && ownerScreen === "scheduling" && <OwnerScheduling c={c} />}
          {role === "owner" && ownerScreen === "commerce" && <OwnerCommerce c={c} />}
          {role === "owner" && ownerScreen === "communication" && <OwnerCommunication key={academy} c={c} />}
          {role === "owner" && ownerScreen === "assessment" && <OwnerAssessment c={c} />}
          {role === "owner" && ownerScreen === "settings" && <OwnerSettings c={c} theme={theme} capabilities={capabilities} onToggleCapability={toggleCapability} onSetLogo={setLogo} />}
        </div>
      </div>
      {profileOpen && <ProfessionalProfile onClose={() => setProfileOpen(false)} />}
      {wizardOpen && <WorkspaceWizard onClose={() => setWizardOpen(false)} onComplete={finishWizard} />}
    </div>
  );
}

/* =========================================================================
   CSS
   ========================================================================= */

const CSS = `
  .lw-root { font-family: var(--font-body); color: var(--ink); background: var(--bg); min-height: 100vh; display: flex; flex-direction: column; }
  .lw-root * { box-sizing: border-box; }

  .lw-controlstrip { background: #0D0F12; color: #C9CDD3; font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; gap: 20px; padding: 8px 18px; flex-wrap: wrap; border-bottom: 1px solid #000; }
  .lw-controlstrip__label { opacity: 0.65; letter-spacing: 0.04em; }
  .lw-controlstrip__group { display: flex; align-items: center; gap: 6px; }
  .lw-controlstrip__group span { opacity: 0.6; margin-right: 2px; }
  .lw-controlstrip button { background: transparent; border: 1px solid #383D45; color: #C9CDD3; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; transition: all .15s; }
  .lw-controlstrip button.active { background: #C9CDD3; color: #0D0F12; border-color: #C9CDD3; }
  .lw-controlstrip__new { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: 1px dashed #4A5058 !important; color: #8FE3EA !important; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; }
  .lw-controlstrip__reset { margin-left: auto; display: flex; align-items: center; gap: 5px; background: transparent; border: none; color: #8A8F97; cursor: pointer; font-family: var(--font-mono); font-size: 11px; }

  .lw-academyheader { display: flex; align-items: center; gap: 16px; padding: 20px 32px; width: 100%; background: linear-gradient(120deg, var(--accent), var(--accent-2)); box-shadow: inset 0 -1px 0 rgba(0,0,0,0.08); }
  .lw-academyheader__mark { background: rgba(255,255,255,0.18); padding: 6px; border-radius: var(--radius-sm); display: flex; flex-shrink: 0; }
  .lw-academyheader__name { font-family: var(--font-display); font-weight: 700; font-size: 1.5rem; line-height: 1.15; color: #fff; }
  .lw-academyheader__tagline { font-size: 0.85rem; color: rgba(255,255,255,0.88); margin-top: 2px; }
  @media (max-width: 640px) { .lw-academyheader { padding: 16px 20px; } .lw-academyheader__name { font-size: 1.2rem; } }

  .lw-shell { display: flex; flex: 1; min-height: 0; }
  .lw-content { flex: 1; overflow-y: auto; padding: 40px 48px 64px; }
  .lw-page { max-width: 880px; animation: lwFade .3s ease; }
  @keyframes lwFade { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
  @media (prefers-reduced-motion: reduce) { .lw-page { animation: none; } }

  h1 { font-family: var(--font-display); font-weight: 600; font-size: 2rem; margin: 2px 0 6px; line-height: 1.15; }
  h2.lw-sectiontitle { font-family: var(--font-display); font-size: 1.2rem; margin: 36px 0 14px; font-weight: 600; }
  .lw-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  .lw-sub { color: var(--ink-soft); font-size: 0.94rem; max-width: 62ch; margin-bottom: 22px; }

  .lw-nav { width: 250px; flex-shrink: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; padding: 22px 16px; }
  .lw-nav__brand { display: flex; gap: 10px; align-items: center; margin-bottom: 28px; }
  .lw-brandmark { flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden; display: flex; line-height: 0; }
  .lw-cover { width: 100%; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
  .lw-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lw-cover svg { display: block; }
  .lw-nav__name { font-family: var(--font-display); font-weight: 600; font-size: 0.92rem; line-height: 1.2; }
  .lw-nav__tagline { font-size: 10.5px; opacity: 0.6; margin-top: 2px; }
  .lw-nav__items { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
  .lw-nav__divider { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.45; padding: 12px 12px 4px; }
  .lw-nav__item { display: flex; align-items: center; gap: 9px; background: transparent; border: none; color: var(--nav-text); opacity: 0.72; padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 0.84rem; cursor: pointer; text-align: left; transition: all .15s; }
  .lw-nav__item:hover { opacity: 1; background: rgba(255,255,255,0.06); }
  .lw-nav__item.is-active { opacity: 1; background: var(--accent); color: #fff; }
  .lw-nav__profile { display: flex; align-items: center; gap: 8px; background: transparent; border: 1px dashed rgba(255,255,255,0.25); color: var(--nav-text); opacity: 0.75; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 0.75rem; cursor: pointer; margin: 6px 0; }
  .lw-nav__profile:hover { opacity: 1; }
  .lw-nav__person { display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.14); }
  .lw-nav__avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-2); display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 600; flex-shrink: 0; }
  .lw-nav__personname { font-size: 0.8rem; font-weight: 600; }
  .lw-nav__personrole { font-size: 0.7rem; opacity: 0.6; }

  .lw-btn { font-family: var(--font-body); font-weight: 600; font-size: 0.85rem; border-radius: var(--radius-sm); padding: 10px 16px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: transform .12s, box-shadow .12s; }
  .lw-btn:hover { transform: translateY(-1px); }
  .lw-btn--accent { background: var(--accent); border-color: var(--accent); color: #fff; }
  .lw-btn--ghost { background: transparent; }
  .lw-btn--sm { padding: 6px 12px; font-size: 0.78rem; }
  .lw-btn--lg { padding: 14px 24px; font-size: 0.95rem; margin-top: 24px; }

  .lw-greeting { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 30px; flex-wrap: wrap; }
  .lw-greeting p { color: var(--ink-soft); font-size: 0.9rem; max-width: 48ch; }

  .lw-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .lw-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @media (max-width: 900px) { .lw-grid3, .lw-grid2 { grid-template-columns: 1fr; } }

  .lw-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; position: relative; }
  .lw-card__eyebrow { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin-bottom: 10px; }
  .lw-card__title { font-family: var(--font-display); font-weight: 600; font-size: 1.1rem; margin-bottom: 4px; }
  .lw-card__meta { font-size: 0.8rem; color: var(--ink-soft); }
  .lw-stat { font-family: var(--font-display); font-size: 1.7rem; font-weight: 600; }
  .lw-coursecard { cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .lw-coursecard .lw-cover { margin: -20px -20px 0; width: calc(100% + 40px) !important; border-radius: var(--radius) var(--radius) 0 0; }
  .lw-coursecard:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.07); }

  [data-academy="lumen"] .lw-stampcard::after {
    content: "IN\\A PROGRESS"; white-space: pre; text-align: center; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.04em;
    position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border-radius: 50%;
    border: 1.5px dashed var(--accent); color: var(--accent); display: flex; align-items: center; justify-content: center; transform: rotate(8deg);
  }

  .lw-meter { display: flex; gap: 4px; margin: 8px 0; }
  .lw-meter span { width: 8px; height: 22px; background: var(--surface-2); border-radius: 2px; }
  .lw-meter span.filled { background: var(--accent-2); }
  .lw-progressbar { height: 6px; background: var(--surface-2); border-radius: 4px; margin: 10px 0 6px; overflow: hidden; }
  .lw-progressbar span { display: block; height: 100%; background: var(--accent-2); border-radius: 4px; }

  .lw-list { display: flex; flex-direction: column; gap: 8px; }
  .lw-listrow { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 13px 16px; }
  .lw-listrow--new { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
  .lw-listrow--dim { opacity: 0.55; }
  .lw-tag--warn { background: #F0C040; color: #4A3A00; }
  .lw-tag--off { background: var(--line); color: var(--ink-soft); }
  .lw-eventlog { display: flex; flex-direction: column; gap: 5px; }
  .lw-eventlog__item { display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent-2); background: var(--surface-2); padding: 7px 12px; border-radius: var(--radius-sm); animation: lwFade .25s ease; }

  .lw-table__row--click { cursor: pointer; transition: background .12s; }
  .lw-table__row--click:hover { background: var(--surface-2); }

  .lw-aicard { display: flex; gap: 10px; align-items: flex-start; background: color-mix(in srgb, var(--accent) 8%, var(--surface-2)); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); border-radius: var(--radius-sm); padding: 12px 14px; margin: 14px 0; font-size: 0.85rem; color: var(--ink-soft); }
  .lw-aicard svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  .lw-aicard__body { flex: 1; }
  .lw-aicard__actions { display: flex; gap: 6px; flex-shrink: 0; }

  .lw-unitlist { display: flex; flex-direction: column; gap: 14px; }
  .lw-unitcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
  .lw-unitcard__head { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: 1rem; margin-bottom: 10px; }
  .lw-unitcard__remove { margin-left: auto; background: transparent; border: none; color: var(--ink-soft); cursor: pointer; }

  .lw-inlineai { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 0.75rem; cursor: pointer; margin-left: 8px; font-weight: 600; }
  .lw-imagepicker { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .lw-imagepicker .lw-inlineai { margin-left: 0; }
  .lw-inlineai:disabled { opacity: 0.4; cursor: default; }
  .lw-inlineinput { padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--surface); font-size: 0.85rem; }
  .lw-rationale { display: flex; align-items: center; gap: 5px; font-size: 0.74rem; color: var(--accent-2); margin-top: 3px; font-style: italic; }
  .lw-rowactions__single { background: transparent; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; }
  .lw-listrow__icon { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent); font-size: 0.8rem; font-weight: 600; }
  .lw-listrow__body { flex: 1; }
  .lw-listrow__title { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
  .lw-listrow__meta { font-size: 0.78rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-tag { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; background: var(--surface-2); padding: 2px 7px; border-radius: 20px; color: var(--ink-soft); }
  .lw-tag--new { background: var(--accent); color: #fff; }
  .lw-timestamp { font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); background: var(--surface-2); }
  .lw-scorepill { font-family: var(--font-mono); font-weight: 600; font-size: 0.85rem; background: var(--surface-2); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--accent-2); }

  .lw-player { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
  .lw-player__frame { background: linear-gradient(135deg, var(--ink), var(--accent-2)); color: #fff; height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; font-size: 0.85rem; opacity: 0.95; }
  .lw-timeline { display: flex; gap: 18px; padding: 14px 18px; flex-wrap: wrap; border-top: 1px solid var(--line); }
  .lw-timeline__event { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--ink-soft); }
  .lw-timeline__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  .lw-timeline__time { font-family: var(--font-mono); color: var(--ink); }

  .lw-questioncard__prompt { font-family: var(--font-display); font-size: 1.1rem; font-weight: 500; margin: 6px 0 16px; }
  .lw-options { display: flex; flex-direction: column; gap: 8px; }
  .lw-option { display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); cursor: pointer; font-family: var(--font-body); font-size: 0.9rem; transition: all .12s; }
  .lw-option:hover:not(:disabled) { border-color: var(--accent); }
  .lw-option.is-correct { border-color: var(--accent-2); background: color-mix(in srgb, var(--accent-2) 10%, var(--bg)); color: var(--accent-2); font-weight: 600; }
  .lw-option.is-wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--bg)); color: var(--danger); }
  .lw-feedback { display: flex; gap: 8px; align-items: flex-start; margin-top: 16px; padding: 12px 14px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 0.85rem; }

  .lw-chat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .lw-bubble { max-width: 70%; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.88rem; display: flex; gap: 8px; align-items: flex-start; }
  .lw-bubble--ai { background: var(--surface-2); align-self: flex-start; }
  .lw-bubble--user { background: var(--accent); color: #fff; align-self: flex-end; }
  .lw-bubble__avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-2); color: #fff; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .lw-chatinput, .lw-composer { display: flex; gap: 8px; margin-top: 8px; }
  .lw-chatinput input, .lw-composer input { flex: 1; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--bg); }
  .lw-composer { margin-bottom: 16px; }

  .lw-dropzone { border: 2px dashed var(--line); border-radius: var(--radius); padding: 44px; text-align: center; color: var(--ink-soft); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: border-color .15s; background: var(--surface); }
  .lw-dropzone:hover { border-color: var(--accent); }
  .lw-dropzone__title { font-weight: 600; color: var(--ink); font-family: var(--font-body); }
  .lw-dropzone__meta { font-size: 0.78rem; }
  .lw-dropzone--compact { padding: 20px; margin-bottom: 4px; }
  .lw-videosource { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
  .lw-tag--source { background: color-mix(in srgb, var(--accent) 15%, var(--surface-2)); color: var(--accent); margin-left: 6px; }

  .lw-principle { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: var(--radius-sm); padding: 13px 16px; font-size: 0.85rem; color: var(--ink-soft); margin-top: 20px; }
  .lw-principle strong { color: var(--ink); }

  .lw-analyzing { display: flex; gap: 20px; align-items: center; }
  .lw-analyzing__steps { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; }
  .lw-analyzing__steps li { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); }
  .lw-analyzing__steps li.done { color: var(--accent-2); }
  .lw-analyzing__steps li.active { color: var(--accent); font-weight: 600; }

  .lw-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--surface-2); border-top-color: var(--accent); animation: lwSpin .8s linear infinite; flex-shrink: 0; }
  @keyframes lwSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-spinner { animation-duration: 2.4s; } }

  .lw-stepper { display: flex; gap: 6px; margin-bottom: 22px; flex-wrap: wrap; }
  .lw-stepper__item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--ink-soft); padding: 5px 10px; border-radius: 20px; background: var(--surface-2); }
  .lw-stepper__item span { width: 16px; height: 16px; border-radius: 50%; background: var(--line); color: var(--ink-soft); font-size: 10px; display: flex; align-items: center; justify-content: center; }
  .lw-stepper__item.done { color: var(--accent-2); }
  .lw-stepper__item.done span { background: var(--accent-2); color: #fff; }
  .lw-stepper__item.active { color: var(--accent); font-weight: 600; background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
  .lw-stepper__item.active span { background: var(--accent); color: #fff; }

  .lw-titleinput { font-family: var(--font-display); font-weight: 600; font-size: 2rem; border: none; border-bottom: 2px dashed var(--line); background: transparent; width: 100%; padding: 4px 0; color: var(--ink); }
  .lw-titleinput:focus { outline: none; border-color: var(--accent); }
  .lw-objectives { margin: 4px 0 0; padding-left: 20px; font-size: 0.9rem; color: var(--ink-soft); display: flex; flex-direction: column; gap: 6px; }
  .lw-questionrow.accepted { border-color: var(--accent-2); }
  .lw-questionrow.removed { opacity: 0.5; }
  .lw-rowactions { display: flex; gap: 4px; }
  .lw-rowactions button { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
  .lw-rowactions button:hover { color: var(--ink); }
  .lw-rowactions button.active { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
  .lw-rowactions button.active.danger { background: var(--danger); border-color: var(--danger); }
  .lw-empty { color: var(--ink-soft); font-size: 0.88rem; padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius); }

  .lw-table { border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
  .lw-table__row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 12px 16px; font-size: 0.86rem; background: var(--surface); border-bottom: 1px solid var(--line); }
  .lw-table__row:last-child { border-bottom: none; }
  .lw-table__row--head { background: var(--surface-2); font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); }

  .lw-badgegrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .lw-badge { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px 14px; text-align: center; color: var(--ink-soft); display: flex; flex-direction: column; align-items: center; gap: 6px; opacity: 0.6; }
  .lw-badge.is-earned { opacity: 1; color: var(--ink); border-color: var(--accent-2); }
  .lw-badge.is-earned svg { color: var(--accent-2); }
  .lw-badge__name { font-weight: 600; font-size: 0.85rem; }
  .lw-badge__meta { font-size: 0.72rem; }

  .lw-settingsrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); }
  .lw-settingsrow:first-of-type { border-top: none; }
  .lw-settingsrow label { font-size: 0.82rem; color: var(--ink-soft); flex-shrink: 0; }
  .lw-settingsrow input { text-align: right; border: none; background: transparent; font-family: var(--font-body); font-size: 0.85rem; color: var(--ink); width: 60%; }
  .lw-settingsrow input:focus { outline: none; }
  .lw-swatchrow { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
  .lw-swatch { display: flex; gap: 8px; align-items: center; font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-soft); }
  .lw-swatch span { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--line); flex-shrink: 0; }

  .lw-widgetrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
  .lw-widgetrow:first-of-type { border-top: none; }
  .lw-widgetrow__label { font-size: 0.88rem; font-weight: 600; }
  .lw-widgetrow__consequence { font-size: 0.76rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-toggle { width: 40px; height: 22px; border-radius: 20px; background: var(--line); border: none; cursor: pointer; position: relative; flex-shrink: 0; transition: background .15s; }
  .lw-toggle span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .lw-toggle.is-on { background: var(--accent-2); }
  .lw-toggle.is-on span { transform: translateX(18px); }

  .lw-overlay { position: fixed; inset: 0; background: rgba(10,12,15,0.55); display: flex; align-items: flex-start; justify-content: center; padding: 40px 20px; z-index: 50; overflow-y: auto; animation: lwFade .2s ease; }
  .lw-overlay__panel { background: #FAFAFA; color: #222; border-radius: 16px; max-width: 640px; width: 100%; padding: 32px 36px 40px; position: relative; font-family: 'IBM Plex Sans', sans-serif; }
  .lw-overlay__panel--wizard { max-width: 620px; }

  .lw-wizardsteps { display: flex; gap: 6px; margin: 18px 0 24px; flex-wrap: wrap; }
  .lw-wizardsteps__item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #999; padding: 5px 10px; border-radius: 20px; background: #EFEFEC; }
  .lw-wizardsteps__item span { width: 16px; height: 16px; border-radius: 50%; background: #DDD; color: #999; font-size: 10px; display: flex; align-items: center; justify-content: center; }
  .lw-wizardsteps__item.done { color: #1E8E63; }
  .lw-wizardsteps__item.done span { background: #1E8E63; color: #fff; }
  .lw-wizardsteps__item.active { color: #2454C7; font-weight: 600; background: #E6ECFB; }
  .lw-wizardsteps__item.active span { background: #2454C7; color: #fff; }

  .lw-wizardbody { display: flex; flex-direction: column; gap: 14px; }
  .lw-wfield { display: flex; flex-direction: column; gap: 6px; }
  .lw-wfield label { font-size: 0.8rem; font-weight: 600; color: #444; display: flex; align-items: center; gap: 6px; }
  .lw-wfield input { padding: 10px 13px; border-radius: 8px; border: 1px solid #DDD; font-family: 'IBM Plex Sans', sans-serif; font-size: 0.9rem; background: #fff; }
  .lw-wfield input:focus { outline: 2px solid #2454C7; outline-offset: 1px; }

  .lw-segctrl { display: flex; gap: 6px; flex-wrap: wrap; }
  .lw-segctrl button { padding: 7px 14px; border-radius: 20px; border: 1px solid #DDD; background: #fff; color: #444; font-size: 0.82rem; cursor: pointer; }
  .lw-segctrl button.active { background: #2454C7; border-color: #2454C7; color: #fff; }

  .lw-presetgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .lw-presetcard { border: 2px solid #E3E3E3; border-radius: 12px; padding: 14px; cursor: pointer; background: #fff; transition: border-color .12s; }
  .lw-presetcard.is-selected { border-color: #2454C7; }
  .lw-presetcard__swatches { display: flex; gap: 4px; margin-bottom: 10px; }
  .lw-presetcard__swatches span { width: 20px; height: 20px; border-radius: 5px; border: 1px solid rgba(0,0,0,0.08); }
  .lw-presetcard__label { font-weight: 600; font-size: 0.86rem; margin-bottom: 3px; }
  .lw-presetcard__desc { font-size: 0.74rem; color: #888; line-height: 1.35; }

  .lw-wizardnav { display: flex; justify-content: space-between; margin-top: 8px; }
  .lw-wizardsummary { display: flex; flex-direction: column; gap: 8px; background: #fff; border: 1px solid #E3E3E3; border-radius: 10px; padding: 14px 16px; font-size: 0.85rem; }
  .lw-wizardsummary div { display: flex; justify-content: space-between; gap: 12px; }
  .lw-wizardsummary span { color: #999; }
  .lw-eventtrace { display: flex; flex-direction: column; gap: 7px; margin: 16px 0; font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; }
  .lw-eventtrace__item { display: flex; align-items: center; gap: 8px; color: #AAA; transition: color .2s; }
  .lw-eventtrace__item.done { color: #1E8E63; }
  .lw-overlay__panel .lw-listrow, .lw-overlay__panel .lw-badge { background: #fff; border-color: #E3E3E3; }
  .lw-overlay__panel .lw-badge.is-earned { border-color: #1E8E63; }
  .lw-overlay__panel h1 { color: #1A1A1A; }
  .lw-overlay__close { position: absolute; top: 20px; right: 20px; background: transparent; border: none; cursor: pointer; color: #888; }
  .lw-idcard { display: flex; gap: 14px; align-items: center; background: #fff; border: 1px solid #E3E3E3; border-radius: 12px; padding: 16px; margin-bottom: 6px; }
  .lw-idcard__avatar { width: 44px; height: 44px; border-radius: 50%; background: #2454C7; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
  .lw-idcard__name { font-weight: 600; }
  .lw-idcard__meta { font-size: 0.8rem; color: #777; }

  button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
