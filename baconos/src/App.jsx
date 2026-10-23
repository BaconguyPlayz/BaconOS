import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const titleLetters = Array.from('Welcome to BaconOS')

const triangles = [
  { left: '7%', top: '16%', size: 88, delay: '-2.2s', duration: '8.5s', rotate: '12deg' },
  { left: '18%', top: '69%', size: 56, delay: '-5.8s', duration: '11s', rotate: '45deg' },
  { left: '28%', top: '11%', size: 38, delay: '-1.4s', duration: '9.8s', rotate: '-18deg' },
  { left: '39%', top: '74%', size: 112, delay: '-4.6s', duration: '12.6s', rotate: '31deg' },
  { left: '56%', top: '11%', size: 72, delay: '-6.5s', duration: '10.5s', rotate: '-28deg' },
  { left: '68%', top: '66%', size: 43, delay: '-3.7s', duration: '9.1s', rotate: '15deg' },
  { left: '82%', top: '15%', size: 108, delay: '-7.2s', duration: '13s', rotate: '-10deg' },
  { left: '90%', top: '70%', size: 61, delay: '-1s', duration: '8.8s', rotate: '53deg' },
  { left: '48%', top: '24%', size: 29, delay: '-8.1s', duration: '10.3s', rotate: '20deg' },
]

// Future pin/unpin controls will update this collection; the taskbar sizes itself from its contents.
const pinnedApps = [
  { id: 'test', label: 'Test', contentType: 'test' },
  { id: 'settings', label: 'Settings', contentType: 'settings' },
]
const desktopApps = [
  { id: 'test', label: 'Test', contentType: 'test' },
  { id: 'settings', label: 'Settings', contentType: 'settings' },
]
const desktopGrid = {
  minimumCellWidth: 94,
  minimumCellHeight: 94,
  maximumCellHeight: 114,
  maximumIconWidth: 84,
  minimumIconWidth: 64,
  taskbarClearance: 112,
}
const defaultDesktopSlots = {
  test: { column: 0, row: 0 },
  settings: { column: 0, row: 1 },
}
const defaultDisplaySettings = {
  brightness: 88,
  nightLightEnabled: false,
  nightLightStrength: 35,
  showDesktopIcons: true,
  wallpaperFit: 'cover',
}
const defaultAppearanceSettings = {
  theme: 'dark',
  surfaceStyle: 'smoky',
  taskbarLayout: 'centered',
  windowControls: 'dots',
  accentColor: '#a578ec',
  loadingWallpaperCustomized: false,
  wallpapers: {
    lock: 'mountain',
    desktop: 'mountain',
    loading: 'color:#000000',
  },
}
const wallpaperOptions = [
  { id: 'mountain', label: 'Mountain', src: '/assets/baconos-mountain-wallpaper.jpg' },
  { id: 'violet-peak', label: 'Violet Peak', src: '/assets/baconos-violet-peak.webp' },
  { id: 'frutiger-aero', label: 'Frutiger Aero', src: '/assets/baconos-frutiger-aero.webp' },
]
const fallbackWallpaperForTarget = { lock: 'mountain', desktop: 'mountain', loading: 'color:#000000' }
const getWallpaperAsset = (wallpaperId, customWallpapers = {}) => {
  if (typeof wallpaperId === 'string' && wallpaperId.startsWith('custom:')) {
    const target = wallpaperId.slice('custom:'.length)
    return customWallpapers[target] || getWallpaperAsset(fallbackWallpaperForTarget[target] || 'mountain')
  }
  if (typeof wallpaperId === 'string' && wallpaperId.startsWith('color:')) {
    return { type: 'color', color: wallpaperId.slice('color:'.length) || '#000000' }
  }
  const legacySolidColors = { black: '#000000', plum: '#2b173b', navy: '#101a35' }
  if (legacySolidColors[wallpaperId]) return { type: 'color', color: legacySolidColors[wallpaperId] }

  const wallpaper = wallpaperOptions.find((option) => option.id === wallpaperId) || wallpaperOptions[0]
  return { type: 'image', src: wallpaper.src }
}
const getWallpaperSource = (wallpaperId) => {
  const wallpaper = getWallpaperAsset(wallpaperId)
  if (wallpaper.type === 'image') return wallpaper.src
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" preserveAspectRatio="none"><rect width="16" height="9" fill="${wallpaper.color}"/></svg>`)}`
}

const getAccentRgb = (hexColor) => {
  const normalized = String(hexColor || '').replace('#', '')
  const expanded = normalized.length === 3 ? normalized.split('').map((character) => `${character}${character}`).join('') : normalized
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return '165, 120, 236'
  return `${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(expanded.slice(2, 4), 16)}, ${Number.parseInt(expanded.slice(4, 6), 16)}`
}

function WallpaperVisual({ className, wallpaperId, customWallpapers, alt = '' }) {
  const wallpaper = getWallpaperAsset(wallpaperId, customWallpapers)
  if (wallpaper.type === 'video') {
    return <video className={className} src={wallpaper.src} autoPlay muted loop playsInline aria-label={alt || undefined} />
  }
  if (wallpaper.type === 'color') {
    return <span className={className} style={{ backgroundColor: wallpaper.color }} role={alt ? 'img' : undefined} aria-label={alt || undefined} />
  }
  return <img className={className} src={wallpaper.src} alt={alt} draggable="false" />
}

const customWallpaperDatabaseName = 'baconos-custom-wallpapers-v1'
const openCustomWallpaperDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB is unavailable'))
    return
  }
  const request = window.indexedDB.open(customWallpaperDatabaseName, 1)
  request.onupgradeneeded = () => request.result.createObjectStore('wallpapers')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const readCustomWallpaper = async (target) => {
  const database = await openCustomWallpaperDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction('wallpapers', 'readonly').objectStore('wallpapers').get(target)
    request.onsuccess = () => { database.close(); resolve(request.result || null) }
    request.onerror = () => { database.close(); reject(request.error) }
  })
}

const saveCustomWallpaper = async (target, file) => {
  const database = await openCustomWallpaperDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction('wallpapers', 'readwrite').objectStore('wallpapers').put(file, target)
    request.onsuccess = () => { database.close(); resolve() }
    request.onerror = () => { database.close(); reject(request.error) }
  })
}

function calculateDesktopGridMetrics(bounds) {
  const width = Math.max(1, Math.round(bounds?.width || window.innerWidth))
  const height = Math.max(1, Math.round(bounds?.height || window.innerHeight))
  const paddingX = Math.max(10, Math.min(22, Math.round(width * .025)))
  const paddingY = Math.max(10, Math.min(22, Math.round(height * .022)))
  const availableWidth = Math.max(1, width - (paddingX * 2))
  const columnCount = Math.max(1, Math.floor(availableWidth / desktopGrid.minimumCellWidth))
  const cellWidth = availableWidth / columnCount
  const cellHeight = Math.max(desktopGrid.minimumCellHeight, Math.min(desktopGrid.maximumCellHeight, Math.round(cellWidth * .94)))
  const iconWidth = Math.min(desktopGrid.maximumIconWidth, Math.max(desktopGrid.minimumIconWidth, Math.round(cellWidth - 18)))
  const iconHeight = Math.min(94, Math.max(76, cellHeight - 8))
  const maxRow = Math.max(0, Math.floor((height - paddingY - desktopGrid.taskbarClearance - iconHeight) / cellHeight))

  return {
    paddingX,
    paddingY,
    cellWidth,
    cellHeight,
    iconWidth,
    iconHeight,
    maxColumn: columnCount - 1,
    maxRow,
  }
}

const resizeDirections = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

function FpsCounter({ enabled }) {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined

    let frameId = null
    let frameCount = 0
    let sampleStart = performance.now()

    const measure = (now) => {
      frameCount += 1
      const elapsed = now - sampleStart

      // Update the UI a few times per second instead of on every frame.
      if (elapsed >= 400) {
        setFps(Math.round((frameCount * 1000) / elapsed))
        frameCount = 0
        sampleStart = now
      }

      frameId = window.requestAnimationFrame(measure)
    }

    frameId = window.requestAnimationFrame(measure)
    return () => window.cancelAnimationFrame(frameId)
  }, [enabled])

  if (!enabled) return null

  return <output className="fps-counter" aria-label={`Frames per second: ${fps}`}>FPS {fps || '—'}</output>
}

function NotificationToast({ notification, onDismiss }) {
  if (!notification) return null

  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(notification.createdAt))

  return (
    <aside className="notification-toast" role="status" aria-live="polite">
      <span className="notification-toast-icon" aria-hidden="true">●</span>
      <div className="notification-toast-copy">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
        <small>{time}</small>
      </div>
      <button className="notification-toast-dismiss" type="button" onClick={onDismiss} aria-label="Hide notification popup">×</button>
    </aside>
  )
}

function SettingsGlyph({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.1 3.1h3.8l.7 2.2c.5.2.9.5 1.3.8l2.2-.5 1.9 3.3-1.6 1.6c.1.5.1 1 0 1.5l1.6 1.6-1.9 3.3-2.2-.5c-.4.3-.8.6-1.3.8l-.7 2.2h-3.8l-.7-2.2c-.5-.2-.9-.5-1.3-.8l-2.2.5-1.9-3.3 1.6-1.6a6 6 0 0 1 0-1.5L4.6 8.9l1.9-3.3 2.2.5c.4-.3.8-.6 1.3-.8l.1-2.2Z" />
      <circle cx="12" cy="11.3" r="2.7" />
    </svg>
  )
}

function SettingsToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className={`display-setting-row ${disabled ? 'display-setting-row--disabled' : ''}`}>
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <button
        className={`settings-toggle ${checked ? 'settings-toggle--on' : ''}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  )
}

function WallpaperPicker({ target, label, value, onChange, onFileSelect }) {
  const selectedColor = typeof value === 'string' && value.startsWith('color:') ? value.slice('color:'.length) : '#000000'
  const isCustomFile = value === `custom:${target}`

  return (
    <div className="wallpaper-picker">
      <div className="wallpaper-picker-heading">
        <strong>{label}</strong>
        <small>Choose an included wallpaper, a solid color, or your own image/video file.</small>
      </div>
      <div className="wallpaper-option-list">
        {wallpaperOptions.map((wallpaper) => (
          <button
            className={`wallpaper-option ${value === wallpaper.id ? 'wallpaper-option--active' : ''}`}
            key={wallpaper.id}
            type="button"
            aria-pressed={value === wallpaper.id}
            onClick={() => onChange(wallpaper.id)}
          >
            <span className="wallpaper-option-preview" style={{ backgroundImage: `url("${getWallpaperSource(wallpaper.id)}")` }} aria-hidden="true" />
            <span>{wallpaper.label}</span>
          </button>
        ))}
      </div>
      <div className="wallpaper-custom-controls">
        <label className={`wallpaper-color-control ${typeof value === 'string' && value.startsWith('color:') ? 'wallpaper-color-control--active' : ''}`}>
          <input type="color" value={selectedColor} onChange={(event) => onChange(`color:${event.target.value}`)} aria-label={`${label} solid color`} />
          <span>Solid color</span>
        </label>
        <label className={`wallpaper-file-control ${isCustomFile ? 'wallpaper-file-control--active' : ''}`}>
          <input type="file" accept="image/*,video/mp4" onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFileSelect(file)
            event.target.value = ''
          }} />
          <span>{isCustomFile ? 'Custom file active' : 'Choose image or MP4'}</span>
        </label>
      </div>
    </div>
  )
}

function DisplaySettingsPanel({ displaySettings, onUpdateDisplaySettings }) {
  const setDisplaySetting = (changes) => onUpdateDisplaySettings(changes)

  return (
    <>
      <header className="settings-main-header">
        <div className="settings-device-mark"><span className="display-header-glyph" aria-hidden="true">▭</span></div>
        <div>
          <h1>Display</h1>
          <p>Brightness, color, wallpaper fit and desktop visibility.</p>
        </div>
      </header>

      <section className="display-preview-section" aria-label="Your display">
        <div className="display-preview-header">
          <div>
            <strong>Your display</strong>
            <small>BaconOS adapts its desktop grid to this screen size.</small>
          </div>
          <span>Display 1</span>
        </div>
        <div className="display-arrangement">
          <span className="display-monitor display-monitor--active" aria-label="Primary display 1">
            <span>1</span>
            <small>Primary display</small>
          </span>
        </div>
      </section>

      <section className="display-settings-group" aria-label="Brightness and color">
        <div className="display-group-heading"><h2>Brightness & color</h2><span>Display 1</span></div>
        <label className="display-range-row">
          <span><strong>Brightness</strong><small>Adjust the brightness for the entire BaconOS display.</small></span>
          <output>{displaySettings.brightness}%</output>
          <input type="range" min="35" max="100" value={displaySettings.brightness} onChange={(event) => setDisplaySetting({ brightness: Number(event.target.value) })} aria-label="Brightness" />
        </label>
        <SettingsToggle
          label="Night light"
          description="Use warmer colors across BaconOS to help reduce blue light."
          checked={displaySettings.nightLightEnabled}
          onChange={(nightLightEnabled) => setDisplaySetting({ nightLightEnabled })}
        />
        <label className={`display-range-row display-range-row--compact ${displaySettings.nightLightEnabled ? '' : 'display-range-row--disabled'}`}>
          <span><strong>Night light strength</strong><small>Choose how warm the entire interface appears.</small></span>
          <output>{displaySettings.nightLightStrength}%</output>
          <input type="range" min="10" max="75" value={displaySettings.nightLightStrength} disabled={!displaySettings.nightLightEnabled} onChange={(event) => setDisplaySetting({ nightLightStrength: Number(event.target.value) })} aria-label="Night light strength" />
        </label>
      </section>

      <section className="display-settings-group" aria-label="Desktop display options">
        <div className="display-group-heading"><h2>Desktop</h2><span>Current display</span></div>
        <SettingsToggle
          label="Show desktop icons"
          description="Show app icons on the responsive desktop grid."
          checked={displaySettings.showDesktopIcons}
          onChange={(showDesktopIcons) => setDisplaySetting({ showDesktopIcons })}
        />
        <div className="display-setting-row display-setting-row--wallpaper">
          <div><strong>Wallpaper fit</strong><small>Choose how the desktop wallpaper uses your display.</small></div>
          <div className="display-segmented-control" role="group" aria-label="Wallpaper fit">
            <button className={displaySettings.wallpaperFit === 'cover' ? 'display-segmented-control--active' : ''} type="button" onClick={() => setDisplaySetting({ wallpaperFit: 'cover' })}>Fill</button>
            <button className={displaySettings.wallpaperFit === 'contain' ? 'display-segmented-control--active' : ''} type="button" onClick={() => setDisplaySetting({ wallpaperFit: 'contain' })}>Fit</button>
          </div>
        </div>
      </section>
    </>
  )
}

function AppearanceSettingsPanel({ appearanceSettings, onUpdateAppearanceSettings, onCustomWallpaperSelect }) {
  const setAppearance = (changes) => onUpdateAppearanceSettings(changes)
  const setWallpaper = (target, wallpaper) => onUpdateAppearanceSettings((currentSettings) => ({
    ...currentSettings,
    loadingWallpaperCustomized: target === 'loading' ? true : currentSettings.loadingWallpaperCustomized,
    wallpapers: { ...currentSettings.wallpapers, [target]: wallpaper },
  }))

  return (
    <>
      <header className="settings-main-header">
        <div className="settings-device-mark"><SettingsGlyph /></div>
        <div>
          <h1>Appearance</h1>
          <p>Personalize the look and feel of BaconOS.</p>
        </div>
      </header>

      <section className="display-settings-group appearance-theme-group" aria-label="Choose your mode">
        <div className="display-group-heading"><h2>Choose your mode</h2><span>System appearance</span></div>
        <div className="display-theme-picker" role="group" aria-label="Choose BaconOS mode">
          <button className={appearanceSettings.theme === 'dark' ? 'display-theme-option--active' : ''} type="button" onClick={() => setAppearance({ theme: 'dark' })} aria-pressed={appearanceSettings.theme === 'dark'}>
            <span className="display-theme-swatch display-theme-swatch--dark" aria-hidden="true" />
            <span><strong>Dark</strong><small>Default BaconOS mode</small></span>
          </button>
          <button className={appearanceSettings.theme === 'light' ? 'display-theme-option--active' : ''} type="button" onClick={() => setAppearance({ theme: 'light' })} aria-pressed={appearanceSettings.theme === 'light'}>
            <span className="display-theme-swatch display-theme-swatch--light" aria-hidden="true" />
            <span><strong>Light</strong><small>Brighter system chrome</small></span>
          </button>
        </div>
      </section>

      <section className="display-settings-group appearance-accent-group" aria-label="Accent color">
        <div className="display-group-heading"><h2>Accent color</h2><span>System highlights</span></div>
        <div className="appearance-accent-row">
          <div>
            <strong>Choose your accent color</strong>
            <small>Used by selections, active controls, sliders and window indicators.</small>
          </div>
          <label className="appearance-accent-picker">
            <input type="color" value={appearanceSettings.accentColor} onChange={(event) => setAppearance({ accentColor: event.target.value })} aria-label="Accent color" />
            <span>{appearanceSettings.accentColor.toUpperCase()}</span>
          </label>
        </div>
      </section>

      <section className="display-settings-group appearance-surface-group" aria-label="Surface style">
        <div className="display-group-heading"><h2>Surface style</h2><span>Taskbar & title bars</span></div>
        <div className="appearance-choice-grid">
          {[
            ['smoky', 'Smoky glass', 'Dark translucent glass'],
            ['frosted', 'Frosted glass', 'Brighter blurred glass'],
            ['clear', 'Clear glass', 'Minimal transparent glass'],
            ['solid', 'Solid', 'No transparency or blur'],
          ].map(([id, title, detail]) => (
            <button className={appearanceSettings.surfaceStyle === id ? 'appearance-choice--active' : ''} type="button" key={id} onClick={() => setAppearance({ surfaceStyle: id })} aria-pressed={appearanceSettings.surfaceStyle === id}>
              <span className={`appearance-surface-preview appearance-surface-preview--${id}`} aria-hidden="true" />
              <span><strong>{title}</strong><small>{detail}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="display-settings-group" aria-label="Taskbar layout">
        <div className="display-group-heading"><h2>Taskbar layout</h2><span>Bottom of screen</span></div>
        <div className="appearance-choice-grid appearance-choice-grid--two">
          <button className={appearanceSettings.taskbarLayout === 'centered' ? 'appearance-choice--active' : ''} type="button" onClick={() => setAppearance({ taskbarLayout: 'centered' })} aria-pressed={appearanceSettings.taskbarLayout === 'centered'}>
            <span className="appearance-layout-preview appearance-layout-preview--centered" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>Centered</strong><small>Floating taskbar</small></span>
          </button>
          <button className={appearanceSettings.taskbarLayout === 'full' ? 'appearance-choice--active' : ''} type="button" onClick={() => setAppearance({ taskbarLayout: 'full' })} aria-pressed={appearanceSettings.taskbarLayout === 'full'}>
            <span className="appearance-layout-preview appearance-layout-preview--full" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>Full width</strong><small>Across the bottom edge</small></span>
          </button>
        </div>
      </section>

      <section className="display-settings-group" aria-label="Window control style">
        <div className="display-group-heading"><h2>Window controls</h2><span>Title-bar buttons</span></div>
        <div className="appearance-choice-grid appearance-choice-grid--two">
          <button className={appearanceSettings.windowControls === 'dots' ? 'appearance-choice--active' : ''} type="button" onClick={() => setAppearance({ windowControls: 'dots' })} aria-pressed={appearanceSettings.windowControls === 'dots'}>
            <span className="appearance-controls-preview appearance-controls-preview--dots" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>Dots</strong><small>Classic BaconOS controls</small></span>
          </button>
          <button className={appearanceSettings.windowControls === 'symbols' ? 'appearance-choice--active' : ''} type="button" onClick={() => setAppearance({ windowControls: 'symbols' })} aria-pressed={appearanceSettings.windowControls === 'symbols'}>
            <span className="appearance-controls-preview appearance-controls-preview--symbols" aria-hidden="true"><i>—</i><i>□</i><i>×</i></span>
            <span><strong>Symbols</strong><small>Windows-style controls</small></span>
          </button>
        </div>
      </section>

      <section className="display-settings-group wallpaper-settings-group" aria-label="Wallpapers">
        <div className="display-group-heading"><h2>Wallpapers</h2><span>Each screen can differ</span></div>
        <WallpaperPicker target="lock" label="Lock & unlock screen" value={appearanceSettings.wallpapers.lock} onChange={(wallpaper) => setWallpaper('lock', wallpaper)} onFileSelect={(file) => onCustomWallpaperSelect('lock', file)} />
        <WallpaperPicker target="desktop" label="Desktop" value={appearanceSettings.wallpapers.desktop} onChange={(wallpaper) => setWallpaper('desktop', wallpaper)} onFileSelect={(file) => onCustomWallpaperSelect('desktop', file)} />
        <WallpaperPicker target="loading" label="Loading screen" value={appearanceSettings.wallpapers.loading} onChange={(wallpaper) => setWallpaper('loading', wallpaper)} onFileSelect={(file) => onCustomWallpaperSelect('loading', file)} />
      </section>
    </>
  )
}

function SettingsContent({ displaySettings, onUpdateDisplaySettings, appearanceSettings, onUpdateAppearanceSettings, onCustomWallpaperSelect }) {
  const [activeTab, setActiveTab] = useState('display')

  return (
    <section className={`settings-app ${appearanceSettings.theme === 'light' ? 'settings-app--light' : ''}`} aria-label="Settings">
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <span className="settings-brand-icon"><SettingsGlyph /></span>
          <span><strong>Settings</strong><small>BaconOS</small></span>
        </div>
        <nav className="settings-navigation" aria-label="Settings sections">
          <button className={`settings-navigation-item ${activeTab === 'display' ? 'settings-navigation-item--active' : ''}`} type="button" onClick={() => setActiveTab('display')}>
            <i aria-hidden="true">▭</i>
            Display
          </button>
          <button className={`settings-navigation-item ${activeTab === 'appearance' ? 'settings-navigation-item--active' : ''}`} type="button" onClick={() => setActiveTab('appearance')}>
            <i aria-hidden="true">◐</i>
            Appearance
          </button>
        </nav>
      </aside>

      <div className="settings-main">
        {activeTab === 'display'
          ? <DisplaySettingsPanel displaySettings={displaySettings} onUpdateDisplaySettings={onUpdateDisplaySettings} />
          : <AppearanceSettingsPanel appearanceSettings={appearanceSettings} onUpdateAppearanceSettings={onUpdateAppearanceSettings} onCustomWallpaperSelect={onCustomWallpaperSelect} />}
      </div>
    </section>
  )
}
function LoadingScreen({ leaving, showInfiniteWarning, showFpsWarning, wallpaperId, customWallpapers }) {
  return (
    <section className={`loading-screen ${leaving ? 'loading-screen--leaving' : ''}`} aria-label="BaconOS is loading">
      <WallpaperVisual className="loading-wallpaper" wallpaperId={wallpaperId} customWallpapers={customWallpapers} />
      {showFpsWarning && (
        <p className="fps-warning" role="alert">
          Performance monitor enabled — live FPS is now visible.
        </p>
      )}
      <div className="star-field" aria-hidden="true" />
      <div className="triangle-field" aria-hidden="true">
        {triangles.map((triangle, index) => (
          <span
            className="float-triangle"
            key={index}
            style={{
              left: triangle.left,
              top: triangle.top,
              width: triangle.size,
              height: triangle.size,
              '--float-delay': triangle.delay,
              '--float-duration': triangle.duration,
              '--triangle-rotate': triangle.rotate,
            }}
          />
        ))}
      </div>

      <div className="welcome-lockup">
        <h1 className="welcome-title" aria-label="Welcome to BaconOS">
          {titleLetters.map((letter, index) => (
            <span
              className="wave-letter"
              aria-hidden="true"
              key={`${letter}-${index}`}
              style={{ '--wave-delay': `${index * 75}ms` }}
            >
              {letter === ' ' ? '\u00A0' : letter}
            </span>
          ))}
        </h1>
        <div className="logo-wrap">
          <img src="/assets/bacon-logo-cutout.png" className="bacon-logo" alt="BaconOS bacon logo" />
        </div>
      </div>

      {showInfiniteWarning && (
        <p className="infinite-loading-warning" role="alert">
          Infinite loading enabled — this screen will remain on repeat.
        </p>
      )}
      <div className="loading-orbit" aria-hidden="true"><span /></div>
    </section>
  )
}

function ClockWidget({ unlocked }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  const date = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  return (
    <section className={`desktop-clock ${unlocked ? 'desktop-clock--hidden' : ''}`} aria-label={`Current time: ${time}, ${date}`}>
      <time className="clock-time" dateTime={now.toISOString()}>{time}</time>
      <time className="clock-date" dateTime={now.toISOString()}>{date}</time>
    </section>
  )
}

function Taskbar({ openWindows, layout, onLaunchApp, onRestoreWindow, onCloseWindow, notifications, notificationCenterOpen, onToggleNotificationCenter, onDeleteNotification, onClearNotifications }) {
  const [now, setNow] = useState(() => new Date())
  const [hoveredAppId, setHoveredAppId] = useState(null)
  const previewCloseTimer = useRef(null)
  const windowsByContentType = useMemo(() => {
    const groups = new Map()
    for (const appWindow of openWindows) {
      const group = groups.get(appWindow.contentType) || []
      group.push(appWindow)
      groups.set(appWindow.contentType, group)
    }
    return groups
  }, [openWindows])
  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  const date = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)

  const keepPreviewOpen = (appId) => {
    window.clearTimeout(previewCloseTimer.current)
    setHoveredAppId(appId)
  }

  const delayPreviewClose = () => {
    window.clearTimeout(previewCloseTimer.current)
    previewCloseTimer.current = window.setTimeout(() => setHoveredAppId(null), 500)
  }

  useEffect(() => () => window.clearTimeout(previewCloseTimer.current), [])

  return (
    <nav className={`taskbar ${layout === 'full' ? 'taskbar--full' : ''}`} aria-label="BaconOS taskbar">
      <div className="taskbar-start-area">
        <button className="taskbar-start-button" type="button" aria-label="BaconOS Start, not yet interactive" title="BaconOS Start">
          <img src="/assets/bacon-logo-cutout.png" alt="" />
        </button>
      </div>

      <div className="taskbar-pinned-apps" aria-label="Pinned apps">
        {pinnedApps.map((app) => {
          const appWindows = windowsByContentType.get(app.contentType) || []
          const openInstanceCount = appWindows.length
          const isPreviewOpen = hoveredAppId === app.id && openInstanceCount > 0

          return (
            <div
              className="taskbar-app-preview-anchor"
              key={app.id}
              onMouseEnter={() => keepPreviewOpen(app.id)}
              onMouseLeave={delayPreviewClose}
            >
              <button
                className="taskbar-app-button"
                type="button"
                data-app-id={app.id}
                data-app-content-type={app.contentType}
                onClick={() => onLaunchApp(app)}
                aria-label={`Open ${app.label}, ${openInstanceCount} open instance${openInstanceCount === 1 ? '' : 's'}`}
                title={app.label}
              >
                {app.contentType === 'settings'
                  ? <span className="settings-taskbar-icon" aria-hidden="true"><SettingsGlyph /></span>
                  : <span className="test-app-icon" aria-hidden="true">{app.label}</span>}
                {openInstanceCount > 0 && (
                  <span className={`taskbar-app-indicators ${openInstanceCount > 3 ? 'taskbar-app-indicators--many' : ''}`} aria-hidden="true">
                    {openInstanceCount > 3
                      ? <span className="taskbar-app-indicator taskbar-app-indicator--many" />
                      : Array.from({ length: openInstanceCount }, (_, index) => (
                        <span className="taskbar-app-indicator" key={index} />
                      ))}
                  </span>
                )}
              </button>

              {isPreviewOpen && (
                <div className="taskbar-window-previews" aria-label={`${app.label} window previews`}>
                  {appWindows.map((appWindow) => (
                    <div className="taskbar-window-preview" key={appWindow.id}>
                      <button
                        className="taskbar-window-preview-open"
                        type="button"
                        onClick={() => onRestoreWindow(appWindow.id)}
                        aria-label={`${appWindow.title} window${appWindow.isMinimized ? ', minimized' : ''}. Click to restore or focus.`}
                      >
                        <span className="taskbar-window-preview-title">{appWindow.title}</span>
                        <span className={`taskbar-window-preview-canvas ${app.contentType === 'settings' ? 'taskbar-window-preview-canvas--settings' : ''}`} aria-hidden="true">
                          <span>{app.contentType === 'settings' ? 'Settings' : 'test'}</span>
                        </span>
                        {appWindow.isMinimized && <small>Minimized</small>}
                      </button>
                      <button
                        className="taskbar-window-preview-close"
                        type="button"
                        onClick={() => onCloseWindow(appWindow.id)}
                        aria-label={`Close ${appWindow.title} window`}
                        title="Close window"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="taskbar-system-area">
        <div className="notification-center-anchor">
          <button
            className="taskbar-notifications"
            type="button"
            onClick={onToggleNotificationCenter}
            aria-label={`Notifications, ${notifications.length} total, ${unreadNotificationCount} unread`}
            aria-expanded={notificationCenterOpen}
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 10.2c0-3.6-2-6.2-6-6.2s-6 2.6-6 6.2c0 5.3-2.2 6.3-2.2 7.5h16.4c0-1.2-2.2-2.2-2.2-7.5ZM9.7 20a2.45 2.45 0 0 0 4.6 0" />
            </svg>
            {unreadNotificationCount > 0 && (
              <span className="notification-badge" aria-hidden="true">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>
            )}
          </button>

          {notificationCenterOpen && (
            <section className="notification-center" aria-label="Notification center">
              <header className="notification-center-header">
                <div>
                  <strong>Notifications</strong>
                  <span>{notifications.length} saved</span>
                </div>
                {notifications.length > 0 && (
                  <button className="notification-clear-all" type="button" onClick={onClearNotifications}>Clear all</button>
                )}
              </header>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <p className="notification-empty">You’re all caught up.</p>
                ) : notifications.map((notification) => (
                  <article className={`notification-item ${notification.read ? 'notification-item--read' : ''}`} key={notification.id}>
                    <span className="notification-item-icon" aria-hidden="true">●</span>
                    <div className="notification-item-copy">
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <small>{new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(notification.createdAt))}</small>
                    </div>
                    <button className="notification-delete" type="button" onClick={() => onDeleteNotification(notification.id)} aria-label={`Delete ${notification.title} notification`} title="Delete notification">×</button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <time className="taskbar-clock" dateTime={now.toISOString()} aria-label={`Current time ${time}, ${date}`}>
          <span>{time}</span>
          <small>{date}</small>
        </time>
      </div>
    </nav>
  )
}

const AppWindow = memo(function AppWindow({ appWindow, displaySettings, appearanceSettings, onUpdateDisplaySettings, onUpdateAppearanceSettings, onCustomWallpaperSelect, onUpdateWindow, onCloseWindow, onMinimizeWindow, onToggleMaximize, onFocusWindow }) {
  const interactionRef = useRef(null)
  const windowElementRef = useRef(null)
  const animationFrameRef = useRef(null)
  const pendingBoundsRef = useRef(null)

  const applyPendingVisualUpdate = () => {
    const pending = pendingBoundsRef.current
    const windowElement = windowElementRef.current
    animationFrameRef.current = null
    if (!pending || !windowElement) return

    if (pending.type === 'drag') {
      windowElement.style.transform = `translate3d(${pending.deltaX}px, ${pending.deltaY}px, 0)`
      return
    }

    windowElement.style.left = `${pending.changes.position.x}px`
    windowElement.style.top = `${pending.changes.position.y}px`
    windowElement.style.width = `${pending.changes.size.width}px`
    windowElement.style.height = `${pending.changes.size.height}px`
  }

  const queueVisualUpdate = (pending) => {
    pendingBoundsRef.current = pending
    if (animationFrameRef.current === null) {
      animationFrameRef.current = window.requestAnimationFrame(applyPendingVisualUpdate)
    }
  }

  const beginInteraction = (event, type, direction = '') => {
    if (event.button !== 0 || (type === 'drag' && event.target.closest('button'))) return
    if (appWindow.isMaximized) return

    event.stopPropagation()
    onFocusWindow(appWindow.id)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    windowElementRef.current?.classList.add('app-window--interacting')
    interactionRef.current = {
      type,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: { ...appWindow.position },
      startSize: { ...appWindow.size },
    }
  }

  const updateInteraction = (event) => {
    const interaction = interactionRef.current
    if (!interaction) return

    const deltaX = event.clientX - interaction.startX
    const deltaY = event.clientY - interaction.startY

    if (interaction.type === 'drag') {
      queueVisualUpdate({
        type: 'drag',
        deltaX,
        deltaY,
        changes: {
          position: {
            x: interaction.startPosition.x + deltaX,
            y: interaction.startPosition.y + deltaY,
          },
        },
      })
      return
    }

    const minimumWidth = 300
    const minimumHeight = 210
    let { x, y } = interaction.startPosition
    let { width, height } = interaction.startSize
    const direction = interaction.direction

    if (direction.includes('e')) width = Math.max(minimumWidth, interaction.startSize.width + deltaX)
    if (direction.includes('s')) height = Math.max(minimumHeight, interaction.startSize.height + deltaY)
    if (direction.includes('w')) {
      width = Math.max(minimumWidth, interaction.startSize.width - deltaX)
      x = interaction.startPosition.x + interaction.startSize.width - width
    }
    if (direction.includes('n')) {
      height = Math.max(minimumHeight, interaction.startSize.height - deltaY)
      y = interaction.startPosition.y + interaction.startSize.height - height
    }

    queueVisualUpdate({
      type: 'resize',
      changes: {
        position: { x, y },
        size: { width, height },
        isMaximized: false,
        restoreBounds: null,
      },
    })
  }

  const endInteraction = () => {
    const pending = pendingBoundsRef.current
    const windowElement = windowElementRef.current

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      applyPendingVisualUpdate()
    }

    if (pending && windowElement) {
      if (pending.type === 'drag') {
        windowElement.style.left = `${pending.changes.position.x}px`
        windowElement.style.top = `${pending.changes.position.y}px`
        windowElement.style.transform = ''
      }
      onUpdateWindow(appWindow.id, pending.changes)
    }

    windowElement?.classList.remove('app-window--interacting')
    interactionRef.current = null
    pendingBoundsRef.current = null
  }

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
  }, [])

  return (
    <section
      className={`app-window ${appWindow.isMaximized ? 'app-window--maximized' : ''} ${appWindow.isMinimizing ? 'app-window--minimizing' : ''}`}
      ref={windowElementRef}
      style={{
        left: appWindow.position.x,
        top: appWindow.position.y,
        width: appWindow.size.width,
        height: appWindow.size.height,
        zIndex: appWindow.zIndex,
      }}
      aria-label={`${appWindow.title} window`}
      onPointerDown={() => onFocusWindow(appWindow.id)}
    >
      <div className="app-window-surface">
        <header
          className="app-window-titlebar"
          onPointerDown={(event) => beginInteraction(event, 'drag')}
          onPointerMove={updateInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        >
          <span className="app-window-title">{appWindow.title}</span>
          <div className={`app-window-controls ${appearanceSettings.windowControls === 'symbols' ? 'app-window-controls--symbols' : ''}`} aria-label={`${appWindow.title} window controls`}>
            <button className="window-control window-control--minimize" type="button" aria-label="Minimize" title="Minimize" onClick={() => onMinimizeWindow(appWindow.id, appWindow.contentType, windowElementRef.current)}>{appearanceSettings.windowControls === 'symbols' && '—'}</button>
            <button className="window-control window-control--maximize" type="button" aria-label={appWindow.isMaximized ? 'Restore window' : 'Fullscreen'} title={appWindow.isMaximized ? 'Restore window' : 'Fullscreen'} onClick={() => onToggleMaximize(appWindow.id)}>{appearanceSettings.windowControls === 'symbols' && (appWindow.isMaximized ? '▣' : '□')}</button>
            <button className="window-control window-control--close" type="button" aria-label="Close" title="Close" onClick={() => onCloseWindow(appWindow.id)}>{appearanceSettings.windowControls === 'symbols' && '×'}</button>
          </div>
        </header>
        <div className={`app-window-content ${appWindow.contentType === 'settings' ? 'app-window-content--settings' : ''}`}>
          {appWindow.contentType === 'test' && <p>test</p>}
          {appWindow.contentType === 'settings' && (
            <SettingsContent
              displaySettings={displaySettings}
              appearanceSettings={appearanceSettings}
              onUpdateDisplaySettings={onUpdateDisplaySettings}
              onUpdateAppearanceSettings={onUpdateAppearanceSettings}
              onCustomWallpaperSelect={onCustomWallpaperSelect}
            />
          )}
        </div>
      </div>

      {resizeDirections.map((direction) => (
        <span
          className={`resize-handle resize-handle--${direction}`}
          key={direction}
          onPointerDown={(event) => beginInteraction(event, 'resize', direction)}
          onPointerMove={updateInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        />
      ))}
    </section>
  )
})

function WindowLayer({ openWindows, displaySettings, appearanceSettings, onUpdateDisplaySettings, onUpdateAppearanceSettings, onCustomWallpaperSelect, onUpdateWindow, onCloseWindow, onMinimizeWindow, onToggleMaximize, onFocusWindow }) {
  return (
    <div className="window-layer" aria-live="polite">
      {openWindows.filter((appWindow) => !appWindow.isMinimized).map((appWindow) => (
        <AppWindow
          appWindow={appWindow}
          key={appWindow.id}
          displaySettings={displaySettings}
          appearanceSettings={appearanceSettings}
          onUpdateDisplaySettings={onUpdateDisplaySettings}
          onUpdateAppearanceSettings={onUpdateAppearanceSettings}
          onCustomWallpaperSelect={onCustomWallpaperSelect}
          onUpdateWindow={onUpdateWindow}
          onCloseWindow={onCloseWindow}
          onMinimizeWindow={onMinimizeWindow}
          onToggleMaximize={onToggleMaximize}
          onFocusWindow={onFocusWindow}
        />
      ))}
    </div>
  )
}

function DesktopIconGrid({ onLaunchApp }) {
  const gridRef = useRef(null)
  const interactionRef = useRef(null)
  const releasedSelectionTimerRef = useRef(null)
  const [gridMetrics, setGridMetrics] = useState(() => calculateDesktopGridMetrics())
  const [iconSlots, setIconSlots] = useState(() => {
    try {
      const savedSlots = JSON.parse(window.localStorage.getItem('baconos-desktop-layout-v1') || '{}')
      return desktopApps.reduce((slots, app) => {
        const savedSlot = savedSlots?.[app.id]
        slots[app.id] = Number.isInteger(savedSlot?.column) && savedSlot.column >= 0 && Number.isInteger(savedSlot?.row) && savedSlot.row >= 0
          ? savedSlot
          : defaultDesktopSlots[app.id]
        return slots
      }, {})
    } catch {
      return { ...defaultDesktopSlots }
    }
  })
  const [selectedIconIds, setSelectedIconIds] = useState([])
  const [draggingIconIds, setDraggingIconIds] = useState([])
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectionRect, setSelectionRect] = useState(null)

  useEffect(() => {
    try {
      window.localStorage.setItem('baconos-desktop-layout-v1', JSON.stringify(iconSlots))
    } catch {
      // The desktop stays usable during this session when local storage is unavailable.
    }
  }, [iconSlots])

  useEffect(() => () => {
    if (releasedSelectionTimerRef.current !== null) window.clearTimeout(releasedSelectionTimerRef.current)
  }, [])

  useEffect(() => {
    const updateGridMetrics = () => setGridMetrics(calculateDesktopGridMetrics(gridRef.current?.getBoundingClientRect()))
    updateGridMetrics()

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateGridMetrics)
    if (gridRef.current) resizeObserver?.observe(gridRef.current)
    window.addEventListener('resize', updateGridMetrics, { passive: true })

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateGridMetrics)
    }
  }, [])

  useEffect(() => {
    setIconSlots((currentSlots) => {
      let changed = false
      const occupiedSlots = new Set()
      const nextSlots = { ...currentSlots }

      for (const app of desktopApps) {
        const currentSlot = currentSlots[app.id] || defaultDesktopSlots[app.id]
        let nextSlot = {
          column: Math.min(currentSlot.column, gridMetrics.maxColumn),
          row: Math.min(currentSlot.row, gridMetrics.maxRow),
        }

        if (occupiedSlots.has(`${nextSlot.column}:${nextSlot.row}`)) {
          for (let row = 0; row <= gridMetrics.maxRow; row += 1) {
            for (let column = 0; column <= gridMetrics.maxColumn; column += 1) {
              if (!occupiedSlots.has(`${column}:${row}`)) {
                nextSlot = { column, row }
                row = gridMetrics.maxRow + 1
                break
              }
            }
          }
        }

        occupiedSlots.add(`${nextSlot.column}:${nextSlot.row}`)
        if (nextSlot.column !== currentSlot.column || nextSlot.row !== currentSlot.row) {
          nextSlots[app.id] = nextSlot
          changed = true
        }
      }

      return changed ? nextSlots : currentSlots
    })
  }, [gridMetrics.maxColumn, gridMetrics.maxRow])

  const getMetrics = useCallback(() => gridMetrics, [gridMetrics])

  const slotsFor = useCallback((iconIds, slots = iconSlots) => Object.fromEntries(iconIds.map((iconId) => [iconId, slots[iconId] || defaultDesktopSlots[iconId]])), [iconSlots])

  const beginIconDrag = useCallback((event, app) => {
    if (event.button !== 0) return

    if (releasedSelectionTimerRef.current !== null) window.clearTimeout(releasedSelectionTimerRef.current)
    releasedSelectionTimerRef.current = null
    setSelectionRect(null)
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)

    const isAdditiveSelection = event.shiftKey || event.ctrlKey || event.metaKey
    const isAlreadySelected = selectedIconIds.includes(app.id)
    const nextSelection = isAdditiveSelection
      ? (isAlreadySelected ? selectedIconIds.filter((iconId) => iconId !== app.id) : [...selectedIconIds, app.id])
      : (isAlreadySelected ? selectedIconIds : [app.id])

    // Keep one selected icon under the pointer even when a modifier removes it from a group.
    const dragIconIds = nextSelection.length ? nextSelection : [app.id]
    if (!nextSelection.length) setSelectedIconIds(dragIconIds)
    else setSelectedIconIds(nextSelection)

    interactionRef.current = {
      type: 'drag',
      pointerId: event.pointerId,
      primaryId: app.id,
      iconIds: dragIconIds,
      startX: event.clientX,
      startY: event.clientY,
      startSlots: slotsFor(dragIconIds),
      hasMoved: false,
    }
    setDraggingIconIds(dragIconIds)
    setDragOffset({ x: 0, y: 0 })
  }, [selectedIconIds, slotsFor])

  const beginMarqueeSelection = useCallback((event) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return

    if (releasedSelectionTimerRef.current !== null) window.clearTimeout(releasedSelectionTimerRef.current)
    releasedSelectionTimerRef.current = null
    const bounds = gridRef.current?.getBoundingClientRect()
    if (!bounds) return

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const isAdditiveSelection = event.shiftKey || event.ctrlKey || event.metaKey
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
    const baseSelection = isAdditiveSelection ? selectedIconIds : []

    interactionRef.current = {
      type: 'marquee',
      pointerId: event.pointerId,
      startPoint: point,
      startSlots: slotsFor(desktopApps.map((app) => app.id)),
      baseSelection,
    }
    if (!isAdditiveSelection) setSelectedIconIds([])
    setSelectionRect({ left: point.x, top: point.y, width: 0, height: 0 })
  }, [selectedIconIds, slotsFor])

  const moveInteraction = useCallback((event) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    if (interaction.type === 'drag') {
      const offset = { x: event.clientX - interaction.startX, y: event.clientY - interaction.startY }
      if (!interaction.hasMoved && Math.hypot(offset.x, offset.y) < 3) return

      interaction.hasMoved = true
      setDragOffset(offset)
      return
    }

    const bounds = gridRef.current?.getBoundingClientRect()
    if (!bounds) return

    const currentPoint = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
    const marquee = {
      left: Math.min(interaction.startPoint.x, currentPoint.x),
      top: Math.min(interaction.startPoint.y, currentPoint.y),
      width: Math.abs(currentPoint.x - interaction.startPoint.x),
      height: Math.abs(currentPoint.y - interaction.startPoint.y),
    }
    setSelectionRect(marquee)

    const marqueeSelection = desktopApps
      .filter((app) => {
        const slot = interaction.startSlots[app.id]
        const iconLeft = gridMetrics.paddingX + (slot.column * gridMetrics.cellWidth) + ((gridMetrics.cellWidth - gridMetrics.iconWidth) / 2)
        const iconTop = gridMetrics.paddingY + (slot.row * gridMetrics.cellHeight) + ((gridMetrics.cellHeight - gridMetrics.iconHeight) / 2)
        return marquee.left < iconLeft + gridMetrics.iconWidth
          && marquee.left + marquee.width > iconLeft
          && marquee.top < iconTop + gridMetrics.iconHeight
          && marquee.top + marquee.height > iconTop
      })
      .map((app) => app.id)

    setSelectedIconIds([...new Set([...interaction.baseSelection, ...marqueeSelection])])
  }, [gridMetrics])

  const endInteraction = useCallback((event) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    interactionRef.current = null

    if (interaction.type === 'drag' && interaction.hasMoved) {
      const offsetX = event.clientX - interaction.startX
      const offsetY = event.clientY - interaction.startY
      const metrics = getMetrics()
      const horizontalMove = Math.round(offsetX / metrics.cellWidth)
      const verticalMove = Math.round(offsetY / metrics.cellHeight)
      const selectedSlots = Object.values(interaction.startSlots)
      const { maxColumn, maxRow } = metrics
      const minimumColumn = Math.min(...selectedSlots.map((slot) => slot.column))
      const maximumColumn = Math.max(...selectedSlots.map((slot) => slot.column))
      const minimumRow = Math.min(...selectedSlots.map((slot) => slot.row))
      const maximumRow = Math.max(...selectedSlots.map((slot) => slot.row))
      const snappedColumnMove = Math.min(Math.max(horizontalMove, -minimumColumn), maxColumn - maximumColumn)
      const snappedRowMove = Math.min(Math.max(verticalMove, -minimumRow), maxRow - maximumRow)

      setIconSlots((currentSlots) => {
        const movedIds = new Set(interaction.iconIds)
        const stationaryLocations = new Set(
          desktopApps
            .filter((app) => !movedIds.has(app.id))
            .map((app) => {
              const slot = currentSlots[app.id] || defaultDesktopSlots[app.id]
              return `${slot.column}:${slot.row}`
            }),
        )
        const nextSlots = { ...currentSlots }
        const nextLocations = new Set()

        for (const iconId of interaction.iconIds) {
          const startSlot = interaction.startSlots[iconId]
          const nextSlot = { column: startSlot.column + snappedColumnMove, row: startSlot.row + snappedRowMove }
          const location = `${nextSlot.column}:${nextSlot.row}`
          if (stationaryLocations.has(location) || nextLocations.has(location)) return currentSlots
          nextLocations.add(location)
          nextSlots[iconId] = nextSlot
        }

        return nextSlots
      })
    }

    if (interaction.type === 'marquee') {
      const bounds = gridRef.current?.getBoundingClientRect()
      if (bounds) {
        const currentPoint = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
        const releaseRect = {
          left: Math.min(interaction.startPoint.x, currentPoint.x),
          top: Math.min(interaction.startPoint.y, currentPoint.y),
          width: Math.abs(currentPoint.x - interaction.startPoint.x),
          height: Math.abs(currentPoint.y - interaction.startPoint.y),
        }
        setSelectionRect({
          ...releaseRect,
          isReleasing: true,
          originX: interaction.startPoint.x - releaseRect.left,
          originY: interaction.startPoint.y - releaseRect.top,
        })
        if (releasedSelectionTimerRef.current !== null) window.clearTimeout(releasedSelectionTimerRef.current)
        releasedSelectionTimerRef.current = window.setTimeout(() => {
          releasedSelectionTimerRef.current = null
          setSelectionRect(null)
        }, 280)
      } else {
        setSelectionRect(null)
      }
    } else {
      setSelectionRect(null)
    }

    setDraggingIconIds([])
    setDragOffset({ x: 0, y: 0 })
  }, [getMetrics])

  const cancelInteraction = useCallback((event) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    interactionRef.current = null
    setDraggingIconIds([])
    setDragOffset({ x: 0, y: 0 })
    setSelectionRect(null)
  }, [])

  return (
    <section
      className="desktop-icon-grid"
      ref={gridRef}
      aria-label="Desktop apps"
      onPointerDown={beginMarqueeSelection}
      onPointerMove={moveInteraction}
      onPointerUp={endInteraction}
      onPointerCancel={cancelInteraction}
    >
      {desktopApps.map((app) => {
        const slot = iconSlots[app.id] || defaultDesktopSlots[app.id]
        const isDragging = draggingIconIds.includes(app.id)
        const isSelected = selectedIconIds.includes(app.id)
        return (
          <button
            className={`desktop-app-icon ${isSelected ? 'desktop-app-icon--selected' : ''} ${isDragging ? 'desktop-app-icon--dragging' : ''}`}
            key={app.id}
            type="button"
            style={{
              width: `${gridMetrics.iconWidth}px`,
              minHeight: `${gridMetrics.iconHeight}px`,
              left: `${gridMetrics.paddingX + (slot.column * gridMetrics.cellWidth) + ((gridMetrics.cellWidth - gridMetrics.iconWidth) / 2)}px`,
              top: `${gridMetrics.paddingY + (slot.row * gridMetrics.cellHeight) + ((gridMetrics.cellHeight - gridMetrics.iconHeight) / 2)}px`,
              transform: isDragging ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` : undefined,
            }}
            aria-label={`${app.label} app. Double-click to open.`}
            aria-pressed={isSelected}
            onPointerDown={(event) => beginIconDrag(event, app)}
            onDoubleClick={() => onLaunchApp(app)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onLaunchApp(app)
              if (event.key === ' ') {
                event.preventDefault()
                setSelectedIconIds([app.id])
              }
            }}
          >
            {app.contentType === 'settings'
              ? <span className="desktop-settings-icon-mark" aria-hidden="true"><SettingsGlyph /></span>
              : <span className="desktop-app-icon-mark" aria-hidden="true">Test</span>}
            <span className="desktop-app-icon-label">{app.label}</span>
          </button>
        )
      })}
      {selectionRect && (
        <span
          className={`desktop-selection-rectangle ${selectionRect.isReleasing ? 'desktop-selection-rectangle--releasing' : ''}`}
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
            '--selection-origin-x': `${selectionRect.originX ?? 0}px`,
            '--selection-origin-y': `${selectionRect.originY ?? 0}px`,
          }}
          aria-hidden="true"
        />
      )}
    </section>
  )
}

