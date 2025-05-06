# Online Everything Tool (OET)

<!-- Optional: Add your new organization logo/icon here -->
<!-- ![OET Logo](URL_TO_YOUR_LOGO.png) -->

<!-- Optional: Add Badges (Build Status, License, Version, etc.) -->
<!-- Example: [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) -->

**A versatile collection of useful online tools, accessible directly from your browser.**

OET aims to provide a single, easy-to-use interface for various common (and maybe uncommon!) tasks you might need to perform online, without needing to install separate applications.

**All core tools are completely client-based.** Use OET with confidence that no data leaves your browser for core operations. This means sensitive information you work with is never transmitted over the internet or stored on our servers for processing, ensuring maximum privacy and security.

## ✨ Features

- **Extensive Tool Suite:** Access a growing collection of client-side utilities for text, data, image manipulation, and more.
- **Privacy First:** All core tool operations run entirely in your browser.
- **Simple & Clean UI:** Focuses on ease of use with a consistent interface powered by Shoelace components.
- **AI-Assisted Tool Building:** Contribute new tools easily using our integrated AI build process (see Contributing below).
- **PWA Enabled:** Many tools work offline after the initial visit.
- **History Tracking:** Keep track of your previous operations within the tool.

## 🚀 Live

[https://online-everything-tool.com](https://online-everything-tool.com)

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **UI Components:** [Shoelace](https://shoelace.style/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **AI Integration:** [Google Gemini](https://gemini.google.com/)
- **Deployment:** [AWS Cloudfront / S3 / API Gateway] _(Adjust as needed)_

## 📜 New Tool Rules & Guidelines

When developing or proposing new tools, please adhere to the following principles:

1.  **Directive Naming:**
    - Tool URL paths (directives) should follow the format `<thing>-<operation>` or `<thing>-<operation>-<operation>` (e.g., `text-reverse`, `json-validator-formatter`).
    - Use lowercase kebab-case only.
    - Avoid articles ('a', 'an', 'the') and short prepositions ('to', 'for', 'with') in directives. Use `image-resize`, not `resize-an-image`.
2.  **Client-Side Core Logic:** The primary functionality of the tool **must** run entirely within the user's browser using JavaScript/Web APIs. No external network calls should be required for the core operation. (Exceptions may exist for fetching non-essential data sources, like public word lists, if clearly justified).
3.  **UI Simplicity:** Keep the user interface clean, focused, and intuitive. Leverage existing Shoelace components where possible for consistency. Avoid overly complex layouts or unnecessary visual clutter.
4.  **Security:** Do not handle sensitive user data in a way that requires server-side processing or external storage for the tool's main function.

## ⚙️ Getting Started (Development)

Follow these instructions to get a local copy up and running for development purposes.

**Prerequisites:**

- Node.js (Version specified in `.nvmrc` or >= v18 recommended)
- Package manager: This project uses **npm** (based on `package-lock.json`). Ensure you have it installed.

**Installation:**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Online-Everything-Tool/oet.git
    cd oet
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:** Copy `.env.blank` to `.env` and fill in the required values (especially `GEMINI_API_KEY` for full functionality).
    ```bash
    cp .env.blank .env
    # Now edit .env with your credentials
    ```
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) (or your configured port) in your browser.

## 🤝 Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) file for details on our code of conduct and the full process for submitting pull requests. _(Reminder: Create CONTRIBUTING.md)_

**Ways to contribute:**

- Report bugs or suggest features by opening an issue.
- Use the built-in **AI-Assisted Build Tool** to easily propose and generate new client-side utilities. This can facilitate both anonymous suggestions and contributions leading to standard GitHub Pull Requests.
- Submit pull requests directly with bug fixes or new features/tools developed locally (following the 'New Tool Rules').
- Improve documentation.

## 📄 License

This project is licensed under the [MIT License](LICENSE). _(Reminder: Add LICENSE file)_

## 📧 Contact

- Project Maintainer: [Kevin McIntyre/kmcintyre](https://github.com/kmcintyre)
- Issues: [https://github.com/Online-Everything-Tool/oet/issues](https://github.com/Online-Everything-Tool/oet/issues)
