#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi
import math
import time
import os
from datetime import date
import xml.etree.ElementTree as ET
import urllib.request, urllib.parse, urllib.error
import json
import sys
from _ast import Try
import traceback
MIN_AVNAV_VERSION="20220426"

    #// https://www.rainerstumpe.de/HTML/wind02.html
    #// https://www.segeln-forum.de/board1-rund-ums-segeln/board4-seemannschaft/46849-frage-zu-windberechnung/#post1263721

    #//http://www.movable-type.co.uk/scripts/latlong.html
    #//The longitude can be normalised to −180…+180 using (lon+540)%360-180


class Plugin(object):
  PATHAWA = "gps.AWA"
  PATHAWD = "gps.AWD"
  PATHAWS = "gps.AWS"
  PATHTWD = "gps.TWD"
  PATHTWS = "gps.TWS"
  PATHTWA = "gps.TWA"
  PATHTLL_speed="gps.speed"
  PATHTWDSS="gps.TSS"   #    TrueWindAngle PT1 gefiltert
  PATHTLL_SB="gps.LLSB" #    Winkel Layline Steuerbord
  PATHTLL_BB="gps.LLBB" #    Winkel Layline Backbord
  PATHTLL_VPOL="gps.VPOL" #  Geschwindigkeit aus Polardiagramm basierend auf TWS und TWA 
