import os
import json
import time
import numpy
import scipy.interpolate, scipy.optimize
import re
from math import sin, cos, radians, degrees, sqrt, atan2, isfinite, copysign
import shutil


try:
    from avnrouter import AVNRouter, WpData
    from avnav_worker import AVNWorker
except:
    pass


PLUGIN_VERSION = 202402
MIN_AVNAV_VERSION = 20230705
KNOTS = 1.94384  # knots per m/s
MPS = 1 / KNOTS
POLAR_FILE = "polar.json"
HEEL_FILE = "heel.json"
PATH_PREFIX = "gps.sailinstrument."
SMOOTHING_FACTOR = "smoothing_factor"
MM_SAMPLES = "minmax_samples"
WRITE_DATA = "write_data"
GROUND_WIND = "ground_wind"
FALLBACK = "allow_fallback"
TACK_ANGLE = "tack_angle"
GYBE_ANGLE = "gybe_angle"
CALC_VMC = "calc_vmc"
LEEWAY_FACTOR = "lee_factor"
LAYLINES_FROM_MATRIX = "laylines_from_matrix"
SHOW_POLAR = "show_polar"

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
        "name": CALC_VMC,
        "description": "perform calculation of optimal TWA for maximum VMC",
        "default": "False",
        "type": "BOOLEAN",
    },
    {
        "name": LAYLINES_FROM_MATRIX,
        "description": "calculate laylines from speed matrix, not from beat/run angle in polar data",
        "default": "False",
        "type": "BOOLEAN",
    },
    {
        "name": SHOW_POLAR,
        "description": "compute and display normalized polar diagram in the widget",
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
        + PATH_PREFIX
        + "*",
        "default": "False",
        "type": "BOOLEAN",
    },
    {
        "name": GROUND_WIND,
        "description": "manually entered ground wind for testing, enter as 'direction,speed', is used if no other wind data is present",
        "default": "",
        "type": "STRING",
    },
    {
        "name": LEEWAY_FACTOR,
        "description": "leeway factor LEF, if >0 leeway angle is estimated as LEF * HEL / STW^2",
        "default": "10",
        "type": "FLOAT",
    },
]


