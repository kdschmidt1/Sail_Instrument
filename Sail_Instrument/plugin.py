# the following import is optional
# it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi
import os
from math import sin, cos, radians, degrees, sqrt, atan2, floor, pi, fabs
import xml.etree.ElementTree as ET
import urllib.request, urllib.parse, urllib.error
import time
import numpy, scipy
import re
from math import sin, cos, radians, degrees, sqrt, atan2, isfinite, copysign

try:
    from avnrouter import AVNRouter, WpData
    from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus
except:
    pass

KNOTS = 1.94384  # knots per m/s
MIN_AVNAV_VERSION = "20230705"
SAILINSTRUMENT_PREFIX = "gps.sailinstrument."
SMOOTHING_FACTOR = "smoothing_factor"
MM_SAMPLES = "minmax_samples"
WRITE_DATA = "write_data"
WIND = "wind"
FALLBACK = "allow_fallback"
TACK_ANGLE = "tack_angle"
GYBE_ANGLE = "gybe_angle"

CONFIG = [
    {
        "name": SMOOTHING_FACTOR,
        "description": "exponential smoothing factor for TWD/AWD",
        "default": "0.1",
        "type": "FLOAT",
    },
    {
        "name": MM_SAMPLES,
        "description": "number of samples for calculating min/max of TWD",
        "default": "200",
        "type": "NUMBER",
    },
    {
        "name": FALLBACK,
        "description": "allow fallback to use HDM/COG/SOG for HDT/STW",
        "default": "True",
        "type": "BOOLEAN",
    },
    {
        "name": TACK_ANGLE,
        "description": "tack angle, if >0 use this fixed angle instead of calculating from polar data",
        "default": "0",
        "type": "FLOAT",
    },
    {
        "name": GYBE_ANGLE,
        "description": "gybe angle, if >0 use this fixed angle instead of calculating from polar data",
        "default": "0",
        "type": "FLOAT",
    },
    {
        "name": WRITE_DATA,
        "description": "write calculated data to AvNav model in gps.* (requires allowKeyOverwrite=true), all data is always available in "
        + SAILINSTRUMENT_PREFIX
        + "*",
        "default": "False",
        "type": "BOOLEAN",
    },
    {
        "name": WIND,
        "description": "manually entered ground wind for testing, enter as 'direction,speed', is used if no other wind data is present",
        "default": "",
        "type": "STRING",
    },
]


