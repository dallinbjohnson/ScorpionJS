# Job Queues & Task Scheduling with ScorpionJS

ScorpionJS provides robust support for background job processing and task scheduling, allowing you to offload long-running tasks, manage retries, and schedule periodic jobs efficiently.

## Overview

Integrate seamlessly with popular job queue systems or use ScorpionJS's built-in capabilities to manage asynchronous tasks.

## Features

- **Adapters for Popular Queues**: 
  - BullMQ / Bull
  - Agenda.js
  - RabbitMQ (via common libraries)
  - Kafka (for event-driven task processing)
- **Built-in Simple Queue**: For development or less demanding use cases, ScorpionJS offers a simple in-memory or database-backed queue.
- **Job Definition**: Easily define jobs that can call service methods or custom functions.
- **Task Scheduling**: Schedule jobs to run at specific times, recurring intervals (CRON expressions), or after a delay.
- **Retry Mechanisms**: Automatic retries for failed jobs with configurable backoff strategies.
- **Concurrency Control**: Manage the number of concurrent workers processing jobs.
- **Progress Tracking**: Monitor the progress of long-running jobs.
- **Prioritization**: Assign priorities to jobs to ensure critical tasks are processed first.
- **Distributed Workers**: Scale your job processing capabilities by running workers on multiple nodes.
- **Admin UI Integration**: Monitor and manage jobs through the [ScorpionJS Admin Dashboard](./guides/admin-ui.md).

## Setup Example (with BullMQ adapter)

```javascript
import { createApp } from 'scorpionjs';
import jobQueue from 'scorpionjs-bullmq';

const app = createApp();

// Configure the job queue
app.configure(jobQueue({
  connection: {
    host: 'localhost',
    port: 6379
  }
}));

// Define a job processor (can be a service method)
app.service('email', {
  async sendWelcomeEmail(job) {
    const { userId } = job.data;
    // ... logic to send email ...
    console.log(`Welcome email sent to user ${userId}`);
    return { status: 'sent' };
  }
});

// Add a job to the queue
async function enqueueWelcomeEmail(userId) {
  await app.jobs.getQueue('default').add('sendWelcomeEmail', {
    service: 'email',
    method: 'sendWelcomeEmail',
    data: { userId }
  });
}

// Schedule a recurring task
app.jobs.getQueue('default').add('cleanupOldData', 
  { service: 'dataMaintenance', method: 'cleanup' }, 
  { repeat: { cron: '0 0 * * *' } } // Every day at midnight
);

app.listen(3000);
```
