import { createSentenceSplitter } from '../sentences';

describe('sentence splitter', () => {
  it('emits a sentence once its terminator and a following space arrive', () => {
    const s = createSentenceSplitter();
    expect(s.push('Привет. Мы в кафе')).toEqual(['Привет.']);
    expect(s.push(' в Мадриде, ')).toEqual([]);
    expect(s.push('подходит официант. Что скажешь?')).toEqual(['Мы в кафе в Мадриде, подходит официант.']);
    expect(s.flush()).toEqual(['Что скажешь?']);
  });
  it('does not split on abbreviations with a digit or a single letter before the dot', () => {
    const s = createSentenceSplitter();
    expect(s.push('Это стоит 3.50 евро. Т. е. недорого. Ясно?')).toEqual(['Это стоит 3.50 евро.', 'Т. е.', 'недорого.']);
    expect(s.flush()).toEqual(['Ясно?']);
  });
  it('treats ¿…? and ellipsis as one sentence', () => {
    const s = createSentenceSplitter();
    expect(s.push('¿Cuánto cuesta? Подумай… Скажи. ')).toEqual(['¿Cuánto cuesta?', 'Подумай…', 'Скажи.']);
    expect(s.flush()).toEqual([]);
  });
});