class Plugin(object):
    @classmethod
    def pluginInfo(cls):
        return {
            "description": "sail instrument calculating and displaying, true/apparent wind, tide, laylines",
            "version": "1.2",
            "config": CONFIG,
            "data": [
                {
                    "path": SAILINSTRUMENT_PREFIX + "*",
                    "description": "sail instrument data",
                },
                {"path": "gps.currentSet", "description": "tide set direction"},
                {"path": "gps.currentDrift", "description": "tide drift rate"},
                {"path": "gps.windAngle", "description": "apparent wind angle"},
                {"path": "gps.windSpeed", "description": "apparent wind speed"},
                {"path": "gps.trueWindAngle", "description": "true wind angle"},
                {"path": "gps.trueWindSpeed", "description": "true wind speed"},
                {"path": "gps.trueWindDirection", "description": "true wind direction"},
                {"path": "gps.groundWindAngle", "description": "ground wind angle"},
                {"path": "gps.groundWindSpeed", "description": "ground wind speed"},
                {
                    "path": "gps.groundWindDirection",
                    "description": "ground wind direction",
                },
            ],
        }

    def __init__(self, api):
        self.api = api  # type: AVNApi
        if self.api.getAvNavVersion() < int(MIN_AVNAV_VERSION):
            raise Exception("not compatible with this AvNav version")

        self.api.registerEditableParameters(CONFIG, self.changeParam)
        self.api.registerRestart(self.stop)

        self.api.registerRequestHandler(self.handleApiRequest)
        self.api.registerRestart(self.stop)
        self.polare = {}
        self.read_polar("polare.xml")
        self.saveAllConfig()

    def getConfigValue(self, name):
        defaults = self.pluginInfo()["config"]
        for cf in defaults:
            if cf["name"] == name:
                return self.api.getConfigValue(name, cf.get("default"))
        return self.api.getConfigValue(name)

    def saveAllConfig(self):
        d = {}
        defaults = self.pluginInfo()["config"]
        for cf in defaults:
            v = self.getConfigValue(cf.get("name"))
            d.update({cf.get("name"): v})
        self.api.saveConfigValues(d)
        return

    def changeConfig(self, newValues):
        self.api.saveConfigValues(newValues)

    def changeParam(self, param):
        self.api.saveConfigValues(param)

    def stop(self):
        pass

    def handleApiRequest(self, url, handler, args):
        return {"status", "unknown request"}

    def run(self):
        def manual_wind():
            w = self.getConfigValue(WIND)
            if w:  # manually entered wind data
                wd, ws = list(map(float, w.split(",")))
                ws /= 1.94384
                return wd, ws

        filtered = {}

        def smooth(data, phi, rad):
            if any(v not in data for v in (phi, rad)):
                return
            k = phi + rad
            p, r = data[phi], data[rad]
            xy = toCart((p, r))
            if k in filtered:
                a = float(self.getConfigValue(SMOOTHING_FACTOR))
                sk = filtered[k]
                filtered[k] = [sk[i] + a * (xy[i] - sk[i]) for i in (0, 1)]
            else:
                filtered[k] = xy
            p, r = toPol(filtered[k])
            data[phi + "F"] = p
            data[rad + "F"] = r

        min_max_values = {}

        def min_max(data, key, func=lambda x: x):
            if key not in data:
                return
            v = data[key]
            if key not in min_max_values:
                min_max_values[key] = []
            values = min_max_values[key]
            values.append(func(v))
            samples = int(self.getConfigValue(MM_SAMPLES))
            while len(values) > samples:
                values.pop(0)
            data[key + "MIN"], data[key + "MAX"] = min(values), max(values)

        def readValue(path):
            "prevents reading values that we self have calculated"
            a = self.api.getSingleValue(path, includeInfo=True)
            # self.api.log(f"read {path} {a.value if a else ''} {a.source if a else ''}")
            if a is not None and "Sail_Instrument" not in a.source:
                return a.value

        def writeValue(data, key, path):
            "do not overwrite existing values"
            if key not in data:
                return
            a = self.api.getSingleValue(path, includeInfo=True)
            if a is None or "Sail_Instrument" in a.source:
                self.api.addData(path, data[key])

        self.api.log("started")
        self.api.setStatus("STARTED", "running")
        while not self.api.shouldStopMainThread():
            time.sleep(0.5)
            # get course data
            cog = readValue("gps.track")
            sog = readValue("gps.speed")
            hdt = readValue("gps.headingTrue")
            hdm = readValue("gps.headingMag")
            stw = readValue("gps.waterSpeed")
            if self.getConfigValue(FALLBACK).startswith("T"):
                hdt = hdm if hdt is None else hdt  # fallback to HDM
                hdt = cog if hdt is None else hdt  # fallback to COG
                stw = sog if stw is None else stw  # fallback to SOG
            if any(v is None for v in (hdt, stw)):
                self.api.setStatus("ERROR", "missing HDT/STW")
                continue
            # get wind data
            awa = readValue("gps.windAngle")
            aws = readValue("gps.windSpeed")
            twa = readValue("gps.trueWindAngle")
            tws = readValue("gps.trueWindSpeed")
            twd = readValue("gps.trueWindDirection")
            gwd, gws = None, None
            if all(v is None for v in (awa, aws, twa, tws, twd)):
                gwd, gws = manual_wind() or (None, None)
            # self.api.log(                f"\nCOG={cog} SOG={sog} HDT={hdt} STW={stw} AWA={awa} AWS={aws} TWA={twa} TWS={tws} TWD={twd} GWD={gwd} GWS={gws}"            )
            # compute missing parts (fields that are None get computed)
            d = CourseData(
                COG=cog,
                SOG=sog,
                HDT=hdt,
                STW=stw,
                AWA=awa,
                AWS=aws,
                TWA=twa,
                TWS=tws,
                TWD=twd,
                GWD=gwd,
                GWS=gws,
            )
            # smooth and get min/max
            smooth(d, "AWD", "AWS")
            smooth(d, "TWD", "TWS")
            smooth(d, "SET", "DFT")
            min_max(d, "TWD", lambda v: to180(v - d.TWDF))

            self.laylines(d)

            # self.api.log(f"\n{d}")

            for k in d.keys():  # publish gps.sailinstrument.* data
                self.api.addData(SAILINSTRUMENT_PREFIX + k, d[k])

            # write calculated values
            if self.getConfigValue(WRITE_DATA).startswith("T"):
                writeValue(d, "SET", "gps.currentSet")
                writeValue(d, "DFT", "gps.currentDrift")
                writeValue(d, "AWA", "gps.windAngle")
                writeValue(d, "AWS", "gps.windSpeed")
                writeValue(d, "TWA", "gps.trueWindAngle")
                writeValue(d, "TWS", "gps.trueWindSpeed")
                writeValue(d, "TWD", "gps.trueWindDirection")
                writeValue(d, "GWA", "gps.groundWindAngle")
                writeValue(d, "GWS", "gps.groundWindSpeed")
                writeValue(d, "GWD", "gps.groundWindDirection")

            self.api.setStatus("NMEA", "computing data")

    def polar_angle(self, tws, upwind):
        try:
            if not self.polare:
                return
            speeds = self.polare["windspeedvector"]
            angles = self.polare["ww_upwind" if upwind else "ww_downwind"]
            return numpy.interp(tws * KNOTS, speeds, angles)
        except Exception as x:
            self.api.error(f"polar_angle {x}")

    def polar_speed(self, twa, tws):
        try:
            if not self.polare:
                return
            if "boatspeed" not in self.polare:
                return
            wspeeds = self.polare["windspeedvector"]
            wangles = self.polare["windanglevector"]
            bspeeds = self.polare["boatspeed"]
            return bilinear(wspeeds, wangles, bspeeds, tws * KNOTS, abs(twa)) / KNOTS
        except Exception as x:
            self.api.error(f"polar_speed {x}")

    def laylines(self, data):
        try:
            twd, tws = data.TWDF, data.TWSF
            if any(v is None for v in (twd, tws)):
                return
            twa = to180(twd - data.HDT)  # filtered TWA

            brg = bearing_to_waypoint()
            if brg:
                upwind = abs(to180(brg - twd)) < 90
            else:
                upwind = abs(twa) < 90

            tack_angle = float(self.getConfigValue(TACK_ANGLE))
            gybe_angle = float(self.getConfigValue(GYBE_ANGLE))

            if upwind and tack_angle or not upwind and gybe_angle:
                angle = (tack_angle / 2) if upwind else (180 - gybe_angle / 2)
                data.LLSB, data.LLBB = to360(twd - angle), to360(twd + angle)
                return

            if not self.polare:
                return

            angle = self.polar_angle(tws, upwind)
            data.LLSB, data.LLBB = to360(twd - angle), to360(twd + angle)
            data.VPOL = self.polar_speed(twa, tws)

            if not brg:
                return

            def optimum_vmc(twd, tws, brg):
                brgw = to180(brg - twd)  # BRG from wind

                def vmc(twa):
                    # unit vector to WP
                    e = toCart((abs(brgw), 1))
                    # boat speed vector from polar
                    b = toCart((twa, self.polar_speed(twa, tws)))
                    # project boat speed vector onto bearing to get VMC
                    # negative sign, optimizer finds minimum
                    return -(e[0] * b[0] + e[1] * b[1])

                # for a in range(0, 181, 10): self.api.log(f"{a} {vmc(a)*KNOTS}")

                res = scipy.optimize.minimize_scalar(vmc, bounds=(0, 180))
                # self.api.log(f"{res}")
                if res.success:
                    return to360(twd + copysign(res.x, brgw)), -res.fun

            data.VMCD, data.VMCS = optimum_vmc(twd, tws, brg)

        except Exception as x:
            self.api.error(f"laylines {x}")

    def strictly_increasing(self, L):
        return all(x < y for x, y in zip(L, L[1:]))

    def read_polar(self, f_name):
        polare_filename = os.path.join(
            self.api.getDataDir(), "user", "viewer", "polare.xml"
        )
        try:
            tree = ET.parse(polare_filename)
        except:
            try:
                source = os.path.join(os.path.dirname(__file__), f_name)
                dest = os.path.join(
                    self.api.getDataDir(), "user", "viewer", "polare.xml"
                )
                with open(source, "rb") as src, open(dest, "wb") as dst:
                    dst.write(src.read())
                tree = ET.parse(polare_filename)
            except:
                return False
        finally:
            if not "tree" in locals():
                return False
            root = tree.getroot()
            x = ET.tostring(root, encoding="utf8").decode("utf8")
            e_str = "windspeedvector"
            x = root.find("windspeedvector").text
            # whitespaces entfernen
            x = "".join(x.split())
            self.polare["windspeedvector"] = list(map(float, x.strip("][").split(",")))
            if not self.strictly_increasing(self.polare["windspeedvector"]):
                raise Exception(
                    "windspeedvector in polare.xml IS NOT STRICTLY INCREASING!"
                )
                return False

            e_str = "windanglevector"
            x = root.find("windanglevector").text
            # whitespaces entfernen
            x = "".join(x.split())
            self.polare["windanglevector"] = list(map(float, x.strip("][").split(",")))
            if not self.strictly_increasing(self.polare["windanglevector"]):
                raise Exception(
                    "windanglevector in polare.xml IS NOT STRICTLY INCREASING!"
                )
                return False

            e_str = "boatspeed"
            x = root.find("boatspeed").text
            # whitespaces entfernen
            z = "".join(x.split())

            z = z.split("],[")
            boatspeed = []
            for elem in z:
                zz = elem.strip("][").split(",")
                boatspeed.append(list(map(float, zz)))
            self.polare["boatspeed"] = boatspeed

            e_str = "wendewinkel"
            x = root.find("wendewinkel")

            e_str = "upwind"
            y = x.find("upwind").text
            # whitespaces entfernen
            y = "".join(y.split())
            self.polare["ww_upwind"] = list(map(float, y.strip("][").split(",")))

            e_str = "downwind"
            y = x.find("downwind").text
            # whitespaces entfernen
            y = "".join(y.split())
            self.polare["ww_downwind"] = list(map(float, y.strip("][").split(",")))
        return True


