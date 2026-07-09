# Plan for Enriching LinkedIn Connections with Context

This document outlines the technical design, data flow, and implementation plan for building a system that enriches a user's LinkedIn connections list with rich contextual data extracted from a LinkedIn Part 1 data export archive.

The goal is to automatically categorize, tag, and summarize relationships without requiring the heavy, slow-to-generate Part 2 export.

Implementation alignment for Social Datanode:

- First shipped flow runs a deterministic pass first, then signed-in users automatically
  get batched server-side LLM enrichment for messages, invitations, and posts through
  `enrich-linkedin-archive`.
- Enrichment output is stored as regular person notes in the existing `user_graphs.graph`
  JSON blob, not as a separate database table or a new `PersonNode.enrichment` field.
- Raw message and invitation text may be sent transiently to the Edge Function/OpenRouter
  for summarization, but only returned notes are persisted. The database does not store raw
  export text.
- Deterministic event context uses both `Rich_Media.csv` and `Shares.csv`; it no longer
  requires a large same-day connection spike before attaching likely event context.
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

### Task D: Event & Post Content Analyzer
*   **Input:** Post description text from `Rich_Media.csv` (or `Shares.csv`) and the post publication date.
*   **Prompt Goal:** Identify if the post describes a professional event (e.g., hackathon, conference, meetup, office visit). If so, extract the event's clean name, resolved event date (resolving relative dates like "yesterday" or "last weekend" based on the post date), key highlights, and names of any people mentioned along with their context.
*   **Expected Output Format (JSON):**
    ```json
    {
      "is_professional_event": true,
      "event_name": "AI Meetup",
      "event_date": "2026-07-06", // YYYY-MM-DD (resolved relative to post publication date)
      "event_highlights": ["Sam Altman joined the panel discussion", "shared latest API updates"],
      "mentioned_people": [
        {
          "name": "Ivan Ivanov",
          "context": "Organized the meetup and panel discussion"
        }
      ]
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

### Module 2: AI-Driven Event & Relationship Correlation Engine
*   **Logic:** Correlates connection spikes with LLM-extracted event details from posts, propagating highlights to group members, and linking mentioned people directly to their profiles.
*   **Workflow:**
    1.  **Post Parsing:** Analyze posts via the LLM (Task D) to create structured event entries (name, resolved date, highlights, mentions).
    2.  **Spike Detection:** Scan `Connections.csv` to find dates with connection addition spikes (deviating from normal baseline).
    3.  **Date Matching:** Correlate connections added on a specific date with the resolved *event date* from the post (within a 2-day window).
    4.  **Group Enrichment:** Apply the event tag to all connections added on that date and append a note detailing the event highlights (e.g., *"Met at the AI Meetup on 2026-07-06. Note: Sam Altman joined the panel discussion"*).
    5.  **Individual Mention Enrichment:** Find the graph node matching any person listed in `mentioned_people` and append their custom note (e.g., *"Organized the AI Meetup on 2026-07-06"*).

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

---

## 7. API Routing & Model Configuration

To support flexible and easily swappable API keys and models without hardcoding, the system keeps the LLM provider and model in environment configuration. Archive enrichment uses one high-quality DeepSeek model for all extraction tasks.

### A. The Abstraction Layer
The application code does not interact with specific providers (like OpenAI or Anthropic) directly. Instead, it calls the server-side archive enrichment Edge Function, which calls OpenRouter with the configured model.

### B. Configuration Schema (JSON / Environment Variables)
All API keys, endpoints, and model identifiers are stored in environment variables. This setup uses **DeepSeek** through OpenRouter for every archive enrichment task.

```json
{
  "OPENROUTER_API_KEY": "YOUR_OPENROUTER_API_KEY",
  "OPENROUTER_MODEL": "deepseek/deepseek-v4-pro"
}
```


### C. Task Routing Registry
All archive enrichment tasks use the same configured model so short invitations and long message summaries get the same reasoning quality:

| Task ID | Task Name | Model |
| :--- | :--- | :--- |
| **Task A** | Chat Transcript Summarizer | `OPENROUTER_MODEL` |
| **Task D** | Event & Post Content Analyzer | `OPENROUTER_MODEL` |
| **Task B** | Invitation Note Parser | `OPENROUTER_MODEL` |
| **Task C** | Job Title Classifier | Deterministic import code |
