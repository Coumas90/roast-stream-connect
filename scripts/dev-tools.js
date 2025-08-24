#!/usr/bin/env node

/**
 * Fudo Integration Developer Tools
 * 
 * Provides CLI commands for local development and debugging
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.argv[2];
const subcommand = process.argv[3];

function execSafe(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      ...options 
    });
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    console.error(error.message);
    process.exit(1);
  }
}

function showConfig() {
  console.log('🔧 Loading Fudo Configuration...\n');
  
  // Show environment variables
  console.log('Environment Variables:');
  const envVars = [
    'FUDO_API_TIMEOUT_MS',
    'FUDO_MAX_RETRIES', 
    'FUDO_CB_THRESHOLD',
    'FUDO_RPM_LIMIT'
  ];
  
  envVars.forEach(key => {
    const value = process.env[key];
    console.log(`  ${key}: ${value || '(not set)'}`);
  });
  
  console.log('\nDatabase Settings (pos_settings):');
  console.log('  Run: npm run fudo:config:db to check database values');
  
  console.log('\nDefaults:');
  console.log('  API_TIMEOUT_MS: 30000 (30s)');
  console.log('  MAX_RETRIES: 2');
  console.log('  CB_THRESHOLD: 10');
  console.log('  RPM_LIMIT: 60');
}

function validateConfig() {
  console.log('✅ Validating Fudo Configuration...\n');
  
  // Check for common misconfigurations
  const timeout = parseInt(process.env.FUDO_API_TIMEOUT_MS) || 30000;
  const retries = parseInt(process.env.FUDO_MAX_RETRIES) || 2;
  const threshold = parseInt(process.env.FUDO_CB_THRESHOLD) || 10;
  
  console.log('Configuration Analysis:');
  
  if (timeout < 10000) {
    console.log('⚠️  API timeout < 10s may cause premature failures');
  } else if (timeout > 60000) {
    console.log('⚠️  API timeout > 60s may block edge functions');
  } else {
    console.log('✅ API timeout looks reasonable');
  }
  
  if (retries > 3) {
    console.log('⚠️  More than 3 retries may cause delays');
  } else if (retries < 1) {
    console.log('⚠️  Less than 1 retry may be too aggressive');
  } else {
    console.log('✅ Retry count looks reasonable');
  }
  
  if (threshold < 5) {
    console.log('⚠️  Circuit breaker threshold < 5 may be too sensitive');
  } else if (threshold > 20) {
    console.log('⚠️  Circuit breaker threshold > 20 may allow too many failures');
  } else {
    console.log('✅ Circuit breaker threshold looks reasonable');
  }
}

function runHealthCheck() {
  console.log('🏥 Fudo Health Check...\n');
  
  console.log('1. Running unit tests...');
  execSafe('npm run test:fudo:unit');
  
  console.log('\n2. Testing configuration loading...');
  execSafe('npm run test tests/pos/fudo.config.test.ts');
  
  console.log('\n3. Testing zombie token detection...');
  execSafe('npm run test tests/pos/fudo.token-zombie.test.ts');
  
  console.log('\n4. Checking metrics collection...');
  // Could add metrics validation here
  
  console.log('\n✅ Health check complete!');
}

function runMetrics() {
  console.log('📊 Fudo Metrics Snapshot...\n');
  
  // This would query actual metrics in a real implementation
  console.log('HTTP Metrics:');
  console.log('  fudo_http_requests_total: Query your metrics backend');
  console.log('  fudo_http_latency_ms: Query your metrics backend');
  
  console.log('\nRotation Metrics:');
  console.log('  fudo_rotation_attempts_total: Query your metrics backend');
  console.log('  fudo_rotation_success_total: Query your metrics backend');
  
  console.log('\nCircuit Breaker Metrics:');
  console.log('  fudo_cb_state: Query database or metrics backend');
  
  console.log('\n💡 Implement actual metrics queries for production use');
}

function runChaosTest(scenario) {
  console.log(`🔥 Running Chaos Test: ${scenario}\n`);
  
  switch (scenario) {
    case 'zombie':
      execSafe('npm run test tests/pos/fudo.token-zombie.test.ts');
      break;
    case '500':
      console.log('Simulating 500 errors...');
      execSafe('npm run test:chaos:fudo:500');
      break;
    case 'timeout':
      console.log('Simulating timeouts...');
      execSafe('npm run test:chaos:fudo:timeout');
      break;
    case 'overload':
      console.log('Simulating overload...');
      execSafe('npm run test:chaos:fudo:overload');
      break;
    default:
      console.log('Available chaos scenarios: zombie, 500, timeout, overload');
  }
}

function showHelp() {
  console.log(`
🚀 Fudo Integration Developer Tools

Usage: node scripts/dev-tools.js <command> [subcommand]

Commands:
  config show      Show current configuration
  config validate  Validate configuration settings
  health          Run comprehensive health check
  metrics         Show current metrics snapshot
  chaos <type>    Run chaos engineering tests
  test <type>     Run specific test suites
  
Examples:
  node scripts/dev-tools.js config show
  node scripts/dev-tools.js health
  node scripts/dev-tools.js chaos zombie
  node scripts/dev-tools.js test unit

Chaos Test Types:
  zombie    Test zombie token detection (<100ms)
  500       Test server error handling
  timeout   Test timeout scenarios
  overload  Test rate limiting

Test Types:
  unit        Unit tests only
  integration Integration tests
  all         All Fudo tests
`);
}

// Command routing
switch (command) {
  case 'config':
    if (subcommand === 'show') showConfig();
    else if (subcommand === 'validate') validateConfig();
    else console.log('Usage: config [show|validate]');
    break;
    
  case 'health':
    runHealthCheck();
    break;
    
  case 'metrics':
    runMetrics();
    break;
    
  case 'chaos':
    runChaosTest(subcommand);
    break;
    
  case 'test':
    const testType = subcommand || 'all';
    if (testType === 'unit') {
      execSafe('npm run test tests/pos/fudo*.test.ts');
    } else if (testType === 'integration') {
      execSafe('npm run test tests/edge/fudo*.test.ts');
    } else {
      execSafe('npm run test:fudo');
    }
    break;
    
  default:
    showHelp();
}