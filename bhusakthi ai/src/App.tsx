import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CloudRain,
  Clock3,
  Database,
  Gauge,
  Globe,
  History,
  Map as MapIconLucide,
  Mountain,
  Menu,
  Navigation,
  Pause,
  Play,
  RadioTower,
  Route,
  Search,
  ShieldCheck,
  Thermometer,
  User,
  Waves,
  X,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Circle, Polyline, Popup, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const sidebarItems = [
  'Dashboard',
  'Risk Map',
  'Landslide',
  'Flood',
  '3D Disaster View',
  'Weather',
  'Analytics',
  'Historical Events',
  'Field Reports',
  'Alerts',
  'AI Insights',
  'Settings',
] as const;

type SidebarItem = (typeof sidebarItems)[number];

const alerts = [
  { time: '18:42', title: 'High landslide risk detected', place: 'Tawang', tone: 'red' },
  { time: '18:35', title: 'Heavy rainfall detected', place: 'West Kameng', tone: 'orange' },
  { time: '18:21', title: 'River level increasing', place: 'Assam', tone: 'blue' },
  { time: '18:05', title: 'Road vulnerability detected', place: 'Sikkim', tone: 'yellow' },
];

type Tone = 'red' | 'orange' | 'yellow' | 'green';

interface StateInfo {
  name: string;
  town: string;
  risk: 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW';
  tone: Tone;
  lat: number;
  lng: number;
}

type DataMode = 'LIVE' | 'HISTORICAL' | 'MODEL' | 'DEMO';

interface SourceStamp {
  source: string;
  timestamp: string;
  mode: DataMode;
}

const demoStamp: SourceStamp = {
  source: 'BHUSAKTHI demo provider adapter',
  timestamp: '2026-09-09 18:42 IST',
  mode: 'DEMO',
};

const sources = {
  rainfall: { source: 'IMD / provider-ready adapter', timestamp: '2026-09-09 18:40 IST', mode: 'DEMO' as DataMode },
  terrain: { source: 'ISRO CartoDEM / provider-ready adapter', timestamp: '2026-09-09 18:00 IST', mode: 'DEMO' as DataMode },
  model: { source: 'BHUSAKTHI risk model v0.9', timestamp: '2026-09-09 18:42 IST', mode: 'MODEL' as DataMode },
  historical: { source: 'Historical provider connector (unconfigured)', timestamp: 'Not ingested', mode: 'HISTORICAL' as DataMode },
};

const safePlaces = [
  { name: 'Tawang District Relief Centre', distance: '3.8 km', capacity: '1,200', status: 'OPEN' },
  { name: 'Government Higher Secondary School', distance: '5.1 km', capacity: '640', status: 'OPEN' },
  { name: 'Sela Pass Response Base', distance: '12.4 km', capacity: '220', status: 'STANDBY' },
];

const historicalEvents = [
  { year: '2024', date: '2024-07-12', place: 'West Kameng', type: 'Flood', severity: 'HIGH', rainfall: '212 mm', source: 'Historical connector pending verification' },
  { year: '2023', date: '2023-09-18', place: 'Gangtok, Sikkim', type: 'Landslide', severity: 'CRITICAL', rainfall: '188 mm', source: 'Historical connector pending verification' },
  { year: '2021', date: '2021-06-16', place: 'Tawang', type: 'Road failure', severity: 'MODERATE', rainfall: '146 mm', source: 'Historical connector pending verification' },
];

const states: StateInfo[] = [
  { name: 'Arunachal Pradesh', town: 'Tawang', risk: 'HIGH', tone: 'red', lat: 27.5859, lng: 91.8594 },
  { name: 'Assam', town: 'Guwahati', risk: 'ELEVATED', tone: 'orange', lat: 26.1445, lng: 91.7362 },
  { name: 'Sikkim', town: 'Gangtok', risk: 'HIGH', tone: 'red', lat: 27.3389, lng: 88.6065 },
  { name: 'Meghalaya', town: 'Shillong', risk: 'MODERATE', tone: 'yellow', lat: 25.5788, lng: 91.8933 },
  { name: 'Nagaland', town: 'Kohima', risk: 'MODERATE', tone: 'yellow', lat: 25.6751, lng: 94.1086 },
  { name: 'Manipur', town: 'Imphal', risk: 'ELEVATED', tone: 'orange', lat: 24.8170, lng: 93.9368 },
  { name: 'Mizoram', town: 'Aizawl', risk: 'ELEVATED', tone: 'orange', lat: 23.7271, lng: 92.7176 },
  { name: 'Tripura', town: 'Agartala', risk: 'LOW', tone: 'green', lat: 23.8315, lng: 91.2868 },
];

