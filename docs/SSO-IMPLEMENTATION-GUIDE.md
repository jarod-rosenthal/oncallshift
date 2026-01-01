# SSO Implementation Guide for OnCallShift

**Version**: 1.0
**Last Updated**: December 2024
**Status**: Planning

---

## Executive Summary

This guide outlines the implementation strategy for adding enterprise Single Sign-On (SSO) capabilities to OnCallShift. The goal is to enable seamless authentication for enterprise customers using their existing identity providers (IdPs) while maintaining security best practices and preparing for the passwordless future.

### Current State

OnCallShift currently uses AWS Cognito for authentication:
- JWT-based authentication for API access
- Email/password login via Cognito User Pools
- No enterprise SSO support
- No SCIM user provisioning

### Target State

- SAML 2.0 and OIDC support for enterprise IdPs
- Self-service SSO configuration for customers
- SCIM 2.0 for automated user provisioning
- Passkey/FIDO2 support for passwordless authentication
- Zero-trust security model

---

## Industry Trends & Best Practices (2025)

### Market Context

- **Average enterprise manages 371+ SaaS applications**
- **80% of web application attacks involve stolen credentials**
- **Passwordless authentication market**: $24.1B (2025) → $55.7B (2030)
- **48% of top 100 websites now offer passkeys**
- **1.3 million passkey authentications per month** (doubled YoY)

### Regulatory Landscape

| Regulation | Requirement | Timeline |
|------------|-------------|----------|
| NIST SP 800-63-4 | AAL2 requires phishing-resistant option | July 2025 |
| UAE Central Bank | Eliminate SMS/email OTPs | March 2026 |
| India RBI | Move away from OTP authentication | April 2026 |

### Protocol Selection Guide

| Protocol | Best For | Token Lifetime | Use Cases |
|----------|----------|----------------|-----------|
| **SAML 2.0** | Enterprise B2B, legacy systems | Session-based | Okta, Azure AD, corporate apps |
| **OIDC** | Modern apps, mobile, APIs | 15-60 min access tokens | Consumer apps, SPAs, microservices |
| **OAuth 2.0** | API authorization | Varies | Machine-to-machine, integrations |

**Recommendation**: Support both SAML 2.0 and OIDC to maximize enterprise compatibility.

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Enterprise    │     │   OnCallShift    │     │  AWS Cognito    │
│   IdP (Okta,    │◄────┤   SSO Gateway    │◄────┤  User Pool +    │
│   Azure AD)     │     │   (SAML/OIDC)    │     │  Federation     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  OnCallShift DB  │
                        │  (User/Org/Team) │
                        └──────────────────┘
```

### Component Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        OnCallShift Platform                        │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Web App   │  │ Mobile App  │  │   API       │  │  Webhooks │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│         │                │                │                │       │
│         ▼                ▼                ▼                ▼       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Authentication Layer                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │  │
│  │  │  Cognito │  │   SAML   │  │   OIDC   │  │   Passkeys   │ │  │
│  │  │  Native  │  │  Bridge  │  │  Bridge  │  │   (FIDO2)    │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    SCIM Provisioning Layer                   │  │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ │  │
│  │  │  SCIM 2.0 API    │  │  User Lifecycle Management       │ │  │
│  │  │  /scim/v2/*      │  │  (Create/Update/Deprovision)     │ │  │
│  │  └──────────────────┘  └──────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Options

### Option 1: Build with Cognito Federation (Recommended)

Leverage AWS Cognito's built-in SAML/OIDC federation capabilities.

**Pros:**
- Native integration with existing Cognito setup
- AWS manages certificate rotation and metadata
- Lower development effort
- Built-in session management

**Cons:**
- Limited customization of SSO experience
- Per-MAU pricing can get expensive
- Some IdP quirks require workarounds

**Effort**: 2-3 weeks

### Option 2: Integrate SSO Platform (WorkOS/BoxyHQ)

Use a dedicated SSO platform that abstracts IdP complexity.

**WorkOS:**
- $125/connection/month base pricing
- Excellent documentation and SDKs
- Self-serve admin portal included
- SCIM support built-in

**BoxyHQ (Ory Polis):**
- Open-source option available
- Self-hosted or SaaS
- SAML-to-OIDC bridge
- Acquired by Ory (stable backing)

**Pros:**
- Faster time-to-market
- Handles IdP-specific quirks
- Professional admin portal
- Compliance certifications

**Cons:**
- Additional vendor dependency
- Per-connection costs add up
- Less control over flow

**Effort**: 1-2 weeks

### Option 3: Full Custom Implementation

Build SAML/OIDC handling from scratch.

**Pros:**
- Complete control
- No per-connection fees
- Custom UX

**Cons:**
- Significant development effort
- Security responsibility
- Must handle each IdP's quirks
- Certificate management burden

**Effort**: 6-8 weeks

### Recommendation

**Start with Option 1 (Cognito Federation)** for initial launch, with a migration path to **Option 2 (WorkOS)** if enterprise SSO becomes a significant revenue driver.

---

## Phase 1: Cognito SAML Federation

### 1.1 Database Schema Changes

```sql
-- Add SSO configuration to organizations
ALTER TABLE organizations ADD COLUMN sso_config JSONB DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN sso_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN sso_required BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN allowed_email_domains TEXT[];

