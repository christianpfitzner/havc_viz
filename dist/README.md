# HVAC Viz

Lovelace custom card with animated airflow schematic for heat-recovery ventilation (HRV/MVHR) units integrated via the [Dantherm integration](https://github.com/Tvalley71/dantherm) (Modbus TCP).

Tested with **Fränkische profi-air 130 flat** via the Dantherm HACS integration.
Should also work with Pluggit iFlow, Dantherm HCV, Bosch Vent 5000, and other Dantherm-compatible units.

---

## Features

- Animated supply / extract airflow particles (speed reflects actual fan level)
- Inline pre-heater symbol activates on frost protection
- Bypass arc highlights in summer bypass mode
- Temperature readouts for all four ports (AUL / ZUL / ABL / FOL)
- Live bypass-damper and frost-heater status cards
- Fan level buttons and operation-mode selector with direct service calls

---

## Installation via HACS

1. In HACS → **Frontend** → three-dot menu → **Custom repositories**
2. Add `https://github.com/<your-username>/hvac-viz` → category **Lovelace**
3. Install **HVAC Viz**
4. Add the resource (HACS usually does this automatically):
   ```yaml
   url: /hacsfiles/hvac-viz/hvac-viz-card.js
   type: module
   ```
5. Restart Home Assistant (or reload resources)

---

## Manual installation

```bash
# copy to your HA www folder
cp hvac-viz-card.js config/www/hvac-viz-card.js
```

Add to `configuration.yaml`:
```yaml
lovelace:
  resources:
    - url: /local/hvac-viz-card.js
      type: module
```

---

## Card configuration

```yaml
type: custom:hvac-viz-card
title: profi-air 130 flat
host: 192.168.1.42               # optional – shown in sub-header
fan_level_options:               # option strings from your select entity
  - "Level 0"
  - "Level 1"
  - "Level 2"
  - "Level 3"
  - "Level 4"
entities:
  fan_level:     select.profi_air_fan_level
  mode:          select.profi_air_operation_mode
  bypass:        binary_sensor.profi_air_bypass_damper
  frost_heater:  binary_sensor.profi_air_frost_protection
  temp_supply:   sensor.profi_air_supply_air_temperature    # ZUL
  temp_exhaust:  sensor.profi_air_exhaust_air_temperature   # FOL
  temp_outdoor:  sensor.profi_air_outdoor_air_temperature   # AUL
  temp_extract:  sensor.profi_air_return_air_temperature    # ABL
  flow:          sensor.profi_air_supply_air_flow
  filter:        binary_sensor.profi_air_filter_change
```

All `entities` keys are optional — omit any entity your device does not expose.

### Entity mapping table

| Config key    | Description                          | Domain          |
|---------------|--------------------------------------|-----------------|
| `fan_level`   | Fan speed level (controls + display) | `select`        |
| `mode`        | Operating mode                       | `select`        |
| `bypass`      | Bypass damper open/closed            | `binary_sensor` |
| `frost_heater`| Supply air pre-heater active         | `binary_sensor` |
| `temp_supply` | Supply air temperature (ZUL)        | `sensor`        |
| `temp_exhaust`| Exhaust air temperature (FOL)       | `sensor`        |
| `temp_outdoor`| Outdoor air temperature (AUL)       | `sensor`        |
| `temp_extract`| Extract air temperature (ABL)       | `sensor`        |
| `flow`        | Volumetric flow rate                 | `sensor`        |
| `filter`      | Filter change required               | `binary_sensor` |

---

## Finding your entity IDs (Dantherm integration)

Go to **Settings → Devices & Services → Dantherm → your device → Entities**.
Entity names vary by device model and firmware. The Dantherm integration page lists all exposed entities.

---

## License

MIT

---

## heat-pump-card

Refrigeration cycle schematic for heat pumps. Shows the full Kältekreis loop (Verdampfer → Verdichter → Kondensator → Expansionsventil) with animated refrigerant flow, live temperatures, and controls.

### Features

- Animated refrigerant particles (speed tracks compressor load)
- Vorlauf / Rücklauf displayed on condenser block and heating-circuit outputs
- Hot water demand, mode, and circulation toggle
- Humidity / dew point metrics
- Mode, hot water mode, and circulation interval selectors

### Configuration

```yaml
type: custom:heat-pump-card
title: Wärmepumpe
entities:
  thermostat:           climate.buderus
  flow_temp:            sensor.vorlauftemperatur
  return_temp:          sensor.rucklauf
  mode:                 select.modus_heizen_kuhlen
  compressor_load:      sensor.auslastung_kompressor
  load:                 sensor.auslastung
  hot_water_temp:       sensor.warmwasser
  hot_water_demand:     binary_sensor.warmwasserbedarf
  hot_water_mode:       select.modus_warmwasser
  circulation:          switch.zirkulation
  circulation_interval: select.zirkulation_intervall
  humidity:             sensor.luftfeuchtigkeit
  dew_point:            sensor.taupunkt
```

### Entity mapping

| Config key             | Description                    | Domain          |
|------------------------|--------------------------------|-----------------|
| `thermostat`           | Climate entity (temp + mode)   | `climate`       |
| `flow_temp`            | Supply / Vorlauf temperature   | `sensor`        |
| `return_temp`          | Return / Rücklauf temperature  | `sensor`        |
| `mode`                 | Heat/Cool mode selector        | `select`        |
| `compressor_load`      | Compressor utilisation (%)     | `sensor`        |
| `load`                 | Overall system load            | `sensor`        |
| `hot_water_temp`       | DHW tank temperature           | `sensor`        |
| `hot_water_demand`     | DHW demand active              | `binary_sensor` |
| `hot_water_mode`       | DHW mode selector              | `select`        |
| `circulation`          | Circulation pump on/off        | `switch`        |
| `circulation_interval` | Circulation interval selector  | `select`        |
| `humidity`             | Indoor humidity                | `sensor`        |
| `dew_point`            | Dew point temperature          | `sensor`        |

All keys are optional.
