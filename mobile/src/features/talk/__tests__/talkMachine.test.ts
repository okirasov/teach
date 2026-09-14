import { initialTalk, reduceTalk, type TalkEvent, type TalkState } from '../talkMachine';

function run(events: TalkEvent[], from: TalkState = initialTalk()) {
  const effects: string[] = [];
  const state = events.reduce((s, e) => {
    const r = reduceTalk(s, e);
    effects.push(...r.effects);
    return r.state;
  }, from);
  return { state, effects };
}

describe('talk machine', () => {
  it('opens with the buddy speaking, then waits', () => {
    const { state, effects } = run([{ type: 'replyStart' }, { type: 'replyDelta', text: 'Привет. ' }, { type: 'replyDone', text: 'Привет. С чего начнём?' }, { type: 'speakDone' }]);
    expect(state.phase).toBe('waiting');
    expect(state.lines).toEqual([{ side: 'buddy', text: 'Привет. С чего начнём?', live: false }]);
    expect(effects).toEqual([]);
  });

  it('records a user turn and sends it when stt ends', () => {
    const { state, effects } = run([{ type: 'micTap' }, { type: 'sttResult', text: 'Hola', final: false }, { type: 'sttResult', text: 'Hola, un café', final: true }, { type: 'sttEnd' }]);
    expect(effects).toEqual(['startStt', 'send']);
    expect(state.phase).toBe('thinking');
    expect(state.lines).toEqual([{ side: 'user', text: 'Hola, un café', live: false }]);
  });

  it('a second tap while listening stops stt; empty result returns to waiting', () => {
    const { state, effects } = run([{ type: 'micTap' }, { type: 'micTap' }, { type: 'sttEnd' }]);
    expect(effects).toEqual(['startStt', 'stopStt']);
    expect(state.phase).toBe('waiting');
    expect(state.lines).toEqual([]);
  });

  it('tap while speaking interrupts and starts listening, keeping the partial line', () => {
    const { state, effects } = run([{ type: 'replyStart' }, { type: 'replyDelta', text: 'Отлично, por favor на месте.' }, { type: 'micTap' }]);
    expect(effects).toEqual(['stopSpeech', 'startStt']);
    expect(state.phase).toBe('listening');
    expect(state.lines[0]).toEqual({ side: 'buddy', text: 'Отлично, por favor на месте.', live: false });
    expect(state.lines[1]).toEqual({ side: 'user', text: '', live: true });
  });

  it('ignores taps while thinking and recovers from an error', () => {
    const thinking = run([{ type: 'micTap' }, { type: 'sttResult', text: 'x', final: true }, { type: 'sttEnd' }]).state;
    expect(reduceTalk(thinking, { type: 'micTap' }).effects).toEqual([]);
    const { state } = run([{ type: 'replyStart' }, { type: 'error', message: 'network' }], thinking);
    expect(state.phase).toBe('waiting');
    expect(state.error).toBe('network');
    expect(state.lines).toEqual([{ side: 'user', text: 'x', live: false }]);
  });

  it('close stops everything and ends', () => {
    const { state, effects } = run([{ type: 'micTap' }, { type: 'close' }]);
    expect(effects).toEqual(['startStt', 'stopStt', 'stopSpeech', 'end']);
    expect(state.ended).toBe(true);
  });
});
