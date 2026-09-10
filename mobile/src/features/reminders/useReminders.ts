import { useEffect } from 'react';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { applyReminders, cancelReminders } from './notifications';

/**
 * Держит запланированные напоминания в согласии с настройками профиля.
 * Живёт во вкладках: настройки уже загружены из базы аккаунта, и при их смене
 * расписание перестраивается. Выход снимает напоминания.
 */
export function useReminders(): void {
  const t = useT();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const reminder = useSettings((s) => s.reminder);
  const weekendOff = useSettings((s) => s.weekendOff);

  useEffect(() => {
    if (!signedIn) {
      void cancelReminders();
      return;
    }
    void applyReminders(reminder, weekendOff, t.remPushTitle, t.remPushBody);
  }, [signedIn, reminder, weekendOff, t]);
}
