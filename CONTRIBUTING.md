# Contributing

Thanks for your interest in contributing to DynamicRounding.

## Reporting Issues

Open a GitHub issue with:

- What you expected to happen
- What actually happened
- Example input values and parameters that reproduce the problem
- Which implementation (JS or Python) and which mode you're using

## Suggesting Features

Open a GitHub issue describing:

- The use case
- How you'd expect it to work
- Example input/output if applicable

## Development Workflow

Follow [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow). All changes come through Pull Requests.

1. Create a feature branch (`git checkout -b feature/my-description`)
    - *External contributors: fork the repo first.*
2. Make and test your changes (see below)
3. Submit a PR with a clear description

### Code Style

- Keep it simple and readable
- Add comments for any new parameters (JSDoc for JS, docstrings for Python)
- Maintain backward compatibility with existing signatures

## Testing

### JavaScript (Google Sheets)

Run the test suite:
```bash
cd js
node tests.js
```

Also verify in the [template spreadsheet](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) "Tests" tab.

### Python

Run the test suite:
```bash
cd python
pip install -e ".[dev]"
pytest
```

## Questions

Open an issue. Happy to help.