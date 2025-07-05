# Contributing to Gem-And-I-Visuals

First off, thank you for considering contributing. This project is a labor of love, and every contribution helps make it better.

This document provides a set of guidelines for contributing to this project. These are mostly guidelines, not strict rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior.

## How Can I Contribute?

### Reporting Bugs

Bugs are tracked as [GitHub Issues](https://github.com/Makay-Scribe/Gem-And-I-Visuals/issues). Before opening a new issue, please perform a search to see if the problem has already been reported.

When you are creating a bug report, please include as many details as possible. Fill out the required template, the information it asks for helps us resolve issues faster. A good bug report should include:

*   **A clear and descriptive title.**
*   **Steps to reproduce the issue.** Be as specific as possible.
*   **A description of the expected behavior.**
*   **A screenshot or GIF** demonstrating the issue.
*   **Any error messages** from the browser's developer console.

### Suggesting Enhancements

Enhancement suggestions are tracked as [GitHub Issues](https://github.com/Makay-Scribe/Gem-And-I-Visuals/issues).

When suggesting an enhancement, please explain in detail how it would work and why it would be a valuable addition to the project.

### Your First Code Contribution

Unsure where to begin? You can start by looking through `good first issue` and `help wanted` issues.

## Development Workflow

1.  Create a personal fork of the project on GitHub.
2.  Create a new branch for your work: `git checkout -b feature/your-feature-name`.
3.  Make your changes, and commit them with a clear, descriptive commit message.
4.  Push your branch to your fork on GitHub.
5.  Submit a pull request to the `main` branch of the main repository.

## Style Guides

### Git Commit Messages

*   Use the present tense ("Add feature" not "Added feature").
*   Use the imperative mood ("Move file to..." not "Moves file to...").
*   Limit the first line to 72 characters or less.
*   Reference issues and pull requests liberally in the body of the commit message.

### JavaScript Style Guide

*   All JavaScript code is automatically formatted with [Prettier](https://prettier.io/). Please ensure you have it set up in your editor or run it before committing.
*   Use `class` and `module` syntax (ES6).
*   Comment complex or non-obvious sections of code.

### GLSL Style Guide

*   Use `u_` prefix for uniforms (e.g., `uniform float u_time;`).
*   Use `t_` prefix for texture samplers (e.g., `uniform sampler2D t_audio;`).
*   Use `v` prefix for varyings passed from vertex to fragment shader (e.g., `varying vec2 vUv;`).

By following these guidelines, you help keep the project clean, organized, and easy to maintain.