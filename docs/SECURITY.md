# Security Guidelines

## Environment Variables

### Supabase Configuration

This project uses environment variables to securely manage Supabase configuration:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key

### Security Considerations

#### ANON Key Rotation

The Supabase anonymous (anon) key should be rotated periodically for security:

1. **Regular Rotation**: Rotate the anon key every 6-12 months or when:
   - A team member with access leaves
   - You suspect the key may have been compromised
   - As part of regular security maintenance

2. **Emergency Rotation**: Immediately rotate if:
   - The key is accidentally committed to a public repository
   - You detect unauthorized API usage
   - A security incident occurs

3. **Rotation Process**:
   - Generate a new anon key in your Supabase dashboard
   - Update the `VITE_SUPABASE_ANON_KEY` environment variable
   - Deploy the updated configuration
   - Revoke the old key after confirming the new one works

### Environment File Security

- **Never commit `.env` files** to version control
- Use `.env.example` for documentation with placeholder values
- Store production secrets in secure environment variable systems
- Limit access to environment configurations to necessary team members

### Development Best Practices

- Use different Supabase projects for development, staging, and production
- Regularly audit Row Level Security (RLS) policies
- Monitor API usage for unusual patterns
- Keep Supabase SDK and dependencies updated

### Incident Response

If a secret is exposed:

1. Immediately rotate the compromised key
2. Review access logs for unauthorized usage
3. Update all deployment environments
4. Document the incident and lessons learned

## POS Credentials Security

### Token Management

#### Encryption at Rest
- **Algorithm**: AES-256-GCM with authenticated encryption
- **Key Management**: Supabase Vault with automatic key rotation
- **Storage**: All POS tokens encrypted before database storage
- **Access**: Decryption only via service role with minimal permissions

#### Token Rotation Security
- **Rotation IDs**: UUID v4 prevents enumeration attacks
- **Atomic Operations**: Database transactions prevent partial updates
- **Rollback Capability**: Previous tokens stored for emergency rollback
- **Audit Trail**: Complete rotation history with correlation IDs

#### Secrets Management
```sql
-- Secure secret storage in Supabase Vault
INSERT INTO vault.secrets (name, secret) VALUES 
  ('POS_SYNC_JOB_TOKEN', 'securely-generated-token'),
  ('POS_ENCRYPTION_KEY', 'encryption-key-material');
```

### CORS Configuration

#### Edge Function CORS
```typescript
// Secure CORS configuration for edge functions
const corsConfig = {
  origin: [
    'https://ipjidjijilhpblxrnaeg.supabase.co',
    'https://your-production-domain.com'
  ],
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'X-Job-Token'],
  credentials: false,
  maxAge: 86400 // 24 hours
};
```

#### API Endpoint Security
- **Authentication Required**: All rotation endpoints require valid job token
- **Content-Type Validation**: Strict application/json enforcement
- **Rate Limiting**: Built-in protection against abuse
- **Origin Validation**: Whitelist of allowed domains

### Data Scrubbing Guidelines

#### Log Sanitization
```typescript
// CORRECT: Log with sensitive data scrubbed
console.log(`[${rotation_id}] Token validated for user: ${userInfo.name}`);
console.log(`[${rotation_id}] Rotation completed for location: ****${locationId.slice(-4)}`);

// INCORRECT: Never log raw tokens or full identifiers
console.log(`Token: ${rawToken}`); // ❌ NEVER DO THIS
console.log(`Full location: ${locationId}`); // ❌ Avoid full PII
```

#### Database Storage
- **No Plain Text**: Never store unencrypted credentials
- **Token Fingerprints**: Use HMAC-SHA256 truncated for logging
- **Metadata Only**: Store operation metadata, not sensitive data
- **Retention Policies**: Automatic cleanup of old rotation data

#### API Response Scrubbing
```typescript
// Production API response format (no PII)
{
  "success": true,
  "summary": {
    "total": 5,
    "rotated": 3,
    "skipped": 1,
    "errors": 1
  },
  "job_run_id": "uuid-for-correlation"
  // Note: No location_ids, provider details, or error specifics
}
```

