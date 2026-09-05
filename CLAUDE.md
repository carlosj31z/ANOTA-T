# CLAUDE.md

## Workflow

Commit and push to the current branch automatically after finishing each
update or change — do not wait for explicit approval per change. Use
`git push -u origin <branch-name>`. This does not authorize force-pushing,
rewriting history, or pushing to a different branch than the one already
checked out.

## Project

Mobile-first logistics shipping form (React + Vite + Tailwind CSS v4).
See `README.md` for architecture, the merchant registry, and the courier
agency-search design.

```bash
npm install
npm run dev       # dev server
npm run lint      # oxlint
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```
