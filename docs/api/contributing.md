# Contributing to ScorpionJS

We welcome contributions to ScorpionJS! You can help by improving the core framework, creating plugins or extensions, writing documentation, or helping other users. This guide explains how to get started.

---

## Ways to Contribute
- **Core:** Add features, fix bugs, or improve performance.
- **Plugins/Extensions:** Build and publish reusable plugins for services, hooks, transports, integrations, etc.
- **Documentation:** Improve or expand the docs, add guides, or fix typos.
- **Examples:** Share example apps and code snippets.
- **Issues:** Report bugs or request features via GitHub Issues.

---

## Getting Started
1. Fork the [ScorpionJS repository](https://github.com/dallinbjohnson/ScorpionJS).
2. Clone your fork and create a new branch.
3. Make your changes and add tests if relevant.
4. Run the test suite: `npm test` or `bun test`.
5. Commit and push your changes.
6. Open a pull request (PR) with a clear description.

---

## Coding Standards
- Use consistent code style (see `.editorconfig` and `.eslintrc` in the repo).
- Write clear, descriptive commit messages.
- Add or update tests for new features or bug fixes.
- Document all public APIs and plugin options with JSDoc.

---

## Creating Plugins
- See [Plugins & Extensions](./plugins.md) for plugin structure and best practices.
- Name your plugin `scorpionjs-<feature>` (e.g., `scorpionjs-authentication`).
- Include a `README.md` with usage instructions and examples.
- Add tests and examples in `/test` and `/example` folders.
- Publish to npm and announce in the community.

---

## Writing Documentation
- Use Markdown for all documentation.
- Organize docs under `/docs` by topic.
- Add cross-links to related docs.
- Use code blocks with language tags (e.g., ```javascript).
- Keep examples up to date with the latest API.

---

## Submitting Issues & Feature Requests
- Search existing issues before opening a new one.
- Include clear steps to reproduce bugs.
- Suggest possible solutions or alternatives if possible.
- Use GitHub Discussions for questions or ideas.

---

## Community Guidelines
- Be respectful and constructive.
- Follow the [Code of Conduct](https://github.com/dallinbjohnson/ScorpionJS/blob/main/CODE_OF_CONDUCT.md).
- Help others and share knowledge.

---

## Further Reading
- [Plugins & Extensions](./plugins.md)
- [Testing](./testing.md)
- [API Reference](./README.md)
- [Migration Guide](./migration.md)
