import { splitSource } from '../source';

describe('splitSource', () => {
  it('drops «доверие высокое» and keeps the source text', () => {
    expect(splitSource('Accademia della Crusca, «Gli allocutivi di cortesia» · доверие высокое')).toEqual({ text: 'Accademia della Crusca, «Gli allocutivi di cortesia»' });
    expect(splitSource('Ваш план · этап 01 · доверие высокое')).toEqual({ text: 'Ваш план · этап 01' });
  });
  it('flags mid and low trust', () => {
    expect(splitSource('Форум путешественников · доверие низкое')).toEqual({ text: 'Форум путешественников', warn: 'low' });
    expect(splitSource('Wikipedia, «Italian grammar» · trust medium')).toEqual({ text: 'Wikipedia, «Italian grammar»', warn: 'mid' });
  });
  it('leaves plain sources untouched', () => {
    expect(splitSource('Учебник, гл. 2')).toEqual({ text: 'Учебник, гл. 2' });
  });
});
