**Sail_Instrument Plugin**
![nur ein Beispiel](https://github.com/kdschmidt1/Sail_Instrument/blob/c3503c50ce09bfc21681f1f1e58452fd98255a73/Images/avn1.png "Beispielbild")
===========================

![nur ein Beispiel](https://github.com/kdschmidt1/Sail_Instrument/blob/1f7c9f73a63de39d7d9d32b99be04a16940e7baa/Images/Achtung.png "Beispielbild")


**This Plugin only works with an AVNAV-Version including User-Overlays (see Issue request [213](https://github.com/wellenvogel/avnav/issues/213). A daily-release is already available [20220426](https://www.wellenvogel.net/software/avnav/downloads/daily/20220426/)).**  
The project provides a plugin showing a display on a map overlay that is inspired by B&Gs sailsteer  
Basically this plugin uses the [AvNav Plugin Interface](https://www.wellenvogel.net/software/avnav/docs/hints/plugins.html?lang=en).

There is a good description of the basic functionality available at [blauwasser.de](https://www.blauwasser.de/navigation/app-sailsteer-bandg) und [mark-chisnell](https://www.bandg.com/de-de/blog/sailsteer-with-mark-chisnell/)
 
 
some Remarks:
*  You have to provide polar data [Example](https://github.com/kdschmidt1/Sail_Instrument/blob/98b84dc5dde84936c46d53dbb03e475991b24948/Sail_Instrument/polare.xml) for your boat to calculate the laylines.  
  
  
A description how to prepare the polar.xml based on other formats will follow soon.  

A source for polar data can be [Zeilersforum.nl](http://jieter.github.io/orc-data/site/index.html?#ITAEVERG)(thanks to [Segeln-Forum](https://www.segeln-forum.de/thread/61813-messbriefe-und-polardaten-online-nachschauen/)) or
[Seapilot.com](https://www.seapilot.com/wp-content/uploads/2018/05/All_polar_files.zip)(thanks to [free-x](https://github.com/free-x)).

in this data you can find  
beat angle => upwind,  
run angle => downwind  

These two vectors are mandatory for calculation of the laylines.  
The boatspeed Matrix is only used for calculation of VPOL (interpolated speed for actual condition based on polar-data)

If there are "APPARENT" Winddata in the input stream it calculates and stores:
·  

| Value | Format | Storename | Description |
| --- | --- | --- | --- |
| AWA | +/- 180 [°] | gps.AWA | Apparent WindAngle |
| AWD | 0…360 [°] | gps.AWD | Apparent WindDirection |
| AWS | 0..∞ [m/s] | gps.AWS | Apparent WindSpeed |
| TWA | +/- 180 [°] | gps.TWA | True WindAngle |
| TWD | 0…360 [°] | gps.TWD | True WindDirection |
| TWS | 0..∞ [m/s] | gps.TWS | True WindSpeed |
| TSS | 0..∞ [m/s] | gps.TSS | PT1 filtered True WindDirection |
| LLSB | 0…360 [°] | gps.LLSB | layline angle Starboard |
| LLBB | 0…360 [°] | gps.LLBB | layline angle Portside |
| VPOL | 0..∞ [m/s] | gps.VPOL | calculated polar speed |
|  |  |  |  |


**NEW:**  

For the Instrument-Overlay you can configure

[](https://github.com/kdschmidt1/Sail_Instrument/blob/98b84dc5dde84936c46d53dbb03e475991b24948/Images/InstrumentOverlayconf.png "Beispielbild")

| Name | Default Value | Description |
| --- | --- | --- |
| Widgetposition| Boatposition | Position of the Instrument on the map|
| Displaysize| 100 | Size of the Sail-Instrument (%) |
| Opacity | 1.0| Opacity of the Sail-Instrument on the map|
| Laylinerefresh | 5 | Time in (min) to completely clear Layline-Area |
| TWDFilt_Indicator | False | Show filtered TWD Arrow (yellow) |  
|  |  |  |  
If there is no boatposition available the Instrument will always be shown at the center position!

                          
                        
For the Laylines-Overlay you can configure  
[](https://github.com/kdschmidt1/Sail_Instrument/blob/98b84dc5dde84936c46d53dbb03e475991b24948/Images/LaylinesOverlay_conf.png "Beispielbild")  



| Name | Default Value | Description |
| --- | --- | --- |
| Opacity | 1.0 | Opacity of the Laylines-Overlay on the map|
| Laylinelength | 100 | Length of Laylines (nm) |
| Laylineoverlap | False | Extent Laylines over Intersection |
| LaylineBoat | True | Draw Ahead-Laylines from Boatposition |
| LaylineWP | True | Draw Waypoint-Laylines |  
|  |  |  |



The plugin itself has only one parameter  
[](https://github.com/kdschmidt1/Sail_Instrument/blob/78aa9bd42013f85f47369209355f0217332afda7/Images/plugin_conf.png "Beispielbild")  


| Name | Default Value | Description |
| --- | --- | --- |
| TWD_FiltFreq | 0.2 | Limit Frequency of the PT1 Lowpass-Filter |  
|  |  |  |


Please report any Errors to [Issues](https://github.com/kdschmidt1/avnav-more-nmea-plugin/issues)

License: [MIT](LICENSE.md)





**Installation**

------------

You can use the plugin in 2 different ways.

1. Download the Sail_Instrument code as a zip and unpack the Sail_Instrument-Folder into a directory /home/pi/avnav/data/plugins/Sail_Instrument.

 If the directory does not exist just create it. On an normal linux system (not raspberry pi) the directory will be /home/(user)/avnav/plugins/Sail_Instrument.

 In this case the internal name of the plugin will be user-Sail_Instrument. 


2. Download the package provided in the releases section [Sail_Instrument](https://github.com/kdschmidt1/Sail_Instrument/releases) or build your own package using buildPackage.sh (requires a linux machine with docker installed). Install the package using the command

 ```
 sudo dpkg -i Sail_Instrument-plugin...._all.deb

 ```
Add the Laylines to your map in the [WidgetDialog](https://www.wellenvogel.net/software/avnav/docs/hints/layouts.html#h2:WidgetDialog)

Add the LayLines_Overlay to your map in the [WidgetDialog](https://www.wellenvogel.net/software/avnav/docs/hints/layouts.html#h2:WidgetDialog) (you have to use the new ![Button](https://github.com/wellenvogel/avnav/blob/d5cf9802d507bd5c23e1b999b78dbe0c76252fa9/viewer/images/icons-new/assistant_nav.svg)).



**User App**

--------

The plugin registers no [User App](https://www.wellenvogel.net/software/avnav/docs/userdoc/addonconfigpage.html?lang=en#h1:ConfigurationofUserApps)



**Configuration (Server)**

-------------

No configuration necessary



**Widgets**

------

The plugin provides the 
- Sail_Instrument_Overlay,
- the LayLines_Overlay
- Sail_InstrumentWidget a classic widget with the Sail_Instrument
- Sail_InstrumentInfoWidget (A Widget you can config to show the distance or the time for each Layline)  
And two widgets showing the cumulated values of the SailInstrumentInfo  
- TTW-S (Time to Waypoint Sailing)	(not yet available)
- DTW-S (Distance To Waypoint Sailing)	(not yet available)

**Formatter**

---------


No formatters are included in widget.




**Implementation Details**

----------------------

The Plugin is checking the AvNav version. it will not run with versions older than 20220426. 
The position of the Laylines in the display depends on the filtered TWD, that one 
can see by activating the TWDFilt_Indicator.  
Laylines on the map are only shown, if a waypoint is active and the course to the WP is in between the Laylines!

For best viewing i propose to set the Update Time for the Position to the minimum (500ms) in the [Settings page](https://www.wellenvogel.net/software/avnav/docs/userdoc/settingspage.html) 
and on the [Nav page](https://www.wellenvogel.net/software/avnav/docs/userdoc/navpage.html) to activate LockPos and CourseUp.

**Package Building**

----------------

For a simple package building [NFPM](https://nfpm.goreleaser.com/) is used and started in a docker container (use [buildPkg.sh](buildPkg.sh)). In the [package.yaml](package.yaml) the properties of the packge can be set.

Additionally a [GitHub workflow](.github/workflows/createPackage.yml) has been set up to create a release and build a package whenever you push to the release branch.

So when you fork this repository you can create a package even without a local environment.
To trigger a package build at GitHub after forking just create a release branch and push this.
