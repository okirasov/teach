import type { ContentService } from '@/content';
import type { FreeStep } from '@/domain/types';
import { gradeFreeAnswer } from '../gradeFree';

const step: FreeStep = {
  type: 'free', prompt: '', placeholder: '', explain: '', recTitle: '', recNote: '',
  criteria: [{ t: 'Есть приветствие', keys: ['buongiorno'] }, { t: 'Есть просьба', keys: ['per favore'] }],
};
const svc = (impl: Partial<ContentService>) => impl as ContentService;

describe('оценка свободного ответа по смыслу', () => {
  it('берёт оценку сервера, когда она пришла вовремя', async () => {
    const hits = await gradeFreeAnswer(svc({ gradeFree: async () => [true, false] }), step, 'buonasera, un caffè', 'ru');
    expect(hits).toEqual([true, false]);
  });

  it('молчание сервера не задерживает урок: оценка по ключам', async () => {
    const slow = svc({ gradeFree: () => new Promise(() => {}) });
    const started = Date.now();
    const hits = await gradeFreeAnswer(slow, step, 'buongiorno', 'ru', 30);
    expect(hits).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('ошибка сервера и несовпадение числа критериев отбрасываются', async () => {
    expect(await gradeFreeAnswer(svc({ gradeFree: async () => { throw new Error('offline'); } }), step, 'x', 'ru', 50)).toBeUndefined();
    expect(await gradeFreeAnswer(svc({ gradeFree: async () => [true] }), step, 'x', 'ru', 50)).toBeUndefined();
  });

  it('шаг без критериев сервер не спрашивает', async () => {
    const spy = jest.fn();
    const hits = await gradeFreeAnswer(svc({ gradeFree: spy }), { ...step, criteria: [] }, 'x', 'ru', 50);
    expect(hits).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