#  PATHTLL_speed="gps.speed" #  Geschwindigkeit aus Polardiagramm basierend auf TWS und TWA 


  CONFIG = [
      {
      'name':'TWD_filtFreq',
      'description':'Limit Frequency for PT1-Filter of TWD',
      'default':'0.2',
      'type': 'FLOAT'
      },
              {
          'name': 'allowKeyOverwrite',
          'description': 'necessary to be able to set our time directly from canboat',
          'default': False,
          'type': 'BOOLEAN'
        },

      ]

  
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
      'description': 'a test plugins',
      'version': '1.0',
      'config': cls.CONFIG,
      
      'data': [
        {
          'path': cls.PATHTLL_speed,
          'description': 'apparent Wind direction',
        },
          
        {
          'path': cls.PATHAWD,
          'description': 'apparent Wind direction',
        },
        {
          'path': cls.PATHAWA,
          'description': 'apparent Wind angle',
        },
        {
          'path': cls.PATHAWS,
          'description': 'apparent Wind speed',
        },
        {
          'path': cls.PATHTWD,
          'description': 'true Wind direction',
        },
        {
          'path': cls.PATHTWS,
          'description': 'true Wind speed',
        },
        {
          'path': cls.PATHTWA,
          'description': 'true Wind angle',
        },
        {
          'path': cls.PATHTWDSS,
          'description': 'TWD PT1 for Laylines',
        },
        {
          'path': cls.PATHTLL_SB,
          'description': 'Layline Steuerbord',
        },
        {
          'path': cls.PATHTLL_BB,
          'description': 'Layline Backbord',
        },
        {
          'path': cls.PATHTLL_VPOL,
          'description': 'Speed aus Polare',
        },
      ]
    }




  def __init__(self,api):
    """
        initialize a plugins
        do any checks here and throw an exception on error
        do not yet start any threads!
        @param api: the api to communicate with avnav
        @type  api: AVNApi
    """
    
    self.api = api # type: AVNApi
    if(self.api.getAvNavVersion() < int(MIN_AVNAV_VERSION)):
        raise Exception("Sail_Instrument-Plugin is not available for this AvNav-Version")
        return 

    self.api.registerEditableParameters(self.CONFIG, self.changeParam)
    self.api.registerRestart(self.stop)

    vers=self.api.getAvNavVersion()
    #we register an handler for API requests
    self.api.registerRequestHandler(self.handleApiRequest)
    self.count=0
    self.windAngleSailsteer={'x':0,'y':0, 'alpha':0}
    self.api.registerRestart(self.stop)
    self.oldtime=0
    self.polare={}
    if not self.Polare('polare.xml'):
       raise Exception("polare.xml Error")
       return
    self.Polare('polare.xml')
    self.saveAllConfig()
    self.startSequence = 0



  def getConfigValue(self, name):
    defaults = self.pluginInfo()['config']
    for cf in defaults:
      if cf['name'] == name:
        return self.api.getConfigValue(name, cf.get('default'))
    return self.api.getConfigValue(name)
  
  def saveAllConfig(self):
    d = {}
    defaults = self.pluginInfo()['config']
    for cf in defaults:
      v = self.getConfigValue(cf.get('name'))
      d.update({cf.get('name'):v})
    self.api.saveConfigValues(d)
    return 
  
  def changeConfig(self, newValues):
    self.api.saveConfigValues(newValues)
  
  def changeParam(self,param):
    self.api.saveConfigValues(param)
    self.startSequence+=1  
  
  def stop(self):
    pass

  def PT_1funk(self, f_grenz, t_abtast, oldvalue, newvalue):
    T = 1 / (2*math.pi*f_grenz)
    tau = 1 / ((T / t_abtast) + 1)
    return(oldvalue + tau * (newvalue - oldvalue))


  def run(self):
    """
    the run method
    @return:
    """
    seq=0
    self.api.log("started")
    self.api.setStatus('STARTED', 'running')

    while not self.api.shouldStopMainThread():
      gpsdata=self.api.getDataByPrefix('gps')
      calcTrueWind(self, gpsdata)          
      if 'AWS' in gpsdata and 'AWD' in gpsdata and 'TWA' in gpsdata and 'TWS' in gpsdata:
            if(calcSailsteer(self, gpsdata)):
                self.api.addData(self.PATHTWDSS,gpsdata['TSS'])
                if calc_Laylines(self,gpsdata):  
                    self.api.setStatus('NMEA', 'computing Laylines/TSS/VPOL')
      else:
          self.api.setStatus('ERROR', 'Missing Input (AWD, AWS, TWA or TWS), cannot compute Laylines')


  
  
 #https://stackoverflow.com/questions/4983258/python-how-to-check-list-monotonicity
  def strictly_increasing(L):
        return all(x<y for x, y in zip(L, L[1:]))
  
  def Polare(self, f_name):
    #polare_filename = os.path.join(os.path.dirname(__file__), f_name)
    polare_filename = os.path.join(self.api.getDataDir(),'user','viewer','polare.xml')
    try:
        e_str=polare_filename
        tree = ET.parse(polare_filename)

        
        root = tree.getroot()
        x=ET.tostring(root, encoding='utf8').decode('utf8')
        e_str='windspeedvector'
        x=root.find('windspeedvector').text
    # whitespaces entfernen
        x="".join(x.split())
        self.polare['windspeedvector']=list(map(float,x.strip('][').split(',')))

        e_str='windanglevector'
        x=root.find('windanglevector').text
    # whitespaces entfernen
        x="".join(x.split())
        self.polare['windanglevector']=list(map(float,x.strip('][').split(',')))
        
        e_str='boatspeed'
        x=root.find('boatspeed').text
    # whitespaces entfernen
        z="".join(x.split())
    
        z=z.split('],[')
        boatspeed=[]
        for elem in z:
            zz=elem.strip('][').split(',')
            boatspeed.append(list(map(float,zz)))
        self.polare['boatspeed']=boatspeed


        e_str='wendewinkel'
        x=root.find('wendewinkel')
    
        e_str='upwind'
        y=x.find('upwind').text
    # whitespaces entfernen
        y="".join(y.split())
        self.polare['ww_upwind']=list(map(float,y.strip('][').split(',')))

        e_str='downwind'
        y=x.find('downwind').text
    # whitespaces entfernen
        y="".join(y.split())
        self.polare['ww_downwind']=list(map(float,y.strip('][').split(',')))
    except Exception as error:
        raise Exception("polare.xml Error: "+error.__str__()+' -> '+e_str)
        return(False)

    return(True)


    
#https://appdividend.com/2019/11/12/how-to-convert-python-string-to-list-example/#:~:text=To%20convert%20string%20to%20list,delimiter%E2%80%9D%20as%20the%20delimiter%20string.        

  def handleApiRequest(self,url,handler,args):
    """
    handler for API requests send from the JS
    @param url: the url after the plugin base
    @param handler: the HTTP request handler
                    https://docs.python.org/2/library/basehttpserver.html#BaseHTTPServer.BaseHTTPRequestHandler
    @param args: dictionary of query arguments
    @return:
    """
    out=urllib.parse.parse_qs(url)
    out2=urllib.parse.urlparse(url)
    if url == 'test':
      return {'status':'OK'}
    if url == 'parameter':
      #self.count=0
      defaults = self.pluginInfo()['config']
      b={}
      for cf in defaults:
          v = self.getConfigValue(cf.get('name'))
          b.setdefault(cf.get('name'), v)
      b.setdefault('server_version', self.api.getAvNavVersion())
      return(b)
    return {'status','unknown request'}


    """
    change kartesian koordinates to a polar angle
    @param x,y: kartesian koordinates
    @return: angle in degrees
    """
def toPolWinkel(self, x,y): # alpha in deg
    return(180*math.atan2(y,x)/math.pi)


    """
    change angle in kartesian koordinates
    @param alpha: angle in degrees
    @return: an objekt with the kartesian components x and y
    """
