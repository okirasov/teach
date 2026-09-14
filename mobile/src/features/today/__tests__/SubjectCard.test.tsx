import React from 'react';
import { act, create } from 'react-test-renderer';

import { SubjectCard } from '../SubjectCard';

const m = { id: 'custom', name: 'Испанский', level: 'Разговорные фразы', lessonTitle: 'Урок 5 · В кафе', done: false };

describe('SubjectCard talk row', () => {
  it('renders the talk row only when onTalk is given and calls it on press', () => {
    const onTalk = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => { tree = create(<SubjectCard m={m} onPress={() => {}} onTalk={onTalk} />); });
    const row = tree.root.findByProps({ testID: 'talk-row' });
    act(() => row.props.onPress());
    expect(onTalk).toHaveBeenCalledTimes(1);
    act(() => { tree = create(<SubjectCard m={m} onPress={() => {}} />); });
    expect(tree.root.findAllByProps({ testID: 'talk-row' })).toHaveLength(0);
  });
});
