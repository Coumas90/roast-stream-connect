# Pull Request Checklist

Please ensure the following before requesting review:

- [ ] Typecheck passes locally (`tsc --noEmit`)
- [ ] Tests pass locally (`vitest --run`) and CI
- [ ] Minimum coverage considered (if applicable)
- [ ] Linting passes (`npm run lint` if available)
- [ ] Changelog/Docs updated (if applicable)
- [ ] No secrets committed; env handled via CI/host