def toKartesisch(self, alpha):# alpha in deg
  K={}
  K['x']=math.cos((alpha * math.pi) / 180)
  K['y']=math.sin((alpha * math.pi) / 180)
  return(K)    
  
"""
    bilinear interpolation
    @param alpha: vector x-axis, vector y-axis, matrix v, coordinates x and y
    @return: interpolated z
"""
def bilinear(self,xv, yv, zv, x, y) :
    #ws = xv
 try:
    angle =yv
    speed =zv
    #var x2i = ws.findIndex(this.checkfunc, x)
    x2i = list(filter(lambda lx: xv[lx] >= x, range(len(xv))))
    if(len(x2i) > 0):
        x2i = 1 if x2i[0] < 1 else x2i[0]
        x2 = xv[x2i]
        x1i = x2i - 1
        x1 = xv[x1i]
    else:
        x1=x2=xv[len(xv)-1]
        x1i=x2i=len(xv)-1

    #var y2i = angle.findIndex(this.checkfunc, y)
    y2i = list(filter(lambda lx: angle[lx] >= y, range(len(angle))))
    if(len(y2i) > 0):
        y2i = 1 if y2i[0] < 1 else y2i[0]
        #y2i = y2i < 1 ? 1 : y2i
        y2 = angle[y2i]
        y1i = y2i - 1
        y1 = angle[y2i - 1]
    else:
        y1=y2=angle[len(angle)-1]
        y1i=y2i=len(angle)-1

    ret =   \
             ((y2 - y) / (y2 - y1)) *   \
        (((x2 - x) / (x2 - x1)) * speed[y1i][x1i]  +    \
            ((x - x1) / (x2 - x1)) * speed[y1i][x2i])  +    \
        ((y - y1) / (y2 - y1)) *    \
        (((x2 - x) / (x2 - x1)) * speed[y2i][x1i]  +    \
            ((x - x1) / (x2 - x1)) * speed[y2i][x2i]) 
    return ret
 except:
        self.api.error(" error calculating bilinear interpolation for TWS with "+str(x)+"kn  at "+str(y)+"°\n")
        return(0)

  
"""
    linear interpolation
    @param alpha: x-value, vector x-axis, vector y-axis
    @return: interpolated y
"""
def linear(x, x_vector, y_vector):

    #var x2i = x_vector.findIndex(this.checkfunc, x)
    #https://www.geeksforgeeks.org/python-ways-to-find-indices-of-value-in-list/
    # using filter()
    # to find indices for 3
    try:
        x2i = list(filter(lambda lx: x_vector[lx] >= x, range(len(x_vector))))
    # y_vector = BoatData.Polare.wendewinkel.upwind;
    #x2i = x2i < 1 ? 1 : x2i
        if(len(x2i) > 0):
           x2i = 1 if x2i[0] < 1 else x2i[0]
           x2 = x_vector[x2i]
           y2 = y_vector[x2i]
           x1i = x2i - 1
           x1 = x_vector[x1i]
           y1 = y_vector[x1i]
           y = ((x2 - x) / (x2 - x1)) * y1 + ((x - x1) / (x2 - x1)) * y2
        else:
            y=y_vector[len(y_vector)-1]
    except:
        self.api.error(" error calculating linear interpolation "+ "\n")
        return 0
    return y


"""
    calculation of laylines and VPOL
    @param gpsdata from store
"""

def calc_Laylines(self,gpsdata):# // [grad]
    
    
    if (self.Polare and 'TWA' in gpsdata):
        # LAYLINES
        if (math.fabs(gpsdata['TWA']) > 120 and math.fabs(gpsdata['TSS']) < 240): 
            wendewinkel = linear((gpsdata['TWS'] / 0.514),self.polare['windspeedvector'],self.polare['ww_downwind']) * 2
        else:
            wendewinkel = linear((gpsdata['TWS'] / 0.514),self.polare['windspeedvector'],self.polare['ww_upwind']) * 2

        LL_SB = (gpsdata['TSS'] + wendewinkel / 2) % 360
        LL_BB = (gpsdata['TSS'] - wendewinkel / 2) % 360
        
        
        self.api.addData(self.PATHTLL_SB,LL_SB)
        self.api.addData(self.PATHTLL_BB,LL_BB)


        gpsdata['TWA']=gpsdata['TWA']%360
        anglew = 360 - gpsdata['TWA'] if gpsdata['TWA'] > 180 else gpsdata['TWA']
        #in kn
        if not self.polare['boatspeed']:
            return False
        SOGPOLvar = bilinear(self,  \
            self.polare['windspeedvector'],    \
            self.polare['windanglevector'],    \
            self.polare['boatspeed'],  \
            (gpsdata['TWS'] / 0.514), \
            anglew  \
        )
        self.api.addData(self.PATHTLL_VPOL,SOGPOLvar*0.514444)
        return True
        
    
