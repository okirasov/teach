export type Provider = 'apple' | 'google';

export interface Account {
  /** Стабильный id у провайдера; к нему привязывается локальная БД. */
  id: string;
  name: string;
  provider: Provider;
}

export interface Session {
  account: Account;
  /** identityToken / accessToken провайдера; позже обменивается на токен бэкенда. */
  token: string;
}
