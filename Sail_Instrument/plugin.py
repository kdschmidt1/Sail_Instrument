import json
import os
import re
import shutil
import sys
import time
from math import sin, cos, radians, degrees, sqrt, atan2, isfinite, copysign

import numpy
import scipy.interpolate
import scipy.optimize
from avnav_nmea import NMEAParser

try:
    from avnrouter import AVNRouter, WpData
    from avnav_worker import AVNWorker
except:
    pass

hasgeomag = False

try:
    sys.path.insert(0, os.path.dirname(__file__) + "/lib")
    import geomag

    hasgeomag = True
except:
    pass

PLUGIN_VERSION = 20240320
SOURCE = "Sail_Instrument"
MIN_AVNAV_VERSION = 20230705
KNOTS = 1.94384  # knots per m/s
MPS = 1 / KNOTS
POLAR_FILE = "polar.json"
HEEL_FILE = "heel.json"
PATH_PREFIX = "gps.sailinstrument."
SMOOTHING_FACTOR = "smoothing_factor"
MM_SAMPLES = "minmax_samples"
GROUND_WIND = "ground_wind"
FALLBACK = "allow_fallback"
TACK_ANGLE = "tack_angle"
GYBE_ANGLE = "gybe_angle"
CALC_VMC = "calc_vmc"
LEEWAY_FACTOR = "lee_factor"
LAYLINES_FROM_MATRIX = "laylines_polar"
SHOW_POLAR = "show_polar"
PERIOD = "period"
WMM_FILE = "wmm_file"
WMM_PERIOD = "wmm_period"
WRITE = "nmea_write"
NMEA_FILTER = "nmea_filter"
PRIORITY = "nmea_priority"
TALKER_ID = "nmea_id"
DECODE = "nmea_decode"
DEPTH_OF_TRANSDUCER = "depth_transducer"
DRAUGHT = "draught"

INPUT_FIELDS = {
    "LAT": "gps.lat",
    "LON": "gps.lon",
    "COG": "gps.track",
    "SOG": "gps.speed",
    "HDC": "gps.headingCompass",
    "DEV": "gps.magDeviation",
    "HDM": "gps.headingMag",
    "VAR": "gps.magVariation",
    "HDT": "gps.headingTrue",
    "STW": "gps.waterSpeed",
    "SET": "gps.currentSet",
    "DFT": "gps.currentDrift",
    "AWA": "gps.windAngle",
    "AWS": "gps.windSpeed",
    "TWA": "gps.trueWindAngle",
    "TWS": "gps.trueWindSpeed",
    "TWD": "gps.trueWindDirection",
    "GWA": "gps.groundWindAngle",
    "GWS": "gps.groundWindSpeed",
    "GWD": "gps.groundWindDirection",
    "LEE": "gps.leewayAngle",
    "HEL": "gps.heelAngle",
    "HEL1": "gps.transducers.ROLL",
    "HEL2": "gps.signalk.navigation.attitude.roll",
    "DBS": "gps.depthBelowSurface",
    "DBT": "gps.depthBelowTransducer",
    "DBK": "gps.depthBelowKeel",
}

NMEA_SENTENCES = {
    # https://gpsd.gitlab.io/gpsd/NMEA.html
    # set and drift
    "SET,DFT": "${ID}VDR,{data.SET:.1f},T,,,{data.DFT*KNOTS:.1f},N",
    "HDM": "${ID}HDM,{data.HDM:.1f},M",  # magnetic heading
    "HDT": "${ID}HDT,{data.HDT:.1f},T",  # true heading
    "HDC,DEV,VAR": "${ID}HDG,{data.HDC:.1f},{abs(data.DEV):.1f},{'E' if data.DEV>=0 else 'W'},{abs(data.VAR):.1f},{'E' if data.VAR>=0 else 'W'}",
    "HDT,HDM,STW": "${ID}VHW,{data.HDT:.1f},T,{data.HDM:.1f},M,{data.STW:.1f},N,,",
    # true wind direction and speed
    "TWD,TWS": "${ID}MWD,{to360(data.TWD):.1f},T,,,{data.TWS*KNOTS:.1f},N,,",
    # true wind angle and speed
    "TWA,TWS": "${ID}MWV,{to360(data.TWA):.1f},T,{data.TWS*KNOTS:.1f},N,A",
    # apparent wind angle and speed
    "AWA,AWS": "${ID}MWV,{to360(data.AWA):.1f},R,{data.AWS*KNOTS:.1f},N,A",
    "DBS": "${ID}DBS,,,{data.DBS:.1f},M,,",  # depth below surface
    "DBT": "${ID}DBT,,,{data.DBT:.1f},M,,",  # depth below transducer
    "DBK": "${ID}DBK,,,{data.DBK:.1f},M,,",  # depth below keel
}

