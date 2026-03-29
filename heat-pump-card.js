'use strict';

// ─── Heat Pump Card ───────────────────────────────────────────────────────────
// Lovelace custom card with refrigeration-cycle schematic.
// Part of the hvac-viz repo: https://github.com/<you>/hvac-viz
//
// Tested with Buderus Logatherm / Logamax heat pumps via native HA integration.
// ─────────────────────────────────────────────────────────────────────────────

class HeatPumpCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._uid  = 'hp' + Math.random().toString(36).slice(2, 6);
    this._config = null;
    this._hass   = null;
    this._built  = false;
  }

  // ── Lovelace API ─────────────────────────────────────────────────────────

  static getStubConfig() {
    return {
      title: 'Wärmepumpe',
      entities: {
        // Heating
        thermostat:          'climate.buderus',
        flow_temp:           'sensor.vorlauftemperatur',
        return_temp:         'sensor.rucklauf',
        mode:                'select.modus_heizen_kuhlen',
        compressor_load:     'sensor.auslastung_kompressor',
        load:                'sensor.auslastung',
        // Hot water
        hot_water_temp:      'sensor.warmwasser',
        hot_water_demand:    'binary_sensor.warmwasserbedarf',
        hot_water_mode:      'select.modus_warmwasser',
        circulation:         'switch.zirkulation',
        circulation_interval:'select.zirkulation_intervall',
        // Ambient
        humidity:            'sensor.luftfeuchtigkeit',
        dew_point:           'sensor.taupunkt',
      },
    };
  }

  setConfig(config) {
    if (!config.entities) throw new Error('heat-pump-card: "entities" is required');
    this._config = config;
    this._build();
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass  = hass;
    if (this._built) this._update();
  }

  getCardSize()      { return 6; }
  getLayoutOptions() { return { grid_columns: 4, grid_rows: 4 }; }

  // ── State helpers ─────────────────────────────────────────────────────────

  _st(key)  { const e = this._config?.entities?.[key]; return e ? this._hass?.states?.[e] ?? null : null; }
  _stv(key, fb = null) { return this._st(key)?.state ?? fb; }
  _isOn(key) { const v = this._stv(key,'off'); return ['on','true','1'].includes(v); }

  _temp(key) {
    const st = this._st(key);
    if (!st || ['unavailable','unknown'].includes(st.state)) return '–';
    const n = parseFloat(st.state);
    if (isNaN(n)) return st.state;
    const u = st.attributes?.unit_of_measurement ?? '°C';
    return Math.round(n * 10) / 10 + u;
  }

  _pct(key) {
    if (!this._st(key) || ['unavailable','unknown'].includes(this._stv(key))) return '–';
    const n = parseFloat(this._stv(key));
    return isNaN(n) ? this._stv(key) : Math.round(n) + '%';
  }

  _num(key, unit = '') {
    const st = this._st(key);
    if (!st || ['unavailable','unknown'].includes(st.state)) return '–';
    const n = parseFloat(st.state);
    const u = unit || st.attributes?.unit_of_measurement || '';
    return isNaN(n) ? st.state : Math.round(n) + (u ? ' ' + u : '');
  }

  _mode() {
    // Try climate entity first, then select
    const cl = this._st('thermostat');
    if (cl && !['unavailable','unknown'].includes(cl.state)) return cl.state;
    return this._stv('mode', '–');
  }

  _currentTemp() {
    const cl = this._st('thermostat');
    if (cl?.attributes?.current_temperature != null)
      return Math.round(cl.attributes.current_temperature * 10) / 10 + '°C';
    return this._temp('flow_temp');
  }

  // ── DOM build ─────────────────────────────────────────────────────────────

  _build() {
    const u = this._uid;

    this.shadowRoot.innerHTML = `
<style>
  :host { display:block; width:100%; }
  * { box-sizing:border-box; }

  .card {
    width:100%;
    container-type: inline-size;
    background: var(--card-background-color,#1c1c1c);
    border-radius: 12px;
    padding: 16px;
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    color: var(--primary-text-color,#e0e0e0);
  }

  /* ── Header */
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .title { font-size:15px; font-weight:500; }
  .badge {
    display:inline-flex; align-items:center; gap:5px;
    font-size:11px; padding:4px 10px; border-radius:8px;
    background:#1b3a2e; color:#5dcaa5;
  }
  .badge.heat { background:#3a2004; color:#ef9f27; }
  .badge.cool { background:#0c2d48; color:#85b7eb; }
  .badge.off  { background:#2a2a2a; color:#888; }
  .bdot { width:5px; height:5px; border-radius:50%; background:currentColor; }

  /* ── Schematic */
  .diag { background:var(--secondary-background-color,#111); border-radius:10px; margin-bottom:12px; overflow:hidden; }

  /* SVG component boxes */
  .box    { fill:var(--card-background-color,#1c1c1c); stroke:var(--divider-color,#333); stroke-width:1; }
  .box-ht { fill:#1e1000; stroke:#BA7517; stroke-width:1.2; }  /* hot side */
  .box-cl { fill:#001a14; stroke:#1D9E75; stroke-width:1.2; }  /* cold side */
  .box-hw { fill:#0c1a2d; stroke:#378ADD; stroke-width:1.2; }  /* hot water */
  .lbl    { font-size:9px; fill:#888; letter-spacing:.07em; font-family:monospace; }
  .val    { font-size:13px; fill:var(--primary-text-color,#e0e0e0); font-family:monospace; font-weight:500; }
  .comp-lbl { font-size:8px; fill:#888; letter-spacing:.08em; }
  /* Pipes */
  .ph { stroke:#BA7517; stroke-width:2; fill:none; }  /* hot high-pressure */
  .pc { stroke:#1D9E75; stroke-width:2; fill:none; }  /* cold low-pressure */
  /* Arrows */
  .ah { fill:#BA7517; }
  .ac { fill:#1D9E75; }
  /* Particles */
  @keyframes flowH { from{transform:translateX(0)} to{transform:translateX(260px)} }
  @keyframes flowV { from{transform:translateY(0)} to{transform:translateY(120px)} }
  @keyframes flowHr{ from{transform:translateX(0)} to{transform:translateX(-260px)} }
  @keyframes flowVr{ from{transform:translateY(0)} to{transform:translateY(-120px)} }
  .ph-dot { fill:#EF9F27; }
  .pc-dot { fill:#5DCAA5; }
  .p1  { animation: flowH  var(--sp,2s) linear infinite; }
  .p1b { animation: flowH  var(--sp,2s) linear infinite; animation-delay:calc(var(--sp,2s)*-.5); }
  .p2  { animation: flowV  var(--sp,2s) linear infinite; }
  .p2b { animation: flowV  var(--sp,2s) linear infinite; animation-delay:calc(var(--sp,2s)*-.5); }
  .p3  { animation: flowHr var(--sp,2s) linear infinite; }
  .p3b { animation: flowHr var(--sp,2s) linear infinite; animation-delay:calc(var(--sp,2s)*-.5); }
  .p4  { animation: flowVr var(--sp,2s) linear infinite; }
  .p4b { animation: flowVr var(--sp,2s) linear infinite; animation-delay:calc(var(--sp,2s)*-.5); }
  .off-anim .p1,.off-anim .p1b,.off-anim .p2,.off-anim .p2b,
  .off-anim .p3,.off-anim .p3b,.off-anim .p4,.off-anim .p4b
    { animation-play-state:paused; opacity:0; }

  /* ── Metrics grid */
  .sec-lbl { font-size:10px; color:var(--secondary-text-color,#888); margin:0 0 6px; letter-spacing:.06em; }
  .mets { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:8px; }
  .met { background:var(--secondary-background-color,#111); border-radius:8px; padding:10px 12px; }
  .ml { font-size:10px; color:var(--secondary-text-color,#888); margin-bottom:2px; letter-spacing:.05em; }
  .mv { font-size:18px; font-weight:500; font-family:monospace; line-height:1.1; }
  .mu { font-size:10px; color:var(--secondary-text-color,#888); margin-top:2px; }

  /* ── Controls */
  .ctls { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:8px; }
  .ctl { background:var(--secondary-background-color,#111); border-radius:8px; padding:10px 12px; }
  .cl { font-size:10px; color:var(--secondary-text-color,#888); margin-bottom:6px; letter-spacing:.05em; }
  select {
    width:100%; padding:6px 8px;
    border:.5px solid var(--divider-color,#333); border-radius:6px;
    background:var(--secondary-background-color,#111);
    font-size:13px; color:var(--primary-text-color,#e0e0e0); font-family:inherit;
  }
  /* toggle switch */
  .tog { display:flex; align-items:center; justify-content:space-between; }
  .sw  { position:relative; width:36px; height:20px; cursor:pointer; }
  .sw input { opacity:0; width:0; height:0; }
  .sl {
    position:absolute; inset:0;
    background:#333; border-radius:20px; transition:.2s;
  }
  .sl:before {
    content:''; position:absolute;
    width:14px; height:14px; left:3px; bottom:3px;
    background:#888; border-radius:50%; transition:.2s;
  }
  .sw input:checked + .sl { background:#185FA5; }
  .sw input:checked + .sl:before { transform:translateX(16px); background:#85B7EB; }

  /* Responsive: wide layout */
  @container (min-width: 500px) {
    .mets { grid-template-columns: repeat(4,1fr); }
    .ctls { grid-template-columns: repeat(4,1fr); }
  }
</style>

<div class="card">

  <!-- Header -->
  <div class="hdr">
    <div>
      <div class="title">${this._config.title || 'Wärmepumpe'}</div>
    </div>
    <span class="badge" id="badge"><span class="bdot"></span><span id="btext">–</span></span>
  </div>

  <!-- Refrigeration cycle schematic -->
  <div class="diag">
    <svg id="sv" viewBox="0 0 640 220" width="100%" style="display:block;">
      <defs>
        <clipPath id="${u}-ct"><rect x="80"  y="20"  width="260" height="16"/></clipPath>
        <clipPath id="${u}-cr"><rect x="524" y="35"  width="16"  height="120"/></clipPath>
        <clipPath id="${u}-cb"><rect x="80"  y="184" width="260" height="16"/></clipPath>
        <clipPath id="${u}-cl"><rect x="100" y="35"  width="16"  height="120"/></clipPath>
      </defs>

      <!-- ── Pipe routes (hot: top+right, cold: bottom+left) ── -->
      <!-- top: Verdichter → Kondensator (hot gas) -->
      <line x1="180" y1="28" x2="380" y2="28" class="ph"/>
      <!-- right: Kondensator → Expansionsventil (hot liquid) -->
      <line x1="532" y1="68" x2="532" y2="152" class="ph"/>
      <!-- bottom: Expansionsventil → Verdampfer (cold mix) -->
      <line x1="380" y1="192" x2="180" y2="192" class="pc"/>
      <!-- left: Verdampfer → Verdichter (cold gas) -->
      <line x1="108" y1="152" x2="108" y2="68" class="pc"/>

      <!-- Corner connectors -->
      <path d="M 380,28 Q 532,28 532,68"  class="ph" fill="none"/>
      <path d="M 532,152 Q 532,192 380,192" class="ph" fill="none"/>
      <path d="M 180,192 Q 108,192 108,152" class="pc" fill="none"/>
      <path d="M 108,68 Q 108,28 180,28" class="pc" fill="none"/>

      <!-- Flow arrows -->
      <polygon points="270,24 285,28 270,32" class="ah"/>
      <polygon points="528,116 532,132 536,116" class="ah"/>
      <polygon points="270,196 255,192 270,188" class="ac"/>
      <polygon points="112,84 108,68 104,84" class="ac"/>

      <!-- ── Component boxes ── -->

      <!-- Verdichter (compressor) — left side, center -->
      <rect x="110" y="68" width="70" height="84" rx="6" class="box-cl"/>
      <!-- compressor piston symbol -->
      <rect x="128" y="90" width="34" height="40" rx="2" style="fill:none;stroke:#1D9E75;stroke-width:1;"/>
      <line x1="145" y1="90" x2="145" y2="78" style="stroke:#1D9E75;stroke-width:2;"/>
      <rect x="133" y="74" width="24" height="6" rx="2" style="fill:#1D9E75;"/>
      <text x="145" y="143" text-anchor="middle" class="comp-lbl">VERDICHTER</text>
      <text x="145" y="155" text-anchor="middle" id="tComp" class="val" style="font-size:12px;">–</text>

      <!-- Kondensator (condenser) — right side, center -->
      <rect x="400" y="35" width="130" height="150" rx="6" class="box-ht"/>
      <!-- heat exchanger lines -->
      <line x1="420" y1="55"  x2="510" y2="55"  style="stroke:#BA7517;stroke-width:.8;opacity:.5;"/>
      <line x1="420" y1="70"  x2="510" y2="70"  style="stroke:#BA7517;stroke-width:.8;opacity:.5;"/>
      <line x1="420" y1="85"  x2="510" y2="85"  style="stroke:#BA7517;stroke-width:.8;opacity:.5;"/>
      <line x1="420" y1="100" x2="510" y2="100" style="stroke:#BA7517;stroke-width:.8;opacity:.5;"/>
      <line x1="420" y1="115" x2="510" y2="115" style="stroke:#BA7517;stroke-width:.8;opacity:.5;"/>
      <text x="465" y="140" text-anchor="middle" class="comp-lbl">KONDENSATOR</text>
      <!-- Vorlauf / Rücklauf -->
      <text x="413" y="158" class="lbl">VL</text>
      <text x="413" y="173" class="lbl" style="fill:#5dcaa5;">RL</text>
      <text x="510" y="158" text-anchor="end" id="tVL" class="val" style="font-size:12px;fill:#EF9F27;">–</text>
      <text x="510" y="173" text-anchor="end" id="tRL" class="val" style="font-size:12px;fill:#5DCAA5;">–</text>
      <!-- arrows out to heating system -->
      <line x1="530" y1="150" x2="600" y2="150" style="stroke:#EF9F27;stroke-width:1.5;stroke-dasharray:4,3;"/>
      <line x1="600" y1="165" x2="530" y2="165" style="stroke:#5DCAA5;stroke-width:1.5;stroke-dasharray:4,3;"/>
      <polygon points="595,145 605,150 595,155" style="fill:#EF9F27;"/>
      <polygon points="535,160 525,165 535,170" style="fill:#5DCAA5;"/>
      <text x="610" y="154" class="lbl">VL</text>
      <text x="610" y="169" class="lbl" style="fill:#5dcaa5;">RL</text>

      <!-- Verdampfer (evaporator) — bottom center -->
      <rect x="190" y="168" width="180" height="44" rx="6" class="box-cl"/>
      <line x1="210" y1="181" x2="350" y2="181" style="stroke:#1D9E75;stroke-width:.8;opacity:.5;"/>
      <line x1="210" y1="192" x2="350" y2="192" style="stroke:#1D9E75;stroke-width:.8;opacity:.5;"/>
      <line x1="210" y1="203" x2="350" y2="203" style="stroke:#1D9E75;stroke-width:.8;opacity:.5;"/>
      <text x="280" y="220" text-anchor="middle" class="comp-lbl">VERDAMPFER</text>
      <!-- outdoor temp label -->
      <text x="280" y="216" text-anchor="middle" id="tOutdoor" class="val" style="font-size:11px;display:none;">–</text>

      <!-- Expansionsventil — bottom right corner area -->
      <text x="490" y="197" text-anchor="middle" class="comp-lbl">EXPANSION</text>
      <!-- triangle symbol -->
      <polygon points="480,170 500,170 490,185" style="fill:none;stroke:#BA7517;stroke-width:1.2;"/>
      <line x1="490" y1="185" x2="490" y2="200" style="stroke:#BA7517;stroke-width:1.2;"/>

      <!-- Labels: high / low pressure side -->
      <text x="320" y="18" text-anchor="middle" style="font-size:8px;fill:#BA7517;letter-spacing:.08em;">HOCHDRUCK  ·  HEISSGAS</text>
      <text x="320" y="208" text-anchor="middle" style="font-size:8px;fill:#1D9E75;letter-spacing:.08em;">NIEDERDRUCK  ·  KÄLTEMITTEL</text>

      <!-- Animated particles: clip to pipe segments -->
      <!-- top (hot) left→right -->
      <g clip-path="url(#${u}-ct)">
        <circle cx="80" cy="28" r="3" class="ph-dot p1"/>
        <circle cx="80" cy="28" r="3" class="ph-dot p1b"/>
      </g>
      <!-- right (hot) top→bottom -->
      <g clip-path="url(#${u}-cr)">
        <circle cx="532" cy="35" r="3" class="ph-dot p2"/>
        <circle cx="532" cy="35" r="3" class="ph-dot p2b"/>
      </g>
      <!-- bottom (cold) right→left -->
      <g clip-path="url(#${u}-cb)">
        <circle cx="340" cy="192" r="3" class="pc-dot p3"/>
        <circle cx="340" cy="192" r="3" class="pc-dot p3b"/>
      </g>
      <!-- left (cold) bottom→top -->
      <g clip-path="url(#${u}-cl)">
        <circle cx="108" cy="155" r="3" class="pc-dot p4"/>
        <circle cx="108" cy="155" r="3" class="pc-dot p4b"/>
      </g>
    </svg>
  </div>

  <!-- Heizung metrics -->
  <div class="sec-lbl">HEIZUNG</div>
  <div class="mets" id="metsH">
    <div class="met">
      <div class="ml">Innentemperatur</div>
      <div class="mv" id="mRoom">–</div>
      <div class="mu">aktuell</div>
    </div>
    <div class="met">
      <div class="ml">Vorlauf</div>
      <div class="mv" id="mVL">–</div>
      <div class="mu">Heizkreis</div>
    </div>
    <div class="met">
      <div class="ml">Rücklauf</div>
      <div class="mv" id="mRL">–</div>
      <div class="mu">Heizkreis</div>
    </div>
    <div class="met">
      <div class="ml">Auslastung Komp.</div>
      <div class="mv" id="mComp">–</div>
      <div class="mu" id="mCompSub">–</div>
    </div>
  </div>

  <!-- Warmwasser metrics -->
  <div class="sec-lbl" style="margin-top:8px;">WARMWASSER</div>
  <div class="mets" id="metsWW">
    <div class="met">
      <div class="ml">Warmwasser</div>
      <div class="mv" id="mHW">–</div>
      <div class="mu">Ist-Temperatur</div>
    </div>
    <div class="met">
      <div class="ml">Bedarf</div>
      <div class="mv" id="mDem" style="font-size:14px;">–</div>
      <div class="mu" id="mDemSub"></div>
    </div>
    <div class="met">
      <div class="ml">Luftfeuchtigkeit</div>
      <div class="mv" id="mHum">–</div>
      <div class="mu" id="mDew">–</div>
    </div>
    <div class="met">
      <div class="ml">Taupunkt</div>
      <div class="mv" id="mDewPt">–</div>
      <div class="mu">aktuell</div>
    </div>
  </div>

  <!-- Controls -->
  <div class="ctls">
    <div class="ctl">
      <div class="cl">Modus Heizen/Kühlen</div>
      <select id="selMode"><option value="">–</option></select>
    </div>
    <div class="ctl">
      <div class="cl">Modus Warmwasser</div>
      <select id="selHWMode"><option value="">–</option></select>
    </div>
    <div class="ctl">
      <div class="cl">Zirkulation</div>
      <div class="tog">
        <span id="circLabel" style="font-size:13px;font-family:monospace;">AUS</span>
        <label class="sw">
          <input type="checkbox" id="circToggle"/>
          <span class="sl"></span>
        </label>
      </div>
    </div>
    <div class="ctl">
      <div class="cl">Zirkulations-Intervall</div>
      <select id="selCircInt"><option value="">–</option></select>
    </div>
  </div>

</div>`;

    // Mode select
    this._initSelect('selMode',    'mode');
    this._initSelect('selHWMode',  'hot_water_mode');
    this._initSelect('selCircInt', 'circulation_interval');

    // Circulation toggle
    const tog = this.shadowRoot.getElementById('circToggle');
    tog.addEventListener('change', () => {
      const eid = this._config?.entities?.circulation;
      if (!eid || !this._hass) return;
      this._hass.callService('switch', tog.checked ? 'turn_on' : 'turn_off', { entity_id: eid });
    });

    this._built = true;
  }

  _initSelect(elId, entityKey) {
    const el = this.shadowRoot.getElementById(elId);
    el.addEventListener('change', () => {
      if (el.value) this._hass?.callService('select', 'select_option', {
        entity_id: this._config?.entities?.[entityKey],
        option: el.value,
      });
    });
  }

  // ── Live update ───────────────────────────────────────────────────────────

  _update() {
    if (!this._hass || !this._config || !this._built) return;
    const sr = this.shadowRoot;
    const $ = id => sr.getElementById(id);

    // Mode / badge
    const mode = this._mode();
    const badge = $('badge');
    if (badge) {
      badge.className = 'badge ' + (
        mode === 'heat' || mode === 'heating' ? 'heat' :
        mode === 'cool' || mode === 'cooling' ? 'cool' : 'off'
      );
    }
    if ($('btext')) {
      const labels = { heat:'Heizen', heating:'Heizen', cool:'Kühlen', cooling:'Kühlen', off:'Aus', auto:'Auto' };
      $('btext').textContent = labels[mode] ?? mode ?? '–';
    }

    // Compressor speed → particle animation speed
    const compPct = parseFloat(this._stv('compressor_load', '0'));
    const sv = $('sv');
    if (sv) {
      const sp = compPct > 0 ? Math.max(0.8, 4 - compPct / 30) : 99;
      sv.style.setProperty('--sp', sp.toFixed(1) + 's');
      compPct === 0 ? sv.classList.add('off-anim') : sv.classList.remove('off-anim');
    }

    // SVG temperature readouts
    const tVL = this._temp('flow_temp');
    const tRL = this._temp('return_temp');
    if ($('tVL'))   $('tVL').textContent = tVL;
    if ($('tRL'))   $('tRL').textContent = tRL;
    if ($('tComp')) $('tComp').textContent = this._pct('compressor_load');

    // Metric cards — heating
    if ($('mRoom')) $('mRoom').textContent = this._currentTemp();
    if ($('mVL'))   $('mVL').textContent   = tVL;
    if ($('mRL'))   $('mRL').textContent   = tRL;
    if ($('mComp')) $('mComp').textContent = this._pct('compressor_load');
    if ($('mCompSub')) $('mCompSub').textContent = 'Auslastung: ' + this._num('load');

    // Metric cards — hot water
    if ($('mHW'))   $('mHW').textContent   = this._temp('hot_water_temp');
    const demand = this._isOn('hot_water_demand');
    if ($('mDem'))    { $('mDem').textContent = demand ? 'AKTIV' : 'KEIN'; $('mDem').style.color = demand ? '#EF9F27' : ''; }
    if ($('mDemSub')) $('mDemSub').textContent = demand ? 'Aufheizung läuft' : 'Solltemperatur erreicht';
    if ($('mHum'))    $('mHum').textContent = this._num('humidity', '%');
    if ($('mDewPt'))  $('mDewPt').textContent = this._temp('dew_point');

    // Controls
    this._updateSelect('selMode',    'mode');
    this._updateSelect('selHWMode',  'hot_water_mode');
    this._updateSelect('selCircInt', 'circulation_interval');

    const circOn = this._isOn('circulation');
    const tog = sr.getElementById('circToggle');
    if (tog) tog.checked = circOn;
    const cl = sr.getElementById('circLabel');
    if (cl) cl.textContent = circOn ? 'AN' : 'AUS';
  }

  _updateSelect(elId, entityKey) {
    const el = this.shadowRoot.getElementById(elId);
    const st = this._st(entityKey);
    if (!el || !st) return;
    const opts = st.attributes?.options ?? [];
    if (opts.length && el.options.length - 1 !== opts.length)
      el.innerHTML = '<option value="">–</option>' + opts.map(o => `<option value="${o}">${o}</option>`).join('');
    if (el.value !== st.state) el.value = st.state;
  }
}

if (!customElements.get('heat-pump-card')) {
  customElements.define('heat-pump-card', HeatPumpCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type:        'heat-pump-card',
    name:        'Heat Pump Card',
    description: 'Refrigeration cycle schematic for heat pumps (Buderus, Viessmann, Nibe, …)',
    preview:     true,
  });
}