def bearing_to_waypoint():
    try:
        router = AVNWorker.findHandlerByName(AVNRouter.getConfigName())
        if router is None:
            return
        wpData = router.getWpData()
        if wpData is None:
            return
        if not wpData.validData:
            return
        return wpData.dstBearing
    except:
        return


def bilinear(xv, yv, zv, x, y):
    angle = yv
    speed = zv
    # var x2i = ws.findIndex(this.checkfunc, x)
    x2i = list(filter(lambda lx: xv[lx] >= x, range(len(xv))))
    if len(x2i) > 0:
        x2i = 1 if x2i[0] < 1 else x2i[0]
        x2 = xv[x2i]
        x1i = x2i - 1
        x1 = xv[x1i]
    else:
        x1 = x2 = xv[len(xv) - 1]
        x1i = x2i = len(xv) - 1

    # var y2i = angle.findIndex(this.checkfunc, y)
    y2i = list(filter(lambda lx: angle[lx] >= y, range(len(angle))))
    if len(y2i) > 0:
        y2i = 1 if y2i[0] < 1 else y2i[0]
        # y2i = y2i < 1 ? 1 : y2i
        y2 = angle[y2i]
        y1i = y2i - 1
        y1 = angle[y2i - 1]
    else:
        y1 = y2 = angle[len(angle) - 1]
        y1i = y2i = len(angle) - 1

    ret = ((y2 - y) / (y2 - y1)) * (
        ((x2 - x) / (x2 - x1)) * speed[y1i][x1i]
        + ((x - x1) / (x2 - x1)) * speed[y1i][x2i]
    ) + ((y - y1) / (y2 - y1)) * (
        ((x2 - x) / (x2 - x1)) * speed[y2i][x1i]
        + ((x - x1) / (x2 - x1)) * speed[y2i][x2i]
    )
    return ret


