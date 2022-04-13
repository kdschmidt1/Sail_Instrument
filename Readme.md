**SegelDisplay Plugin**

===========================



This project provides a plugin showing a display on a map overlay that is inspired by B&Gs sailsteer
Basically this plugin uses the [AvNav Plugin Interface](https://www.wellenvogel.net/software/avnav/docs/hints/plugins.html?lang=en).

It calculates the Magnetic Variation at the actual position based on the World Magnetic Model 2020 of [NOAA](https://www.ngdc.noaa.gov/) 
 
If there are "APPARENT" Winddata in the NMEA input stream it calculates:
·  

| Value | Format | Storename | Description |
| --- | --- | --- | --- |
| MagVar | +/- 180 [°] | gps.MagVar | Magnetic Variation |
| AWA | +/- 180 [°] | gps.AWA | Apparent WindAngle |
| AWD | 0…360 [°] | gps.AWD | Apparent WindDirection |
| AWS | 0..∞ [m/s] | gps.AWS | Apparent WindSpeed |
| TWA | +/- 180 [°] | gps.TWA | True WindAngle |
| TWD | 0…360 [°] | gps.TWD | True WindDirection |
| TWS | 0..∞ [m/s] | gps.TWS | True WindSpeed |
|  |  |  |  |

· 

In case of "TRUE" Winddata **no** calculation is done, because True winddata are not very likely on boats!  
(If there is interest in calculation of Apparent Wind-Data from TRUE, please leave a message in [Issues](https://github.com/kdschmidt1/avnav-more-nmea-plugin/issues))

In adition the plugin listens for incoming NMEA records regarding course and speed.

If NMEA records with course data are received (\$HDM or \$HDG or \$VHW) it calculates:

| Value | Format | Storename | Description |
| --- | --- | --- | --- |
| HDGm | 0…360 [°] | gps.HDGm | Heading magnetic |
| HDGt | 0…360 [°] | gps.HDGt | Heading true |

in case of $VHW records it will also create 

| Value | Format | Storename | Description |
| --- | --- | --- | --- |
| STW | 0..∞ [m/s] | gps.STW | Speed through water |


**NEW:**  
Since Release 20210517 the Plugin is able to create the following NMEA records: **$MWD,** **$MWV,** **$HDT,** **$HDM and** **$HDG**. These messages are available i.e. on the SocketWriter Ports. 
They will be transmitted only, if the necessary signals are available and if there is **no record with the same name** in the NMEA input data stream.  
One can explicitly declare which records to be sent by using the FILTER_NMEA_OUT Parameter (i.e. “$HDT,$MWV" to transmit only these two).
If the "Filter_NMEA_OUT" is empty, all records are transmitted.  
One can avoid to transmit a specific record by adding its name as inverse (i.e. “^$HDT”) to the "Filter_NMEA_OUT".   
A special case are the records $HDG,  $MWV and $VHW because these messages have different meanings depending on their message content:  
$HDG, $MVW can be either TRUE oder RELATIVE. In this case the plugin delivers the opposite TRUE oder RELATIVE Message, even if there is already a message with the same name in the input stream.  
Based on $VHW the plugin also creates the corresponding $HDT or $HDM and $HDG messages, if they are not already in the input stream.  
If case of feeding back the avnav-nmea records to signalk, you should add the sourceName Parameter (i.e. "more_nmea") to the blackList of the AVNSocketWriter that is used in signalk for receiving data from avnav in the avnav_server.xml to avoid creating a loop.

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
