# Database & ORM Integration in ScorpionJS

ScorpionJS is designed to be data-agnostic, allowing you to connect to virtually any database. To streamline development, ScorpionJS provides official adapters and well-documented integration patterns for popular databases and Object-Relational Mappers (ORMs).

## Overview

Easily integrate your preferred database or ORM with ScorpionJS services to manage data persistence efficiently.

## Supported Adapters & ORMs

ScorpionJS offers first-class support or clear guidance for integrating with:

- **ORMs**:
  - Prisma
  - TypeORM
  - Sequelize
  - Mongoose (for MongoDB)
- **Query Builders**:
  - Knex.js
- **Databases**:
  - PostgreSQL
  - MySQL / MariaDB
  - SQLite
  - MongoDB
  - Redis (for caching and specialized data structures)

## Features

- **Service Adapters**: Pre-built service adapters that implement standard service methods for common ORMs.
- **Transaction Management**: Guidance on handling database transactions within ScorpionJS services and hooks.
- **Schema Migrations**: Integration with ORM migration tools.

See the specific adapter documentation for detailed setup and usage instructions.
