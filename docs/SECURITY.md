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