const toneGauge: Record<Tone, number> = { red: 84, orange: 65, yellow: 48, green: 24 };
const toneConfidence: Record<Tone, number> = { red: 89, orange: 82, yellow: 74, green: 66 };
const toneHex: Record<Tone, string> = { red: '#ff5a6c', orange: '#ff9f43', yellow: '#facc15', green: '#3ad7a1' };

const barLabels = ['Rainfall', 'Soil Moisture', 'Slope', 'Historical', 'Exposure'];
const barOffsets: Record<Tone, number[]> = {
  red: [4, -2, 7, 7, -23],
  orange: [-4, 5, -6, -10, -12],
  yellow: [-8, -2, -14, -22, -18],
  green: [-30, -20, -26, -38, -30],
};

function buildBars(tone: Tone) {
  const gauge = toneGauge[tone];
  return barLabels.map((label, i) => ({
    label,
    value: Math.max(6, Math.min(97, gauge + barOffsets[tone][i])),
  }));
}

const toneNotes: Record<Tone, string[]> = {
  red: [
    '⚠ Heavy rainfall detected',
    '⚠ Soil moisture increasing',
    '⚠ Steep slope identified',
    '⚠ Historical similarity: 91%',
    '⚠ Nearby road exposure detected',
  ],
  orange: [
    '⚠ Elevated rainfall trend',
    '⚠ Rising soil moisture',
    '⚠ Moderate slope risk',
    '⚠ Historical similarity: 68%',
    '⚠ Partial road exposure',
  ],
  yellow: [
    '⚠ Moderate rainfall recorded',
    '⚠ Soil moisture within normal range',
    '⚠ Low-to-moderate slope',
    '⚠ Historical similarity: 42%',
    '⚠ Minimal road exposure',
  ],
  green: [
    '✓ Rainfall within safe range',
    '✓ Soil moisture stable',
    '✓ Gentle slope profile',
    '✓ Historical similarity: 18%',
    '✓ No significant road exposure',
  ],
};

const impactMultiplier: Record<Tone, number> = { red: 1, orange: 0.72, yellow: 0.48, green: 0.2 };

function buildImpact(tone: Tone) {
  const m = impactMultiplier[tone];
  return [
    { icon: '🛣️', value: String(Math.round(18 * m)), label: 'Roads', subtitle: 'at Risk' },
    { icon: '🏘️', value: String(Math.round(42 * m)), label: 'Villages', subtitle: 'at Risk' },
    { icon: '👥', value: Math.round(18420 * m).toLocaleString(), label: 'Population', subtitle: 'Exposure' },
    { icon: '🏗️', value: String(Math.round(36 * m)), label: 'Assets', subtitle: 'at Risk' },
  ];
}

function buildKpis(state: StateInfo) {
  const gauge = toneGauge[state.tone];
  const multiplier = impactMultiplier[state.tone];
  const riskLabel = state.risk === 'ELEVATED' ? 'elevated' : state.risk.toLowerCase();
  return [
    { label: 'Active Alerts', value: String(Math.max(2, Math.round(12 * multiplier))), sub: `${riskLabel} at ${state.town}`, color: 'red', icon: AlertTriangle },
    { label: 'High Risk Zones', value: String(Math.max(3, Math.round(27 * multiplier))), sub: `within ${state.name}`, color: 'orange', icon: MapIconLucide },
    { label: 'Landslide Risk', value: `${gauge}%`, sub: `live model · ${state.town}`, color: 'yellow', icon: Gauge },
    { label: 'Flood Risk', value: `${Math.max(12, Math.round(gauge * 0.64))}%`, sub: `river trend · ${state.town}`, color: 'cyan', icon: Waves },
    { label: 'Affected Roads', value: String(Math.max(1, Math.round(18 * multiplier))), sub: `${Math.max(0, Math.round(5 * multiplier))} blocked near here`, color: 'purple', icon: Navigation },
    { label: 'Villages at Risk', value: String(Math.max(1, Math.round(42 * multiplier))), sub: `${state.town} response area`, color: 'green', icon: ShieldCheck },
  ];
}

