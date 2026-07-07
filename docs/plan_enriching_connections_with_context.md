# Plan for Enriching LinkedIn Connections with Context

This document outlines the technical design, data flow, and implementation plan for building a system that enriches a user's LinkedIn connections list with rich contextual data extracted from a LinkedIn Part 1 data export archive.

The goal is to automatically categorize, tag, and summarize relationships without requiring the heavy, slow-to-generate Part 2 export.

Implementation alignment for Social Datanode:

- First shipped pass is deterministic only. LLM summarization/parsing remains a later phase.
- Enrichment output is stored as regular person notes in the existing `user_graphs.graph`
  JSON blob, not as a separate database table or a new `PersonNode.enrichment` field.
- Raw message and invitation text are not read or persisted. The first pass uses
  `Connections.csv`, `Positions.csv`, `Rich_Media.csv`, and recommendation CSVs only.
- Agent API, CLI, and MCP surfaces are unchanged for this pass.

---

## 1. System Architecture & Data Flow

```mermaid
graph TD
    subgraph Input Files (LinkedIn Part 1 Export)
        A[Connections.csv]
        B[Profile.csv / Positions.csv]
        C[guide_messages.csv]
        D[Invitations.csv]
        E[Rich_Media.csv]
        F[Recommendations_Given.csv / Recommendations_Received.csv]
    end

    subgraph Deterministic Processing (Code/DB)
        G[Company Mafia Engine]
        H[Time-Clustering & Event Correlation Engine]
        I[Advocate / Trust Classifier]
    end

    subgraph LLM Processing Layer
        J[Chat Transcript Summarizer]
        K[Invitation Note Parser]
        L[Job Title Classifier]
    end

    subgraph Output Database
        M[Enriched Connection Profiles]
    end

    %% Flow lines
    A --> G
    B --> G
    
    A --> H
    E --> H
    
    A --> I
    F --> I
    
    C --> J
    D --> K
    A --> L

    G --> M
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
End
```

---

## 2. Input Data Sources (Part 1 Export Only)

The system utilizes the following files from the fast LinkedIn export package (Part 1):

1.  **`Connections.csv`**
    *   *Columns:* `First Name`, `Last Name`, `URL`, `Email Address`, `Company`, `Position`, `Connected On`
    *   *Role:* The core roster of connections to be enriched.
2.  **`Profile.csv` & `Positions.csv`**
    *   *Columns:* `Company Name`, `Title`, `Description`, `Location`, `Started On`, `Finished On`
    *   *Role:* The user's own employment and profile history, used for matching past workplaces with connections' current companies.
3.  **`guide_messages.csv`** (or `messages.csv`)
    *   *Columns:* `CONVERSATION ID`, `FROM`, `SENDER PROFILE URL`, `TO`, `RECIPIENT PROFILE URLS`, `DATE`, `CONTENT`
    *   *Role:* Chat histories with connections.
4.  **`Invitations.csv`**
    *   *Columns:* `From`, `To`, `Sent At`, `Message` (The connection request note)
    *   *Role:* Initial outreach context.
5.  **`Rich_Media.csv`**
    *   *Columns:* `Date/Time`, `Media Description`, `Media Link`
    *   *Role:* User's posts containing images (provides dates, texts, and hashtags for event correlation).
6.  **`Recommendations_Received.csv` & `Recommendations_Given.csv`**
    *   *Columns:* `First Name`, `Last Name`, `Company`, `Job Title`, `Text`, `Creation Date`, `Status`
    *   *Role:* Explicit public professional endorsements.

---

## 3. LLM Processing Layer (AI Extraction Tasks)

Large Language Models (LLMs) are used to extract structure and intent from unstructured text fields.

### Task A: Chat Transcript Summarizer
*   **Input:** Grouped messages from `guide_messages.csv` for a specific conversation URL/ID.
*   **Prompt Goal:** Summarize the nature of the communication, interests, next steps, and relationship warmth.
*   **Expected Output Format (JSON):**
    ```json
    {
      "relationship_summary": "Met at RoyalHacks, discussed relocating to Denmark and Agile practices at Pandora.",
      "domain_tags": ["OKR", "Agile Coaching", "AI Enablement"],
      "action_items": [
        {
          "task": "Send Agile assessment template",
          "due_date": "next week",
          "assignee": "User"
        }
      ],
      "relationship_warmth": "Warm" // Values: Cold, Warm, Hot
    }
    ```

### Task B: Invitation Note Parser
*   **Input:** The text message from `Invitations.csv` for a given connection.
*   **Prompt Goal:** Determine how the connection originated from the greeting text.
*   **Expected Output Format (JSON):**
    ```json
    {
      "origin_context": "RoyalHacks Hackathon",
      "context_tags": ["Hackathon", "Event"],
      "role_at_first_contact": "Attendee" // Values: Recruiter, Candidate, Speaker, Peer, Attendee, Cold
    }
    ```

### Task C: Job Title Classifier
*   **Input:** The `Position` field from `Connections.csv` (e.g., "VP of Engineering & Co-Founder").
*   **Prompt Goal:** Classify seniority and industry domain.
*   **Expected Output Format (JSON):**
    ```json
    {
      "seniority_level": "LPR / C-Level", // Values: LPR / C-Level, Management / Lead, Specialist
      "professional_domain": "Engineering" // Values: Engineering, Product, HR/Agile, Sales/Marketing, Finance, Other
    }
    ```