-- SSO config structure:
-- {
--   "provider": "saml" | "oidc",
--   "entityId": "https://oncallshift.com/sso/{orgId}",
--   "metadataUrl": "https://idp.example.com/metadata.xml",
--   "certificate": "...",
--   "signInUrl": "https://idp.example.com/sso",
--   "signOutUrl": "https://idp.example.com/logout",
--   "attributeMapping": {
--     "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
--     "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
--     "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
--   }
-- }

-- Track SSO identity provider connections
CREATE TABLE sso_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL, -- 'saml' | 'oidc'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'active' | 'disabled'
  config JSONB NOT NULL,
  cognito_provider_name VARCHAR(255), -- Cognito identity provider name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_sso_connections_org ON sso_connections(org_id);
```

### 1.2 Cognito Identity Provider Setup

```typescript
// backend/src/shared/services/sso-service.ts

import { CognitoIdentityProviderClient, CreateIdentityProviderCommand } from '@aws-sdk/client-cognito-identity-provider';

interface SAMLConfig {
  metadataUrl?: string;
  metadataDocument?: string;
  attributeMapping: Record<string, string>;
}

export class SSOService {
  private cognitoClient: CognitoIdentityProviderClient;
  private userPoolId: string;

  constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
    this.userPoolId = process.env.COGNITO_USER_POOL_ID!;
  }

  async createSAMLProvider(orgId: string, config: SAMLConfig): Promise<string> {
    const providerName = `saml-${orgId}`;

    const command = new CreateIdentityProviderCommand({
      UserPoolId: this.userPoolId,
      ProviderName: providerName,
      ProviderType: 'SAML',
      ProviderDetails: {
        MetadataURL: config.metadataUrl,
        MetadataFile: config.metadataDocument,
        IDPSignout: 'true',
      },
      AttributeMapping: {
        email: config.attributeMapping.email || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        given_name: config.attributeMapping.firstName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        family_name: config.attributeMapping.lastName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
      },
    });

    await this.cognitoClient.send(command);
    return providerName;
  }

  async createOIDCProvider(orgId: string, config: OIDCConfig): Promise<string> {
    const providerName = `oidc-${orgId}`;

    const command = new CreateIdentityProviderCommand({
      UserPoolId: this.userPoolId,
      ProviderName: providerName,
      ProviderType: 'OIDC',
      ProviderDetails: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        authorize_scopes: 'openid email profile',
        oidc_issuer: config.issuerUrl,
        attributes_request_method: 'GET',
      },
      AttributeMapping: {
        email: 'email',
        given_name: 'given_name',
        family_name: 'family_name',
      },
    });

    await this.cognitoClient.send(command);
    return providerName;
  }
}
```

### 1.3 SSO Admin API Endpoints

```typescript
// backend/src/api/routes/sso.ts

import { Router } from 'express';
import { authenticateUser, requireAdmin } from '../../shared/auth/middleware';
import { SSOService } from '../../shared/services/sso-service';

const router = Router();
const ssoService = new SSOService();

/**
 * @swagger
 * /api/v1/sso/connections:
 *   get:
 *     summary: List SSO connections for organization
 *     tags: [SSO]
 */
router.get('/connections', authenticateUser, requireAdmin, async (req, res) => {
  // List SSO connections for org
});

/**
 * @swagger
 * /api/v1/sso/connections:
 *   post:
 *     summary: Create new SSO connection
 *     tags: [SSO]
 */
