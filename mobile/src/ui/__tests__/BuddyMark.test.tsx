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

  describe('animated (reduceMotion=false)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('plays every state without throwing or leaving warnings', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const states = ['reading', 'waiting', 'listening', 'speaking', 'thinking', 'right', 'partial', 'wrong'] as const;
      for (const state of states) {
        let tree!: ReturnType<typeof create>;
        expect(() => {
          act(() => {
            tree = create(<BuddyMark state={state} reduceMotion={false} animateReaction />);
          });
          act(() => {
            jest.advanceTimersByTime(3000);
          });
          act(() => tree.unmount());
        }).not.toThrow();
      }
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      warn.mockRestore();
      error.mockRestore();
    });

    it('renders a reaction statically with no scheduled timers when animateReaction is false', () => {
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<BuddyMark state="right" reduceMotion={false} animateReaction={false} />);
      });
      expect(jest.getTimerCount()).toBe(0);
      act(() => tree.unmount());
    });
  });
});