function Desktop({ visible, unlocked, showUnlockHint, openWindows, notifications, notificationCenterOpen, displaySettings, appearanceSettings, customWallpapers, onLaunchApp, onUpdateDisplaySettings, onUpdateAppearanceSettings, onCustomWallpaperSelect, onUpdateWindow, onCloseWindow, onMinimizeWindow, onToggleMaximize, onFocusWindow, onRestoreWindow, onToggleNotificationCenter, onDeleteNotification, onClearNotifications, onPointerDown, onPointerUp, onPointerCancel }) {
  const captureSwipeStart = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onPointerDown(event)
  }

  return (
    <main
      className={`desktop ${visible ? 'desktop--visible' : ''} ${unlocked ? 'desktop--unlocked' : ''}`}
      aria-label={unlocked ? 'BaconOS desktop' : 'BaconOS lock screen'}
    >
      <WallpaperVisual className={`wallpaper wallpaper--lock wallpaper--${displaySettings.wallpaperFit}`} wallpaperId={appearanceSettings.wallpapers.lock} customWallpapers={customWallpapers} alt="Lock screen wallpaper" />
      <WallpaperVisual className={`wallpaper wallpaper--desktop wallpaper--${displaySettings.wallpaperFit}`} wallpaperId={appearanceSettings.wallpapers.desktop} customWallpapers={customWallpapers} alt="Desktop wallpaper" />
      <ClockWidget unlocked={unlocked} />
      {unlocked && (
        <>
          {displaySettings.showDesktopIcons && <DesktopIconGrid onLaunchApp={onLaunchApp} />}
          <WindowLayer
            openWindows={openWindows}
            displaySettings={displaySettings}
            appearanceSettings={appearanceSettings}
            onUpdateDisplaySettings={onUpdateDisplaySettings}
            onUpdateAppearanceSettings={onUpdateAppearanceSettings}
            onCustomWallpaperSelect={onCustomWallpaperSelect}
            onUpdateWindow={onUpdateWindow}
            onCloseWindow={onCloseWindow}
            onMinimizeWindow={onMinimizeWindow}
            onToggleMaximize={onToggleMaximize}
            onFocusWindow={onFocusWindow}
          />
          <Taskbar
            openWindows={openWindows}
            layout={appearanceSettings.taskbarLayout}
            onLaunchApp={onLaunchApp}
            onRestoreWindow={onRestoreWindow}
            onCloseWindow={onCloseWindow}
            notifications={notifications}
            notificationCenterOpen={notificationCenterOpen}
            onToggleNotificationCenter={onToggleNotificationCenter}
            onDeleteNotification={onDeleteNotification}
            onClearNotifications={onClearNotifications}
          />
        </>
      )}
      {showUnlockHint && (
        <p className={`unlock-hint ${unlocked ? 'unlock-hint--hidden' : ''}`}>
          Swipe up or press Space to unlock
        </p>
      )}
      {!unlocked && (
        <div
          className="unlock-swipe-zone"
          aria-hidden="true"
          onPointerDown={captureSwipeStart}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      )}
    </main>
  )
}

