# Calculated Data in the Sail Instrument

This plugin calculates missing data from the data that is supplied to AvNav.

## Calculated Data

- magnetic variation - is calculated at current position based on the [World Magnetic Model](https://www.ncei.noaa.gov/products/world-magnetic-model).
- true heading - from magnetic heading and variation
- set and drift - from ground track and water track
- depth below surface - from depth below transducer and configured depth of transducer
- true and ground wind - from apparent wind and course data
- TODO: leeway estimation

The formulas used for the calculation are best [read directly in the code](Sail_Instrument/plugin.py:628).

All [calculated](plugin.py:282) and [input](plugin.py:32) values are available in AvNav under `gps.calculated.*`. It reads its input data from the AvNav data model, after NMEA parsing hase been done by AvNav.

It also can write [NMEA sentences](plugin.py:58), which are parsed by AvNav itself and are forwarded to NMEA outputs.

![sketch](vectors.svg)

## Equations

### Heading

$$ HDT = HDM + VAR $$

### Leeway and Course

$$ LEE = LEF \cdot HEL / STW^2 $$

$$ CRS = HDT + LEE $$

With leeway factor \$LEF = 0..20\$, boat specific

### Tide

$$ [SET,DFT] = [COG,SOG] \oplus [CRS,-STW] $$

### Wind

angles and directions are always converted like

$$ [TWA,TWS] = [AWA,AWS] \oplus [LEE,-STW] $$

$$ TWD = TWA + HDT $$

$$ [GWD,GWS] = [AWA+HDT,AWS] \oplus [COG,-SOG] $$

### Depth

$$ DBS = DBT + DOT$$

$$ DBK = DBS - DRT $$

The \$\oplus\$ operator denotes the [addition of polar vectors](https://math.stackexchange.com/questions/1365622/adding-two-polar-vectors).

### Definitions

| quantity | description                                                                                                          |
|----------|----------------------------------------------------------------------------------------------------------------------|
| HDG      | heading, unspecified which of the following                                                                          |
| HDT      | true heading, direction bow is pointing to, relative to true north (also HDGt)                                       |
| HDM      | magnetic heading, as reported by a calibrated compass (also HDGm)                                                    |
| HDC      | compass heading, raw reading of the compass (also HDGc)                                                              |
| VAR      | magnetic variation, given in chart or computed from model                                                            |
| DEV      | magnetic deviation, boat specific, depends on HDG                                                                    |
| COG      | course over ground, usually from GPS                                                                                 |
| SOG      | speed over ground, usually from GPS                                                                                  |
| SET      | set, direction of tide/current, cannot be measured directly                                                          |
| DFT      | drift, rate of tide/current, cannot be measured directly                                                             |
| STW      | speed through water, usually from paddle wheel, water speed vector projected onto HDT (long axis of boat)            |
| HEL      | heel angle, measured by sensor or from heel polar TWA/TWS -> HEL                                                     |
| LEE      | leeway angle, angle between HDT and direction of water speed vector, usually estimated from wind and/or heel and STW |
| CRS      | course through water                                                                                                 |
| AWA      | apparent wind angle, measured by wind direction sensor                                                               |
| AWD      | apparent wind direction, relative to true north                                                                      |
| AWS      | apparent wind speed, measured by anemometer                                                                          |
| TWA      | true wind angle, relative to water, relative to HDT                                                                  |
| TWD      | true wind direction, relative to water, relative true north                                                          |
| TWS      | true wind speed, relative to water                                                                                   |
| GWA      | ground wind angle, relative to ground, relative to HDT                                                               |
| GWD      | ground wind direction, relative to ground, relative true north                                                       |
| GWS      | ground wind speed, relative to ground                                                                                |
| DBS      | depth below surface                                                                                                  |
| DBT      | depth below transducer                                                                                               |
| DBK      | depth below keel                                                                                                     |
| DRT      | draught                                                                                                              |
| DOT      | depth of transducer                                                                                                  |