function buildWeather(state: StateInfo) {
  const weatherByTone: Record<Tone, { temperature: string; rainfall: string; humidity: string; wind: string; condition: string; bars: number[] }> = {
    red: { temperature: '22°C', rainfall: '142 mm', humidity: '86%', wind: '18 km/h', condition: 'Heavy Rain', bars: [40, 55, 75, 90, 70, 85, 100] },
    orange: { temperature: '25°C', rainfall: '96 mm', humidity: '78%', wind: '14 km/h', condition: 'Rain Showers', bars: [28, 44, 58, 72, 62, 68, 78] },
    yellow: { temperature: '24°C', rainfall: '64 mm', humidity: '70%', wind: '11 km/h', condition: 'Light Rain', bars: [18, 30, 42, 50, 45, 52, 60] },
    green: { temperature: '28°C', rainfall: '32 mm', humidity: '62%', wind: '9 km/h', condition: 'Partly Cloudy', bars: [12, 22, 28, 36, 30, 34, 40] },
  };
  const weather = weatherByTone[state.tone];
  return {
    ...weather,
    stats: [
      { label: 'Temperature', value: weather.temperature },
      { label: 'Rainfall / 24h', value: weather.rainfall },
      { label: 'Humidity', value: weather.humidity },
      { label: 'Wind', value: weather.wind },
    ],
  };
}

function SourceLine({ stamp, compact = false }: { stamp: SourceStamp; compact?: boolean }) {
  return (
    <div className={`source-line ${compact ? 'compact' : ''}`}>
      <Database size={11} />
      <span>{stamp.source}</span>
      <span><Clock3 size={11} /> {stamp.timestamp}</span>
      <b className={`mode-${stamp.mode.toLowerCase()}`}>{stamp.mode}</b>
    </div>
  );
}

type TileKey = 'satellite' | 'street' | 'terrain';

const tileLayers: Record<TileKey, { url: string; attribution: string }> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors',
  },
};

function MapController({
  mapRef,
  flyTarget,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>;
  flyTarget: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    if (flyTarget) {
      map.flyTo(flyTarget, 8, { duration: 1.1 });
    }
  }, [flyTarget, map]);

  return null;
}

