HVAC Viz

Lovelace custom card with animated airflow schematic for heat-recovery ventilation (HRV/MVHR) units integrated via the Dantherm integration (Modbus TCP).
Tested with Fränkische profi-air 130 flat via the Dantherm HACS integration.
Should also work with Pluggit iFlow, Dantherm HCV, Bosch Vent 5000, and other Dantherm-compatible units.
---
Features
Animated supply / extract airflow particles (speed reflects actual fan level)
Inline pre-heater symbol activates on frost protection
Bypass arc highlights in summer bypass mode
Temperature readouts for all four ports (AUL / ZUL / ABL / FOL)
Live bypass-damper and frost-heater status cards
Fan level buttons and operation-mode selector with direct service calls
---
Installation via HACS
In HACS → Frontend → three-dot menu → Custom repositories
Add `https://github.com/<your-username>/hvac-viz` → category Lovelace
Install HVAC Viz
Add the resource (HACS usually does this automatically):
```yaml
   url: /hacsfiles/hvac-viz/hvac-viz-card.js
   type: module
   ```
Restart Home Assistant (or reload resources)
---
Manual installation
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
Card configuration
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
Entity mapping table
Config key	Description	Domain
`fan_level`	Fan speed level (controls + display)	`select`
`mode`	Operating mode	`select`
`bypass`	Bypass damper open/closed	`binary_sensor`
`frost_heater`	Supply air pre-heater active	`binary_sensor`
`temp_supply`	Supply air temperature (ZUL)	`sensor`
`temp_exhaust`	Exhaust air temperature (FOL)	`sensor`
`temp_outdoor`	Outdoor air temperature (AUL)	`sensor`
`temp_extract`	Extract air temperature (ABL)	`sensor`
`flow`	Volumetric flow rate	`sensor`
`filter`	Filter change required	`binary_sensor`
---
Finding your entity IDs (Dantherm integration)
Go to Settings → Devices & Services → Dantherm → your device → Entities.
Entity names vary by device model and firmware. The Dantherm integration page lists all exposed entities.
---
License
MIT
