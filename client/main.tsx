import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Home,
  Gamepad2,
  Gift,
  Users,
  Trophy,
  ShoppingBag,
  Settings,
  HelpCircle,
  ChevronRight,
  ArrowUpRight,
  Search,
  Bell,
  Volume2,
  VolumeX,
  Plus,
  X,
  Menu,
  LogOut,
  Shield,
  History,
  Copy,
  Check,
  Sparkles,
  Coins,
  Gem,
  ChevronDown,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { api } from "./api";
import { games, rules } from "./catalog";
import "./style.css";
const format = (v: number) => new Intl.NumberFormat("ru-RU").format(v ?? 0);
const key = () => crypto.randomUUID();
type Page =
  | "home"
  | "games"
  | "rewards"
  | "friends"
  | "leaderboard"
  | "shop"
  | "profile"
  | "history"
  | "settings"
  | "help"
  | "rooms"
  | "tournaments"
  | "admin";
function App() {
  const [page, setPage] = useState<Page>(
      location.pathname.replace(/\/$/, "") === "/admin" ? "admin" : "home",
    ),
    [me, setMe] = useState<any>(null),
    [authMode, setAuthMode] = useState(""),
    [toast, setToast] = useState(""),
    [game, setGame] = useState<any>(null),
    [tab, setTab] = useState("all"),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false),
    [loading, setLoading] = useState(true),
    [sound, setSound] = useState(localStorage.getItem("sound") === "true"),
    [effects, setEffects] = useState(localStorage.getItem("effects") ?? "high");
  const reduced = useReducedMotion();
  const notify = useCallback((s: string) => {
    setToast(s);
  }, []);
  const refreshVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const user = await api("/me");
      if (version === refreshVersion.current) setMe(user);
    } catch (e: any) {
      if (e.status === 401 && version === refreshVersion.current) setMe(null);
      // A transient connection error must not sign out the player.
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!me?.id) return;
    const presence = io();
    return () => {
      presence.disconnect();
    };
  }, [me?.id]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.effects = reduced ? "off" : effects;
    localStorage.setItem("effects", effects);
    localStorage.setItem("sound", String(sound));
  }, [effects, sound, reduced]);
  const navigate = (p: Page) => {
    setPage(p);
    history.replaceState(null, "", p === "admin" ? "/admin" : "/");
    setGame(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const need = () => {
    if (!me) {
      setAuthMode("register");
      return false;
    }
    return true;
  };
  const play = (g: any) => {
    if (!need()) return;
    if (["battle", "jackpot"].includes(g.id)) {
      navigate("rooms");
      return;
    }
    setGame(g);
    setPage("games");
    window.scrollTo({ top: 0 });
  };
  async function run(fn: () => Promise<any>) {
    try {
      const result = await fn();
      void refresh();
      return result;
    } catch (e: any) {
      notify(e.message);
    }
  }
  const nav = [
    ["home", Home, "Главная"],
    ["games", Gamepad2, "Все игры"],
    ["rewards", Gift, "Бонусы"],
    ["rooms", Users, "Играть с друзьями"],
    ["tournaments", Trophy, "Турниры"],
    ["leaderboard", Trophy, "Рейтинги"],
    ["shop", ShoppingBag, "Магазин"],
  ] as const;
  const filtered = games.filter(
    (g) =>
      (tab === "all" || g.category === tab) &&
      (g.name.toLowerCase().includes(query.toLowerCase()) ||
        g.desc.toLowerCase().includes(query.toLowerCase())),
  );
  if (page === "admin" && (loading || me?.role !== "ADMIN"))
    return (
      <AdminEntry
        loading={loading}
        refresh={refresh}
        onBack={() => navigate("home")}
      />
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <span className="brand-icon">
            N<span>✦</span>
          </span>
          <span>
            NEON<span className="brand-small">C A S I N O</span>
          </span>
        </a>
        <span className="section-label">ТВОЯ ИГРОВАЯ ВСЕЛЕННАЯ</span>
        <nav>
          {nav.map(([id, Icon, title]) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={page === id ? "selected" : ""}
            >
              <Icon size={19} />
              {title}
              {id === "rewards" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-divider" />
        <nav>
          <button
            onClick={() => navigate("friends")}
            className={page === "friends" ? "selected" : ""}
          >
            <Users size={18} />
            Друзья
          </button>
          <button onClick={() => navigate("history")}>
            <History size={18} />
            История игр
          </button>
          {me?.role === "ADMIN" && (
            <button onClick={() => navigate("admin")}>
              <Shield size={18} />
              Администратор
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-promo">
            <span>✧</span>
            <b>Твой ежедневный заряд</b>
            <p>
              Заходи за бесплатными
              <br />
              монетами каждый день
            </p>
            <button onClick={() => navigate("rewards")}>
              Забрать бонус <ChevronRight size={15} />
            </button>
          </div>
          <button className="side-link" onClick={() => navigate("settings")}>
            <Settings size={17} />
            Настройки
          </button>
          <button className="side-link" onClick={() => navigate("help")}>
            <HelpCircle size={17} />
            Помощь и правила
          </button>
          <div className="social-only">
            <span className="green-dot" /> Только виртуальная валюта
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Играй. Общайся. <span>Сияй.</span>
          </div>
          <a className="mobile-brand" href="#" onClick={() => navigate("home")}>
            N<span>✦</span>
          </a>
          <div className="top-actions">
            <button
              className="icon-button sound-button"
              title="Звук"
              onClick={() => setSound(!sound)}
            >
              {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {me ? (
              <>
                <div className="balance">
                  <Coins size={18} />
                  <motion.b
                    key={me.wallet.coins}
                    initial={{ opacity: 0.4, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {format(me.wallet.coins)}
                  </motion.b>
                  <small>NC</small>
                  <button
                    title="Бесплатные бонусы"
                    onClick={() => navigate("rewards")}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="crystals">
                  <Gem size={16} />
                  {format(me.wallet.crystals)}
                </div>
                <button
                  className="icon-button"
                  title="Уведомления"
                  onClick={() => {
                    setNotifications(!notifications);
                    if (me.notifications.some((n: any) => !n.read))
                      run(() => api("/notifications/read", {}));
                  }}
                >
                  <Bell size={20} />
                  {me.notifications.some((n: any) => !n.read) && <i />}
                </button>
                <button className="avatar" onClick={() => navigate("profile")}>
                  {me.profile.avatar}
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => setAuthMode("login")}
                >
                  Войти
                </button>
                <button
                  className="primary small"
                  onClick={() => setAuthMode("register")}
                >
                  Создать аккаунт <ArrowUpRight size={16} />
                </button>
              </>
            )}
          </div>
        </header>
        {notifications && (
          <div className="notifications panel">
            <b>Уведомления</b>
            {me?.notifications.length ? (
              me.notifications.map((n: any) => <p key={n.id}>{n.message}</p>)
            ) : (
              <p>Здесь появятся приглашения и награды.</p>
            )}
          </div>
        )}
        <main>
          {game ? (
            <GameScreen
              game={game}
              sound={sound}
              effects={effects}
              onBack={() => setGame(null)}
              run={run}
              notify={notify}
            />
          ) : (
            <>
              {page === "home" && (
                <>
                  <div className="page-eyebrow">
                    <span className="green-dot" /> БЕСПЛАТНАЯ ИГРОВАЯ ПЛАТФОРМА{" "}
                    <span className="eyebrow-line" />
                  </div>
                  <section className="hero">
                    <div className="hero-copy">
                      <div className="pill">
                        <Sparkles size={13} /> ДОБРО ПОЖАЛОВАТЬ В NEON
                      </div>
                      <h1>
                        Твоя игра.
                        <br />
                        Твои правила.
                        <br />
                        <span>Твой неон.</span>
                      </h1>
                      <p>
                        Большая игровая вселенная для тебя и друзей.
                        <br className="desktop" /> Только эмоции. Только
                        виртуальные монеты.
                      </p>
                      <div className="hero-buttons">
                        <button
                          className="primary"
                          onClick={() =>
                            me ? navigate("games") : setAuthMode("register")
                          }
                        >
                          Начать играть <ArrowUpRight size={19} />
                        </button>
                        <button
                          className="glass-button"
                          onClick={() => navigate("rooms")}
                        >
                          <Users size={17} /> С друзьями
                        </button>
                      </div>
                      <div className="hero-note">
                        <Gift size={15} />
                        <b>10 000 NC</b> в подарок при регистрации
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <span className="art-star star-one">✦</span>
                      <span className="art-star star-two">✧</span>
                      <div className="floating-chip chip-one">N</div>
                      <div className="floating-chip chip-two">N</div>
                      <div className="floating-diamond">◇</div>
                      <div className="slot-machine">
                        <div className="machine-crown">
                          ★ <b>NEON</b> ★
                        </div>
                        <div className="machine-sign">J A C K P O T</div>
                        <div className="machine-reels">
                          <span>7</span>
                          <span>7</span>
                          <span>7</span>
                        </div>
                        <div className="machine-tray">
                          <i />
                          <span>GOOD VIBES ONLY</span>
                          <b>●</b>
                        </div>
                        <div className="machine-base" />
                        <div className="machine-lever">
                          <i />
                        </div>
                      </div>
                      <div className="art-caption">
                        <span className="green-dot" /> PLAY FOR THE MOMENT
                      </div>
                    </div>
                  </section>
                  <section className="benefit-row">
                    <button onClick={() => navigate("rewards")}>
                      <span className="benefit-icon purple">
                        <Gift />
                      </span>
                      <span>
                        <b>Бонус каждый день</b>
                        <small>Твой заряд бесплатных монет</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                    <button onClick={() => navigate("rooms")}>
                      <span className="benefit-icon blue">
                        <Users />
                      </span>
                      <span>
                        <b>Вместе интереснее</b>
                        <small>Создавай комнаты и зови друзей</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                    <button
                      onClick={() => {
                        setTab("free");
                        navigate("games");
                      }}
                    >
                      <span className="benefit-icon gold">
                        <Sparkles />
                      </span>
                      <span>
                        <b>Играй без риска</b>
                        <small>Зарабатывай в бесплатных играх</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  </section>
                  <div className="section-heading">
                    <div>
                      <span className="kicker">НАЙДИ СВОЙ РИТМ</span>
                      <h2>
                        <span>🔥</span> Популярные игры
                      </h2>
                    </div>
                    <button
                      className="subtle-link"
                      onClick={() => {
                        setTab("all");
                        navigate("games");
                      }}
                    >
                      Все 20 игр <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="game-grid home-grid">
                    {games.slice(0, 6).map((g) => (
                      <GameCard key={g.id} game={g} onClick={() => play(g)} />
                    ))}
                  </div>
                  <div className="lower-panels">
                    <div className="daily-banner">
                      <div className="daily-symbol">✧</div>
                      <div>
                        <span className="kicker">БОЛЬШЕ, ЧЕМ ПРОСТО ИГРА</span>
                        <h2>
                          Маленькие шаги.
                          <br />
                          Большие достижения.
                        </h2>
                        <p>
                          Выполняй задания, открывай награды
                          <br />и собирай свою уникальную коллекцию.
                        </p>
                        <button
                          className="glass-button"
                          onClick={() => navigate("rewards")}
                        >
                          Мои задания <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="community-banner">
                      <span className="kicker">ТВОЯ КОМАНДА — ТВОЯ СИЛА</span>
                      <div className="avatar-stack">
                        <span>👾</span>
                        <span>🦊</span>
                        <span>⚡</span>
                        <span>🌙</span>
                      </div>
                      <h2>Неон ярче вместе</h2>
                      <p>
                        Поделись ссылкой, создай приватную
                        <br />
                        комнату и устрой свой игровой вечер.
                      </p>
                      <button
                        className="subtle-link"
                        onClick={() => navigate("rooms")}
                      >
                        Собрать друзей <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </div>
                  <section className="news-strip">
                    <span className="news-icon">N✦</span>
                    <div>
                      <span className="kicker">НОВОСТИ NEON</span>
                      <h3>Добро пожаловать в город, который сияет</h3>
                      <p>
                        Первый сезон открыт: бесплатный пропуск, коллекция
                        аватаров и игры с друзьями.
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => navigate("help")}
                    >
                      <ArrowUpRight />
                    </button>
                  </section>
                </>
              )}
              {page === "games" && (
                <>
                  <PageTitle
                    eyebrow="ВЫБЕРИ СВОЙ МИР"
                    title="Игровая вселенная"
                    subtitle="20 способов поймать свою волну. Все монеты виртуальные."
                  />
                  <div className="catalog-controls">
                    <div className="tabs">
                      {[
                        ["all", "Все игры"],
                        ["originals", "Originals"],
                        ["slots", "Слоты"],
                        ["cards", "Карточные"],
                        ["classic", "Классика"],
                        ["social", "С друзьями"],
                        ["free", "Без ставок"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          className={tab === id ? "active" : ""}
                          onClick={() => setTab(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="search">
                      <Search size={17} />
                      <input
                        placeholder="Найти игру"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="game-grid">
                    {filtered.map((g) => (
                      <GameCard key={g.id} game={g} onClick={() => play(g)} />
                    ))}
                  </div>
                  {!filtered.length && <Empty text="Игры не найдены" />}
                </>
              )}
              {page === "help" && (
                <>
                  <PageTitle
                    eyebrow="ВСЁ ПРОСТО"
                    title="Игра с хорошими правилами"
                    subtitle="NEON CASINO — развлекательная социальная платформа."
                  />
                  <div className="panel prose">
                    <h3>Только виртуальная валюта</h3>
                    <p>
                      NC и CRYSTALS нельзя купить, продать, обменять на деньги
                      или вывести. Здесь нет депозитов, денежных призов и
                      криптоплатежей.
                    </p>
                    <h3>Честность и сохранение</h3>
                    <p>
                      Результаты определяет сервер. Ставки и награды сохраняются
                      в PostgreSQL. Для каждого одиночного раунда сохраняются
                      seed и его SHA-256 хеш; seed раскрывается после
                      завершения. Получить seed до ставки через интерфейс пока
                      нельзя — это журнал воспроизводимости, а не полная схема
                      provably fair.
                    </p>
                    <h3>Пять особенностей NEON</h3>
                    <p>
                      «Импульс дня» — пример без ставки; «Созвездие памяти» —
                      шесть пар с бесплатной наградой; «Нулевой риск» —
                      бесплатный пропуск за XP; «Комната без комиссии» — друзья
                      делят полный банк; «Перерождение» — престиж со сбросом XP
                      и сохранением коллекции.
                    </p>
                    <h3>Аккаунт и восстановление</h3>
                    <p>
                      При регистрации сохраните код восстановления. Он заменяет
                      email и позволяет сменить пароль. Гостю доступны четыре
                      игры, ставка до 100 NC и стартовые 1 000 NC. Бонусы,
                      магазин и комнаты требуют регистрации.
                    </p>
                    <h3>Поддержка и приватность</h3>
                    <p>
                      Не передавайте пароль, cookie и код восстановления.
                      Администратор проекта помогает с блокировками и вопросами.
                      Для защиты от массовой регистрации сохраняется хеш IP на
                      сутки; пароли хешируются bcrypt. Удаление аккаунта
                      запрашивается у владельца проекта.
                    </p>
                  </div>
                  <div className="rules-list">
                    {games.map((g) => (
                      <details className="panel" key={g.id}>
                        <summary>
                          {g.name}
                          <ChevronDown size={16} />
                        </summary>
                        <p>{rules[g.id]}</p>
                      </details>
                    ))}
                  </div>
                </>
              )}
              {!["home", "games", "help"].includes(page) &&
                (!me ? (
                  <div className="auth-gate panel">
                    <span>✦</span>
                    <h2>Твой неон начинается здесь</h2>
                    <p>
                      Создай аккаунт, чтобы сохранять прогресс
                      <br />и играть вместе с друзьями.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setAuthMode("register")}
                    >
                      Создать аккаунт
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setAuthMode("login")}
                    >
                      Уже есть аккаунт
                    </button>
                  </div>
                ) : (
                  <AccountPage
                    page={page}
                    me={me}
                    navigate={navigate}
                    refresh={refresh}
                    run={run}
                    notify={notify}
                    play={play}
                    sound={sound}
                    setSound={setSound}
                    effects={effects}
                    setEffects={setEffects}
                  />
                ))}
            </>
          )}
          <footer>
            <a
              className="footer-logo"
              href="#"
              onClick={() => navigate("home")}
            >
              NEON <span>CASINO</span>
            </a>
            <p>Только виртуальные монеты. Настоящие эмоции.</p>
            <span>Без депозитов · Без вывода средств · Бесплатно</span>
            <small>© {new Date().getFullYear()} NEON CASINO</small>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {[
          ["home", Home, "Главная"],
          ["games", Gamepad2, "Игры"],
          ["rewards", Gift, "Бонусы"],
          ["rooms", Users, "Друзья"],
          ["profile", Settings, "Профиль"],
        ].map(([id, Icon, label]: any) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <AnimatePresence>
        {authMode && (
          <AuthModal
            mode={authMode}
            setMode={setAuthMode}
            close={() => setAuthMode("")}
            refresh={refresh}
            notify={notify}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="toast"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Sparkles size={18} />
            {toast}
            <button onClick={() => setToast("")}>
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function AdminEntry({ loading, refresh, onBack }: any) {
  const [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/auth/admin/login", { login, password });
      setPassword("");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-entry">
      <div className="panel admin-login">
        <span className="modal-emblem">
          <Shield size={38} />
        </span>
        <span className="kicker">NEON CASINO · ADMIN</span>
        <h1>Вход администратора</h1>
        <p className="muted">Защищённый доступ к управлению платформой</p>
        {loading ? (
          <p role="status">Проверяем сессию…</p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Логин
              <input
                autoFocus
                autoComplete="username"
                required
                maxLength={20}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </label>
            <label>
              Пароль
              <input
                autoComplete="current-password"
                type="password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Проверяем…" : "Войти в админ-панель"}
              <Shield size={16} />
            </button>
          </form>
        )}
        <button className="text-button" onClick={onBack}>
          ← На сайт
        </button>
      </div>
    </main>
  );
}
function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-title">
      <span className="kicker">{eyebrow}</span>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Sparkles size={30} />
      <p>{text}</p>
    </div>
  );
}
function GameCard({ game: g, onClick }: { game: any; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={"game-card card-" + g.id}
      style={{ "--card-color": g.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="card-art">
        {g.tag && (
          <span className={"game-tag " + (g.tag === "NEW" ? "new" : "")}>
            {g.tag}
          </span>
        )}
        <div className="card-grid" />
        <div className="card-orb" />
        {g.id === "slots" ? (
          <div className="mini-slots">
            <span>7</span>
            <span>7</span>
            <span>7</span>
          </div>
        ) : g.id === "roulette" ? (
          <div className="mini-roulette">
            <i>✦</i>
          </div>
        ) : g.id === "blackjack" ? (
          <div className="mini-cards">
            <span>
              A<small>♠</small>
            </span>
            <span>
              K<small>♥</small>
            </span>
          </div>
        ) : g.id === "plinko" ? (
          <div className="mini-plinko">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i}>{"• ".repeat(i + 3)}</div>
            ))}
            <b>●</b>
          </div>
        ) : g.id === "crash" ? (
          <svg className="mini-crash" viewBox="0 0 240 140">
            <defs>
              <linearGradient id="crashfill" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#f39862" stopOpacity=".3" />
                <stop offset="1" stopColor="#f39862" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M20 125 Q140 125 212 20 L212 130 L20 130Z"
              fill="url(#crashfill)"
            />
            <path
              d="M20 125 Q140 125 212 20"
              stroke="#f39862"
              strokeWidth="5"
              fill="none"
            />
            <text x="82" y="80" fill="white" fontSize="32" fontWeight="800">
              CRASH
            </text>
          </svg>
        ) : (
          <span className="game-symbol">{g.symbol}</span>
        )}
        <span className="card-watermark">NEON ORIGINAL</span>
      </div>
      <div className="card-info">
        <div>
          <h3>{g.name}</h3>
          <p>{g.desc}</p>
        </div>
        <span className="card-play">
          <ArrowUpRight size={18} />
        </span>
      </div>
    </motion.button>
  );
}
function AuthModal({ mode, setMode, close, refresh, notify }: any) {
  const [nickname, setNickname] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [recovery, setRecovery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/" + mode, {
        nickname,
        password,
        ...(mode === "register" &&
        new URLSearchParams(location.search).get("ref")
          ? { referral: new URLSearchParams(location.search).get("ref") }
          : {}),
        ...(mode === "recover" ? { recoveryCode: code } : {}),
      });
      await refresh();
      if (result.recoveryCode) setRecovery(result.recoveryCode);
      else close();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Аккаунт NEON"
        className="modal"
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close icon-button" onClick={close}>
          <X size={20} />
        </button>
        <span className="modal-emblem">✦</span>
        {recovery ? (
          <>
            <h2>Сохраните ключ доступа</h2>
            <p>
              Этот код нужен для восстановления пароля. Он показывается только
              сейчас.
            </p>
            <code className="recovery">{recovery}</code>
            <button
              className="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(recovery);
                notify("Код скопирован");
              }}
            >
              Скопировать код <Copy size={16} />
            </button>
            <button className="text-button" onClick={close}>
              Я сохранил код
            </button>
          </>
        ) : (
          <>
            <span className="kicker">ТВОЯ НОВАЯ ИГРОВАЯ ВСЕЛЕННАЯ</span>
            <h2>
              {mode === "register"
                ? "Зажги свой неон"
                : mode === "login"
                  ? "С возвращением"
                  : "Восстановить доступ"}
            </h2>
            <p>
              {mode === "register"
                ? "10 000 NC уже ждут тебя. Бесплатно."
                : "Продолжи свою игровую историю."}
            </p>
            <form onSubmit={submit}>
              <label>
                Никнейм
                <input
                  autoFocus
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={20}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              {mode === "recover" && (
                <label>
                  Код восстановления
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              )}
              <label>
                {mode === "recover" ? "Новый пароль" : "Пароль"}
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={10}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <small>Не менее 10 символов</small>
              </label>
              {error && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Подождите…"
                  : mode === "register"
                    ? "Создать аккаунт"
                    : mode === "login"
                      ? "Войти"
                      : "Сменить пароль"}
                <ArrowUpRight size={17} />
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "Создать аккаунт" : "Уже есть аккаунт? Войти"}
            </button>
            <div className="auth-links">
              <button onClick={() => setMode("recover")}>Забыли пароль?</button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/auth/guest", {});
                    await refresh();
                    close();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Войти как гость
              </button>
            </div>
            <small className="legal-note">
              Только виртуальная валюта. Регистрация означает согласие с
              правилами платформы.
            </small>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
function Card({ card, selected, onClick }: any) {
  const names = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ],
    suits = ["♠", "♥", "♦", "♣"];
  return (
    <button
      disabled={!onClick}
      onClick={onClick}
      className={
        "playing-card " +
        (card === -1 ? "back" : "") +
        (selected ? " held" : "")
      }
      style={{ color: card >= 13 && card < 39 ? "#d14e6c" : "#202237" }}
    >
      {card === -1 ? (
        "N✦"
      ) : (
        <>
          {names[card % 13]}
          <span>{suits[Math.floor(card / 13)]}</span>
          {selected && <small>ОСТАВИТЬ</small>}
        </>
      )}
    </button>
  );
}
function GameScreen({ game: g, sound, effects, onBack, run, notify }: any) {
  const [bet, setBet] = useState(100),
    [opts, setOpts] = useState<any>({
      theme: 0,
      type: "red",
      number: 7,
      target: g.id === "limbo" ? 2 : 50,
      side: g.id === "baccarat" ? "player" : "heads",
      mines: 3,
      risk: 1,
      auto: 2,
      picks: [7, 14, 21, 28, 35],
    }),
    [round, setRound] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [hold, setHold] = useState<number[]>([]),
    [answer, setAnswer] = useState(""),
    [showRules, setShowRules] = useState(false),
    [tick, setTick] = useState(0);
  const free = ["memory", "daily"].includes(g.id),
    s = round?.state ?? {},
    done = round?.status === "DONE";
  useEffect(() => {
    api("/games/active")
      .then((list) => {
        const active = list.find((r: any) => r.game === g.id);
        if (active) setRound(active);
      })
      .catch(() => {});
  }, [g.id]);
  useEffect(() => {
    if (g.id === "crash" && round && !done) {
      const t = setInterval(() => setTick((v) => v + 1), 100);
      return () => clearInterval(t);
    }
  }, [round, done, g.id]);
  const current =
    Math.floor(
      Math.exp(
        (Math.max(0, Date.now() - (s.startAt ?? Date.now())) / 1000) * 0.16,
      ) * 100,
    ) / 100;
  const latestRound = useRef(round);
  latestRound.current = round;
  const actionPending = useRef(false);
  const actionVersion = useRef(0);
  const polling = useRef(false);
  useEffect(() => {
    if (g.id !== "crash" || !round || done) return;
    let cancelled = false;
    const poll = async () => {
      if (polling.current || actionPending.current) return;
      polling.current = true;
      const version = actionVersion.current;
      try {
        const result = await api(`/games/${round.id}/action`, {
          key: key(),
          action: { type: "check" },
        });
        if (
          !cancelled &&
          version === actionVersion.current &&
          !actionPending.current &&
          latestRound.current?.id === result.id &&
          latestRound.current?.status === "ACTIVE" &&
          result.status === "DONE"
        ) {
          latestRound.current = result;
          setRound(result);
          beep(result.result?.payout > result.bet);
          // Refresh the wallet separately; never hold the cashout control for it.
          void run(async () => result);
        }
      } catch {
        // Background polling retries without changing manual control availability.
      } finally {
        polling.current = false;
      }
    };
    const timer = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [g.id, round?.id, done]);
  function beep(win: boolean) {
    if (!sound) return;
    try {
      const ctx = new AudioContext(),
        o = ctx.createOscillator(),
        gain = ctx.createGain();
      o.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.frequency.value = win ? 780 : 220;
      o.start();
      o.stop(ctx.currentTime + 0.3);
      o.onended = () => ctx.close();
    } catch {}
  }
  async function execute(fn: () => Promise<any>) {
    if (actionPending.current) return;
    actionPending.current = true;
    actionVersion.current++;
    setBusy(true);
    try {
      const result = await run(fn);
      if (result) {
        latestRound.current = result;
        setRound(result);
        if (result.status === "DONE") beep(result.result?.payout > result.bet);
      }
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  async function begin() {
    setHold([]);
    await execute(() =>
      api("/games/start", {
        game: g.id,
        bet: free ? 0 : bet,
        key: key(),
        options: opts,
      }),
    );
  }
  async function action(a: any) {
    if (!round || actionPending.current) return;
    await execute(() =>
      api(`/games/${round.id}/action`, { key: key(), action: a }),
    );
  }
  function option(name: string, value: any) {
    setOpts((o: any) => ({ ...o, [name]: value }));
  }
  const active = round && !done;
  return (
    <>
      <button className="back-link" onClick={onBack}>
        ← Все игры
      </button>
      <div className="game-heading">
        <PageTitle eyebrow="NEON ORIGINALS" title={g.name} subtitle={g.desc} />
        <button
          className="glass-button"
          onClick={() => setShowRules(!showRules)}
        >
          <HelpCircle size={16} /> Правила
        </button>
      </div>
      {showRules && (
        <div className="panel prose">
          <p>{rules[g.id]}</p>
          <p>
            Выплаты включают ставку. Максимальная выплата одиночного раунда: 1
            000 000 NC. Все награды виртуальные.
          </p>
        </div>
      )}
      <div className="game-layout">
        <aside className="bet-panel panel">
          <span className="kicker">
            {free ? "ИГРА БЕЗ СТАВКИ" : "НАСТРОЙ СВОЮ ИГРУ"}
          </span>
          {!free && (
            <>
              <label>
                Сумма ставки <span>NC</span>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  step={10}
                  value={bet}
                  disabled={!!active}
                  onChange={(e) => setBet(Number(e.target.value))}
                />
              </label>
              <div className="bet-shortcuts">
                {[50, 100, 500, 1000].map((n) => (
                  <button key={n} disabled={!!active} onClick={() => setBet(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
          {g.id === "slots" && (
            <label>
              Игровой автомат
              <select
                disabled={!!active}
                value={opts.theme}
                onChange={(e) => option("theme", Number(e.target.value))}
              >
                {[
                  "Neon Fruits",
                  "Cyber Fortune",
                  "Lucky Seven",
                  "Space Spin",
                  "Golden Empire",
                ].map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {g.id === "roulette" && (
            <>
              <label>
                Вариант ставки
                <select
                  value={opts.type}
                  onChange={(e) => option("type", e.target.value)}
                >
                  {[
                    ["red", "Красное"],
                    ["black", "Чёрное"],
                    ["number", "Число"],
                    ["odd", "Нечётное"],
                    ["even", "Чётное"],
                    ["low", "1–18"],
                    ["high", "19–36"],
                    ["dozen1", "1–12"],
                    ["dozen2", "13–24"],
                    ["dozen3", "25–36"],
                  ].map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {opts.type === "number" && (
                <label>
                  Число
                  <input
                    type="number"
                    min={0}
                    max={36}
                    value={opts.number}
                    onChange={(e) => option("number", +e.target.value)}
                  />
                </label>
              )}
            </>
          )}
          {["dice", "limbo"].includes(g.id) && (
            <label>
              {g.id === "dice" ? "Число меньше" : "Целевой множитель"}
              <input
                type="number"
                min={2}
                max={g.id === "dice" ? 98 : 1000}
                value={opts.target}
                onChange={(e) => option("target", +e.target.value)}
              />
            </label>
          )}
          {g.id === "coinflip" && (
            <label>
              Твоя сторона
              <select
                value={opts.side}
                onChange={(e) => option("side", e.target.value)}
              >
                <option value="heads">Орёл</option>
                <option value="tails">Решка</option>
              </select>
            </label>
          )}
          {g.id === "baccarat" && (
            <label>
              Ставка
              <select
                value={opts.side}
                onChange={(e) => option("side", e.target.value)}
              >
                <option value="player">Player</option>
                <option value="banker">Banker</option>
                <option value="tie">Ничья</option>
              </select>
            </label>
          )}
          {g.id === "mines" && (
            <label>
              Количество мин
              <input
                disabled={!!active}
                type="number"
                min={1}
                max={20}
                value={opts.mines}
                onChange={(e) => option("mines", +e.target.value)}
              />
            </label>
          )}
          {g.id === "plinko" && (
            <label>
              Уровень риска
              <select
                value={opts.risk}
                onChange={(e) => option("risk", +e.target.value)}
              >
                {["Низкий", "Средний", "Высокий"].map((v, i) => (
                  <option key={v} value={i}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
          {g.id === "crash" && (
            <label>
              Автовывод
              <input
                disabled={!!active}
                type="number"
                min={2}
                max={100}
                value={opts.auto}
                onChange={(e) => option("auto", +e.target.value)}
              />
            </label>
          )}
          {free && (
            <div className="free-note">
              <Gift size={30} />
              <h3>Зарабатывай без риска</h3>
              <p>Бесплатная попытка раз в день. Баланс не уменьшается.</p>
            </div>
          )}
          {!active && (
            <button
              className="primary play-button"
              disabled={busy}
              onClick={begin}
            >
              {busy
                ? "Сервер определяет результат…"
                : round
                  ? "Играть ещё"
                  : free
                    ? "Начать испытание"
                    : "Играть"}
              <ArrowUpRight size={18} />
            </button>
          )}
          {active && (
            <>
              <div className="round-status">
                <span className="green-dot" /> Раунд сохранён на сервере
              </div>
              {["mines", "tower", "hilo"].includes(g.id) && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => action({ type: "cashout" })}
                >
                  Забрать ×{s.mult ?? 1}
                </button>
              )}
              {g.id === "blackjack" && (
                <>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => action({ type: "hit" })}
                  >
                    Взять карту
                  </button>
                  <button
                    className="glass-button"
                    disabled={busy}
                    onClick={() => action({ type: "stand" })}
                  >
                    Остановиться
                  </button>
                  {s.player?.length === 2 && (
                    <button
                      className="glass-button"
                      disabled={busy}
                      onClick={() => action({ type: "double" })}
                    >
                      Удвоить ставку
                    </button>
                  )}
                </>
              )}
              {g.id === "poker" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => action({ hold })}
                >
                  Обменять карты
                </button>
              )}
              {g.id === "crash" && (
                <button
                  className="primary crash-cashout"
                  aria-busy={busy}
                  disabled={busy}
                  onClick={() => action({ type: "cashout" })}
                >
                  {busy ? "Забираем…" : `Забрать ×${current.toFixed(2)}`}
                </button>
              )}
              <button
                className="text-button muted"
                disabled={busy}
                onClick={() => action({ type: "forfeit" })}
              >
                Завершить без выплаты
              </button>
            </>
          )}
          {g.id === "poker" && (
            <p className="muted">
              Можно также играть с друзьями в разделе «Комнаты».
            </p>
          )}
          <div className="server-note">
            <Shield size={14} /> Результат рассчитывает сервер
          </div>
        </aside>
        <section
          className={"game-stage stage-" + g.id}
          style={{ "--game-color": g.color } as React.CSSProperties}
        >
          {g.id === "slots" && (
            <>
              <div className="stage-label">
                {
                  [
                    "NEON FRUITS",
                    "CYBER FORTUNE",
                    "LUCKY SEVEN",
                    "SPACE SPIN",
                    "GOLDEN EMPIRE",
                  ][opts.theme]
                }
              </div>
              <div className={"live-reels " + (busy ? "spinning" : "")}>
                {(s.reels ?? [5, 5, 5]).map((v: number, i: number) => (
                  <motion.span
                    key={`${round?.id}-${i}`}
                    initial={{ y: effects === "off" ? 0 : -70, opacity: 0.2 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.12 }}
                  >
                    {
                      [
                        ["🍒", "🍋", "🍇", "🍉", "🔔", "7️⃣"],
                        ["⚡", "🔮", "🤖", "💜", "💎", "👑"],
                        ["🍀", "⭐", "🧲", "🔔", "💰", "7️⃣"],
                        ["🌙", "🪐", "🚀", "👽", "☄️", "🌌"],
                        ["🏺", "🪙", "🦅", "💎", "👑", "☀️"],
                      ][s.theme ?? opts.theme][v]
                    }
                  </motion.span>
                ))}
              </div>
              <p className="stage-hint">
                Три одинаковых: ×
                {[
                  [4, 5, 6, 8, 12, 25],
                  [3, 5, 7, 10, 15, 30],
                  [2, 4, 6, 8, 14, 40],
                  [3, 4, 5, 9, 18, 35],
                  [2, 3, 5, 10, 20, 45],
                ][opts.theme].join(" / ×")}{" "}
                · Пара ×1
              </p>
            </>
          )}
          {["roulette", "wheel"].includes(g.id) && (
            <>
              <div className="wheel-pointer">▼</div>
              <motion.div
                className={
                  "live-wheel " + (g.id === "roulette" ? "roulette-wheel" : "")
                }
                key={round?.id}
                initial={{ rotate: 0 }}
                animate={{
                  rotate: round
                    ? 1080 -
                      (g.id === "roulette"
                        ? (([
                            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
                            11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
                            22, 18, 29, 7, 28, 12, 35, 3, 26,
                          ].indexOf(s.number ?? 0) +
                            0.5) *
                            360) /
                          37
                        : ((s.index ?? 0) + 0.5) * 30)
                    : 0,
                }}
                transition={{
                  duration: effects === "off" ? 0 : 2.5,
                  ease: [0.12, 0.75, 0.25, 1],
                }}
              >
                {(g.id === "roulette"
                  ? [
                      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11,
                      30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
                      29, 7, 28, 12, 35, 3, 26,
                    ]
                  : [0, 1, 0.5, 2, 0, 1, 0.5, 5, 0, 1, 0.5, 10]
                ).map((n, i) => (
                  <span
                    className="wheel-number"
                    key={i}
                    style={{
                      transform: `rotate(${((i + 0.5) * 360) / (g.id === "roulette" ? 37 : 12)}deg) translateY(-112px) rotate(${-(((i + 0.5) * 360) / (g.id === "roulette" ? 37 : 12))}deg)`,
                    }}
                  >
                    {g.id === "roulette" ? n : "×" + n}
                  </span>
                ))}
                <div>
                  {g.id === "roulette" ? "NEON" : "FORTUNE"}
                  <b>✦</b>
                </div>
              </motion.div>
              <div className="wheel-result">
                {round
                  ? g.id === "roulette"
                    ? s.number
                    : `×${s.segments?.[s.index]}`
                  : "Испытай удачу"}
              </div>
            </>
          )}
          {["blackjack", "baccarat", "poker"].includes(g.id) && (
            <div className="card-table">
              {g.id === "blackjack" ? (
                <>
                  <p>
                    ДИЛЕР {done && s.dealer ? `· ${cardPoints(s.dealer)}` : ""}
                  </p>
                  <div className="hand">
                    {(s.dealer ?? [-1, -1]).map((c: number, i: number) => (
                      <Card key={i} card={c} />
                    ))}
                  </div>
                  <div className="table-mark">
                    NEON CASINO · BLACKJACK PAYS 3:2
                  </div>
                  <div className="hand">
                    {(s.player ?? [-1, -1]).map((c: number, i: number) => (
                      <Card key={i} card={c} />
                    ))}
                  </div>
                  <p>ТВОЯ РУКА {s.player ? `· ${cardPoints(s.player)}` : ""}</p>
                </>
              ) : g.id === "poker" ? (
                <>
                  <p>ВЫБЕРИ КАРТЫ, КОТОРЫЕ ОСТАВИШЬ</p>
                  <div className="hand poker-hand">
                    {(s.hand ?? [-1, -1, -1, -1, -1]).map(
                      (c: number, i: number) => (
                        <Card
                          key={i}
                          card={c}
                          selected={hold.includes(i)}
                          onClick={
                            active
                              ? () =>
                                  setHold((h) =>
                                    h.includes(i)
                                      ? h.filter((n) => n !== i)
                                      : [...h, i],
                                  )
                              : undefined
                          }
                        />
                      ),
                    )}
                  </div>
                  <h3>{s.combination?.label ?? "Jacks or better"}</h3>
                  <p>ROYAL ×250 · STRAIGHT FLUSH ×50 · FOUR ×25</p>
                </>
              ) : (
                <>
                  <p>BANKER · {s.bs ?? "—"}</p>
                  <div className="hand">
                    {(s.banker ?? [-1, -1]).map((c: number, i: number) => (
                      <Card key={i} card={c} />
                    ))}
                  </div>
                  <h3>{s.winner?.toUpperCase() ?? "PUNTO BANCO"}</h3>
                  <div className="hand">
                    {(s.player ?? [-1, -1]).map((c: number, i: number) => (
                      <Card key={i} card={c} />
                    ))}
                  </div>
                  <p>PLAYER · {s.ps ?? "—"}</p>
                </>
              )}
            </div>
          )}
          {g.id === "mines" && (
            <>
              <div className="stage-label">
                {s.opened?.length ?? 0} БЕЗОПАСНЫХ ШАГОВ <b>×{s.mult ?? 1}</b>
              </div>
              <div className="mines-grid">
                {Array.from({ length: 25 }, (_, i) => (
                  <button
                    key={i}
                    disabled={!active || busy || s.opened?.includes(i)}
                    className={s.opened?.includes(i) ? "revealed" : ""}
                    onClick={() => action({ index: i })}
                  >
                    {s.mines?.includes(i) && (done || s.opened?.includes(i))
                      ? "💣"
                      : s.opened?.includes(i)
                        ? "💎"
                        : "✦"}
                  </button>
                ))}
              </div>
            </>
          )}
          {g.id === "tower" && (
            <div className="tower-grid">
              {Array.from({ length: 8 }, (_, row) => 7 - row).map((level) => (
                <div key={level} className={level === s.level ? "current" : ""}>
                  <small>{level + 1}</small>
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      disabled={!active || busy || level !== s.level}
                      onClick={() => action({ index: i })}
                    >
                      {s.choices?.[level] === i
                        ? s.bad?.[level] === i
                          ? "✖"
                          : "💎"
                        : done && s.bad?.[level] === i
                          ? "✖"
                          : "◇"}
                    </button>
                  ))}
                  <small>×{(0.97 * 1.5 ** (level + 1)).toFixed(2)}</small>
                </div>
              ))}
            </div>
          )}
          {g.id === "hilo" && (
            <>
              <div className="stage-label">
                ВЫШЕ ИЛИ НИЖЕ? <b>×{s.mult ?? 1}</b>
              </div>
              <Card card={s.card ?? -1} />
              <div className="inline-actions">
                <button
                  className="glass-button"
                  disabled={!active || busy}
                  onClick={() => action({ type: "lower" })}
                >
                  ↓ Ниже
                </button>
                <button
                  className="primary"
                  disabled={!active || busy}
                  onClick={() => action({ type: "higher" })}
                >
                  ↑ Выше
                </button>
              </div>
            </>
          )}
          {g.id === "crash" && (
            <div className="crash-chart">
              <svg viewBox="0 0 500 260">
                <path
                  d="M10 250 Q350 250 480 15"
                  fill="none"
                  stroke={done ? "#f178af" : "#bb8aff"}
                  strokeWidth="5"
                />
                <path
                  d="M10 250 Q350 250 480 15 L480 250Z"
                  fill="rgba(160,100,250,.1)"
                />
              </svg>
              <div className="crash-value">
                {done
                  ? `×${s.crash?.toFixed(2)}`
                  : active
                    ? `×${current.toFixed(2)}`
                    : "ГОТОВ К ВЗЛЁТУ?"}
                <small>
                  {done
                    ? "ПОЛЁТ ЗАВЕРШЁН"
                    : active
                      ? "МНОЖИТЕЛЬ РАСТЁТ"
                      : "ЗАПУСТИ СВОЙ РАУНД"}
                </small>
              </div>
            </div>
          )}
          {g.id === "plinko" && (
            <div className="plinko-board">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i}>
                  {Array.from({ length: i + 2 }, (_, j) => (
                    <i key={j} />
                  ))}
                </div>
              ))}
              {round && (
                <motion.b
                  className="plinko-ball"
                  key={round.id}
                  initial={{ top: "0%", left: "50%" }}
                  animate={{
                    top: [
                      "0%",
                      ...s.path.map((_: any, i: number) => (i + 1) * 7.2 + "%"),
                    ],
                    left: [
                      "50%",
                      ...s.path.map(
                        (_: any, i: number) =>
                          50 +
                          s.path
                            .slice(0, i + 1)
                            .reduce(
                              (a: number, b: number) => a + (b ? 1 : -1),
                              0,
                            ) *
                            3.2 +
                          "%",
                      ),
                    ],
                  }}
                  transition={{ duration: effects === "off" ? 0 : 2.4 }}
                >
                  ●
                </motion.b>
              )}
              <div className="plinko-bins">
                {(
                  s.multipliers ?? [
                    25, 10, 5, 2, 1, 0.5, 0.3, 0.5, 1, 2, 5, 10, 25,
                  ]
                ).map((n: number, i: number) => (
                  <span key={i} className={s.index === i ? "chosen" : ""}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          {g.id === "memory" && (
            <>
              <div className="stage-label">
                СОЗВЕЗДИЕ ПАМЯТИ <b>{s.moves ?? 0} / 18</b>
              </div>
              <div className="memory-grid">
                {(s.cards ?? Array(12).fill(-1)).map((c: number, i: number) => (
                  <button
                    key={i}
                    disabled={
                      !active ||
                      busy ||
                      s.matched?.includes(i) ||
                      s.opened?.includes(i)
                    }
                    className={c >= 0 ? "revealed" : ""}
                    onClick={() => action({ index: i })}
                  >
                    {c === -1 ? "✦" : ["⚡", "💎", "🌙", "👾", "🪐", "🍀"][c]}
                  </button>
                ))}
              </div>
            </>
          )}
          {g.id === "daily" && (
            <>
              <span className="challenge-icon">⚡</span>
              <span className="stage-label">ИМПУЛЬС ДНЯ · 60 СЕКУНД</span>
              <h2 className="math-question">
                {s.a ? `${s.a} + ${s.b} = ?` : "Готов к испытанию?"}
              </h2>
              {active && (
                <form
                  className="inline-actions"
                  onSubmit={(e) => {
                    e.preventDefault();
                    action({ answer: Number(answer) });
                  }}
                >
                  <input
                    type="number"
                    autoFocus
                    required
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Ответ"
                  />
                  <button className="primary" disabled={busy}>
                    Проверить
                  </button>
                </form>
              )}
              {done && (
                <h3>
                  {s.correct ? "Отличная работа!" : "Попробуй снова завтра"}
                </h3>
              )}
            </>
          )}
          {g.id === "keno" && (
            <>
              <div className="stage-label">
                ВЫБЕРИ ДО 10 ЧИСЕЛ <b>{opts.picks.length} / 10</b>
              </div>
              <div className="keno-grid">
                {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={
                      (opts.picks.includes(n) ? "picked " : "") +
                      (s.drawn?.includes(n) ? "drawn" : "")
                    }
                    onClick={() =>
                      option(
                        "picks",
                        opts.picks.includes(n)
                          ? opts.picks.filter((v: number) => v !== n)
                          : opts.picks.length < 10
                            ? [...opts.picks, n]
                            : opts.picks,
                      )
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
              {done && <h3>Совпадений: {s.hits}</h3>}
            </>
          )}
          {["dice", "coinflip", "limbo", "cases"].includes(g.id) && (
            <>
              <span className="stage-label">{g.name.toUpperCase()}</span>
              <motion.div
                key={round?.id}
                className={
                  "result-symbol " + (g.id === "coinflip" ? "coin-result" : "")
                }
                initial={{ scale: 0.7, rotateY: g.id === "coinflip" ? 720 : 0 }}
                animate={{ scale: 1, rotateY: 0 }}
                transition={{ duration: effects === "off" ? 0 : 0.8 }}
              >
                {g.id === "dice"
                  ? round
                    ? s.roll.toFixed(2)
                    : "⚄"
                  : g.id === "coinflip"
                    ? round
                      ? s.landed === "heads"
                        ? "N✦"
                        : "◎"
                      : "N✦"
                    : g.id === "limbo"
                      ? round
                        ? `×${s.value}`
                        : "∞"
                      : round
                        ? "💎"
                        : "⬡"}
              </motion.div>
              <h3>
                {g.id === "cases"
                  ? (s.item?.name ?? "Открой свою редкость")
                  : g.id === "coinflip" && round
                    ? s.landed === "heads"
                      ? "Орёл"
                      : "Решка"
                    : g.id === "dice"
                      ? `Меньше ${opts.target}`
                      : g.id === "limbo"
                        ? `Цель ×${opts.target}`
                        : ""}
              </h3>
              {s.item && (
                <span className={"rarity " + s.item.rarity}>
                  {s.item.rarity}
                </span>
              )}
            </>
          )}
          {done && (
            <motion.div
              className={
                "result-banner " +
                (round.result?.payout > round.bet ? "win" : "")
              }
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>
                {round.result?.payout > round.bet
                  ? "Победный импульс!"
                  : round.result?.payout === round.bet
                    ? "Ставка возвращена"
                    : "Раунд завершён"}
              </span>
              <b>{format(round.result?.payout ?? 0)} NC</b>
            </motion.div>
          )}
          {done &&
            round.result?.payout >= round.bet * 5 &&
            round.result?.payout > 0 &&
            effects === "high" && (
              <div className="confetti" aria-hidden="true">
                {Array.from({ length: 28 }, (_, i) => (
                  <i
                    key={`${round.id}-${i}`}
                    style={{
                      left: ((i * 37) % 100) + "%",
                      animationDelay: (i % 7) * 0.1 + "s",
                      background: ["#b28aff", "#f4c86a", "#e364d8"][i % 3],
                    }}
                  />
                ))}
              </div>
            )}
        </section>
      </div>
      {round && (
        <details className="panel fairness">
          <summary>
            <Shield size={16} /> Проверка результата и история раунда{" "}
            <ChevronDown size={15} />
          </summary>
          <p>ID: {round.id}</p>
          <p>
            SHA-256 seed: <code>{round.commitment}</code>
          </p>
          {done && (
            <p>
              Seed: <code>{round.seed}</code>
            </p>
          )}
          <p>Сохранено в базе данных. Закрытие вкладки не удаляет раунд.</p>
        </details>
      )}
    </>
  );
}
function cardPoints(cards: number[]) {
  let sum = cards.reduce((s, c) => s + Math.min((c % 13) + 1, 10), 0);
  if (cards.some((c) => c % 13 === 0) && sum + 10 <= 21) sum += 10;
  return sum;
}
function AccountPage({
  page,
  me,
  navigate,
  refresh,
  run,
  notify,
  play,
  sound,
  setSound,
  effects,
  setEffects,
}: any) {
  const [data, setData] = useState<any>(null),
    [q, setQ] = useState(""),
    [promo, setPromo] = useState(""),
    [category, setCategory] = useState("xp"),
    [bio, setBio] = useState(me.profile.bio),
    [avatar, setAvatar] = useState(me.profile.avatar);
  const endpoints: Record<string, string> = {
    rewards: "/rewards",
    shop: "/shop",
    history: "/history",
    friends: "/friends?q=" + encodeURIComponent(q),
    leaderboard: "/leaderboard?category=" + category,
    tournaments: "/tournaments",
    admin: "/admin",
  };
  const load = useCallback(async () => {
    setData(null);
    if (endpoints[page])
      try {
        setData(await api(endpoints[page]));
      } catch (e: any) {
        notify(e.message);
      }
  }, [page, q, category]);
  useEffect(() => {
    load();
  }, [load]);
  async function mutate(path: string, body: any) {
    const r = await run(() => api(path, body));
    if (r) {
      notify("Готово!");
      load();
    }
    return r;
  }
  if (page === "rooms")
    return <RoomPage me={me} refresh={refresh} notify={notify} />;
  if (page === "profile")
    return (
      <>
        <PageTitle eyebrow="ТВОЙ СЛЕД В ГОРОДЕ" title="Профиль игрока" />
        <div
          className="profile-hero panel"
          style={{
            borderColor: me.inventory.find(
              (i: any) => i.equipped && i.item.kind === "frame",
            )?.item.value,
          }}
        >
          <span className="big-avatar">{me.profile.avatar}</span>
          <div>
            <span className="kicker">
              NEON PLAYER ·{" "}
              {me.guest
                ? "ГОСТЬ"
                : "В ГОРОДЕ С " +
                  new Date(me.createdAt).toLocaleDateString("ru-RU")}
            </span>
            <h2>{me.nickname}</h2>
            <p>{me.profile.bio || "Твоя история только начинается"}</p>
            <span className="level-badge">
              Уровень {me.level} · Престиж {me.profile.prestige}
            </span>
          </div>
          <button className="glass-button" onClick={() => navigate("settings")}>
            <Settings size={17} />
            Настроить
          </button>
        </div>
        <div className="profile-links">
          {(
            [
              ["friends", "Друзья"],
              ["rooms", "Комнаты"],
              ["shop", "Магазин"],
              ["leaderboard", "Рейтинги"],
              ["tournaments", "Турниры"],
              ["history", "История"],
              ["help", "Правила"],
              ...(me.role === "ADMIN" ? [["admin", "Администратор"]] : []),
            ] as string[][]
          ).map(([id, label]) => (
            <button
              key={id}
              className="glass-button"
              onClick={() => navigate(id)}
            >
              {label}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
        <div className="stats-grid">
          {[
            ["NEON COINS", format(me.wallet.coins), "NC"],
            ["CRYSTALS", format(me.wallet.crystals), "✧"],
            ["ИГР СЫГРАНО", me.stats.played, "↗"],
            ["ПОЛУЧЕНО XP", format(me.profile.xp), "⚡"],
          ].map(([label, value, symbol]) => (
            <div className="panel stat" key={label}>
              <span className="kicker">{label}</span>
              <b>
                {value}
                <small>{symbol}</small>
              </b>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>До следующего уровня</h3>
          <div className="progress">
            <i style={{ width: ((me.profile.xp % 250) / 250) * 100 + "%" }} />
          </div>
          <p className="muted">
            {me.profile.xp % 250} / 250 XP · Обычная игра +10 XP · Бесплатная
            игра +50 XP
          </p>
        </div>
        <div className="section-heading">
          <h2>Мои достижения</h2>
          <span className="muted">{me.achievements.length} открыто</span>
        </div>
        <div className="reward-grid">
          {me.achievements.map((a: any) => (
            <div className="panel achievement" key={a.achievementId}>
              <span>🏆</span>
              <h3>{a.achievement.title}</h3>
              <p>{a.achievement.description}</p>
              <small>+{a.achievement.crystals} CRYSTALS</small>
            </div>
          ))}
        </div>
        {!me.achievements.length && (
          <Empty text="Заверши первую игру, чтобы открыть достижение" />
        )}
        <h2 className="section-heading">Моя коллекция</h2>
        <div className="shop-grid">
          {me.inventory.map((i: any) => (
            <div className="panel shop-card" key={i.itemId}>
              <span style={{ color: i.item.value }}>
                {i.item.kind === "avatar" ? i.item.value : "◈"}
              </span>
              <h3>{i.item.name}</h3>
              <button
                className="glass-button"
                onClick={() => mutate("/shop/equip", { itemId: i.itemId })}
              >
                Применить
              </button>
            </div>
          ))}
        </div>
        {!me.inventory.length && (
          <button className="glass-button" onClick={() => navigate("shop")}>
            Открыть магазин коллекций <ArrowUpRight size={16} />
          </button>
        )}
      </>
    );
  if (page === "settings")
    return (
      <>
        <PageTitle eyebrow="НА ТВОЕЙ ВОЛНЕ" title="Настройки" />
        <div className="settings-grid">
          <div className="panel">
            <h3>Профиль</h3>
            <label>
              Аватар
              <div className="avatar-options">
                {[
                  "⚡",
                  "🌙",
                  "👾",
                  "🦊",
                  ...me.inventory
                    .filter((i: any) => i.item.kind === "avatar")
                    .map((i: any) => i.item.value),
                ].map((a: string) => (
                  <button
                    key={a}
                    className={avatar === a ? "active" : ""}
                    onClick={() => setAvatar(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </label>
            <label>
              О себе
              <textarea
                maxLength={200}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={() =>
                run(() => api("/profile", { bio, avatar }, "PATCH")).then(
                  (r: any) => r && notify("Профиль сохранён"),
                )
              }
            >
              Сохранить
            </button>
          </div>
          <div className="panel">
            <h3>Звук и эффекты</h3>
            <label className="toggle-row">
              Игровые звуки
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
              />
            </label>
            <label>
              Качество эффектов
              <select
                value={effects}
                onChange={(e) => setEffects(e.target.value)}
              >
                <option value="high">Высокое</option>
                <option value="low">Облегчённый режим</option>
                <option value="off">Отключить анимации</option>
              </select>
            </label>
            <p className="muted">
              Системная настройка уменьшения движения учитывается автоматически.
            </p>
            <button
              className="glass-button"
              onClick={() =>
                run(() =>
                  api("/profile", { settings: { sound, effects } }, "PATCH"),
                ).then((r: any) => r && notify("Настройки сохранены"))
              }
            >
              Сохранить настройки
            </button>
            <div className="side-divider" />
            <button
              className="danger-button"
              onClick={() =>
                run(() => api("/auth/logout", {})).then(() => navigate("home"))
              }
            >
              <LogOut size={16} /> Выйти из аккаунта
            </button>
          </div>
        </div>
      </>
    );
  if (page === "rewards")
    return (
      <>
        <PageTitle
          eyebrow="БОЛЬШЕ НЕОНА КАЖДЫЙ ДЕНЬ"
          title="Твой центр наград"
          subtitle="Получай монеты бесплатно. Никаких покупок за реальные деньги."
        />
        <div className="reward-grid">
          {[
            [
              "daily",
              "Ежедневный заряд",
              "⚡",
              `${format(data?.config?.daily ?? 1000)} NC + 5 ✧`,
            ],
            [
              "weekly",
              "Большой импульс",
              "🎁",
              `${format(data?.config?.weekly ?? 5000)} NC + 20 ✧`,
            ],
            ["wheel", "Колесо дня", "✺", "100–2 500 NC"],
          ].map(([kind, title, icon, reward]) => {
            const claimed = data?.claimed.some((r: any) => r.kind === kind);
            return (
              <div className="panel reward-card" key={kind}>
                <span>{icon}</span>
                <h3>{title}</h3>
                <p>{reward}</p>
                <button
                  className={claimed ? "glass-button" : "primary"}
                  disabled={claimed || !data}
                  onClick={() =>
                    mutate("/rewards/claim", { kind }).then(
                      (r) =>
                        r &&
                        notify(
                          `Получено: ${format(r.coins)} NC и ${r.crystals} ✧`,
                        ),
                    )
                  }
                >
                  {claimed ? (
                    <>
                      <Check size={16} />
                      Получено
                    </>
                  ) : (
                    "Забрать бесплатно"
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="settings-grid">
          <div className="panel">
            <h3>Задания города</h3>
            {data?.quests.map((quest: any) => {
              const progress = data.progress.find(
                (p: any) => p.questId === quest.id,
              );
              return (
                <div className="quest-row" key={quest.id}>
                  <div>
                    <span className="kicker">
                      {quest.period === "daily" ? "НА СЕГОДНЯ" : "НА НЕДЕЛЮ"}
                    </span>
                    <h4>{quest.title}</h4>
                    <div className="progress">
                      <i
                        style={{
                          width:
                            Math.min(
                              100,
                              ((progress?.progress ?? 0) / quest.target) * 100,
                            ) + "%",
                        }}
                      />
                    </div>
                    <small>
                      {progress?.progress ?? 0} / {quest.target} · {quest.coins}{" "}
                      NC
                    </small>
                  </div>
                  <button
                    className="glass-button"
                    disabled={
                      !progress ||
                      progress.progress < quest.target ||
                      progress.claimed
                    }
                    onClick={() =>
                      mutate("/rewards/claim", { kind: "quest", id: quest.id })
                    }
                  >
                    {progress?.claimed ? "✓" : "Забрать"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="panel">
            <h3>Промокод</h3>
            <p className="muted">Подарок от команды проекта</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate("/promo", { code: promo });
              }}
            >
              <input
                required
                maxLength={30}
                placeholder="Введи промокод"
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
              />
              <button className="primary">
                Активировать <Gift size={16} />
              </button>
            </form>
          </div>
        </div>
        <div className="section-heading">
          <h2>Бесплатный NEON PASS</h2>
          <span className="pill">БЕЗ ПЛАТНОЙ ВЕРСИИ</span>
        </div>
        <p className="muted">
          За каждый достигнутый уровень — NC и кристаллы. Игры без ставок тоже
          дают XP.
        </p>
        <div className="pass-track">
          {Array.from(
            { length: Math.min(101, Math.max(6, me.level + 2)) },
            (_, i) => i + 2,
          ).map((n) => (
            <div className="panel pass-step" key={n}>
              <span>LVL {n}</span>
              <Gem size={27} />
              <b>10 ✧ + {n * 100} NC</b>
              <button
                disabled={
                  me.level < n ||
                  data?.claimed.some(
                    (r: any) => r.kind === `level:${me.profile.prestige}:${n}`,
                  )
                }
                className="glass-button"
                onClick={async () => {
                  await mutate("/rewards/claim", {
                    kind: "level",
                    id: String(n),
                  });
                  await mutate("/rewards/claim", {
                    kind: "pass",
                    id: String(n),
                  });
                }}
              >
                Получить
              </button>
            </div>
          ))}
        </div>
        <div className="panel prestige">
          <span>♛</span>
          <div>
            <h3>Перерождение</h3>
            <p>
              На 101 уровне: сброс XP, +500 кристаллов, сохранение баланса и
              коллекции.
            </p>
          </div>
          <button
            className="glass-button"
            disabled={me.level < 101}
            onClick={() => mutate("/rewards/claim", { kind: "prestige" })}
          >
            Престиж {me.profile.prestige + 1}
          </button>
        </div>
        {data?.events.map((e: any) => (
          <div className="panel" key={e.id}>
            <span className="kicker">СЕЗОННОЕ СОБЫТИЕ</span>
            <h3>{e.title}</h3>
            <p>{e.description}</p>
            <button
              className="primary"
              disabled={data.claimed.some(
                (r: any) => r.kind === `event:${e.id}`,
              )}
              onClick={() =>
                mutate("/rewards/claim", { kind: "event", id: e.id })
              }
            >
              Подарок {e.coins} NC
            </button>
          </div>
        ))}
      </>
    );
  if (page === "shop")
    return (
      <>
        <PageTitle
          eyebrow="ТВОЙ СТИЛЬ — ТВОЙ НЕОН"
          title="Коллекция города"
          subtitle="Только кристаллы, заработанные в играх. Никаких реальных денег."
        />
        <div className="shop-grid">
          {data?.map((item: any) => {
            const own = me.inventory.some((i: any) => i.itemId === item.id);
            return (
              <div className="panel shop-card" key={item.id}>
                <div
                  className="cosmetic-art"
                  style={{ "--item-color": item.value } as React.CSSProperties}
                >
                  {item.kind === "avatar" ? item.value : "◈"}
                </div>
                <span className="kicker">
                  {item.kind === "avatar" ? "АВАТАР" : "РАМКА ПРОФИЛЯ"}
                </span>
                <h3>{item.name}</h3>
                <p className="crystal-price">
                  <Gem size={16} />
                  {item.price} CRYSTALS
                </p>
                <button
                  className={own ? "glass-button" : "primary"}
                  onClick={() =>
                    mutate(own ? "/shop/equip" : "/shop/buy", {
                      itemId: item.id,
                    })
                  }
                >
                  {own ? "Применить" : "В коллекцию"}
                </button>
              </div>
            );
          })}
        </div>
      </>
    );
  if (page === "leaderboard")
    return (
      <>
        <PageTitle
          eyebrow="ТЕ, КТО ЗАЖИГАЕТ"
          title="Легенды NEON"
          subtitle="Рейтинг обновляется по сохранённому прогрессу игроков."
        />
        <div className="tabs">
          {[
            ["xp", "Уровень и XP"],
            ["achievements", "Достижения"],
            ["collection", "Коллекция"],
            ["weekly", "Активность недели"],
            ["minigames", "Лучший Memory"],
            ["tournaments", "Победы в турнирах"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={category === id ? "active" : ""}
              onClick={() => setCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="panel leaderboard">
          {data?.map((u: any, i: number) => (
            <div key={u.id} className={u.id === me.id ? "is-me" : ""}>
              <b className={"rank rank-" + i}>
                {i < 3 ? ["♛", "♜", "♟"][i] : i + 1}
              </b>
              <span className="avatar">{u.avatar}</span>
              <b>
                {u.nickname}
                {u.id === me.id ? " · ты" : ""}
              </b>
              <strong>
                {format(u.score)}
                <small> {category === "xp" ? "XP" : "очков"}</small>
              </strong>
            </div>
          ))}
          {data?.length === 0 && <Empty text="Рейтинг ждёт первых игроков" />}
        </div>
      </>
    );
  if (page === "friends")
    return (
      <>
        <PageTitle
          eyebrow="ВМЕСТЕ ЯРЧЕ"
          title="Твои люди"
          subtitle="Найди друзей по никнейму и пригласи в свой игровой вечер."
        />
        <label className="search large-search">
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по никнейму"
          />
        </label>
        <div className="friends-grid">
          {data?.players
            .filter((p: any) => p.id !== me.id)
            .map((p: any) => {
              const f = data.friends.find(
                (f: any) => f.senderId === p.id || f.receiverId === p.id,
              );
              return (
                <div className="panel friend-card" key={p.id}>
                  <span className="avatar">{p.profile.avatar}</span>
                  <div>
                    <h3>{p.nickname}</h3>
                    <p>
                      <span className={p.online ? "green-dot" : "amber-dot"} />{" "}
                      {p.online ? "В сети" : "Не в сети"} · Уровень{" "}
                      {1 + Math.floor(p.profile.xp / 250)}
                    </p>
                  </div>
                  {!f ? (
                    <button
                      className="glass-button"
                      onClick={() =>
                        mutate("/friends", { userId: p.id, action: "request" })
                      }
                    >
                      <Plus size={16} />
                    </button>
                  ) : f.status === "ACCEPTED" ? (
                    <button
                      className="glass-button"
                      onClick={() =>
                        mutate("/friends", { userId: p.id, action: "remove" })
                      }
                    >
                      Удалить
                    </button>
                  ) : f.receiverId === me.id ? (
                    <button
                      className="primary"
                      onClick={() =>
                        mutate("/friends", { userId: p.id, action: "accept" })
                      }
                    >
                      Принять
                    </button>
                  ) : (
                    <button
                      className="glass-button"
                      onClick={() =>
                        mutate("/friends", { userId: p.id, action: "remove" })
                      }
                    >
                      Отменить
                    </button>
                  )}
                </div>
              );
            })}
        </div>
        {data && !data.players.length && (
          <Empty
            text={q ? "Игроки не найдены" : "Найди первого друга по никнейму"}
          />
        )}
        <div className="panel invite-panel">
          <h3>Поделись своим неоном</h3>
          <p>
            Друг завершит 5 игр — ты получишь эксклюзивную рамку «Связь неона».
            Для приглашения в матч используй код комнаты.
          </p>
          <button
            className="primary"
            onClick={async () => {
              await navigator.clipboard.writeText(
                location.origin + "?ref=" + me.id,
              );
              notify("Ссылка скопирована");
            }}
          >
            Копировать ссылку <Copy size={16} />
          </button>
        </div>
      </>
    );
  if (page === "history")
    return (
      <>
        <PageTitle
          eyebrow="КАЖДЫЙ ИМПУЛЬС СОХРАНЁН"
          title="История и операции"
        />
        <div className="panel table-panel">
          <h3>Игровые раунды</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Игра</th>
                  <th>Дата</th>
                  <th>Ставка</th>
                  <th>Выплата</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data?.games.map((g: any) => (
                  <tr key={g.id}>
                    <td>{games.find((i) => i.id === g.game)?.name}</td>
                    <td>{new Date(g.createdAt).toLocaleString("ru-RU")}</td>
                    <td>{format(g.bet)} NC</td>
                    <td>{format(g.result?.payout ?? 0)} NC</td>
                    <td>
                      {g.status === "ACTIVE" ? (
                        <button
                          className="text-button"
                          onClick={() =>
                            play(games.find((i) => i.id === g.game))
                          }
                        >
                          Продолжить →
                        </button>
                      ) : (
                        "Завершён"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.games.length === 0 && (
            <Empty text="Твоя первая игра ещё впереди" />
          )}
        </div>
        <div className="panel table-panel">
          <h3>Журнал кошелька</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Операция</th>
                  <th>NC</th>
                  <th>✧</th>
                  <th>Баланс после</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {data?.transactions.map((t: any) => (
                  <tr key={t.id}>
                    <td>{t.reason}</td>
                    <td className={t.coins > 0 ? "positive" : ""}>
                      {t.coins > 0 ? "+" : ""}
                      {format(t.coins)}
                    </td>
                    <td>{t.crystals}</td>
                    <td>{format(t.balanceAfter)}</td>
                    <td>{new Date(t.createdAt).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  if (page === "tournaments")
    return (
      <>
        <PageTitle
          eyebrow="СОБЕРИ СВОЙ ИМПУЛЬС"
          title="Турниры города"
          subtitle="Бесплатное участие. Рейтинг по XP; игры без ставок дают больше очков."
        />
        {data?.map((t: any) => (
          <div className="panel tournament" key={t.id}>
            <Trophy size={36} />
            <div>
              <h2>{t.title}</h2>
              <p>
                {new Date(t.startsAt).toLocaleString("ru-RU")} —{" "}
                {new Date(t.endsAt).toLocaleString("ru-RU")}
              </p>
              <p>
                Награда победителю: {t.reward} CRYSTALS · Участников:{" "}
                {t.participants.length}
              </p>
            </div>
            <button
              disabled={
                t.settled ||
                Date.now() > new Date(t.endsAt).getTime() ||
                t.participants.some((p: any) => p.userId === me.id)
              }
              className="primary"
              onClick={() => mutate(`/tournaments/${t.id}/join`, {})}
            >
              {t.settled
                ? "Завершён"
                : t.participants.some((p: any) => p.userId === me.id)
                  ? "Ты участвуешь"
                  : "Участвовать"}
            </button>
            <ol>
              {t.participants.map((p: any) => (
                <li key={p.userId}>
                  {p.user.nickname} · {p.score} XP
                </li>
              ))}
            </ol>
          </div>
        ))}
        {data?.length === 0 && (
          <Empty text="Следующий турнир появится после объявления администратора" />
        )}
      </>
    );
  if (page === "admin") return <AdminPage data={data} mutate={mutate} />;
  return data ? null : (
    <div className="loading">
      <span>✦</span>Подключаемся к NEON…
    </div>
  );
}
function AdminPage({ data, mutate }: any) {
  const [action, setAction] = useState("credit"),
    [fields, setFields] = useState<any>({
      userId: "",
      coins: 1000,
      crystals: 25,
      limit: 100,
      code: "NEON2026",
      daily: 1000,
      weekly: 5000,
      minBet: 10,
      maxBet: 10000,
      title: "Neon Nights",
      description: "Бесплатный подарок участникам события",
      reward: 100,
      startsAt: new Date().toISOString().slice(0, 16),
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
      banned: true,
    });
  const names: Record<string, string[]> = {
    credit: ["userId", "coins"],
    ban: ["userId", "banned"],
    config: ["daily", "weekly", "minBet", "maxBet"],
    promo: ["code", "coins", "crystals", "limit", "endsAt"],
    event: ["title", "description", "coins", "startsAt", "endsAt"],
    tournament: ["title", "reward", "startsAt", "endsAt"],
  };
  const labels: Record<string, string> = {
    userId: "Игрок",
    coins: "NEON COINS",
    crystals: "CRYSTALS",
    limit: "Лимит активаций",
    code: "Промокод",
    daily: "Daily NC",
    weekly: "Weekly NC",
    minBet: "Минимальная ставка",
    maxBet: "Максимальная ставка",
    title: "Название",
    description: "Описание",
    reward: "Награда CRYSTALS",
    startsAt: "Начало",
    endsAt: "Окончание",
    banned: "Заблокировать",
  };
  return (
    <>
      <PageTitle
        eyebrow="ДОСТУП АДМИНИСТРАТОРА"
        title="Пульт управления"
        subtitle="Все изменения записываются в журнал администратора."
      />
      <div className="stats-grid">
        {Object.entries(data?.stats ?? {}).map(([n, v]: any) => (
          <div className="panel stat" key={n}>
            <span>{n}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Действие</h3>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {[
            ["credit", "Начисление NC"],
            ["ban", "Блокировка"],
            ["config", "Экономика"],
            ["promo", "Создать промокод"],
            ["event", "Создать событие"],
            ["tournament", "Создать турнир"],
          ].map(([v, n]) => (
            <option value={v} key={v}>
              {n}
            </option>
          ))}
        </select>
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const body: any = { action };
            for (const f of names[action]) {
              if (f === "startsAt" || f === "endsAt")
                body[action === "promo" ? "expiresAt" : f] = new Date(
                  fields[f],
                ).toISOString();
              else body[f] = fields[f];
            }
            if (action === "credit") body.key = key();
            mutate("/admin", body);
          }}
        >
          {names[action].map((f) => (
            <label key={f}>
              {labels[f]}
              {f === "userId" ? (
                <select
                  required
                  value={fields[f]}
                  onChange={(e) =>
                    setFields({ ...fields, [f]: e.target.value })
                  }
                >
                  <option value="">Выбери игрока</option>
                  {data?.users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.nickname}
                    </option>
                  ))}
                </select>
              ) : f === "banned" ? (
                <input
                  type="checkbox"
                  checked={fields[f]}
                  onChange={(e) =>
                    setFields({ ...fields, [f]: e.target.checked })
                  }
                />
              ) : (
                <input
                  required
                  type={
                    f.endsWith("At")
                      ? "datetime-local"
                      : typeof fields[f] === "number"
                        ? "number"
                        : "text"
                  }
                  value={fields[f]}
                  onChange={(e) =>
                    setFields({
                      ...fields,
                      [f]:
                        typeof fields[f] === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </label>
          ))}
          <button className="primary">Применить</button>
        </form>
      </div>
      <div className="panel table-panel">
        <h3>Пользователи</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Никнейм</th>
                <th>NC</th>
                <th>✧</th>
                <th>Роль</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u: any) => (
                <tr key={u.id}>
                  <td>{u.nickname}</td>
                  <td>{format(u.wallet?.coins)}</td>
                  <td>{format(u.wallet?.crystals)}</td>
                  <td>{u.role}</td>
                  <td>
                    {u.banned ? "Заблокирован" : u.guest ? "Гость" : "Активен"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel table-panel">
        <h3>Журнал действий</h3>
        {data?.actions.map((a: any) => (
          <details key={a.id}>
            <summary>
              {a.action} · {new Date(a.createdAt).toLocaleString("ru-RU")}
            </summary>
            <pre>{JSON.stringify(a.details, null, 2)}</pre>
          </details>
        ))}
      </div>
      <div className="panel table-panel">
        <h3>Последние операции · мониторинг</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Причина</th>
                <th>Игрок</th>
                <th>NC</th>
                <th>Баланс</th>
              </tr>
            </thead>
            <tbody>
              {data?.transactions.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.reason}</td>
                  <td>
                    {data.users.find((u: any) => u.id === t.userId)?.nickname ??
                      t.userId}
                  </td>
                  <td>{t.coins}</td>
                  <td>{t.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
function RoomPage({ me, refresh, notify }: any) {
  const [socket, setSocket] = useState<Socket | null>(null),
    [connected, setConnected] = useState(false),
    [room, setRoom] = useState<any>(null),
    [rooms, setRooms] = useState<any[]>([]),
    [code, setCode] = useState(""),
    [game, setGame] = useState("battle"),
    [bet, setBet] = useState(100),
    [hold, setHold] = useState<number[]>([]),
    [friends, setFriends] = useState<any[]>([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const s = io({ autoConnect: true, reconnection: true });
    setSocket(s);
    s.on("connect", () => {
      setConnected(true);
      s.emit("rooms", {}, (r: any) => r.rooms && setRooms(r.rooms));
      const last = sessionStorage.getItem("room");
      if (last)
        s.emit("sync", { code: last }, (r: any) => {
          if (r.error) sessionStorage.removeItem("room");
        });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (e) => notify(e.message));
    s.on("room", (r) => {
      setRoom(r);
      sessionStorage.setItem("room", r.code);
      refresh();
    });
    api("/friends")
      .then((r) =>
        setFriends(
          r.players.filter((p: any) =>
            r.friends.some(
              (f: any) =>
                f.status === "ACCEPTED" &&
                (f.senderId === p.id || f.receiverId === p.id),
            ),
          ),
        ),
      )
      .catch(() => {});
    return () => {
      s.disconnect();
    };
  }, []);
  function send(event: string, data: any) {
    if (!socket || !connected) {
      notify("Соединение восстанавливается");
      return;
    }
    setBusy(true);
    socket.timeout(10000).emit(event, data, (err: any, r: any) => {
      setBusy(false);
      if (err)
        notify("Ответ задерживается. Комната сохранена; переподключитесь.");
      else if (r.error) notify(r.error);
      else {
        if (r.code) setCode(r.code);
        socket.emit("rooms", {}, (r: any) => r.rooms && setRooms(r.rooms));
        refresh();
      }
    });
  }
  const s = room?.state ?? {};
  return (
    <>
      <PageTitle
        eyebrow="ВМЕСТЕ ЯРЧЕ"
        title="Игровые комнаты"
        subtitle="Настоящие игроки. Приватный код. Общий банк без комиссии."
      />
      <div className="connection">
        <span className={connected ? "green-dot" : "amber-dot"} />
        {connected ? "Соединение установлено" : "Переподключение…"}
      </div>
      <div className="settings-grid">
        <div className="panel">
          <h3>Создать свой вечер</h3>
          <label>
            Режим
            <select value={game} onChange={(e) => setGame(e.target.value)}>
              <option value="battle">Battle · случайный бросок</option>
              <option value="jackpot">Jackpot · общий банк</option>
              <option value="poker">Draw Poker · обмен карт</option>
            </select>
          </label>
          <label>
            Ставка каждого игрока · NC
            <input
              type="number"
              min={10}
              max={1000}
              value={bet}
              onChange={(e) => setBet(+e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !connected}
            onClick={() => send("create", { game, bet })}
          >
            Создать комнату <Plus size={17} />
          </button>
        </div>
        <div className="panel">
          <h3>У тебя есть приглашение?</h3>
          <label>
            Код комнаты
            <input
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2C3D4"
            />
          </label>
          <button
            className="glass-button"
            disabled={busy || !connected || code.length !== 8}
            onClick={() => send("join", { code })}
          >
            Присоединиться <ArrowUpRight size={16} />
          </button>
          <p className="muted">
            Код остаётся доступен после перезапуска. Участники могут вернуться в
            активную партию.
          </p>
        </div>
      </div>
      {room && (
        <div className="panel room-panel">
          <div className="section-heading">
            <div>
              <span className="kicker">
                {room.game.toUpperCase()} · {room.status}
              </span>
              <h2>Комната {room.code}</h2>
            </div>
            <button
              className="glass-button"
              onClick={async () => {
                await navigator.clipboard.writeText(room.code);
                notify("Код скопирован");
              }}
            >
              <Copy size={16} />
              Код
            </button>
          </div>
          <p className="muted">
            Ставка {s.bet} NC · Банк {s.bank ?? s.bet * room.members.length} NC
            · 2–6 игроков
          </p>
          <div className="room-members">
            {room.members.map((m: any) => (
              <div
                key={m.userId}
                className={
                  "room-member " +
                  (s.winners?.includes(m.userId) ? "winner" : "")
                }
              >
                <span className="big-avatar">{m.avatar}</span>
                <h3>{m.nickname}</h3>
                <small>
                  <span className={m.online ? "green-dot" : "amber-dot"} />
                  {m.online ? "В сети" : "Не в сети"}
                </small>
                {s.rolls && <b>{format(s.rolls[m.userId])}</b>}
                {room.status === "DONE" && !s.cancelled && (
                  <strong>{format(s.payouts?.[m.userId] ?? 0)} NC</strong>
                )}
                {s.hands?.[m.userId]?.length > 0 && (
                  <div className="hand room-hand">
                    {s.hands[m.userId].map((c: number, i: number) => (
                      <Card key={i} card={c} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {room.status === "WAITING" && (
            <>
              <div className="inline-actions">
                {room.ownerId === me.id && (
                  <button
                    className="primary"
                    disabled={busy || room.members.length < 2}
                    onClick={() => send("start", { code: room.code })}
                  >
                    Начать игру
                  </button>
                )}
                <button
                  className="glass-button"
                  disabled={busy}
                  onClick={() => {
                    send("leave", { code: room.code });
                    sessionStorage.removeItem("room");
                    setRoom(null);
                  }}
                >
                  {room.ownerId === me.id ? "Закрыть комнату" : "Выйти"}
                </button>
              </div>
              {friends.length > 0 && (
                <div className="invite-friends">
                  <p>Пригласить друга</p>
                  {friends.map((f) => (
                    <button
                      className="glass-button"
                      key={f.id}
                      onClick={() =>
                        send("invite", { code: room.code, userId: f.id })
                      }
                    >
                      {f.profile.avatar} {f.nickname} <Plus size={14} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {room.game === "poker" && room.status === "PLAYING" && (
            <>
              <p>
                Отметь карты, которые оставишь. Один обмен. На ход — 120 секунд,
                затем текущие карты сохраняются.
              </p>
              <div className="hand">
                {s.hands?.[me.id]?.map((c: number, i: number) => (
                  <Card
                    key={i}
                    card={c}
                    selected={hold.includes(i)}
                    onClick={
                      s.drawn?.includes(me.id)
                        ? undefined
                        : () =>
                            setHold((h) =>
                              h.includes(i)
                                ? h.filter((n) => n !== i)
                                : [...h, i],
                            )
                    }
                  />
                ))}
              </div>
              <button
                className="primary"
                disabled={busy || s.drawn?.includes(me.id)}
                onClick={() => send("draw", { code: room.code, hold })}
              >
                {s.drawn?.includes(me.id)
                  ? "Ожидаем остальных"
                  : "Обменять карты"}
              </button>
            </>
          )}
          {room.status === "DONE" && (
            <div className="room-result">
              <Trophy />
              <h2>
                {s.cancelled
                  ? "Комната закрыта"
                  : s.winners?.includes(me.id)
                    ? "Твой победный импульс!"
                    : "Матч завершён"}
              </h2>
              <p>
                {s.cancelled
                  ? "Ставки не списывались"
                  : `Победители: ${room.members
                      .filter((m: any) => s.winners?.includes(m.userId))
                      .map((m: any) => m.nickname)
                      .join(", ")}`}
              </p>
              {s.seed && (
                <details>
                  <summary>Проверка seed</summary>
                  <code>{s.seed}</code>
                </details>
              )}
            </div>
          )}
        </div>
      )}
      <div className="panel">
        <h3>Мои комнаты и история матчей</h3>
        {rooms.map((r) => (
          <button
            className="room-history"
            key={r.code}
            onClick={() => send("join", { code: r.code })}
          >
            <b>{r.code}</b>
            <span>{r.game}</span>
            <span>{r.status}</span>
            <ArrowUpRight size={17} />
          </button>
        ))}
        {!rooms.length && (
          <p className="muted">Создай комнату и отправь код друзьям.</p>
        )}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
