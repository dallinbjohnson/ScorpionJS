# Plugins API - Part 2: Advanced Plugin Development

This document continues the Plugins API documentation with advanced topics for plugin development in ScorpionJS.

## Service Plugins

### Creating Service Plugins

```javascript
// messages-service-plugin.js
export default function messagesServicePlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      servicePath: 'messages',
      ...options
    };
    
    // Register the service
    app.service(opts.servicePath, {
      messages: [],
      
      async find(params) {
        return this.messages;
      },
      
      async get(id, params) {
        const message = this.messages.find(m => m.id === id);
        if (!message) {
          throw new Error('Message not found');
        }
        return message;
      },
      
      async create(data, params) {
        const message = {
          id: Date.now().toString(),
          text: data.text,
          createdAt: new Date(),
          userId: params.user?.id || 'anonymous'
        };
        
        this.messages.push(message);
        return message;
      }
    });
    
    // Add hooks to the service
    app.service(opts.servicePath).hooks({
      before: {
        create: [
          async context => {
            if (!context.data.text) {
              throw new Error('Message text is required');
            }
            return context;
          }
        ]
      }
    });
  };
}

// Usage
app.configure(messagesServicePlugin({
  servicePath: 'chat-messages'
}));
```

### Database Service Plugins

```javascript
// mongodb-service-plugin.js
export default function mongodbServicePlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      Model: null,
      paginate: {
        default: 10,
        max: 50
      },
      ...options
    };
    
    if (!opts.Model) {
      throw new Error('MongoDB model is required');
    }
    
    // Create a service factory
    app.createMongoDBService = function(path, serviceOptions = {}) {
      // Create the service
      app.service(path, {
        Model: serviceOptions.Model || opts.Model,
        paginate: serviceOptions.paginate || opts.paginate,
        
        async find(params) {
          const { query = {}, paginate = true } = params;
          const { $skip = 0, $limit = this.paginate.default } = query;
          
          // Build the MongoDB query
          const mongoQuery = { ...query };
          delete mongoQuery.$skip;
          delete mongoQuery.$limit;
          
          // Execute the query
          const total = await this.Model.countDocuments(mongoQuery);
          const data = await this.Model.find(mongoQuery)
            .skip($skip)
            .limit(Math.min($limit, this.paginate.max))
            .lean();
          
          // Return paginated result
          return {
            total,
            limit: $limit,
            skip: $skip,
            data
          };
        },
        
        async get(id, params) {
          const result = await this.Model.findById(id).lean();
          if (!result) {
            throw new Error('Not found');
          }
          return result;
        },
        
        async create(data, params) {
          const result = await this.Model.create(data);
          return result.toObject();
        },
        
        async update(id, data, params) {
          const result = await this.Model.findByIdAndUpdate(id, data, { new: true }).lean();
          if (!result) {
            throw new Error('Not found');
          }
          return result;
        },
        
        async patch(id, data, params) {
          const result = await this.Model.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
          if (!result) {
            throw new Error('Not found');
          }
          return result;
        },
        
        async remove(id, params) {
          const result = await this.Model.findByIdAndDelete(id).lean();
          if (!result) {
            throw new Error('Not found');
          }
          return result;
        }
      });
      
      return app.service(path);
    };
  };
}

// Usage
import mongoose from 'mongoose';

// Define a model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Configure the plugin
app.configure(mongodbServicePlugin({
  Model: User
}));

// Create a service
app.createMongoDBService('users');
```

## Hook Plugins

### Creating Hook Plugins

```javascript
// authentication-hooks-plugin.js
export default function authenticationHooksPlugin(options = {}) {
  return function(app) {
    // Default options
    const opts = {
      userService: 'users',
      ...options
    };
    
    // Add authentication hooks to the app
    app.hooks = app.hooks || {};
    
    // Authenticate hook
    app.hooks.authenticate = async function(context) {
      const { params } = context;
      
      if (!params.headers || !params.headers.authorization) {
        throw new Error('Authentication required');
      }
      
      const token = params.headers.authorization.replace('Bearer ', '');
      
      try {
        // Verify token
        const decoded = app.verifyToken(token);
        
        // Get user
        const user = await app.service(opts.userService).get(decoded.userId);
        
        // Add user to params
        params.user = user;
        
        return context;
      } catch (error) {
        throw new Error('Invalid authentication');
      }
    };
    
    // Authorize hook
    app.hooks.authorize = function(role) {
      return async function(context) {
        const { params } = context;
        
        if (!params.user) {
          throw new Error('Authentication required');
        }
        
        if (!params.user.roles || !params.user.roles.includes(role)) {
          throw new Error('Unauthorized');
        }
        
        return context;
      };
    };
  };
}

// Usage
app.configure(authenticationHooksPlugin());

// Use the hooks
app.service('messages').hooks({
  before: {
    all: [app.hooks.authenticate],
    create: [app.hooks.authorize('admin')]
  }
});
```

### Hook Collection Plugins

```javascript
// validation-hooks-plugin.js
export default function validationHooksPlugin(options = {}) {
  return function(app) {
    // Add validation hooks to the app
    app.hooks = app.hooks || {};
    
    // Validate data hook
    app.hooks.validateData = function(schema) {
      return async function(context) {
        const { data } = context;
        
        // Validate data against schema
        const valid = app.validateSchema(schema, data);
        
        if (!valid) {
          throw new Error('Validation failed');
        }
        
        return context;
      };
    };
    
    // Validate query hook
    app.hooks.validateQuery = function(schema) {
      return async function(context) {
        const { params } = context;
        
        // Validate query against schema
        const valid = app.validateSchema(schema, params.query || {});
        
        if (!valid) {
          throw new Error('Query validation failed');
        }
        
        return context;
      };
    };
    
    // Sanitize data hook
    app.hooks.sanitizeData = function(fields) {
      return async function(context) {
        const { data } = context;
        
        // Remove specified fields from data
        for (const field of fields) {
          delete data[field];
        }
        
        return context;
      };
    };
  };
}

// Usage
app.configure(validationHooksPlugin());

// Use the hooks
app.service('users').hooks({
  before: {
    create: [
      app.hooks.validateData({
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        }
      }),
      app.hooks.sanitizeData(['admin', 'role'])
    ],
    find: [
      app.hooks.validateQuery({
        type: 'object',
        properties: {
          $limit: { type: 'number', maximum: 100 }
        }
      })
    ]
  }
});
```
