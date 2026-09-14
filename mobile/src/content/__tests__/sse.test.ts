import { createSseParser } from '../sse';

describe('sse parser', () => {
  it('yields complete events and keeps a partial tail', () => {
    const p = createSseParser();
    expect(p.push('data: {"t":"delta","text":"При"}\n\ndata: {"t":"del')).toEqual([{ t: 'delta', text: 'При' }]);
    expect(p.push('ta","text":"вет"}\n\n')).toEqual([{ t: 'delta', text: 'вет' }]);
  });
  it('ignores comments and blank lines, parses done and error', () => {
    const p = createSseParser();
    expect(p.push(': ping\n\ndata: {"t":"done","reply":"Привет?","turn":1}\n\n\n\ndata: {"t":"error","message":"model failed"}\n\n')).toEqual([
      { t: 'done', reply: 'Привет?', turn: 1 },
      { t: 'error', message: 'model failed' },
    ]);
  });
});
