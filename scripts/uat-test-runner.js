#!/usr/bin/env node

/**
 * UAT Test Runner for Token Zombie Testing
 * 
 * Purpose: Automated UAT test execution with performance validation
 * Owner: @qa-team, @sre-team
 * Usage: node scripts/uat-test-runner.js [--environment=sandbox]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  environment: process.argv.includes('--environment=production') ? 'production' : 'sandbox',
  maxLatencyMs: 100,
  maxRetries: 0,
  testTimeout: 30000,
  reportFile: `uat-report-${Date.now()}.json`
};

// ANSI colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Test results storage
let testResults = {
  timestamp: new Date().toISOString(),
  environment: CONFIG.environment,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    duration: 0
  },
  tests: []
};

/**
 * Log with timestamp and color
 */
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

/**
 * Execute shell command with error handling
 */
function executeCommand(command, description) {
  log(`Executing: ${description}`, colors.blue);
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: CONFIG.testTimeout 
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout || error.stderr 
    };
  }
}

/**
 * Run Token Zombie specific tests
 */
function runTokenZombieTests() {
  log('🧟 Starting Token Zombie UAT Tests', colors.bold);
  
  const testCommand = 'npm test -- --testNamePattern="Token Zombie UAT" --verbose';
  const result = executeCommand(testCommand, 'Token Zombie Test Suite');
  
  // Parse test results from Jest output
  const testDetails = parseJestOutput(result.output);
  
  testResults.tests.push({
    name: 'Token Zombie UAT',
    passed: result.success,
    duration: testDetails.duration,
    details: testDetails,
    error: result.success ? null : result.error
  });

  if (result.success) {
    log('✅ Token Zombie tests passed', colors.green);
  } else {
    log('❌ Token Zombie tests failed', colors.red);
    log(`Error: ${result.error}`, colors.red);
  }

  return result.success;
}

/**
 * Parse Jest test output for metrics
 */
function parseJestOutput(output) {
  const details = {
    duration: 0,
    latencies: [],
    retryCount: 0,
    passed: false
  };

  if (!output) return details;

  // Extract test duration
  const durationMatch = output.match(/Time:\s*(\d+\.?\d*)\s*s/);
  if (durationMatch) {
    details.duration = parseFloat(durationMatch[1]) * 1000;
  }

  // Check for specific Token Zombie validations in output
  details.passed = output.includes('old token returns 401 <100ms with 0 retries') &&
                   output.includes('✓') && 
                   !output.includes('FAIL');

  // Extract latency information if available in test logs
  const latencyMatches = output.match(/latency.*?(\d+)ms/gi);
  if (latencyMatches) {
    details.latencies = latencyMatches.map(match => {
      const ms = match.match(/(\d+)ms/);
      return ms ? parseInt(ms[1]) : 0;
    });
  }

  return details;
}

/**
 * Validate sandbox environment setup
 */
function validateSandboxSetup() {
  log('🔍 Validating sandbox setup', colors.blue);
  
  const queries = [
    {
      name: 'Sandbox Locations',
      sql: `SELECT COUNT(*) as count FROM locations WHERE tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;`,
      expectedMin: 2
    },
    {
      name: 'Expiring Credentials',
      sql: `SELECT COUNT(*) as count FROM pos_credentials WHERE expires_at < now() + interval '10 minutes' AND tenant_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;`,
      expectedMin: 1
    },
    {
      name: 'Circuit Breaker State',
      sql: `SELECT state FROM rotation_cb WHERE provider = 'fudo' LIMIT 1;`,
      expected: 'closed'
    }
  ];

  let setupValid = true;

  queries.forEach(query => {
    const result = executeCommand(
      `echo "${query.sql}" | psql -d postgres -t`,
      `Checking ${query.name}`
    );

    if (!result.success) {
      log(`❌ Failed to check ${query.name}: ${result.error}`, colors.red);
      setupValid = false;
      return;
    }

    const value = result.output.trim();
    const isValid = query.expectedMin ? 
      parseInt(value) >= query.expectedMin : 
      value === query.expected;

    if (isValid) {
      log(`✅ ${query.name}: ${value}`, colors.green);
    } else {
      log(`❌ ${query.name}: Expected ${query.expected || `>=${query.expectedMin}`}, got ${value}`, colors.red);
      setupValid = false;
    }
  });

  return setupValid;
}

