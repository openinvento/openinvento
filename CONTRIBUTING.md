

* Do not hardcode text strings. Always use i18n keys and translations
For example: `const { t } = useTranslation();` and `<h1>{t('welcome')}</h1>`
* All pages have to be responsive and work on mobile devices. Use the Tailwind CSS responsive utilities to achieve this.
* All pages and components have to have a dark mode. Use the Tailwind CSS `dark:`  utilities to achieve this or use defined default styles like `className: "card-bg"` 