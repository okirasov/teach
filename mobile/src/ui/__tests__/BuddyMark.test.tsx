import React from 'react';
import { act, create } from 'react-test-renderer';

import { BuddyMark } from '../BuddyMark';

describe('BuddyMark', () => {
  it('renders four dots in every state without throwing', () => {
    const states = ['reading', 'waiting', 'listening', 'speaking', 'thinking', 'right', 'partial', 'wrong'] as const;
    for (const state of states) {
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<BuddyMark state={state} reduceMotion animateReaction />);
      });
      // Четыре точки: три залитых + контурная (у контурной есть внутренняя заливка).
      const views = tree.root.findAll((n) => typeof n.type === 'string' && (n.type as unknown as string) === 'View');
      expect(views.length).toBeGreaterThanOrEqual(5);
      act(() => tree.unmount());
    }
  });
});