/**
 * Run comprehensive performance validation
 */
function runPerformanceValidation() {
  log('⚡ Running performance validation', colors.blue);
  
  const perfCommand = 'npm test -- --testNamePattern="performance regression test" --verbose';
  const result = executeCommand(perfCommand, 'Performance Regression Tests');
  
  testResults.tests.push({
    name: 'Performance Validation',
    passed: result.success,
    details: parseJestOutput(result.output),
    error: result.success ? null : result.error
  });

  return result.success;
}

/**
 * Generate UAT report
 */
function generateReport() {
  log('📊 Generating UAT report', colors.blue);
  
  // Calculate summary
  testResults.summary.total = testResults.tests.length;
  testResults.summary.passed = testResults.tests.filter(t => t.passed).length;
  testResults.summary.failed = testResults.summary.total - testResults.summary.passed;
  testResults.summary.duration = testResults.tests.reduce((sum, t) => sum + (t.duration || 0), 0);

  // Add environment validation results
  testResults.environment_checks = {
    sandbox_setup: validateSandboxSetup(),
    timestamp: new Date().toISOString()
  };

  // Add go/no-go decision
  testResults.go_no_go = {
    decision: testResults.summary.failed === 0 ? 'GO' : 'NO-GO',
    criteria: {
      all_tests_passed: testResults.summary.failed === 0,
      token_zombie_validated: testResults.tests.find(t => t.name === 'Token Zombie UAT')?.passed || false,
      performance_acceptable: testResults.tests.find(t => t.name === 'Performance Validation')?.passed || false,
      environment_ready: testResults.environment_checks.sandbox_setup
    }
  };

  // Write report to file
  fs.writeFileSync(CONFIG.reportFile, JSON.stringify(testResults, null, 2));
  
  // Generate console summary
  log('\n' + '='.repeat(50), colors.bold);
  log('📋 UAT REPORT SUMMARY', colors.bold);
  log('='.repeat(50), colors.bold);
  log(`Environment: ${CONFIG.environment}`, colors.blue);
  log(`Total Tests: ${testResults.summary.total}`, colors.blue);
  log(`Passed: ${testResults.summary.passed}`, colors.green);
  log(`Failed: ${testResults.summary.failed}`, testResults.summary.failed > 0 ? colors.red : colors.green);
  log(`Duration: ${testResults.summary.duration}ms`, colors.blue);
  log(`Go/No-Go: ${testResults.go_no_go.decision}`, 
    testResults.go_no_go.decision === 'GO' ? colors.green : colors.red);
  log('='.repeat(50), colors.bold);
  
  // Detailed test results
  testResults.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    const color = test.passed ? colors.green : colors.red;
    log(`${status} ${test.name}`, color);
    if (test.error) {
      log(`   Error: ${test.error}`, colors.red);
    }
  });

  log(`\n📄 Detailed report saved to: ${CONFIG.reportFile}`, colors.blue);
  
  return testResults.go_no_go.decision === 'GO';
}

/**
 * Main UAT execution function
 */
async function runUAT() {
  const startTime = Date.now();
  
  log('🚀 Starting Card #16 Token Zombie UAT', colors.bold);
  log(`Environment: ${CONFIG.environment}`, colors.blue);
  log(`Max Latency: ${CONFIG.maxLatencyMs}ms`, colors.blue);
  log(`Max Retries: ${CONFIG.maxRetries}`, colors.blue);

  try {
    // Pre-flight checks
    if (CONFIG.environment === 'sandbox') {
      if (!validateSandboxSetup()) {
        log('❌ Sandbox environment not properly set up', colors.red);
        process.exit(1);
      }
    }

    // Run core tests
    const tokenZombieSuccess = runTokenZombieTests();
    const performanceSuccess = runPerformanceValidation();

    // Generate final report
    const overallSuccess = generateReport();
    
    const totalTime = Date.now() - startTime;
    log(`\n⏱️  Total UAT execution time: ${totalTime}ms`, colors.blue);

    if (overallSuccess) {
      log('🎉 UAT PASSED - Ready for production deployment!', colors.green);
      process.exit(0);
    } else {
      log('🚫 UAT FAILED - Deployment blocked', colors.red);
      process.exit(1);
    }

  } catch (error) {
    log(`💥 UAT execution failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runUAT();
}

module.exports = { runUAT, validateSandboxSetup, CONFIG };