# Observability in ScorpionJS

ScorpionJS is designed with observability in mind, providing comprehensive tools and integrations for logging, metrics, and distributed tracing. This allows you to gain deep insights into your application's behavior, performance, and health.

## Overview

Easily monitor and debug your ScorpionJS applications, whether they are monoliths or distributed microservices.

## Features

### 1. Advanced Logging
ScorpionJS includes a powerful and configurable logger (see [Configuration API](./configuration.md)).
- **Structured Logging**: Output logs in JSON or other structured formats for easier processing.
- **Log Levels**: Fine-grained control over log verbosity.
- **Contextual Logging**: Automatically include request IDs, user IDs, and other contextual information in logs.
- **Integration with Logging Services**: Easily ship logs to services like Datadog, Splunk, ELK Stack.

### 2. Metrics Collection
- **Built-in Metrics**: ScorpionJS exposes key performance indicators (KPIs) for services, transports, and the application itself (e.g., request latency, error rates, active connections).
- **Prometheus Integration**: Official support for exposing metrics in Prometheus format.
- **Custom Metrics**: API to define and track custom application-specific metrics.
- **Dashboard Integration**: Visualize metrics using tools like Grafana.

### 3. Distributed Tracing
- **OpenTelemetry Support**: First-class integration with OpenTelemetry for end-to-end distributed tracing in microservice architectures.
- **Automatic Instrumentation**: Automatic tracing of service calls, hook executions, and transport requests.
- **Context Propagation**: Ensures trace context is propagated across service boundaries, including asynchronous operations and job queues.
- **Custom Spans**: Ability to create custom spans to trace specific parts of your application logic.
- **Integration with Tracing Backends**: Send trace data to backends like Jaeger, Zipkin, Datadog APM.

## Setup Example (OpenTelemetry)

```javascript
import { createApp } from 'scorpionjs';
import { configureOpenTelemetry } from 'scorpionjs-opentelemetry'; // Hypothetical package

// Configure OpenTelemetry (e.g., set up exporter, service name)
configureOpenTelemetry({
  serviceName: 'my-scorpion-app',
  exporter: {
    type: 'jaeger', // or 'zipkin', 'otlp_http'
    endpoint: 'http://localhost:14268/api/traces'
  }
});

const app = createApp({
  // Application configuration
  observability: {
    tracing: {
      enabled: true,
      // provider: 'opentelemetry' (default if scorpionjs-opentelemetry is configured)
    },
    metrics: {
      enabled: true,
      provider: 'prometheus', // Expose /metrics endpoint
      path: '/metrics'
    }
  }
});

// Services and other app setup
app.service('users', { /* ... */ });

app.listen(3000);
```
