# the following import is optional
# it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi
import os
from math import sin, cos, radians, degrees, sqrt, atan2, floor, pi, fabs
import xml.etree.ElementTree as ET
import urllib.request, urllib.parse, urllib.error
import time
from builtins import len

try:
    from avnrouter import AVNRouter, WpData
    from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus
except:
    pass

MIN_AVNAV_VERSION = "20220426"

PATHAWDF = "gps.AWDF"
PATHAWSF = "gps.AWSF"
PATHTWDF = "gps.TWDF"
PATHTWSF = "gps.TWSF"
PATHSETF = "gps.SETF"
PATHDFTF = "gps.DFTF"
PATHTLL_SB = "gps.LLSB"
PATHTLL_BB = "gps.LLBB"
PATHTLL_VPOL = "gps.VPOL"
PATHTLL_OPTVMC = "gps.OPTVMC"
PATHmaxTWD = "gps.maxTWD"
PATHminTWD = "gps.minTWD"

SMOOTHING_FAC = "smoothing_factor"
MM_SAMPLES = "minmax_samples"
ADD_WIND = "add_wind"
ADD_TIDE = "add_tide"

CONFIG = [
    {
        "name": SMOOTHING_FAC,
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
        "name": ADD_WIND,
        "description": "write wind data to AvNav model (requires allowKeyOverwrite=true)",
        "default": "False",
        "type": "BOOLEAN",
    },
    {
        "name": ADD_TIDE,
        "description": "write tide data to AvNav model",
        "default": "False",
        "type": "BOOLEAN",
    },
]


