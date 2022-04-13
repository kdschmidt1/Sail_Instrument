**SegelDisplay Plugin**
![nur ein Beispiel](https://github.com/kdschmidt1/SegelDisplay/blob/c3503c50ce09bfc21681f1f1e58452fd98255a73/Images/avn1.png "Beispielbild")
===========================



This project provides a plugin showing a display on a map overlay that is inspired by B&Gs sailsteer  
Basically this plugin uses the [AvNav Plugin Interface](https://www.wellenvogel.net/software/avnav/docs/hints/plugins.html?lang=en).

There is a very good description of the basic functionality in [blauwasser.de](https://www.blauwasser.de/navigation/app-sailsteer-bandg) und [mark-chisnell](https://www.bandg.com/de-de/blog/sailsteer-with-mark-chisnell/)
 
 
some Remarks:
The display is only shown iv valid GPS data are available
It needs the more [nmea plugin](https://github.com/kdschmidt1/avnav-more-nmea-plugin
To get regular redraws of the display it is necessary to add the layline widget in the [Layout Editor](https://www.wellenvogel.net/software/avnav/docs/hints/layouts.html#h2:WidgetDialog)
You have to provide polar data of your boat to calculate the laylines. [Example](https://github.com/kdschmidt1/SegelDisplay/blob/ca78fc300035ab487aa4f75d74a83fe40c814be1/SegelDisplay/polare.xml)
Configuration of the Display is done on the Status/Server page under point 10(PluginHandler)

**NEW:**  

The Plugin can be configured in the avnav-Server.xml with the following parmeters:

| Name | Default Value | Description |
| --- | --- | --- |
| WMM_FILE | "WMM2020.COF” | The WMM-Coefficent-File in the Plugin Directory |
| WMM_PERIOD | "10" | Intervall (sec) to calculate Variation |
| NMEAPeriod | “1” | Intervall (sec) to transmit new NMEA-records |
| computePeriod | "0.5” | Intervall (sec) to read NMEA-records |
| FILTER_NMEA_OUT | “” | Filter for transmitted new NMEA-records |
| sourceName | “more_nmea” | source name to be set for the generated records |



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



**User App**

--------

The plugin registers no [User App](https://www.wellenvogel.net/software/avnav/docs/userdoc/addonconfigpage.html?lang=en#h1:ConfigurationofUserApps)



Configuration (Server)

-------------

No configuration necessary





**Widget**

------

The plugin provides no specific Widget.

One can use the default widget from avnav to visualize the data by selecting the appropriate gps... message.



**Formatter**

---------

To display values in a proper unit the necessary formatters are included in the default widget.





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
