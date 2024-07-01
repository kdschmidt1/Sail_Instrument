## Installation

## Using the AvNav Updater:

The plugin is included in the AvNav repositories

## Using the Debian-Package:

Download the package provided in the releases section [Sail_Instrument](https://github.com/kdschmidt1/Sail_Instrument/releases) or build your own package using `buildPackage.sh` (requires a linux machine with docker installed). Install the package with the command 

 ```
sudo apt install /path/to/avnav-sailinstrument-plugin_xxxx.deb
 ```
this will include the `numpy` and `scipy` package and delete a previously installed avnav-more-nmea plugin

## Manually

Download the Sail_Instrument repository as a zip and unzip the `Sail_Instrument`-Folder into the directory `/home/pi/avnav/data/plugins/Sail_Instrument`.
If the directory does not exist just create it. On a standard Linux system (not raspberry pi) the directory will be `/home/(user)/avnav/plugins/Sail_Instrument`.

If not already present, you have additionally to install the `numpy` and `scipy` packages with:

 ```
  sudo apt-get install python3-scipy python3-numpy
 ```

### Polar Files
The plugin is copying the files `polar.json` and `heel.json` to the user/viewer-section of your data-directory (normally `/home/pi/avnav/user/viewer/`) with the first run.
After this you can download/upload/delete/edit/view the files using the [The Files/Download Page](https://www.wellenvogel.net/software/avnav/docs/userdoc/downloadpage.html?lang=en) page, selecting the [User Files Section](https://www.wellenvogel.net/software/avnav/docs/userdoc/downloadpage.html?lang=en#h3:UserFiles) where you will find the files.


