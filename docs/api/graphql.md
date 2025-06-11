# GraphQL API with ScorpionJS

ScorpionJS offers first-class support for GraphQL, allowing you to expose your services through a GraphQL API alongside or instead of REST and WebSockets. This provides clients with powerful and flexible data querying capabilities.

## Overview

Integrate GraphQL seamlessly into your ScorpionJS application. ScorpionJS can automatically generate GraphQL schemas from your existing services or allow you to define custom schemas.

## Features

- **Automatic Schema Generation**: Generate GraphQL types, queries, and mutations from your ScorpionJS services and their schemas.
- **Custom Resolvers**: Easily define custom resolvers to handle complex data fetching logic or integrate with non-service data sources.
- **Real-time with Subscriptions**: Leverage GraphQL Subscriptions over WebSockets for real-time updates, powered by ScorpionJS's event system.
- **Service Integration**: GraphQL resolvers can directly call your ScorpionJS service methods, reusing all your business logic and hooks.
- **Authentication & Authorization**: ScorpionJS hooks and security mechanisms apply to GraphQL requests, ensuring consistent security policies.
- **Batching & Caching**: Utilize tools like DataLoader for request batching and integrate with ScorpionJS caching for improved performance.

## Setup

To enable GraphQL, you typically configure a GraphQL transport plugin:

```javascript
import { createApp } from 'scorpionjs';
import graphqlTransport from 'scorpionjs-graphql';

const app = createApp();

// Register services
app.use('users', { /* ... */ });
app.use('posts', { /* ... */ });

// Configure GraphQL transport
app.configure(graphqlTransport({
  // Options for schema generation, graphiql, etc.
  autoSchema: true, // Automatically generate schema from services
  graphiql: true,   // Enable GraphiQL interface
  path: '/graphql'
}));

app.listen(3000);
```

Clients can then send GraphQL queries to the `/graphql` endpoint.
