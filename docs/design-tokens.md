# Design Tokens

Quelle im Code:
- `src/styles/tokens.css`
- `src/styles/themes/light.css`
- `src/styles/themes/dark.css`

Hinweis:
- Aktuell werden Tokens nur teilweise in Komponenten verwendet.
- Viele Komponenten nutzen direkte Tailwind-Klassen.
- Zielbild: neue Designarbeit möglichst token-basiert erweitern.

## 1) Core Tokens (`:root` in `tokens.css`)

## Farben

| Token | Wert | Zweck |
|---|---|---|
| `--color-bg` | `#f9fafb` | Seitenhintergrund (light) |
| `--color-surface` | `#ffffff` | Cards/Container (light) |
| `--color-text` | `#1f2937` | Primärer Text (light) |
| `--color-text-muted` | `#6b7280` | Sekundärer Text |
| `--color-border` | `#d1d5db` | Standard-Rand |
| `--color-primary` | `#2563eb` | Primärfarbe |
| `--color-primary-contrast` | `#ffffff` | Text auf Primärfarbe |
| `--color-success` | `#16a34a` | Erfolg |
| `--color-warning` | `#d97706` | Warnung |
| `--color-danger` | `#dc2626` | Fehler/Destruktiv |

## Radius

| Token | Wert |
|---|---|
| `--radius-sm` | `0.375rem` |
| `--radius-md` | `0.5rem` |
| `--radius-lg` | `0.75rem` |

## Schatten

| Token | Wert |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.05)` |
| `--shadow-md` | `0 4px 6px rgba(0, 0, 0, 0.1)` |
| `--shadow-lg` | `0 10px 15px rgba(0, 0, 0, 0.1)` |

## Spacing

| Token | Wert |
|---|---|
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |

## 2) Theme-Tokens

## Light Theme

Definiert in `src/styles/themes/light.css`.

| Theme Token | Mapping |
|---|---|
| `--theme-bg` | `var(--color-bg)` |
| `--theme-surface` | `var(--color-surface)` |
| `--theme-text` | `var(--color-text)` |
| `--theme-text-muted` | `var(--color-text-muted)` |
| `--theme-border` | `var(--color-border)` |

Selektoren:
- `:root`
- `html[data-theme="light"]`

## Dark Theme

Definiert in `src/styles/themes/dark.css`.

| Theme Token | Wert |
|---|---|
| `--theme-bg` | `#111827` |
| `--theme-surface` | `#1f2937` |
| `--theme-text` | `#f3f4f6` |
| `--theme-text-muted` | `#d1d5db` |
| `--theme-border` | `#374151` |

Selektoren:
- `html.dark`
- `html[data-theme="dark"]`

## 3) Aktivierung von Darkmode

- Hook: `src/hooks/useDarkMode.js`
- Persistenz: `localStorage.darkMode` (`"true"`/`"false"`)
- Mechanik: `document.documentElement.classList.toggle("dark", next)`

Tailwind:
- `darkMode: 'class'` in `tailwind.config.cjs`

## 4) Breakpoints

Zusätzliche Screens in `tailwind.config.cjs`:

| Name | Breite |
|---|---|
| `tablet` | `768px` |
| `laptop` | `1024px` |
| `desktop` | `1280px` |

Zusätzlich bleiben die Standard-Tailwind-Breakpoints nutzbar (`sm`, `md`, `lg`, `xl`, `2xl`).

## 5) Aktuelle Lücke (wichtig)

Obwohl Tokens vorhanden sind, basiert die Mehrheit der Komponenten noch auf direkten Tailwind-Farbklassen.

Empfehlung für neue Designarbeit:
1. Neue visuelle Regeln zuerst als Token ergänzen.
2. Dann Komponenten schrittweise auf diese Token mappen.
3. Keine Big-Bang-Migration; inkrementell pro Feature.

## 6) Vorgehen beim Hinzufügen neuer Tokens

1. Token in `src/styles/tokens.css` ergänzen.
2. Falls theme-abhängig, Mapping in `light.css` und `dark.css` erweitern.
3. Mindestens eine Referenzkomponente anpassen.
4. Dokumentation hier aktualisieren.
5. `npm run lint` und `npm run build` ausführen.
