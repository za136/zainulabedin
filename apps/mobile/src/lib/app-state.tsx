import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import { messages, type MessageLocale } from '@factory/i18n';
import { createClient, type Cart, type Customer, type StorePublic } from '@factory/sdk';
import { API_URL } from './config';
import { storage } from './storage';

/**
 * App-wide state: the store blueprint (theme, markets, legal…) from GET /v1/store,
 * the shopper's language & delivery country, the session token and the cart id.
 * Everything else is fetched per screen.
 */
interface AppState {
  ready: boolean;
  error: string | null;
  store: StorePublic | null;
  locale: MessageLocale;
  country: string | undefined;
  token: string | null;
  user: Customer | null;
  cart: Cart | null;
  api: ReturnType<typeof createClient>;
  setLocale(l: MessageLocale): void;
  setCountry(c: string): void;
  signIn(token: string, user: Customer): void;
  signOut(): Promise<void>;
  setCart(c: Cart | null): void;
  ensureCart(): Promise<string>;
  reload(): void;
}

const Ctx = createContext<AppState | null>(null);
const K = { locale: 'sf.locale', country: 'sf.country', token: 'sf.token', cart: 'sf.cart' };

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<StorePublic | null>(null);
  const [locale, setLocaleState] = useState<MessageLocale>('de');
  const [country, setCountryState] = useState<string | undefined>();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Customer | null>(null);
  const [cart, setCartState] = useState<Cart | null>(null);
  const [nonce, setNonce] = useState(0);

  const api = useMemo(() => createClient({ baseUrl: API_URL, token: token ?? undefined, market: { locale, country } }), [token, locale, country]);

  // boot: restore persisted settings, then load the store blueprint
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [l, c, tk, cartId] = await Promise.all([storage.get(K.locale), storage.get(K.country), storage.get(K.token), storage.get(K.cart)]);
        const client = createClient({ baseUrl: API_URL, token: tk ?? undefined, market: { locale: (l as MessageLocale) ?? undefined, country: c ?? undefined } });
        const s = await client.store();
        if (!alive) return;
        setStore(s);
        setLocaleState(((l as MessageLocale) ?? s.locales.default) as MessageLocale);
        setCountryState(c ?? s.market.country);
        if (tk) {
          try {
            setUser((await client.me.get()).customer);
            setToken(tk);
          } catch {
            await storage.set(K.token, null);
          }
        }
        if (cartId) {
          try {
            const cart = await client.cart.get(cartId);
            setCartState(cart.status === 'open' ? cart : null);
          } catch {
            await storage.set(K.cart, null);
          }
        }
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [nonce]);

  const setLocale = useCallback((l: MessageLocale) => {
    setLocaleState(l);
    void storage.set(K.locale, l);
  }, []);

  const setCart = useCallback((c: Cart | null) => {
    setCartState(c);
    void storage.set(K.cart, c && c.status === 'open' ? c.id : null);
  }, []);

  const setCountry = useCallback(
    (c: string) => {
      setCountryState(c);
      void storage.set(K.country, c);
      if (cart) api.cart.update(cart.id, { country: c }).then(setCart).catch(() => {});
    },
    [api, cart, setCart],
  );

  const ensureCart = useCallback(async () => {
    if (cart?.status === 'open') return cart.id;
    const created = await api.cart.create({ locale, country });
    setCart(created);
    return created.id;
  }, [api, cart, country, locale, setCart]);

  const value: AppState = {
    ready,
    error,
    store,
    locale,
    country,
    token,
    user,
    cart,
    api,
    setLocale,
    setCountry,
    signIn(tk, u) {
      setToken(tk);
      setUser(u);
      void storage.set(K.token, tk);
    },
    async signOut() {
      try {
        await api.auth.logout();
      } catch {
        /* offline */
      }
      setToken(null);
      setUser(null);
      await storage.set(K.token, null);
    },
    setCart,
    ensureCart,
    reload: () => setNonce((n) => n + 1),
  };

  return (
    <Ctx.Provider value={value}>
      <IntlProvider locale={locale} messages={messages[locale]} timeZone="Europe/Berlin" onError={() => {}}>
        {children}
      </IntlProvider>
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}
