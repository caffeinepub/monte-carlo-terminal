// Augments backendInterface with the authorization component's init method.
// This method is injected by the authorization Caffeine component at runtime.
import type { backendInterface as _backendInterface } from "./backend";

declare module "./backend" {
  interface backendInterface {
    _initializeAccessControlWithSecret(token: string): Promise<void>;
  }
  // Also augment the Backend class so it satisfies the interface
  interface Backend {
    _initializeAccessControlWithSecret(token: string): Promise<void>;
  }
}
