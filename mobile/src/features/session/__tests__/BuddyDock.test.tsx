import React from 'react';
import { act, create } from 'react-test-renderer';

import { BuddyDock } from '../BuddyDock';
import { ru } from '@/i18n/ru';
import { ThemeProvider } from '@/theme';
import { palette } from '@/theme/tokens';
import { useSettings } from '@/store/settings';
import { BuddyMark } from '@/ui';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

const base = { stepType: 'free' as const, checked: false, viewingPast: false, rec: false, grading: false, tone: null, neutral: false, stepIndex: 1, reduceMotion: true };

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
  it('tints the dock sand and says «Принято» on neutral steps', () => {
    const tree = render({ checked: true, tone: 'err', neutral: true });
    expect(bgOf(tree)).toBe(palette.light.sand);
    expect(wordOf(tree)).toContain(ru.buddy.accepted);
  });
  it('taps lightly on an accepted step', () => {
    const Haptics = jest.requireMock('expo-haptics');
    Haptics.impactAsync.mockClear();
    Haptics.notificationAsync.mockClear();
    render({});
    const tree = render({});
    act(() => {
      tree.update(<BuddyDock {...base} checked tone="mint" neutral />);
    });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
  it('exposes the word to screen readers', () => {
    const root = render({ checked: true, tone: 'err' }).root.findByProps({ testID: 'buddy-dock' });
    expect(root.props.accessibilityLabel).toBe(ru.buddy.wrong);
  });
  it('plays a reaction once per step', () => {
    // Реакция, уже стоящая при монтировании, не проигрывается заново (см. F2).
    const tree = render({ checked: true, tone: 'mint', stepIndex: 1 });
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(false);

    act(() => tree.update(<BuddyDock {...base} checked tone="mint" stepIndex={1} />));
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(false);

    act(() => tree.update(<BuddyDock {...base} checked tone="mint" stepIndex={2} />));
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(true);
  });
  it('fires one haptic per reaction', () => {
    const Haptics = jest.requireMock('expo-haptics');
    Haptics.notificationAsync.mockClear();
    const tree = render({ checked: false, tone: null });
    act(() => {
      tree.update(<BuddyDock {...base} checked tone="mint" />);
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    act(() => {
      tree.update(<BuddyDock {...base} checked tone="mint" />);
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
  it('does not replay a reaction already checked at mount', () => {
    const Haptics = jest.requireMock('expo-haptics');
    Haptics.notificationAsync.mockClear();
    const tree = render({ checked: true, tone: 'mint' });
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(false);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
  it('animates and haptics on a later transition into a reaction', () => {
    const Haptics = jest.requireMock('expo-haptics');
    Haptics.notificationAsync.mockClear();
    const tree = render({ checked: false, tone: null, stepIndex: 3 });
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(false);
    act(() => tree.update(<BuddyDock {...base} checked tone="mint" stepIndex={3} />));
    expect(tree.root.findByType(BuddyMark).props.animateReaction).toBe(true);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('BuddyDock dark theme', () => {
  afterEach(() => {
    act(() => {
      useSettings.getState().setTheme('light');
    });
  });

  it('tints the dock using the dark palette', () => {
    act(() => {
      useSettings.getState().setTheme('dark');
    });
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ThemeProvider>
          <BuddyDock {...base} />
        </ThemeProvider>,
      );
    });
    expect(bgOf(tree)).toBe(palette.dark.card);

    act(() => {
      tree.update(
        <ThemeProvider>
          <BuddyDock {...base} checked tone="mint" />
        </ThemeProvider>,
      );
    });
    expect(bgOf(tree)).toBe(palette.dark.mint);

    act(() => {
      tree.update(
        <ThemeProvider>
          <BuddyDock {...base} checked tone="amber" />
        </ThemeProvider>,
      );
    });
    expect(bgOf(tree)).toBe(palette.dark.amberBg);

    act(() => {
      tree.update(
        <ThemeProvider>
          <BuddyDock {...base} checked tone="err" />
        </ThemeProvider>,
      );
    });
    expect(bgOf(tree)).toBe(palette.dark.errBg);

    act(() => tree.unmount());
  });
});
