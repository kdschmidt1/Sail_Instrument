(function () {
  console.log("SailInstrument");

  function toDateTime(secs) {
    let t = new Date(1970, 0, 1); // Epoch
    t.setSeconds(secs);
    return t;
  }

  const FONT = "roboto,droid sans,open sans,noto sans,arial,sans-serif";

  var LaylineWidget = {
    name: "time/distance to WP",
    unit: "nm",
    caption: "TTW",
    storeKeys: {
      WP: "nav.wp.position",
      POS: "nav.gps.position",
      TWA: "nav.gps.sail_instrument.TWA",
      VMC: "nav.gps.sail_instrument.VMC",
      LLS: "nav.gps.sail_instrument.LLS",
      LLP: "nav.gps.sail_instrument.LLP",
      LLSV: "nav.gps.sail_instrument.LLSV",
      LLPV: "nav.gps.sail_instrument.LLPV",
    },
    formatter: avnav.api.formatter.formatDistance,
    formatterParameters: ["nm"],
    translateFunction: (props) => {
      let suffix = "";
      if (props.tack == "current") {
        suffix = to180(props.TWA) > 0 ? "-S" : "-P";
      }
      if (props.tack == "opposite") {
        suffix = to180(props.TWA) < 0 ? "-S" : "-P";
      }
      return {
        ...props,
        caption: (props.type == "time" ? "TTW" : "DTW") + suffix,
        unit:
          props.type == "time"
            ? ""
            : props.formatterParameters instanceof Array &&
                props.formatterParameters.length > 0
              ? props.formatterParameters[0]
              : props.unit,
      };
    },
    renderHtml: function (data) {
      //        console.log(data);
      try {
        let stb = to180(data.TWA) > 0;
        let is = calc_intersections(self, data);
        //          console.log(is);
        if (typeof is == "undefined") {
          // use direct distance and VMC
          var direct = true;
          var WP = new LatLon(data.WP.lat, data.WP.lon);
          var POS = new LatLon(data.POS.lat, data.POS.lon);
          var dist_c = POS.rhumbDistanceTo(WP);
          var dist_o = dist_c;
          var dist_t = dist_c;
          var time_c = data.VMC > 0 ? dist_c / data.VMC : NaN;
          var time_o = time_c;
          var time_t = time_c;
        } else {
          // distance on laylines with current speed and estimated speed on opposite tack
          var direct = false;
          var dist_c = (stb ? is.Boat.SB : is.Boat.BB).dist; // current tack
          var dist_o = (stb ? is.Boat.BB : is.Boat.SB).dist; // opposite tack
          var dist_t = dist_c + dist_o;
          var time_c = dist_c / (stb ? data.LLSV : data.LLPV);
          var time_o = dist_o / (stb ? data.LLPV : data.LLSV);
          var time_t = time_c + time_o;
        }

        if (data.type == "distance") {
          var dist =
            data.tack == "current"
              ? dist_c
              : data.tack == "opposite"
                ? dist_o
                : dist_t;
          var val = avnav.api.formatter.formatDistance(
            dist,
            data.formatterParameters,
          );
        } else {
          var time =
            data.tack == "current"
              ? time_c
              : data.tack == "opposite"
                ? time_o
                : time_t;
          var val = avnav.api.formatter.formatTime(toDateTime(time), false);
        }
        if (direct && data.tack == "opposite") val = "---";
      } catch (error) {
        var val = "---";
      }
      return (
        '<div class="widgetData"><span class="valueData">' +
        val +
        "</span></div>"
      );
    },
  };

  avnav.api.registerWidget(LaylineWidget, {
    formatterParameters: true,
    caption: false,
    unit: false,
    type: {
      type: "SELECT",
      list: ["time", "distance"],
      default: "time",
    },
    tack: {
      type: "SELECT",
      list: ["total", "current", "opposite"],
      default: "total",
    },
  });

  function drawCircularText(
    ctxRef,
    text,
    x,
    y,
    diameter,
    startAngle,
    align,
    textInside,
    inwardFacing,
    fName,
    fSize,
    kerning,
    night = false,
  ) {
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
    ctxRef.save();
    align = align.toLowerCase();
    var clockwise = align == "right" ? 1 : -1; // draw clockwise for aligned right. Else Anticlockwise
    startAngle = startAngle * (Math.PI / 180); // convert to radians

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

    let metrics = ctxRef.measureText("Mann");
    // in cases where we are drawing outside diameter,
    // expand diameter to handle it
    // in cases where we are drawing outside diameter,
    // expand diameter to handle it
    if (!textInside) {
      if (inwardFacing) diameter += textHeight * 2;
      else diameter += textHeight * 3;
    }

    ctxRef.fillStyle = night ? "#a00" : "black";
    ctxRef.strokeStyle = night ? "black" : "white";
    ctxRef.font = "bold " + fSize + " " + fName;

    // Reverse letters for align Left inward, align right outward
    // and align center inward.
    if (
      (["left", "center"].indexOf(align) > -1 && inwardFacing) ||
      (align == "right" && !inwardFacing)
    )
      text = text.split("").reverse().join("");

    // Setup letters and positioning
    ctxRef.translate(x, y); // Move to center
    startAngle += Math.PI * !inwardFacing; // Rotate 180 if outward
    ctxRef.textBaseline = "middle"; // Ensure we draw in exact center
    ctxRef.textAlign = "center"; // Ensure we draw in exact center

    // rotate 50% of total angle for center alignment
    if (align == "center") {
      for (var j = 0; j < text.length; j++) {
        var charWid = ctxRef.measureText(text[j]).width;
        startAngle +=
          ((charWid + (j == text.length - 1 ? 0 : kerning)) /
            (diameter / 2 - textHeight) /
            2) *
          -clockwise;
      }
    }

    // now rotate into final start position
    ctxRef.rotate(startAngle);

    // draw, rotate, and repeat
    for (var j = 0; j < text.length; j++) {
      var charWid = ctxRef.measureText(text[j]).width; // half letter
      // rotate half letter
      ctxRef.rotate((charWid / 2 / (diameter / 2 - textHeight)) * clockwise);
      // draw the character at "top" or "bottom"
      // depending on inward or outward facing
      ctxRef.lineWidth = diameter / 600; //0.03 * 30//radius;

      ctxRef.fillText(
        text[j],
        0,
        (inwardFacing ? 1 : -1) * (0 - diameter / 2 + textHeight / 2),
      );
      ctxRef.strokeText(
        text[j],
        0,
        (inwardFacing ? 1 : -1) * (0 - diameter / 2 + textHeight / 2),
      );

      ctxRef.rotate(
        ((charWid / 2 + kerning) / (diameter / 2 - textHeight)) * clockwise,
      ); // rotate half letter
    }

    // Return it
    ctxRef.restore();
  }

  var HistoryPlotWidget = {
    name: "WindPlot",
    caption: "TWD",
    unit: "°",
    history: 600,
    range: 20,
    aspect: 1,
    quantity: "TWD",
    storeKeys: {
      TIME: "nav.gps.rtime",
      COG: "nav.gps.course",
      SOG: "nav.gps.speed",
      HDT: "nav.gps.sail_instrument.HDT",
      STW: "nav.gps.sail_instrument.STW",
      AWA: "nav.gps.sail_instrument.AWA",
      AWS: "nav.gps.sail_instrument.AWS",
      TWA: "nav.gps.sail_instrument.TWA",
      TWD: "nav.gps.sail_instrument.TWD",
      TWS: "nav.gps.sail_instrument.TWS",
      AWAF: "nav.gps.sail_instrument.AWAF",
      AWSF: "nav.gps.sail_instrument.AWSF",
      TWAF: "nav.gps.sail_instrument.TWAF",
      TWDF: "nav.gps.sail_instrument.TWDF",
      TWSF: "nav.gps.sail_instrument.TWSF",
      SET: "nav.gps.sail_instrument.SET",
      DFT: "nav.gps.sail_instrument.DFT",
      SETF: "nav.gps.sail_instrument.SETF",
      DFTF: "nav.gps.sail_instrument.DFTF",
      HEL: "nav.gps.sail_instrument.HEL",
      DBS: "nav.gps.sail_instrument.DBS",
      DBT: "nav.gps.sail_instrument.DBT",
      DBK: "nav.gps.sail_instrument.DBK",
      VMG: "nav.gps.sail_instrument.VMG",
      VMC: "nav.gps.sail_instrument.VMC",
    },
    translateFunction: (props) => {
      //        console.log(props);
      var units = {
        TWD: "°",
        TWS: "kn",
        TWA: "°",
        AWA: "°",
        AWS: "kn",
        COG: "°",
        SOG: "kn",
        HDT: "°",
        STW: "°",
        HEL: "°",
        DBS: "m",
        twa: "",
        VMG: "kn",
        VMC: "kn",
        SET: "°",
        DFT: "kn",
      };
      return {
        ...props,
        caption: props.quantity,
        unit: units[props.quantity],
      };
    },
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data) {
      // console.log(data);
      if (typeof data.TIME == "undefined") return;
      let time = data.TIME.valueOf();
      let tmax = data.history;
      let n = 5;

      let ctx = canvas.getContext("2d");
      ctx.save();
      canvas.style.height = "99%";
      let bcr = canvas.getBoundingClientRect();
      let w = bcr.width,
        h = bcr.height;
      if (w < 150) {
        canvas.style.height = "";
        h = w * data.aspect;
      }
      canvas.width = w;
      canvas.height = h;

      var q = data.quantity;
      let v = data[q.toUpperCase()];
      let valid = typeof v == "number" && isFinite(v);
      //      console.log(data.quantity,v);
      if (!valid) return;

      var hist = window.windplothist;
      if (typeof hist == "undefined") {
        window.windplothist = hist = new Map();
      }
      hist.set(time, data);
      for (k of hist.keys()) {
        let t = Math.max(0, time - k) / 1000;
        if (t > 3600) {
          hist.delete(k);
        }
      }

      function maxrange(name, c) {
        let min = data[name];
        let max = min;
        if (typeof c != "undefined") {
          min = max = 0;
        }
        for (let [k, d] of hist) {
          let v = d[name];
          if (typeof c != "undefined") {
            v = to180(v - c);
          }
          if (v) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        }
        return Math.ceil(Math.max(1, max - min));
      }

      var night = data.nightMode;
      var r = data.range;
      var xtick = (x) => x.toFixed(1).replace(".0", "");
      var c0 = (d) => (d.AWA < 0 ? red : d.AWA > 0 ? green : blue);
      var c1 = (d) => (night ? "#ded714" : blue);
      var v1 = false;
      var tackPlot = false;

      if (data.quantity == "AWA") {
        var c = Math.round(data.AWAF);
        var m = r > 0 ? r : maxrange(q, c);
        var xtick = (x) => to180(x).toFixed(1).replace(".0", "");
        var v0 = (d) => to180(d.AWA - c) / m;
        var v1 = (d) => to180(d.AWAF - c) / m;
      } else if (data.quantity == "AWS") {
        var c = r > 0 ? r / 2 : Math.round(knots(data.AWSF) * 10) / 10;
        var m = c;
        var v0 = (d) => (knots(d.AWS) - c) / m;
        var v1 = (d) => (knots(d.AWSF) - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "TWA") {
        var c = Math.round(data.TWAF);
        var m = r > 0 ? r : maxrange(q, c);
        var xtick = (x) => to180(x).toFixed(1).replace(".0", "");
        var v0 = (d) => to180(d.TWA - c) / m;
        var v1 = (d) => to180(d.TWAF - c) / m;
      } else if (data.quantity == "twa") {
        var tackPlot = true;
        var c = 0;
        var m = 2;
        var xtick = (x) => "";
        var v0 = (d) => (to180(d.TWA) > 0 ? +1 : -1) / m;
        var v1 = (d) => 0;
        var c1 = (d) =>
          Math.abs(d.TWA) < 70
            ? blue
            : Math.abs(d.TWA) < 130
              ? "#06c4d1"
              : "#ded714";
      } else if (data.quantity == "TWD") {
        var c = Math.round(data.TWDF);
        var m = r > 0 ? r : maxrange(q, c);
        var xtick = (x) => to360(x).toFixed(1).replace(".0", "");
        var v0 = (d) => to180(d.TWD - c) / m;
        var v1 = (d) => to180(d.TWDF - c) / m;
      } else if (data.quantity == "TWS") {
        var c = r > 0 ? r / 2 : Math.round(knots(data.TWSF) * 10) / 10;
        var m = c;
        var v0 = (d) => (knots(d.TWS) - c) / m;
        var v1 = (d) => (knots(d.TWSF) - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "SET") {
        var c = Math.round(data.SETF);
        var m = r > 0 ? r : maxrange(q, c);
        var xtick = (x) => to360(x).toFixed(1).replace(".0", "");
        var v0 = (d) => to180(d.SET - c) / m;
        var v1 = (d) => to180(d.SETF - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "DFT") {
        var c = r > 0 ? r / 2 : Math.round(knots(data.DFTF) * 10) / 10;
        var m = c;
        var v0 = (d) => (knots(d.DFT) - c) / m;
        var v1 = (d) => (knots(d.DFTF) - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "COG") {
        var c = Math.round(data.COG);
        var m = r > 0 ? r : maxrange(q, c);
        var xtick = (x) => to360(x).toFixed(1).replace(".0", "");
        var v0 = (d) => to180(d.COG - c) / m;
        var c0 = (d) => blue;
      } else if (data.quantity == "SOG") {
        var c = Math.round(knots(data.SOG) * 10) / 10;
        var m = c;
        var v0 = (d) => (knots(d.SOG) - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "VMG") {
        var c = Math.round(knots(data.VMG) * 10) / 10;
        var m = c;
        var v0 = (d) => (knots(d.VMG) - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "VMC") {
        var c = Math.round(knots(data.VMC) * 10) / 10;
        var m = c;
        var v0 = (d) => (knots(d.VMC) - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "HDT") {
        var c = Math.round(data.HDT);
        var m = r > 0 ? r : maxrange(q, c);
        var xtick = (x) => to360(x).toFixed(1).replace(".0", "");
        var v0 = (d) => to180(d.HDT - c) / m;
        var c0 = (d) => blue;
      } else if (data.quantity == "STW") {
        var c = r > 0 ? r / 2 : Math.round(knots(data.STW) * 10) / 10;
        var m = c;
        var v0 = (d) => (knots(d.STW) - c) / m;
        var c0 = (d) => "gray";
      } else if (data.quantity == "HEL") {
        var c = 0;
        var m = r > 0 ? r : maxrange(q);
        var v0 = (d) => d.HEL / m;
        var c0 = (d) => blue;
      } else if (data.quantity == "DBS") {
        var c = r > 0 ? r / 2 : Math.round(data.DBS * 10) / 10;
        var m = c;
        var v0 = (d) => (d.DBS - c) / m;
        var c0 = (d) => blue;
      }

      //      console.log(q,data[q],r,c,m);

      var f = w < 400 ? 0 : Math.min(w / 40, 30);
      var o = 1.4 * f;

      let x0 = o,
        x1 = w - o,
        xc = (x0 + x1) / 2,
        dx = x1 - x0;
      let y0 = o,
        y1 = h - o / 4,
        yc = (y0 + y1) / 2,
        dy = y1 - y0;

      ctx.fillStyle = night ? "red" : "black";
      ctx.textAlign = "center";
      o = 0.45 * f;
      ctx.font = "bold " + f.toFixed(0) + "px " + FONT;
      ctx.fillText(xtick(c), xc, y0 - o);
      ctx.font = f.toFixed(0) + "px " + FONT;
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
        ctx.fillText(
          ((i * tmax) / 60 / n).toFixed(1).replace(".0", ""),
          5 + x1,
          y0 + i * d + 5,
        );
        ctx.moveTo(x0, y0 + i * d);
        ctx.lineTo(x1, y0 + i * d);
      }
      ctx.stroke();

      function line(val, col, width, dash = [], split = false) {
        if (!val) return;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        let p = [Number.NaN, 0];
        let c = "";
        ctx.beginPath();
        for (k of hist.keys()) {
          let t = Math.max(0, time - k) / 1000;
          if (t > tmax) {
            continue;
          }
          let x = xc + (val(hist.get(k)) * dx) / 2;
          let y = y0 + (t * dy) / tmax;
          let s = col(hist.get(k));
          if (c != s) {
            if (split && c != "x") {
              c = "x";
              p = [x, y];
              continue;
            }
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

      if (tackPlot) {
        line(v0, c0, 5, [], true);
        line(v1, c1, 15);
      } else {
        line(v0, c0, 2);
        line(v1, c1, 3, [8, 2]);
      }

      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = black;
      ctx.rect(x0, y0, dx, dy);
      ctx.stroke();

      ctx.restore();
    },
  };

  avnav.api.registerWidget(HistoryPlotWidget, {
    caption: false,
    unit: false,
    quantity: {
      type: "SELECT",
      list: [
        "TWD",
        "TWS",
        "TWA",
        "AWA",
        "AWS",
        "COG",
        "SOG",
        "HDT",
        "STW",
        "HEL",
        "DBS",
        "twa",
        "VMG",
        "VMC",
        "SET",
        "DFT",
      ],
      default: "TWD",
    },
    history: {
      type: "NUMBER",
      default: 600,
    },
    range: {
      type: "NUMBER",
      default: 0,
    },
    aspect: {
      type: "FLOAT",
      default: 1,
    },
  });

  /*################################################################################################*/

  var SailInstrumentWidget = {
    name: "Sail_InstrumentWidget",
    caption: "",
    unit: "",
    storeKeys: {
      BRG: "nav.wp.course",
      POS: "nav.gps.position",
      HDT: "nav.gps.sail_instrument.HDTF",
      COG: "nav.gps.sail_instrument.COGF",
      SOG: "nav.gps.sail_instrument.SOGF",
      STW: "nav.gps.sail_instrument.STWF",
      CTW: "nav.gps.sail_instrument.CTWF",
      LAY: "nav.gps.sail_instrument.LAY",
      AWD: "nav.gps.sail_instrument.AWDF",
      AWS: "nav.gps.sail_instrument.AWSF",
      TWD: "nav.gps.sail_instrument.TWDF",
      TWS: "nav.gps.sail_instrument.TWSF",
      SET: "nav.gps.sail_instrument.SETF",
      DFT: "nav.gps.sail_instrument.DFTF",
      minTWD: "nav.gps.sail_instrument.TWDMIN",
      maxTWD: "nav.gps.sail_instrument.TWDMAX",
      VMG: "nav.gps.sail_instrument.VMG",
      VMC: "nav.gps.sail_instrument.VMC",
      VMCA: "nav.gps.sail_instrument.VMCA",
      VMCB: "nav.gps.sail_instrument.VMCB",
      POLAR: "nav.gps.sail_instrument.POLAR",
      VMIN: "nav.gps.sail_instrument.VMIN",
    },
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data) {
      //console.log(data);
      var ctx = canvas.getContext("2d");
      ctx.save();
      // Set scale factor for all values
      var bcr = canvas.getBoundingClientRect();
      var w = bcr.width,
        h = bcr.height;
      canvas.width = w;
      canvas.height = h;
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

      ctx.restore();
    },
  };

  avnav.api.registerWidget(SailInstrumentWidget, {
    WaterTrack: {
      type: "BOOLEAN",
      default: false,
    },
    HeadingBox: {
      type: "BOOLEAN",
      default: true,
    },
    DisplayData: {
      type: "BOOLEAN",
      default: true,
    },
    DataCircular: {
      type: "BOOLEAN",
      default: false,
    },
  });

  /*################################################################################################*/

  var Sail_Instrument_OverlayParameter = {
    Widgetposition: {
      type: "SELECT",
      list: ["Boatposition", "Mapcenter"],
      default: "Boatposition",
    },
    Displaysize: {
      type: "NUMBER",
      default: 100,
    },
    Opacity: {
      type: "NUMBER",
      default: 1,
    },
    Rings: {
      type: "BOOLEAN",
      default: true,
    },
    WaterTrack: {
      type: "BOOLEAN",
      default: false,
    },
    HeadingBox: {
      type: "BOOLEAN",
      default: true,
    },
    DisplayData: {
      type: "BOOLEAN",
      default: false,
    },
    DataCircular: {
      type: "BOOLEAN",
      default: true,
    },
    NightInvert: {
      type: "BOOLEAN",
      default: false,
    },
  };

  let SailInstrumentOverlay = {
    // Editable Parameters
    Displaysize: 100,
    Opacity: 1,
    Widgetposition: "Boatposition",

    name: "Sail_Instrument_Overlay",
    type: "map",
    storeKeys: {
      BRG: "nav.wp.course",
      POS: "nav.gps.position",
      HDT: "nav.gps.sail_instrument.HDTF",
      COG: "nav.gps.sail_instrument.COGF",
      SOG: "nav.gps.sail_instrument.SOGF",
      STW: "nav.gps.sail_instrument.STWF",
      CTW: "nav.gps.sail_instrument.CTWF",
      LAY: "nav.gps.sail_instrument.LAY",
      AWD: "nav.gps.sail_instrument.AWDF",
      AWS: "nav.gps.sail_instrument.AWSF",
      TWD: "nav.gps.sail_instrument.TWDF",
      TWS: "nav.gps.sail_instrument.TWSF",
      SET: "nav.gps.sail_instrument.SETF",
      DFT: "nav.gps.sail_instrument.DFTF",
      minTWD: "nav.gps.sail_instrument.TWDMIN",
      maxTWD: "nav.gps.sail_instrument.TWDMAX",
      VMCA: "nav.gps.sail_instrument.VMCA",
      VMCB: "nav.gps.sail_instrument.VMCB",
      POLAR: "nav.gps.sail_instrument.POLAR",
      VMIN: "nav.gps.sail_instrument.VMIN",
      VMC: "nav.gps.sail_instrument.VMC",
      VMG: "nav.gps.sail_instrument.VMG",
    },
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data, center) {
      //        console.log(data);
      let ctx = canvas.getContext("2d");
      ctx.save();

      if (data.Widgetposition == "Mapcenter") {
        ctx.translate(canvas.width / 2, canvas.height / 2);
      } else if (data.Widgetposition == "Boatposition") {
        if (
          typeof data.POS != "undefined" &&
          data.POS.lat != 0 &&
          data.POS.lon != 0
        ) {
          coordinates = this.lonLatToPixel(data.POS.lon, data.POS.lat);
          ctx.translate(coordinates[0], coordinates[1]);
        } else {
          return;
        }
      }

      ctx.globalAlpha *= data.Opacity;
      if (data.NightInvert && data.nightMode)
        ctx.filter = "invert(100%) hue-rotate(180deg)";
      drawWindWidget(ctx, data.Displaysize, degrees(this.getRotation()), data);
      ctx.restore();
    },
  };

  function knots(v) {
    return 1.94384 * v;
  }

  const red = "red";
  const green = "rgb(0,255,0)";
  const blue = "blue";
  const lightblue = "#3ba3f7";
  const black = "black";
  const orange = "orange";

  function drawWindWidget(ctx, size, maprotation, data) {
    //        console.log("wind widget",data);
    if (typeof maprotation == "undefined") {
      return;
    }
    let vmin = data.VMIN ?? 0;
    let rings = data.Rings ?? true;
    let displayData = !!data.DisplayData;
    let showWaterTrack = !!data.WaterTrack;
    if (rings) drawCompassRing(ctx, size, maprotation, data.nightMode);
    if (data.HDT >= 0) {
      if (rings) drawOuterRing(ctx, size, maprotation + data.HDT);
    } else {
      return; // cannot draw anything w/o HDT
    }
    if (knots(data.DFT) >= vmin && data.SET >= 0) {
      let h = (1 - clamp(0, knots(data.DFT) / 3, 1)) * 120;
      drawTideArrow(
        ctx,
        size,
        maprotation + data.SET,
        `hsl(${h},60%,40%)`,
        knots(data.DFT).toFixed(1),
      );
    }
    if (knots(data.TWS) >= 1 && rings) {
      if (data.POLAR) {
        drawPolar(
          ctx,
          size,
          maprotation,
          data,
          data.nightMode ? "#aaa" : "black",
        );
      }
      let mm = [data.minTWD, data.maxTWD];
      drawLayline(ctx, size, maprotation + data.TWD - data.LAY, mm, green);
      drawLayline(ctx, size, maprotation + data.TWD + data.LAY, mm, red);
      if (data.VMCA >= 0) {
        drawLayline(ctx, size, maprotation + data.VMCA, [0, 0], blue);
      }
      if (data.VMCB >= 0) {
        drawLayline(ctx, size, maprotation + data.VMCB, [0, 0], "lightblue");
      }
    }
    if (knots(data.AWS) >= 1) {
      drawWindArrow(ctx, size, maprotation + data.AWD, blue, "A");
    }
    if (knots(data.TWS) >= 1) {
      let noTarget =
        data.BRG == null ||
        (Math.abs(to180(data.TWD - data.BRG)) > data.LAY &&
          Math.abs(to180(data.TWD - data.BRG)) < 90) ||
        (Math.abs(to180(data.TWD - data.BRG)) < data.LAY &&
          Math.abs(to180(data.TWD - data.BRG)) > 90);
      let a = noTarget
        ? 0
        : Math.min(
            1,
            Math.min(
              Math.abs(to180(data.TWD - data.LAY - data.HDT)),
              Math.abs(to180(data.TWD + data.LAY - data.HDT)),
            ) / 10,
          );
      let h = a * 210 + (1 - a) * 120;
      drawWindArrow(
        ctx,
        size,
        maprotation + data.TWD,
        `hsl(${h},100%,50%)`,
        "T",
      );
    }
    if (rings) {
      if (data.BRG >= 0) {
        const a = (data.HeadingBox ?? true) ? 1 : 1.09;
        drawWaypointMarker(ctx, a * size, maprotation + data.BRG);
      }
      if (knots(data.STW) >= vmin && data.CTW >= 0 && showWaterTrack) {
        drawCourseMarker(ctx, size, maprotation + data.CTW, lightblue, -1);
      }
      if (knots(data.SOG) >= vmin && data.COG >= 0) {
        drawCourseMarker(
          ctx,
          size,
          maprotation + data.COG,
          orange,
          showWaterTrack ? 1 : 0,
        );
      }
      if (data.HDT >= 0 && (data.HeadingBox ?? true)) {
        drawHeadingBox(
          ctx,
          size,
          maprotation + data.HDT,
          Math.round(data.HDT),
          data.nightMode,
        );
      }
    }
    if (displayData) {
      if (data.DataCircular) displayDataCircle(ctx, size, data);
      else displayDataCorner(ctx, size, data);
    }
  }

  function displayDataCorner(ctx, size, data) {
    function val(label, x, y, speed = true, digits = 1) {
      let value = data[label];
      let radius = size;
      if (typeof value == "number" && isFinite(value)) {
        let night = data.nightMode;
        value = speed ? knots(value) : value;
        value = value.toFixed(digits);
        if (label.endsWith("F")) label = label.substring(0, label.length - 1);
        ctx.textAlign = x < 0 ? "left" : "right";
        ctx.textBaseline = y < 0 ? "top" : "bottom";
        ctx.font = "bold " + 0.15 * radius + "px " + FONT;
        ctx.fillStyle = night ? "#555" : "gray";
        ctx.fillText(label, x * radius, 0.8 * y * radius);
        ctx.font = "bold " + 0.3 * radius + "px " + FONT;
        ctx.fillStyle = night ? "#a00" : "black";
        ctx.strokeStyle = night ? "black" : "white";
        ctx.lineWidth = 0.03 * radius;
        ctx.strokeText(value, x * radius, y * radius);
        ctx.fillText(value, x * radius, y * radius);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        return true;
      }
      return false;
    }

    val("AWS", -1.4, -1.4);
    val("TWS", +1.4, -1.4);
    if (!val("VMC", -1.4, +1.4)) val("VMG", -1.4, +1.4);
    if (!val("STW", +1.4, +1.4)) val("SOG", +1.4, +1.4);
  }

  function displayDataCircle(ctx, size, data) {
    function val(label, size, angle, speed = true, digits = 1) {
      let value = data[label];
      if (typeof value == "number" && isFinite(value)) {
        value = speed ? knots(value) : value;
        value = value.toFixed(digits);
        if (label.endsWith("F")) label = label.substring(0, label.length - 1);
        let inward = Math.abs(angle) < 90;
        let radius = size * 2 * 1.35 * (inward ? 1 : 0.94);
        drawCircularText(
          ctx,
          label + " " + value,
          0,
          0,
          radius,
          angle,
          "center",
          false,
          inward,
          FONT,
          (size / 100) * 15 + "pt",
          -2,
          data.nightMode,
        );
        return true;
      }
      return false;
    }

    val("AWS", size, -45);
    val("TWS", size, 45);
    if (!val("VMC", size, -135)) val("VMG", size, -135);
    if (!val("STW", size, +135)) val("SOG", size, 135);
  }

  avnav.api.registerWidget(
    SailInstrumentOverlay,
    Sail_Instrument_OverlayParameter,
  );

  function drawPolar(ctx, size, maprotation, data, color) {
    ctx.save();
    ctx.beginPath();
    ctx.rotate(((maprotation + data.TWD) * Math.PI) / 180);
    let r = 0.7 * size;
    //console.log(data.POLAR);
    let v = [];
    data.POLAR.split(",").forEach(function (s, i) {
      v.push(parseFloat(s));
    });
    //console.log(v,v.length);
    for (let s = 1; s > -2; s -= 2) {
      for (let i = 0; i < v.length; i += 1) {
        let a = (s * 180 * i) / (v.length - 1) + 180;
        let x = r * Math.sin((a * Math.PI) / 180) * v[i];
        let y = r * Math.cos((a * Math.PI) / 180) * v[i];
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

    name: "LayLines-Overlay",
    type: "map",
    storeKeys: {
      WP: "nav.wp.position",
      POS: "nav.gps.position",
      LLS: "nav.gps.sail_instrument.LLS",
      LLP: "nav.gps.sail_instrument.LLP",
      TWD: "nav.gps.sail_instrument.TWD",
    },
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data, center) {
      if (typeof data.POS != "undefined") {
        let ctx = canvas.getContext("2d");
        ctx.save();
        ctx.globalAlpha *= data.Opacity;

        let intersections = calc_intersections(self, data);
        //            console.log(intersections);

        if (typeof intersections != "undefined") {
          DrawMapLaylines(this, ctx, intersections, data);
        }
        ctx.restore();
      }
    },
  };

  var LayLines_OverlayParameter = {
    Opacity: {
      type: "NUMBER",
      default: 1,
    },
    Laylinelength_nm: {
      type: "NUMBER",
      default: 10,
    },
    Laylineoverlap: {
      type: "BOOLEAN",
      default: false,
    },
    LaylineBoat: {
      type: "BOOLEAN",
      default: true,
    },
    LaylineWP: {
      type: "BOOLEAN",
      default: true,
    },
  };

  avnav.api.registerWidget(LayLines_Overlay, LayLines_OverlayParameter);
  /*##################################################################################################*/

  let LatLon = avnav.api.LatLon();
  function calc_intersections(self, props) {
    //    console.log('props',props);
    let POS = new LatLon(props.POS.lat, props.POS.lon);
    //POS = avnav.api.createLatLon(props.boatposition.lat, props.boatposition.lon);
    if (props.WP) {
      WP = new LatLon(props.WP.lat, props.WP.lon);

      // Intersections berechnen
      //        console.log(props.LLS,props.LLP);
      const is_SB = LatLon.intersection(
        POS,
        props.LLS,
        WP,
        to360(props.LLP + 180),
      );
      const is_BB = LatLon.intersection(
        POS,
        props.LLP,
        WP,
        to360(props.LLS + 180),
      );
      //        console.log(POS,is_SB,is_BB);
      calc_endpoint = function (intersection, pos) {
        let is = {};
        is.dist = pos.rhumbDistanceTo(intersection); // in m
        let maxLength = props.Laylinelength_nm * 1852;
        if (is.dist / 1000 > 20000) return null; // Schnittpunkt liegt auf der gegenüberliegenden Erdseite!
        if (is.dist > maxLength)
          is.pos = pos.rhumbDestinationPoint(
            maxLength,
            pos.rhumbBearingTo(intersection),
          );
        else if (is.dist < maxLength && props.Laylineoverlap)
          is.pos = pos.rhumbDestinationPoint(
            maxLength,
            pos.rhumbBearingTo(intersection),
          );
        else is.pos = intersection;
        return is;
      };

      is_BB_boat = is_BB_WP = is_SB_boat = is_SB_WP = null;
      if (is_BB) {
        is_BB_boat = calc_endpoint(is_BB, POS);
        is_BB_WP = calc_endpoint(is_BB, WP);
      }
      if (is_SB) {
        is_SB_boat = calc_endpoint(is_SB, POS);
        is_SB_WP = calc_endpoint(is_SB, WP);
      }

      if (is_SB_boat && is_SB_WP && is_BB_boat && is_BB_WP) {
        return {
          Boat: {
            SB: {
              P1: POS,
              P2: is_SB_boat.pos,
              dist: is_SB_boat.dist,
              color: "green",
            },
            BB: {
              P1: POS,
              P2: is_BB_boat.pos,
              dist: is_BB_boat.dist,
              color: "red",
            },
          },
          WP: {
            SB: {
              P1: WP,
              P2: is_SB_WP.pos,
              dist: is_SB_WP.dist,
              color: "red",
            },
            BB: {
              P1: WP,
              P2: is_BB_WP.pos,
              dist: is_BB_WP.dist,
              color: "green",
            },
          },
        };
      }
    }
  }

  function DrawMapLaylines(self, ctx, intersections, props) {
    ctx.save();

    function drawLine(p1, p2, color) {
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      const d = 5 * window.devicePixelRatio;
      ctx.setLineDash([2 * d, d]);
      ctx.stroke();
    }

    if (
      typeof props.LaylineBoat != "undefined" &&
      props.LaylineBoat == true &&
      intersections != null
    ) {
      // port
      p1 = self.lonLatToPixel(
        intersections.Boat.BB.P1._lon,
        intersections.Boat.BB.P1._lat,
      );
      p2 = self.lonLatToPixel(
        intersections.Boat.BB.P2._lon,
        intersections.Boat.BB.P2._lat,
      );
      drawLine(p1, p2, red);
      // starboard
      p1 = self.lonLatToPixel(
        intersections.Boat.SB.P1._lon,
        intersections.Boat.SB.P1._lat,
      );
      p2 = self.lonLatToPixel(
        intersections.Boat.SB.P2._lon,
        intersections.Boat.SB.P2._lat,
      );
      drawLine(p1, p2, green);
    }
    if (
      typeof props.LaylineWP != "undefined" &&
      props.LaylineWP == true &&
      intersections != null
    ) {
      // port
      p1 = self.lonLatToPixel(
        intersections.WP.BB.P1._lon,
        intersections.WP.BB.P1._lat,
      );
      p2 = self.lonLatToPixel(
        intersections.WP.BB.P2._lon,
        intersections.WP.BB.P2._lat,
      );
      drawLine(p1, p2, green);
      // starboard
      p1 = self.lonLatToPixel(
        intersections.WP.SB.P1._lon,
        intersections.WP.SB.P1._lat,
      );
      p2 = self.lonLatToPixel(
        intersections.WP.SB.P2._lon,
        intersections.WP.SB.P2._lat,
      );
      drawLine(p1, p2, red);
    }
    ctx.restore();
  }

  function drawWaypointMarker(ctx, radius, angle) {
    ctx.save();
    ctx.beginPath();
    const thickness = radius / 4;
    ctx.rotate(radians(angle));
    ctx.arc(0, -radius + thickness / 3, thickness / 4, 0, 2 * Math.PI);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 0.05 * thickness;
    ctx.fillStyle = "yellow";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLayline(ctx, radius, angle, minmax, color) {
    ctx.save();
    radius = 0.9 * radius;
    ctx.rotate(radians(angle));

    // Laylines
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -radius);
    ctx.lineWidth = 0.02 * radius;
    ctx.strokeStyle = color;
    let d = 3 * window.devicePixelRatio;
    ctx.setLineDash([d, d]);
    ctx.stroke();

    // sectors
    ctx.globalAlpha *= 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, radians(minmax[0] - 90), radians(minmax[1] - 90));
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawHeadingBox(ctx, radius, angle, Text, night = false) {
    ctx.save();
    ctx.rotate(radians(angle));

    function roundRect(x, y, w, h, radius) {
      let r = x + w;
      let b = y + h;
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

    let Muster = "888";
    ctx.font = "bold " + radius / 5 + "px " + FONT;
    let metrics = ctx.measureText(Muster);
    let w = metrics.width;
    let h = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    roundRect(
      (-1.2 * w) / 2,
      -radius - (1.2 * h) / 2,
      1.2 * w,
      1.2 * h,
      (0.1 * radius) / 4,
    );
    ctx.fillStyle = night ? "#333" : "white";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "bold " + radius / 5 + "px " + FONT;
    ctx.fillStyle = night ? "red" : "black";
    ctx.fillText(Text, 0, -radius + h / 2);
    ctx.restore();
  }

  function drawCourseMarker(ctx, radius, angle, color, part = 0) {
    // part: +1=upper, -1=lower, 0=both
    ctx.save();

    const thickness = radius / 4;

    ctx.rotate(radians(angle));
    let xc = 0;
    let yc = -radius;
    let xl = -0.3 * thickness;
    let xr = +0.3 * thickness;
    let yt = yc - 0.9 * thickness;
    let yb = yc + 0.9 * thickness;
    ctx.beginPath();
    if (part > 0) {
      // upper triangle
      ctx.moveTo(xl, yt);
      ctx.lineTo(xr, yt);
      ctx.lineTo(xc, yc);
    } else if (part < 0) {
      // lower triangle
      ctx.moveTo(xl, yb);
      ctx.lineTo(xr, yb);
      ctx.lineTo(xc, yc);
    } else {
      // hourglass
      ctx.moveTo(xl, yb);
      ctx.lineTo(xr, yb);
      ctx.lineTo(xl, yt);
      ctx.lineTo(xr, yt);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.lineWidth = 0.05 * thickness;
    ctx.strokeStyle = color;
    ctx.strokeStyle = "black";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawWindArrow(ctx, radius, angle, color, Text) {
    ctx.save();

    let radius_kompassring = radius; //0.525*Math.min(x,y);
    let radius_outer_ring = radius * 1.3; //= 0.65*Math.min(x,y);
    let thickness = radius / 4;

    ctx.rotate(radians(angle));

    ctx.beginPath();
    if (Text == "A")
      ctx.moveTo(0, -radius_kompassring + 0.75 * thickness); // Move pen to bottom-center corner
    else ctx.moveTo(0, -radius_kompassring + 0.25 * thickness); // Move pen to bottom-center corner
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
    ctx.font = "bold " + radius / 4 + "px " + FONT;
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
    ctx.font = "bold " + 0.15 * radius + "px " + FONT;
    ctx.fillText(label, 0, 0.7 * radius);
    ctx.restore();
  }

  function drawOuterRing(ctx, radius, angle) {
    ctx.save();
    ctx.rotate((angle / 180) * Math.PI);

    const thickness = 0.2 * radius;
    radius *= 1.25;
    const colors = ["#0F0", "#000", "#F00"];

    let partLength = (2 * Math.PI) / 2;
    let start = -Math.PI / 2;
    let gradient = null;
    let startColor = null;
    let endColor = null;

    for (let i = 0; i < 2; i++) {
      startColor = colors[i];
      endColor = colors[(i + 1) % colors.length];

      // x start / end of the next arc to draw
      let xStart = Math.cos(start) * radius;
      let xEnd = Math.cos(start + partLength) * radius;
      // y start / end of the next arc to draw
      let yStart = Math.sin(start) * radius;
      let yEnd = Math.sin(start + partLength) * radius;

      ctx.beginPath();

      gradient = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
      gradient.addColorStop(0, startColor);
      gradient.addColorStop(1.0, endColor);

      ctx.strokeStyle = gradient;
      ctx.arc(0, 0, radius, start, start + partLength);
      ctx.lineWidth = thickness;
      ctx.stroke();
      ctx.closePath();

      start += partLength;
    }

    for (let i = 0; i < 360; i += 10) {
      ctx.save();
      ctx.rotate((i / 180) * Math.PI);
      if (i % 30 == 0) {
        ctx.beginPath(); // Start a new path
        ctx.moveTo(0, -radius + (0.9 * thickness) / 2); // Move the pen to (30, 50)
        ctx.lineTo(0, -radius - (0.9 * thickness) / 2); // Draw a line to (150, 100)
        ctx.lineWidth = 0.1 * thickness;
        ctx.strokeStyle = i == 0 ? "black" : "white";
        ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';
      } else {
        ctx.beginPath();
        ctx.fillStyle = "lightgray";
        ctx.strokeStyle = "lightgray";
        ctx.lineWidth = 0.05 * thickness;
        ctx.arc(0, -radius, 0.1 * thickness, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCompassRing(ctx, radius, angle, night = false) {
    ctx.save();
    ctx.rotate(radians(angle));
    let thickness = 0.2 * radius; //1*Math.min(x,y)
    ctx.beginPath();
    let fontsize = Math.round((radius / 100) * 12);
    ctx.arc(0, 0, radius, 0, 2 * Math.PI, false);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = night ? "#333" : "rgb(230,230,230)";
    ctx.stroke();
    for (let i = 0; i < 360; i += 10) {
      ctx.save();
      ctx.rotate((i / 180) * Math.PI);
      if (i % 30 == 0) {
        ctx.fillStyle = night ? "#aaa" : "black";
        ctx.textAlign = "center";
        ctx.font = `bold ${fontsize}` + "px " + FONT;
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
  }

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
    return (a * Math.PI) / 180;
  }

  function degrees(a) {
    return (a * 180) / Math.PI;
  }

  function fixed(value, n) {
    if (value == null || !isFinite(value)) return "---";
    return value.toFixed(n);
  }

  var FuelGaugeWidget = {
    name: "0FuelGauge",
    caption: "Fuel",
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data) {
      //      console.log(data);
      canvas.style.height = "100%";
      const ctx = canvas.getContext("2d");
      const bcr = canvas.getBoundingClientRect();
      //      console.log(bcr);
      const w = bcr.width,
        h = bcr.height;
      canvas.width = w;
      canvas.height = h;

      let p, v;
      let m = data.maxValue;
      if (data.relative) {
        p = data.value * (data.percent ? 1 / 100 : 1);
        v = p * m;
      } else {
        v = data.value;
        p = v / m;
      }

      const b = 5;
      const H = (h - 2 * b) * Math.max(0, Math.min(1, p));

      ctx.fillStyle = data.color;
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.fillRect(b, h - b, w - 2 * b, -H);
      ctx.strokeRect(b, b, w - 2 * b, h - 2 * b);

      let fs = 30 * Math.min(Math.min(w / 200, h / 60), 1);
      ctx.font = fs + "px " + FONT;
      ctx.fillStyle = "black";
      let l =
        fixed(p * 100, 0) +
        "% " +
        data.formatter(v, ...data.formatterParameters) +
        (data.unit ?? "");
      let tw = ctx.measureText(l).width;
      ctx.fillText(l, w / 2 - tw / 2, h / 2 + fs / 2);
    },
  };

  avnav.api.registerWidget(FuelGaugeWidget, {
    value: true,
    formatter: true,
    formatterParameters: true,
    color: { type: "COLOR", default: "#8888ff" },
    maxValue: { type: "FLOAT", default: 1 },
    relative: { type: "BOOLEAN", default: false },
    percent: { type: "BOOLEAN", default: false },
  });

  class Inertia {
    constructor(
      mass,
      friction,
      position = 0,
      limit = (x) => x,
      dlimit = (x) => x,
      tmax = 5,
    ) {
      this.mass = mass;
      this.friction = friction;
      this.time = Date.now();
      this.acceleration = 0;
      this.speed = 0;
      this.position = position;
      this.limit = limit;
      this.dlimit = dlimit;
      this.tmax = tmax;
    }

    integrate(force, position) {
      const time = Date.now();
      const dt = Math.min(this.tmax, (time - this.time) / 33); // dt=1 per frame at 30Hz
      if ((dt == this.tmax && position != null) || !isFinite(this.position)) {
        this.acceleration = 0;
        this.speed = 0;
        this.position = position;
      } else {
        this.acceleration = force / this.mass - this.friction * this.speed;
        this.speed += this.acceleration * dt;
        this.position = this.limit(this.position + this.speed * dt);
      }
      this.time = time;
      return this.position;
    }

    to(target) {
      return this.integrate(this.dlimit(target - this.position), target);
    }
  }

  function animate(canvas, data, draw) {
    canvas.target = data.value;
    if (canvas.running) return;
    canvas.running = true;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const inertia = new Inertia(
      data.mass,
      data.friction,
      canvas.target,
      to360,
      to180,
    );

    function loop() {
      const bcr = canvas.getBoundingClientRect();
      const w = bcr.width,
        h = bcr.height;
      canvas.width = w;
      canvas.height = h;
      //    if(!w) console.log('stop animation');
      if (!w) return; // break loop if invisible
      const value = inertia.to(canvas.target);
      draw(ctx, value);
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  var LinearCompassWidget = {
    name: "0LinearCompass",
    storeKeys: {
      BRG: "nav.wp.course",
      VAR: "nav.gps.sail_instrument.VAR",
    },
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data) {
      animate(canvas, data, (ctx, course) => {
        const w = canvas.width,
          h = canvas.height;
        const range = data.range;
        const dir = data.flip ? 1 : -1;
        const color = data.nightMode ? "#d00" : "black";
        const color2 = data.nightMode ? "#66f" : "#d00";
        let H = Math.min(h / 4, 30);
        let cx = w / 2,
          cy = h / 2 + (data.showValue ? 0 : H / 2);
        if (h < 80) {
          H = h / 2;
          cy = h - 2;
        }
        const px_per_deg = w / range;
        const alt = data.altTicks; // alternate ticks
        const step_deg =
          px_per_deg > 4 ? 1 : px_per_deg > 2 ? 5 : alt ? 15 : 10;
        const font =
          Math.min(H, 30) * Math.min(1, px_per_deg / 2) + "px " + FONT;

        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();

        const a = Math.floor((course - range / 2) / step_deg) * step_deg; //first tick
        const o = a - (course - range / 2); // translation offset
        ctx.translate(cx + dir * o * px_per_deg, cy); // translate course to center

        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.font = font;
        ctx.fillStyle = color;
        for (let i = -30; i <= range + 30; i += step_deg) {
          const v = to360(i + a); // tick value
          const x = dir * (i * px_per_deg - cx); // tick position
          let y;
          if (alt) y = !(v % 45) ? 1 : !(v % 15) ? 0.8 : !(v % 5) ? 0.6 : 0.4;
          else y = !(v % 30) ? 1 : !(v % 10) ? 0.8 : !(v % 5) ? 0.6 : 0.4;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, -y * H);
          ctx.lineWidth = Math.max(1, 3 * y);
          ctx.stroke();
          if (!(v % (alt ? 45 : 30))) {
            let l = "" + v;
            if (data.letters) {
              if (v == 0) l = "N";
              if (v == 90) l = "E";
              if (v == 180) l = "S";
              if (v == 270) l = "W";
              if (v == 45) l = "NE";
              if (v == 135) l = "SE";
              if (v == 225) l = "SW";
              if (v == 315) l = "NW";
            }
            let tw = ctx.measureText(l).width;
            ctx.fillText(l, x - tw / 2, -H * 1.1);
          }
        }

        // bearing marker
        if (data.bearing && data.BRG != null) {
          const BRG = data.BRG - (data.magnetic ? (data.VAR ?? 0) : 0);
          ctx.beginPath();
          const x = dir * ((BRG - a) * px_per_deg - cx); // tick position
          ctx.moveTo(x, -H / 3);
          ctx.lineTo(x - H / 4, -H);
          ctx.lineTo(x + H / 4, -H);
          ctx.closePath();
          ctx.fillStyle = "blue";
          ctx.fill();
        }

        ctx.restore();
        ctx.save();

        ctx.translate(cx, cy);
        if (data.showValue) {
          ctx.font = font;
          ctx.fillStyle = color;
          l = fixed(course, 0);
          tw = ctx.measureText(l).width;
          ctx.fillText(l, -tw / 2, 1.9 * H);
        }

        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(0, -H);
        ctx.lineWidth = 2;
        ctx.strokeStyle = color2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -H / 3);
        ctx.lineTo(-H / 3, H);
        ctx.lineTo(H / 3, H);
        ctx.closePath();
        ctx.fillStyle = color2;
        ctx.fill();

        ctx.restore();
      });
    },
  };

  avnav.api.registerWidget(LinearCompassWidget, {
    value: true,
    mass: { type: "FLOAT", default: 100 },
    friction: { type: "FLOAT", default: 0.2 },
    range: { type: "NUMBER", default: 180 },
    showValue: { type: "BOOLEAN", default: false },
    flip: { type: "BOOLEAN", default: false },
    altTicks: { type: "BOOLEAN", default: false },
    letters: { type: "BOOLEAN", default: true },
    bearing: { type: "BOOLEAN", default: true },
    magnetic: { type: "BOOLEAN", default: false },
  });

  var RoundCompassWidget = {
    name: "0RoundCompass",
    storeKeys: {
      BRG: "nav.wp.course",
      VAR: "nav.gps.sail_instrument.VAR",
    },
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data) {
      canvas.style.height = "100%";
      animate(canvas, data, (ctx, course) => {
        const w = canvas.width,
          h = canvas.height;
        const color1 = data.nightMode ? "#d00" : "black";
        const color2 = data.nightMode ? "#66f" : "#d00";
        const half = data.half || h < 300 || h / w < 0.5;
        const cx = w / 2,
          cy = half ? h : h / 2,
          R = Math.min(cx, cy);
        const alt = data.altTicks; // alternate ticks
        const step_deg = R > 300 ? 1 : R > 150 ? 5 : alt ? 15 : 10;
        const F = (40 * R) / 300;
        ctx.font = F + "px " + FONT;

        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.translate(cx, cy);
        ctx.save();
        ctx.strokeStyle = color1;
        ctx.fillStyle = color1;

        // tick marks
        ctx.rotate(-radians(course));
        for (let v = 0; v < 360; v += step_deg) {
          ctx.beginPath();
          let s; // tick length
          if (alt) s = !(v % 45) ? 1 : !(v % 15) ? 0.8 : !(v % 5) ? 0.6 : 0.4;
          else s = !(v % 30) ? 1 : !(v % 10) ? 0.8 : !(v % 5) ? 0.6 : 0.4;
          ctx.moveTo(0, -0.95 * R);
          ctx.lineTo(0, (-0.95 + 0.12 * s) * R);
          ctx.lineWidth = Math.max(1, 4 * s * Math.min(1, R / 150));
          ctx.stroke();
          if (!(v % (alt ? 45 : 30))) {
            let l = "" + v;
            if (data.letters) {
              if (v == 0) l = "N";
              if (v == 90) l = "E";
              if (v == 180) l = "S";
              if (v == 270) l = "W";
              if (v == 45) l = "NE";
              if (v == 135) l = "SE";
              if (v == 225) l = "SW";
              if (v == 315) l = "NW";
            }
            let tw = ctx.measureText(l).width;
            ctx.fillText(l, -tw / 2, -0.85 * R + F);
          }
          ctx.rotate(radians(step_deg));
        }

        // target course marker
        if (data.bearing && data.BRG != null) {
          const BRG = data.BRG - (data.magnetic ? (data.VAR ?? 0) : 0);
          ctx.rotate(radians(BRG));
          ctx.beginPath();
          ctx.moveTo(0, -0.9 * R);
          ctx.lineTo(-0.02 * R, -0.85 * R);
          ctx.lineTo(0.02 * R, -0.85 * R);
          ctx.closePath();
          ctx.fillStyle = "blue";
          ctx.fill();
        }

        ctx.restore();
        // outer ring
        ctx.beginPath();
        ctx.arc(0, 0, 0.95 * R, 0, 2 * Math.PI);
        ctx.strokeStyle = color1;
        ctx.lineWidth = 2;
        ctx.stroke();
        // marker
        ctx.beginPath();
        ctx.moveTo(0, -0.91 * R);
        ctx.lineTo(-0.03 * R, -0.99 * R);
        ctx.lineTo(0.03 * R, -0.99 * R);
        ctx.closePath();
        ctx.fillStyle = color2;
        ctx.fill();
        // value at center
        if (data.showValue) {
          let l = fixed(course, 0).padStart(3, "0");
          ctx.font = 2 * F + "px " + FONT;
          let tw = ctx.measureText(l).width;
          ctx.fillStyle = color1;
          ctx.fillText(l, -tw / 2, (half ? -0.3 * R : 0) + 0.7 * F);
        }
        ctx.restore();
      });
    },
  };

  avnav.api.registerWidget(RoundCompassWidget, {
    value: true,
    mass: { type: "FLOAT", default: 100 },
    friction: { type: "FLOAT", default: 0.2 },
    showValue: { type: "BOOLEAN", default: false },
    half: { type: "BOOLEAN", default: false },
    altTicks: { type: "BOOLEAN", default: false },
    letters: { type: "BOOLEAN", default: true },
    bearing: { type: "BOOLEAN", default: true },
    magnetic: { type: "BOOLEAN", default: false },
  });

  var RoundCompass2Widget = {
    name: "0RoundCompass2",
    storeKeys: {
      BRG: "nav.wp.course",
      VAR: "nav.gps.sail_instrument.VAR",
    },
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data) {
      canvas.style.height = "100%";
      animate(canvas, data, (ctx, course) => {
        const w = canvas.width,
          h = canvas.height;
        const color1 = data.nightMode ? "#d00" : "black";
        const color2 = data.nightMode ? "#66f" : "#d00";
        const half = data.half || h < 300 || h / w < 0.5;
        const cx = w / 2,
          cy = half ? h : h / 2,
          R = Math.min(cx, cy);
        const alt = data.altTicks; // alternate ticks
        const step_deg = 5;
        const F = (20 * R) / 300;
        ctx.font = F + "px " + FONT;

        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.translate(cx, cy);
        ctx.strokeStyle = color1;
        ctx.fillStyle = color1;
        ctx.save();

        // tick marks
        ctx.rotate(-radians(course));
        for (let v = 0; v < 360; v += step_deg) {
          ctx.beginPath();
          const s = !(v % 10) ? 1 : 0.6;
          ctx.moveTo(0, -0.75 * R);
          ctx.lineTo(0, (-0.75 - 0.1 * s) * R);
          ctx.lineWidth = Math.max(1, 3 * s * Math.min(1, R / 150));
          ctx.stroke();
          if (!(v % 10)) {
            let l = "" + v;
            let tw = ctx.measureText(l).width;
            ctx.fillText(l, -tw / 2, -0.95 * R + F);
          }
          ctx.rotate(radians(step_deg));
        }

        // target course marker
        if (data.bearing && data.BRG != null) {
          const BRG = data.BRG - (data.magnetic ? (data.VAR ?? 0) : 0);
          ctx.rotate(radians(BRG));
          ctx.beginPath();
          ctx.moveTo(0, -0.83 * R);
          ctx.lineTo(0, -0.75 * R);
          ctx.strokeStyle = "blue";
          ctx.lineWidth = F / 10;
          ctx.stroke();
        }

        // inner circle
        ctx.beginPath();
        ctx.arc(0, 0, 0.75 * R, 0, 2 * Math.PI);
        ctx.fillStyle = "black";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, 0.54 * R, 0, 2 * Math.PI);
        ctx.strokeStyle = color1;
        ctx.lineWidth = 2;
        ctx.fillStyle = data.nightMode ? "black" : "white";
        ctx.fill();

        ctx.restore();
        ctx.save();
        ctx.fillStyle = data.nightMode ? color2 : "white";
        ctx.strokeStyle = data.nightMode ? color2 : "white";
        ctx.rotate(-radians(36 * (course % 10)));
        const G = 1.2 * F;
        ctx.font = G + "px " + FONT;
        for (let v = 0; v < 100; v++) {
          ctx.beginPath();
          const s = !(v % 10) ? 1 : !(v % 5) ? 0.8 : 0.6;
          ctx.moveTo(0, -0.75 * R);
          ctx.lineTo(0, (-0.73 + 0.08 * s) * R);
          ctx.lineWidth = Math.max(1, 3 * s * Math.min(1, R / 150));
          ctx.stroke();
          if (!(v % 10)) {
            let l = "" + v / 10;
            let tw = ctx.measureText(l).width;
            ctx.fillText(l, -tw / 2, -0.65 * R + G);
          }
          ctx.rotate(radians(3.6));
        }

        ctx.restore();
        // outer ring
        ctx.strokeStyle = color1;
        ctx.beginPath();
        ctx.arc(0, 0, 0.95 * R, 0, 2 * Math.PI);
        ctx.lineWidth = 2;
        ctx.stroke();
        // marker
        ctx.beginPath();
        ctx.moveTo(0, -0.95 * R);
        ctx.lineTo(0, -0.55 * R);
        ctx.strokeStyle = color2;
        ctx.lineWidth = F / 8;
        ctx.stroke();
        // value at center
        if (data.showValue) {
          let l = fixed(course, 1).padStart(3, "0");
          ctx.font = 4 * F + "px " + FONT;
          let tw = ctx.measureText(l).width;
          ctx.fillStyle = color1;
          ctx.fillText(l, -tw / 2, (half ? -0.15 * R : 0) + 1.5 * F);
        }
        ctx.restore();
      });
    },
  };

  avnav.api.registerWidget(RoundCompass2Widget, {
    value: true,
    mass: { type: "FLOAT", default: 300 },
    friction: { type: "FLOAT", default: 0.2 },
    showValue: { type: "BOOLEAN", default: false },
    half: { type: "BOOLEAN", default: false },
    bearing: { type: "BOOLEAN", default: true },
    magnetic: { type: "BOOLEAN", default: false },
  });

  var SVGCompass = {
    name: "0SVGCompass",
    initFunction: function () {},
    finalizeFunction: function () {},
    renderCanvas: function (canvas, data) {
      //      console.log('canvas',canvas,data);
      let rot = data.value;
      if (canvas.div) {
        //        console.log('UPDATE');
        if (data.showValue) {
          const val = canvas.div.getElementsByTagName("div")[2];
          val.textContent = fixed(rot, 0);
        }
        const ele = canvas.div.getElementsByTagName("div")[0];
        //        console.log(ele);
        let rot0 = ele.rot ?? rot;
        let delta = to180(rot - rot0);
        rot = rot0 + delta;
        //        console.log(rot);
        ele.style.transform = `${canvas.t} rotate(${-rot}deg)`;
        if (!ele.style.transition) ele.style.transition = "all 1s ease-in-out";
        ele.rot = rot;
        return;
      }
      //      console.log('INIT');
      canvas.div = canvas.parentElement;
      //      console.log('div',canvas.div);
      const bbox = canvas.div.getBoundingClientRect();
      const w = bbox.width,
        h = bbox.height;
      const half = data.half || h < w / 2;
      const a = Math.min(w, half ? 2 * h : h);
      // console.log(a);
      let s = half ? "height:200%" : "";
      let t = half ? `translate(0px,${h / 2}px)` : "";
      canvas.t = t;
      canvas.div.style.position = "relative";
      canvas.div.innerHTML = `<div class="SIcompass" style="transform: ${t} rotate(${-rot}deg); ${s}"></div><div class="SImarker" style="transform: ${t}; ${s}"></div>`;
      canvas.style.display = "none";
      if (data.showValue) {
        canvas.div.innerHTML += `<div class="SIvalue" style="font-size:${a / 7}px; ${half ? "bottom:0;" : ""}">${fixed(rot, 0)}</div>`;
      }
    },
  };

  avnav.api.registerWidget(SVGCompass, {
    value: true,
    showValue: { type: "BOOLEAN", default: false },
    half: { type: "BOOLEAN", default: false },
  });

  // universal widget for formatting single value

  function pad(num, size, pad = "0") {
    return ("" + num).trim().padStart(size, pad);
  }

  function clamp(lower, x, upper) {
    return Math.max(lower, Math.min(upper, x));
  }

  function formatDMS(coordinate, axis, format = "DDM", hemFirst = true) {
    coordinate = parseFloat(coordinate);
    if (!isFinite(coordinate)) {
      let str = "____\u00B0__.___'";
      if (format == "DD") str = "____._____\u00B0"; // use _ to prevent line breaks
      if (format == "DMS") str = "____\u00B0__'__._\"";
      return hemFirst ? "_" + str : str + "_";
    }
    coordinate = to180(coordinate); // normalize to ±180°
    let deg = Math.abs(coordinate);
    let padding = 2;
    let str = "\u00A0";
    let hem = coordinate < 0 ? "S" : "N";
    if (axis == "lon") {
      str = "";
      padding = 3;
      hem = coordinate < 0 ? "W" : "E";
    }
    if (format == "DD") {
      str += pad(deg.toFixed(5), padding + 6) + "\u00B0";
    } else if (format == "DMS") {
      let SEC = Math.round(deg * 3600_0) / 10;
      let sec = SEC % 60;
      let MIN = Math.floor(SEC / 60);
      let min = MIN % 60;
      let DEG = Math.floor(MIN / 60);
      str +=
        pad(DEG.toFixed(0), padding) +
        "\u00B0" +
        pad(min.toFixed(0), 2) +
        "'" +
        pad(sec.toFixed(1), 4) +
        '"';
    } else {
      let MIN = Math.round(deg * 60_000) / 1000;
      let min = MIN % 60;
      let DEG = Math.floor(MIN / 60);
      str += pad(DEG, padding) + "\u00B0" + pad(min.toFixed(3), 6) + "'";
    }
    return hemFirst ? hem + str : str + hem;
  }

  function formatPos(pos, format = "DDM", hemFirst = true) {
    let lat = formatDMS(pos.lat, "lat", format, hemFirst);
    let lon = formatDMS(pos.lon, "lon", format, hemFirst);
    return lat + "\u2009" + lon + "\u2009";
  }

  function formatFloat(
    number,
    digits,
    maxFrac,
    leadingZeroes = false,
    trailingDot = true,
    overflow = "#",
    positiveSign = " ",
  ) {
    if (!digits) digits = 3;
    let signed = digits < 0;
    digits = Math.abs(digits);
    if (maxFrac == null) maxFrac = digits - 1;
    const fixed = maxFrac < 0;
    maxFrac = clamp(0, Math.abs(maxFrac), digits - 1);
    number = parseFloat(number); // null-->NaN
    if (!isFinite(number))
      return (
        "-".repeat((signed ? 1 : 0) + digits - maxFrac) +
        (maxFrac ? "." + "-".repeat(maxFrac) : "")
      );
    if (digits == 0) return number.toFixed(0);
    if (number < 0 && !signed) digits -= 1; // make room for unexpected sign
    let sign = number < 0 ? "-" : signed ? positiveSign : "";
    number = Math.abs(number);
    let decPlaces = digits - 1 - Math.floor(Math.log10(number));
    decPlaces = fixed ? maxFrac : clamp(0, decPlaces, maxFrac);
    let str = number.toFixed(decPlaces);
    let n = digits + (str.includes(".") ? 1 : 0); // expected length of string w/o sign
    if (overflow && str.length > n)
      return (
        overflow.repeat((signed ? 1 : 0) + digits) +
        (trailingDot && maxFrac ? "." : "")
      );
    let dot = trailingDot && maxFrac && !str.includes(".") ? "." : "";
    if (leadingZeroes) {
      return sign + str.padStart(n, "0") + dot; // -001.23
    } else {
      return (sign + str).padStart(n + sign.length, " ") + dot; // __-1.23
    }
  }

  function convertTo(value, unit) {
    let f = 1.0;
    if (unit == "ft") f = 3.280839895; // feet
    if (unit == "yd") f = 3.280839895 / 3; // yards
    if (unit == "km") f = 1 / 1000.0;
    if (unit == "nm") f = 1 / 1852.0;
    if (unit == "kn") f = 3600 / 1852.0;
    if (unit == "km/s") f = 3.6;
    if (unit == "hPa") f = 1 / 100.0;
    if (unit == "bft") {
      const v = (value * 3600) / 1852.0;
      if (v <= 1) return 0;
      if (v <= 3) return 1;
      if (v <= 6) return 2;
      if (v <= 10) return 3;
      if (v <= 16) return 4;
      if (v <= 21) return 5;
      if (v <= 27) return 6;
      if (v <= 33) return 7;
      if (v <= 40) return 8;
      if (v <= 47) return 9;
      if (v <= 55) return 10;
      if (v <= 63) return 11;
      if (v > 63) return 12;
    }
    return value * f;
  }

  function formatHHMM(value, seconds = false, utc = false) {
    value = parseInt(value);
    if (!isFinite(value)) return "--:--" + (seconds ? ":--" : "");
    const d = new Date(value);
    let hms = utc
      ? [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
      : [d.getHours(), d.getMinutes(), d.getSeconds()];
    if (!seconds) hms = hms.slice(0, 2);
    return hms.map((v) => pad(v, 2)).join(":");
  }

  function formatTTG(value, seconds) {
    value = parseInt(value);
    if (!isFinite(value) || value < 0) return "--:--" + (seconds ? ":--" : "");
    const SEC = Math.round(Math.abs(value / 1000));
    const sec = SEC % 60;
    const MIN = Math.floor(SEC / 60);
    const min = MIN % 60;
    const HOUR = Math.floor(MIN / 60);
    let hms = [HOUR, min, sec];
    if (!seconds) hms = hms.slice(0, 2);
    return hms.map((v) => pad(v, 2)).join(":");
  }

  function formatValue(value, opts) {
    if (opts.format == "180") value = to180(value);
    if (opts.format == "360") value = to360(value);
    if (opts.format == "HH:MM")
      return formatHHMM(value, opts.digits >= 6, opts.utc);
    else if (opts.format == "TTG") return formatTTG(value, opts.digits >= 6);
    else if (opts.format.startsWith("D")) return formatPos(value, opts.format);
    return formatFloat(
      value,
      opts.digits,
      opts.maxfrac,
      opts.zeroes,
      true,
      "#",
      opts.signed ? "+" : " ",
    );
  }

  var uniWidget = {
    name: "0Widget",
    storeKeys: {
      TIME: "nav.gps.rtime",
      LAT: "nav.gps.lat",
      LON: "nav.gps.lon",
      VALID: "nav.gps.valid",
    },
    formatter: avnav.api.formatter.formatString,
    renderHtml: function (data) {
      let value = data.value;
      if (data.format == "TTG") value = value - data.TIME;
      if (value instanceof Date) value = value.getTime();
      if (data.format.startsWith("D"))
        value = { lat: data.LAT, lon: data.LON, ...data.value };
      else value = convertTo(value, data.unit);
      // console.log(data.caption, data.value, typeof data.value, value);
      let str = formatValue(value, data)
        .replaceAll(":", "\uA789") // modified colon
        .replaceAll("-", "\u2012") // figure dash
        .replaceAll(" ", "\u2007") // figure space
        .replace(/\.$/, "\u2008"); // punctuation space
      let cls = str.length > 8 ? "small" : str.length > 6 ? "medium" : "big";
      cls += data.format.startsWith("D") ? " mono" : "";
      if (data.validity && !data.VALID) cls += " error invalid";
      if (data.format == "0.00") {
        cls += value < data.lower || value > data.upper ? " warning" : "";
      }
      return `<div class="widgetData ${cls}">${str}</div>`;
    },
  };

  avnav.api.registerWidget(uniWidget, {
    value: true,
    formatter: true,
    format: {
      type: "SELECT",
      list: ["0.00", "180", "360", "HH:MM", "TTG", "DD", "DDM", "DMS"],
      default: "0.00",
    },
    digits: {
      type: "NUMBER",
      default: 3,
      description: "number of total digits, negative=signed",
    },
    maxfrac: {
      type: "NUMBER",
      default: 2,
      description:
        "max. number of fractional digits, negative=fixed, 0=integer",
    },
    zeroes: {
      type: "BOOLEAN",
      default: false,
      description: "leading zeroes",
    },
    signed: {
      type: "BOOLEAN",
      default: false,
      description: "show positive sign +",
    },
    utc: {
      type: "BOOLEAN",
      default: false,
      description: "time in UTC",
    },
    upper: {
      type: "FLOAT",
      default: +99999,
      description: "upper warning threshold",
    },
    lower: {
      type: "FLOAT",
      default: -99999,
      description: "lower warning threshold",
    },
    validity: {
      type: "BOOLEAN",
      default: false,
      description: "show error if !gps.valid",
    },
  });
})();
