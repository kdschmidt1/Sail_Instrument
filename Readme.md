**Sail_Instrument Plugin**
![nur ein Beispiel](https://github.com/kdschmidt1/Sail_Instrument/blob/c3503c50ce09bfc21681f1f1e58452fd98255a73/Images/avn1.png "Beispielbild")
===========================

![nur ein Beispiel](https://github.com/kdschmidt1/Sail_Instrument/blob/1f7c9f73a63de39d7d9d32b99be04a16940e7baa/Images/Achtung.png "Beispielbild")


**This Plugin only works with an AVNAV-Version including User-Overlays (see Issue request [213](https://github.com/wellenvogel/avnav/issues/213). A daily-release is already available [20220426](https://www.wellenvogel.net/software/avnav/downloads/daily/20220426/)).**  
Idea of this plugin is to show an Instrument, that contains all basic informations needed for sailing.
With the possibility to show this Display directly on the map at the boatposition the sailor has all informations in view. The Laylines will inform you about the fastest bearing to a waypoint upwind and if displayed on the map you can follow these lines. (The advantage you can get using laylines is shown at the [end of this Readme](#usecase)).  
The Instrument is inspired by B&Gs sailsteer.  

Basically this plugin uses the [AvNav Plugin Interface](https://www.wellenvogel.net/software/avnav/docs/hints/plugins.html?lang=en).

There is a good description of the basic functionality available at [blauwasser.de](https://www.blauwasser.de/navigation/app-sailsteer-bandg) und [mark-chisnell](https://www.bandg.com/de-de/blog/sailsteer-with-mark-chisnell/)
 
 
**Remarks**:
*  You have to provide polar data (see [Example](https://github.com/kdschmidt1/Sail_Instrument/blob/65a357926932284c8cf6eddd00fa86e13bc51392/polardaten/polare.xml)) of yor boat in the /home/pi/avnav/user/viewer folder for calculating the laylines. If there is no polar.xml file in the user folder, the plugin will copy its own file to this location and you can use it as a template for your own polar data and edit for example directly on the [Files/Download](https://www.wellenvogel.net/software/avnav/docs/userdoc/downloadpage.html) page in the section [DownloadPageUser](https://www.wellenvogel.net/software/avnav/docs/userdoc/downloadpage.html#userfiles).  
  
  
A description how to prepare the polar.xml based on other formats will follow soon.  

A source for polar data can be [Zeilersforum.nl](http://jieter.github.io/orc-data/site/index.html?#ITAEVERG)(thanks to [Segeln-Forum](https://www.segeln-forum.de/thread/61813-messbriefe-und-polardaten-online-nachschauen/)) or
[Seapilot.com](https://www.seapilot.com/wp-content/uploads/2018/05/All_polar_files.zip)(thanks to [free-x](https://github.com/free-x)).
in this data you can find  
beat angle => upwind,  
run angle => downwind  

These two vectors are mandatory for calculation of the laylines.  
The boatspeed Matrix is only used for calculation of VPOL (interpolated speed for actual condition based on polar-data)


| Value | Format | Storename | Description |
| --- | --- | --- | --- |
| TSS | 0…360 [°] | gps.TSS | PT1 filtered True WindDirection |
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



The plugin itself has two  parameter  
[](https://github.com/kdschmidt1/Sail_Instrument/blob/78aa9bd42013f85f47369209355f0217332afda7/Images/plugin_conf.png "Beispielbild")  


| Name | Default Value | Description |
| --- | --- | --- |
| TWD_FiltFreq | 0.2 | Limit Frequency of the PT1 Lowpass-Filter |  
|  |  |  |


Please report any Errors to [Issues](https://github.com/kdschmidt1/Sail_Instrument/issues)

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

Add the LayLines_Overlay to your map in the [WidgetDialog](https://www.wellenvogel.net/software/avnav/docs/hints/layouts.html#h2:WidgetDialog)  
(you have to use the new Button ![Button](https://github.com/wellenvogel/avnav/blob/d5cf9802d507bd5c23e1b999b78dbe0c76252fa9/viewer/images/icons-new/assistant_nav.svg)).



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
- LayLines_Overlay
- Sail_InstrumentWidget a classic widget with the Sail_Instrument
- Sail_InstrumentInfo-Widget (A Widget you can config to show the distance or the time for each Layline)  

And two widgets showing the cumulated values of the Sail_InstrumentInfo  
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

**<a name="usecase"></a>Technical implementation and Use-Case**

----------------
!! This is not for the old seadogs, this is for technical interested hobby-sailors  !!

To understand the technical background of the Laylines one has first to have a understanding of the terms VMG & VMC.
VMG (Velocity made good against wind) is defined as VMG = Boatspeed * COS(TWA), so meaning the fastest course to a waypoint directly in wind direction.
VMC (Velocity made good on course) is defined as VMC = Boatspeed * COS(BRG-HDG), meaning the fastest course to your waypoint.
Unfortunately there is a lot of confusion on these two terms, and also most of the commercial products are mixing the two items and indicate VMG but showing in reality VMC (and so does also AvNav as one can see in the source code (navcompute.js line 210: let vmgapp = gps.speed * Math.cos(Math.PI / 180 * coursediff), with cousediff= BRG-HDG ).
So have in mind, that VMG in AvNav means in reality VMC!
The calculation of Laylines is based on the Upwind and Downwind vectors in your polar file, which are indicating the maximum VMG (and in this case really VMG!) for a given true windspeed.
As a result Laylines are an optimum VMG angle, NOT VMC ANGLE!(see Best VMC below).  
Examples for all three strategies in the following:  
Based on a true wind direction of 0° (directly from North) and a Waypoint in 10 nm distance with a bearing of 32° you will get:

**Following the direct course**  

Your speed (acc. Polar-data) will be 3.8 knots. For the 10 nm to the waypoint you would need 10nm/3.8kts ~ 2.63hrs.
(The indication of the LaylineInfo Panels is useless in this moment, because they take into account your actual speed, and the distance to the waypoint would be 9.7 + 1.9 nm --> 11.6 nm)
![direct course](https://github.com/kdschmidt1/Sail_Instrument/blob/9f54c7d21a16f81bd08985cf77718e07762b62a3/Images/directCourse.png)

**Following the Laylines**  

But, if you change course to the Layline your speed (acc. Polar-data) will increase to 4.9 knots. You have to travel 9,7 nm on starboard and 1.9 nm on port (with the same speed), so you would need 11.6nm/4.9kts ~ 2.37 hrs, an advantage of approx. 15 minutes (not taking into account the additional time for the turn maneuver).  

![Follow Laylines](https://github.com/kdschmidt1/Sail_Instrument/blob/9f54c7d21a16f81bd08985cf77718e07762b62a3/Images/followLL.png)

**Best VMC**  

As mentioned before, the layline calculation is based on VMG, not VMC. So best VMC with this strategy is only valid, if your Waypoint is directly against the true wind direction. One can calculate also a best VMC course, which in this case would be 63 degrees as shown in the picture with an actual speed (acc. Polar-data) of 5.9 knots resulting in an VMC (or, as indicated as VMG in AvNav) of 5.0 knots. This calculation is actually not integrated in the release, because aditional libraries are necessary, that are currently not available for the rasperry pi (Introduction under preparation).  
![Best VMC](https://github.com/kdschmidt1/Sail_Instrument/blob/9f54c7d21a16f81bd08985cf77718e07762b62a3/Images/bestVMC.png)  

But take into account, that following the Laylines is the easier way, because the course will not change along the Layline as long as the true wind direction is not changing (remember VMG = Boatspeed * COS(TWA) ) while following the best VMC is resulting in course changes along your way (remember VMC = Boatspeed * COS(BRG-HDG), and BRG is changing along yor way!!). 
I will come up with a simulation video of all three strategies to show the behavior soon.

**
Please have in mind, that all these strategies are only valid in real life, if:
- the calculation of true wind data is accurate (Impact of SOG, Apparent wind angle and speed)
- your polar data is valid and you are able to reach the polar performance (or, at least, a constant percentage of it, because even Boris Hermann is rarely reaching 100%)
**