class CourseData:
    """
    This class is a container for course data that tries to compute the missing pieces
    from the information that is supplied in the constructor.

    ## Units

    - direction - given in degrees within [0,360), relative to north, measured clockwise
    - angles - as directions, but given in degrees within [-180,+180), relative to HDG
      If you want angles in the range [0,360), set anlges360=True in the constructor.
    - speeds - given in any speed unit (but all the same), usually knots

    ## Definitions

    HDG = heading, unspecified which of the following
    HDT = true heading, direction bow is pointing to, relative to true north (also HDGt)
    HDM = magnetic heading, as reported by a calibrated compass (also HDGm)
    HDC = compass heading, raw reading of the compass (also HDGc)
    VAR = magnetic variation, given in chart or computed from model
    DEV = magnetic deviation, boat specific, depends on HDG
    COG = course over ground, usually from GPS
    SOG = speed over ground, usually from GPS
    SET = set, direction of tide/current, cannot be measured directly
    DFT = drift, rate of tide/current, cannot be measured directly
    STW = speed through water, usually from paddle wheel, water speed vector projected onto HDT (long axis of boat)
    LEE = leeway angle, angle between HDT and direction of water speed vector, usually estimated from wind and/or heel and STW
    AWA = apparent wind angle, measured by wind direction sensor
    AWD = apparent wind direction, relative to true north
    AWS = apparent wind speed, measured by anemometer
    TWA = true wind angle, relative to water, relative to HDT
    TWD = true wind direction, relative to water, relative true north
    TWS = true wind speed, relative to water
    GWA = ground wind angle, relative to ground, relative to HDT
    GWD = ground wind direction, relative to ground, relative true north
    GWS = ground wind speed, relative to ground

    Beware! Wind direction is the direction where the wind is coming FROM, SET,HDG,COG is the direction where the tide/boat is going TO.

    also see https://t1p.de/5th2j and https://t1p.de/628t7

    ## Magnetic Directions

    All directions, except HDM, are relative to true north. This is because a magnetic compass gives you a magnetic
    direction (heading or bearing). You convert it to true using deviation and variation and that's it.

    You could use something like COG magnetic, but it does not make any sense and is error-prone.
    Don't do this! If you do need this for output, then do the conversion to magnetic at the very end,
    after all calculations are done.

    ## Equations

    All of the mentioned quantities are linked together by the following equations. Some of them are
    vector equations, vectors are polar vectors of the form [angle,radius]. The (+) operator denotes the addition of
    polar vectors. see https://math.stackexchange.com/questions/1365622/adding-two-polar-vectors
    An implementation of this addition is given below in add_polar().

    ### Heading

    - HDT = HDM + VAR = HDC + DEV + VAR
    - HDM = HDT - VAR = HDC + DEV

    ### Course, Speed and Tide

    - [COG,SOG] = [HDT+LEE,STW] (+) [SET,DFT]
    - [SET,DFT] = [COG,SOG] (+) [HDT+LEE,-STW]

    ### Wind

    angles and directions are always converted like xWD = xWA + HDT and xWA = xWD - HDT

    - [AWD,AWS] = [GWD,GWS] (+) [COG,SOG]
    - [AWD,AWS] = [TWD,TWS] (+) [HDT+LEE,STW]
    - [AWA,AWS] = [TWA,TWS] (+) [LEE,STW]

    - [TWD,TWS] = [GWD,GWS] (+) [SET,DFT]
    - [TWD,TWS] = [AWD,AWS] (+) [HDT+LEE,-STW]
    - [TWA,TWS] = [AWA,AWS] (+) [LEE,-STW]

    - [GWD,GWS] = [AWD,AWS] (+) [COG,-SOG]

    In the vector equations angle and radius must be transformed together, always!

    ## How to use it

    Create CourseData() with the known quantities supplied in the constructor. Then access the calculated
    quantities as d.TWA or d.["TWA"]. Ask with "TWD" in d if they exist. Just print(d) to see what's inside.
    See test() for examples.
    """

    def __init__(self, **kwargs):
        self._data = kwargs
        self.angles360 = kwargs.get("angles360", False)
        self.compute_missing()

    def compute_missing(self):
        if self.misses("HDM") and self.has("HDC", "DEV"):
            self.HDM = to360(self.HDC + self.DEV)

        if self.misses("HDT") and self.has("HDM", "VAR"):
            self.HDT = to360(self.HDM + self.VAR)

        if self.misses("HDM") and self.has("HDT", "VAR"):
            self.HDM = to360(self.HDT - self.VAR)

        if self.misses("LEE"):
            self.LEE = 0

        if self.misses("SET", "DFT") and self.has("COG", "SOG", "HDT", "STW", "LEE"):
            self.SET, self.DFT = add_polar(
                (self.COG, self.SOG), (self.HDT + self.LEE, -self.STW)
            )
        if self.misses("COG", "SOG") and self.has("SET", "DFT", "HDT", "STW", "LEE"):
            self.COG, self.SOG = add_polar(
                (self.SET, self.DFT), (self.HDT + self.LEE, self.STW)
            )

        if self.misses("TWA", "TWS") and self.has("AWA", "AWS", "STW", "LEE"):
            self.TWA, self.TWS = add_polar((self.AWA, self.AWS), (self.LEE, -self.STW))
            self.TWA = self.angle(self.TWA)

        if self.misses("TWD", "TWS") and self.has("GWD", "GWS", "SET", "DFT"):
            self.TWD, self.TWS = add_polar((self.GWD, self.GWS), (self.SET, self.DFT))

        if self.misses("TWD") and self.has("TWA", "HDT"):
            self.TWD = to360(self.TWA + self.HDT)

        if self.misses("TWA") and self.has("TWD", "HDT"):
            self.TWA = self.angle(self.TWD - self.HDT)

        if self.misses("GWD", "GWS") and self.has("TWD", "TWS", "SET", "DFT"):
            self.GWD, self.GWS = add_polar((self.TWD, self.TWS), (self.SET, -self.DFT))

        if self.misses("GWA") and self.has("GWD", "HDT"):
            self.GWA = self.angle(self.GWD - self.HDT)

        if self.misses("AWA", "AWS") and self.has("TWA", "TWS", "LEE", "STW"):
            self.AWA, self.AWS = add_polar((self.TWA, self.TWS), (self.LEE, self.STW))
            self.AWA = self.angle(self.AWA)

        if self.misses("AWD") and self.has("AWA", "HDT"):
            self.AWD = to360(self.AWA + self.HDT)

    def __getattribute__(self, item):
        if re.match("[A-Z]+", item):
            return self._data.get(item)
        return super(CourseData, self).__getattribute__(item)

    def __setattr__(self, key, value):
        if re.match("[A-Z]+", key):
            self._data[key] = value
        else:
            self.__dict__[key] = value

    def __getitem__(self, item):
        return self._data.get(item)

    def __setitem__(self, key, value):
        self._data[key] = value

    def __contains__(self, item):
        v = self[item]
        return v is not None and isfinite(v)

    def __str__(self):
        return "\n".join(f"{k}={self[k]}" for k in self.keys())

    def keys(self):
        return sorted(filter(self.__contains__, self._data.keys()))

    def has(self, *args):
        return all(x in self for x in args)

    def misses(self, *args):
        return any(x not in self for x in args)

    def angle(self, a):
        return to360(a) if self.angles360 else to180(a)


def to360(a):
    "limit a to [0,360)"
    while a < 0:
        a += 360
    return a % 360


def to180(a):
    "limit a to [-180,+180)"
    return to360(a + 180) - 180


def toCart(p):
    # to cartesian with phi going clock-wise from north
    return p[1] * sin(radians(p[0])), p[1] * cos(radians(p[0]))


def toPol(c):
    # to polar with phi going clock-wise from north
    return to360(90 - degrees(atan2(c[1], c[0]))), sqrt(c[0] ** 2 + c[1] ** 2)


def add_polar(a, b):
    "sum of polar vectors (phi,r)"
    a, b = toCart(a), toCart(b)
    s = a[0] + b[0], a[1] + b[1]
    return toPol(s)