class Plugin(object):
    @classmethod
    def pluginInfo(cls):
        return {
            "description": "sail instrument calculating and displaying, true/apparent wind, tide, laylines",
            "version": PLUGIN_VERSION,
            "config": CONFIG,
            "data": [
                {
                    "path": PATH_PREFIX + "*",
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

    def get_file(self, filename):
        fn = os.path.join(self.api.getDataDir(), "user", "viewer", filename)

        if not os.path.isfile(fn):
            source = os.path.join(os.path.dirname(__file__), filename)
            shutil.copyfile(source, fn)

        return fn

    def __init__(self, api):
        self.api = api
        assert (
            MIN_AVNAV_VERSION <= self.api.getAvNavVersion()
        ), "incompatible AvNav version"

        self.api.registerEditableParameters(CONFIG, self.changeParam)
        self.api.registerRequestHandler(self.handleApiRequest)

        try:
            self.polar = Polar(self.get_file(POLAR_FILE))
        except:
            self.polar = None

        try:
            self.heels = Polar(self.get_file(HEEL_FILE))
        except:
            self.heels = None

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

    def handleApiRequest(self, url, handler, args):
        return {"status", "unknown request"}

    def run(self):
        self.api.setStatus("STARTED", "running")

        def manual_wind():
            w = self.getConfigValue(GROUND_WIND)
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
                assert 0 < a <= 1
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
            assert 0 < samples
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

        d = CourseData()
        while not self.api.shouldStopMainThread():
            time.sleep(0.5)

            self.msg = ""
            # get course data
            cog = readValue("gps.track")
            sog = readValue("gps.speed")
            hdt = readValue("gps.headingTrue")
            hdm = readValue("gps.headingMag")
            stw = readValue("gps.waterSpeed")
            if self.getConfigValue(FALLBACK).startswith("T"):
                if hdt is None and hdm is not None:
                    hdt = hdm
                    self.msg += ", HDT=HDM"
                if hdt is None and cog is not None:
                    hdt = cog
                    self.msg += ", HDT=COG"
                if stw is None and sog is not None:
                    stw = sog
                    self.msg += ", STW=SOG"

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
                self.msg += (
                    f", manually entered wind {(gwd,gws)}" if gwd is not None else ""
                )

            hel = readValue("gps.signalk.navigation.attitude.roll")
            hel = degrees(hel) if hel else hel

            lef = float(self.getConfigValue(LEEWAY_FACTOR)) / KNOTS**2
            assert 0 <= lef

            if hel is None and self.heels and lef and d.has("TWDF", "TWSF"):
                twaf = to180(d.TWDF - hdt)
                hel = self.heels.value(twaf, d.TWSF * KNOTS)
                self.msg += ", heel from polar"

            # self.api.log(
            #    f"\nCOG={cog} SOG={sog} HDT={hdt} STW={stw} AWA={awa} AWS={aws} TWA={twa} TWS={tws} TWD={twd} GWD={gwd} GWS={gws} HEL={hel} LEF={lef}"
            # )

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
                HEL=hel,
                LEF=lef,
            )
            # smooth and get min/max
            smooth(d, "AWD", "AWS")
            smooth(d, "TWD", "TWS")
            smooth(d, "SET", "DFT")
            min_max(d, "TWD", lambda v: to180(v - d.TWDF))
            for k in ("AWS", "TWS", "DFT"):
                if k not in d:
                    d[k + "F"] = 0
                    self.msg += ", no " + k

            self.laylines(d)

            # self.api.log(f"\n{d}")

            for k in d.keys():  # publish gps.sailinstrument.* data
                self.api.addData(PATH_PREFIX + k, d[k])

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

            self.api.setStatus("NMEA", "computing data" + self.msg)

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
            assert 0 <= tack_angle < 180
            gybe_angle = float(self.getConfigValue(GYBE_ANGLE))
            assert 0 <= gybe_angle < 180

            data.VMCA, data.VMCB = -1, -1

            if upwind and tack_angle or not upwind and gybe_angle:
                angle = (tack_angle / 2) if upwind else (180 - gybe_angle / 2)
                data.LLSB, data.LLBB = to360(twd - angle), to360(twd + angle)
                self.msg += ", fixed laylines"
                return

            if not self.polar:
                return

            if self.getConfigValue(LAYLINES_FROM_MATRIX).startswith(
                "T"
            ) or not self.polar.has_angle(upwind):
                angle = self.polar.vmc_angle(0, tws * KNOTS, 0 if upwind else 180)
                self.msg += ", laylines from matrix"
            else:
                angle = self.polar.angle(tws * KNOTS, upwind)
                self.msg += ", laylines"

            data.LLSB, data.LLBB = to360(twd - angle), to360(twd + angle)
            data.VPOL, data.POLAR = 0, 0
            data.VPOL = self.polar.value(twa, tws * KNOTS) * MPS
            self.msg += ", VPOL"

            if self.getConfigValue(SHOW_POLAR).startswith("T"):
                values = numpy.array(
                    [
                        self.polar.value(a, tws * KNOTS)
                        for a in numpy.linspace(0, 180, 36)
                    ]
                )
                values /= max(1, values.max())
                data.POLAR = ",".join(map(str, values))
                self.msg += ", show polar"

            if brg and self.getConfigValue(CALC_VMC).startswith("T"):
                data.VMCA = self.polar.vmc_angle(twd, tws * KNOTS, brg)
                if upwind and abs(to180(brg - twd)) < angle:
                    data.VMCB = self.polar.vmc_angle(twd, tws * KNOTS, brg, -1)
                self.msg += ", VMC"

        except Exception as x:
            self.api.error(f"laylines {x}")


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


class Polar:
    def __init__(self, filename):
        with open(filename) as f:
            self.data = json.load(f)
        self.spl = None

    def has_angle(self, upwind):
        return ("beat_angle" if upwind else "run_angle") in self.data

    def angle(self, tws, upwind):
        angle = self.data["beat_angle" if upwind else "run_angle"]
        return numpy.interp(tws, self.data["TWS"], angle)

    def value(self, twa, tws):
        if not self.spl:
            val = "STW" if "STW" in self.data else "heel"
            try:
                interp2d = scipy.interpolate.RectBivariateSpline
            except:
                interp2d = scipy.interpolate.interp2d
            self.spl = interp2d(self.data["TWA"], self.data["TWS"], self.data[val])

        return max(0.0, float(self.spl(abs(twa), tws)))

    def vmc_angle(self, twd, tws, brg, s=1):
        brg_twd = to180(brg - twd)  # BRG from wind

        def vmc(twa):
            # negative sign for minimizer
            return -self.value(twa, tws) * cos(radians(s * twa - abs(brg_twd)))

        res = scipy.optimize.minimize_scalar(vmc, bounds=(0, 180))

        if res.success:
            return to360(twd + s * copysign(res.x, brg_twd))


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
    HEL = heel angle, measured by sensor or from heel polar TWA/TWS -> HEL
    LEE = leeway angle, angle between HDT and direction of water speed vector, usually estimated from wind and/or heel and STW
    CRS = course through water
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

    ### Leeway and Course

    - LEE = LEF * HEL / STW^2
    - CRS = HDT + LEE

    With leeway factor LEF = 0..20, boat specific

    ### Course, Speed and Tide

    - [COG,SOG] = [CRS,STW] (+) [SET,DFT]
    - [SET,DFT] = [COG,SOG] (+) [CRS,-STW]

    ### Wind

    angles and directions are always converted like xWD = xWA + HDT and xWA = xWD - HDT

    - [AWD,AWS] = [GWD,GWS] (+) [COG,SOG]
    - [AWD,AWS] = [TWD,TWS] (+) [CRS,STW]
    - [AWA,AWS] = [TWA,TWS] (+) [LEE,STW]

    - [TWD,TWS] = [GWD,GWS] (+) [SET,DFT]
    - [TWD,TWS] = [AWD,AWS] (+) [CRS,-STW]
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

        if self.misses("LEF") and self.has("HEL", "STW"):
            self.LEF = 10

        if self.misses("LEE") and self.has("HEL", "STW", "LEF"):
            self.LEE = (
                max(-30, min(30, self.LEF * self.HEL / self.STW**2))
                if self.STW
                else 0
            )

        if self.misses("LEE"):
            self.LEE = 0

        if self.misses("CRS") and self.has("HDT", "LEE"):
            self.CRS = self.HDT + self.LEE

        if self.misses("SET", "DFT") and self.has("COG", "SOG", "CRS", "STW"):
            self.SET, self.DFT = add_polar((self.COG, self.SOG), (self.CRS, -self.STW))

        if self.misses("COG", "SOG") and self.has("SET", "DFT", "CRS", "STW"):
            self.COG, self.SOG = add_polar((self.SET, self.DFT), (self.CRS, self.STW))

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
        return v is not None and (type(v) != float or isfinite(v))

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
