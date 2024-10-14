//TODO: rename Windplot to Sail_Instrument_History_Plot








(function () {
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

    var intersections;

    const formatLL = function (dist, speed, opt_unit) {
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
        storeKeys: {
            boatposition: 'nav.gps.position',
            speed: 'nav.gps.sail_instrument.STW',
            LLSB: 'nav.gps.sail_instrument.LLSB',
            LLBB: 'nav.gps.sail_instrument.LLBB',
        },
        //unit: "nm",
        renderHtml: function (props) {
            let fmtParam = "";
            let gpsdata = {
                ...props
            }; // https://www.delftstack.com/de/howto/javascript/javascript-deep-clone-an-object/

            //console.log("Sail_InstrumentInfo");

            //var fmtParam = ((gpsdata.formatterParameters instanceof  Array) && gpsdata.formatterParameters.length > 0) ? gpsdata.formatterParameters[0] : undefined;
            if (typeof (intersections) != 'undefined' && intersections) {
                if (typeof (gpsdata.Displaytype) != 'undefined')
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
        formatter: formatLL,
    };
    /**
     * uncomment the next line to really register the widget
     */
    avnav.api.registerWidget(Sail_InstrumentInfoWidget, Sail_InstrumentInfoParameters);


    function clamp(smallest, x, largest) {
        return Math.max(smallest, Math.min(largest, x));
    }

    function drawCircularText(ctxRef, text, x, y, diameter, startAngle, align, textInside, inwardFacing, fName, fSize, kerning) {
        // text:         The text to be displayed in circular fashion
        // diameter:     The diameter of the circle around which the text will
        //               be displayed (inside or outside)
        // startAngle:   In degrees, Where the text will be shown. 0 degrees
        //               if the top of the circle
        // align:        Positions text to left right or center of startAngle
        // textInside:   true to show inside the diameter. False to show outside
        // inwardFacing: true for base of text facing inward. false for outward
        // fName:        name of font family. Make sure it is loaded
        // fSize:        size of font family. Don't forget to include units
        // kearning:     0 for normal gap between letters. positive or
        //               negative number to expand/compact gap in pixels
        //------------------------------------------------------------------------
        ctxRef.save()
        align = align.toLowerCase()
        var clockwise = align == "right" ? 1 : -1 // draw clockwise for aligned right. Else Anticlockwise
        startAngle = startAngle * (Math.PI / 180) // convert to radians

        // calculate height of the font
        var div = document.createElement("div");
        div.innerHTML = text;
        div.style.position = "absolute";
        div.style.top = "-10000px";
        div.style.left = "-10000px";
        div.style.fontFamily = fName;
        div.style.fontSize = fSize;
        document.body.appendChild(div);
        var textHeight = div.offsetHeight;
        document.body.removeChild(div);


        let metrics = ctxRef.measureText('Mann');
        // in cases where we are drawing outside diameter,
        // expand diameter to handle it
        // in cases where we are drawing outside diameter,
        // expand diameter to handle it
        if (!textInside) {
            if (inwardFacing)
                diameter += textHeight * 2;
            else
                diameter += textHeight * 3;
        }

        ctxRef.fillStyle = "black";
        ctxRef.font = "bold " + fSize + " " + fName;

        // Reverse letters for align Left inward, align right outward
        // and align center inward.
        if (
            (["left", "center"].indexOf(align) > -1 && inwardFacing) ||
            (align == "right" && !inwardFacing)
        )
            text = text.split("").reverse().join("")

        // Setup letters and positioning
        ctxRef.translate(x, y) // Move to center
        startAngle += Math.PI * !inwardFacing // Rotate 180 if outward
        ctxRef.textBaseline = "middle" // Ensure we draw in exact center
        ctxRef.textAlign = "center" // Ensure we draw in exact center

        // rotate 50% of total angle for center alignment
        if (align == "center") {
            for (var j = 0; j < text.length; j++) {
                var charWid = ctxRef.measureText(text[j]).width
                startAngle +=
                    ((charWid + (j == text.length - 1 ? 0 : kerning)) /
                        (diameter / 2 - textHeight) /
                        2) *
                    -clockwise
            }
        }

        // now rotate into final start position
        ctxRef.rotate(startAngle)

        // draw, rotate, and repeat
        for (var j = 0; j < text.length; j++) {
            var charWid = ctxRef.measureText(text[j]).width // half letter
            // rotate half letter
            ctxRef.rotate((charWid / 2 / (diameter / 2 - textHeight)) * clockwise)
            // draw the character at "top" or "bottom"
            // depending on inward or outward facing
            ctxRef.fillStyle = "black";
            ctxRef.strokeStyle = "white";
            ctxRef.lineWidth = diameter / 600//0.03 * 30//radius;

            ctxRef.fillText(
                text[j],
                0,
                (inwardFacing ? 1 : -1) * (0 - diameter / 2 + textHeight / 2),
            )
            ctxRef.strokeText(
                text[j],
                0,
                (inwardFacing ? 1 : -1) * (0 - diameter / 2 + textHeight / 2),
            )

            ctxRef.rotate(
                ((charWid / 2 + kerning) / (diameter / 2 - textHeight)) * clockwise,
            ) // rotate half letter
        }

        // Return it
        ctxRef.restore()
    }


    var WindPlotWidget = {
        name: "WindPlot",
        caption: "TWD",
        unit: "°",
        history: 600,
        range: 20,
        aspect: 1,
        quantity: "TWD",
        storeKeys: {
            TIME: 'nav.gps.rtime',
            AWA: 'nav.gps.sail_instrument.AWA',
            AWS: 'nav.gps.sail_instrument.AWS',
            TWA: 'nav.gps.sail_instrument.TWA',
            TWD: 'nav.gps.sail_instrument.TWD',
            TWS: 'nav.gps.sail_instrument.TWS',
            AWAF: 'nav.gps.sail_instrument.AWAF',
            AWSF: 'nav.gps.sail_instrument.AWSF',
            TWAF: 'nav.gps.sail_instrument.TWAF',
            TWDF: 'nav.gps.sail_instrument.TWDF',
            TWSF: 'nav.gps.sail_instrument.TWSF',
            COG: 'nav.gps.course',
            SOG: 'nav.gps.speed',
            HDT: 'nav.gps.sail_instrument.HDT',
            STW: 'nav.gps.sail_instrument.STW',
            HEL: 'nav.gps.sail_instrument.HEL',
            DBS: 'nav.gps.sail_instrument.DBS',
            DBT: 'nav.gps.sail_instrument.DBT',
            DBK: 'nav.gps.sail_instrument.DBK',
        },
        initFunction: function () { },
        finalizeFunction: function () { },
        renderCanvas: function (canvas, data) {
            // console.log(data);
            if (typeof (data.TIME) == "undefined") return;
            let time = data.TIME.valueOf();
            let tmax = data.history, n = 5;

            let ctx = canvas.getContext('2d');
            ctx.save();
            canvas.style.height = '99%';
            let bcr = canvas.getBoundingClientRect();
            let w = bcr.width, h = bcr.height;
            if (w < 150) {
                canvas.style.height = '';
                h = w * data.aspect;
            }
            canvas.width = w; canvas.height = h;

            let v = data[data.quantity];
            let valid = typeof (v) == "number" && isFinite(v);
            //      console.log(data.quantity,v);
            if (!valid) return;

            var hist = window.windplothist;
            if (typeof (hist) == "undefined") {
                window.windplothist = hist = new Map();
            }
            hist.set(time, data);

            function maxrange(name, c) {
                let min = data[name]; let max = min;
                if (typeof (c) != "undefined") {
                    min = max = 0;
                }
                for (let [k, d] of hist) {
                    let v = d[name];
                    if (typeof (c) != "undefined") {
                        v = to180(v - c);
                    }
                    if (v) {
                        min = Math.min(min, v);
                        max = Math.max(max, v);
                    }
                }
                return Math.ceil(Math.max(1, max - min));
            }

            var q = data.quantity;
            var r = data.range;
            var xtick = x => x.toFixed(1).replace(".0", "");
            var c0 = d => d.AWA < 0 ? red : d.AWA > 0 ? green : blue;
            var c1 = d => Math.abs(d.TWA) < 70 ? blue : Math.abs(d.TWA) < 130 ? "#06c4d1" : "#b304de";
            var v1 = false;
            data.caption=q;
            if (true) {
              var val=data.quantity
              var valf=data.quantity+"F"
              let valid_f= typeof (data[valf]) == "number" && isFinite(data[valf])
              if(valid_f)
                  c = Math.round(data.formatter(data[valf]));
                 else
                 c = Math.round(data.formatter(data[val]));
                var m = c;
                m = r > 0 ? r : maxrange(q, c);
                var v0 = d => (data.formatter(d[val]) - c) / m;
              if(validf)
                  var v1 = d => (data.formatter(d[valf]) - c) / m;
                var c0 = d => "gray";
              }

            //      console.log(q,data[q],r,c,m);

            var f = w < 400 ? 0 : Math.min(w / 40, 30);
            var o = 1.4 * f;

            let x0 = o, x1 = w - o, xc = (x0 + x1) / 2, dx = x1 - x0;
            let y0 = o, y1 = h - o / 4, yc = (y0 + y1) / 2, dy = y1 - y0;

            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            o = 0.45 * f;
            ctx.font = "bold " + f.toFixed(0) + "px sans-serif";
            ctx.fillText(xtick(c), xc, y0 - o);
            ctx.font = f.toFixed(0) + "px sans-serif";
            ctx.fillText(xtick(c - m / 1), x0, y0 - o);
            ctx.fillText(xtick(c + m / 1), x1, y0 - o);
            ctx.fillText(xtick(c - m / 2), xc - dx / 4, y0 - o);
            ctx.fillText(xtick(c + m / 2), xc + dx / 4, y0 - o);

            ctx.beginPath();
            ctx.moveTo(xc, y0);
            ctx.lineTo(xc, y1);
            ctx.moveTo(xc - dx / 4, y0);
            ctx.lineTo(xc - dx / 4, y1);
            ctx.moveTo(xc + dx / 4, y0);
            ctx.lineTo(xc + dx / 4, y1);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "gray";
            let d = dy / n;
            ctx.textAlign = "left";
            for (let i = 1; i <= n; i++) {
                ctx.fillText((i * tmax / 60 / n).toFixed(1).replace(".0", ""), 5 + x1, y0 + i * d + 5);
                ctx.moveTo(x0, y0 + i * d);
                ctx.lineTo(x1, y0 + i * d);
            }
            ctx.stroke();

            function line(val, col, width, dash = []) {
                if (!val) return;
                ctx.lineWidth = width;
                ctx.setLineDash(dash);
                let p = [Number.NaN, 0];
                let c = "";
                ctx.beginPath();
                for (k of hist.keys()) {
                    let t = Math.max(0, time - k) / 1000;
                    if (t > 1800) { hist.delete(k); continue; }
                    if (t > tmax) { continue; }
                    let x = xc + val(hist.get(k)) * dx / 2;
                    let y = y0 + t * dy / tmax;
                    let s = col(hist.get(k));
                    if (c != s) {
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.strokeStyle = c = s;
                        ctx.moveTo(clamp(x0, p[0], x1), p[1]);
                    }
                    ctx.lineTo(clamp(x0, x, x1), y);
                    p = [x, y];
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }

            line(v0, c0, 2);
            line(v1, c1, 3, [8, 2]);

            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = black;
            ctx.rect(x0, y0, dx, dy);
            ctx.stroke();

            ctx.restore();
        },
    };

    var WindPlotParams = {
        formatter: true,
        formatterParameters: true,
        quantity: {
            type: 'SELECT',
            list: ['TWD', 'TWS', 'TWA', 'AWA', 'AWS', 'COG', 'SOG', 'HDT', 'STW', 'HEL', 'DBS'],
            default: 'TWD'
        },
        history: {
            type: 'NUMBER',
            default: 600
        },
        range: {
            type: 'NUMBER',
            default: 0
        },
        aspect: {
            type: 'NUMBER',
            default: 1
        },
    };
    avnav.api.registerWidget(WindPlotWidget, WindPlotParams);


    /*################################################################################################*/




    var Sail_InstrumentWidget = {
        name: "Sail_InstrumentWidget",
        caption: "",
        unit: "",
        storeKeys: {
            BRG: 'nav.wp.course',
            POS: 'nav.gps.position',
            COG: 'nav.gps.course',
            SOG: 'nav.gps.speed',
            //        COG: 'nav.gps.sail_instrument.COG',
            //        SOG: 'nav.gps.sail_instrument.SOG',
            LAY: 'nav.gps.sail_instrument.LAY',
            HDT: 'nav.gps.sail_instrument.HDT',
            STW: 'nav.gps.sail_instrument.STW',
            AWD: 'nav.gps.sail_instrument.AWD',
            AWS: 'nav.gps.sail_instrument.AWS',
            TWDF: 'nav.gps.sail_instrument.TWDF',
            TWSF: 'nav.gps.sail_instrument.TWSF',
            SETF: 'nav.gps.sail_instrument.SETF',
            DFTF: 'nav.gps.sail_instrument.DFTF',
            minTWD: 'nav.gps.sail_instrument.TWDMIN',
            maxTWD: 'nav.gps.sail_instrument.TWDMAX',
            VMG: 'nav.gps.sail_instrument.VMG',
            VMC: 'nav.gps.sail_instrument.VMC',
            VMCA: 'nav.gps.sail_instrument.VMCA',
            VMCB: 'nav.gps.sail_instrument.VMCB',
            POLAR: 'nav.gps.sail_instrument.POLAR',
            VMIN: 'nav.gps.sail_instrument.VMIN',
        },
        initFunction: function () { },
        finalizeFunction: function () { },
        renderCanvas: function (canvas, data) {
            //console.log(data);
            var ctx = canvas.getContext('2d');
            ctx.save();
            // Set scale factor for all values
            var bcr = canvas.getBoundingClientRect();
            var w = bcr.width, h = bcr.height;
            canvas.width = w; canvas.height = h;
            var size = 300;
            var f1 = w / size;
            var f2 = h / size;
            var f = Math.min(f1, f2);
            ctx.scale(f, f);
            ctx.translate(w / 2 / f, h / 2 / f);

            ctx.globalAlpha *= data.Opacity;

            // draw triangle symbolizing the boat
            ctx.beginPath();
            var radius = 100;
            ctx.moveTo(0, -0.75 * radius);
            ctx.lineTo(-0.3 * radius, 0.75 * radius);
            ctx.lineTo(+0.3 * radius, 0.75 * radius);
            ctx.closePath();
            ctx.fillStyle = "gray";
            ctx.lineWidth = 0.01 * radius;
            ctx.strokeStyle = "black";
            ctx.fill();
            ctx.stroke();

            drawWindWidget(ctx, 100, -data.HDT, data);

            // print data fields in corners
            //if(canvas.width>0){

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
        CornerValues: {
            type: 'BOOLEAN',
            default: true
        },
        Rings: {
            type: 'BOOLEAN',
            default: true
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
            COG: 'nav.gps.course',
            SOG: 'nav.gps.speed',
            //        COG: 'nav.gps.sail_instrument.COG',
            //        SOG: 'nav.gps.sail_instrument.SOG',
            LAY: 'nav.gps.sail_instrument.LAY',
            HDT: 'nav.gps.sail_instrument.HDT',
            STW: 'nav.gps.sail_instrument.STW',
            AWD: 'nav.gps.sail_instrument.AWD',
            AWS: 'nav.gps.sail_instrument.AWS',
            TWDF: 'nav.gps.sail_instrument.TWDF',
            TWSF: 'nav.gps.sail_instrument.TWSF',
            SETF: 'nav.gps.sail_instrument.SETF',
            DFTF: 'nav.gps.sail_instrument.DFTF',
            minTWD: 'nav.gps.sail_instrument.TWDMIN',
            maxTWD: 'nav.gps.sail_instrument.TWDMAX',
            VMG: 'nav.gps.sail_instrument.VMG',
            VMC: 'nav.gps.sail_instrument.VMC',
            VMCA: 'nav.gps.sail_instrument.VMCA',
            VMCB: 'nav.gps.sail_instrument.VMCB',
            POLAR: 'nav.gps.sail_instrument.POLAR',
            VMIN: 'nav.gps.sail_instrument.VMIN',
        },
        initFunction: function () { },
        finalizeFunction: function () { },
        renderCanvas: function (canvas, data) {
            //        console.log(data);
            let ctx = canvas.getContext('2d')
            ctx.save();

            if (data.Widgetposition == 'Mapcenter') {
                ctx.translate(canvas.width / 2, canvas.height / 2);
            } else if (data.Widgetposition == 'Boatposition') {
                if (typeof (data.POS) != 'undefined' && data.POS.lat != 0 && data.POS.lon != 0) {
                    coordinates = this.lonLatToPixel(data.POS.lon, data.POS.lat)
                    ctx.translate(coordinates[0], coordinates[1]);
                } else {
                    return;
                }
            }

            ctx.globalAlpha *= data.Opacity;
            drawWindWidget(ctx, data.Displaysize, degrees(this.getRotation()), data);
            ctx.restore();
        }

    }

    function knots(v) {
        return 1.94384 * v;
    }

    var red = "red";
    var green = "rgb(0,255,0)";
    var blue = "blue";
    var black = "black";
    var orange = "orange";

    function drawWindWidget(ctx, size, maprotation, data) {
        //        console.log("wind widget",data);
        if (typeof (maprotation) == 'undefined') { return; }
        var vmin = typeof (data.VMIN) == 'undefined' ? 0 : data.VMIN;
        var rings = typeof (data.Rings) == 'undefined' ? true : data.Rings;
        if (rings) DrawKompassring(ctx, size, maprotation);
        if (data.HDT >= 0) {
            if (rings) DrawOuterRing(ctx, size, maprotation + data.HDT);
        } else {
            return; // cannot draw anything w/o HDT
        }
        if (knots(data.DFTF) >= vmin && data.SETF >= 0) {
            drawTideArrow(ctx, size, maprotation + data.SETF, "teal", knots(data.DFTF).toFixed(1));
        }
        if (knots(data.TWSF) >= 1 && rings) {
            if (data.POLAR) {
                drawPolar(ctx, size, maprotation, data, "black");
            }
            var mm = [data.minTWD, data.maxTWD];
            DrawLaylineArea(ctx, size, maprotation + data.TWDF - data.LAY, mm, green);
            DrawLaylineArea(ctx, size, maprotation + data.TWDF + data.LAY, mm, red);
            if (data.VMCA >= 0) {
                DrawLaylineArea(ctx, size, maprotation + data.VMCA, [0, 0], blue);
            }
            if (data.VMCB >= 0) {
                DrawLaylineArea(ctx, size, maprotation + data.VMCB, [0, 0], "lightblue");
            }
        }
        if (knots(data.AWS) >= 1) {
            DrawWindpfeilIcon(ctx, size, maprotation + data.AWD, green, 'A');
        }
        if (knots(data.TWSF) >= 1) {
            DrawWindpfeilIcon(ctx, size, maprotation + data.TWDF, blue, data.HDT == data.COG ? 'G' : 'T');
        }
        if (rings) {
            if (data.BRG >= 0) {
                DrawWPIcon(ctx, size, maprotation + data.BRG);
            }
            if (knots(data.SOG) >= vmin && data.COG >= 0) {
                DrawEierUhr(ctx, size, maprotation + data.COG, orange);
            }
            if (data.HDT >= 0) {
                DrawCourseBox(ctx, size, maprotation + data.HDT, black, Math.round(data.HDT));
            }
        }
        var cornervalues = typeof (data.CornerValues) == 'undefined' ? true : data.CornerValues;
        if (cornervalues) {
            function val(label, size, startAngle, speed = true, digits = 1) {
                var value = data[label];
                if (typeof (value) == "number" && isFinite(value)) {
                    value = speed ? knots(value) : value;
                    value = value.toFixed(digits);
                    if (label.endsWith("F")) label = label.substring(0, label.length - 1);
                    drawCircularText(ctx, label + " " + value, 0, 0, size * 2 * 1.35, startAngle, "center", false, true, "sans-serif", size / 100 * 15 + "pt", -2,)
                    return true;
                }
                return false;
            }

            val("AWS", size, -45);
            val("TWSF", size, 45);
            if (!val("VMC", size, -135)) val("VMG", size, -135);
            if (!val("STW", size, +135)) val("SOG", size, 135);

        }
    }

    avnav.api.registerWidget(Sail_Instrument_Overlay, Sail_Instrument_OverlayParameter);

    function drawPolar(ctx, size, maprotation, data, color) {
        ctx.save();
        ctx.beginPath();
        ctx.rotate((maprotation + data.TWDF) * Math.PI / 180);
        var r = 0.7 * size;
        //console.log(data.POLAR);
        var v = [];
        data.POLAR.split(",").forEach(function (s, i) {
            v.push(parseFloat(s));
        });;
        //console.log(v,v.length);
        for (var s = 1; s > -2; s -= 2) {
            for (var i = 0; i < v.length; i += 1) {
                var a = s * 180 * i / (v.length - 1) + 180;
                var x = r * Math.sin(a * Math.PI / 180) * v[i];
                var y = r * Math.cos(a * Math.PI / 180) * v[i];
                if (i == 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        }
        ctx.lineWidth = 0.02 * r;
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
        initFunction: function () { },
        finalizeFunction: function () { },
        renderCanvas: function (canvas, props, center) {
            if (typeof (props.POS) != 'undefined') {
                let ctx = canvas.getContext('2d');
                ctx.save();
                ctx.globalAlpha *= props.Opacity;

                intersections = calc_intersections(self, props);

                if (typeof (intersections) != 'undefined') {
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
    let calc_intersections = function (self, props) {
        //console.log(props);
        intersections = null;
        let b_pos = new LatLon(props.POS.lat, props.POS.lon);
        //b_pos = avnav.api.createLatLon(props.boatposition.lat, props.boatposition.lon);
        if (props.WP) {
            WP_pos = new LatLon(props.WP.lat, props.WP.lon);

            // Intersections berechnen
            //console.log(props.TWDF-props.LAY,props.TWDF+props.LAY);
            var is_SB = LatLon.intersection(b_pos, to360(props.TWDF - props.LAY), WP_pos, to360(props.TWDF + props.LAY + 180));
            var is_BB = LatLon.intersection(b_pos, to360(props.TWDF + props.LAY), WP_pos, to360(props.TWDF - props.LAY + 180));
            //console.log(b_pos,is_SB,is_BB);
            calc_endpoint = function (intersection, pos) {
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


    let DrawMapLaylines = function (self, ctx, intersections, props) {
        ctx.save();
        function drawLine(p1, p2, color) {
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.lineWidth = 3;
            ctx.strokeStyle = color;
            var d = 5 * window.devicePixelRatio;
            ctx.setLineDash([2 * d, d]);
            ctx.stroke();
        }
        if (typeof (props.LaylineBoat) != 'undefined' && props.LaylineBoat == true && intersections != null) {
            // port
            p1 = self.lonLatToPixel(intersections.Boat.BB.P1._lon, intersections.Boat.BB.P1._lat);
            p2 = self.lonLatToPixel(intersections.Boat.BB.P2._lon, intersections.Boat.BB.P2._lat);
            drawLine(p1, p2, red);
            // starboard
            p1 = self.lonLatToPixel(intersections.Boat.SB.P1._lon, intersections.Boat.SB.P1._lat);
            p2 = self.lonLatToPixel(intersections.Boat.SB.P2._lon, intersections.Boat.SB.P2._lat);
            drawLine(p1, p2, green);
        }
        if (typeof (props.LaylineWP) != 'undefined' && props.LaylineWP == true && intersections != null) {
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

    let DrawWPIcon = function (ctx, radius, angle) {
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


    let DrawLaylineArea = function (ctx, radius, angle, minmax, color) {

        ctx.save();
        var radius = 0.9 * radius
        ctx.rotate(radians(angle))

        // Laylines
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -radius);
        ctx.lineWidth = 0.02 * radius;
        ctx.strokeStyle = color;
        var d = 5 * window.devicePixelRatio;
        ctx.setLineDash([2 * d, d]);
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


    let DrawCourseBox = function (ctx, radius, angle, color, Text) {
        ctx.save();
        ctx.rotate((angle / 180) * Math.PI)


        let roundRect = function (x, y, w, h, radius) {
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

    let DrawEierUhr = function (ctx, radius, angle, color) {
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



    let DrawWindpfeilIcon = function (ctx, radius, angle, color, Text) {
        ctx.save();

        var radius_kompassring = radius //0.525*Math.min(x,y);
        var radius_outer_ring = radius * 1.3 //= 0.65*Math.min(x,y);
        var thickness = radius / 4;

        ctx.rotate(radians(angle));

        ctx.beginPath();
        if (Text == 'A')
            ctx.moveTo(0, -radius_kompassring + 0.75 * thickness); // Move pen to bottom-center corner
        else
            ctx.moveTo(0, -radius_kompassring + 0.25 * thickness); // Move pen to bottom-center corner
        ctx.lineTo(-0.75 * thickness, -radius_outer_ring - 0.25 * thickness); // Line to top left corner
        ctx.lineTo(+0.75 * thickness, -radius_outer_ring - 0.25 * thickness); // Line to top-right corner
        ctx.closePath(); // Line to bottom-center corner
        ctx.fillStyle = color;
        ctx.lineWidth = 0.05 * thickness;
        ctx.strokeStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';

        ctx.fillStyle = "rgb(255,255,255)";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.font = "bold " + radius / 4 + "px Arial";
        ctx.fillText(Text, 0, -0.87 * radius_outer_ring);
        ctx.restore();

    }



    function drawTideArrow(ctx, radius, angle, color, label) {
        ctx.save();
        ctx.rotate(radians(angle));
        ctx.beginPath();
        ctx.moveTo(0, 0.3 * radius);
        ctx.lineTo(-0.25 * radius, 0.75 * radius);
        ctx.lineTo(+0.25 * radius, 0.75 * radius);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.lineWidth = 0.01 * radius;
        ctx.strokeStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.stroke();
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.textAlign = "center";
        ctx.font = "bold " + (0.15 * radius) + "px Arial";
        ctx.fillText(label, 0, 0.70 * radius);
        ctx.restore();
    }




    let DrawOuterRing = function (ctx, radius, angle) {
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

    let DrawKompassring = function (ctx, radius, angle) {
        ctx.save();
        ctx.rotate((angle / 180) * Math.PI)
        var thickness = 0.2 * radius //1*Math.min(x,y)
        ctx.beginPath();
        var fontsize = Math.round(radius / 100 * 12)
        ctx.arc(0, 0, radius, 0, 2 * Math.PI, false);
        ctx.lineWidth = thickness;
        ctx.strokeStyle = "rgb(225,225,225)";
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
        return to360(a + 180) - 180;
    }

    function radians(a) {
        return a * Math.PI / 180;
    }

    function degrees(a) {
        return a * 180 / Math.PI;
    }

})();
