# Fudo Integration Developer Checklist

## 🎯 New Developer Onboarding

### Prerequisites (5 min)
- [ ] **Environment Setup**: Node.js 18+, access to Supabase project
- [ ] **Clone Repository**: Latest main branch checked out
- [ ] **Dependencies**: `npm install` completed successfully
- [ ] **Supabase CLI**: Installed and authenticated

### Understanding the Architecture (15 min)
- [ ] **Read README**: `src/integrations/pos/fudo/README.md`
- [ ] **Review Interfaces**: Check `sdk/pos/index.ts` for contracts
- [ ] **Examine Flow**: Understand 401 handling and token rotation
- [ ] **Circuit Breakers**: How failure protection works

### Hands-on Exploration (20 min)
- [ ] **Run Tests**: `npm run test:fudo` (should pass)
- [ ] **Config Check**: `npm run fudo:config:show`
- [ ] **Health Check**: `npm run fudo:health`
- [ ] **Chaos Test**: `npm run fudo:chaos zombie`

### Production Readiness Verification (10 min)
- [ ] **Token Zombie Test**: Verifies <100ms fast-fail
- [ ] **Circuit Breaker**: Validates failure thresholds
- [ ] **Metrics**: Observability points identified
- [ ] **Configuration**: DB → ENV → defaults pattern working

---

## 🔧 Development Workflow

### Before Making Changes
- [ ] **Branch**: Create feature branch from main
- [ ] **Baseline**: Run `npm run test:fudo` to ensure clean start
- [ ] **Config**: Verify current settings with `npm run fudo:config:show`

### During Development
- [ ] **Unit Tests**: Write tests for new functionality
- [ ] **Type Safety**: Ensure TypeScript compilation passes
- [ ] **Error Handling**: Follow existing patterns for 401/retry logic
- [ ] **Metrics**: Add observability for new operations

### Code Review Checklist
- [ ] **No Hardcoded Values**: Use centralized config system
- [ ] **Error Messages**: Don't leak secrets in logs or exceptions
- [ ] **Testing**: Unit tests + integration tests included
- [ ] **Documentation**: Update README if architecture changes

### Before Merging
- [ ] **Full Test Suite**: `npm run test:fudo` passes
- [ ] **Chaos Tests**: `npm run test:chaos:smoke` passes
- [ ] **Config Validation**: `npm run fudo:config:validate` passes
- [ ] **UAT**: `node scripts/uat-test-runner.js` generates artifacts

---

## 🚀 Production Deployment

### Pre-Deployment Validation
- [ ] **Configuration Consistency**: All environments aligned
- [ ] **Token Zombie Test**: CI artifact shows <100ms performance
- [ ] **Circuit Breaker Thresholds**: Match chaos test parameters
- [ ] **Secrets Management**: No credentials in code or logs

### Deployment Checklist
- [ ] **Database Settings**: `pos_settings` table configured
- [ ] **Environment Variables**: Production ENV vars set
- [ ] **Supabase Functions**: Edge functions deployed
- [ ] **Monitoring**: Alerts configured for circuit breaker events

### Post-Deployment Verification
- [ ] **Health Check**: `npm run fudo:health` in production
- [ ] **Metrics Collection**: Verify observability data flowing
- [ ] **Token Rotation**: Schedule and monitoring active
- [ ] **Circuit Breakers**: Verify state transitions logged

---

## 🔍 Troubleshooting Guide

### Common Issues & Solutions

#### "Token Zombie Test Failing"
```bash
# Check if timing is within requirements
npm run test tests/pos/fudo.token-zombie.test.ts

# Verify configuration consistency
npm run fudo:config:validate

# Check for network/environment issues
node scripts/dev-tools.js health
```

#### "Circuit Breaker Always Open"
```bash
# Check failure threshold settings
npm run fudo:config:show

# Verify chaos test alignment
npm run test:chaos:fudo:500

# Reset circuit breaker state (dev only)
echo "UPDATE rotation_cb SET state='closed' WHERE provider='fudo';" | psql $DATABASE_URL
```

#### "Configuration Inconsistencies"
```bash
# Audit all configuration sources
npm run fudo:config:show

# Check database settings
echo "SELECT * FROM pos_settings WHERE key LIKE 'fudo_%';" | psql $DATABASE_URL

# Validate against defaults
npm run fudo:config:validate
```

#### "Metrics Not Appearing"
```bash
# Check metrics collection
npm run fudo:metrics

# Verify observability pipeline
grep -r "fudo_" src/integrations/pos/fudo/

# Test metric generation
npm run test:fudo:integration
```

### Debug Commands
```bash
# Full diagnostic
npm run fudo:health

# Configuration audit
npm run fudo:config:show
npm run fudo:config:validate

# Test specific scenarios
npm run fudo:chaos zombie
npm run fudo:chaos 500
npm run fudo:chaos timeout

# Check recent logs
grep "fudo" /var/log/application.log | tail -50
```

---

## 📊 Quality Gates

### Unit Test Requirements
- [ ] **Coverage**: >90% for new code
- [ ] **Token Zombie**: <100ms response guaranteed
- [ ] **Error Scenarios**: All error paths tested
- [ ] **Configuration**: DB → ENV → defaults tested

### Integration Test Requirements
- [ ] **End-to-End**: Complete sync workflow
- [ ] **Error Recovery**: Circuit breaker integration
- [ ] **Token Rotation**: Full lifecycle tested
- [ ] **Concurrency**: Race condition protection

### Performance Requirements
- [ ] **Token Zombie**: <100ms response time
- [ ] **API Calls**: <30s timeout (configurable)
- [ ] **Retry Logic**: Exponential backoff implemented
- [ ] **Circuit Breaker**: 10 failures threshold

### Security Requirements
- [ ] **No Secret Leakage**: Logs and errors sanitized
- [ ] **Token Rotation**: Atomic database operations
- [ ] **Zombie Prevention**: Old tokens invalidated immediately
- [ ] **Rate Limiting**: API abuse protection

---

## 🎓 Learning Resources

### Internal Documentation
- **Architecture**: `src/integrations/pos/fudo/README.md`
- **API Contracts**: `sdk/pos/index.ts`
- **Test Examples**: `tests/pos/fudo*.test.ts`
- **Edge Functions**: `supabase/functions/pos-*`

### External References
- **Fudo API Docs**: (Provider-specific documentation)
- **Circuit Breaker Pattern**: Martin Fowler's implementation guide
- **Chaos Engineering**: Netflix's principles and practices
- **Observability**: SRE monitoring best practices

### Code Examples
```typescript
// Adding a new operation
async newOperation(params: OperationParams): Promise<Result> {
  const config = await this.getFudoConfig();
  
  return this.callWithRetry(
    async () => {
      // Implementation with error handling
    },
    { operation: 'newOperation', params }
  );
}

// Adding metrics
console.log('fudo_operation_total', {
  operation: 'newOperation',
  status: 'success',
  duration_ms: elapsed
});
```

---

**Success Criteria**: New developers should be productive within 1 hour and shipping production-ready code within 1 day using this checklist.