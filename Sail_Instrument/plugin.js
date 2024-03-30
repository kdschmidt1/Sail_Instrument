(function(){
console.log("sail_instrument loaded");


//globalThis.globalParameter={};


var Sail_InstrumentInfoParameters = {
    formatterParameters: false,
    caption: false,
    unit: false,
    value: false,
    Displaytype: {
        type: 'SELECT',
        list: ['dist', 'cum_dist', 'time', 'cum_time'],
        default: 'dist'
    },
};




var intersections

const formatLL = function(dist, speed, opt_unit) {
    let ret = ["", ""]
    try {
        if (!opt_unit || opt_unit.toLowerCase().match("dist")) {
            ret[0] = "nm"
            ret[1] = avnav.api.formatter.formatDistance(dist, 3, 1);
            return ret
        }
        if (opt_unit.toLowerCase().match("time")) {

            let dt = dist / 1825 / (speed * 1.944) //dt=dist[nm]/v[kn] in [hrs]
            let tval = dt * 3600; // in sec
            let sign = "";
            if (tval < 0) {
                sign = "-";
                tval = -tval;
            }
            let h = Math.floor(tval / 3600);
            let m = Math.floor((tval - h * 3600) / 60);
            let s = tval - 3600 * h - 60 * m;
            ret[0] = "hh:mm:ss"
            ret[1] = sign + avnav.api.formatter.formatDecimal(h, 2, 0).replace(" ", "0") + ':' + avnav.api.formatter.formatDecimal(m, 2, 0).replace(" ", "0") + ':' + avnav.api.formatter.formatDecimal(s, 2, 0).replace(" ", "0");
            return ret
        }
    } catch (e) {
        return "-----"
    }
}

formatLL.parameters = [{
    name: 'unit',
    type: 'SELECT',
    list: ['dist', 'cum_dist', 'time', 'cum_time'],
    default: 'dist'
}]

avnav.api.registerFormatter("mySpecialLL", formatLL);

var Sail_InstrumentInfoWidget = {
    name: "Sail_InstrumentInfo",
    //unit: "nm",
    renderHtml: function(props) {
        let fmtParam = "";
        let gpsdata = {
            ...props
        }; // https://www.delftstack.com/de/howto/javascript/javascript-deep-clone-an-object/

        //console.log("Sail_InstrumentInfo");

        //var fmtParam = ((gpsdata.formatterParameters instanceof  Array) && gpsdata.formatterParameters.length > 0) ? gpsdata.formatterParameters[0] : undefined;
        if (typeof(intersections) != 'undefined' && intersections) {
            if (gpsdata.Displaytype != undefined)
                fmtParam = gpsdata.Displaytype
            else
                fmtParam = ['dist']; //((gpsdata.formatterParameters instanceof  Array) && gpsdata.formatterParameters.length > 0) ? gpsdata.formatterParameters[0] : undefined;
            var fv = formatLL(intersections.Boat.BB.dist, gpsdata.speed, fmtParam);
            var fv2 = formatLL(intersections.Boat.SB.dist, gpsdata.speed, fmtParam);
            var fvges = formatLL(intersections.Boat.SB.dist + intersections.Boat.BB.dist, gpsdata.speed, fmtParam);
        } else {
            fv = fv2 = fvges = ["--", "--"]
        }
        ret = "	\
                                			 <div class=\"Sail_InstrumentInfo\"> </div> \
                                			 <div class=\'infoRight\'> " + fv[0] + "</div>	\
                                			 <div class=\" infoLeft \" > " + "Layl." + "</div> \
                                			 <div class=\"resize\"> \
                                			 <br> \
                                			 "
        if (fmtParam.toLowerCase().match("cum")) {
            ret += "	\
                                						 <div class=\"Sail_InstrumentInfoInner\"> \
                                						 <div class=\" infoLeft \" > " + "LLcum" + "</div> \
                                						 <div class=\" widgetData \" > " + fvges[1] + "</div> \
                                						 </div> \
                                						 </div> \
                                						 "
        } else {
            ret += "	\
                                						 <div class=\"Sail_InstrumentInfoInner\"> \
                                						 <div class=\" infoLeft \" > " + "LLBB" + "</div> \
                                						 <div class=\" widgetData \" > " + fv[1] + "</div> \
                                						 </div> \
                                						 <div class=\"Sail_InstrumentInfoInner\"> \
                                						 <div class=\" infoLeft \" > " + "LLSB" + "</div> \
                                						 <div class=\" widgetData \" > " + fv2[1] + "</div> \
                                						 </div> \
                                						 </div> \
                                						 "
        }
        return (ret)
    },
    storeKeys: {
        boatposition: 'nav.gps.position',
        speed: 'nav.gps.sail_instrument.STW',
        LLSB: 'nav.gps.sail_instrument.LLSB',
        LLBB: 'nav.gps.sail_instrument.LLBB',
    },
    formatter: formatLL,
};
/**
 * uncomment the next line to really register the widget
 */
avnav.api.registerWidget(Sail_InstrumentInfoWidget, Sail_InstrumentInfoParameters);




var Sail_InstrumentWidget = {
    name: "Sail_InstrumentWidget",
    caption: "sail_instrument",
    unit: "",
    storeKeys: {
        BRG: 'nav.wp.course',
        POS: 'nav.gps.position',
        LAY: 'nav.gps.sail_instrument.LAY',
        HDT: 'nav.gps.sail_instrument.HDT',
        COG: 'nav.gps.sail_instrument.COG',
        TWDF: 'nav.gps.sail_instrument.TWDF',
        TWSF: 'nav.gps.sail_instrument.TWSF',
        AWDF: 'nav.gps.sail_instrument.AWDF',
        AWSF: 'nav.gps.sail_instrument.AWSF',
        SETF: 'nav.gps.sail_instrument.SETF',
        DFTF: 'nav.gps.sail_instrument.DFTF',
        minTWD: 'nav.gps.sail_instrument.TWDMIN',
        maxTWD: 'nav.gps.sail_instrument.TWDMAX',
        VMCA: 'nav.gps.sail_instrument.VMCA',
        VMCB: 'nav.gps.sail_instrument.VMCB',
        POLAR: 'nav.gps.sail_instrument.POLAR',
    },
    initFunction: function() {},
    finalizeFunction: function() {},
    renderCanvas: function(canvas, data) {
      //console.log(data);
      var ctx = canvas.getContext('2d');
      ctx.save();
      // Set scale factor for all values
      var crect = canvas.getBoundingClientRect();
      var w = crect.width;
      var h = crect.height;
      canvas.width = w;
      canvas.height = h;
//      ctx.save();
      var width = 300;
      var height = 300;
      var f1 = w / width;
      var f2 = h / height;
      var f = Math.min(f1, f2);
      ctx.scale(f, f);
      ctx.translate(width / 2 * f1 / f, height / 2 * f2 / f);

      self = this
//      ctx.save();

      if (data.Widgetposition == 'Mapcenter')
          ctx.translate(canvas.getAttribute("width") / 2, canvas.getAttribute("height") / 2);
      else if (data.Widgetposition == 'Boatposition') {
          if (typeof(data.POS) != 'undefined') {
              coordinates = this.lonLatToPixel(data.POS.lon, data.POS.lat)
              ctx.translate(coordinates[0], coordinates[1]);
          } else
              ctx.translate(canvas.getAttribute("width") / 2, canvas.getAttribute("height") / 2);
      }
      ctx.globalAlpha *= data.Opacity;

     // draw triangle symbolizing the boat
//      ctx.save();
      //ctx.rotate(radians(angle));
      ctx.beginPath();
      var radius=100;
      ctx.moveTo(0, -0.75*radius );
      ctx.lineTo(-0.3*radius, 0.75*radius );
      ctx.lineTo(+0.3*radius, 0.75*radius );
      ctx.closePath();
      ctx.fillStyle = "gray";
      ctx.lineWidth = 0.01 * radius;
      ctx.strokeStyle = "black";
      ctx.fill();
      ctx.stroke();
//      ctx.restore();

      drawWindWidget(ctx, 100, -data.HDT, data);

      // print AWS/TWS
//      ctx.save();
      ctx.fillStyle = "black";
      ctx.textAlign = "left";
      ctx.font = "bold " + 0.2*radius + "px Arial";
      ctx.fillText("AWS", -1.4*radius,-1.3*radius);
      ctx.fillText(knots(data.AWSF).toFixed(1), -1.4*radius,-1.1*radius);
      ctx.textAlign = "right";
      ctx.fillText("TWS", 1.4*radius,-1.3*radius);
      ctx.fillText(knots(data.TWSF).toFixed(1), 1.4*radius,-1.1*radius);
//      ctx.restore();
      ctx.restore();
    },
};

avnav.api.registerWidget(Sail_InstrumentWidget, {});


/*################################################################################################*/
var Sail_Instrument_OverlayParameter = {
    Widgetposition: {
        type: 'SELECT',
        list: ['Boatposition', 'Mapcenter'],
        default: 'Boatposition'
    },
    Displaysize: {
        type: 'NUMBER',
        default: 100
    },
    Opacity: {
        type: 'NUMBER',
        default: 1
    },
};

let Sail_Instrument_Overlay = {

    // Editable Parameters
    Displaysize: 100,
    Opacity: 1,
    Widgetposition: 'Boatposition',

    name: 'Sail_Instrument_Overlay',
    type: 'map',
    storeKeys: {
        BRG: 'nav.wp.course',
        POS: 'nav.gps.position',
        LAY: 'nav.gps.sail_instrument.LAY',
        HDT: 'nav.gps.sail_instrument.HDT',
        COG: 'nav.gps.sail_instrument.COG',
        TWDF: 'nav.gps.sail_instrument.TWDF',
        TWSF: 'nav.gps.sail_instrument.TWSF',
        AWDF: 'nav.gps.sail_instrument.AWDF',
        AWSF: 'nav.gps.sail_instrument.AWSF',
        SETF: 'nav.gps.sail_instrument.SETF',
        DFTF: 'nav.gps.sail_instrument.DFTF',
        minTWD: 'nav.gps.sail_instrument.TWDMIN',
        maxTWD: 'nav.gps.sail_instrument.TWDMAX',
        VMCA: 'nav.gps.sail_instrument.VMCA',
        VMCB: 'nav.gps.sail_instrument.VMCB',
        POLAR: 'nav.gps.sail_instrument.POLAR',
    },
    initFunction: function() {},
    finalizeFunction: function() {},
    renderCanvas: function(canvas, data, center) {
        //console.log(data);
        let ctx = canvas.getContext('2d')
        ctx.save();
        
        if (data.Widgetposition == 'Mapcenter')
            ctx.translate(canvas.getAttribute("width") / 2, canvas.getAttribute("height") / 2);
        else if (data.Widgetposition == 'Boatposition') {
            if (typeof(data.POS) != 'undefined') {
                coordinates = this.lonLatToPixel(data.POS.lon, data.POS.lat)
                ctx.translate(coordinates[0], coordinates[1]);
            } else
                ctx.translate(canvas.getAttribute("width") / 2, canvas.getAttribute("height") / 2);
        }
        ctx.globalAlpha *= data.Opacity;

        drawWindWidget(ctx, data.Displaysize, degrees(this.getRotation()), data);
        ctx.restore();
    }

}

function knots(v){
  return 1.94384*v;
}

var red = "red";
var green = "rgb(0,255,0)";
var blue = "blue";
var black = "black";
var orange = "orange";

function drawWindWidget(ctx,size, maprotation, data){
        //console.log("draw widget");
        DrawOuterRing(ctx, size, maprotation + data.HDT);
        DrawKompassring(ctx, size, maprotation);
        if (knots(data.DFTF)>=0.3) {
            drawTideArrow(ctx, size, maprotation + data.SETF , "teal", knots(data.DFTF).toFixed(1));
        }
        if (knots(data.TWSF)>=1) {
          if(data.POLAR){
            drawPolar(ctx,size,maprotation,data,"black");
          }
          var mm = [data.minTWD, data.maxTWD];
          DrawLaylineArea(ctx, size, maprotation + data.TWDF - data.LAY, mm, green);
          DrawLaylineArea(ctx, size, maprotation + data.TWDF + data.LAY, mm, red);
        }
        if (data.VMCA>=0) {
          DrawLaylineArea(ctx, size, maprotation + data.VMCA, [0,0], blue);
        }
        if (data.VMCB>=0) {
          DrawLaylineArea(ctx, size, maprotation + data.VMCB, [0,0], "lightblue");
        }
        if (knots(data.AWSF)>=1) {
            DrawWindpfeilIcon(ctx, size, maprotation + data.AWDF, green, 'A');
        }
        if (knots(data.TWSF)>=1) {
            DrawWindpfeilIcon(ctx, size, maprotation + data.TWDF, blue, data.HDT==data.COG ? 'G' : 'T');
        }
        if (typeof(data.BRG) != 'undefined') {
            DrawWPIcon(ctx, size, maprotation + data.BRG);
        }
        DrawEierUhr(ctx, size, maprotation + data.COG, orange, 'T');
        DrawCourseBox(ctx, size, maprotation + data.HDT, black, Math.round(data.HDT));
}

avnav.api.registerWidget(Sail_Instrument_Overlay, Sail_Instrument_OverlayParameter);

function drawPolar(ctx,size,maprotation,data,color){
    ctx.save();
    ctx.beginPath();
    ctx.rotate((maprotation+data.TWDF) * Math.PI/180);
    var r=0.7*size;
    //console.log(data.POLAR);
    var v=[];
    data.POLAR.split(",").forEach(function(s,i){
      v.push(parseFloat(s));
    });;
    //console.log(v,v.length);
    for(var s=1; s>-2; s-=2){
      for(var i=0; i<v.length; i+=1){
        var a = s*180*i/(v.length-1)+180;
        var x = r*Math.sin(a*Math.PI/180)*v[i];
        var y = r*Math.cos(a*Math.PI/180)*v[i];
        if (i==0) ctx.moveTo(x,y);
        else      ctx.lineTo(x,y);
      }
    }
    ctx.lineWidth=0.02*r;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
}

/*##################################################################################################*/
let LayLines_Overlay = {

    // Editable Parameters
    Opacity: 1,
    Laylinelength_nm: 10,
    Laylineoverlap: false,
    LaylineBoat: true,
    LaylineWP: true,

    name: 'LayLines-Overlay',
    type: 'map',
    storeKeys: {
        WP: 'nav.wp.position',
        POS: 'nav.gps.position',
        LAY: 'nav.gps.sail_instrument.LAY',
        TWDF: 'nav.gps.sail_instrument.TWDF',
    },
    initFunction: function() {},
    finalizeFunction: function() {},
    renderCanvas: function(canvas, props, center) {
        if (typeof(props.POS) != 'undefined') {
            let ctx = canvas.getContext('2d');
            ctx.save();
            ctx.globalAlpha *= props.Opacity;

            intersections = calc_intersections(self, props);

            if (typeof(intersections) != 'undefined') {
                DrawMapLaylines(this, ctx, intersections, props);
            }
            ctx.restore();
        }
    },
}

var LayLines_OverlayParameter = {

    Opacity: {
        type: 'NUMBER',
        default: 1
    },
    Laylinelength_nm: {
        type: 'NUMBER',
        default: 10
    },
    Laylineoverlap: {
        type: 'BOOLEAN',
        default: false
    },
    LaylineBoat: {
        type: 'BOOLEAN',
        default: true
    },
    LaylineWP: {
        type: 'BOOLEAN',
        default: true
    },
};

avnav.api.registerWidget(LayLines_Overlay, LayLines_OverlayParameter);
/*##################################################################################################*/

let LatLon = avnav.api.LatLon();
let calc_intersections = function(self, props) {
    //console.log(props);
    intersections = null;
    let b_pos = new LatLon(props.POS.lat, props.POS.lon);
    //b_pos = avnav.api.createLatLon(props.boatposition.lat, props.boatposition.lon);
    if (props.WP) {
        WP_pos = new LatLon(props.WP.lat, props.WP.lon);

        // Intersections berechnen
        //console.log(props.TWDF-props.LAY,props.TWDF+props.LAY);
        var is_SB = LatLon.intersection(b_pos, to360(props.TWDF-props.LAY), WP_pos, to360(props.TWDF+props.LAY + 180));
        var is_BB = LatLon.intersection(b_pos, to360(props.TWDF+props.LAY), WP_pos, to360(props.TWDF-props.LAY + 180));
        //console.log(b_pos,is_SB,is_BB);
        calc_endpoint = function(intersection, pos) {
            let is_xx = {};
            is_xx.dist = pos.rhumbDistanceTo(intersection); // in m
            if (is_xx.dist / 1000 > 20000) // Schnittpunkt liegt auf der gegenüberliegenden Erdseite!
                return null;
            if (is_xx.dist > props.Laylinelength_nm * 1852) // beides in m// wenn abstand gösser gewünschte LL-Länge, neuen endpunkt der LL berechnen
                is_xx.pos = pos.rhumbDestinationPoint(props.Laylinelength_nm * 1852, pos.rhumbBearingTo(intersection)) // abstand in m
            else if (is_xx.dist < props.Laylinelength * 1852 && props.Laylineoverlap == true) // wenn abstand kleiner gewünschte LL-Länge und Verlängerung über schnittpunkt gewollt, neuen endpunkt der LL berechnen
                is_xx.pos = pos.rhumbDestinationPoint(props.Laylinelength_nm * 1852, pos.rhumbBearingTo(intersection)) // abstand in m
            else
                is_xx.pos = intersection;
            return (is_xx)
        };

        is_BB_boat = is_BB_WP = is_SB_boat = is_SB_WP = null;
        if (is_BB) {
            is_BB_boat = calc_endpoint(is_BB, b_pos);
            is_BB_WP = calc_endpoint(is_BB, WP_pos);
        }
        if (is_SB) {
            is_SB_boat = calc_endpoint(is_SB, b_pos);
            is_SB_WP = calc_endpoint(is_SB, WP_pos);
        }

        if (is_SB_boat && is_SB_WP && is_BB_boat && is_BB_WP) {
            // es gibt schnittpunkte
            intersections = {
                Boat: {
                    SB: {
                        P1: b_pos,
                        P2: is_SB_boat.pos,
                        color: 'rgb(0,255,0)',
                        dist: is_SB_boat.dist
                    },
                    BB: {
                        P1: b_pos,
                        P2: is_BB_boat.pos,
                        color: 'red',
                        dist: is_BB_boat.dist
                    }
                },
                WP: {
                    SB: {
                        P1: WP_pos,
                        P2: is_SB_WP.pos,
                        color: 'red',
                        dist: is_SB_WP.dist
                    },
                    BB: {
                        P1: WP_pos,
                        P2: is_BB_WP.pos,
                        color: 'rgb(0,255,0)',
                        dist: is_BB_WP.dist
                    }
                }
            }
        } else
            // keine schnittpunkte
            intersections = null;
    }
    return intersections
}


let DrawMapLaylines = function(self, ctx, intersections, props) {
    ctx.save();
    function drawLine(p1, p2, color) {
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        var d=5*window.devicePixelRatio;
        ctx.setLineDash([2*d,d]);
        ctx.stroke();
    }
    if (typeof(props.LaylineBoat) != 'undefined' && props.LaylineBoat == true && intersections != null) {
        // port
        p1 = self.lonLatToPixel(intersections.Boat.BB.P1._lon, intersections.Boat.BB.P1._lat);
        p2 = self.lonLatToPixel(intersections.Boat.BB.P2._lon, intersections.Boat.BB.P2._lat);
        drawLine(p1, p2, red);
        // starboard
        p1 = self.lonLatToPixel(intersections.Boat.SB.P1._lon, intersections.Boat.SB.P1._lat);
        p2 = self.lonLatToPixel(intersections.Boat.SB.P2._lon, intersections.Boat.SB.P2._lat);
        drawLine(p1, p2, green);
    }
    if (typeof(props.LaylineWP) != 'undefined' && props.LaylineWP == true && intersections != null) {
        // port
        p1 = self.lonLatToPixel(intersections.WP.BB.P1._lon, intersections.WP.BB.P1._lat);
        p2 = self.lonLatToPixel(intersections.WP.BB.P2._lon, intersections.WP.BB.P2._lat);
        drawLine(p1, p2, green);
        // starboard
        p1 = self.lonLatToPixel(intersections.WP.SB.P1._lon, intersections.WP.SB.P1._lat);
        p2 = self.lonLatToPixel(intersections.WP.SB.P2._lon, intersections.WP.SB.P2._lat);
        drawLine(p1, p2, red);

    }
    ctx.restore()
}

let DrawWPIcon = function(ctx, radius, angle) {
    ctx.save();
    ctx.beginPath();

    var thickness = radius / 4;

    ctx.rotate((angle / 180) * Math.PI)

    ctx.arc(0, -radius + thickness / 3, thickness / 4, 0, 2 * Math.PI);
    ctx.strokeStyle = "black";
    ctx.stroke();
    ctx.fillStyle = "rgb(255,255,0)";
    ctx.fill();


    ctx.restore();

}


let DrawLaylineArea = function(ctx, radius, angle, minmax, color) {

    ctx.save();
    var radius = 0.9 * radius
    ctx.rotate(radians(angle))

    // Laylines
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -radius);
    ctx.lineWidth = 0.02*radius;
    ctx.strokeStyle = color;
    var d=5*window.devicePixelRatio;
    ctx.setLineDash([2*d,d]);
    ctx.stroke();

    // sectors
    ctx.globalAlpha *= 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, radians(minmax[0] - 90), radians(minmax[1] - 90))
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill()
    ctx.restore()
}


