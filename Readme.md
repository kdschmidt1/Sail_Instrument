# Sail_Instrument AvNav-Plugin

![widget overlay](Images/widget.png)

The idea of this [plugin for AvNav](https://www.wellenvogel.net/software/avnav/docs/hints/plugins.html) is to display an instrument, that contains all basic information needed for sailing.
The Instrument is inspired by B&G's sailsteer.  
With the possibility to show the instrument directly on the map at the boat position the sailor has all information in view.
The laylines will inform you about the course for optimal VMG upwind and if displayed on the map you can follow these lines.
There is a good description of what you can do with it at [blauwasser.de](https://www.blauwasser.de/navigation/app-sailsteer-bandg) and [mark-chisnell](https://www.bandg.com/de-de/blog/sailsteer-with-mark-chisnell/).

## Calculated Data

The plugin calculates true wind, ground wind and set and drift. It needs COG/SOG, HDT/STW and AWA/AWS as input data. If HDT/STW is missing it uses COG/SOG as fallback (you get ground wind instead of true wind, and the direction is wrong if HDT!=COG). If you do not have a wind sensor, you can enter ground wind in the settings for testing purposes.

How the calculation is done and the formulas used as well definitions of the several quantities, all of this is [documented in the code](Sail_Instrument/plugin.py#L530).

The values calculated by the plugin are published in AvNav as `gps.sail_instrument.*`.
Optionally the plugin can [emit NMEA sentences](Sail_Instrument/plugin.py#89) to make the computed data available to other devices. If decoding of own NMEA sentences is enabled, these data are fed back into AvNav, get parsed and written to their standard paths in `gps.*`.
The following values are computed or copied from their sources.


Quantity | Meaning | AvNav-Path | NMEA-Sentence 
|----------|------------------------------------------|-------------------------|-------------------------|  
AWA |  apparent wind angle, measured by wind direction sensor | gps.windAngle | $MWV 
AWAF | apparent wind angle , filtered |  |  
AWD |  apparent wind direction, relative to true north |  |  
AWDF | apparent wind direction, filtered |  |  
AWS |  apparent wind speed, measured by anemometer | gps.windSpeed | $MWV 
AWSF | apparent wind speed filtered |  |  
COG |  course over ground, usually from GPS | gps.track |  
CRS |  course through water |  |  
DBK |  depth below keel |  gps.depthBelowKeel, |  
DBS |  depth below surface | gps.depthBelowWaterline | $DBS 
DBT |  depth below transducer | gps.depthBelowTransducer | $DBT 
DEV |  magnetic deviation, boat specific, depends on HDG |  | $DBK 
DFT | tide drift rate |  | $VDR 
DFTF | tide drift rate filtered |  |  
DOT |  depth of transducer |  |  
DRT |  draught |  |  
GWA |  ground wind angle, relative to ground, relative to HDT |  |  
GWD |  ground wind direction, relative to ground, relative true north |  |  
GWS |  ground wind speed, relative to ground |  |  
HDC |  compass heading, raw reading of the compass (also HDGc) |  |  
HDG |  heading, unspecified which of the following |  |  
HDM |  magnetic heading, as reported by a calibrated compass (also HDGm) | gps.headingMag | $HDM,$HDG 
HDT |  true heading, direction bow is pointing to, relative to true north (also HDGt) | gps.headingTrue | $HDT 
HEL |  heel angle, measured by sensor or from heel polar TWA/TWS -> HEL |   |  
LAT | Latitude |  gps.lat, |  
LAY | layline angle rel. to TWD |  |  
LEE |  leeway angle, angle between HDT and direction of water speed vector |   |  
LEF | leeway factor |  |  
LON | Longitude |  gps.lon, |  
POLAR | Polar Speed Vector |  |  
SET |  set, direction of tide/current, cannot be measured directly |  | $VDR 
SETF | tide set direction filtered |  |  
SOG |  speed over ground, usually from GPS | gps.speed |  
STW |  speed through water, usually from paddle wheel, water speed vector projected onto HDT (long axis of boat) | gps.waterSpeed |  
TWA |  true wind angle, relative to water, relative to HDT | gps.trueWindAngle | $MWV 
TWAF | true wind angle, filtered |  |  
TWD |  true wind direction, relative to water, relative true north | gps.trueWindDirection | $MWD 
TWDF | true wind direction filtered |  |  
TWDMAX | max true wind direction relative |  |  
TWDMIN | min true wind direction relative |  |  
TWS |  true wind speed, relative to water | gps.trueWindSpeed | $MWD 
TWSF | true wind speed filtered |  |  
VAR |  magnetic variation, given in chart or computed from model | gps.magVariation | $HDG 
VMCA | optimum VMC direction (course) |  |  
VMCB | optimum VMC direction (opposite |  |  
VMG | velocity made good upwind |  |  
VPOL | speed from polar |  |  




## Config Options



There are the following configuration options on the status-page ${\color\Large{red}Missing Link}$

- `period` - computation interval (s)
- `smoothing_factor` - factor within (0,1] for [exponential smoothing](https://en.wikipedia.org/wiki/Exponential_smoothing) (filtering) of wind and tide, 1 = no smoothing, filtered data as suffix `F`
- `minmax_samples` - number of samples used for calculating min/max TWD
- `allow_fallback` - allow fallback to use HDT=COG and/or STW=SOG if former are not available
- `calc_vmc` - perform calculation of optimal TWA for maximum VMC (see below)
- `laylines_polar` - calculate laylines from speed matrix, not from beat/run angle in polar data`
- `show_polar` - compute and display normalized polar diagram in the widget
- `tack_angle` - tack angle [0,180) used for laylines, if >0 this fixed angle is used instead the one from the polar data
- `gybe_angle` - gybe angle [0,180) used for laylines, if >0 this fixed angle is used instead the one from the polar data
- `ground_wind` - manually entered ground wind as `direction,speed`, used to calculate true and apparent wind if no other wind data is present (for simulation)
- `lee_factor` - leeway factor, if >0 leeway angle is estimated, see below
- `wmm_file` - file with WMM-coefficents for magnetic deviation
- `wmm_period` - period (s) to recompute magnetic variation
- `depth_transducer` - depth of transducer (m) (negative=disabled)
- `draught` - draught (m) (negative=disabled)
- `nmea_write` - write NMEA sentences (sent to outputs and parsed by AvNav)
- `nmea_filter` - filter for NMEA sentences to be sent
- `nmea_priority` - NMEA source priority
- `nmea_id` - NMEA talker ID for emitted sentences
- `nmea_decode` - decode own NMEA sentences

## Installation

You can install the plugin either by using the Debian-Package:

Download the package provided in the releases section [Sail_Instrument](https://github.com/kdschmidt1/Sail_Instrument/releases) or build your own package using `buildPackage.sh` (requires a linux machine with docker installed). Install the package using the command

 ```
sudo apt install /path/to/avnav-sail_instrument-plugin_xxxx.deb
 ```
this will include the `numpy` and `scipy` package

OR manually

by downloading the Sail_Instrument code as a zip and unzip the `Sail_Instrument`-Folder into the directory `/home/pi/avnav/data/plugins/Sail_Instrument`.
If the directory does not exist just create it. On a standard Linux system (not raspberry pi) the directory will be `/home/(user)/avnav/plugins/Sail_Instrument`.

If not already present, you have additionally to install the `numpy` and `scipy` packages with:

 ```
  sudo apt-get install python3-scipy python3-numpy
 ```

Finally you have to move (or copy) the files `polar.json` and `heel.json` to the viewer-section of your data-directory (normally `/home/pi/avnav/user/viewer/`). 
With this procedure the internal name of the plugin will be `user-Sail_Instrument`.

Add the LayLines_Overlay to your map in the [WidgetDialog](https://www.wellenvogel.net/software/avnav/docs/hints/layouts.html#h2:WidgetDialog) using the Map Widgets Button ![Map Widgets Button](Images/map-widgets.png)

## Polar Data

![polar](Images/polar.png)

You have to provide polar data for your boat in `avnav/user/viewer/polar.json` for calculating the laylines. If there is no such file, the plugin will copy [one](Sail_Instrument/polar.json) to this location, and you can use it as a template for your own polar data.

If you do not have any polar data, you can enter tack and gybe angle in the plugin configuration and use these fixed values instead.

A source for polar data can be [ORC sailboat data](https://jieter.github.io/orc-data/site/) or [Seapilot.com](https://www.seapilot.com/features/download-polar-files/).

## Leeway estimation

Leeway is [estimated from heel and STW](https://opencpn-manuals.github.io/main/tactics/index.html#_2_2_calculate_leeway) as

LEE = LEF * HEL / STW^2

With LEF being a boat specific factor from within (0,20). Heel could be a measured value (either from signalk.navigation.attitude.roll or a specific transducer in gps.transducers.ROLL). If data is not available it is interpolated from the heel polar in [`avnav/user/viewer/heel.json`](Sail_Instrument/heel.json). As the [`avnav/user/viewer/polar.json`](Sail_Instrument/polar.json) it contains an interpolation table to map TWA/TWS to heel angle HEL.

## Laylines

To understand the technical background of the laylines one has first to have an understanding of the terms VMG and VMC.

- **VMG** - _Velocity Made Good against
  wind_ is defined as `VMG = boatspeed * cos(TWA)` boatspeed vector projected onto true wind direction
- **VMC** - _Velocity Made good on
  Course_ is defined as `VMC = boatspeed * cos(BRG-HDG)` boatspeed vector projected onto direction to waypoint

Unfortunately there is a lot of confusion on these two terms and also most of the commercial products are mixing the two items and indicate VMG but actually showing VMC (and so does AvNav).

The laylines are computed from the `beat_angle` and `run_angle` vectors in the polar file, which contain a mapping of TWS to TWA for maximum VMG. As a result the laylines show the optimal TWA to travel upwind in general, but not the optimal TWA to get towards the waypoint. Optionally it is possible to calculate the laylines from the STW matrix.

![VMC](Images/vmc.png)

From the `STW` matrix in the polar data, which is a mapping of TWS and TWA to STW, one can calculate the optimal TWA such that VMC is maximised, the optimal TWA that gets you fasted towards the waypoint. The plugin calculates this optimal TWA from the polar data and displays it as a blue line along with the laylines.

These calculations require `numpy` and `scipy`. Both are automatically installed using the Debian-Package of the plugin.