CONFIG = [
    {
        "name": PERIOD,
        "description": "compute period (s)",
        "type": "FLOAT",
        "default": 1,
    },
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
        "description": "allow fallback to HDT=COG, STW=SOG",
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
        "description": "calculate laylines from polar speed, not from beat/run angle table",
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
    {
        "name": WMM_FILE,
        "description": "file with WMM-coefficents for magnetic variation",
        "default": "WMM2020.COF",
    },
    {
        "name": WMM_PERIOD,
        "description": "period (s) to recompute magnetic variation",
        "type": "NUMBER",
        "default": 600,
    },
    {
        "name": DEPTH_OF_TRANSDUCER,
        "description": "depth of transducer (m) (negative=disabled)",
        "type": "FLOAT",
        "default": -1,
    },
    {
        "name": DRAUGHT,
        "description": "draught (m) (negative=disabled)",
        "type": "FLOAT",
        "default": -1,
    },
    {
        "name": WRITE,
        "description": "write NMEA sentences (sent to outputs and parsed by AvNav)",
        "type": "BOOLEAN",
        "default": "False",
    },
    {
        "name": NMEA_FILTER,
        "description": "filter for NMEA sentences to be sent",
        "default": "",
    },
    {
        "name": PRIORITY,
        "description": "NMEA source priority",
        "type": "NUMBER",
        "default": 10,
    },
    {
        "name": TALKER_ID,
        "description": "NMEA talker ID for emitted sentences",
        "type": "STRING",
        "default": "CA",
    },
    {
        "name": DECODE,
        "description": "decode own NMEA sentences",
        "type": "BOOLEAN",
        "default": "True",
    },
]


