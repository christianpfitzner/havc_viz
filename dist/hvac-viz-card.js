'use strict';

// ─── HVAC Viz Card ────────────────────────────────────────────────────────────
// Lovelace custom card with animated airflow schematic for heat-recovery
// ventilation units (Dantherm / Pluggit iFlow / Fränkische profi-air).
//
// Repo: https://github.com/<you>/hvac-viz
// ─────────────────────────────────────────────────────────────────────────────

const FAN_DURATIONS = [99, 5, 3, 1.8, 1]; // animation speed per level

class HvacVizCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._uid = 'hv' + Math.random().toString(36).slice(2, 6);
    this._config = null;
    this._hass = null;
    this._built = false;
  }

  // ── Lovelace API ─────────────────────────────────────────────────────────

  static getStubConfig() {
    return {
      title: 'profi-air 130 flat',
      host: '192.168.1.42',
      fan_level_options: ['0', '1', '2', '3', '4'],
      entities: {
        fan_level:     'select.profi_air_fan_level',
        mode:          'select.profi_air_operation_mode',
        bypass:        'binary_sensor.profi_air_bypass_damper',
        frost_heater:  'binary_sensor.profi_air_frost_protection',
        temp_supply:   'sensor.profi_air_supply_air_temperature',
        temp_exhaust:  'sensor.profi_air_exhaust_air_temperature',
        temp_outdoor:  'sensor.profi_air_outdoor_air_temperature',
        temp_extract:  'sensor.profi_air_return_air_temperature',
        flow:          'sensor.profi_air_supply_air_flow',
        filter:        'binary_sensor.profi_air_filter_change',
      },
    };
  }

  setConfig(config) {
    if (!config.entities) throw new Error('hvac-viz: "entities" is required');
    this._config = {
      fan_level_options: ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4'],
      ...config,
    };
    this._build();
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._built) this._update();
  }

  getCardSize() { return 5; }


  getLayoutOptions() {
  return {
    grid_columns: 2,   // Standard-Spaltenbreite vorschlagen
    grid_rows: 3,
  };
}

  // ── State helpers ─────────────────────────────────────────────────────────

  _st(key) {
    const eid = this._config?.entities?.[key];
    return eid ? this._hass?.states?.[eid] ?? null : null;
  }

  _stv(key, fallback = null) {
    return this._st(key)?.state ?? fallback;
  }

  _isOn(key) {
    const v = this._stv(key, 'off');
    return v === 'on' || v === 'true' || v === '1';
  }

  _isUnavail(key) {
    const v = this._stv(key);
    return !v || v === 'unavailable' || v === 'unknown';
  }

  _temp(key) {
    if (this._isUnavail(key)) return '–';
    const n = parseFloat(this._stv(key));
    if (isNaN(n)) return this._stv(key);
    const unit = this._st(key)?.attributes?.unit_of_measurement ?? '°C';
    return Math.round(n) + unit;
  }

  _fanLevelIndex() {
    const v = this._stv('fan_level', '');
    const idx = this._config.fan_level_options.indexOf(v);
    return idx;        // −1 if not found / unavailable
  }

  _callSelect(entityKey, option) {
    const eid = this._config?.entities?.[entityKey];
    if (!eid || !this._hass) return;
    this._hass.callService('select', 'select_option', {
      entity_id: eid,
      option,
    });
  }

  // ── DOM build (called once per config change) ─────────────────────────────

  _build() {
    const u = this._uid;
    const opts = this._config.fan_level_options;

    this.shadowRoot.innerHTML = `
<style>
  :host { display: block; }
  * { box-sizing: border-box; }

  .card {
    background: var(--card-background-color, #fff);
    border-radius: 12px;
    padding: 16px;
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    color: var(--primary-text-color, #111);
  }

  /* Header */
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .title { font-size:15px; font-weight:500; }
  .sub { font-size:11px; color:var(--secondary-text-color,#888); font-family:monospace; margin-top:2px; }
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; padding: 4px 10px; border-radius: 8px;
    background: #e1f5ee; color: #0f6e56;
  }
  .badge.offline { background: #fce8e8; color: #a33; }
  .bdot { width:5px; height:5px; border-radius:50%; background:currentColor; }

  /* Diagram */
  .diag {
    background: var(--secondary-background-color, #f5f4f0);
    border-radius: 10px; margin-bottom: 12px; overflow: hidden;
  }

  /* Metrics 2×2 */
  .mets { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:12px; }
  .met { background:var(--secondary-background-color,#f5f4f0); border-radius:8px; padding:10px 12px; }
  .ml { font-size:10px; color:var(--secondary-text-color,#888); margin-bottom:2px; letter-spacing:.05em; }
  .mv { font-size:19px; font-weight:500; font-family:monospace; line-height:1.1; }
  .mu { font-size:10px; color:var(--secondary-text-color,#888); margin-top:2px; }

  /* Controls */
  .ctls { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .ctl { background:var(--secondary-background-color,#f5f4f0); border-radius:8px; padding:10px 12px; }
  .cl { font-size:10px; color:var(--secondary-text-color,#888); margin-bottom:6px; letter-spacing:.05em; }
  .fan { display:flex; gap:4px; }
  .fb {
    flex:1; padding:6px 2px;
    border:.5px solid var(--divider-color,#ccc); border-radius:6px;
    background:transparent; cursor:pointer;
    font-family:monospace; font-size:13px;
    color:var(--secondary-text-color,#888);
  }
  .fb:hover { background:var(--card-background-color,#fff); }
  .fb.on { background:#dbeeff; color:#1a5fa8; border-color:transparent; font-weight:500; }
  select {
    width:100%; padding:6px 8px;
    border:.5px solid var(--divider-color,#ccc); border-radius:6px;
    background:var(--card-background-color,#fff);
    font-size:13px; color:var(--primary-text-color,#111);
    font-family:inherit;
  }

  /* SVG elements */
  .sv-unit { fill:var(--card-background-color,#fff); stroke:var(--divider-color,#ccc); stroke-width:.8; }
  .sv-ds { fill:#c8ede0; } .sv-de { fill:#fde9c4; }
  .sv-hxbg { fill:var(--card-background-color,#fff); }
  .sv-ls { stroke:#1D9E75; stroke-width:1.5; fill:none; }
  .sv-le { stroke:#BA7517; stroke-width:1.5; fill:none; }
  .sv-as { fill:#1D9E75; } .sv-ae { fill:#BA7517; }
  .sv-ps { fill:#0F6E56; } .sv-pe { fill:#BA7517; }
  .sv-tmp { font-size:12px; font-family:monospace; fill:var(--primary-text-color,#111); }
  .sv-pl { font-size:9px; fill:var(--secondary-text-color,#888); letter-spacing:.07em; }

  /* Bypass arc */
  .bp-off { fill:none; stroke:var(--divider-color,#ccc); stroke-width:1.2; stroke-dasharray:5,4; }
  .bp-on  { fill:none; stroke:#1D9E75; stroke-width:2; }

  /* Inline heater */
  .ht-r { fill:var(--secondary-background-color,#f0f0f0); stroke:var(--divider-color,#ccc); stroke-width:.8; }
  .ht-l { stroke:var(--divider-color,#ccc); stroke-width:.7; }
  .ht-act .ht-r { fill:#FAEEDA; stroke:#BA7517; stroke-width:1.2; }
  .ht-act .ht-l { stroke:#BA7517; }

  /* Particle groups (visibility controlled via JS) */
</style>

<div class="card">

  <!-- Header -->
  <div class="hdr">
    <div>
      <div class="title">${this._config.title || 'HVAC'}</div>
      <div class="sub" id="sub">${this._config.host ? this._config.host + ' · Modbus TCP' : ''}</div>
    </div>
    <span class="badge" id="badge">
      <span class="bdot"></span>
      <span id="btext">–</span>
    </span>
  </div>

  <!-- Airflow schematic -->
  <div class="diag">
    <svg id="sv" viewBox="0 0 640 190" width="100%" style="display:block;">
      <defs>
        <clipPath id="${u}-cS"><rect x="0" y="50" width="640" height="38"/></clipPath>
        <clipPath id="${u}-cE"><rect x="0" y="113" width="640" height="38"/></clipPath>
        <pattern id="${u}-hxP" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <line x1="0" y1="10" x2="10" y2="0" stroke="#888" stroke-width=".5" stroke-opacity=".2"/>
        </pattern>
      </defs>

      <!-- External duct lines -->
      <line x1="104" y1="69"  x2="120" y2="69"  class="sv-ls"/>
      <line x1="520" y1="69"  x2="640" y2="69"  class="sv-ls"/>
      <line x1="0"   y1="132" x2="120" y2="132" class="sv-le"/>
      <line x1="520" y1="132" x2="640" y2="132" class="sv-le"/>

      <!-- Inline pre-heater (AUL side) -->
      <g id="htGrp">
        <rect x="0" y="63" width="104" height="12" rx="2" class="ht-r"/>
        <line x1="14" y1="63" x2="14" y2="75" class="ht-l"/>
        <line x1="26" y1="63" x2="26" y2="75" class="ht-l"/>
        <line x1="38" y1="63" x2="38" y2="75" class="ht-l"/>
        <line x1="50" y1="63" x2="50" y2="75" class="ht-l"/>
        <line x1="62" y1="63" x2="62" y2="75" class="ht-l"/>
        <line x1="74" y1="63" x2="74" y2="75" class="ht-l"/>
        <line x1="86" y1="63" x2="86" y2="75" class="ht-l"/>
      </g>
      <text id="htLbl" x="52" y="60" text-anchor="middle"
            style="font-size:8px;letter-spacing:.06em;fill:#aaa;">HEIZUNG</text>

      <!-- Unit housing -->
      <rect x="120" y="20" width="400" height="158" rx="4" class="sv-unit"/>

      <!-- Duct fills -->
      <rect x="120" y="50"  width="400" height="38" class="sv-ds"/>
      <rect x="120" y="113" width="400" height="38" class="sv-de"/>

      <!-- Heat exchanger -->
      <rect x="265" y="20" width="110" height="158" rx="2" class="sv-hxbg"/>
      <rect x="265" y="20" width="110" height="158" rx="2"
            style="fill:url(#${u}-hxP);stroke:var(--divider-color,#bbb);stroke-width:1.5;"/>

      <!-- Bypass arc (over HX block) -->
      <path id="bpPath" d="M 265,69 C 265,28 375,28 375,69" class="bp-off"/>
      <text id="bpLbl" x="320" y="27" text-anchor="middle"
            style="font-size:8px;letter-spacing:.06em;fill:var(--divider-color,#bbb);">BYPASS</text>

      <!-- Flow direction arrows  supply → -->
      <polygon points="187,64 200,69 187,74" class="sv-as"/>
      <polygon points="423,64 436,69 423,74" class="sv-as"/>
      <!-- Flow direction arrows  extract ← -->
      <polygon points="453,127 440,132 453,137" class="sv-ae"/>
      <polygon points="217,127 204,132 217,137" class="sv-ae"/>

      <!-- Port marker dots -->
      <circle cx="120" cy="69"  r="4" class="sv-ps"/>
      <circle cx="520" cy="69"  r="4" class="sv-ps"/>
      <circle cx="520" cy="132" r="4" class="sv-pe"/>
      <circle cx="120" cy="132" r="4" class="sv-pe"/>

      <!-- Temperature readouts (dynamic) -->
      <text x="630" y="62"  text-anchor="end" class="sv-tmp" id="tZUL">–</text>
      <text x="10"  y="148"               class="sv-tmp" id="tFOL">–</text>
      <text x="630" y="148" text-anchor="end" class="sv-tmp" id="tABLv">–</text>

      <!-- Port labels (AUL and ABL include outdoor/extract temps inline) -->
      <text x="52"  y="84"  text-anchor="middle"  class="sv-pl" id="tAULlbl">AUL  –</text>
      <text x="630" y="80"  text-anchor="end"      class="sv-pl">ZUL</text>
      <text x="10"  y="124"                        class="sv-pl">FOL</text>
      <text x="630" y="124" text-anchor="end"      class="sv-pl" id="tABLlbl">ABL  –</text>

      <!-- Animated airflow particles (SVG animateTransform scales with viewBox) -->
      <g clip-path="url(#${u}-cS)" id="${u}-ptcS">
        <circle cy="69" r="3" class="sv-ps"><animateTransform attributeName="transform" type="translate" from="-20 0" to="680 0" dur="3s" begin="0s" repeatCount="indefinite"/></circle>
        <circle cy="69" r="3" class="sv-ps"><animateTransform attributeName="transform" type="translate" from="-20 0" to="680 0" dur="3s" begin="-0.75s" repeatCount="indefinite"/></circle>
        <circle cy="69" r="3" class="sv-ps"><animateTransform attributeName="transform" type="translate" from="-20 0" to="680 0" dur="3s" begin="-1.5s" repeatCount="indefinite"/></circle>
        <circle cy="69" r="3" class="sv-ps"><animateTransform attributeName="transform" type="translate" from="-20 0" to="680 0" dur="3s" begin="-2.25s" repeatCount="indefinite"/></circle>
      </g>
      <g clip-path="url(#${u}-cE)" id="${u}-ptcE">
        <circle cy="132" r="3" class="sv-pe"><animateTransform attributeName="transform" type="translate" from="660 0" to="-20 0" dur="3s" begin="0s" repeatCount="indefinite"/></circle>
        <circle cy="132" r="3" class="sv-pe"><animateTransform attributeName="transform" type="translate" from="660 0" to="-20 0" dur="3s" begin="-0.75s" repeatCount="indefinite"/></circle>
        <circle cy="132" r="3" class="sv-pe"><animateTransform attributeName="transform" type="translate" from="660 0" to="-20 0" dur="3s" begin="-1.5s" repeatCount="indefinite"/></circle>
        <circle cy="132" r="3" class="sv-pe"><animateTransform attributeName="transform" type="translate" from="660 0" to="-20 0" dur="3s" begin="-2.25s" repeatCount="indefinite"/></circle>
      </g>
    </svg>
  </div>

  <!-- Status metrics -->
  <div class="mets">
    <div class="met">
      <div class="ml">Bypass-Klappe</div>
      <div class="mv" id="mBP">–</div>
      <div class="mu" id="mBPsub">–</div>
    </div>
    <div class="met">
      <div class="ml">Zuluftheizung</div>
      <div class="mv" id="mHT">–</div>
      <div class="mu" id="mHTsub">–</div>
    </div>
    <div class="met">
      <div class="ml">Volumenstrom</div>
      <div class="mv" id="mFlow">–</div>
      <div class="mu" id="mFlowUnit">m³/h</div>
    </div>
    <div class="met">
      <div class="ml">Filterstatus</div>
      <div class="mv" id="mFilt" style="font-size:14px;">–</div>
      <div class="mu" id="mFiltSub"></div>
    </div>
  </div>

  <!-- Controls -->
  <div class="ctls">
    <div class="ctl">
      <div class="cl">Lüftungsstufe</div>
      <div class="fan" id="fanWrap">
        ${opts.map((_, i) => `<button class="fb" data-idx="${i}">${i}</button>`).join('')}
      </div>
    </div>
    <div class="ctl">
      <div class="cl">Betriebsart</div>
      <select id="modeSelect"><option value="">–</option></select>
    </div>
  </div>

</div>`;

    // Event listeners
    this.shadowRoot.querySelectorAll('.fb').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const opt = this._config.fan_level_options[idx];
        if (opt != null) this._callSelect('fan_level', opt);
      });
    });

    const modeEl = this.shadowRoot.getElementById('modeSelect');
    modeEl.addEventListener('change', () => {
      if (modeEl.value) this._callSelect('mode', modeEl.value);
    });

    this._built = true;
  }

  // ── Live update (called on every hass change) ─────────────────────────────

  _update() {
    if (!this._hass || !this._config || !this._built) return;
    const sr = this.shadowRoot;
    const $ = id => sr.getElementById(id);

    // ── Connection status
    const fanSt = this._st('fan_level');
    const online = !!fanSt && !['unavailable', 'unknown'].includes(fanSt.state);
    const badge = $('badge');
    if (badge) badge.className = online ? 'badge' : 'badge offline';
    const btext = $('btext');
    if (btext) btext.textContent = online ? 'verbunden' : 'offline';

    // ── Temperatures
    const tZUL = this._temp('temp_supply');
    const tFOL = this._temp('temp_exhaust');
    const tAUL = this._temp('temp_outdoor');
    const tABL = this._temp('temp_extract');

    if ($('tZUL'))    $('tZUL').textContent = tZUL;
    if ($('tFOL'))    $('tFOL').textContent = tFOL;
    if ($('tABLv'))   $('tABLv').textContent = tABL;
    if ($('tAULlbl')) $('tAULlbl').textContent = `AUL  ${tAUL}`;
    if ($('tABLlbl')) $('tABLlbl').textContent = `ABL  ${tABL}`;

    // ── Fan level → particle speed + button highlight
    const fanIdx = this._fanLevelIndex();
    const ptcS = sr.getElementById(`${this._uid}-ptcS`);
    const ptcE = sr.getElementById(`${this._uid}-ptcE`);
    if (fanIdx <= 0) {
      if (ptcS) ptcS.style.opacity = '0';
      if (ptcE) ptcE.style.opacity = '0';
    } else {
      if (ptcS) ptcS.style.opacity = '';
      if (ptcE) ptcE.style.opacity = '';
      const fd = (fanIdx < FAN_DURATIONS.length) ? FAN_DURATIONS[fanIdx] : 3;
      [ptcS, ptcE].forEach(grp => {
        if (!grp) return;
        grp.querySelectorAll('animateTransform').forEach(anim => {
          anim.setAttribute('dur', fd + 's');
        });
      });
    }
    sr.querySelectorAll('.fb').forEach(btn => {
      btn.classList.toggle('on', parseInt(btn.dataset.idx) === fanIdx);
    });

    // ── Mode select: populate options from entity attributes if available
    const modeEl = $('modeSelect');
    const modeSt = this._st('mode');
    if (modeEl && modeSt) {
      const options = modeSt.attributes?.options ?? [];
      if (options.length && modeEl.options.length !== options.length) {
        modeEl.innerHTML = options
          .map(o => `<option value="${o}">${o}</option>`)
          .join('');
      }
      if (modeEl.value !== modeSt.state) modeEl.value = modeSt.state;
    }

    // ── Flow
    const flowSt = this._st('flow');
    if ($('mFlow')) {
      if (flowSt && !['unavailable','unknown'].includes(flowSt.state)) {
        const n = parseFloat(flowSt.state);
        $('mFlow').textContent = isNaN(n) ? flowSt.state : Math.round(n);
        const unit = flowSt.attributes?.unit_of_measurement ?? 'm³/h';
        if ($('mFlowUnit')) $('mFlowUnit').textContent = unit;
      } else {
        $('mFlow').textContent = '–';
      }
    }

    // ── Bypass
    const bypass = this._isOn('bypass');
    if ($('mBP')) {
      $('mBP').textContent = bypass ? 'AUF' : 'ZU';
      $('mBP').style.color = bypass ? '#1a5fa8' : '';
    }
    if ($('mBPsub'))
      $('mBPsub').textContent = bypass
        ? 'Sommerbetrieb — HX inaktiv'
        : 'Wärmerückgewinnung aktiv';
    const bpPath = $('bpPath');
    if (bpPath) bpPath.className.baseVal = bypass ? 'bp-on' : 'bp-off';
    const bpLbl = $('bpLbl');
    if (bpLbl) bpLbl.style.fill = bypass ? '#1D9E75' : 'var(--divider-color,#bbb)';

    // ── Frost heater
    const heater = this._isOn('frost_heater');
    if ($('mHT')) {
      $('mHT').textContent = heater ? 'AKTIV' : 'AUS';
      $('mHT').style.color = heater ? '#854F0B' : '';
    }
    if ($('mHTsub'))
      $('mHTsub').textContent = heater ? 'Frostschutz aktiv' : 'Frostschutz inaktiv';
    const htGrp = $('htGrp');
    if (htGrp) heater ? htGrp.classList.add('ht-act') : htGrp.classList.remove('ht-act');
    const htLbl = $('htLbl');
    if (htLbl) htLbl.style.fill = heater ? '#BA7517' : '#aaa';

    // ── Filter
    const filterDirty = this._isOn('filter');
    if ($('mFilt')) {
      $('mFilt').textContent   = filterDirty ? 'WECHSELN' : 'OK';
      $('mFilt').style.color   = filterDirty ? '#a33'     : '#0f6e56';
    }
    if ($('mFiltSub'))
      $('mFiltSub').textContent = filterDirty ? 'Filter verschmutzt' : '';
  }
}

customElements.define('hvac-viz-card', HvacVizCard);

// Register for HACS / Lovelace card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type:        'hvac-viz-card',
  name:        'HVAC Viz',
  description: 'Animated airflow schematic for heat-recovery ventilation units',
  preview:     true,
});