### Access Control

#### Role-Based Access
- **Service Role**: Rotation operations, database access
- **Admin Role**: Manual triggers, monitoring dashboards
- **Readonly Role**: Metrics viewing, audit log access
- **API Tokens**: Time-limited, scope-restricted access

#### Row Level Security (RLS)
```sql
-- Credential access policies
CREATE POLICY "Admin credential access" ON pos_credentials
FOR ALL USING (public.is_tupa_admin());

CREATE POLICY "Service role rotation access" ON pos_credentials
FOR UPDATE USING (
  current_user = 'service_role' 
  AND rotation_status IN ('active', 'pending', 'rotating')
);

-- Metrics visibility policies
CREATE POLICY "Admin metrics access" ON pos_rotation_metrics
FOR SELECT USING (public.is_tupa_admin());
```

#### Function Security
```sql
-- Secure stored procedure with locked search path
CREATE OR REPLACE FUNCTION execute_atomic_rotation(...)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Rotation logic with security checks
  IF NOT public.is_tupa_admin() AND current_user != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized rotation attempt';
  END IF;
  -- ... rotation logic
END;
$$;
```

### Compliance and Auditing

#### Audit Requirements
- **Complete History**: All rotation attempts logged with outcomes
- **Correlation IDs**: UUID tracking across all system components
- **Retention**: 90-day minimum for audit logs
- **Immutable Logs**: Write-only audit trail, no deletion allowed

#### Compliance Features
- **SOC 2 Type II**: Encryption at rest and in transit
- **PCI DSS**: If handling payment-related tokens
- **GDPR**: Data minimization and retention policies
- **SOX**: Financial controls and audit trails

#### Security Monitoring
```sql
-- Security event monitoring
CREATE VIEW security_events AS
SELECT 
  ts,
  level,
  message,
  meta->>'rotation_id' as correlation_id,
  meta->>'error_code' as security_event_type
FROM pos_logs 
WHERE scope = 'security' 
   OR (scope = 'rotation' AND level = 'error')
ORDER BY ts DESC;
```

### Incident Response

#### Security Event Classification
1. **Critical**: Token compromise, unauthorized access
2. **High**: Authentication failures, circuit breaker issues
3. **Medium**: Rate limiting, validation failures
4. **Low**: Normal operational events

#### Response Procedures
```sql
-- Emergency: Disable all rotations
UPDATE pos_credentials SET rotation_status = 'disabled';

-- Emergency: Rotate job token
-- 1. Generate new token: openssl rand -hex 32
-- 2. Update vault secret
-- 3. Verify cron job uses new token

-- Audit: Recent security events
SELECT * FROM security_events WHERE ts > now() - interval '24 hours';
```

#### Recovery Procedures
- **Token Compromise**: Immediate rotation of affected credentials
- **API Key Leak**: Regenerate and update all API keys
- **Database Breach**: Full audit and credential rotation
- **System Compromise**: Complete security assessment and remediation

### Network Security

#### TLS/SSL Requirements
- **Minimum Version**: TLS 1.2
- **Cipher Suites**: Strong encryption only (AES-256, ChaCha20)
- **Certificate Validation**: Strict certificate pinning
- **HSTS**: HTTP Strict Transport Security enabled

#### API Security Headers
```typescript
// Security headers for all API responses
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'none'",
  'Referrer-Policy': 'no-referrer'
};
```

#### Firewall Rules
- **Supabase Access**: Only from approved IP ranges
- **Edge Function Access**: Restricted to Supabase infrastructure
- **Database Access**: Service role only, no direct connections
- **Admin Access**: MFA required, IP allowlist enforced

---

**Security Review**: Quarterly security assessments required  
**Penetration Testing**: Annual third-party security audits  
**Vulnerability Management**: Automated scanning and patching  
**Incident Response**: 24/7 security monitoring and response team