export default function App() {
  const [stage, setStage] = useState('loading')
  const [isLoadingHeld, setIsLoadingHeld] = useState(false)
  const [showInfiniteWarning, setShowInfiniteWarning] = useState(false)
  const [showFps, setShowFps] = useState(false)
  const [showFpsWarning, setShowFpsWarning] = useState(false)
  const [notifications, setNotifications] = useState(() => {
    try {
      const savedNotifications = JSON.parse(window.localStorage.getItem('baconos-notifications-v1') || '[]')
      // Remove legacy automatic app-launch notices; notifications are now system-level only.
      return Array.isArray(savedNotifications)
        ? savedNotifications.filter((notification) => notification.category !== 'app-launch' && notification.title !== 'Test opened')
        : []
    } catch {
      return []
    }
  })
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false)
  const [toastNotificationId, setToastNotificationId] = useState(null)
  const [displaySettings, setDisplaySettings] = useState(() => {
    try {
      const savedSettings = JSON.parse(window.localStorage.getItem('baconos-display-settings-v1') || '{}')
      return { ...defaultDisplaySettings, ...savedSettings }
    } catch {
      return { ...defaultDisplaySettings }
    }
  })
  const [appearanceSettings, setAppearanceSettings] = useState(() => {
    try {
      const savedSettings = JSON.parse(window.localStorage.getItem('baconos-appearance-settings-v1') || '{}')
      const savedWallpapers = savedSettings.wallpapers || {}
      return {
        ...defaultAppearanceSettings,
        ...savedSettings,
        wallpapers: {
          ...defaultAppearanceSettings.wallpapers,
          ...savedWallpapers,
          // Settings saved before the loading-wallpaper picker existed migrate to the new black default.
          loading: savedSettings.loadingWallpaperCustomized ? savedWallpapers.loading : defaultAppearanceSettings.wallpapers.loading,
        },
      }
    } catch {
      return { ...defaultAppearanceSettings, wallpapers: { ...defaultAppearanceSettings.wallpapers } }
    }
  })
  const [customWallpapers, setCustomWallpapers] = useState({})
  const customWallpaperUrlsRef = useRef({})
  const [hasShownWelcomeNotification, setHasShownWelcomeNotification] = useState(() => {
    try {
      return window.localStorage.getItem('baconos-welcome-notification-v1') === 'true'
    } catch {
      return false
    }
  })
  // Every active app window is rendered from this state collection.
  const [openWindows, setOpenWindows] = useState([])
  const [isUnlocked, setIsUnlocked] = useState(false)
  const hasPlayedStartupSound = useRef(false)
  const startupAudioRef = useRef(null)
  const warningAudioRef = useRef(null)
  const notificationAudioRef = useRef(null)
  const unlockAudioRef = useRef(null)
  const swipeStartY = useRef(null)
  const highestWindowZ = useRef(20)

  // Load user-provided sounds while BaconOS is on its loading screen.
  useEffect(() => {
    const startupAudio = new Audio('/assets/audio/windows-11-startup-prototype.mp3')
    startupAudio.preload = 'auto'
    startupAudio.volume = 1
    startupAudioRef.current = startupAudio
    startupAudio.load()

    const warningAudio = new Audio('/assets/audio/baconos-warning-error.mp3')
    warningAudio.preload = 'auto'
    warningAudio.volume = 1
    warningAudioRef.current = warningAudio
    warningAudio.load()

    const notificationAudio = new Audio('/assets/audio/baconos-notification.mp3')
    notificationAudio.preload = 'auto'
    notificationAudio.volume = 1
    notificationAudioRef.current = notificationAudio
    notificationAudio.load()

    const unlockAudio = new Audio('/assets/audio/baconos-unlock.mp3')
    unlockAudio.preload = 'auto'
    unlockAudio.volume = 1
    unlockAudioRef.current = unlockAudio
    unlockAudio.load()

    return () => {
      startupAudio.pause()
      startupAudio.removeAttribute('src')
      startupAudio.load()
      warningAudio.pause()
      warningAudio.removeAttribute('src')
      warningAudio.load()
      notificationAudio.pause()
      notificationAudio.removeAttribute('src')
      notificationAudio.load()
      unlockAudio.pause()
      unlockAudio.removeAttribute('src')
      unlockAudio.load()
    }
  }, [])

  const playWarningSound = () => {
    const warningAudio = warningAudioRef.current
    if (!warningAudio) return

    warningAudio.currentTime = 0
    warningAudio.play().catch(() => {
      // This sound is normally triggered by a user action, so browsers should allow it.
    })
  }

  const playNotificationSound = useCallback(() => {
    const notificationAudio = notificationAudioRef.current
    if (!notificationAudio) return

    notificationAudio.currentTime = 0
    notificationAudio.play().catch(() => {
      // Desktop/Electron playback is reliable; browsers may require an interaction first.
    })
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('baconos-notifications-v1', JSON.stringify(notifications))
    } catch {
      // Notifications continue to work for the active session if storage is unavailable.
    }
  }, [notifications])

  useEffect(() => {
    try {
      window.localStorage.setItem('baconos-display-settings-v1', JSON.stringify(displaySettings))
    } catch {
      // Display preferences remain active for this session if storage is unavailable.
    }
  }, [displaySettings])

  const updateDisplaySettings = useCallback((changes) => {
    setDisplaySettings((currentSettings) => ({ ...currentSettings, ...changes }))
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('baconos-appearance-settings-v1', JSON.stringify(appearanceSettings))
    } catch {
      // Appearance preferences remain active for this session if storage is unavailable.
    }
  }, [appearanceSettings])

  const updateAppearanceSettings = useCallback((changes) => {
    setAppearanceSettings((currentSettings) => (
      typeof changes === 'function' ? changes(currentSettings) : { ...currentSettings, ...changes }
    ))
  }, [])

  useEffect(() => {
    let disposed = false

    const restoreCustomWallpapers = async () => {
      try {
        const restoredEntries = await Promise.all(['lock', 'desktop', 'loading'].map(async (target) => {
          const file = await readCustomWallpaper(target)
          if (!file) return null
          return [target, { type: file.type.startsWith('video/') ? 'video' : 'image', src: URL.createObjectURL(file) }]
        }))
        if (disposed) {
          restoredEntries.filter(Boolean).forEach(([, wallpaper]) => URL.revokeObjectURL(wallpaper.src))
          return
        }
        const restoredWallpapers = Object.fromEntries(restoredEntries.filter(Boolean))
        customWallpaperUrlsRef.current = restoredWallpapers
        setCustomWallpapers(restoredWallpapers)
      } catch {
        // Custom files still work for the current session if IndexedDB is unavailable.
      }
    }

    restoreCustomWallpapers()
    return () => {
      disposed = true
      Object.values(customWallpaperUrlsRef.current).forEach((wallpaper) => URL.revokeObjectURL(wallpaper.src))
    }
  }, [])

  const selectCustomWallpaper = useCallback((target, file) => {
    if (!file || (!file.type.startsWith('image/') && file.type !== 'video/mp4')) return

    const nextWallpaper = { type: file.type.startsWith('video/') ? 'video' : 'image', src: URL.createObjectURL(file) }
    setCustomWallpapers((currentWallpapers) => {
      const previousWallpaper = currentWallpapers[target]
      if (previousWallpaper?.src) URL.revokeObjectURL(previousWallpaper.src)
      const nextWallpapers = { ...currentWallpapers, [target]: nextWallpaper }
      customWallpaperUrlsRef.current = nextWallpapers
      return nextWallpapers
    })
    updateAppearanceSettings((currentSettings) => ({
      ...currentSettings,
      loadingWallpaperCustomized: target === 'loading' ? true : currentSettings.loadingWallpaperCustomized,
      wallpapers: { ...currentSettings.wallpapers, [target]: `custom:${target}` },
    }))
    saveCustomWallpaper(target, file).catch(() => {
      // The object URL remains active even if persistent blob storage is unavailable.
    })
  }, [updateAppearanceSettings])

  const addNotification = useCallback(({ title, message }) => {
    const id = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const notification = { id, title, message, createdAt: Date.now(), read: false }

    setNotifications((currentNotifications) => [notification, ...currentNotifications])
    setToastNotificationId(id)
    playNotificationSound()
  }, [playNotificationSound])

  const deleteNotification = useCallback((notificationId) => {
    setNotifications((currentNotifications) => currentNotifications.filter((notification) => notification.id !== notificationId))
    setToastNotificationId((currentId) => currentId === notificationId ? null : currentId)
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setToastNotificationId(null)
  }, [])

  const toggleNotificationCenter = useCallback(() => {
    setNotificationCenterOpen((isOpen) => {
      const nextOpenState = !isOpen
      if (nextOpenState) {
        setNotifications((currentNotifications) => currentNotifications.some((notification) => !notification.read)
          ? currentNotifications.map((notification) => ({ ...notification, read: true }))
          : currentNotifications)
      }
      return nextOpenState
    })
  }, [])

  useEffect(() => {
    if (!toastNotificationId) return undefined

    const toastTimer = window.setTimeout(() => setToastNotificationId(null), 5200)
    return () => window.clearTimeout(toastTimer)
  }, [toastNotificationId])

  const focusWindow = useCallback((windowId) => {
    const nextZIndex = ++highestWindowZ.current
    setOpenWindows((currentWindows) => currentWindows.map((appWindow) => (
      appWindow.id === windowId ? { ...appWindow, zIndex: nextZIndex } : appWindow
    )))
  }, [])

  const updateWindow = useCallback((windowId, changes) => {
    setOpenWindows((currentWindows) => currentWindows.map((appWindow) => (
      appWindow.id === windowId ? { ...appWindow, ...changes } : appWindow
    )))
  }, [])

  const closeWindow = useCallback((windowId) => {
    setOpenWindows((currentWindows) => currentWindows.filter((appWindow) => appWindow.id !== windowId))
  }, [])

  const getWorkspaceBounds = useCallback(() => {
    const workspace = document.querySelector('.desktop')?.getBoundingClientRect()
    return {
      width: Math.round(workspace?.width || window.innerWidth),
      height: Math.round(workspace?.height || window.innerHeight),
    }
  }, [])

  const minimizeWindow = useCallback((windowId, contentType, sourceElement) => {
    setOpenWindows((currentWindows) => currentWindows.map((currentWindow) => (
      currentWindow.id === windowId
        ? { ...currentWindow, isMinimizing: true }
        : currentWindow
    )))

    const finishMinimize = () => {
      setOpenWindows((currentWindows) => currentWindows.map((currentWindow) => (
        currentWindow.id === windowId
          ? { ...currentWindow, isMinimizing: false, isMinimized: true }
          : currentWindow
      )))
    }

    window.requestAnimationFrame(() => {
      const targetElement = document.querySelector(`[data-app-content-type="${contentType}"]`)
      if (!sourceElement || !targetElement) {
        finishMinimize()
        return
      }

      const sourceBounds = sourceElement.getBoundingClientRect()
      const targetBounds = targetElement.getBoundingClientRect()
      const translateX = targetBounds.left + targetBounds.width / 2 - (sourceBounds.left + sourceBounds.width / 2)
      const translateY = targetBounds.top + targetBounds.height / 2 - (sourceBounds.top + sourceBounds.height / 2)
      const scale = Math.max(.06, Math.min(targetBounds.width / sourceBounds.width, targetBounds.height / sourceBounds.height))
      const animation = sourceElement.animate(
        [
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, filter: 'blur(0)' },
          { transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`, opacity: .15, filter: 'blur(2px)' },
        ],
        { duration: 460, easing: 'cubic-bezier(.25, .8, .25, 1)', fill: 'forwards' },
      )

      animation.finished.then(finishMinimize).catch(finishMinimize)
    })
  }, [])

  const restoreWindow = useCallback((windowId) => {
    const nextZIndex = ++highestWindowZ.current
    setOpenWindows((currentWindows) => currentWindows.map((appWindow) => (
      appWindow.id === windowId
        ? { ...appWindow, isMinimized: false, isMinimizing: false, zIndex: nextZIndex }
        : appWindow
    )))
  }, [])

  const toggleMaximizeWindow = useCallback((windowId) => {
    setOpenWindows((currentWindows) => currentWindows.map((appWindow) => {
      if (appWindow.id !== windowId) return appWindow

      if (appWindow.isMaximized && appWindow.restoreBounds) {
        return {
          ...appWindow,
          position: appWindow.restoreBounds.position,
          size: appWindow.restoreBounds.size,
          isMaximized: false,
          restoreBounds: null,
        }
      }

      const workspace = getWorkspaceBounds()
      return {
        ...appWindow,
        restoreBounds: { position: appWindow.position, size: appWindow.size },
        position: { x: 0, y: 0 },
        size: { width: workspace.width, height: workspace.height },
        isMaximized: true,
        zIndex: ++highestWindowZ.current,
      }
    }))
  }, [getWorkspaceBounds])

  const launchApp = useCallback((app) => {
    setOpenWindows((currentWindows) => {
      const minimizedWindow = [...currentWindows].reverse().find((appWindow) => (
        appWindow.contentType === app.contentType && appWindow.isMinimized
      ))

      if (minimizedWindow) {
        const nextZIndex = ++highestWindowZ.current
        return currentWindows.map((appWindow) => (
          appWindow.id === minimizedWindow.id
            ? { ...appWindow, isMinimized: false, isMinimizing: false, zIndex: nextZIndex }
            : appWindow
        ))
      }

      const instanceCount = currentWindows.filter((appWindow) => appWindow.contentType === app.contentType).length
      const isSettingsApp = app.contentType === 'settings'
      const width = isSettingsApp
        ? Math.min(930, Math.max(320, window.innerWidth - 54))
        : Math.min(680, Math.max(340, window.innerWidth - 96))
      const height = isSettingsApp
        ? Math.min(620, Math.max(300, window.innerHeight - 118))
        : Math.min(440, Math.max(250, window.innerHeight - 150))
      const cascadeOffset = instanceCount * 28

      return [
        ...currentWindows,
        {
          id: `${app.id}-${Date.now()}-${instanceCount}`,
          title: app.label,
          position: {
            x: Math.max(18, Math.round((window.innerWidth - width) / 2) + cascadeOffset),
            y: Math.max(18, Math.round((window.innerHeight - height) / 2) - 22 + cascadeOffset),
          },
          size: { width, height },
          contentType: app.contentType,
          isMinimized: false,
          isMinimizing: false,
          isMaximized: false,
          restoreBounds: null,
          zIndex: ++highestWindowZ.current,
        },
      ]
    })
  }, [])

  useEffect(() => {
    let resizeFrame = null

    const resizeMaximizedWindows = () => {
      if (resizeFrame !== null) return

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null
        const workspace = getWorkspaceBounds()
        setOpenWindows((currentWindows) => {
          if (!currentWindows.some((appWindow) => appWindow.isMaximized)) return currentWindows

          return currentWindows.map((appWindow) => (
            appWindow.isMaximized
              ? { ...appWindow, position: { x: 0, y: 0 }, size: { width: workspace.width, height: workspace.height } }
              : appWindow
          ))
        })
      })
    }

    window.addEventListener('resize', resizeMaximizedWindows, { passive: true })
    return () => {
      window.removeEventListener('resize', resizeMaximizedWindows)
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame)
    }
  }, [getWorkspaceBounds])

  const unlockDevice = () => {
    if (stage !== 'desktop' || isUnlocked) return

    setIsUnlocked(true)

    if (!hasShownWelcomeNotification) {
      setHasShownWelcomeNotification(true)
      try {
        window.localStorage.setItem('baconos-welcome-notification-v1', 'true')
      } catch {
        // The welcome message still works for this session if storage is unavailable.
      }
      addNotification({
        title: 'Welcome to BaconOS',
        message: 'First time using BaconOS? Welcome.',
      })
    }

    const unlockAudio = unlockAudioRef.current
    if (!unlockAudio) return

    unlockAudio.currentTime = 0
    unlockAudio.play().catch(() => {
      // Space and swipe are direct user actions, so browsers should allow this sound.
    })
  }

  const handleLockscreenPointerDown = (event) => {
    if (stage === 'desktop' && !isUnlocked) {
      swipeStartY.current = event.clientY
    }
  }

  const handleLockscreenPointerUp = (event) => {
    const startY = swipeStartY.current
    swipeStartY.current = null

    if (stage === 'desktop' && !isUnlocked && startY !== null && startY - event.clientY > 54) {
      unlockDevice()
    }
  }

  const handleLockscreenPointerCancel = () => {
    swipeStartY.current = null
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Debug shortcuts only work before the loading screen has begun to transition away.
      if (stage !== 'loading') return

      if (event.key === '8' && !isLoadingHeld) {
        setIsLoadingHeld(true)
        setShowInfiniteWarning(true)
        playWarningSound()
      }

      if (event.key === '#') {
        setShowFps(true)
        setShowFpsWarning(true)
        playWarningSound()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stage, isLoadingHeld])

  useEffect(() => {
    const handleUnlockKey = (event) => {
      if (event.code === 'Space' && stage === 'desktop' && !isUnlocked) {
        event.preventDefault()
        unlockDevice()
      }
    }

    window.addEventListener('keydown', handleUnlockKey)
    return () => window.removeEventListener('keydown', handleUnlockKey)
  }, [stage, isUnlocked])

  useEffect(() => {
    if (!showInfiniteWarning) return undefined

    const warningTimer = window.setTimeout(() => setShowInfiniteWarning(false), 2000)
    return () => window.clearTimeout(warningTimer)
  }, [showInfiniteWarning])

  useEffect(() => {
    if (!showFpsWarning) return undefined

    const warningTimer = window.setTimeout(() => setShowFpsWarning(false), 3000)
    return () => window.clearTimeout(warningTimer)
  }, [showFpsWarning])

  useEffect(() => {
    if (isLoadingHeld) return undefined

    const playStartupAudio = () => {
      if (hasPlayedStartupSound.current) return

      hasPlayedStartupSound.current = true
      const startupAudio = startupAudioRef.current
      if (!startupAudio) return

      startupAudio.currentTime = 0
      startupAudio.play().catch(() => {
        // Browser autoplay policies may defer audio until interaction. Electron can play it at startup.
      })
    }

    // The sound starts roughly 1.33 seconds before the lock screen loading sequence is complete.
    const soundTimer = window.setTimeout(playStartupAudio, 4317)
    const revealDesktop = window.setTimeout(() => setStage('transitioning'), 5000)
    const removeLoading = window.setTimeout(() => setStage('desktop'), 5650)

    return () => {
      window.clearTimeout(soundTimer)
      window.clearTimeout(revealDesktop)
      window.clearTimeout(removeLoading)
    }
  }, [isLoadingHeld])

  const activeToast = useMemo(
    () => notifications.find((notification) => notification.id === toastNotificationId) || null,
    [notifications, toastNotificationId],
  )

  return (
    <div
      className={`baconos-shell ${appearanceSettings.theme === 'light' ? 'baconos-shell--light' : ''} baconos-shell--surface-${appearanceSettings.surfaceStyle}`}
      style={{
        '--os-brightness': displaySettings.brightness / 100,
        '--accent-color': appearanceSettings.accentColor,
        '--accent-rgb': getAccentRgb(appearanceSettings.accentColor),
      }}
    >
      <Desktop
        visible={stage !== 'loading'}
        unlocked={isUnlocked}
        showUnlockHint={true}
        openWindows={openWindows}
        notifications={notifications}
        notificationCenterOpen={notificationCenterOpen}
        displaySettings={displaySettings}
        appearanceSettings={appearanceSettings}
        customWallpapers={customWallpapers}
        onLaunchApp={launchApp}
        onUpdateDisplaySettings={updateDisplaySettings}
        onUpdateAppearanceSettings={updateAppearanceSettings}
        onCustomWallpaperSelect={selectCustomWallpaper}
        onToggleNotificationCenter={toggleNotificationCenter}
        onDeleteNotification={deleteNotification}
        onClearNotifications={clearNotifications}
        onUpdateWindow={updateWindow}
        onCloseWindow={closeWindow}
        onMinimizeWindow={minimizeWindow}
        onToggleMaximize={toggleMaximizeWindow}
        onFocusWindow={focusWindow}
        onRestoreWindow={restoreWindow}
        onPointerDown={handleLockscreenPointerDown}
        onPointerUp={handleLockscreenPointerUp}
        onPointerCancel={handleLockscreenPointerCancel}
      />
      <FpsCounter enabled={showFps} />
      <NotificationToast notification={activeToast} onDismiss={() => setToastNotificationId(null)} />
      {stage !== 'desktop' && (
        <LoadingScreen
          leaving={stage === 'transitioning'}
          showInfiniteWarning={showInfiniteWarning}
          showFpsWarning={showFpsWarning}
          wallpaperId={appearanceSettings.wallpapers.loading}
          customWallpapers={customWallpapers}
        />
      )}
      {displaySettings.nightLightEnabled && (
        <span className="os-night-light-overlay" style={{ '--night-light-opacity': displaySettings.nightLightStrength / 200 }} aria-hidden="true" />
      )}
    </div>
  )
}