router.post('/connections', authenticateUser, requireAdmin, async (req, res) => {
  const { name, providerType, config } = req.body;

  // Validate config
  // Create Cognito identity provider
  // Save to database
  // Return connection details with SP metadata
});

/**
 * @swagger
 * /api/v1/sso/connections/{id}/test:
 *   post:
 *     summary: Test SSO connection
 *     tags: [SSO]
 */
router.post('/connections/:id/test', authenticateUser, requireAdmin, async (req, res) => {
  // Initiate test SSO flow
});

/**
 * @swagger
 * /api/v1/sso/metadata:
 *   get:
 *     summary: Get SAML SP metadata
 *     tags: [SSO]
 */
router.get('/metadata', async (req, res) => {
  const { orgId } = req.query;
  // Return SAML SP metadata XML
});

export default router;
```

### 1.4 Login Flow Changes

```typescript
// frontend/src/pages/Login.tsx

const Login = () => {
  const [email, setEmail] = useState('');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoUrl, setSsoUrl] = useState('');

  const checkSSO = async (email: string) => {
    const domain = email.split('@')[1];
    const response = await api.get(`/auth/sso/check?domain=${domain}`);

    if (response.data.ssoEnabled) {
      setSsoEnabled(true);
      setSsoUrl(response.data.ssoUrl);
    }
  };

  const handleEmailBlur = () => {
    if (email.includes('@')) {
      checkSSO(email);
    }
  };

  if (ssoEnabled) {
    return (
      <div>
        <p>Your organization uses SSO. Click below to sign in.</p>
        <Button onClick={() => window.location.href = ssoUrl}>
          Sign in with SSO
        </Button>
      </div>
    );
  }

  return (
    // Regular email/password form
  );
};
```

---

## Phase 2: SCIM User Provisioning

### 2.1 SCIM 2.0 Endpoints

Implement the SCIM 2.0 protocol for automated user provisioning:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scim/v2/Users` | GET | List users with filtering |
| `/scim/v2/Users` | POST | Create user |
| `/scim/v2/Users/{id}` | GET | Get user by ID |
| `/scim/v2/Users/{id}` | PUT | Replace user |
| `/scim/v2/Users/{id}` | PATCH | Update user attributes |
| `/scim/v2/Users/{id}` | DELETE | Deprovision user |
| `/scim/v2/Groups` | GET | List groups |
| `/scim/v2/Groups` | POST | Create group |
| `/scim/v2/Groups/{id}` | GET/PUT/PATCH/DELETE | Group operations |
| `/scim/v2/ServiceProviderConfig` | GET | SCIM capabilities |
| `/scim/v2/Schemas` | GET | Schema definitions |

### 2.2 SCIM Schema

```typescript
// SCIM User Schema
interface SCIMUser {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'];
  id: string;
  externalId?: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
    formatted?: string;
  };
  emails: Array<{
    value: string;
    type: 'work' | 'home';
    primary: boolean;
  }>;
  phoneNumbers?: Array<{
    value: string;
    type: 'work' | 'mobile';
  }>;
  active: boolean;
  groups?: Array<{
    value: string;
    display: string;
  }>;
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
  };
}
```

### 2.3 SCIM Implementation

```typescript
// backend/src/api/routes/scim.ts

import { Router } from 'express';
import { authenticateSCIM } from '../../shared/middleware/scim-auth';

const router = Router();

// SCIM bearer token authentication
router.use(authenticateSCIM);

router.get('/Users', async (req, res) => {
  const { filter, startIndex = 1, count = 100 } = req.query;

  // Parse SCIM filter syntax (e.g., 'userName eq "john@example.com"')
  const users = await getUsersWithFilter(req.orgId, filter, startIndex, count);

  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: users.total,
    startIndex: Number(startIndex),
    itemsPerPage: users.items.length,
    Resources: users.items.map(mapUserToSCIM),
  });
});

router.post('/Users', async (req, res) => {
  const scimUser = req.body;

  // Create or update user
  const user = await createOrUpdateUser(req.orgId, scimUser);

  res.status(201)
    .location(`/scim/v2/Users/${user.id}`)
    .json(mapUserToSCIM(user));
});

router.patch('/Users/:id', async (req, res) => {
  const { Operations } = req.body;

  for (const op of Operations) {
    await applyPatchOperation(req.params.id, op);
  }

  const user = await getUser(req.params.id);
  res.json(mapUserToSCIM(user));
});

router.delete('/Users/:id', async (req, res) => {
  // Deprovision user (don't delete, mark as inactive)
  await deprovisionUser(req.params.id);
  res.status(204).send();
});

export default router;
```

