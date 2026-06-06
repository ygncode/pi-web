// Global vitest setup. Registers @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, …) and auto-cleans rendered
// components between tests so the Svelte migration's component tests stay
// isolated. See docs/dev/svelte-migration-plan.md (Phase 1, testing).
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

afterEach(() => {
  cleanup();
});