let DrawCourseBox = function(ctx, radius, angle, color, Text) {
    ctx.save();
    ctx.rotate((angle / 180) * Math.PI)


    let roundRect = function(x, y, w, h, radius) {
        var r = x + w;
        var b = y + h;
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.lineWidth = "4";
        ctx.moveTo(x + radius, y);
        ctx.lineTo(r - radius, y);
        ctx.quadraticCurveTo(r, y, r, y + radius);
        ctx.lineTo(r, y + h - radius);
        ctx.quadraticCurveTo(r, b, r - radius, b);
        ctx.lineTo(x + radius, b);
        ctx.quadraticCurveTo(x, b, x, b - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.stroke();
    }
    let Muster = "888"
    ctx.font = "bold " + radius / 5 + "px Arial";
    metrics = ctx.measureText(Muster);
    w = metrics.width
    h = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
    roundRect(-1.2 * w / 2, -radius - 1.2 * h / 2, 1.2 * w, 1.2 * h, 0.1 * radius / 4);
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "bold " + radius / 5 + "px Arial";
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillText(Text, 0, -radius + h / 2);
    ctx.restore();

}

let DrawEierUhr = function(ctx, radius, angle, color, Text) {
    ctx.save();

    var radius_kompassring = radius //0.525*Math.min(x,y);
    var radius_outer_ring = radius * 1.3 //= 0.65*Math.min(x,y);
    var thickness = radius / 4;

    ctx.rotate((angle / 180) * Math.PI)
    let lx = -0.4 * thickness
    let rx = +0.4 * thickness
    let topy = -radius + 0.9 * thickness
    let boty = -radius - 0.9 * thickness
    ctx.beginPath();
    ctx.moveTo(lx, boty); // move to bottom left corner
    ctx.lineTo(rx, topy); // line to top right corner
    ctx.lineTo(lx, topy); // line to top left corner
    ctx.lineTo(rx, boty); // line to bottom right corner
    //ctx.lineTo(lx, boty); // line to bottom left corner
    ctx.closePath()
    ctx.fillStyle = color;
    ctx.lineWidth = 0.05 * thickness;
    ctx.strokeStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgb(0,0,0)";
    ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';

    ctx.restore();

}



let DrawWindpfeilIcon = function(ctx, radius, angle, color, Text) {
    ctx.save();

    var radius_kompassring = radius //0.525*Math.min(x,y);
    var radius_outer_ring = radius * 1.3 //= 0.65*Math.min(x,y);
    var thickness = radius / 4;

    ctx.rotate(radians(angle));

    ctx.beginPath();
    if (Text == 'A')
        ctx.moveTo(0, -radius_kompassring + 0.75 * thickness); // Move pen to bottom-center corner
    else
        ctx.moveTo(0, -radius_kompassring - 0.5 * thickness); // Move pen to bottom-center corner
    ctx.lineTo(-0.75 * thickness, -radius_outer_ring - thickness); // Line to top left corner
    ctx.lineTo(+0.75 * thickness, -radius_outer_ring - thickness); // Line to top-right corner
    ctx.closePath(); // Line to bottom-center corner
    ctx.fillStyle = color;
    ctx.lineWidth = 0.05 * thickness;
    ctx.strokeStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgb(0,0,0)";
    ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';

    ctx.fillStyle = "rgb(255,255,255)";
    ctx.textAlign = "center";
    ctx.font = "bold " + radius / 4 + "px Arial";
    ctx.fillText(Text, 0, -1.02*radius_outer_ring);
    ctx.restore();

}



function drawTideArrow(ctx, radius, angle, color, label) {
    ctx.save();
    ctx.rotate(radians(angle));
    ctx.beginPath();
    ctx.moveTo(0, 0.3*radius );
    ctx.lineTo(-0.25*radius, 0.75*radius );
    ctx.lineTo(+0.25*radius, 0.75*radius );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.lineWidth = 0.01 * radius;
    ctx.strokeStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgb(0,0,0)";
    ctx.stroke();
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.textAlign = "center";
    ctx.font = "bold " + (0.15*radius) + "px Arial";
    ctx.fillText(label, 0, 0.70*radius);
    ctx.restore();
}




let DrawOuterRing = function(ctx, radius, angle) {
    ctx.save();
    ctx.rotate((angle / 180) * Math.PI)

    var thickness = 0.2 * radius
    radius *= 1.25
    var someColors = [];
    someColors.push("#0F0");
    someColors.push("#000");
    someColors.push("#F00");

    drawMultiRadiantCircle(0, 0, radius, thickness, someColors);

    function drawMultiRadiantCircle(xc, yc, r, thickness, radientColors) {
        var partLength = (2 * Math.PI) / 2;
        var start = -Math.PI / 2;
        var gradient = null;
        var startColor = null,
            endColor = null;

        for (var i = 0; i < 2; i++) {
            startColor = radientColors[i];
            endColor = radientColors[(i + 1) % radientColors.length];

            // x start / end of the next arc to draw
            var xStart = xc + Math.cos(start) * r;
            var xEnd = xc + Math.cos(start + partLength) * r;
            // y start / end of the next arc to draw
            var yStart = yc + Math.sin(start) * r;
            var yEnd = yc + Math.sin(start + partLength) * r;

            ctx.beginPath();

            gradient = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
            gradient.addColorStop(0, startColor);
            gradient.addColorStop(1.0, endColor);

            ctx.strokeStyle = gradient;
            ctx.arc(xc, yc, r, start, start + partLength);
            ctx.lineWidth = thickness;
            ctx.stroke();
            ctx.closePath();

            start += partLength;
        }
    }
    for (var i = 0; i < 360; i += 10) {
        ctx.save();
        ctx.rotate((i / 180) * Math.PI);
        if (i % 30 == 0) {
            ctx.beginPath(); // Start a new path
            ctx.moveTo(0, -radius + 0.9 * thickness / 2); // Move the pen to (30, 50)
            ctx.lineTo(0, -radius - 0.9 * thickness / 2); // Draw a line to (150, 100)
            ctx.lineWidth = 0.1 * thickness;
            ctx.strokeStyle = "rgb(255,255,255)";
            ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';
        } else {
            ctx.beginPath();
            ctx.fillStyle = "rgb(190,190,190)";
            ctx.arc(0, -radius, 0.1 * thickness, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.lineWidth = 0.05 * thickness;
            ctx.strokeStyle = "rgb(190,190,190)";
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();
} //Ende OuterRing

let DrawKompassring = function(ctx, radius, angle) {
    ctx.save();
    ctx.rotate((angle / 180) * Math.PI)
    var thickness = 0.2 * radius //1*Math.min(x,y)
    ctx.beginPath();
    var fontsize = Math.round(radius / 100 * 12)
    ctx.arc(0, 0, radius, 0, 2 * Math.PI, false);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = "rgb(255,255,255)";
    ctx.stroke();
    for (var i = 0; i < 360; i += 10) {
        ctx.save();
        ctx.rotate((i / 180) * Math.PI);
        if (i % 30 == 0) {
            ctx.fillStyle = "rgb(00,00,00)";
            ctx.textAlign = "center";
            ctx.font = `bold ${fontsize}px Arial`;
            ctx.fillText(i.toString().padStart(3, "0"), 0, -radius + thickness / 4);
        } else {
            ctx.beginPath();
            ctx.fillStyle = "rgb(100,100,100)";
            ctx.arc(0, -radius, 0.1 * thickness, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.lineWidth = 0.05 * thickness;
            ctx.strokeStyle = "rgb(100,100,100)";
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();
} // Ende Kompassring




function to360(a) {
    while (a < 360) {
        a += 360;
    }
    return a % 360;
}

function to180(a) {
    return to360(a+180)-180;
}

function radians(a) {
    return a * Math.PI / 180;
}

function degrees(a) {
    return a * 180 / Math.PI;
}

})();