class Plugin(object):
    @classmethod
    def pluginInfo(cls):
        return {
            "description": "sail instrument calculating and displaying, true/apparent wind, tide, laylines, ...",
            "version": PLUGIN_VERSION,
            "config": CONFIG,
            "data": [
                {
                    "path": PATH_PREFIX + "*",
                    "description": "sail instrument data",
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
        self.api.registerRestart(self.stop)

        try:
            self.polar = Polar(self.get_file(POLAR_FILE))
        except:
            self.polar = None

        try:
            self.heels = Polar(self.get_file(HEEL_FILE))
        except:
            self.heels = None

        self.variation_model = None

        self.saveAllConfig()

    def stop(self):
        pass

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
        self.read_config()

    def read_config(self):
        config = {}
        for c in CONFIG:
            name = c["name"]
            TYPES = {"FLOAT": float, "NUMBER": int,
                     "BOOLEAN": lambda s: s == "True"}
            value = self.getConfigValue(name)
            value = TYPES.get(c.get("type"), str)(value)
            config[name] = value
        # print("config", config)
        assert config[PERIOD] > 0
        assert config[PRIORITY] > 0
        assert len(config[TALKER_ID]) == 2
        self.config = config

    def readValue(self, path):
        "prevents reading values that we self have calculated"
        a = self.api.getSingleValue(path, includeInfo=True)
        # if a: print(path, a.value, a.source, a.priority / 10)
        if a is not None and SOURCE not in a.source:
            return a.value

    def writeValue(self, data, key, path):
        "do not overwrite existing values"
        if key not in data:
            return
        a = self.api.getSingleValue(path, includeInfo=True)
        if a is None or SOURCE in a.source:
            self.api.addData(path, data[key])

    def mag_variation(self, lat, lon):
        if not self.variation_model:
            try:
                self.variation_period = self.config[WMM_PERIOD]
                assert self.variation_period > 0
                self.variation_time = 0
                filename = self.config[WMM_FILE]
                if "/" not in filename:
                    filename = os.path.join(
                        os.path.dirname(__file__) + "/lib", filename
                    )
                self.variation_model = geomag.GeoMag(filename)
            except Exception as x:
                # self.api.log(f"WMM error {x}")
                self.msg += f" WMM error {x}"
                return
        if time.monotonic() - self.variation_time > self.variation_period:
            self.variation = self.variation_model.GeoMag(lat, lon).dec
            self.variation_time = time.monotonic()
        return self.variation

    def manual_wind(self):
        w = self.config[GROUND_WIND]
        if w:  # manually entered wind data
            wd, ws = list(map(float, w.split(",")))
            ws *= MPS
            return wd, ws

    def smooth(self, data, phi, rad):
        if not hasattr(self, "filtered"):
            self.filtered = {}
        filtered = self.filtered
        if any(v not in data for v in (phi, rad)):
            return
        k = phi + rad
        p, r = data[phi], data[rad]
        xy = toCart((p, r))
        if k in filtered:
            a = self.config[SMOOTHING_FACTOR]
            assert 0 < a <= 1
            v = filtered[k]
            filtered[k] = [v[i] + a * (xy[i] - v[i]) for i in (0, 1)]
        else:
            filtered[k] = xy
        p, r = toPol(filtered[k])
        data[phi + "F"] = to180(p) if phi[-1] == "A" else p
        data[rad + "F"] = r

    def min_max(self, data, key, func=lambda x: x):
        if not hasattr(self, "min_max_values"):
            self.min_max_values = {}
        min_max_values = self.min_max_values
        if key not in data:
            return
        v = data[key]
        if key not in min_max_values:
            min_max_values[key] = []
        values = min_max_values[key]
        values.append(func(v))
        samples = self.config[MM_SAMPLES]
        assert 0 < samples
        while len(values) > samples:
            values.pop(0)
        data[key + "MIN"], data[key + "MAX"] = min(values), max(values)

    def run(self):
        self.read_config()
        self.api.setStatus("STARTED", "running")
        d = CourseData()
        while not self.api.shouldStopMainThread():
            try:
                self.msg = ""
                data = {k: self.readValue(p) for k, p in INPUT_FIELDS.items()}
                data["HEL"] = data["HEL"] or data["HEL1"] or (
                    degrees(data["HEL2"]) if data.get("HEL2") is not None else None)
                present = {k for k in data.keys() if data[k] is not None}

                data["LEF"] = self.config[LEEWAY_FACTOR] / KNOTS ** 2

                if all(data.get(k) is None for k in ("AWA", "AWS", "TWA", "TWS", "TWD")):
                    gwd, gws = self.manual_wind() or (None, None)
                    data["GWD"], data["GWS"] = gwd, gws
                    self.msg += f", manually entered wind {(gwd, gws * KNOTS)}" if gwd is not None else ""

                if data["VAR"] is None and all(data.get(k) is not None for k in ("LAT", "LON")):
                    data["VAR"] = self.mag_variation(data["LAT"], data["LON"])

                if self.config[FALLBACK]:
                    if data["HDT"] is None and any(data.get(k) is None for k in ("HDM", "VAR")):
                        data["HDT"] = data["COG"]
                        self.msg += ", fallback HDT=COG"
                    if data["STW"] is None:
                        data["STW"] = data["SOG"]
                        self.msg += ", fallback STW=SOG"

                if data["DEV"] is None:
                    data["DEV"] = 0

                if data["HEL"] is None and self.heels and all(d.has(k) for k in ("TWAF", "TWSF")):
                    data["HEL"] = self.heels.value(
                        d["TWAF"], d["TWSF"] * KNOTS)
                    self.msg += ", heel from polar"

                if data["HEL"] is not None:
                    self.msg += ", leeway estimation"

                dot = self.config[DEPTH_OF_TRANSDUCER]
                draught = self.config[DRAUGHT]
                data["DOT"] = dot if dot >= 0 else None
                data["DRT"] = draught if draught >= 0 else None

                data = {k: v for k, v in data.items() if len(k) == 3}

                data = d = CourseData(**data)  # compute missing values

                self.smooth(data, "AWA", "AWS")
                data["AWDF"] = to360(
                    data["AWAF"] + data["HDT"]) if d.has("AWAF", "HDT") else None
                self.smooth(data, "TWD", "TWS")
                data["TWAF"] = to180(
                    data["TWDF"] - data["HDT"]) if d.has("TWDF", "HDT") else None
                self.smooth(data, "SET", "DFT")
                self.min_max(data, "TWD", lambda v: to180(v - data["TWDF"]))
                for k in ("AWS", "TWS", "DFT"):
                    if k not in data:
                        data[k + "F"] = 0
                        self.msg += ", no " + k

                self.laylines(data)

                calculated = {k for k in data.keys() if data[k] is not None}
                calculated -= present

                for k in data.keys():
                    # print(f"{PATH_PREFIX + k}={data[k]}")
                    self.writeValue(data, k, PATH_PREFIX + k)

                sending = set()
                nmea_write = self.config[WRITE]
                nmea_filter = self.config[NMEA_FILTER].split(",")
                nmea_priority = self.config[PRIORITY]
                ID = self.config[TALKER_ID]
                if nmea_write:
                    for f, s in NMEA_SENTENCES.items():
                        if not data.has(*f.split(",")):
                            missing_fields = {
                              j for j in f.split(",") if data[j] is None}
                            print(" Send $", s[5:8], " Error NMEA_SENTENCES, Param.: ", f, " Missing: ", missing_fields)
                        if any(k in calculated for k in f.split(",")) and data.has(*f.split(",")):
                            s = eval(f"f\"{s}\"")
                            if not nmea_filter or NMEAParser.checkFilter(s, nmea_filter):
                                # print(">", s)
                                self.api.addNMEA(
                                    s,
                                    source=SOURCE,
                                    addCheckSum=True,
                                    omitDecode=not self.config[DECODE],
                                    sourcePriority=nmea_priority,
                                )
                                sending.add(s[:6])

                self.api.setStatus(
                    "NMEA", f"present:{sorted(present)} --> calculated:{sorted(calculated)} sending:{sorted(sending)}{self.msg}")
            except Exception as x:
                self.api.setStatus("ERROR", f"{x}")

            time.sleep(self.config[PERIOD])

    def laylines(self, data):
        try:
            twa, tws, twd = data.TWAF, data.TWSF, data.TWDF
            if any(v is None for v in (twa, tws, twd)):
                return

            brg = bearing_to_waypoint()
            if brg:
                upwind = abs(to180(brg - twd)) < 90
            else:
                upwind = abs(twa) < 90

            tack_angle = self.config[TACK_ANGLE]
            assert 0 <= tack_angle < 180
            gybe_angle = self.config[GYBE_ANGLE]
            assert 0 <= gybe_angle < 180

            data.VMCA, data.VMCB = -1, -1

            if upwind and tack_angle or not upwind and gybe_angle:
                data.LAY = (
                    tack_angle / 2) if upwind else (180 - gybe_angle / 2)
                self.msg += ", fixed laylines"
                return

            if not self.polar:
                return

            if self.config[LAYLINES_FROM_MATRIX] or not self.polar.has_angle(upwind):
                data.LAY = abs(
                    to180(self.polar.vmc_angle(
                        0, tws * KNOTS, 0 if upwind else 180))
                )
                self.msg += ", laylines from polar"
            else:
                data.LAY = self.polar.angle(tws * KNOTS, upwind)
                self.msg += ", laylines from table"

            data.VPOL, data.POLAR = 0, 0
            data.VPOL = self.polar.value(twa, tws * KNOTS) * MPS
            self.msg += ", VPOL"

            if self.config[SHOW_POLAR]:
                values = numpy.array(
                    [
                        self.polar.value(a, tws * KNOTS)
                        for a in numpy.linspace(0, 180, 36)
                    ]
                )
                values /= max(1, values.max())
                data.POLAR = ",".join([f"{v:.2f}" for v in values])
                self.msg += ", show polar"

            if brg and self.config[CALC_VMC]:
                data.VMCA = self.polar.vmc_angle(twd, tws * KNOTS, brg)
                if upwind and abs(to180(brg - twd)) < data.LAY:
                    data.VMCB = self.polar.vmc_angle(twd, tws * KNOTS, brg, -1)
                self.msg += ", VMC"

        except Exception as x:
            self.api.error(f"laylines {x}")
            self.msg += f", laylines error {x}"


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
            self.spl = interp2d(
                self.data["TWA"], self.data["TWS"], self.data[val])

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
    DBS = depth below surface
    DBT = depth below transducer
    DBK = depth below keel
    DRT = draught
    DOT = depth of transducer

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

        if self.misses("HDC") and self.has("HDM", "DEV"):
            self.HDC = to360(self.HDM - self.DEV)

        if self.misses("LEF") and self.has("HEL", "STW"):
            self.LEF = 10

        if self.misses("LEE") and self.has("HEL", "STW", "LEF"):
            self.LEE = (
                max(-30, min(30, self.LEF * self.HEL / self.STW ** 2))
                if self.STW
                else 0
            )

        if self.misses("LEE"):
            self.LEE = 0

        if self.misses("CRS") and self.has("HDT", "LEE"):
            self.CRS = self.HDT + self.LEE

        if self.misses("SET", "DFT") and self.has("COG", "SOG", "CRS", "STW"):
            self.SET, self.DFT = add_polar(
                (self.COG, self.SOG), (self.CRS, -self.STW))

        if self.misses("COG", "SOG") and self.has("SET", "DFT", "CRS", "STW"):
            self.COG, self.SOG = add_polar(
                (self.SET, self.DFT), (self.CRS, self.STW))

        if self.misses("TWA", "TWS") and self.has("AWA", "AWS", "STW", "LEE"):
            self.TWA, self.TWS = add_polar(
                (self.AWA, self.AWS), (self.LEE, -self.STW))
            self.TWA = self.angle(self.TWA)

        if self.misses("TWD", "TWS") and self.has("GWD", "GWS", "SET", "DFT"):
            self.TWD, self.TWS = add_polar(
                (self.GWD, self.GWS), (self.SET, self.DFT))

        if self.misses("AWD") and self.has("AWA", "HDT"):
            self.AWD = to360(self.AWA + self.HDT)

        if self.misses("TWD") and self.has("TWA", "HDT"):
            self.TWD = to360(self.TWA + self.HDT)

        if self.misses("TWA") and self.has("TWD", "HDT"):
            self.TWA = self.angle(self.TWD - self.HDT)

        if self.misses("GWD", "GWS") and self.has("AWD", "AWS", "COG", "SOG"):
            self.GWD, self.GWS = add_polar(
                (self.AWD, self.AWS), (self.COG, -self.SOG))

        if self.misses("GWA") and self.has("GWD", "HDT"):
            self.GWA = self.angle(self.GWD - self.HDT)

        if self.misses("AWA", "AWS") and self.has("TWA", "TWS", "LEE", "STW"):
            self.AWA, self.AWS = add_polar(
                (self.TWA, self.TWS), (self.LEE, self.STW))
            self.AWA = self.angle(self.AWA)

        if self.misses("VMG") and self.has("TWD", "CRS", "STW"):
            self.VMG = cos(radians(self.TWD - self.CRS)) * self.STW

        if self.misses("AWD") and self.has("AWA", "HDT"):
            self.AWD = to360(self.AWA + self.HDT)

        if self.misses("DBS") and self.has("DBT", "DOT"):
            self.DBS = self.DBT + self.DOT

        if self.misses("DBK") and self.has("DBS", "DRT"):
            self.DBK = self.DBS - self.DRT

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
