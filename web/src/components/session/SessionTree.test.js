import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SessionTree from './SessionTree.svelte';

// Toolchain smoke test for @testing-library/svelte + jest-dom (added in
// Phase 1 of the Svelte migration). SessionTree is still a static shell; this
// just proves component rendering + matchers work so later phases can lean on
// them. Behavioural tests arrive when the component owns real state.
describe('SessionTree (shell)', () => {
  it('renders the sidebar scaffold with search and filter controls', () => {
    render(SessionTree);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // the five tree filter buttons (default/no-tools/user/labeled/all)
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(5);
    expect(document.getElementById('tree-container')).toBeInTheDocument();
  });
});
