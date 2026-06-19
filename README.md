# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.16.1 create --template minimal --types ts --add eslint mdsvex mcp="ide:other+setup:remote" --install npm joe-store-frontend
```

## Developing

Copy `.env.example` to `.env` and add the Project URL and publishable key from your
Supabase project's Connect dialog. In Supabase Auth:

- Enable the Google and GitHub providers.
- Add `http://localhost:5173/login` to the redirect URL allow list for local development.
- Add the corresponding `/login` URL for each deployed environment.

The browser login stores the Supabase session in local storage and mirrors the current tokens under
`joe-store.auth.access-token` and `joe-store.auth.refresh-token`. Use the token getters or
`withStoredAccessToken()` from `src/lib/auth.ts` when calling the Joe Store API from the browser.

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
