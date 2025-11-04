# Credentials System

## Overview

The credentials system provides secure storage and access to API keys, tokens, and authentication data for nodes.

## Architecture

### Credential Types

Credential **types** define the schema for a credential (what fields it has):

```typescript
interface ICredentialType {
  name: string;                    // e.g., "slackApi"
  displayName: string;             // e.g., "Slack API"
  properties: Array<{
    displayName: string;
    name: string;
    type: 'string' | 'password';   // password = hidden input
    required?: boolean;
    default?: string;
  }>;
  authenticate?: {
    type: 'generic';
    properties: {
      headers?: Record<string, string>;
      qs?: Record<string, string>;
    };
  };
}
```

**Example - Slack API:**
```typescript
{
  name: 'slackApi',
  displayName: 'Slack API',
  properties: [
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'password',
      required: true
    }
  ]
}
```

**Example - HTTP Basic Auth:**
```typescript
{
  name: 'httpBasicAuth',
  displayName: 'HTTP Basic Auth',
  properties: [
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      required: true
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'password',
      required: true
    }
  ]
}
```

### Credential Instances

A credential **instance** is a saved set of values for a credential type:

```typescript
interface ICredentialsEncrypted {
  id: string;                      // Unique ID (UUID)
  name: string;                    // User's name: "My Slack Workspace"
  type: string;                    // References credential type: "slackApi"
  data: string;                    // Encrypted JSON string
  createdAt: Date;
  updatedAt: Date;
}
```

**Storage (database):**
```sql
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,              -- Encrypted with AES-256-GCM
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Decrypted Data

When accessed during execution, credentials are decrypted:

```typescript
interface ICredentialDataDecryptedObject {
  [key: string]: string | number | boolean;
}

// Example decrypted Slack credential:
{
  accessToken: "xoxb-1234567890-abcdefghijk"
}

// Example decrypted HTTP Basic Auth:
{
  username: "admin",
  password: "secret123"
}
```

## Node Integration

### 1. Node Declaration

Nodes declare which credential types they support:

```typescript
export class SlackNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Slack',
    name: 'slack',
    credentials: [
      {
        name: 'slackApi',           // References credential type
        required: true              // Must be configured
      }
    ],
    properties: [...]
  };
}
```

### 2. Node Storage

When a user selects a credential, the node stores a reference:

```typescript
interface WorkflowNode {
  id: string;
  type: string;
  credentials?: {
    [credentialType: string]: {
      id: string;                  // Which credential instance
      name: string;                // Display name (for UI)
    };
  };
  data: {...};
}

// Example:
{
  id: "node_123",
  type: "slack",
  credentials: {
    slackApi: {
      id: "cred_abc",
      name: "My Slack Workspace"
    }
  }
}
```

### 3. Runtime Access

During execution, nodes access credentials through the context:

```typescript
export interface IExecuteFunctions {
  getCredentials(type: string): Promise<ICredentialDataDecryptedObject>;
}

// In node execute method:
async execute(context: IExecuteFunctions) {
  const credentials = await context.getCredentials('slackApi');
  const token = credentials.accessToken;

  // Use token for API calls
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}
```

## Encryption

### Algorithm

- **Algorithm:** AES-256-GCM
- **Key derivation:** PBKDF2 with SHA-256
- **Master key:** From environment variable `CREDENTIALS_ENCRYPTION_KEY`

### Encryption Process

```typescript
function encrypt(data: object, encryptionKey: string): string {
  const plaintext = JSON.stringify(data);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    deriveKey(encryptionKey),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted (base64)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}
```

### Decryption Process

```typescript
function decrypt(encryptedData: string, encryptionKey: string): object {
  const [ivB64, authTagB64, encryptedB64] = encryptedData.split(':');

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(encryptionKey),
    Buffer.from(ivB64, 'base64')
  );

  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}
```

## UI Flow

### Credentials Management Page

**Route:** `/credentials`

**Features:**
1. List all saved credentials
2. Create new credential
3. Edit existing credential
4. Delete credential
5. Test credential (if supported)

**List View:**
```
┌─────────────────────────────────────────┐
│  Credentials                      + New │
├─────────────────────────────────────────┤
│                                         │
│  🔑 My Slack Workspace                 │
│     Slack API                      Edit │
│     Last updated: 2 hours ago           │
│                                         │
│  🔑 GitHub Personal Token              │
│     GitHub API                     Edit │
│     Last updated: 1 day ago             │
│                                         │
└─────────────────────────────────────────┘
```

### Node Editor Integration

When editing a node that requires credentials:

```
┌─────────────────────────────────────────┐
│  Parameters                             │
├─────────────────────────────────────────┤
│                                         │
│  Credential                             │
│  ┌────────────────────────────────┐    │
│  │ My Slack Workspace         ▼  │    │
│  └────────────────────────────────┘    │
│                                         │
│  ⊕ Create New Credential                │
│                                         │
│  Channel                                │
│  ┌────────────────────────────────┐    │
│  │ #general                       │    │
│  └────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Dropdown shows:**
- List of credentials matching the required type
- Option to create new credential