function App() {
  const [activeNav, setActiveNav] = useState<SidebarItem>('Dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [selected, setSelected] = useState<StateInfo>(states[0]);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [tileKey, setTileKey] = useState<TileKey>('satellite');
  const [showFlood, setShowFlood] = useState(true);
  const [showLandslide, setShowLandslide] = useState(true);
  const [activeInterval, setActiveInterval] = useState('12h');
  const [languageIndex, setLanguageIndex] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(demoStamp.timestamp);
  const [historyYear, setHistoryYear] = useState('All years');
  const [simulationStep, setSimulationStep] = useState(0);
  const [simulationRunning, setSimulationRunning] = useState(false);

  const languages = ['English', 'हिंदी', 'অসমীয়া'];
  const mapRef = useRef<LeafletMap | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const simCardRef = useRef<HTMLDivElement>(null);
  const flowCardRef = useRef<HTMLDivElement>(null);
  const weatherCardRef = useRef<HTMLDivElement>(null);
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const recommendationRef = useRef<HTMLDivElement>(null);
  const impactRef = useRef<HTMLDivElement>(null);

  const sectionRefs: Record<SidebarItem, React.RefObject<HTMLDivElement> | null> = {
    Dashboard: heroRef,
    'Risk Map': mapPanelRef,
    Landslide: simCardRef,
    Flood: flowCardRef,
    '3D Disaster View': simCardRef,
    Weather: weatherCardRef,
    Analytics: chartPanelRef,
    'Historical Events': timelineRef,
    'Field Reports': impactRef,
    Alerts: timelineRef,
    'AI Insights': recommendationRef,
    Settings: null,
  };

  const bars = useMemo(() => buildBars(selected.tone), [selected]);
  const notes = useMemo(() => toneNotes[selected.tone], [selected]);
  const gauge = toneGauge[selected.tone];
  const confidence = toneConfidence[selected.tone];
  const impactCards = useMemo(() => buildImpact(selected.tone), [selected]);

  const selectedStamp: SourceStamp = { ...demoStamp, timestamp: lastUpdated };
  const selectedKpis = useMemo(() => buildKpis(selected), [selected]);
  const selectedWeather = useMemo(() => buildWeather(selected), [selected]);
  const simulationLabels = ['Baseline conditions', 'Risk escalation', 'Warning issued', 'Impact envelope', 'Evacuation routing', 'Response posture'];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLastUpdated(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!simulationRunning) return;
    const timer = window.setInterval(() => {
      setSimulationStep((step) => (step + 1) % 6);
    }, 1300);
    return () => window.clearInterval(timer);
  }, [simulationRunning]);

  function goToSection(item: SidebarItem) {
    setActiveNav(item);
    setNavOpen(false);
    const ref = sectionRefs[item];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (item === 'Settings') {
      setModal({
        title: 'Settings',
        body: 'Account, notification, and data-source settings are on the roadmap for this command center.',
      });
    }
  }

  function selectState(state: StateInfo) {
    setSelected(state);
    setFlyTarget([state.lat, state.lng]);
    mapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const match = states.find((s) =>
      s.name.toLowerCase().includes(searchValue.trim().toLowerCase()) ||
      s.town.toLowerCase().includes(searchValue.trim().toLowerCase())
    );
    if (match) {
      selectState(match);
    } else {
      setModal({ title: 'No match found', body: `No monitored location matches "${searchValue}". Try a state or town name, e.g. "Assam" or "Tawang".` });
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setModal({ title: 'Location unavailable', body: 'Your browser does not support geolocation.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setLocating(false);
        setModal({ title: 'Location unavailable', body: 'Could not access your location. Check browser permissions and try again.' });
      }
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? 'nav-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">BHUSAKTHI AI</div>
            <small>Command Center</small>
          </div>
        </div>

        <nav className="nav">
          {sidebarItems.map((item, index) => (
            <button
              key={item}
              className={`nav-item ${activeNav === item ? 'active' : ''}`}
              onClick={() => goToSection(item)}
            >
              <span className="nav-icon">{['🏠', '🗺️', '🌋', '🌊', '🌐', '🌦️', '📊', '🕒', '📍', '🚨', '🤖', '⚙️'][index]}</span>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar glass-card">
          <div className="left-head">
            <button className="icon-button mobile-only" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle navigation">
              {navOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="title-wrap">
              <div className="title-main">BHUSAKTHI AI</div>
              <div className="status-row">
                <span className="status-dot" /> SYSTEM OPERATIONAL
              </div>
            </div>
          </div>

          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search location..."
              aria-label="Search location"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>

          <div className="header-actions">
            <button className={`ghost-pill ${activeNav === 'Weather' ? 'active' : ''}`} onClick={() => goToSection('Weather')}>
              <CloudRain size={15} /> Weather
            </button>
            <button className={`ghost-pill ${activeNav === 'Alerts' ? 'active' : ''}`} onClick={() => goToSection('Alerts')}>
              <Bell size={15} /> Alerts
            </button>
            <button className="ghost-pill" onClick={() => setLanguageIndex((i) => (i + 1) % languages.length)}>
              <Globe size={15} /> {languages[languageIndex]}
            </button>
            <div className="profile-pill">
              <User size={15} /> Admin
            </div>
          </div>
        </header>

        <section className="hero glass-card" ref={heroRef}>
          <div className="hero-content">
            <div className="eyebrow-row">
              <span className="live-pill"><span className="pulse" /> AI SYSTEM ONLINE</span>
              <span className="live-pill"><span className="pulse" /> WEATHER LIVE</span>
              <span className="live-pill"><span className="pulse" /> GIS DATA UPDATED 2 MIN AGO</span>
            </div>

            <h1>BHUSAKTHI AI</h1>
            <p className="tagline">AI-Powered Disaster Intelligence Platform</p>
            <p className="tagline-lower">Predict the Slope. Understand the Consequence. Prevent the Disaster.</p>
            <SourceLine stamp={selectedStamp} />
          </div>
        </section>

        <section className="kpi-grid">
          {selectedKpis.map(({ label, value, sub, color, icon: Icon }) => (
            <div key={label} className={`kpi-card ${color}`}>
              <div className="kpi-top">
                <div className="kpi-icon"><Icon size={22} /></div>
                <span className="trend">{sub}</span>
              </div>
              <div className="kpi-value">{value}</div>
              <div className="kpi-label">{label}</div>
            </div>
          ))}
        </section>

        <section className="dashboard-grid" ref={mapPanelRef}>
          <div className="main-map-panel glass-card">
            <div className="map-controls">
              <div className="search-mini">
                <Search size={15} />
                <input
                  className="search-mini-input"
                  placeholder="Search location"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearch}
                />
              </div>
              <div className="zoom-stack">
                <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">+</button>
                <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">−</button>
              </div>
              <div className="layer-list">
                <button className={locating ? 'layer-active' : ''} onClick={locateMe}>
                  ◉ {locating ? 'Locating…' : 'Current Location'}
                </button>
                <button className={tileKey === 'satellite' ? 'layer-active' : ''} onClick={() => setTileKey('satellite')}>🛰 Satellite</button>
                <button className={tileKey === 'terrain' ? 'layer-active' : ''} onClick={() => setTileKey('terrain')}>⛰ Terrain</button>
                <button className={showFlood ? 'layer-active' : ''} onClick={() => setShowFlood((v) => !v)}>🌊 Flood</button>
                <button className={showLandslide ? 'layer-active' : ''} onClick={() => setShowLandslide((v) => !v)}>⛰ Landslide</button>
              </div>
            </div>

            <div className="map-visual">
              <div className="map-place-picker">
                <label htmlFor="map-place-select">SELECT PLACE</label>
                <select
                  id="map-place-select"
                  value={selected.name}
                  onChange={(event) => {
                    const nextState = states.find((state) => state.name === event.target.value);
                    if (nextState) selectState(nextState);
                  }}
                >
                  {states.map((state) => <option key={state.name} value={state.name}>{state.town}, {state.name}</option>)}
                </select>
                <small>LIVE DASHBOARD · {selected.town}</small>
              </div>
              <MapContainer
                center={[selected.lat, selected.lng]}
                zoom={7}
                scrollWheelZoom
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url={tileLayers[tileKey].url} attribution={tileLayers[tileKey].attribution} />
                <MapController mapRef={mapRef} flyTarget={flyTarget} />

                {states.map((s) => (
                  <CircleMarker
                    key={s.name}
                    center={[s.lat, s.lng]}
                    radius={selected.name === s.name ? 12 : 8}
                    pathOptions={{
                      color: toneHex[s.tone],
                      fillColor: toneHex[s.tone],
                      fillOpacity: 0.85,
                      weight: selected.name === s.name ? 3 : 1.5,
                    }}
                    eventHandlers={{ click: () => selectState(s) }}
                  >
                    <Popup>
                      <strong>{s.town}</strong>, {s.name}
                      <br />
                      Risk: {s.risk}
                    </Popup>
                  </CircleMarker>
                ))}

                {showFlood &&
                  states.map((s) => (
                    <Circle
                      key={`flood-${s.name}`}
                      center={[s.lat, s.lng]}
                      radius={toneGauge[s.tone] * 700}
                      pathOptions={{ color: '#53d9ff', fillColor: '#53d9ff', fillOpacity: 0.08, weight: 1 }}
                    />
                  ))}

                {showLandslide &&
                  states.map((s) => (
                    <Circle
                      key={`landslide-${s.name}`}
                      center={[s.lat, s.lng]}
                      radius={toneGauge[s.tone] * 450}
                      pathOptions={{ color: '#ff9f43', fillColor: '#ff9f43', fillOpacity: 0.1, weight: 1, dashArray: '4 4' }}
                    />
                  ))}

                <Polyline
                  positions={[[27.9, 91.1], [27.4, 91.7], [26.8, 92.4], [26.2, 92.8], [25.5, 92.3]]}
                  pathOptions={{ color: '#53d9ff', weight: 4, opacity: 0.8, dashArray: '3 9' }}
                  eventHandlers={{ click: () => setModal({ title: 'River network', body: 'River-flow geometry selected. Live gauge values are provider-ready but not connected in this demo build.' }) }}
                />
              </MapContainer>

              <div className="map-overlay legend-card">
                <h4>RISK LEVEL</h4>
                <div className="legend-list">
                  <span><i className="dot green" /> LOW</span>
                  <span><i className="dot yellow" /> MODERATE</span>
                  <span><i className="dot orange" /> ELEVATED</span>
                  <span><i className="dot red" /> HIGH</span>
                </div>
              </div>

              <div className="map-overlay water-legend">
                <h4>OVERLAYS</h4>
                <div className="legend-list compact">
                  <span><i className="dot cyan" /> Flood radius {showFlood ? '(on)' : '(off)'}</span>
                  <span><i className="dot orange" /> Landslide radius {showLandslide ? '(on)' : '(off)'}</span>
                </div>
              </div>
              <div className="map-overlay map-source"><SourceLine stamp={{ source: tileKey === 'satellite' ? 'Esri World Imagery' : tileLayers[tileKey].attribution.replace(/<[^>]+>/g, ''), timestamp: lastUpdated, mode: 'DEMO' }} compact /></div>
            </div>
          </div>

          <aside className="intelligence-panel glass-card">
            <div className="panel-header">AI RISK INTELLIGENCE</div>
            <div className="location-name">{selected.town}</div>
            <div className="location-sub">{selected.name}</div>
            <SourceLine stamp={selectedStamp} />

            <div className="gauge-box">
              <div className="gauge-ring">
                <div className="gauge-inner">
                  <strong>{gauge}</strong>
                  <span>/100</span>
                </div>
              </div>
              <div className="gauge-text">{selected.risk} RISK</div>
            </div>

            <div className="bar-group">
              {bars.map(({ label, value }) => (
                <div key={label} className="bar-row">
                  <span>{label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${value}%` }} />
                  </div>
                  <strong>{value}%</strong>
                </div>
              ))}
            </div>

            <div className="explanation-card">
              <h4>WHY THIS LOCATION IS AT RISK</h4>
              <ul>
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <div className="confidence-row">
                <span>AI Confidence: {confidence}%</span>
                <span className="info-badge">i</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="evidence-grid">
          <div className="glass-card evidence-card">
            <div className="section-kicker"><RadioTower size={15} /> LIVE DATA SNAPSHOT</div>
            <div className="metric-grid">
              <div><Thermometer size={15} /><strong>28°C</strong><span>Temperature</span></div>
              <div><CloudRain size={15} /><strong>{selected.tone === 'red' ? '142' : '96'} mm</strong><span>Rainfall / 24h</span></div>
              <div><Waves size={15} /><strong>+2.4 m</strong><span>River level</span></div>
              <div><Mountain size={15} /><strong>{selected.tone === 'red' ? '86' : '64'}%</strong><span>Soil moisture</span></div>
            </div>
            <SourceLine stamp={sources.rainfall} compact />
            <div className="coordinate-line">{selected.town} · {selected.lat.toFixed(4)}° N, {selected.lng.toFixed(4)}° E · terrain slope 34°</div>
          </div>

          <div className="glass-card evidence-card changed-card">
            <div className="section-kicker"><Activity size={15} /> WHAT CHANGED?</div>
            <p><strong>{selected.tone === 'red' ? '+18%' : '+7%'} risk since baseline.</strong> Rainfall accumulation and soil moisture are above the recent reference window; steep terrain increases runoff and slope loading.</p>
            <div className="change-row"><span>Current risk</span><strong>{gauge}%</strong><i style={{ width: `${gauge}%` }} /></div>
            <div className="change-row baseline"><span>Historical baseline</span><strong>{Math.max(18, gauge - 18)}%</strong><i style={{ width: `${Math.max(18, gauge - 18)}%` }} /></div>
            <SourceLine stamp={sources.model} compact />
          </div>
        </section>

        <section className="command-grid">
          <div className="glass-card alert-card">
            <div className="section-kicker"><AlertTriangle size={15} /> ALERT CONTROL</div>
            <div className={`alert-level ${selected.tone}`}>{selected.risk === 'ELEVATED' ? 'MODERATE' : selected.risk} ALERT</div>
            <p><strong>{selected.town}, {selected.name}</strong> · 09 Sep 2026, 18:42 IST</p>
            <p className="muted-copy">Reason: rainfall threshold crossed with rising soil moisture. Affected area: {Math.round(gauge * 0.18)} km². Forecast window: next 6 hours.</p>
            <div className="alert-actions"><button className="secondary-btn" onClick={() => setModal({ title: 'Alert acknowledged', body: `Acknowledgement recorded for ${selected.town}. Cooldown: 30 minutes unless severity changes.` })}>ACKNOWLEDGE</button><span>Cooldown / hysteresis active</span></div>
            <SourceLine stamp={selectedStamp} compact />
          </div>

          <div className="glass-card safe-card">
            <div className="section-kicker"><Route size={15} /> SAFE PLACE & EVACUATION</div>
            <div className="route-summary"><strong>Nearest safe place</strong><span>Dynamic route: 3.8 km · 11 min</span></div>
            {safePlaces.map((place, index) => <button key={place.name} className={`safe-place ${index === 0 ? 'selected' : ''}`} onClick={() => setModal({ title: place.name, body: `${place.distance} from ${selected.town}. Capacity ${place.capacity}. Status ${place.status}. Route is modelled from the selected location; live road closure confirmation is provider-ready.` })}><span>{place.name}</span><small>{place.distance} · {place.status}</small></button>)}
            <SourceLine stamp={sources.model} compact />
          </div>
        </section>

        <section className="glass-card history-panel" ref={timelineRef}>
          <div className="panel-heading-row"><div><div className="section-kicker"><History size={15} /> HISTORICAL TIME MACHINE</div><h3>Compare previous events with present risk</h3></div><select value={historyYear} onChange={(event) => setHistoryYear(event.target.value)}><option>All years</option><option>2024</option><option>2023</option><option>2021</option></select></div>
          <div className="history-track"><span className="history-progress" /></div>
          <div className="history-events">{historicalEvents.filter((event) => historyYear === 'All years' || event.year === historyYear).map((event) => <button key={event.date} className="history-event" onClick={() => setModal({ title: `${event.type} · ${event.place}`, body: `${event.date} · ${event.severity} · reported rainfall ${event.rainfall}. This record is a DEMO placeholder; no official or news URL is shown until the historical connector verifies a source.` })}><strong>{event.year}</strong><span>{event.type}</span><small>{event.place} · {event.severity}</small><SourceLine stamp={{ ...sources.historical, timestamp: event.date }} compact /></button>)}</div>
          <div className="history-footer"><span>Historical heatmap and risk graph are calculated against the selected location after connector ingestion.</span><SourceLine stamp={sources.historical} compact /></div>
        </section>

        <section className="glass-card whatif-panel">
          <div className="panel-heading-row"><div><div className="section-kicker"><Play size={15} /> WHAT-IF DISASTER SIMULATION</div><h3>Rainfall escalation to response</h3></div><button className="simulation-toggle" onClick={() => setSimulationRunning((running) => !running)}>{simulationRunning ? <Pause size={15} /> : <Play size={15} />} {simulationRunning ? 'PAUSE' : 'PLAY'}</button></div>
          <div className="simulation-stage"><div className="simulation-horizon" style={{ transform: `translateX(${simulationStep * 16.66}%)` }} />{simulationLabels.map((label, index) => <button key={label} className={`sim-step ${simulationStep === index ? 'active' : ''}`} onClick={() => { setSimulationStep(index); setSimulationRunning(false); }}><span>{index + 1}</span>{label}</button>)}</div>
          <div className="whatif-readout"><strong>{simulationLabels[simulationStep]}</strong><span>Estimated exposure: {(18420 + simulationStep * 2410).toLocaleString()} people · infrastructure: {18 + simulationStep * 4} assets</span><span>Uncertainty: ±{12 + simulationStep * 3}% · status MODEL / DEMO</span></div>
          <SourceLine stamp={sources.model} />
        </section>

        <section className="lower-grid">
          <div className="stack-col">
            <div className="glass-card sim-card glow-card" ref={simCardRef}>
              <h3>🌋 3D DISASTER SIMULATION</h3>
              <div className="mini-scene">
                <div className="scene-mountain">🏔️</div>
                <div className="scene-rain">🌧️</div>
                <div className="scene-road">🛣️</div>
              </div>
              <button
                className="primary-btn"
                onClick={() =>
                  setModal({
                    title: '3D Disaster View',
                    body: `A rotating 3D terrain simulation for ${selected.town} — showing slope failure zones, rainfall accumulation, and road exposure — is planned for a future release.`,
                  })
                }
              >
                OPEN 3D DISASTER VIEW →
              </button>
            </div>

            <div className="glass-card sim-card flow-card" ref={flowCardRef}>
              <h3>🌊 FLOOD FLOW SIMULATION</h3>
              <div className="flow-metrics">
                <div><span>Water Flow</span><strong>{selected.tone === 'red' ? 'HIGH' : selected.tone === 'orange' ? 'MODERATE' : 'LOW'}</strong></div>
                <div><span>River Level</span><strong>+2.4 m</strong></div>
                <div><span>Flood Extent</span><strong>{(toneGauge[selected.tone] / 10).toFixed(1)} km²</strong></div>
              </div>
              <button
                className="secondary-btn"
                onClick={() =>
                  setModal({
                    title: '3D Flood View',
                    body: `A 3D flood-extent visualization for ${selected.town} is planned for a future release. For now, the Flood overlay on the map shows the modeled risk radius.`,
                  })
                }
              >
                VIEW 3D FLOOD →
              </button>
            </div>
          </div>

          <div className="glass-card weather-card" ref={weatherCardRef}>
            <h3>LIVE WEATHER · {selected.town}</h3>
            <div className="weather-main">
              <div className="weather-icon">🌧️</div>
              <div>
                <div className="temp">{selectedWeather.temperature}</div>
                <div className="condition">{selectedWeather.condition}</div>
              </div>
            </div>
            <div className="weather-stats">
              {selectedWeather.stats.map(({ label, value }) => (
                <div key={label} className="weather-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="next-hours">NEXT 24 HOURS</div>
            <div className="rain-chart">
              {selectedWeather.bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
            </div>
            <SourceLine stamp={{ ...sources.rainfall, timestamp: lastUpdated }} compact />
          </div>
        </section>

        <section className="chart-panel glass-card" ref={chartPanelRef}>
          <div className="panel-heading-row">
            <h3>RAIN VS RISK TREND</h3>
            <div className="interval-tabs">
              {['6h', '12h', '24h', '7d'].map((interval) => (
                <span
                  key={interval}
                  className={activeInterval === interval ? 'active' : ''}
                  onClick={() => setActiveInterval(interval)}
                >
                  {interval}
                </span>
              ))}
            </div>
          </div>
          <div className="chart-area">
            <div className="chart-grid-lines" />
            <svg viewBox="0 0 700 230" className="trend-svg" preserveAspectRatio="none">
              <path d="M0,190 C90,170, 140,150, 200,140 S320,90, 380,100 S500,60, 700,40" className="line line-cyan" />
              <path d="M0,170 C90,150, 140,135, 200,120 S350,90, 400,110 S500,75, 700,95" className="line line-yellow" />
              <path d="M0,210 C80,200, 160,190, 240,160 S340,120, 420,100 S520,80, 700,60" className="line line-orange" />
              <path d="M0,130 C90,120, 160,110, 220,95 S330,72, 440,65 S560,55, 700,48" className="line line-red" />
            </svg>
          </div>
          <SourceLine stamp={sources.model} compact />
        </section>

        <section className="bottom-grid">
          <div className="timeline-card glass-card" ref={timelineRef}>
            <h3>LIVE DISASTER ACTIVITY</h3>
            <div className="timeline-list">
              {alerts.map(({ time, title, place, tone }) => (
                <div key={time} className="timeline-item">
                  <span className={`pulse-dot ${tone}`} />
                  <div className="time">{time}</div>
                  <div className="text-block">
                    <strong>{title}</strong>
                    <small>{place}</small>
                  </div>
                </div>
              ))}
            </div>
            <SourceLine stamp={selectedStamp} compact />
          </div>

          <div className="recommendation-card glass-card ai-card" ref={recommendationRef}>
            <h3>🤖 AI RECOMMENDATION</h3>
            <p className="strong-action">Immediate Action Recommended</p>
            <ol>
              <li>Inspect vulnerable slope</li>
              <li>Monitor rainfall for next 6 hours</li>
              <li>Prepare road closure</li>
              <li>Alert nearby village</li>
            </ol>
            <button
              className="action-btn"
              onClick={() =>
                setModal({
                  title: 'Action Plan Generated',
                  body: `For ${selected.town}, ${selected.name}: inspect the vulnerable slope within 6 hours, continue rainfall monitoring, pre-position road-closure barriers, and issue an alert to nearby villages. (Auto-generated action plan — future versions will export this as a shareable report.)`,
                })
              }
            >
              GENERATE ACTION PLAN →
            </button>
          </div>
        </section>

        <section className="impact-section" ref={impactRef}>
          <div className="impact-grid">
            {impactCards.map(({ icon, value, label, subtitle }) => (
              <div key={label} className="impact-card glass-card">
                <div className="impact-icon">{icon}</div>
                <div className="impact-value">{value}</div>
                <div className="impact-label">{label}</div>
                <div className="impact-sub">{subtitle}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="states-grid glass-card">
          <h3>North East India Overview</h3>
          <SourceLine stamp={sources.model} compact />
          <div className="state-list">
            {states.map((s) => (
              <button
                key={s.name}
                className={`state-item ${selected.name === s.name ? 'state-item-active' : ''}`}
                onClick={() => selectState(s)}
              >
                <span>{s.name}</span>
                <strong className={s.tone}>{s.risk}</strong>
              </button>
            ))}
          </div>
        </section>
      </main>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.title}</h3>
              <button className="icon-button" onClick={() => setModal(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p>{modal.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