### 2.4 SCIM Security

```typescript
// backend/src/shared/middleware/scim-auth.ts

export async function authenticateSCIM(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Bearer token required',
      status: 401,
    });
  }

  const token = authHeader.substring(7);

  // Validate SCIM token against org's configured tokens
  const org = await validateSCIMToken(token);

  if (!org) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid token',
      status: 401,
    });
  }

  req.orgId = org.id;
  next();
}
```

---

## Phase 3: Passwordless Authentication (Passkeys)

### 3.1 WebAuthn/FIDO2 Integration

```typescript
// backend/src/api/routes/passkeys.ts

import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';

const rpName = 'OnCallShift';
const rpID = 'oncallshift.com';

router.post('/passkeys/register/options', authenticateUser, async (req, res) => {
  const user = req.user;

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  // Store challenge in session
  await storeChallenge(user.id, options.challenge);

  res.json(options);
});

router.post('/passkeys/register/verify', authenticateUser, async (req, res) => {
  const { credential } = req.body;
  const user = req.user;
  const expectedChallenge = await getChallenge(user.id);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin: 'https://oncallshift.com',
    expectedRPID: rpID,
  });

  if (verification.verified) {
    // Store credential
    await savePasskey(user.id, verification.registrationInfo);
    res.json({ verified: true });
  } else {
    res.status(400).json({ error: 'Verification failed' });
  }
});
```

### 3.2 Passkey Login Flow

```typescript
// frontend/src/hooks/usePasskey.ts

export function usePasskey() {
  const loginWithPasskey = async () => {
    // Get authentication options from server
    const optionsRes = await api.post('/auth/passkeys/login/options', {
      email: storedEmail,
    });

    // Trigger browser passkey UI
    const credential = await startAuthentication(optionsRes.data);

    // Verify with server
    const verifyRes = await api.post('/auth/passkeys/login/verify', {
      credential,
    });

    if (verifyRes.data.verified) {
      // Set auth token and redirect
      setToken(verifyRes.data.token);
      navigate('/dashboard');
    }
  };

  return { loginWithPasskey };
}
```

---

## Phase 4: Self-Service Admin Portal

### 4.1 SSO Configuration UI

Provide IT admins with a self-service portal to configure SSO:

**Features:**
- Upload IdP metadata or enter metadata URL
- Download SP metadata for IdP configuration
- Test SSO connection
- View SSO login activity
- Enable/disable SSO requirement
- Configure email domain restrictions

### 4.2 Admin Portal Screens

1. **SSO Overview**: Status, active connections, recent logins
2. **Add Connection**: Step-by-step wizard for SAML/OIDC setup
3. **Connection Details**: Edit, test, view logs
4. **SCIM Configuration**: Token management, sync status
5. **Security Settings**: Enforce SSO, allowed domains

---

## Security Best Practices

### Authentication Security

| Practice | Implementation |
|----------|----------------|
| Token lifetime | Access tokens: 15 min, Refresh tokens: 7 days |
| Certificate rotation | Automated via AWS Certificate Manager |
| Signature validation | SAML assertions signed with SHA-256 |
| HTTPS only | Enforce TLS 1.3 for all SSO endpoints |
| Session management | Server-side session with secure cookies |

### SCIM Security

| Practice | Implementation |
|----------|----------------|
| Token rotation | Regenerate tokens every 90 days |
| Rate limiting | 25 requests/second per tenant |
| Audit logging | Log all SCIM operations |
| Encryption | AES-256 for token storage |
| IP allowlisting | Optional per-org configuration |

### Zero Trust Principles

1. **Verify explicitly**: Authenticate and authorize every request
2. **Least privilege**: Minimal permissions by default
3. **Assume breach**: Monitor and audit all access
4. **Device trust**: Optional device posture checks via IdP

---

## IdP-Specific Configuration Guides

### Okta

```yaml
# Okta SAML Configuration
ACS URL: https://oncallshift.com/sso/saml/acs
Entity ID: https://oncallshift.com/sso/{orgId}
Name ID Format: EmailAddress
Attribute Statements:
  - email: user.email
  - firstName: user.firstName
  - lastName: user.lastName
```

### Azure AD (Entra ID)

```yaml
# Azure AD Configuration
Reply URL: https://oncallshift.com/sso/saml/acs
Identifier: https://oncallshift.com/sso/{orgId}
User Claims:
  - emailaddress: user.mail
  - givenname: user.givenname
  - surname: user.surname
```