**Create New Flow:**
1. Click "+ Create New Credential"
2. Modal opens with credential type form
3. Fill in fields (password fields are masked)
4. Click "Save" → encrypts and stores
5. New credential appears in dropdown and is selected

## API Endpoints

### Get All Credentials (metadata only)
```
GET /api/credentials
Response: Array<{
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}>
```

### Get Credential (for editing)
```
GET /api/credentials/:id
Response: {
  id: string;
  name: string;
  type: string;
  data: { [key: string]: string }  // Decrypted
}
```

### Create Credential
```
POST /api/credentials
Body: {
  name: string;
  type: string;
  data: { [key: string]: string }
}
Response: {
  id: string;
  name: string;
  type: string;
}
```

### Update Credential
```
PUT /api/credentials/:id
Body: {
  name: string;
  data: { [key: string]: string }
}
Response: {
  id: string;
  name: string;
  type: string;
}
```

### Delete Credential
```
DELETE /api/credentials/:id
Response: { success: boolean }
```

### Get Credential Types
```
GET /api/credential-types
Response: Array<ICredentialType>
```

## Security Considerations

### Best Practices

1. **Encryption Key Management**
   - Store `CREDENTIALS_ENCRYPTION_KEY` in environment variables
   - Never commit encryption keys to version control
   - Rotate keys periodically (requires re-encryption)

2. **Access Control**
   - Credentials should be workspace/user-scoped
   - Implement permissions system
   - Audit credential access

3. **Network Security**
   - Always use HTTPS in production
   - Never log decrypted credential values
   - Sanitize error messages

4. **Development**
   - Use `.env.local` for dev encryption key
   - Different keys for dev/staging/production
   - Test credential rotation process

### Environment Setup

Required environment variables:

```bash
# .env
CREDENTIALS_ENCRYPTION_KEY=your-32-byte-base64-encoded-key

# Generate a new key:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Implementation Checklist

### Phase 1: Core System
- [ ] Create credential type definitions
- [ ] Implement encryption/decryption utilities
- [ ] Create database schema and migrations
- [ ] Build credential storage service
- [ ] Add credential context to node execution

### Phase 2: Basic Credential Types
- [ ] HTTP Basic Auth
- [ ] API Key (header)
- [ ] Bearer Token
- [ ] Custom Headers

### Phase 3: UI
- [ ] Credentials management page
- [ ] Credential type selector
- [ ] Credential editor form
- [ ] Node credential dropdown
- [ ] Create credential modal

### Phase 4: Advanced
- [ ] OAuth2 flow support
- [ ] Credential testing
- [ ] Usage tracking
- [ ] Sharing/permissions
- [ ] Credential templates

## Example Usage

### Complete Flow

**1. Define Credential Type:**
```typescript
// src/server/credentials/SlackApi.ts
export class SlackApi implements ICredentialType {
  name = 'slackApi';
  displayName = 'Slack API';
  properties = [
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'password',
      required: true
    }
  ];
}
```

**2. Node Declares Requirement:**
```typescript
// src/server/nodes/slack/Slack.ts
export class Slack implements INodeType {
  description = {
    displayName: 'Slack',
    name: 'slack',
    credentials: [
      {
        name: 'slackApi',
        required: true
      }
    ]
  };
}
```

**3. User Creates Credential:**
- Navigate to Credentials page
- Click "+ New Credential"
- Select "Slack API" type
- Enter token: `xoxb-1234...`
- Name it: "My Slack Workspace"
- Save → encrypts and stores in DB

**4. User Configures Node:**
- Add Slack node to canvas
- Open node editor
- Credential dropdown shows "My Slack Workspace"
- Select it → stores reference in node data

**5. Node Executes:**
```typescript
async execute(context: IExecuteFunctions) {
  const creds = await context.getCredentials('slackApi');
  const token = creds.accessToken;

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: context.getNodeParameter('channel'),
      text: context.getNodeParameter('text')
    })
  });
}
```

## See Also

- [NODE_SYSTEM.md](./NODE_SYSTEM.md) - Node architecture
- [NODE_DATA.md](./NODE_DATA.md) - Data flow and expressions
