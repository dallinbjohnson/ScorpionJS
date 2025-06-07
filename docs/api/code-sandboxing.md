# Secure Code Sandboxing in ScorpionJS

ScorpionJS provides powerful code sandboxing capabilities, allowing you to execute untrusted or potentially risky JavaScript code in isolated, secure environments. This is crucial for scenarios involving user-submitted scripts, third-party plugins, or any situation where code safety and resource control are paramount.

## Overview

The sandboxing feature enables the execution of JavaScript code with strict control over its access to system resources, network, filesystem, and even the parent Node.js process. By leveraging technologies like `isolated-vm` or similar V8 isolate-based solutions, ScorpionJS ensures that sandboxed code cannot compromise the stability or security of the main application.

This feature is designed to be integrated across various parts of the framework where dynamic or external code execution is needed.

## Key Features

- **Isolated Execution Environments**: Utilizes V8 isolates (e.g., via `isolated-vm`) to create completely separate JavaScript contexts with their own heap and execution thread.
- **Resource Limiting**:
    - **Memory Limits**: Configure maximum memory allocation for each sandbox.
    - **CPU Time Limits**: Set maximum execution time to prevent infinite loops or CPU-bound attacks.
- **Fine-Grained Permission Controls**:
    - **Filesystem Access**: Restrict or completely deny access to the filesystem.
    - **Network Access**: Control or block outgoing network requests.
    - **Environment Variables**: Limit visibility of environment variables.
    - **Process Control**: Prevent sandboxed code from interacting with `process` object methods like `exit()`.
- **Secure Inter-Context Communication**: Provides safe and structured mechanisms for passing data (arguments) into the sandbox and receiving results (return values or errors) from it.
- **Plugin Sandboxing**: Option to load and run ScorpionJS plugins within a sandboxed environment, limiting their potential impact.
- **Job/Task Sandboxing**: Execute specific job processors or custom task functions from the [Job Queues](./job-queues.md) system within a sandbox.
- **Dynamic Code Execution**: Safely execute dynamically generated or user-submitted JavaScript code snippets (e.g., for custom validation rules, data transformations, or serverless-like functions).
- **Reusable Sandbox Pools**: Efficiently manage and reuse sandbox instances to reduce overhead for frequent, short-lived executions.
- **Context Bridging**: Define a limited, explicit API surface (bridge) that sandboxed code can interact with from the main application, rather than exposing global objects directly.

## Use Cases

- **Running User-Submitted Scripts**: Allowing users to provide custom logic (e.g., for data validation, event handling, or workflow steps) without security risks.
- **Executing Third-Party Plugins**: Enhancing the security of the plugin ecosystem by running plugins with restricted permissions.
- **Safe Processing in Background Jobs**: Isolating potentially problematic code within job processors to prevent it from affecting other jobs or the worker process.
- **Serverless Function Execution**: Implementing a lightweight "Function-as-a-Service" capability within your ScorpionJS application.
- **Dynamic Rule Engines**: Executing business rules or logic that can be updated dynamically.
- **Secure Testing Environments**: Running tests or parts of tests in an isolated manner.

## Integration Points

The sandboxing API can be leveraged in:

- **Service Methods**: Services can offer methods that execute provided code in a sandbox.
- **Hooks**: Hooks can intercept requests/events and run custom sandboxed logic.
- **Job Queue Processors**: Individual job handlers can be wrapped in a sandbox.
- **Plugin System**: Plugins can be designed to run their core logic within a sandbox.
- **Custom Application Logic**: Anywhere in your application where you need to run JavaScript code with enhanced security.

## Example (Conceptual with `isolated-vm`)

```javascript
import { createApp, Sandbox } from 'scorpionjs'; // Assuming Sandbox is part of ScorpionJS core

const app = createApp();

app.service('customLogic', {
  async runUserScript(data, params) {
    const { script, context } = data; // User-provided script and its input context

    try {
      // Create a sandbox with resource limits
      const sandbox = new Sandbox({
        memoryLimit: 128, // MB
        timeout: 1000,    // ms
      });

      // Define a limited bridge for the sandboxed code to interact with
      const bridge = {
        log: (message) => console.log(`[Sandbox Log]: ${message}`),
        transformData: (input) => ({ ...input, processed: true }),
      };

      // Execute the script within the sandbox
      // The 'context' is passed as a global or specific argument to the script
      // The 'bridge' provides controlled functions the script can call
      const result = await sandbox.run({
        code: script,
        globals: { inputContext: context, scUtils: bridge } // Expose context and utils
      });

      return { success: true, result };
    } catch (error) {
      // Handle errors, including timeouts or out-of-memory
      console.error('Sandboxed script execution failed:', error.message);
      throw new Error(`Script execution error: ${error.message}`);
    }
  }
});

// Example usage:
// app.service('customLogic').runUserScript({
//   script: `
//     scUtils.log('Starting user script');
//     const transformed = scUtils.transformData(inputContext);
//     if (transformed.value > 10) {
//       return { output: transformed.value * 2, status: 'high_value' };
//     }
//     return { output: transformed.value, status: 'normal_value' };
//   `,
//   context: { value: 15, user: 'testUser' }
// });
```

This feature provides a robust foundation for building more dynamic, extensible, and secure applications with ScorpionJS.
