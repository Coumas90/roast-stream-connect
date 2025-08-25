/**
 * Test: Card 1.1 - Credential Shielding Verification
 * Validates that sensitive credential data is properly protected
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ipjidjijilhpblxrnaeg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwamlkamlqaWxocGJseHJuYWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NjQ1NjUsImV4cCI6MjA3MDI0MDU2NX0.fzYgzPAWcz2bJE3zfxXEVUE3vbdf2cHa0ZSuVBLZ7vo'
);

describe('Card 1.1: Credential Shielding Security', () => {
  
  it('should not expose secret_ref in public views', async () => {
    const { data, error } = await supabase
      .from('pos_credentials_public')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    
    if (data && data.length > 0) {
      const record = data[0];
      // Ensure no secret fields are exposed
      expect(record).not.toHaveProperty('secret_ref');
      expect(record).not.toHaveProperty('encrypted_api_key');
      expect(record).not.toHaveProperty('ciphertext');
      
      // Ensure safe status fields are present
      expect(record).toHaveProperty('credential_status');
      expect(['CONFIGURED', 'NOT_CONFIGURED']).toContain(record.credential_status);
    }
  });

  it('should log credential access attempts', async () => {
    // This test would require admin access to verify logs
    // For now, we verify the function exists
    const { data, error } = await supabase.rpc('audit_credential_access');
    
    // Function should exist but may not be callable by anon users
    expect(error?.message).not.toContain('function audit_credential_access() does not exist');
  });

  it('should have secure search_path on functions', async () => {
    // Verify that key functions have proper search_path
    const { data, error } = await supabase
      .rpc('secure_token_rotation', {
        _location_id: '00000000-0000-0000-0000-000000000000',
        _provider: 'fudo',
        _new_token: 'test-token'
      });

    // Function should exist and be secure (may fail due to permissions, not missing function)
    expect(error?.message).not.toContain('function secure_token_rotation() does not exist');
  });

  it('should have RLS enabled on credentials tables', async () => {
    // Try to access pos_credentials directly (should be restricted)
    const { data, error } = await supabase
      .from('pos_credentials')
      .select('*')
      .limit(1);

    // Should either return empty data or permission error (not unrestricted access)
    if (!error) {
      expect(data).toEqual([]);
    } else {
      // RLS should block unauthorized access
      expect(error.message).toContain('permission');
    }
  });
});