---

## 4. Deterministic Processing & Matching Engine

These modules run locally using deterministic code (SQL/JavaScript/Python) to link tables together.

### Module 1: "Company Mafia" Engine
*   **Logic:** Matches `Positions.csv` (User's past companies) with `Connections.csv` (Current company of connections).
*   **Rule:**
    *   If `Connection.Company` matches `User.Position.CompanyName` AND the connection was added or active during the User's employment period, apply tag: `<CompanyName> Mafia` (e.g., `Avito Mafia`, `Yandex Alumni`).
*   **Value:** Groups former and current teammates automatically.

### Module 2: Time-Clustering & Event Correlation Engine
*   **Logic:** Detects spike events where a high number of connections were added, and correlates them with the user's posts.
*   **Algorithm:**
    1.  Group `Connections.csv` by `Connected On` date.
    2.  Identify dates where the count of new connections deviates significantly from the moving average (e.g., > 3 standard deviations, or a flat threshold like > 10 additions in 48 hours).
    3.  Query `Rich_Media.csv` for posts published within a 2-day window of the detected spike.
    4.  Extract hashtags and key nouns from the post description (e.g., `#RoyalHacks`, `workshop at IT-Universitetet`).
    5.  **Output Proposal:** Suggest applying the event tag (e.g., `RoyalHacks`) to all connections added during that spike.

### Module 3: Trust & Advocate Classifier
*   **Logic:** Matches names in recommendations with the connection list.
*   **Rule:**
    *   If `Recommendations_Received.Sender` matches `Connection.FullName` -> Apply Tag `Brand Advocate` (High-trust connections).
    *   If `Recommendations_Given.Recipient` matches `Connection.FullName` -> Apply Tag `Recommended by Me` (Verified professionals).

---

## 5. Output Data Schema (Enriched Profile)

For every connection in `Connections.csv`, the final enriched record in the database should match the following structure:

```json
{
  "connection_id": "unique-id-or-url",
  "first_name": "Mikhail",
  "last_name": "Sukhov",
  "profile_url": "https://www.linkedin.com/in/mikhail-sukhov",
  "email": "mikhail.sukhov@gmail.com",
  "current_company": "Pandora",
  "current_position": "Agile Coach",
  "date_connected": "2026-06-19",
  
  "enrichment": {
    "seniority_level": "Management / Lead",
    "professional_domain": "HR/Agile",
    "relationship_warmth": "Warm",
    "company_mafias": ["Avito Mafia", "Pandora Team"],
    "event_tags": ["RoyalHacks"],
    "relationship_summary": "Met at the RoyalHacks event, discussed Agile and OKR implementations.",
    "trust_status": "Brand Advocate", // From recommendations
    "action_items": [
      {
        "task": "Send DevOps maturity framework",
        "status": "Pending"
      }
    ],
    "inferred_interests": ["Agile", "OKR", "DevOps", "AI Enablement"]
  }
}
```

---

## 6. Performance & UX: Asynchronous Enrichment Flow

Enriching hundreds or thousands of profiles using LLM API calls takes time (due to API rate limits and network latency). A synchronous "wait for upload" UI would freeze or time out. The system must use a **Two-Phase Import Workflow**.

### Phase 1: Instant Core Import (Fast Sync)
*   **Duration:** ~2-5 seconds.
*   **Execution:**
    1.  Parse `Connections.csv` and insert the core roster of connections into the database.
    2.  Run deterministic modules (Company Mafia matching, Recommendation matching, and Time-Clustering for events).
    3.  Immediately unlock the UI. The user can see, search, and navigate their connection list with basic tags.

### Phase 2: Asynchronous Enrichment (Lazy AI Processing)
*   **Duration:** Several minutes to an hour (depending on connection count).
*   **Execution:**
    1.  The client or a background worker triggers the LLM Processing Layer for connections lacking AI context.
    2.  Process tasks in sequential batches (e.g., 5-10 parallel requests) to avoid exceeding API rate limits.
    3.  Use exponential backoff retry logic for `429 Too Many Requests` API responses.
    4.  **Idempotency & Caching:** Skip LLM summarization if a conversation or invitation note hasn't changed since the last import.

### UI/UX Specifications

1.  **Enrichment Progress Indicator:**
    *   Show a subtle progress bar or spinner in the application header or sidebar (e.g., *"AI Enrichment: 45% complete"*).
    *   On hover, display details:
        *   Estimated time remaining: `Remaining Connections * Average LLM Latency` (e.g., *"~8 minutes remaining"*).
        *   Current task: *"Processing chat history for Mikhail Sukhov..."*
2.  **User Notice:**
    *   Display a warning message: **"Enriching profiles with AI context. Please do not close or reload this page."** (If processing client-side).
    *   *Alternative (Server-side):* If processed via backend edge functions, notify the user: *"Enrichment is running in the background. You can safely close this page. We'll show a notification when it's done."*
3.  **Partial Data States:**
    *   Profiles that are not yet processed by the LLM should display a loading skeleton or a placeholder (e.g., *"Generating AI summary..."*) in their detail views, rather than failing or remaining empty.

