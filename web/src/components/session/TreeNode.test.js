import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TreeNode from './TreeNode.svelte';

describe('TreeNode', () => {
  it('emits legacy-compatible markup (class, data-id, prefix/marker/content)', () => {
    const { container } = render(TreeNode, {
      props: { id: 'n1', prefix: '├─ ', displayHtml: '<em>hi</em>', onPath: true, active: true },
    });
    const node = container.querySelector('.tree-node');
    expect(node).toHaveClass('tree-node', 'in-path', 'active');
    expect(node.dataset.id).toBe('n1');
    expect(container.querySelector('.tree-prefix').textContent).toBe('├─ ');
    expect(container.querySelector('.tree-marker').textContent).toBe('•');
    expect(container.querySelector('.tree-content').innerHTML).toBe('<em>hi</em>');
  });

  it('shows a blank marker when off the active path', () => {
    const { container } = render(TreeNode, { props: { id: 'n2', onPath: false } });
    const node = container.querySelector('.tree-node');
    expect(node).not.toHaveClass('in-path');
    expect(container.querySelector('.tree-marker').textContent).toBe(' ');
  });

  it('fires onnavigate with the node id on click', async () => {
    const onnavigate = vi.fn();
    render(TreeNode, { props: { id: 'n3', displayHtml: 'click me', onnavigate } });
    await userEvent.click(screen.getByRole('treeitem'));
    expect(onnavigate).toHaveBeenCalledWith('n3');
  });

  it('does not navigate when a text selection is active', async () => {
    const onnavigate = vi.fn();
    const { container } = render(TreeNode, { props: { id: 'n4', displayHtml: 'x', onnavigate } });
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'some selection' });
    await userEvent.click(container.querySelector('.tree-node'));
    expect(onnavigate).not.toHaveBeenCalled();
    window.getSelection.mockRestore();
  });
});
