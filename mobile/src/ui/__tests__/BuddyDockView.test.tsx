import React from 'react';
import { act, create } from 'react-test-renderer';

import { BuddyDockView } from '@/ui';
import { palette } from '@/theme/tokens';

function render(props: Partial<React.ComponentProps<typeof BuddyDockView>>) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<BuddyDockView state="speaking" word="Говорю" reduceMotion {...props} />);
  });
  return tree;
}

describe('BuddyDockView', () => {
  it('shows the given word and the card background by default', () => {
    const tree = render({});
    const texts = tree.root.findAll((n) => typeof n.type === 'string' && (n.type as unknown as string) === 'Text').map((n) => n.children.join(''));
    expect(texts).toContain('Говорю');
    const root = tree.root.findByProps({ testID: 'buddy-dock' });
    const style = Array.isArray(root.props.style) ? Object.assign({}, ...root.props.style) : root.props.style;
    expect(style.backgroundColor).toBe(palette.light.card);
  });
  it('paints a reaction background when asked', () => {
    const tree = render({ state: 'right', word: 'Верно', bg: 'mint' });
    const root = tree.root.findByProps({ testID: 'buddy-dock' });
    const style = Array.isArray(root.props.style) ? Object.assign({}, ...root.props.style) : root.props.style;
    expect(style.backgroundColor).toBe(palette.light.mint);
  });
});
