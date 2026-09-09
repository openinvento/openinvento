

* Do not hardcode text strings. Always use i18n keys and translations. For new keys, always use nested structure.
For example: `const { t } = useTranslation();` and `<h1>{t('welcome')}</h1>`
Tip: For local development, the VSC extension "i18n Ally" is very helpful. It allows you to see all translations in one place and quickly add new keys.
* All pages have to be responsive and work on mobile devices. Use the Tailwind CSS responsive utilities to achieve this.
* All pages and components have to have a dark mode. Use the Tailwind CSS `dark:`  utilities to achieve this or use defined default styles like `className: "card-bg"` 