### Google Workspace

```yaml
# Google Workspace Configuration
ACS URL: https://oncallshift.com/sso/saml/acs
Entity ID: https://oncallshift.com/sso/{orgId}
Start URL: https://oncallshift.com/login
Name ID: Basic Information > Primary Email
```

---

## Implementation Timeline

| Phase | Features | Effort | Priority |
|-------|----------|--------|----------|
| **Phase 1** | SAML via Cognito Federation | 2-3 weeks | P0 |
| **Phase 2** | OIDC support | 1 week | P1 |
| **Phase 3** | SCIM provisioning | 2-3 weeks | P1 |
| **Phase 4** | Self-service admin portal | 2 weeks | P1 |
| **Phase 5** | Passkey/FIDO2 support | 2 weeks | P2 |
| **Phase 6** | Advanced security (device trust) | 2 weeks | P3 |

**Total**: 10-13 weeks for full implementation

---

## Pricing Considerations

### SSO as Enterprise Feature

Common B2B SaaS pricing patterns:

| Tier | SSO Included | Price Point |
|------|--------------|-------------|
| Free/Starter | No | $0 |
| Team/Pro | No (or 1 connection) | $10-50/user/mo |
| Business | SAML/OIDC included | $50-100/user/mo |
| Enterprise | SSO + SCIM + advanced | Custom |

### Cost Drivers

- **Cognito**: $0.0055/MAU after free tier
- **WorkOS**: $125/connection/month
- **BoxyHQ Cloud**: Contact for pricing
- **Self-hosted**: Infrastructure + engineering time

---

## Testing Checklist

### SAML Testing

- [ ] SP-initiated login flow
- [ ] IdP-initiated login flow
- [ ] Attribute mapping verification
- [ ] Session timeout handling
- [ ] Single logout (SLO)
- [ ] Error handling (invalid response, expired assertion)
- [ ] Certificate rotation

### SCIM Testing

- [ ] User creation
- [ ] User update (PATCH operations)
- [ ] User deprovisioning
- [ ] Group sync
- [ ] Filter query support
- [ ] Pagination
- [ ] Error responses
- [ ] Rate limiting

### Security Testing

- [ ] Token validation
- [ ] Replay attack prevention
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] SQL injection prevention
- [ ] Audit log completeness

---

## References

### Standards & Specifications

- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [SCIM 2.0 Protocol (RFC 7644)](https://tools.ietf.org/html/rfc7644)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [NIST SP 800-63-4](https://pages.nist.gov/800-63-4/)

### Industry Resources

- [What SSO Means in 2025 - Frontegg](https://frontegg.com/guides/single-sign-on-sso)
- [SSO Best Practices 2025 - Clerk](https://clerk.com/articles/sso-best-practices-for-secure-scalable-logins)
- [FIDO Alliance 2025 Report - Descope](https://www.descope.com/blog/post/2025-fido-report)
- [Passwordless Authentication Trends - JumpCloud](https://jumpcloud.com/blog/passwordless-authentication-adoption-trends)
- [B2B SaaS Identity Providers - Scalekit](https://www.scalekit.com/blog/b2b-saas-identity-providers)
- [WorkOS SSO Providers 2025](https://workos.com/blog/the-best-5-sso-providers-to-power-your-saas-app-in-2025)
- [SCIM Provisioning Guide - Authgear](https://www.authgear.com/post/what-is-scim-provisioning)

### Vendor Documentation

- [AWS Cognito SAML Federation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html)
- [Okta SAML Configuration](https://developer.okta.com/docs/guides/build-sso-integration/saml2/main/)
- [Azure AD Enterprise Apps](https://learn.microsoft.com/en-us/azure/active-directory/saas-apps/)
- [Google Workspace SAML](https://support.google.com/a/answer/6087519)

---

## Appendix: Competitor Analysis

### How Competitors Handle SSO

| Product | SSO Tier | SCIM | Passkeys |
|---------|----------|------|----------|
| PagerDuty | Business+ | Yes | No |
| Opsgenie | Premium | Yes | No |
| Datadog | Enterprise | Yes | No |
| Splunk On-Call | All plans | Yes | No |
| FireHydrant | Enterprise | Yes | No |

**Opportunity**: Passkey support is not yet common in incident management tools - early adoption could be a differentiator.
