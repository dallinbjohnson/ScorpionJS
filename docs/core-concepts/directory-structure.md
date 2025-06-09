# Directory Structure

A typical ScorpionJS application follows a conventional directory structure to organize its components. While flexible, adhering to this structure promotes consistency and maintainability.

Here's an overview of the common directories and their purposes:

```
my-scorpion-app/
├── src/                      # Main application source code
│   ├── services/             # Service definitions
│   │   ├── [service-name]/   # Folder for a specific service
│   │   │   ├── [service-name].js        # Main service file (instantiates and configures the service)
│   │   │   ├── [service-name].class.js  # Service class implementation
│   │   │   ├── [service-name].hooks.js  # Main hooks file for the service (imports from hooks/ subfolder)
│   │   │   ├── hooks/                   # Optional: Folder for individual service-specific hook files
│   │   │   │   ├── index.js             # Aggregates and exports individual hook files
│   │   │   │   └── example.js           # Example individual service hook implementation
│   │   │   ├── utils/                   # Optional: Folder for service-specific utility functions
│   │   │   │   ├── index.js             # Aggregates and exports service utility functions
│   │   │   │   └── helper.js            # Example service utility function
│   │   │   └── [service-name].schema.js # Data validation schemas for the service
│   │   └── index.js            # Aggregates and exports all services
│   ├── hooks/                # Global or reusable application-level hooks
│   │   └── logging-hook.js
│   ├── schemas/              # Shared/global data validation schemas
│   │   ├── index.js            # Aggregates and exports shared schemas
│   │   └── shared-entity.schema.js # Example shared schema
│   ├── utils/                # Global or reusable utility functions
│   │   ├── index.js            # Aggregates and exports global utility functions
│   │   └── global-helper.js    # Example global utility function
│   ├── middleware/           # Custom middleware
│   │   └── error-handler.js
│   ├── channels.js           # Real-time event channel configurations
│   ├── app.js                # Core application setup and configuration
│   └── index.js              # Main entry point to start the application
├── config/                   # Application configuration files
│   ├── default.json          # Default configuration
│   └── production.json       # Production-specific configuration
├── public/                   # Static assets (HTML, CSS, images) served to clients
│   └── index.html
├── test/                     # Test suites
│   ├── services/             # Service-specific unit tests
│   │   └── [service-name].test.js
│   ├── app.test.js           # Integration or end-to-end tests
│   └── setup.js              # Test environment setup
├── .env                      # Environment variables (ignored by Git)
├── .gitignore                # Specifies intentionally untracked files
├── package.json              # Project metadata and dependencies
└── README.md                 # Project overview and instructions
```

## Key Directories Explained

### `src/`
This is the heart of your application, containing all the JavaScript/TypeScript source code.

*   **`src/services/`**: This is where you define your application's services. Each service typically resides in its own subdirectory (e.g., `src/services/users/`) and includes:
    *   `[service-name].js`: The main file for the service. This is often where the service class is imported, instantiated, and configured with options and hooks before being exported for registration with the ScorpionJS application.
    *   `[service-name].class.js`: The service class implementation, containing the core logic and methods (e.g., `find`, `get`, `create`, `update`, `patch`, `remove`, and custom methods).
    *   `[service-name].hooks.js`: This file serves as the main entry point for the service's hooks. It typically imports all hooks from the `hooks/` subfolder (often via its `index.js`) and re-exports them, or composes them as needed for application to the service.
    *   `hooks/`: A dedicated folder containing the actual implementations of individual hooks specific to this service. Hook files within this folder are named descriptively (e.g., `populateUser.js`, `validateItem.js`). An `index.js` file within this `hooks` folder aggregates and exports these individual hook files, making them available for import by `[service-name].hooks.js`.
    *   `[service-name].schema.js`: Contains schema definitions (e.g., using Joi, Ajv, TypeBox, Zod, or similar libraries) for validating data passed to service methods. These schemas are often used in conjunction with validation hooks.
    *   `utils/` (Optional): A folder for utility functions that are specific to this service. It would typically have an `index.js` to export these helpers (e.g., `src/services/[service-name]/utils/helper.js`).
    *   An `index.js` file within `src/services/` can be used to easily import and register all services in your `app.js`.

*   **`src/hooks/`**: Contains reusable hooks that can be applied across multiple services or globally. These are distinct from service-specific hooks found within each service's `hooks/` subfolder.

*   **`src/schemas/`**: This directory is for data validation schemas (e.g., using Joi, Ajv, TypeBox, Zod, or similar libraries) that are shared across multiple services or are considered global to the application. It typically includes an `index.js` to export all shared schemas, making them easily importable where needed. Individual schema files like `shared-entity.schema.js` would define these reusable schemas. This is distinct from service-specific schemas located in `src/services/[service-name]/[service-name].schema.js`.

*   **`src/utils/`**: This directory is intended for global utility functions or helper modules that can be reused across different parts of the application, such as date formatters, string manipulation functions, or other common helpers. It typically includes an `index.js` to aggregate and export these utilities (e.g., `src/utils/global-helper.js`).

*   **`src/middleware/`**: If you need custom middleware you can place them here. Examples include custom error handlers, authentication middleware, etc.


*   **`src/channels.js`**: Configures real-time event channels for WebSocket communication. This file defines how events are published and subscribed to by clients.

*   **`src/app.js`**: The main application file where you instantiate ScorpionJS, configure plugins, middleware, services, and channels.

*   **`src/index.js`**: The primary entry point for your application. It typically imports `app.js` and starts the server.

### `config/`
This directory holds configuration files for different environments (e.g., `default.json`, `development.json`, `production.json`). ScorpionJS often uses libraries like `config` to manage these.

### `public/`
Contains static files that will be served directly to clients, such as HTML, CSS, client-side JavaScript, images, etc.

### `test/`
This directory is for your automated tests. It now includes:
*   **`services/`**: Contains unit tests for individual services (e.g., `[service-name].test.js`).
*   Integration tests that verify interactions between different parts of your application (e.g., `app.test.js`).
*   End-to-end tests that simulate user scenarios.
*   A `setup.js` file for test environment configuration.

## Customization

While this structure provides a solid foundation, ScorpionJS is flexible. You can adapt this structure to fit your project's specific needs. The key is to maintain clarity and make it easy for developers to locate and understand different parts of the codebase.

Remember that all routes originate from services, as per ScorpionJS design principles. This means even utility endpoints like health checks would typically be implemented as methods on a dedicated service.
