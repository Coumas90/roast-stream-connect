# Production Release Checklist

**Owner**: @sre-team (Slack)  
**Emergency Contact**: @devops-oncall (PagerDuty)  
**Target Deployment Time**: 15 minutes  

## 🎯 Pre-Deployment Checklist

### **Security & Credentials (MANDATORY)**
- [ ] **Token Zombie Test**: Passed ✅ (old tokens return 401 <100ms, 0 retries)
- [ ] **Credential Rotation**: All POS credentials valid for >7 days
- [ ] **Secret Scanning**: No secrets in code, environment variables secure
- [ ] **CORS Configuration**: Production origins only, no wildcards
- [ ] **API Rate Limits**: Configured and tested

### **Infrastructure Readiness**
- [ ] **Database Migrations**: Applied and verified in staging
- [ ] **Edge Functions**: Deployed and health-checked
- [ ] **Circuit Breakers**: Tested and configured (failure thresholds: 10/15min)
- [ ] **Monitoring**: All alerts active, runbooks updated
- [ ] **Backup Systems**: RTO <30min, RPO <5min verified

### **POS Integration Health**
- [ ] **Fudo Integration**: Connectivity verified, rotation working
- [ ] **MaxiRest Integration**: Connectivity verified
- [ ] **BistrSoft Integration**: Connectivity verified
- [ ] **Sync Status**: No locations in failed state >4 hours
- [ ] **MTTR Metrics**: Average <120 minutes (amber threshold)

## 🚦 Go/No-Go Decision Matrix

### **🟢 GO Criteria**
- All security checks ✅
- Infrastructure health >95%
- POS integrations operational
- Emergency procedures tested
- On-call team available

### **🔴 NO-GO Criteria**
- Token Zombie test fails
- Circuit breakers open
- MTTR >240 minutes (red threshold)
- Critical vulnerabilities unpatched
- Insufficient on-call coverage

### **🟡 DELAYED Criteria** 
- Minor performance degradation
- Non-critical integration issues
- Staging environment issues

## 🚀 Deployment Process

### **Phase 1: Pre-Deployment (5 min)**
```bash
# 1. Verify environment health
curl -f https://ipjidjijilhpblxrnaeg.supabase.co/rest/v1/ || exit 1

# 2. Check circuit breaker status
echo "SELECT state FROM rotation_cb WHERE state != 'closed';" | psql

# 3. Verify token rotation capability
curl -X POST https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-credentials-rotation \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### **Phase 2: Deployment (5 min)**
```bash
# 1. Deploy code (automatic via CI/CD)
# 2. Verify edge functions deployment
# 3. Run smoke tests
# 4. Verify monitoring systems
```

### **Phase 3: Post-Deployment (5 min)**
```bash
# 1. Verify all POS integrations
curl -f https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-fudo/validate

# 2. Check rotation metrics
echo "SELECT * FROM pos_rotation_metrics WHERE recorded_at > now() - interval '10 minutes';" | psql

# 3. Verify monitoring alerts are functional
```

## 🔄 Rollback Procedures

### **Emergency Rollback (< 5 minutes)**
```bash
# 1. Immediate traffic switch to previous version
git checkout PREVIOUS_STABLE_TAG
# Deploy previous version automatically

# 2. Disable failing integrations
UPDATE pos_integrations_location SET connected = false 
WHERE provider = 'FAILING_PROVIDER';

# 3. Notify incident response team
# @channel POS production issue - rolling back to {VERSION}
```

### **Graceful Rollback (10-15 minutes)**
```bash
# 1. Gracefully drain connections
# 2. Deploy previous stable version
# 3. Verify rollback success
# 4. Update monitoring dashboards
```

## 📊 Success Metrics & Monitoring

### **Real-Time KPIs (first 30 minutes)**
- **Token Rotation Success Rate**: >98%
- **API Response Time**: <500ms p95
- **Error Rate**: <0.1%
- **POS Sync Success**: >95%

### **24-Hour KPIs**
- **MTTR**: <120 minutes
- **Circuit Breaker Triggers**: <5 per day
- **Security Incidents**: 0
- **Customer Impact**: <1% locations affected

### **Monitoring Commands**
```sql
-- Check deployment health
SELECT 
  provider,
  COUNT(*) as total_locations,
  COUNT(*) FILTER (WHERE connected = true) as connected,
  COUNT(*) FILTER (WHERE connected = false) as disconnected
FROM pos_integrations_location 
GROUP BY provider;

-- Check recent rotation activity
SELECT * FROM pos_rotation_metrics 
WHERE recorded_at > now() - interval '1 hour'
ORDER BY recorded_at DESC LIMIT 20;

-- Verify no open circuit breakers
SELECT * FROM rotation_cb WHERE state != 'closed';
```

## 🚨 Emergency Contacts & Escalation

### **Primary Response Team**
- **SRE Lead**: @sre-lead (Slack) - +1-555-0100
- **DevOps Engineer**: @devops-oncall (PagerDuty) - +1-555-0101  
- **Security Lead**: @security-team (Slack) - +1-555-0102

### **Escalation Path**
1. **L1**: On-call engineer (0-15 min)
2. **L2**: SRE team lead (15-30 min)  
3. **L3**: Engineering manager (30-60 min)
4. **L4**: CTO/VP Engineering (>60 min)

### **Communication Channels**
- **Slack**: #incidents (public status)
- **PagerDuty**: Auto-escalation after 15 min
- **Status Page**: https://status.company.com
- **Customer Comms**: @customer-success team

## 📝 Post-Deployment Report Template

```markdown
# Deployment Report - {DATE}

## Summary
- **Deployment Time**: {START} - {END}
- **Version**: {GIT_SHA}
- **Go/No-Go Decision**: GO ✅
- **Rollback Required**: No ✅

## Metrics
- **Token Zombie Test**: ✅ 401 in 67ms, 0 retries
- **POS Integration Health**: 99.2% ✅
- **MTTR**: 89 minutes ✅
- **Circuit Breakers**: 0 open ✅

## Issues Encountered
- None

## Post-Deployment Actions
- [ ] Monitor for 24 hours
- [ ] Review performance metrics
- [ ] Update documentation if needed
```

## 🔐 Security Validation

### **Token Zombie Validation**
```bash
# Automated test should pass before deployment
npm test -- --testNamePattern="Token Zombie UAT"

# Expected result:
# ✅ old token returns 401 <100ms with 0 retries
# ✅ no rotation attempted with zombie token
# ✅ circuit breaker remains stable
```

### **Production Security Gates**
- **OWASP Top 10**: Verified
- **Dependency Scanning**: No critical vulnerabilities
- **Secret Detection**: No hardcoded secrets
- **CORS Policy**: Restrictive origins only
- **Rate Limiting**: Enabled on all public endpoints

---

**Last Updated**: 2024-01-22  
**Next Review**: 2024-02-22  
**Reviewed By**: @sre-team, @security-team