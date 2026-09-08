import { create } from 'zustand';

import { memoryKv } from '@/db/kv';
import { persistSlice } from '../persist';

interface S {
  a: number;
  b: string;
  volatile: number;
  setA: (a: number) => void;
}

const make = () => create<S>((set) => ({ a: 1, b: 'x', volatile: 0, setA: (a) => set({ a }) }));

describe('persistSlice', () => {
  it('restores saved fields and writes changes of the tracked fields only', async () => {
    const kv = memoryKv();
    await kv.set('s', JSON.stringify({ a: 5, b: 'saved' }));
    const store = make();
    const unsub = await persistSlice(store, kv, 's', ['a', 'b']);
    expect(store.getState()).toMatchObject({ a: 5, b: 'saved' });

    store.setState({ volatile: 9 });
    expect(JSON.parse((await kv.get('s'))!)).toEqual({ a: 5, b: 'saved' });

    store.getState().setA(7);
    await Promise.resolve();
    expect(JSON.parse((await kv.get('s'))!)).toEqual({ a: 7, b: 'saved' });
    unsub();
    store.getState().setA(8);
    await Promise.resolve();
    expect(JSON.parse((await kv.get('s'))!)).toEqual({ a: 7, b: 'saved' });
  });

  it('ignores a corrupt snapshot', async () => {
    const kv = memoryKv();
    await kv.set('s', '{nope');
    const store = make();
    await persistSlice(store, kv, 's', ['a']);
    expect(store.getState().a).toBe(1);
  });
});
