import type { AppMode } from './appTypes'

type AppHeaderProps = {
  appMode: AppMode
  onModeChange: (mode: AppMode) => void
}

export function AppHeader({ appMode, onModeChange }: AppHeaderProps) {
  return (
    <header className="app-header">
      <p className="app-eyebrow">Ocarina tab generator</p>
      <div className="app-mode-toggle" role="group" aria-label="App mode">
        <button
          aria-pressed={appMode === 'import'}
          onClick={() => onModeChange('import')}
          type="button"
        >
          Import
        </button>
        <button
          aria-pressed={appMode === 'composer'}
          onClick={() => onModeChange('composer')}
          type="button"
        >
          Composer
        </button>
      </div>
    </header>
  )
}
