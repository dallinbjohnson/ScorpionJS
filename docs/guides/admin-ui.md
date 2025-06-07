# ScorpionJS Admin Dashboard

ScorpionJS includes an official, feature-rich Admin Dashboard that provides a user-friendly interface for managing and monitoring your applications. This out-of-the-box solution helps developers and administrators oversee their ScorpionJS deployments with ease.

## Features

- **Service Management**: View all registered services, their status, and available methods.
- **Data Browser**: Perform basic CRUD operations on your service data (configurable and permission-based).
- **Real-time Monitoring**: Monitor active WebSocket connections, event emissions, and real-time traffic.
- **Configuration Overview**: View current application and service configurations.
- **User Management**: (If using ScorpionJS authentication) Manage users, roles, and permissions.
- **Task Monitoring**: (If using Job Queues) View the status of background jobs and tasks.
- **Extensible**: The Admin Dashboard is built with a plugin architecture, allowing for custom views and functionality.

## Getting Started

The Admin Dashboard can be easily integrated as a ScorpionJS plugin:

```javascript
import { createApp } from 'scorpionjs';
import adminDashboard from 'scorpionjs-admin';

const app = createApp();

// Configure the admin dashboard
app.configure(adminDashboard({
  // options like auth protection, base path, etc.
  auth: true, // Requires authentication to access
  basePath: '/admin'
}));

app.listen(3000);
```

Once configured, you can access the dashboard at the specified path (e.g., `http://localhost:3000/admin`).
