# Calculated Data

The plugin calculates true wind, ground wind, set and drift. It needs COG/SOG, HDT/STW and AWA/AWS as input data. If HDT/STW is missing it uses COG/SOG as fallback (you get ground wind instead of true wind, and the direction is wrong if HDT!=COG). If you do not have a wind sensor, you can enter ground wind in the settings for testing purposes.

What is calculated by this plugin?

- magnetic variation - is calculated at current position based on the [World Magnetic Model](https://www.ncei.noaa.gov/products/world-magnetic-model).
- true heading - from magnetic heading and variation
- set and drift - from ground track and water track
- depth below surface - from depth below transducer and configured depth of transducer
- true and ground wind - from apparent wind and course data
- leeway is estimated

How the calculation is done and the formulas used as well definitions of the several quantities, is [documented in the code itself](../Sail_Instrument/plugin.py#L640) and described below.

The values calculated by the plugin are published in AvNav as `gps.sail_instrument.*`.
Optionally the plugin can [emit NMEA sentences](../Sail_Instrument/plugin.py#L114) to make the computed data available to other devices. If decoding of own NMEA sentences is enabled, these data are fed back into AvNav, get parsed and written to their standard paths in `gps.*`. The plugin does not read the values it has computed to avoid a loop.

The following values are computed or copied from their sources.

- Quantity = short name used in formulas and `gps.sail_instrument.*` path
- Description = explanation of the meaning of the quantity
- AvNav-Path = standard AvNav path of this quantity
- NMEA = NMEA sentences that this quantity appears in

| Quantity | Description                                                                   | AvNav-Path               | NMEA    |
|----------|-------------------------------------------------------------------------------|--------------------------|---------|  
| AWA      | apparent wind angle, measured by wind direction sensor                        | gps.windAngle            | MWV     |
| AWAF     | apparent wind angle, smoothed                                                 |                          |         |
| AWD      | apparent wind direction, relative to true north                               |                          |         |
| AWDF     | apparent wind direction, smoothed                                             |                          |         |
| AWS      | apparent wind speed, measured by anemometer                                   | gps.windSpeed            | MWV     |
| AWSF     | apparent wind speed smoothed                                                  |                          |         |
| COG      | course over ground, usually from GPS                                          | gps.track                | RMC,VTG |
| CRS      | course through water, calculated                                              |                          |         |
| DBK      | depth below keel                                                              | gps.depthBelowKeel       | DBK     |
| DBS      | depth below surface                                                           | gps.depthBelowWaterline  | DBS     |
| DBT      | depth below transducer                                                        | gps.depthBelowTransducer | DBT     |
| DEV      | magnetic deviation, boat specific, depends on HDG                             | gps.magDeviation         | HDG     |
| DFT      | tide drift rate, calculated                                                   | gps.currentDrift         | VDR     |
| DFTF     | tide drift rate, smoothed                                                     |                          |         |
| DOT      | depth of transducer                                                           |                          |         |
| DRT      | draught                                                                       |                          |         |
| GWA      | ground wind angle, relative to ground, relative to HDT                        |                          |         |
| GWD      | ground wind direction, relative to ground, relative true north                |                          |         |
| GWS      | ground wind speed, relative to ground                                         |                          |         |
| HDC      | compass heading, raw reading of the compass (aka HDGc)                        | gps.headingCompass       | HDG     |
| HDM      | magnetic heading, as reported by a calibrated compass (aka HDGm)              | gps.headingMag           | HDG,HDM |
| HDT      | true heading, direction bow is pointing to, relative to true north (aka HDGt) | gps.headingTrue          | HDT,VHW |
| HEL      | heel angle, measured by sensor or from heel polar TWA/TWS -> HEL              |                          |         |
| LAT      | Latitude                                                                      | gps.lat                  | RMC,GLL |
| LAY      | layline angle, rel. to TWD                                                    |                          |         |
| LEE      | leeway angle, angle between HDT and CRS                                       |                          |         |
| LEF      | leeway factor                                                                 |                          |         |
| LON      | Longitude                                                                     | gps.lon                  | RMC,GLL |
| POLAR    | Polar Speeds Vector                                                           |                          |         |
| SET      | set, direction of tide/current, calculated                                    | gps.currentSet           | VDR     |
| SETF     | tide set direction filtered                                                   |                          |         |
| SOG      | speed over ground, usually from GPS                                           | gps.speed                | RMC,VTG |
| STW      | speed through water, usually from paddle wheel, water speed along HDT         | gps.waterSpeed           | VHW     |
| TWA      | true wind angle, relative to water, relative to HDT                           | gps.trueWindAngle        | MWV     |
| TWAF     | true wind angle, smoothed                                                     |                          |         |
| TWD      | true wind direction, relative to water, relative true north                   | gps.trueWindDirection    | MWD     |
| TWDF     | true wind direction smoothed                                                  |                          |         |
| TWDMAX   | max true wind direction relative                                              |                          |         |
| TWDMIN   | min true wind direction relative                                              |                          |         |
| TWS      | true wind speed, relative to water                                            | gps.trueWindSpeed        | MWD     |
| TWSF     | true wind speed, smoothed                                                     |                          |         |
| VAR      | magnetic variation, given in chart or computed from model                     | gps.magVariation         | HDG     |
| VMCA     | optimum VMC direction (course)                                                |                          |         |
| VMCB     | optimum VMC direction (opposite tack)                                         |                          |         |
| VMG      | velocity made good upwind                                                     |                          |         |
| VMC      | velocity made good on course                                                  |                          |         |
| VPOL     | speed from polar                                                              |                          |         |

## Magnetic Variation

The plugin is able to calculate the [magnetic variation](https://en.wikipedia.org/wiki/Magnetic_declination) at your current position.
It is using the [World Magnetic Model](https://www.ncei.noaa.gov/products/world-magnetic-model).
The WMM2020 Coefficient file ([wmm2020.cof](../Sail_Instrument/lib/WMM2020.COF)) valid for 2020 - 2025 is included in the software package. The calculation is done with the [geomag-library](https://github.com/cmweiss/geomag). The coefficient file and the library are located in the [`lib` subdirectory](../Sail_Instrument/lib).

## Polar Speed

![polar charts](Images/polar.png)

You have to provide polar data for your boat in `avnav/user/viewer/polar.json` for the calculation of the laylines, polar speed and optimum VMC course. If there is no such file, the plugin will copy [an example file](../Sail_Instrument/polar.json) to this location, and you can use it as a template for your own polar data.

If you do not have any polar data, you can enter tack and gybe angle in the plugin configuration and use these fixed values instead.

A source for polar data can be [ORC sailboat data](https://jieter.github.io/orc-data/site/) or [Seapilot.com](https://www.seapilot.com/features/download-polar-files/).

## Laylines

To understand the technical background of the [laylines](https://en.wikipedia.org/wiki/Layline) one has first to have an understanding of the terms VMG and VMC.

- **VMG** - _Velocity Made Good against
  wind_ is defined as `VMG = boatspeed * cos(TWA)` boatspeed vector projected onto true wind direction
- **VMC** - _Velocity Made good on
  Course_ is defined as `VMC = boatspeed * cos(BRG-HDG)` boatspeed vector projected onto direction to waypoint

Unfortunately there is a lot of confusion on these two terms and also most of the commercial products are mixing the two items and indicate VMG but actually showing VMC (and so does AvNav).

The laylines are computed from the `beat_angle` and `run_angle` vectors in the polar file, which contain a mapping of TWS to TWA for maximum VMG. As a result the laylines show the optimal TWA to travel upwind in general, but not the optimal TWA to get towards the waypoint.
Optionally it is also possible to calculate the laylines from the STW matrix.

![VMC polar diagram](Images/vmc.png)

From the `STW` matrix in the polar data, which is a mapping of TWS and TWA to STW, one can calculate the _optimal
TWA_ (red) such that _VMC is maximised_ (purple).

## Equations

![course data vectors](Images/vectors.svg)

### Depth Data

The computation of depth is very straight forward, you enter `draught` and `depth_transducer` in the plugin configuration and depth below surface (DBS) and depth below keel (DBK) are computed.

$$ DBS = DBT + DOT $$

$$ DBK = DBS - DRT $$

### Heading

True heading is computed from magnetic heading and magnetic variation. To get magnetic heading from a compass, you have to correct for compass deviation (DEV) as well. The value of DEV depends on the heading. A self calibrating electronic compass usually gives you magnetic or even true heading directly.

$$ HDT = HDM + VAR = HDC + DEV + VAR $$

### Magnetic Directions

All directions, except HDM, are relative to true north. This is because a magnetic compass gives you a magnetic direction (heading or bearing). You convert it to true using deviation and variation and that's it.

You could use something like COG magnetic, but it does not make any sense and is error-prone.
Don't do this! If you do need this, then do the conversion to magnetic at the very end by subtracting variation, after all calculations are done.

$$ d_{mag} = d_{true} - VAR $$

### Course

Course through water is simply heading plus leeway angle, this is the direction the boat actually moves through the water.

$$ CRS = HDT + LEE $$

### Leeway estimation

The leeway angle is [estimated from heel and STW](https://opencpn-manuals.github.io/main/tactics/index.html#_2_2_calculate_leeway) as

$$ LEE = LEF \cdot HEL / STW^2 $$

With LEF being a boat specific factor from within (0,20). Heel could be a measured value (either from `signalk.navigation.attitude.roll` or a specific transducer in `gps.transducers.ROLL`). If this data is not available it is interpolated from the heel polar in [`avnav/user/viewer/heel.json`](../Sail_Instrument/heel.json). As the `polar.json` it contains an interpolation table to map TWA/TWS to heel angle HEL.

### Speed Vectors

The computation of speed vectors is somewhat more complex since it involves the addition of vectors in polar representation.

The \$\oplus\$ operator denotes the [addition of polar vectors](https://math.stackexchange.com/questions/1365622/adding-two-polar-vectors).

Vectors with direction D and length S are *added* with

$$ [D,S]_+ = [D_1,S_1] \oplus [D_2,S_2] $$

and can be subtracted using the same operator by reversing the direction of the second vector

$$ [D,S]_- = [D_1,S_1] \oplus [D_2,-S_2]  = [D_1,S_1] \oplus [D_2+180°,S_2] $$

### Tide

The tide or current vector (speed of water over ground) can be estimated as the difference of COG and SOG obtained from GPS and heading from compass + estimated leeway and water speed from the paddle wheel log.

$$ [SET,DFT] = [COG,SOG] \oplus [CRS,-STW] $$

This equation corresponds to the triangle/parallelogram on the right side of the boat in the sketch above, .

### Wind

- AWS = Apparent Wind Speed = wind speed relativ to boat, measured by the wind sensor
- AWA = Apparent Wind Angle = angle between the direction of apparent wind (where it comes from) and direction the bow is pointing to (heading), measured by the wind sensor
- AWD = Apparent Wind Direction = direction of the wind relative to true north (usually not used)
- TWS = True Wind Speed = wind speed relative to the surface of the water, true wind is calculated from apparent wind, heading, waterspeed (and leeway)
- TWA = True Wind Angle = angle between the direction of the true wind and heading
- TWD = True Wind Direction = direction of the true wind relative to true north
- GWS = Ground Wind Speed = wind speed relative to the ground, ground wind is calculated from apparent wind, heading, course and speed over ground, in the weather forecast
- GWA = Ground Wind Angle = angle between the direction of the ground wind and heading (usually not used)
- GWD = Ground Wind Direction = direction of the ground wind relative to true north, in the weather forecast

 In general, angles (xxA, relative to heading) and directions (xxD rel. to true north) are always converted by adding/subtracting true heading HDT.

$$ xxD = xxA + HDT, xxA = xxD - HDT $$

True wind, which is the wind vector relative to water, can be obtained from apparent wind measured by the wind meter (direction and speed) and water speed. To get the angle right, leeway also enters the equation.

$$ [TWA,TWS] = [AWA,AWS] \oplus [LEE,-STW] $$

To get the true wind direction from the angle, just add true heading.

$$ TWD = TWA + HDT $$

To calculate ground wind (wind vector relative to ground), we use course and speed over ground instead. To convert apparent wind angle to a direction, again, just add true heading.

$$ [GWD,GWS] = [AWA+HDT,AWS] \oplus [COG,-SOG] $$

These equations correspond to the left triangle (actually the same triangle) in the sketch above connecting the wind speed vectors.