"""
    calculation of filtered TWD
    @param gpsdata from store
"""
def calcSailsteer(self, gpsdata):
    rt=gpsdata
    if not 'track' in gpsdata or not 'AWD' in gpsdata:
        return False
    try:
        KaW=toKartesisch(self,gpsdata['AWD']);
        KaW['x'] *= gpsdata['AWS'] #'m/s'
        KaW['y'] *= gpsdata['AWS'] #'m/s'
        KaB=toKartesisch(self, gpsdata['track']);
        KaB['x'] *= gpsdata['speed']  #'m/s'
        KaB['y'] *= gpsdata['speed']  #'m/s'

        t_abtast=(time.time()-self.oldtime)
        freq=1/t_abtast
        self.oldtime=time.time()
      
        fgrenz=float(self.getConfigValue('TWD_filtFreq'))
        self.windAngleSailsteer['x']=self.PT_1funk(fgrenz, t_abtast, self.windAngleSailsteer['x'], KaW['x'] - KaB['x'])
        self.windAngleSailsteer['y']=self.PT_1funk(fgrenz, t_abtast, self.windAngleSailsteer['y'], KaW['y'] - KaB['y'])
      # zurück in Polaren Winkel
        self.windAngleSailsteer['alpha']=toPolWinkel(self,self.windAngleSailsteer['x'],self.windAngleSailsteer['y']) # [grad]
        gpsdata['TSS']=self.windAngleSailsteer['alpha']
        
        return True
    except Exception:
        gpsdata['TSS']=0
        self.api.error(" error calculating TSS ")
        return False
    
"""
    calculation of true wind-data
    @param gpsdata from store
"""
def calcTrueWind(self, gpsdata):
    # https://www.rainerstumpe.de/HTML/wind02.html
    # https://www.segeln-forum.de/board1-rund-ums-segeln/board4-seemannschaft/46849-frage-zu-windberechnung/#post1263721      
        source='Sail_Instrument'

        if not 'track' in gpsdata or not 'windAngle' in gpsdata:
            return False
        gpsdata['AWA']=gpsdata['windAngle']
        gpsdata['AWS']=gpsdata['windSpeed']
        self.api.addData(self.PATHAWA, gpsdata['AWA'],source=source)
        self.api.addData(self.PATHAWS, gpsdata['AWS'],source=source)
        try:
            gpsdata['AWD'] = (gpsdata['AWA'] + gpsdata['track']) % 360
            self.api.addData(self.PATHAWD, gpsdata['AWD'],source=source)

            KaW = toKartesisch(self, gpsdata['AWD'])
            KaW['x'] *= gpsdata['AWS']  # 'm/s'
            KaW['y'] *= gpsdata['AWS']  # 'm/s'
            KaB = toKartesisch(self, gpsdata['track'])
            KaB['x'] *= gpsdata['speed']  # 'm/s'
            KaB['y'] *= gpsdata['speed']  # 'm/s'

            if(gpsdata['speed'] == 0 or gpsdata['AWS'] == 0):
                gpsdata['TWD'] = gpsdata['AWD'] 
                self.api.addData(self.PATHTWD, gpsdata['TWD'],source=source)
            else:
                test= (toPolWinkel(self, KaW['x'] - KaB['x'], KaW['y'] - KaB['y'])) % 360
                gpsdata['TWD'] = (toPolWinkel(self, KaW['x'] - KaB['x'], KaW['y'] - KaB['y'])) % 360
            self.api.addData(self.PATHTWD, gpsdata['TWD'],source=source)
            gpsdata['TWS'] = math.sqrt((KaW['x'] - KaB['x']) * (KaW['x'] - KaB['x']) + (KaW['y'] - KaB['y']) * (KaW['y'] - KaB['y']))
            self.api.addData(self.PATHTWS, gpsdata['TWS'],source=source)

            gpsdata['TWA'] = LimitWinkel(self, gpsdata['TWD'] - gpsdata['track'])
            self.api.addData(self.PATHTWA, gpsdata['TWA'],source=source)
            return True
        except Exception:
            self.api.error(" error calculating TrueWind-Data " + str(gpsdata) + "\n")
        return False
    
def LimitWinkel(self, alpha):  # [grad]   
    alpha %= 360
    if (alpha > 180): 
        alpha -= 360;
    return(alpha)  

