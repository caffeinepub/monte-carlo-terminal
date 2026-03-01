# Monte Carlo Terminal

## Current State
App requires Internet Identity login before accessing the Clients page. `App.tsx` uses `useInternetIdentity` and blocks rendering with a `LoginScreen` when `identity` is null. The `ClientsPage` receives `onSignOut` and `principal` props.

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- `App.tsx`: Remove the `!identity` guard. Skip the login screen entirely. Pass `undefined` for `onSignOut` and `principal` to `ClientsPage` so the sign-out button is hidden.

### Remove
- The `LoginScreen` render path in `App.tsx`
- The boot-screen / initializing guard (or keep it trivially passing through)
- Import of `LoginScreen` and `useInternetIdentity` from `App.tsx`

## Implementation Plan
1. Edit `App.tsx` to remove the `useInternetIdentity` hook usage, the `isInitializing` boot screen check, and the `!identity` login screen branch.
2. Call `ClientsPage` without `principal` and `onSignOut` so the identity pill and sign-out button stay hidden.
3. Remove now-unused imports (`LoginScreen`, `useInternetIdentity`).
