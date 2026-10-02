# CRESORA Studio

After every code change, finish this without waiting for another request:

1. Make the requested change. Do not reset the database, delete orders, or change existing accounts.
2. Run `npm run typecheck` and the video regression tests.
3. Run `npm run build`. Do not point the local build at the production database.
4. If those pass, commit and push to `chaeun-son/advertising-company` branch `main`. Do not commit `.data/`, secrets, or zip archives. Do not force-push.
5. Confirm the Vercel project `adsmile-studio` starts a production deployment and reaches READY.
6. Tell the user only the commit hash, the deployment status, and the URL to refresh.

Live site: https://adsmile-studio.vercel.app
