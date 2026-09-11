# Contributing to OpenInvento

Thank you for your interest in contributing to OpenInvento!

We welcome bug fixes, improvements, documentation updates, new features, and
other contributions that help improve the project.

## Contributor License Agreement

Before contributing to OpenInvento, please read the
[OpenInvento Contributor License Agreement](https://github.com/openinvento/openinvento/blob/main/CLA/CLA_v1.md).

All contributions submitted through GitHub must be covered by the
OpenInvento Contributor License Agreement.

When opening a pull request, you must accept the Contributor License Agreement.
The required comment is:

> I have read and understood the OpenInvento Contributor License Agreement, and I hereby agree to its terms.

By posting this comment, you confirm that:

- you have read and understood the OpenInvento Contributor License Agreement;
- you have the right and authority to submit the contribution;
- you agree to the terms of the Contributor License Agreement; and
- you grant the rights described in the Contributor License Agreement to the Project.

The CLA check will verify the acceptance and the contributors associated with
the pull request before the pull request can be merged.

If you cannot agree to the Contributor License Agreement, please do not submit
the contribution.

### Existing Contributors

If you have previously contributed to OpenInvento, you may need to accept the
current version of the Contributor License Agreement for a new contribution.

Each contribution is governed by the version of the Contributor License
Agreement accepted for that contribution.

## Pull Requests

Please keep pull requests focused on a specific change whenever possible.

Before submitting a pull request:

1. Make sure your changes are tested.
2. Update the documentation if necessary.
3. Read the current Contributor License Agreement.
4. Post the required CLA acceptance comment.
5. Provide a clear description of what your pull request changes and why.

Pull requests may be reviewed, modified, or declined by the project maintainers.

## Code Style

Please follow the existing code style and conventions used throughout the
project.

Keep changes consistent with the surrounding code and avoid unrelated changes
in the same pull request.

* Do not hardcode text strings. Always use i18n keys and translations. For new keys, always use nested structure.
For example: `const { t } = useTranslation();` and `<h1>{t('welcome')}</h1>`
Tip: For local development, the VSC extension "i18n Ally" is very helpful. It allows you to see all translations in one place and quickly add new keys.
* All pages have to be responsive and work on mobile devices. Use the Tailwind CSS responsive utilities to achieve this.
* All pages and components have to have a dark mode. Use the Tailwind CSS `dark:` utilities to achieve this or use defined default styles like `className: "card-bg"`

## Reporting Issues

If you find a bug or have a feature request, please open an issue and provide
as much relevant information as possible.

For security-related issues, please follow the project's security reporting
process instead of publicly disclosing the vulnerability.

## License

By contributing to OpenInvento, you agree to the
[OpenInvento Contributor License Agreement](https://github.com/openinvento/openinvento/blob/main/CLA/CLA_v1.md).