# Commonry

> **Open-source educational infrastructure for the global commons** — a spaced repetition learning platform built as a public good, not a product.

[![Live Platform](https://img.shields.io/badge/platform-commonry.app-00C8B0?style=flat-square)](https://commonry.app)
[![Forum](https://img.shields.io/badge/community-forum.commonry.app-00C8B0?style=flat-square)](https://forum.commonry.app)
[![License](https://img.shields.io/badge/license-FOSS%20(Pending)-00C8B0?style=flat-square)](#license)
[![Operated by](https://img.shields.io/badge/operated%20by-Give%20Protocol%20Foundation-555?style=flat-square)](#)

---

## What Is Commonry?

Commonry is an open-source spaced repetition learning platform—designed from the ground up as shared educational infrastructure. It is operated and sustained by the [Give Protocol Foundation](https://giveprotocol.org), a non-profit organization dedicated to fostering global charitable action and open-access tools.

**Commonry is built on a simple belief: education is a common good, not a commodity.**

While commercial learning apps prioritize "engagement" for revenue, Commonry is optimized for **genuine learning outcomes**, community trust, and long-term accessibility. We treat every learner's data as a contribution to a shared knowledge commons—not a product to be monetized.

---

## Core Philosophy

* **Education as Infrastructure:** Like roads or libraries, the tools we use to learn should be maintained for collective benefit. Commonry is built openly, collaboratively, and with a multi-generational time horizon.
* **Errors as Diagnostic Data:** Traditional SRS asks "when should you see this card again?" Commonry treats every "forgotten" card not as a failure, but as a diagnostic signal. We ask: *"What does this mistake tell us about your underlying knowledge graph?"*
* **ADHD-Friendly & Shame-Free:** The interface is built for focus. We emphasize:
    * **Zero Modal Interruptions:** No pop-ups to break your flow.
    * **No "Streaks":** We value consistency, but we reject the "streak" mechanic that leverages shame to drive engagement.
    * **Generous Whitespace:** A high-contrast, low-stimulation environment to reduce cognitive load.
* **Community over Competition:** Progress is celebrated, not ranked. The commons grows stronger when everyone contributes to the quality of shared decks.

---

## Features

### For Learners
-   **FSRS Scheduling:** Powered by the state-of-the-art [Free Spaced Repetition Scheduler](https://github.com/open-spaced-repetition/fsrs4anki) for mathematically optimal review timing.
-   **Your Plot:** A private, personalized study space with session history and progress tracking.
-   **Harvest:** Highly focused review sessions designed for deep work and flow.
-   **Anki Import:** Seamlessly migrate existing decks; no starting from zero.
-   **Persistent Preferences:** Your font size, session length, and interface settings follow you across devices.

### For the Community
-   **The Commons:** A browsable, hierarchically organized library of public knowledge.
-   **The Square:** Integrated community forum (Discourse) for collaborative discussion.
-   **Git-like Workflows:** Propose, review, and merge improvements to community decks. Anyone can suggest a correction or a better explanation.
-   **Tiered Permissions:** Canonical (moderated), Verified, and Open contribution tiers to balance quality with inclusivity.

### Future Roadmap
-   **AI-Powered Error Pattern Recognition:** Analyzing diagnostic signals to identify "leaks" in understanding.
-   **Knowledge Graph Modeling:** Moving from discrete card states toward a holistic model of a learner's mastery.
-   **Public Data Commons:** Releasing anonymized, opt-in learning data as open datasets for academic research.

---

## Tech Stack

| Component | Technology | Status |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS | Active |
| **Database** | PostgreSQL with Drizzle ORM | Active |
| **IDs** | Prefixed ULIDs (Sortable & Unique) | Active |
| **Animations** | Framer Motion | Active |
| **Forum** | Self-hosted Discourse | Active |
| **Infrastructure** | High-performance self-hosted server cluster | Active |
| **Deployment** | Netlify + Cloudflare Tunnel | Active |

---

## Design System

Commonry utilizes a **terminal/retro-futurism aesthetic**—monospace typography, dark backgrounds, and cyan (`#00C8B0`) as the primary accent. The design is precise, no-nonsense, and reflects our value of taking learning seriously.

Navigation uses commons-inspired metaphors:
-   `$ cd ~/plot` — **Your Plot** (Personal study)
-   `$ cd ~/commons` — **The Commons** (Public decks)
-   `$ cd ~/harvest` — **Harvest** (Active review)
-   `$ cd ~/square` — **The Square** (Community forum)

---

## Project Status

Commonry is **actively deployed** at [commonry.app](https://commonry.app). Our current focus is the integration of a major data instrumentation layer to capture behavioral signals during study sessions while maintaining a seamless, "zero-friction" user experience.

---

## Contributing

Commonry is open-source and thrives on community contribution. Whether you're a developer, educator, or designer, your input is valuable.

-   **Join the Conversation:** Browse open issues on [The Square](https://forum.commonry.app).
-   **Curate the Commons:** Propose improvements to existing community decks.
-   **Code:** Help us build the infrastructure. Detailed guidelines are forthcoming.

---

## License

Commonry is committed to being Free and Open Source Software (FOSS). We are currently finalizing the specific license (anticipating AGPL-3.0 for the core platform) to ensure the knowledge commons remains protected and accessible to all.

---

*Built with care by the Give Protocol Foundation. Education belongs to everyone.*
