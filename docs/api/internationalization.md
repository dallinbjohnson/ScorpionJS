# Internationalization (i18n) with ScorpionJS

ScorpionJS provides comprehensive support for internationalization (i18n), enabling you to build applications that can be easily adapted to different languages and regional preferences.

## Overview

Manage translations, localize dates, numbers, and currencies, and handle language preferences seamlessly within your ScorpionJS services and APIs.

## Features

- **Locale Management**: Detect and manage user locales (e.g., from HTTP headers, query parameters, user profiles).
- **Translation Storage**: 
  - Support for common translation file formats (JSON, YAML, .po files).
  - Integration with i18n libraries like `i18next`, `polyglot.js`.
  - Adapters for storing translations in databases or external services.
- **Translation API**: A simple API for retrieving translated strings within your services, hooks, or templates.
  ```javascript
  // Example usage within a service
  async myMethod(data, params) {
    const greeting = params.t('greetings.hello', { name: params.user.name });
    // greeting might be 'Hello, John!' or '¡Hola, John!'
    return { message: greeting };
  }
  ```
- **Pluralization**: Handles plural forms correctly for different languages.
- **Date, Number, and Currency Formatting**: Localize dates, numbers, and currencies according to locale conventions.
- **Content Negotiation**: Serve localized content based on client preferences.
- **SSR/SSG Integration**: Works seamlessly with [Server-Side Rendering and Static Site Generation](./guides/ssr-ssg.md) for localized UIs.
- **Error Message Localization**: Return localized error messages to clients.

## Setup

Typically, you configure an i18n plugin for ScorpionJS:

```javascript
import { createApp } from 'scorpionjs';
import i18nPlugin from 'scorpionjs-i18n'; // Hypothetical package
import path from 'path';

const app = createApp();

app.configure(i18nPlugin({
  locales: ['en', 'es', 'fr'], // Supported locales
  defaultLocale: 'en',
  directory: path.join(__dirname, 'locales'), // Path to translation files
  queryParameter: 'lang', // Detect locale from query param (e.g., /api/messages?lang=es)
  headerField: 'Accept-Language', // Detect locale from HTTP header
  // Options for the underlying i18n library (e.g., i18next)
}));

// Example service using i18n
app.use('notifications', {
  async sendWelcome(user, params) {
    const message = params.t('notifications.welcomeMessage', { appName: 'ScorpionJS App' });
    // ... send notification with localized message ...
  }
});

app.listen(3000);
```

Translation files (e.g., `locales/en.json`, `locales/es.json`) would contain your translated strings:

```json
// locales/en.json
{
  "greetings": {
    "hello": "Hello, {{name}}!"
  },
  "notifications": {
    "welcomeMessage": "Welcome to {{appName}}!"
  }
}

// locales/es.json
{
  "greetings": {
    "hello": "¡Hola, {{name}}!"
  },
  "notifications": {
    "welcomeMessage": "¡Bienvenido a {{appName}}!"
  }
}
```
