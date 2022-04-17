**SegelDisplay Plugin**
![nur ein Beispiel](https://github.com/kdschmidt1/SegelDisplay/blob/c3503c50ce09bfc21681f1f1e58452fd98255a73/Images/avn1.png "Beispielbild")
===========================

![nur ein Beispiel](https://github.com/kdschmidt1/SegelDisplay/blob/1f7c9f73a63de39d7d9d32b99be04a16940e7baa/Images/Achtung.png "Beispielbild")


**This Plugin only works with a AVNAV-Version including Canvas-Overlays (Pull request [211](https://github.com/wellenvogel/avnav/pull/211) already initiated but up to now denied). If you would like to test the functionality anyhow, you can find an avnav debian package in the bin directory. You have to rename it to ..._all.deb (without .py) 
and install it with  
sudo dpkg -i avnav...._all.deb  
The version is based on the original repository from 17th of april, 2022**

This project provides a plugin showing a display on a map overlay that is inspired by B&Gs sailsteer  
Basically this plugin uses the [AvNav Plugin Interface](https://www.wellenvogel.net/software/avnav/docs/hints/plugins.html?lang=en).

There is a very good description of the basic functionality in [blauwasser.de](https://www.blauwasser.de/navigation/app-sailsteer-bandg) und [mark-chisnell](https://www.bandg.com/de-de/blog/sailsteer-with-mark-chisnell/)
 
 
some Remarks:
*  It requires the [more nmea plugin](https://github.com/kdschmidt1/avnav-more-nmea-plugin
*  You have to provide polar data of your boat to calculate the laylines. [Example](https://github.com/kdschmidt1/SegelDisplay/blob/ca78fc300035ab487aa4f75d74a83fe40c814be1/SegelDisplay/polare.xml)

**NEW:**  

The Plugin can either be configured in the avnav-Server.xml with the following parmeters:

| Name | Default Value | Description |
| --- | --- | --- |
| Displaysize| "100" | Size of the Layline Display (%) |
| Laylinerefresh | "5" | Time in (min) to completely clear Layline-Area |
| Laylinelength | “100” | Length of Laylines (nm) |
| TWD_filtFreq | "0.2” | Lowpass Frequency for PT1-filtered TWD |
| Laylineoverlap | “False” | Extent Laylines over Intersection |
| LaylineBoat | “True” | Draw Ahead-Laylines from Boatposition |
| LaylineWP | “True” | Draw Waypoint-Laylines |
| TWDFilt_Indicator | “False” | Show filtered TWD Arrow (yellow) |

or in the Status/Server page under PluginHandler:
![nur ein Beispiel](https://github.com/kdschmidt1/SegelDisplay/blob/ea65410604be75307a485cd68e3691d6f8c494a5/Images/EditHandler%20vom%202022-04-14%2010-11-23.png "Beispielbild")


Please report any Errors to [Issues](https://github.com/kdschmidt1/avnav-more-nmea-plugin/issues)

License: [MIT](LICENSE.md)





**Installation**

------------

You can use the plugin in 2 different ways.

1. Download the source code as a zip and unpack it into a directory /home/pi/avnav/data/plugins/SegelDisplay.

 If the directory does not exist just create it. On an normal linux system (not raspberry pi) the directory will be /home/(user)/avnav/plugins/SegelDisplay.

 In this case the internal name of the plugin will be user-SegelDisplay. 


1. Download the package provided in the releases section [SegelDisplay](https://github.com/kdschmidt1/SegelDisplay/releases) or build your own package using buildPackage.sh (requires a linux machine with docker installed). Install the package using the command

 ```
 sudo dpkg -i SegelDisplay-plugin...._all.deb

 ```
 2. If not already installed download the more-nmea package provided in the releases section [avnav-more-nmea-plugin](https://github.com/kdschmidt1/avnav-more-nmea-plugin/releases).Install the package using the command

 ```
sudo dpkg -i avnav-more-nmea-plugin...._all.deb

 ```
3. Add the LaylineWidget to your map in the [WidgetDialog](https://www.wellenvogel.net/software/avnav/docs/hints/layouts.html#h2:WidgetDialog)

3. Add the SegelDisplay overlay you can find in the Overlay folder of the SegelDisplay-plugin directory to your map [overlays](https://www.wellenvogel.net/software/avnav/docs/hints/overlays.html)



**User App**

--------

The plugin registers no [User App](https://www.wellenvogel.net/software/avnav/docs/userdoc/addonconfigpage.html?lang=en#h1:ConfigurationofUserApps)



**Configuration (Server)**

-------------

No configuration necessary



**Widget**

------

The plugin provides the LaylineWidget.
it is necessary to activate periodic redraw of the display.


**Formatter**

---------


No formatters are included in widget.




**Implementation Details**

----------------------

The Plugin is checking the AvNav version. it will not run with wrong versions. 
The position of the Laylines in the display depends on the filtered TWD, that one 
can see by activating the TWDFilt_Indicator.  
Laylines on the map are only shown, if a waypoint is active!

For best viewing i propose to set the Update Time for the Position to the minimum (500ms) in the [Settings page](https://www.wellenvogel.net/software/avnav/docs/userdoc/settingspage.html) 
and on the [Nav page](https://www.wellenvogel.net/software/avnav/docs/userdoc/navpage.html) to activate LockPos and CourseUp.

**Package Building**

----------------

For a simple package building [NFPM](https://nfpm.goreleaser.com/) is used and started in a docker container (use [buildPkg.sh](buildPkg.sh)). In the [package.yaml](package.yaml) the properties of the packge can be set.

Additionally a [GitHub workflow](.github/workflows/createPackage.yml) has been set up to create a release and build a package whenever you push to the release branch.

So when you fork this repository you can create a package even without a local environment.
To trigger a package build at GitHub after forking just create a release branch and push this.
