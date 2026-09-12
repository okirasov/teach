import React from 'react';
import { act, create } from 'react-test-renderer';

import { BuddyDock } from '../BuddyDock';
import { ru } from '@/i18n/ru';
import { palette } from '@/theme/tokens';
import { BuddyMark } from '@/ui';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

const base = { stepType: 'free' as const, checked: false, viewingPast: false, rec: false, grading: false, tone: null, stepIndex: 1, reduceMotion: true };

function render(props: Partial<React.ComponentProps<typeof BuddyDock>>) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<BuddyDock {...base} {...props} />);
  });
  return tree;
}

function wordOf(tree: ReturnType<typeof create>): string {
  return tree.root
    .findAll((n) => typeof n.type === 'string' && (n.type as unknown as string) === 'Text')
    .map((n) => n.children.join(''))
    .join(' ');
}

function bgOf(tree: ReturnType<typeof create>): string {
  const root = tree.root.findByProps({ testID: 'buddy-dock' });
  const style = Array.isArray(root.props.style) ? Object.assign({}, ...root.props.style) : root.props.style;
  return style.backgroundColor;
}

describe('BuddyDock', () => {
  it('shows the word of the state', () => {
    expect(wordOf(render({}))).toContain(ru.buddy.waiting);
    expect(wordOf(render({ rec: true }))).toContain(ru.buddy.listening);
    expect(wordOf(render({ grading: true }))).toContain(ru.buddy.thinking);
    expect(wordOf(render({ stepType: 'explain' }))).toContain(ru.buddy.reading);
  });
  it('tints the dock on reactions', () => {
    expect(bgOf(render({}))).toBe(palette.light.card);
    expect(bgOf(render({ checked: true, tone: 'mint' }))).toBe(palette.light.mint);
    expect(bgOf(render({ checked: true, tone: 'amber' }))).toBe(palette.light.amberBg);
    expect(bgOf(render({ checked: true, tone: 'err' }))).toBe(palette.light.errBg);
  });
  it('exposes the word to screen readers', () => {
    const root = render({ checked: true, tone: 'err' }).root.findByProps({ testID: 'buddy-dock' });
    expect(root.props.accessibilityLabel).toBe(ru.buddy.wrong);
  });
  it('plays a reaction once per step', () => {
    const tree = render({ checked: true, tone: 'mint', stepIndex: 1 });
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(true);

    act(() => tree.update(<BuddyDock {...base} checked tone="mint" stepIndex={1} />));
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(false);

    act(() => tree.update(<BuddyDock {...base} checked tone="mint" stepIndex={2} />));
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(true);
  });
  it('fires one haptic per reaction', () => {
    const Haptics = jest.requireMock('expo-haptics');
    Haptics.notificationAsync.mockClear();
    const tree = render({ checked: true, tone: 'mint' });
    act(() => {
      tree.update(<BuddyDock {...base} checked tone="mint" />);
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
});
