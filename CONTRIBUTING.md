# Contributing to Online Everything Tool (OET)

First off, thank you for considering contributing to the Online Everything Tool! We welcome contributions from everyone. Your help is essential for keeping it great.

This document provides guidelines for contributing to OET. Please read it to ensure a smooth collaboration process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Styleguides](#styleguides)
  - [Git Commit Messages](#git-commit-messages)
  - [TypeScript Styleguide](#typescript-styleguide)
  - [Code Formatting & Linting](#code-formatting--linting)
- [Questions?](#questions)

## Code of Conduct

This project and everyone participating in it is governed by the [OET Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [Your Email or Contact Method - Optional].

## How Can I Contribute?

### Reporting Bugs

Bugs are tracked as [GitHub Issues](https://github.com/Online-Everything-Tool/oet/issues). Before opening a new issue, please check if the bug has already been reported.

When reporting a bug, please include as much detail as possible:

- **A clear and descriptive title.**
- **Steps to reproduce the bug.** Be specific!
- **What you expected to happen.**
- **What actually happened.** Include screenshots if helpful.
- **Environment details:** Browser version, Operating System.

### Suggesting Enhancements

Enhancement suggestions are also tracked as [GitHub Issues](https://github.com/Online-Everything-Tool/oet/issues). Before opening a new enhancement suggestion, please check if a similar idea has already been proposed.

When suggesting an enhancement:

- **Use a clear and descriptive title.**
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Explain why this enhancement would be useful** to OET users.
- **Include mockups or examples** if applicable.

### Your First Code Contribution

Unsure where to begin contributing to OET? You can start by looking through `good first issue` or `help wanted` issues: [Link to good first issues](https://github.com/Online-Everything-Tool/oet/labels/good%20first%20issue)

Working on your first Pull Request? You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github).

### Pull Requests

We actively welcome your pull requests!

1.  **Fork the repository** and create your branch from `main`. (e.g., `git checkout -b feat/my-new-tool` or `fix/issue-123`)
2.  **Set up the development environment** by following the instructions in the [README.md](README.md#getting-started-development).
3.  **Make your changes.** Ensure your code adheres to the project's style guides.
4.  **Add or update tests** if applicable. (Specify testing framework/commands if you have them).
5.  **Update the README.md** or other relevant documentation if your changes impact usage or features.
6.  **Ensure your code lints.** Run `[Your lint command, e.g., npm run lint]` and fix any issues.
7.  **Format your code.** Run `[Your format command, e.g., npm run format]` if you use Prettier or similar.
8.  **Write clear, concise commit messages** following our [Git Commit Guidelines](#git-commit-messages).
9.  **Push your branch** to your fork.
10. **Open a pull request** against the `Online-Everything-Tool/oet` `main` branch.
11. **Clearly describe your changes** in the pull request description. Explain the "what" and "why" of your contribution. Link to any relevant issues (e.g., `Fixes #123`).
12. **Be responsive to feedback.** Engage in the code review process and make necessary adjustments.

## Development Setup

Please refer to the [Getting Started (Development)](README.md#getting-started-development) section in the main `README.md` file for instructions on how to set up the project locally.

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature").
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...").
- Limit the first line to 72 characters or less.
- Reference issues and pull requests liberally after the first line.
- Consider using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for more structured messages (e.g., `feat: Add Base64 Encoder tool`, `fix: Correct calculation in Word Count`).

### TypeScript Styleguide

- Follow the standard conventions used in the existing codebase.
- Use TypeScript features appropriately (types, interfaces, etc.) to improve code clarity and safety.

### Code Formatting & Linting

This project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) (or specify otherwise, e.g., Tailwind Prettier plugin) for code formatting.

- Run `[Your lint command, e.g., npm run lint]` to check for linting errors.
- Run `[Your format command, e.g., npm run format]` to automatically format the code.
- Please ensure your code passes linting checks before submitting a pull request. Consider configuring your editor to lint and format on save.

## Questions?

If you have questions about contributing, feel free to open an issue and tag it with `question`.

Thank you for contributing!
