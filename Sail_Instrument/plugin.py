# the following import is optional
# it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi
import os
from math import sin, cos, radians, degrees, sqrt, atan2, floor, pi, fabs
import xml.etree.ElementTree as ET
import urllib.request, urllib.parse, urllib.error
import time
from coursedata import *

try:
    from avnrouter import AVNRouter, WpData
    from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus
except:
    pass

MIN_AVNAV_VERSION = "20230705"
SAILINSTRUMENT_PREFIX = "gps.sailinstrument."
SMOOTHING_FACTOR = "smoothing_factor"
MM_SAMPLES = "minmax_samples"
WRITE_DATA = "write_data"
WIND = "wind"
FALLBACK = "allow_fallback"

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
        "name": WRITE_DATA,
        "description": "write calculated data to AvNav model in gps.* (requires allowKeyOverwrite=true), all data is always available in "
        + SAILINSTRUMENT_PREFIX
        + "*",
        "default": "False",
        "type": "BOOLEAN",
    },
    {
        "name": WIND,
        "description": "manually entered ground wind for testing, enter as 'direction,speed', is used if there is no other apparent or true wind data is present",
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
        if not self.Polare("polare.xml"):
            raise Exception("polare.xml not found Error")
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
            samples = int(self.getConfigValue(MM_SAMPLES))
            if key not in data:
                return
            v = data[key]
            if key not in min_max_values:
                min_max_values[key] = []
            values = min_max_values[key]
            values.append(func(v))
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

            best_vmc_angle(self, d)
            calc_Laylines(self, d)

            # self.api.log(f"\n{d}")

            for k in d.keys():  # publish sailinstrument data
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

    def strictly_increasing(self, L):
        # https://stackoverflow.com/questions/4983258/python-how-to-check-list-monotonicity
        return all(x < y for x, y in zip(L, L[1:]))

    def Polare(self, f_name):
        # polare_filename = os.path.join(os.path.dirname(__file__), f_name)
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

    def handleApiRequest(self, url, handler, args):
        out = urllib.parse.parse_qs(url)
        out2 = urllib.parse.urlparse(url)
        if url == "test":
            return {"status": "OK"}
        if url == "parameter":
            defaults = self.pluginInfo()["config"]
            b = {}
            for cf in defaults:
                v = self.getConfigValue(cf.get("name"))
                b.setdefault(cf.get("name"), v)
            b.setdefault("server_version", self.api.getAvNavVersion())
            return b
        return {"status", "unknown request"}


def bilinear(self, xv, yv, zv, x, y):
    # ws = xv
    try:
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
    except:
        self.api.error(
            " error calculating bilinear interpolation for TWS with "
            + str(x)
            + "kn  at "
            + str(y)
            + "°\n"
        )
        return 0


def linear(x, x_vector, y_vector):
    # var x2i = x_vector.findIndex(this.checkfunc, x)
    # https://www.geeksforgeeks.org/python-ways-to-find-indices-of-value-in-list/
    # using filter()
    # to find indices for 3
    try:
        x2i = list(filter(lambda lx: x_vector[lx] >= x, range(len(x_vector))))
        # y_vector = BoatData.Polare.wendewinkel.upwind;
        # x2i = x2i < 1 ? 1 : x2i
        if len(x2i) > 0:
            x2i = 1 if x2i[0] < 1 else x2i[0]
            x2 = x_vector[x2i]
            y2 = y_vector[x2i]
            x1i = x2i - 1
            x1 = x_vector[x1i]
            y1 = y_vector[x1i]
            y = ((x2 - x) / (x2 - x1)) * y1 + ((x - x1) / (x2 - x1)) * y2
        else:
            y = y_vector[len(y_vector) - 1]
    except:
        return 0
    return y


def calc_Laylines(self, gpsdata):  # // [grad]
    if self.Polare and "TWA" in gpsdata:
        # LAYLINES
        if fabs(gpsdata["TWA"]) > 120 and fabs(gpsdata["TWA"]) < 240:
            wendewinkel = (
                linear(
                    (gpsdata["TWS"] / 0.514),
                    self.polare["windspeedvector"],
                    self.polare["ww_downwind"],
                )
                * 2
            )
        else:
            wendewinkel = (
                linear(
                    (gpsdata["TWS"] / 0.514),
                    self.polare["windspeedvector"],
                    self.polare["ww_upwind"],
                )
                * 2
            )

        gpsdata.LLSB = (gpsdata["TWDF"] + wendewinkel / 2) % 360
        gpsdata.LLBB = (gpsdata["TWDF"] - wendewinkel / 2) % 360

        anglew = fabs(to180(gpsdata["TWA"]))
        # 360 - gpsdata['TWA'] if gpsdata['TWA'] > 180 else gpsdata['TWA']
        # in kn
        if not self.polare["boatspeed"]:
            return

        SOGPOLvar = bilinear(
            self,
            self.polare["windspeedvector"],
            self.polare["windanglevector"],
            self.polare["boatspeed"],
            (gpsdata["TWS"] / 0.514),
            anglew,
        )
        gpsdata.VPOL = SOGPOLvar * 0.514444


try:
    import numpy as np
    from scipy.interpolate import InterpolatedUnivariateSpline

    def quadratic_spline_roots(self, spl):
        roots = []
        knots = spl.get_knots()
        for a, b in zip(knots[:-1], knots[1:]):
            u, v, w = spl(a), spl((a + b) / 2), spl(b)
            t = np.roots([u + w - 2 * v, w - u, 2 * v])
            t = t[np.isreal(t) & (np.abs(t) <= 1)]
            roots.extend(t * (b - a) / 2 + (b + a) / 2)
        return np.array(roots)

    def best_vmc_angle(self, gps):
        try:
            router = AVNWorker.findHandlerByName(AVNRouter.getConfigName())
            if router is None:
                return False
            wpData = router.getWpData()
            if wpData is None:
                return False
            if not wpData.validData and self.ownWpOffSent:
                return True
        except:
            return False

        try:
            self.cWendewinkel_upwind = []
            self.cWendewinkel_downwind = []

            lastindex = len(self.polare["windanglevector"])

            x = np.array(self.polare["boatspeed"])
            BRG = wpData.dstBearing
            windanglerad = np.deg2rad(
                BRG - gps["TWD"] + np.array(self.polare["windanglevector"])
            )
            coswindanglerad = np.cos(windanglerad)

            self.cWendewinkel_upwind = []
            vmc = []
            for i in range(len(self.polare["windspeedvector"])):
                updownindexvalue = next(
                    z for z in self.polare["windanglevector"] if z >= 90
                )
                updownindex = self.polare["windanglevector"].index(
                    updownindexvalue, 0, lastindex
                )
                spalte = i
                # vmc=v*cos(BRG-HDG)
                # HDG = TWD +/- TWA
                # test: BRG = , TWD=0 --> HDG=-TWA --> vmc=v*cos(BRG+TWA)
                vmc.append(
                    np.array(x[0:lastindex, spalte]) * coswindanglerad[0:lastindex]
                )
                f = InterpolatedUnivariateSpline(
                    self.polare["windanglevector"], vmc[spalte][:], k=3
                )
                cr_pts = quadratic_spline_roots(self, f.derivative())
                cr_vals = f(cr_pts)
                min_index = np.argmin(cr_vals)
                max_index = np.argmax(cr_vals)
                # print("Maximum value {} at {}\nMinimum value {} at {}".format(cr_vals[max_index], cr_pts[max_index], cr_vals[min_index], cr_pts[min_index]))
                self.cWendewinkel_upwind.append(cr_pts[max_index])
            # Der TWA mit der höschsten VMC
            spl = InterpolatedUnivariateSpline(
                self.polare["windspeedvector"], self.cWendewinkel_upwind, k=3
            )
            wendewinkel = linear(
                (gps["TWS"] / 0.514),
                self.polare["windspeedvector"],
                self.cWendewinkel_upwind,
            )
            opttwa = spl(gps["TWS"] / 0.514)
            opthdg = (gps["TWD"] - opttwa) % 360
            diff1 = abs((gps["TWD"] - wendewinkel) % 360 - (gps["TWD"] - opttwa) % 360)
            # aus WA=WD-HDG folgt HDG = WD-WA
            gps.OPTVMC = to360(opthdg)
        except:
            pass

        return True

except:

    def best_vmc_angle(self, gps):
        return
