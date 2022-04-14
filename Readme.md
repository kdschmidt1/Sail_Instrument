**SegelDisplay Plugin**
![nur ein Beispiel](https://github.com/kdschmidt1/SegelDisplay/blob/c3503c50ce09bfc21681f1f1e58452fd98255a73/Images/avn1.png "Beispielbild")
===========================



This project provides a plugin showing a display on a map overlay that is inspired by B&Gs sailsteer  
Basically this plugin uses the [AvNav Plugin Interface](https://www.wellenvogel.net/software/avnav/docs/hints/plugins.html?lang=en).

There is a very good description of the basic functionality in [blauwasser.de](https://www.blauwasser.de/navigation/app-sailsteer-bandg) und [mark-chisnell](https://www.bandg.com/de-de/blog/sailsteer-with-mark-chisnell/)
 
 
some Remarks:
*  The display is only shown if valid GPS data are available
*  It requires the more [nmea plugin](https://github.com/kdschmidt1/avnav-more-nmea-plugin
*  You have to provide polar data of your boat to calculate the laylines. [Example](https://github.com/kdschmidt1/SegelDisplay/blob/ca78fc300035ab487aa4f75d74a83fe40c814be1/SegelDisplay/polare.xml)

**NEW:**  

The Plugin can either be configured in the avnav-Server.xml with the following parmeters:

| Name | Default Value | Description |
| --- | --- | --- |
| Displaysize| "100" | Size of the Layline Display (%) |
| Laylinerefresh | "10" | Time in (min) to completely clear Layline-Area |
| Laylinelength | “100” | Length of Laylines (nm) |
| TWD_filtFreq | "0.2” | Limit Frequency for PT1-Filter of TWD |
| Laylineoverlap | “False” | Extent Laylines over Intersection |
| LaylineBoat | “True” | Draw Ahead-Laylines from Boatposition |
| LaylineWP | “True” | Draw Waypoint-Laylines |
| TWDFilt_Indicator | “False” | Show filtered TWD Arrow (yellow) |

or on the Status/Server page under point 10(PluginHandler):
![nur ein Beispiel](https://github.com/kdschmidt1/SegelDisplay/blob/ea65410604be75307a485cd68e3691d6f8c494a5/Images/EditHandler%20vom%202022-04-14%2010-11-23.png "Beispielbild")


Please report any Errors to [Issues](https://github.com/kdschmidt1/avnav-more-nmea-plugin/issues)

License: [MIT](LICENSE.md)





**Installation**

------------

You can use the plugin in 2 different ways.

1. Download the source code as a zip and unpack it into a directory /home/pi/avnav/data/plugins/more-nmea.

 If the directory does not exist just create it. On an normal linux system (not raspberry pi) the directory will be /home/(user)/avnav/plugins/more-nmea.

 In this case the name of the plugin will be user-more-nmea. So you can modify the files and adapt them to your needs.



1. Download the package provided in the releases section or build your own package using buildPackage.sh (requires a linux machine with docker installed). Install the package using the command

 ```

 sudo dpkg -i avnav-more-nmea-plugin...._all.deb

 ```
2. Add the layline widget in the [Layout Editor](https://www.wellenvogel.net/software/avnav/docs/hints/layouts.html#h2:WidgetDialog) to your map
3. Add the SegelDisplay overlay https://www.wellenvogel.net/software/avnav/docs/hints/overlays.html to your map



**User App**

--------

The plugin registers no [User App](https://www.wellenvogel.net/software/avnav/docs/userdoc/addonconfigpage.html?lang=en#h1:ConfigurationofUserApps)



Configuration (Server)

-------------

No configuration necessary





**Widget**

------

The plugin provides the layline-Widget.
it is necessary to activate periody redraw of the display.


**Formatter**

---------


No formatters are included in widget.




**Implementation Details**

----------------------





**Take care for NMEA200 Sources: **

The Signalk-Plugin "sk-to-nmea0183" has some bugs:

- $VHW : see <https://github.com/SignalK/signalk-to-nmea0183/issues/63>

- $HDG : Swapped Deviation and Variation see <https://github.com/SignalK/signalk-to-nmea0183/issues/71>

The sentences from canboat are ok, as far as tested!



HDGt (Heading True) is calculated from HDGm (Heading magnetic from $HDM or $HDG or $VHW) taking into account the magnetic variation if no True Heading Data is received.

Receiving True Heading overwrites calculated Data!

If magnetic variation is received (by $HDG) inside the "WMM_PERIOD" -time this value is taken into account.

             



**Package Building**

----------------

For a simple package building [NFPM](https://nfpm.goreleaser.com/) is used and started in a docker container (use [buildPkg.sh](buildPkg.sh)). In the [package.yaml](package.yaml) the properties of the packge can be set.



Additionally a [GitHub workflow](.github/workflows/createPackage.yml) has been set up to create a release and build a package whenever you push to the release branch.

So when you fork this repository you can create a package even without a local environment.
To trigger a package build at GitHub after forking just create a release branch and push this.