class Plugin(object):
    @classmethod
    def pluginInfo(cls):
        """
        the description for the module
        @return: a dict with the content described below
                parts:
                   * description (mandatory)
                   * data: list of keys to be stored (optional)
                     * path - the key - see AVNApi.addData, all pathes starting with "gps." will be sent to the GUI
                     * description
        """
        return {
            "description": "a test plugins",
            "version": "1.0",
            "config": CONFIG,
            "data": [
                {
                    "path": PATHminTWD,
                    "description": "minimum TrueWindDirection last n Minutes",
                },
                {
                    "path": PATHmaxTWD,
                    "description": "maximum TrueWindDirection last n Minutes",
                },
                {"path": PATHTWDF, "description": "smoothed true wind direction"},
                {"path": PATHTWSF, "description": "smoothed true wind speed"},
                {"path": PATHAWDF, "description": "smoothed apparent wind direction"},
                {"path": PATHAWSF, "description": "smoothed apparent wind speed"},
                {"path": PATHSETF, "description": "smoothed tide set direction"},
                {"path": PATHDFTF, "description": "smoothed tide drift rate"},
                {"path": PATHTLL_OPTVMC, "description": "optimum vmc direction"},
                {"path": PATHTLL_SB, "description": "Layline Steuerbord"},
                {"path": PATHTLL_BB, "description": "Layline Backbord"},
                {"path": PATHTLL_VPOL, "description": "Speed aus Polare"},
                {"path": "gps.currentSet", "description": "tide set direction"},
                {"path": "gps.currentDrift", "description": "tide drift rate"},
                {"path": "gps.groundWindSpeed", "description": "ground wind speed"},
                {"path": "gps.groundWindAngle", "description": "ground wind angle"},
                {
                    "path": "gps.groundWindDirection",
                    "description": "ground wind direction",
                },
                {"path": "gps.trueWindSpeed", "description": "true wind speed"},
                {"path": "gps.trueWindAngle", "description": "true wind angle"},
                {"path": "gps.trueWindDirection", "description": "true wind direction"},
            ],
        }

    def __init__(self, api):
        """
        initialize a plugins
        do any checks here and throw an exception on error
        do not yet start any threads!
        @param api: the api to communicate with avnav
        @type  api: AVNApi
        """

        self.api = api  # type: AVNApi
        if self.api.getAvNavVersion() < int(MIN_AVNAV_VERSION):
            raise Exception(
                "SegelDisplay-Plugin is not available for this AvNav-Version"
            )
            return

        self.api.registerEditableParameters(CONFIG, self.changeParam)
        self.api.registerRestart(self.stop)

        vers = self.api.getAvNavVersion()
        # we register an handler for API requests
        self.api.registerRequestHandler(self.handleApiRequest)
        self.count = 0
        self.AWF = 0, 0
        self.TWF = 0, 0
        self.TIF = 0, 0
        self.api.registerRestart(self.stop)
        self.oldtime = 0
        self.polare = {}
        if not self.Polare("polare.xml"):
            raise Exception("polare.xml not found Error")
            return
        self.saveAllConfig()
        self.startSequence = 0

    # Normalizes any number to an arbitrary range
    # by assuming the range wraps around when going below min or above max
    def normalize(self, value, start, end):
        width = end - start
        offsetValue = value - start  # value relative to 0
        return (offsetValue - (floor(offsetValue / width) * width)) + start
        # // + start to reset back to start of original range

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
        self.startSequence += 1

    def stop(self):
        pass

    def run(self):
        twds = []

        def minmax(twd):
            max_count = int(self.getConfigValue(MM_SAMPLES))
            twds.append(twd)
            while len(twds) > max_count:
                twds.pop(0)
            return to360(min(twds)), to360(max(twds))

        self.api.log("started")
        self.api.setStatus("STARTED", "running")
        while not self.api.shouldStopMainThread():
            time.sleep(0.5)
            data = {}
            data["COG"] = self.api.getSingleValue("gps.track")
            data["SOG"] = self.api.getSingleValue("gps.speed")
            data["HDT"] = self.api.getSingleValue("gps.headingTrue")
            data["STW"] = self.api.getSingleValue("gps.waterSpeed")
            data["AWA"] = self.api.getSingleValue("gps.windAngle")
            data["AWS"] = self.api.getSingleValue("gps.windSpeed")
            twa = self.api.getSingleValue("gps.trueWindAngle", includeInfo=True)
            x = twa and "Sail_Instrument" not in twa.source
            if x:
                data["TWA"] = self.api.getSingleValue("gps.trueWindAngle")
                data["TWS"] = self.api.getSingleValue("gps.trueWindSpeed")
            else:
                data["TWA"] = None
                data["TWS"] = None

            if calcTrueWind(self, data):
                t = self.getConfigValue(ADD_TIDE).startswith("T")
                w = self.getConfigValue(ADD_WIND).startswith("T")
                if t and "SET" in data:
                    self.api.addData("gps.currentSet", data["SET"])
                    self.api.addData("gps.currentDrift", data["DFT"])
                if w and all(data.get(x) is not None for x in ["TWA", "TWS"]):
                    if not x:
                        self.api.addData("gps.trueWindSpeed", data["TWS"])
                        self.api.addData("gps.trueWindAngle", data["TWA"])
                    self.api.addData("gps.trueWindDirection", data["TWD"])
                if w and "GWS" in data:
                    self.api.addData("gps.groundWindSpeed", data["GWS"])
                    self.api.addData("gps.groundWindAngle", data["GWA"])
                    self.api.addData("gps.groundWindDirection", data["GWD"])
                best_vmc_angle(self, data)
                data["minTWD"], data["maxTWD"] = minmax(data["TWD"])
                self.api.addData(PATHminTWD, data["minTWD"])
                self.api.addData(PATHmaxTWD, data["maxTWD"])
                if calcFilteredWind(self, data):
                    self.api.addData(PATHAWDF, data["AWDF"])
                    self.api.addData(PATHAWSF, data["AWSF"])
                    self.api.addData(PATHTWDF, data["TWDF"])
                    self.api.addData(PATHTWSF, data["TWSF"])
                    self.api.addData(PATHSETF, data["SETF"])
                    self.api.addData(PATHDFTF, data["DFTF"])
                    calc_Laylines(self, data)

    # https://stackoverflow.com/questions/4983258/python-how-to-check-list-monotonicity
    def strictly_increasing(self, L):
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

    # https://appdividend.com/2019/11/12/how-to-convert-python-string-to-list-example/#:~:text=To%20convert%20string%20to%20list,delimiter%E2%80%9D%20as%20the%20delimiter%20string.

    def handleApiRequest(self, url, handler, args):
        """
        handler for API requests send from the JS
        @param url: the url after the plugin base
        @param handler: the HTTP request handler
                        https://docs.python.org/2/library/basehttpserver.html#BaseHTTPServer.BaseHTTPRequestHandler
        @param args: dictionary of query arguments
        @return:
        """
        out = urllib.parse.parse_qs(url)
        out2 = urllib.parse.urlparse(url)
        if url == "test":
            return {"status": "OK"}
        if url == "parameter":
            # self.count=0
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

        LL_SB = (gpsdata["TWDF"] + wendewinkel / 2) % 360
        LL_BB = (gpsdata["TWDF"] - wendewinkel / 2) % 360

        self.api.addData(PATHTLL_SB, LL_SB)
        self.api.addData(PATHTLL_BB, LL_BB)

        gpsdata["TWA"] = gpsdata["TWA"] % 360
        anglew = fabs(self.normalize(gpsdata["TWA"], -180, 180))
        # 360 - gpsdata['TWA'] if gpsdata['TWA'] > 180 else gpsdata['TWA']
        # in kn
        if not self.polare["boatspeed"]:
            return False
        SOGPOLvar = bilinear(
            self,
            self.polare["windspeedvector"],
            self.polare["windanglevector"],
            self.polare["boatspeed"],
            (gpsdata["TWS"] / 0.514),
            anglew,
        )
        self.api.addData(PATHTLL_VPOL, SOGPOLvar * 0.514444)
        # self.api.ALLOW_KEY_OVERWRITE=True
        # allowKeyOverwrite=True
        # self.api.addData(self.PATHTLL_speed,SOGPOLvar*0.514444)
        return True

        # http://forums.sailinganarchy.com/index.php?/topic/132129-calculating-vmc-vs-vmg/


