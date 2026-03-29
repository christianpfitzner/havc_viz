'use strict';

class HeatPumpCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._uid   = 'hp' + Math.random().toString(36).slice(2, 7);
    this._config = null;
    this._hass   = null;
    this._built  = false;
  }

  static getStubConfig() {
    return {
      title: 'Wärmepumpe',
      entities: {
        thermostat:           'climate.thermostat_hc1',
        flow_temp:            'sensor.boiler_curflowtemp',
        return_temp:          'sensor.boiler_rettemp',
        mode:                 'select.boiler_hppumpmode',
        compressor_load:      'sensor.boiler_curburnpow',
        hot_water_temp:       'sensor.boiler_wwcurtemp',
        hot_water_demand:     'binary_sensor.warmwasserbedarf',
        hot_water_mode:       'select.boiler_wwcomfort1',
        circulation:          'switch.boiler_wwcircpump',
        circulation_interval: 'select.boiler_wwcircmode',
        humidity:             'sensor.thermostat_hc1_airhumidity',
        dew_point:            'sensor.thermostat_hc1_dewtemperature',
      },
    };
  }

  setConfig(config) {
    if (!config.entities) throw new Error('heat-pump-card: "entities" required');
    this._config = config;
    this._build();
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._built) this._update();
  }

  getCardSize()      { return 7; }
  getLayoutOptions() { return { grid_columns: 4, grid_rows: 4 }; }

  _st(k)  { const e = this._config?.entities?.[k]; return e ? this._hass?.states?.[e] ?? null : null; }
  _stv(k, fb = null) { return this._st(k)?.state ?? fb; }
  _ok(k)  { const v = this._stv(k); return v && v !== 'unavailable' && v !== 'unknown'; }
  _isOn(k){ const v = this._stv(k,'off'); return ['on','true','1'].includes(v); }

  _temp(k) {
    if (!this._ok(k)) return '–';
    const n = parseFloat(this._stv(k));
    return isNaN(n) ? this._stv(k) : (Math.round(n * 10) / 10) + '°C';
  }

  _pct(k) {
    if (!this._ok(k)) return '–';
    const n = parseFloat(this._stv(k));
    return isNaN(n) ? this._stv(k) : Math.round(n) + '%';
  }

  _roomTemp() {
    const cl = this._st('thermostat');
    if (cl?.attributes?.current_temperature != null)
      return (Math.round(cl.attributes.current_temperature * 10) / 10) + '°C';
    return this._temp('flow_temp');
  }

  _modeLabel() {
    const cl = this._st('thermostat');
    const raw = cl && !['unavailable','unknown'].includes(cl.state) ? cl.state : this._stv('mode','');
    const m = { heat:'Heizen', heating:'Heizen', cool:'Kühlen', cooling:'Kühlen', off:'Aus', auto:'Auto' };
    return m[raw] ?? raw ?? '–';
  }

  _modeClass() {
    const cl = this._st('thermostat');
    const raw = cl && !['unavailable','unknown'].includes(cl.state) ? cl.state : this._stv('mode','');
    if (['heat','heating'].includes(raw)) return 'badge-heat';
    if (['cool','cooling'].includes(raw)) return 'badge-cool';
    return 'badge-off';
  }

  _build() {
    const u = this._uid;
    this.shadowRoot.innerHTML = `
<style>
:host{display:block;width:100%;}
*{box-sizing:border-box;margin:0;padding:0;}
.card{
  width:100%;container-type:inline-size;
  background:var(--ha-card-background,var(--card-background-color,#fff));
  border-radius:var(--ha-card-border-radius,12px);
  box-shadow:var(--ha-card-box-shadow,none);
  padding:20px 24px;
  font-family:var(--primary-font-family,system-ui,sans-serif);
  color:var(--primary-text-color,#111);
}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}
.hdr-l{display:flex;align-items:center;gap:10px;}
.dot{width:10px;height:10px;border-radius:50%;background:#EF9F27;flex-shrink:0;}
.dot.off{background:var(--secondary-text-color,#888);}
.title{font-size:17px;font-weight:500;}
.badge{font-size:13px;font-weight:500;padding:5px 14px;border-radius:20px;}
.badge-heat{background:#FAEEDA;color:#633806;}
.badge-cool{background:#E6F1FB;color:#0C447C;}
.badge-off{background:var(--secondary-background-color,#f5f5f5);color:var(--secondary-text-color,#888);}
.schema{background:var(--secondary-background-color,#f7f7f7);border-radius:10px;padding:20px 20px 14px;margin-bottom:18px;}
svg{display:block;width:100%;overflow:visible;}
.ph{stroke:#EF9F27;stroke-width:9;fill:none;stroke-linecap:round;}
.pc{stroke:#1D9E75;stroke-width:9;fill:none;stroke-linecap:round;}
.pw{stroke:#378ADD;stroke-width:5;fill:none;stroke-linecap:round;stroke-dasharray:7,4;}
.bx-h{fill:#FAEEDA;stroke:#EF9F27;stroke-width:0.5;}
.bx-c{fill:#E1F5EE;stroke:#1D9E75;stroke-width:0.5;}
.bx-n{fill:var(--card-background-color,#fff);stroke:var(--divider-color,#ddd);stroke-width:0.5;}
.t-comp{font-size:11px;fill:var(--secondary-text-color,#888);letter-spacing:.07em;}
.t-big{font-size:18px;font-weight:500;font-family:monospace;}
.t-med{font-size:15px;font-weight:500;font-family:monospace;}
.t-sm{font-size:11px;fill:var(--secondary-text-color,#888);}
.t-hot{fill:#854F0B;}.t-cold{fill:#085041;}.t-blue{fill:#185FA5;}
.t-pri{fill:var(--primary-text-color,#111);}.t-sec{fill:var(--secondary-text-color,#888);}
.met-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px;}
@container(max-width:480px){
  .met-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .ctl-grid{grid-template-columns:1fr 1fr !important;}
}
.met{background:var(--secondary-background-color,#f7f7f7);border-radius:8px;padding:13px 14px;}
.met-lbl{font-size:11px;color:var(--secondary-text-color,#888);margin-bottom:5px;letter-spacing:.04em;}
.met-val{font-size:26px;font-weight:500;font-family:monospace;line-height:1;color:var(--primary-text-color,#111);}
.met-unit{font-size:11px;color:var(--secondary-text-color,#888);margin-top:4px;}
.div{border:none;border-top:0.5px solid var(--divider-color,#e0e0e0);margin:14px 0;}
.ctl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
.ctl{background:var(--secondary-background-color,#f7f7f7);border-radius:8px;padding:13px 14px;}
.ctl-lbl{font-size:11px;color:var(--secondary-text-color,#888);margin-bottom:8px;letter-spacing:.04em;}
select{
  width:100%;background:var(--card-background-color,#fff);
  border:0.5px solid var(--divider-color,#ccc);border-radius:6px;
  padding:9px 10px;font-size:14px;color:var(--primary-text-color,#111);font-family:inherit;
}
select:focus{outline:none;}
.tog-row{display:flex;align-items:center;justify-content:space-between;padding-top:2px;}
.tog-txt{font-size:16px;font-weight:500;font-family:monospace;color:var(--secondary-text-color,#888);}
.tog-txt.on{color:var(--primary-text-color,#111);}
.tog-pill{width:46px;height:26px;border-radius:13px;background:var(--divider-color,#ccc);position:relative;cursor:pointer;transition:background .18s;flex-shrink:0;}
.tog-pill.on{background:#1D9E75;}
.tog-knob{position:absolute;top:4px;left:4px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .18s;}
.tog-pill.on .tog-knob{transform:translateX(20px);}
@keyframes fRight{from{transform:translateX(-12px)}to{transform:translateX(480px)}}
@keyframes fDown{from{transform:translateY(-12px)}to{transform:translateY(170px)}}
@keyframes fLeft{from{transform:translateX(480px)}to{transform:translateX(-12px)}}
@keyframes fUp{from{transform:translateY(170px)}to{transform:translateY(-12px)}}
.p-hot{fill:#EF9F27;}.p-cold{fill:#1D9E75;}
.pa{animation-timing-function:linear;animation-iteration-count:infinite;}
.pa-off{animation-play-state:paused;opacity:0;}
</style>
<div class="card">
  <div class="hdr">
    <div class="hdr-l">
      <div class="dot" id="dot"></div>
      <span class="title">${this._config.title ?? 'Wärmepumpe'}</span>
    </div>
    <span class="badge badge-off" id="badge">–</span>
  </div>
  <div class="schema">
    <svg id="sv" viewBox="0 0 620 200">
      <defs>
        <clipPath id="${u}-t"><rect x="150" y="42" width="250" height="16"/></clipPath>
        <clipPath id="${u}-r"><rect x="470" y="65" width="16" height="100"/></clipPath>
        <clipPath id="${u}-b"><rect x="150" y="142" width="250" height="16"/></clipPath>
        <clipPath id="${u}-l"><rect x="104" y="65" width="16" height="100"/></clipPath>
      </defs>
      <path d="M 150,50 L 390,50" class="ph"/>
      <path d="M 415,72 L 415,128" class="ph"/>
      <path d="M 390,50 Q 415,50 415,72" class="ph"/>
      <path d="M 390,150 L 150,150" class="pc"/>
      <path d="M 112,128 L 112,72" class="pc"/>
      <path d="M 150,150 Q 112,150 112,128" class="pc"/>
      <path d="M 112,72 Q 112,50 150,50" class="pc"/>
      <path d="M 455,100 L 560,100" class="pw"/>
      <polygon points="552,95 562,100 552,105" fill="#378ADD"/>
      <polygon points="256,44 271,50 256,56" fill="#EF9F27"/>
      <polygon points="411,116 415,132 419,116" fill="#EF9F27"/>
      <polygon points="284,156 269,150 284,144" fill="#1D9E75"/>
      <polygon points="116,84 112,68 108,84" fill="#1D9E75"/>
      <rect x="72" y="72" width="80" height="56" rx="8" class="bx-c"/>
      <text x="112" y="95" text-anchor="middle" class="t-comp t-cold">Verdichter</text>
      <text x="112" y="116" text-anchor="middle" class="t-big t-cold" id="svComp">–</text>
      <rect x="375" y="58" width="80" height="84" rx="8" class="bx-h"/>
      <text x="415" y="78" text-anchor="middle" class="t-comp t-hot">Kondensator</text>
      <text x="379" y="98" class="t-sm t-hot">VL</text>
      <text x="451" y="98" text-anchor="end" class="t-med t-hot" id="svVL">–</text>
      <text x="379" y="118" class="t-sm t-cold">RL</text>
      <text x="451" y="118" text-anchor="end" class="t-med t-cold" id="svRL">–</text>
      <text x="379" y="136" class="t-sm t-blue">WW</text>
      <text x="451" y="136" text-anchor="end" class="t-med t-blue" id="svHW">–</text>
      <text x="562" y="90" class="t-sm t-blue">Warmwasser</text>
      <text x="562" y="115" class="t-med t-blue" id="svHWtemp">–</text>
      <rect x="175" y="132" width="150" height="36" rx="8" class="bx-c"/>
      <text x="250" y="148" text-anchor="middle" class="t-comp t-cold">Verdampfer</text>
      <text x="250" y="163" text-anchor="middle" class="t-sm t-cold" id="svOutdoor">Außen</text>
      <rect x="330" y="140" width="44" height="24" rx="6" class="bx-n"/>
      <text x="352" y="150" text-anchor="middle" class="t-comp t-sec" style="font-size:9px;">Expansion</text>
      <text x="352" y="160" text-anchor="middle" class="t-comp t-sec" style="font-size:9px;">ventil</text>
      <text x="262" y="36" text-anchor="middle" class="t-sm t-hot" style="letter-spacing:.1em;">Hochdruck</text>
      <text x="262" y="176" text-anchor="middle" class="t-sm t-cold" style="letter-spacing:.1em;">Niederdruck</text>
      <g clip-path="url(#${u}-t)">
        <circle cx="150" cy="50" r="4" class="p-hot pa" id="pt1" style="animation-name:fRight"/>
        <circle cx="150" cy="50" r="4" class="p-hot pa" id="pt2" style="animation-name:fRight"/>
      </g>
      <g clip-path="url(#${u}-r)">
        <circle cx="415" cy="65" r="4" class="p-hot pa" id="pr1" style="animation-name:fDown"/>
        <circle cx="415" cy="65" r="4" class="p-hot pa" id="pr2" style="animation-name:fDown"/>
      </g>
      <g clip-path="url(#${u}-b)">
        <circle cx="390" cy="150" r="4" class="p-cold pa" id="pb1" style="animation-name:fLeft"/>
        <circle cx="390" cy="150" r="4" class="p-cold pa" id="pb2" style="animation-name:fLeft"/>
      </g>
      <g clip-path="url(#${u}-l)">
        <circle cx="112" cy="128" r="4" class="p-cold pa" id="pl1" style="animation-name:fUp"/>
        <circle cx="112" cy="128" r="4" class="p-cold pa" id="pl2" style="animation-name:fUp"/>
      </g>
    </svg>
  </div>
  <div class="met-grid">
    <div class="met"><div class="met-lbl">Innentemperatur</div><div class="met-val" id="mRoom">–</div><div class="met-unit">°C · aktuell</div></div>
    <div class="met"><div class="met-lbl">Vorlauf</div><div class="met-val" style="color:#854F0B" id="mVL">–</div><div class="met-unit">°C</div></div>
    <div class="met"><div class="met-lbl">Rücklauf</div><div class="met-val" style="color:#085041" id="mRL">–</div><div class="met-unit">°C</div></div>
    <div class="met"><div class="met-lbl">Kompressor</div><div class="met-val" id="mComp">–</div><div class="met-unit">Auslastung</div></div>
  </div>
  <div class="met-grid" style="margin-bottom:0">
    <div class="met"><div class="met-lbl">Warmwasser</div><div class="met-val" style="color:#185FA5" id="mHW">–</div><div class="met-unit">°C · Ist</div></div>
    <div class="met"><div class="met-lbl">WW-Bedarf</div><div class="met-val" style="font-size:18px" id="mDem">–</div><div class="met-unit" id="mDemSub"></div></div>
    <div class="met"><div class="met-lbl">Luftfeuchte</div><div class="met-val" id="mHum">–</div><div class="met-unit">%</div></div>
    <div class="met"><div class="met-lbl">Taupunkt</div><div class="met-val" id="mDew">–</div><div class="met-unit">°C</div></div>
  </div>
  <hr class="div">
  <div class="ctl-grid">
    <div class="ctl"><div class="ctl-lbl">Modus Heizen / Kühlen</div><select id="selMode"><option value="">–</option></select></div>
    <div class="ctl"><div class="ctl-lbl">Warmwasser-Modus</div><select id="selHW"><option value="">–</option></select></div>
    <div class="ctl">
      <div class="ctl-lbl">Zirkulation</div>
      <div class="tog-row">
        <span class="tog-txt" id="circTxt">Aus</span>
        <div class="tog-pill" id="togCirc"><div class="tog-knob"></div></div>
      </div>
    </div>
  </div>
</div>`;

    this._initSelect('selMode','mode');
    this._initSelect('selHW','hot_water_mode');
    this.shadowRoot.getElementById('togCirc').addEventListener('click', () => {
      const eid = this._config?.entities?.circulation;
      if (!eid || !this._hass) return;
      this._hass.callService('switch', this._isOn('circulation') ? 'turn_off' : 'turn_on', { entity_id: eid });
    });
    this._built = true;
  }

  _initSelect(elId, key) {
    this.shadowRoot.getElementById(elId).addEventListener('change', e => {
      const eid = this._config?.entities?.[key];
      if (eid && e.target.value)
        this._hass?.callService('select','select_option',{entity_id:eid,option:e.target.value});
    });
  }

  _update() {
    if (!this._hass || !this._config || !this._built) return;
    const sr = this.shadowRoot;
    const $  = id => sr.getElementById(id);

    const mc = this._modeClass();
    const badge = $('badge');
    if (badge) { badge.textContent = this._modeLabel(); badge.className = 'badge ' + mc; }
    const dot = $('dot');
    if (dot) dot.className = 'dot' + (mc === 'badge-off' ? ' off' : '');

    const pct = parseFloat(this._stv('compressor_load','0')) || 0;
    const sp  = pct > 0 ? Math.max(0.6, 3.5 - pct / 35).toFixed(1) : '99';
    const spStr = sp + 's';
    [['pt1','pt2'],['pr1','pr2']].flat().forEach((id,i) => {
      const el = $(id); if (!el) return;
      el.className.baseVal = pct === 0 ? 'p-hot pa pa-off' : 'p-hot pa';
      el.style.animationDuration = spStr;
      el.style.animationDelay   = i%2===1 ? `calc(${spStr}*-.5)` : '0s';
    });
    [['pb1','pb2'],['pl1','pl2']].flat().forEach((id,i) => {
      const el = $(id); if (!el) return;
      el.className.baseVal = pct === 0 ? 'p-cold pa pa-off' : 'p-cold pa';
      el.style.animationDuration = spStr;
      el.style.animationDelay   = i%2===1 ? `calc(${spStr}*-.5)` : '0s';
    });

    const fmt1 = k => this._ok(k) ? parseFloat(this._stv(k)).toFixed(1) : '–';
    const fmt0 = k => this._ok(k) ? Math.round(parseFloat(this._stv(k))) + '%' : '–';

    if ($('svVL'))     $('svVL').textContent     = this._temp('flow_temp');
    if ($('svRL'))     $('svRL').textContent     = this._temp('return_temp');
    if ($('svHW'))     $('svHW').textContent     = this._temp('hot_water_temp');
    if ($('svHWtemp')) $('svHWtemp').textContent = this._temp('hot_water_temp');
    if ($('svComp'))   $('svComp').textContent   = this._pct('compressor_load');

    if ($('mRoom')) $('mRoom').textContent = fmt1('thermostat') !== '–' ? fmt1('thermostat') : this._roomTemp().replace('°C','');
    const cl = this._st('thermostat');
    if ($('mRoom') && cl?.attributes?.current_temperature != null)
      $('mRoom').textContent = (Math.round(cl.attributes.current_temperature*10)/10).toFixed(1);
    if ($('mVL'))   $('mVL').textContent   = fmt1('flow_temp');
    if ($('mRL'))   $('mRL').textContent   = fmt1('return_temp');
    if ($('mComp')) $('mComp').textContent = fmt0('compressor_load');
    if ($('mHW'))   $('mHW').textContent   = fmt1('hot_water_temp');

    const dem = this._isOn('hot_water_demand');
    if ($('mDem'))    { $('mDem').textContent = dem ? 'Aktiv' : 'Kein'; $('mDem').style.color = dem ? '#854F0B':''; }
    if ($('mDemSub')) $('mDemSub').textContent = dem ? 'Aufheizung läuft' : 'Solltemp. erreicht';
    if ($('mHum'))    $('mHum').textContent = this._ok('humidity') ? Math.round(parseFloat(this._stv('humidity'))) : '–';
    if ($('mDew'))    $('mDew').textContent = fmt1('dew_point');

    this._syncSelect('selMode','mode');
    this._syncSelect('selHW','hot_water_mode');

    const circOn = this._isOn('circulation');
    const pill   = $('togCirc');
    if (pill) circOn ? pill.classList.add('on') : pill.classList.remove('on');
    const ctxt = $('circTxt');
    if (ctxt) { ctxt.textContent = circOn ? 'An' : 'Aus'; ctxt.className = 'tog-txt'+(circOn?' on':''); }
  }

  _syncSelect(elId, key) {
    const el = this.shadowRoot.getElementById(elId);
    const st = this._st(key);
    if (!el || !st) return;
    const opts = st.attributes?.options ?? [];
    if (opts.length && el.options.length-1 !== opts.length)
      el.innerHTML = '<option value="">–</option>' + opts.map(o=>`<option value="${o}">${o}</option>`).join('');
    if (el.value !== st.state) el.value = st.state;
  }
}

customElements.define('heat-pump-card', HeatPumpCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type:'heat-pump-card', name:'Heat Pump Card',
  description:'Refrigeration cycle schematic + controls for heat pumps', preview:true,
});
