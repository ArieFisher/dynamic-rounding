# Contributing

Thanks for your interest in contributing to DynamicRounding.

## Reporting Issues

Open a GitHub issue with:

- What you expected to happen
- What actually happened
- Example input values and parameters that reproduce the problem
- Whether you're using array mode or sort-safe mode

## Suggesting Features

Open a GitHub issue describing:

- The use case
- How you'd expect it to work
- Example input/output if applicable

## Development Workflow

We follow a [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow) approach:

1.  **Main is always deployable**: The `main` branch contains the latest stable code.
2.  **No direct commits to main**: ALl changes must come through a Pull Request.
3.  **Short-lived feature branches**: Create a branch for each feature or fix. Sync with `main` frequently.
4.  **Pull Requests**: Open a PR as soon as you have a small, working set of changes.

## Pull Requests

1. Fork the repo (if you are an external contributor)
2. Create a branch for your change (`git checkout -b feature/my-feature`)
3. Test your changes in a Google Sheet
4. Submit a PR with a clear description

### Code Style

- Keep it simple and readable
- Add JSDoc comments for any new parameters
- Maintain backward compatibility with existing signatures
- Test edge cases

### Testing Checklist

Before submitting, verify your changes work with:

- Positive and negative numbers
- Decimals (0.035, 0.0001)
- Percentages (132%, 7%)
- Zeros and empty cells
- Single cells and ranges
- Numbers across multiple orders of magnitude
- Formatted strings (commas, currency symbols)
- Non-numeric values (should pass through unchanged)
- Array mode: `=ROUND_DYNAMIC(A1:A12)`
- Sort-safe mode: `=ROUND_DYNAMIC(A1, $A$1:$A$12)`
- Invalid parameters (grain > 1, grain <= 0, non-numeric grain)

## Questions

Open an issue. Happy to help.
