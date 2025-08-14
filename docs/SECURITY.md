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

### Emergency Rotation (Committed Key)

If the anon key was accidentally committed to the repository:

1. **Immediately rotate the anon key** in your Supabase dashboard:
   - Go to Settings > API > Generate new anon key
   - Copy the new key value
2. **Update deployment environments** with the new key:
   - Update `VITE_SUPABASE_ANON_KEY` in all environments
   - Redeploy applications to use the new key
3. **Verify .env is not in Git**:
   - Ensure `.env` files are properly ignored by `.gitignore`
   - Remove any committed `.env` files from version control
4. **Revoke the old key** after confirming the new one works

### Incident Response

If a secret is exposed:

1. Immediately rotate the compromised key
2. Review access logs for unauthorized usage
3. Update all deployment environments
4. Document the incident and lessons learned