def to360(a):
    "limit a to [0,360)"
    while a < 0:
        a += 360
    return a % 360


def to180(a):
    "limit a to [-180,+180)"
    a = to360(a)
    return a if a < 180 else a - 360


def toCart(p):
    # to cartesian with phi going clock-wise from north (phi,r)->(x,y)
    return p[1] * sin(radians(p[0])), p[1] * cos(radians(p[0]))


def toPol(c):
    # to polar with phi going clock-wise from north (x,y)->(phi,r)
    return to360(90 - degrees(atan2(c[1], c[0]))), sqrt(c[0] ** 2 + c[1] ** 2)


def add_polar(a, b):
    "sum of polar vectors (phi,r)"
    a, b = toCart(a), toCart(b)
    s = a[0] + b[0], a[1] + b[1]
    return toPol(s)


def calcFilteredWind(self, data):
    try:
        a = float(self.getConfigValue(SMOOTHING_FAC))

        def filter(old, new):
            return (
                old[0] + a * (new[0] - old[0]),
                old[1] + a * (new[1] - old[1]),
            )

        awd, aws = data["AWD"], data["AWS"]
        twd, tws = data["TWD"], data["TWS"]
        set, dft = data.get("SET", 0), data.get("DFT", 0)
        self.AWF = filter(self.AWF, toCart((awd, aws)))
        self.TWF = filter(self.TWF, toCart((twd, tws)))
        self.TIF = filter(self.TIF, toCart((set, dft)))
        data["AWDF"], data["AWSF"] = toPol(self.AWF)
        data["TWDF"], data["TWSF"] = toPol(self.TWF)
        data["SETF"], data["DFTF"] = toPol(self.TIF)
        return True

    except Exception as x:
        self.api.error(f"error in calcFilteredWind {x}")


def calcTrueWind(self, data):
    # self.api.log(f"gpsdata0={data}")
    def missing(msg, *data):
        if any(v is None for v in data):
            if msg:
                self.api.setStatus("ERROR", f"missing input data: {msg}")
            return True

    try:
        cog = data["COG"]
        sog = data["SOG"]
        hdt = data["HDT"]
        stw = data["STW"]
        awa = data["AWA"]
        aws = data["AWS"]
        twa = data["TWA"]
        tws = data["TWS"]
        lee = 0  # needed to get it right, but currently not known here

        fallback = ""
        if missing(0, hdt):
            hdt = cog
            fallback += "HDT=COG "
        if missing(0, stw):
            stw = sog
            fallback += "STW=SOG "

        msg = ""

        if missing(0, twa, tws):
            if missing("AWA/AWS/STW apparent wind or water speed", awa, aws, stw):
                return
            twa, tws = add_polar((awa, aws), (lee, -stw))
            data["TWA"] = twa
            data["TWS"] = tws
            msg += "calculating true wind "

        if missing("HDT true heading", hdt):
            return
        data["AWD"] = to360(awa + hdt)
        data["TWD"] = to360(twa + hdt)

        if not missing(0, sog, sog, awa, aws):
            gwd, gws = add_polar((awa + hdt, aws), (cog, -sog))
            data["GWD"] = gwd
            data["GWS"] = gws
            data["GWA"] = gwd - hdt
            msg += "calculating ground wind "

        if not missing(0, sog, sog, hdt, stw) and not fallback:
            data["SET"], data["DFT"] = add_polar((cog, sog), (hdt + lee, -stw))
            msg += "calculating tide "

        # self.api.log(f"gpsdata1={data}")
        self.api.setStatus(
            "RUNNING" if fallback else "NMEA",
            msg + (f"fallback: {fallback}" if fallback else ""),
        )
        return True

    except Exception as x:
        self.api.error(f"error calculating true wind data {data} {x}")


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
            # self.api.addData(PATHTLL_OPTVMC, (gps['TWD']-wendewinkel)%360,source='SegelDisplay')
            self.api.addData(PATHTLL_OPTVMC, (opthdg) % 360, source="SegelDisplay")
        except:
            pass

        return True

except:

    def best_vmc_angle(self, gps):
        return False

    pass
