# Edge Functions CORS Testing Guide

## Overview
All Edge Functions now use a centralized CORS handler with origin allowlist for enhanced security.

## CORS Configuration

### Environment Variable
Set `ALLOWED_ORIGINS` in Supabase Edge Functions secrets:
```
ALLOWED_ORIGINS=https://example.com,https://app.example.com,https://*.staging.example.com
```

### Fallback Origins (Development)
If `ALLOWED_ORIGINS` is not set, these origins are allowed:
- `http://localhost:5173`
- `http://localhost:3000`
- `https://localhost:5173`
- `https://localhost:3000`
- `https://*.lovableproject.com`
- `https://*.supabase.co`

## Manual Testing

### 1. Test Allowed Origin
```bash
# Test with allowed origin
curl -X POST "https://your-project.supabase.co/functions/v1/pos-bistrosoft/validate" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "bs_test123"}'

# Expected: 200 OK with CORS headers:
# Access-Control-Allow-Origin: https://example.com
# Vary: Origin
```

### 2. Test Blocked Origin
```bash
# Test with blocked origin
curl -X POST "https://your-project.supabase.co/functions/v1/pos-bistrosoft/validate" \
  -H "Origin: https://malicious.com" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "bs_test123"}'

# Expected: 403 Forbidden (or CORS headers missing)
```

### 3. Test OPTIONS Preflight
```bash
# Test preflight with allowed origin
curl -X OPTIONS "https://your-project.supabase.co/functions/v1/pos-bistrosoft/validate" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"

# Expected: 204 No Content with CORS headers
```

### 4. Test Preflight with Blocked Origin
```bash
# Test preflight with blocked origin
curl -X OPTIONS "https://your-project.supabase.co/functions/v1/pos-bistrosoft/validate" \
  -H "Origin: https://malicious.com" \
  -H "Access-Control-Request-Method: POST"

# Expected: 403 Forbidden
```

## Orchestration Endpoint Security

### Enhanced Auth Requirements
Functions like `pos-sync` and `pos-sync-ui` require additional authentication:

1. **X-Job-Token** header with valid `POS_SYNC_JOB_TOKEN`
2. **X-API-Key** header with valid API key
3. **Authorization** header with valid JWT Bearer token

### Test Orchestration Security
```bash
# Test without proper auth
curl -X POST "https://your-project.supabase.co/functions/v1/pos-sync" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "uuid", "locationId": "uuid", "provider": "fudo"}'

# Expected: 403 Forbidden

# Test with proper auth
curl -X POST "https://your-project.supabase.co/functions/v1/pos-sync" \
  -H "Origin: https://example.com" \
  -H "Content-Type: application/json" \
  -H "X-Job-Token: your-job-token" \
  -d '{"clientId": "uuid", "locationId": "uuid", "provider": "fudo"}'

# Expected: Function processes request (may return validation errors)
```

## Browser Testing

### JavaScript Test (Allowed Origin)
```javascript
// Run from https://example.com (if in allowlist)
fetch('https://your-project.supabase.co/functions/v1/pos-bistrosoft/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: 'bs_test123' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);

// Should succeed with proper response
```

### JavaScript Test (Blocked Origin)
```javascript
// Run from https://malicious.com (not in allowlist)
fetch('https://your-project.supabase.co/functions/v1/pos-bistrosoft/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: 'bs_test123' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);

// Should fail with CORS error in browser console
```

## Expected Behaviors

### ✅ Success Cases
- Allowed origins receive proper CORS headers
- `Vary: Origin` header is always present
- Preflight requests are handled correctly
- Orchestration endpoints accept valid tokens

### ❌ Blocked Cases
- Blocked origins receive 403 status
- Invalid preflight requests are rejected
- Orchestration endpoints reject missing/invalid auth
- Malformed requests are handled gracefully

## Debugging

### Check Function Logs
1. Go to Supabase Dashboard → Edge Functions
2. Select the function
3. Check logs for CORS warnings:
   ```
   CORS: Origin blocked: https://malicious.com
   ```

### Verify Environment Variables
```bash
# Check if ALLOWED_ORIGINS is set
echo $ALLOWED_ORIGINS

# Should show comma-separated list of allowed origins
```

## Security Notes

1. **Wildcard Subdomains**: Use `*.example.com` to allow all subdomains
2. **No Wildcards in Credentials**: When `allowCredentials: true`, origin must be specific
3. **HTTPS Only**: Production should only allow HTTPS origins
4. **Token Security**: Never log or expose `POS_SYNC_JOB_TOKEN` values
5. **Internal Calls**: Function-to-function calls bypass CORS (use service role)

## Common Issues

### Issue: CORS still allowing all origins
**Solution**: Verify `ALLOWED_ORIGINS` environment variable is set correctly

### Issue: Localhost not working
**Solution**: Ensure localhost origins are in the allowlist or `ALLOWED_ORIGINS` is unset for development

### Issue: Subdomain not working
**Solution**: Use wildcard pattern `*.yourdomain.com` in `ALLOWED_ORIGINS`

### Issue: Orchestration endpoints always return 403
**Solution**: Verify `POS_SYNC_JOB_TOKEN` is set and being passed in headers correctly