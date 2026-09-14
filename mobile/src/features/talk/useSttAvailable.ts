import { useEffect, useState } from 'react';

import { recognizer } from '@/voice';

/** Доступен ли STT на устройстве (разрешение и поддержка). Голос никогда не блокирует: по умолчанию false. */
export function useSttAvailable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    recognizer.isAvailable().then((v) => alive && setOk(v)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return ok;
}
