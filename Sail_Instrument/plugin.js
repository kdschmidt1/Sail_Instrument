console.log("Sailinstrument o github loaded");

		//globalThis.globalParameter={};


var Sail_InstrumentInfoParameters = {
    //formatterParameters is already well known to avnav, so no need for any definition
    //just tell avnav that the user should be able to set this
    formatterParameters: true,
    //we would like to get a value from the internal data store
    //if we name it "value" avnav already knows how to ask the user about it
    value: true
};
var intersections

const formatLL=function(dist,speed, opt_unit){
	let ret=["",""]
    try{
        if (! opt_unit || opt_unit.toLowerCase().match("dist")){
            ret[0]="nm"
            ret[1]=avnav.api.formatter.formatDistance(dist,3,1);
            return ret
        }
        if (opt_unit.toLowerCase().match("time")){
	
			let dt=dist/1825/(speed*1.944)	//dt=dist[nm]/v[kn] in [hrs]
            let tval = dt*3600;	// in sec
            let sign = "";
            if (tval < 0) {
                sign = "-";
                tval = -tval;
            }
            let h = Math.floor(tval / 3600);
            let m = Math.floor((tval - h * 3600) / 60);
            let s = tval - 3600 * h - 60 * m;
            ret[0]="hh:mm:ss"
            ret[1]=sign + avnav.api.formatter.formatDecimal(h, 2, 0).replace(" ", "0") + ':' + avnav.api.formatter.formatDecimal(m, 2, 0).replace(" ", "0") + ':' + avnav.api.formatter.formatDecimal(s, 2, 0).replace(" ", "0");
            return ret
        }
    }catch(e){
        return "-----"
    }
}
formatLL.parameters=[
    {name:'unit',type:'SELECT',list:['dist','cum_dist','time','cum_time'],default:'dist'}
]

avnav.api.registerFormatter("mySpecialLL",formatLL);

var Sail_InstrumentInfoWidget = {
    name: "Sail_InstrumentInfo",
    //unit: "nm",
    renderHtml: function (props) {
		let fmtParam="";
		let gpsdata= {...props};	// https://www.delftstack.com/de/howto/javascript/javascript-deep-clone-an-object/

		console.log("Sail_InstrumentInfo");

        //var fmtParam = ((gpsdata.formatterParameters instanceof  Array) && gpsdata.formatterParameters.length > 0) ? gpsdata.formatterParameters[0] : undefined;
		if(typeof(intersections) != 'undefined'&&intersections)
		{
		if (gpsdata.formatterParameters!=undefined)
        	fmtParam = ((gpsdata.formatterParameters instanceof  Array) && gpsdata.formatterParameters.length > 0) ? gpsdata.formatterParameters[0] : undefined;
        else
        	fmtParam = ((gpsdata.formatterParameters instanceof  Array) && gpsdata.formatterParameters.length > 0) ? gpsdata.formatterParameters[0] : undefined;
        var fv = formatLL(intersections.Boat.BB.dist,gpsdata.speed,fmtParam);
        var fv2 = formatLL(intersections.Boat.SB.dist,gpsdata.speed,fmtParam);
        var fvges = formatLL(intersections.Boat.SB.dist+intersections.Boat.BB.dist,gpsdata.speed,fmtParam);
		}
		else
		{
		fv=fv2=fvges=["--","--"]
		}
        ret= "	\
        <div class=\"Sail_InstrumentInfo\"> </div> \
   	    <div class=\'infoRight\'> " + fv[0] + "</div>	\
       	<div class=\" infoLeft \" > " + "Layl." + "</div> \
        <div class=\"resize\"> \
        <br> \
        "
        if( fmtParam.toLowerCase().match("cum"))
        {
        ret += "	\
        <div class=\"Sail_InstrumentInfoInner\"> \
        	<div class=\" infoLeft \" > " + "LLcum" + "</div> \
        	<div class=\" widgetData \" > " + fvges[1] + "</div> \
		</div> \
		</div> \
        "
		}
		else
		{
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
        return(ret)
    },
            storeKeys:{
            	course: 'nav.gps.course',
            	speed: 'nav.gps.speed',
                	  boatposition: 'nav.gps.position',
                	  LLSB:'nav.gps.LLSB',
                	  LLBB:'nav.gps.LLBB',
                	  TSS:'nav.gps.TSS',
            },
            formatter: formatLL,
};
/**
 * uncomment the next line to really register the widget
 */
avnav.api.registerWidget(Sail_InstrumentInfoWidget,Sail_InstrumentInfoParameters);








var Sail_InstrumentWidget={

            name:"Sail_InstrumentWidget",

            // Editable Parameters
            Laylinerefresh: 5,
            TWDFilt_Indicator:false,


            initFunction:function(a,b)
            {
            },


            /**
            * optional render some graphics to a canvas object
            * you should style the canvas dimensions in the plugin.css
            * be sure to potentially resize and empty the canvas before drawing
            * @param canvas
            * @param props - the properties you have provided here + the properties you
            *                defined with the storeKeys
            */
            renderCanvas:function(canvas,props){
				let gpsdata= {...props};	// https://www.delftstack.com/de/howto/javascript/javascript-deep-clone-an-object/

            	var ctx=canvas.getContext('2d');
            	// Set scale factor for all values
            	var crect=canvas.getBoundingClientRect();
            	var w=crect.width;
            	var h=crect.height;
            	canvas.width=w;
            	canvas.height=h;
            	ctx.save();
            	var width = 200;			// Control width
            	var height = 200;			// Control height
            	var f1=w/width;
            	var f2=h/height;
            	var f=Math.min(f1,f2);
            	ctx.scale(f,f);
            	ctx.translate(width/2*f1/f,height/2*f2/f); //move the drawing to the middle

            	self=this
            	ctx.save();
            	//Fixiere Grösse für Widget
            	Displaysize = 65;

            	//maprotationdeg = gpsdata.ActualMapRotation	//this.mapholder.olmap.getView().getRotation()/Math.PI*180
            	boatrotationdeg = gpsdata.course;
            	// get rid of maprotationdeg for widget
            	if(gpsdata.courseup)
            		maprotationdeg=360-boatrotationdeg;
            	else 
            		maprotationdeg=0;
            	calcTrueWind(gpsdata)
            	calc_LaylineAreas(this, gpsdata)
            	DrawOuterRing(ctx, Displaysize, maprotationdeg+boatrotationdeg);
            	DrawKompassring(ctx, Displaysize, maprotationdeg);


            	// wenn TWD+360 > LL-angle+360 -> grün sonst -> rot
            	color=((gpsdata.LLBB-gpsdata.TWD)+540)%360-180 > 0 ? "rgb(0,255,0)":"red";
            	DrawLaylineArea(ctx, Displaysize, maprotationdeg+gpsdata.LLBB, TWD_Abweichung, ((gpsdata.LLBB-gpsdata.TWD)+540)%360-180 < 0 ? "rgb(0,255,0)":"red")
            	DrawLaylineArea(ctx, Displaysize, maprotationdeg+gpsdata.LLSB, TWD_Abweichung, ((gpsdata.LLSB-gpsdata.TWD)+540)%360-180 < 0 ? "rgb(0,255,0)":"red")
            	DrawWindpfeilIcon(ctx, Displaysize, maprotationdeg+gpsdata.AWD, "rgb(0,255,0)", 'A')
            	DrawWindpfeilIcon(ctx, Displaysize, maprotationdeg+gpsdata.TWD , "blue", 'T')

            	if(typeof(gpsdata.TWDFilt_Indicator) != 'undefined' && gpsdata.TWDFilt_Indicator==true)	 
            		DrawWindpfeilIcon(ctx, Displaysize, + maprotationdeg+gpsdata.TSS, "yellow", '~');
            	return;
            },
            		/**
            		* the access to the internal store
            * this should be an object where the keys are the names you would like to
            * see as properties when your render functions are called
            * whenever one of the values in the store is changing, your render functions will be called
            */
            storeKeys:{
            	course: 'nav.gps.course',
            	speed: 'nav.gps.speed',
            	windAngle:'nav.gps.windAngle',
            	windSpeed:'nav.gps.windSpeed',
            	TSS:'nav.gps.TSS',
            	LLSB:'nav.gps.LLSB',
            	LLBB:'nav.gps.LLBB',
            	courseup:'map.courseUp',
            },
            caption: "Laylines",
            unit: "",
};
var Sail_InstrumentWidgetParameter = {
                       Laylinerefresh: {type: 'NUMBER', default: 5},
                       TWDFilt_Indicator: {type: 'BOOLEAN', default: false},
};

avnav.api.registerWidget(Sail_InstrumentWidget, Sail_InstrumentWidgetParameter);


/*################################################################################################*/
let Sail_Instrument_Overlay={

                  // Editable Parameters
                  Displaysize: 100,
                  Opacity:1,
                  Laylinerefresh: 5,
                  TWDFilt_Indicator:false,
                  Widgetposition:'Boatposition',

                  name: 'Sail_Instrument_Overlay',
                  type:'map',
                  storeKeys:{
                	  boatposition: 'nav.gps.position',
                	  LLSB:'nav.gps.LLSB',
                	  LLBB:'nav.gps.LLBB',
                	  course: 'nav.gps.course',
                	  TSS:'nav.gps.TSS',
                	  course: 'nav.gps.course',
            		speed: 'nav.gps.speed',
            		windAngle:'nav.gps.windAngle',
            		windSpeed:'nav.gps.windSpeed',
            		courseup:'map.courseUp',


                  },
                  initFunction: function(){
                  },
                		  finalizeFunction: function(){
                  },
                		  renderCanvas: function(canvas,props,center)
                		  {	
							let gpsdata= {...props};	// https://www.delftstack.com/de/howto/javascript/javascript-deep-clone-an-object/
							calcTrueWind(gpsdata);

                	  console.log("Sail_Instrument-Overlay");

                	  ctx=canvas.getContext('2d')
																	ctx.save();
                	  if(gpsdata.Widgetposition=='Mapcenter')
                		  // Zeichne im Center:
                		  ctx.translate(canvas.getAttribute("width") / 2, canvas.getAttribute("height") / 2);
                		  else if(gpsdata.Widgetposition=='Boatposition')	
                		  {
							if(typeof(gpsdata.boatposition) != 'undefined')
								{ 
                			  // Zeichne an der Bootsposition
                			  coordinates=this.lonLatToPixel(gpsdata.boatposition.lon,gpsdata.boatposition.lat)
                			  ctx.translate(coordinates[0],coordinates[1]);
                			  }
                			 else
                			  // Keine Bootsposition vorhanden -> zeichne im Center
	                 		  ctx.translate(canvas.getAttribute("width") / 2, canvas.getAttribute("height") / 2);

                		  }
                	  ctx.globalAlpha*=gpsdata.Opacity;

                	  maprotationdeg = this.getRotation()/Math.PI*180;
                	  boatrotationdeg = gpsdata.course;	// Hier muss eigentlich HDG hinein!!

                	  calc_LaylineAreas(this, gpsdata)
                	  DrawOuterRing(ctx, gpsdata.Displaysize, maprotationdeg+boatrotationdeg);
                	  DrawKompassring(ctx, gpsdata.Displaysize, maprotationdeg);

                	  // wenn TWD+360 > LL-angle+360 -> grün sonst -> rot
                	  color=((gpsdata.LLBB-gpsdata.TWD)+540)%360-180 > 0 ? "rgb(0,255,0)":"red";
                	  DrawLaylineArea(ctx, gpsdata.Displaysize, maprotationdeg+gpsdata.LLBB, TWD_Abweichung, ((gpsdata.LLBB-gpsdata.TWD)+540)%360-180 < 0 ? "rgb(0,255,0)":"red")
                	  DrawLaylineArea(ctx, gpsdata.Displaysize, maprotationdeg+gpsdata.LLSB, TWD_Abweichung, ((gpsdata.LLSB-gpsdata.TWD)+540)%360-180 < 0 ? "rgb(0,255,0)":"red")
                	  DrawWindpfeilIcon(ctx, gpsdata.Displaysize, maprotationdeg+gpsdata.AWD, "rgb(0,255,0)", 'A')
                	  DrawWindpfeilIcon(ctx, gpsdata.Displaysize, maprotationdeg+gpsdata.TWD , "blue", 'T')
                	  DrawEierUhr(ctx, gpsdata.Displaysize, maprotationdeg+gpsdata.course , "rgb(255,128,0", 'T')	// zeigt COG an
                	  DrawCourseBox(ctx, gpsdata.Displaysize,maprotationdeg+boatrotationdeg, "red", Math.round(gpsdata.course))

                	  if(typeof(gpsdata.TWDFilt_Indicator) != 'undefined' && gpsdata.TWDFilt_Indicator==true)	 
                		  DrawWindpfeilIcon(ctx, gpsdata.Displaysize, + maprotationdeg+gpsdata.TSS, "yellow", '~');
                	  ctx.restore();


                	  ctx=canvas.getContext('2d')
																													ctx.save();
                	  testme(this,canvas, gpsdata)															
                	  ctx.restore();
                		  }

}


var Sail_Instrument_OverlayParameter = {
                             Widgetposition: {type:'SELECT',list:['Boatposition','Mapcenter'],default:'Boatposition'},
                             //myWidgetposition:{type:'SELECT',list:{name:'Boatposition',value:'true',name:'Mapcenter',value:'false'},default:'Boatposition'},
                             Displaysize: {type: 'NUMBER', default: 100},
                             Opacity: {type: 'NUMBER', default: 1},
                             Laylinerefresh: {type: 'NUMBER', default: 5},
                             TWDFilt_Indicator: {type: 'BOOLEAN', default: false},
};

avnav.api.registerWidget(Sail_Instrument_Overlay,Sail_Instrument_OverlayParameter );

/*##################################################################################################*/
let LayLines_Overlay={

              // Editable Parameters
              Opacity:1,
              Laylinelength_nm: 10,
              Laylineoverlap: false,
              LaylineBoat: true,
              LaylineWP: true,

              name: 'LayLines-Overlay',
              type: 'map',
              storeKeys:{
            	  boatposition: 'nav.gps.position',
            	  WPposition:'nav.wp.position',
            	  LLSB:'nav.gps.LLSB',
            	  LLBB:'nav.gps.LLBB',
                  course: 'nav.gps.course',
            	  speed: 'nav.gps.speed',
            	  windAngle:'nav.gps.windAngle',
            	  windSpeed:'nav.gps.windSpeed',
              },
              initFunction: function(a,b)
              {},
              finalizeFunction: function(){},
              renderCanvas: function(canvas,props,center)
              {
				let gpsdata= {...props};	// https://www.delftstack.com/de/howto/javascript/javascript-deep-clone-an-object/
				calcTrueWind(gpsdata);

            	  if(typeof(props.boatposition) != 'undefined')		
            	  {
            		ctx=canvas.getContext('2d')
																															ctx.save();
            		ctx.globalAlpha*=props.Opacity;

            		  //Laylines auf map zeichnen 
            		intersections = calc_intersections(self, props)
		            if( (typeof(props.LaylineWP) != 'undefined' && props.LaylineWP==true)|| true) 
		            		if(typeof(intersections) != 'undefined'&&intersections)
		            			DrawMapLaylines(this, ctx, this.getScale(), intersections, props,gpsdata.TWD);
            		  ctx.restore();
            	  }

              },

}

var LayLines_OverlayParameter = {

                      Opacity: {type: 'NUMBER', default: 1},
                      Laylinelength_nm: {type: 'NUMBER', default: 10},
                      Laylineoverlap: {type: 'BOOLEAN', default: false},
                      LaylineBoat: {type: 'BOOLEAN', default: true},
                      LaylineWP: {type: 'BOOLEAN', default: true},
};

avnav.api.registerWidget(LayLines_Overlay,LayLines_OverlayParameter);
/*##################################################################################################*/

var TWD_Abweichung = [0,0];
var old_time=performance.now()
let LatLon=avnav.api.LatLon();
		let calc_intersections = function(self, props) {
	intersections = null;
	let b_pos = new LatLon(props.boatposition.lat, props.boatposition.lon);
	//b_pos = avnav.api.createLatLon(props.boatposition.lat, props.boatposition.lon);
	if (props.WPposition) {
		WP_pos = new LatLon(props.WPposition.lat, props.WPposition.lon);

		// Intersections berechnen
		var is_SB = LatLon.intersection(b_pos, props.LLSB, WP_pos, props.LLBB + 180);
		var is_BB = LatLon.intersection(b_pos, props.LLBB, WP_pos, props.LLSB + 180);
		calc_endpoint = function(intersection, pos) {
			let is_xx={};
			is_xx.dist = pos.rhumbDistanceTo(intersection);	// in m
			if (is_xx.dist/1000>20000)	// Schnittpunkt liegt auf der gegenüberliegenden Erdseite!
					return null;
			if(is_xx.dist > props.Laylinelength_nm*1852) // beides in m// wenn abstand gösser gewünschte LL-Länge, neuen endpunkt der LL berechnen
			is_xx.pos = pos.rhumbDestinationPoint(props.Laylinelength_nm*1852,pos.rhumbBearingTo(intersection)) // abstand in m
			else if(is_xx.dist< props.Laylinelength*1852 && props.Laylineoverlap==true)// wenn abstand kleiner gewünschte LL-Länge und Verlängerung über schnittpunkt gewollt, neuen endpunkt der LL berechnen
				is_xx.pos = pos.rhumbDestinationPoint(props.Laylinelength_nm*1852,pos.rhumbBearingTo(intersection)) // abstand in m
			else
				is_xx.pos= intersection;
			return(is_xx)
		};

		is_BB_boat=is_BB_WP = is_SB_boat=is_SB_WP =null;
		if(is_BB)
		{
			is_BB_boat=calc_endpoint(is_BB, b_pos);
			is_BB_WP = calc_endpoint(is_BB, WP_pos);
		}
		if(is_SB)
		{
			is_SB_boat=calc_endpoint(is_SB, b_pos);
			is_SB_WP = calc_endpoint(is_SB, WP_pos);
		}

		if(is_SB_boat && is_SB_WP && is_BB_boat && is_BB_WP){	
			// es gibt schnittpunkte
			intersections = 
			{ 
			Boat: { SB: { P1: b_pos, P2: is_SB_boat.pos, color: 'rgb(0,255,0)' ,dist: is_SB_boat.dist}, 
			BB: { P1: b_pos, P2: is_BB_boat.pos, color: 'red' ,dist: is_BB_boat.dist} }, 
			WP:   { SB: { P1: WP_pos, P2: is_SB_WP.pos, color: 'red' ,dist: is_SB_WP.dist}, 
			BB: { P1: WP_pos, P2: is_BB_WP.pos, color: 'rgb(0,255,0)' ,dist: is_BB_WP.dist} } 
			}
		}
		else
			// keine schnittpunkte
		intersections = null;
	}
	return intersections
}



let calc_LaylineAreas = function(self, props) {
	// Berechnungen für die Laylineareas
	// Die Breite der Areas (Winkelbereiche) wird über die Refreshzeit abgebaut
	let reduktionszeit;
	const ln0_1=Math.log(0.1);

	if(typeof(props.Laylinerefresh) != 'undefined')
		reduktionszeit = props.Laylinerefresh * 60;
	else
		reduktionszeit = 360;
	let difftime = (performance.now() - old_time) / 1000 // sec
	old_time = performance.now()

																								let k = ln0_1 / reduktionszeit
	for (var i = 0; i < 2; i++)
		TWD_Abweichung[i] *= Math.exp(k * difftime)


		let winkelabweichung = (props.TWD - props.TSS) % 360;
	if (Math.abs(winkelabweichung) > 180)
		winkelabweichung = winkelabweichung < -180 ? winkelabweichung % 180 + 180 : winkelabweichung
	winkelabweichung = winkelabweichung > 180 ? winkelabweichung % 180 - 180 : winkelabweichung
	TWD_Abweichung[0] = winkelabweichung < TWD_Abweichung[0] ? winkelabweichung : TWD_Abweichung[0];
	TWD_Abweichung[1] = winkelabweichung > TWD_Abweichung[1] ? winkelabweichung : TWD_Abweichung[1];
};


let DrawMapLaylines=function(self,ctx, scale, intersections, props,TWD) {
	DrawLine=function(p1,p2,color){	
		ctx.beginPath();
		ctx.moveTo(p1[0],p1[1]);   // Move pen to center
		ctx.lineTo(p2[0],p2[1]);
		ctx.closePath();


		ctx.lineWidth = 5;//0.02*Math.min(x,y)
		ctx.fillStyle = color
		ctx.strokeStyle = color;// !!!
		ctx.setLineDash([10*scale,20*scale])
		ctx.stroke();
	} 
	ctx.save();
	if(typeof(props.LaylineBoat) != 'undefined' && props.LaylineBoat==true && intersections != null)
	{
		// Layline vom Boot:
		// BB
		p1=self.lonLatToPixel(intersections.Boat.BB.P1._lon,intersections.Boat.BB.P1._lat);
		p2=self.lonLatToPixel(intersections.Boat.BB.P2._lon,intersections.Boat.BB.P2._lat);
		DrawLine(p1,p2,((props.LLBB-TWD)+540)%360-180 < 0 ? "rgb(0,255,0)":"red");
		// SB
		p1=self.lonLatToPixel(intersections.Boat.SB.P1._lon,intersections.Boat.SB.P1._lat);
		p2=self.lonLatToPixel(intersections.Boat.SB.P2._lon,intersections.Boat.SB.P2._lat);
		DrawLine(p1,p2,((props.LLSB-TWD)+540)%360-180 < 0 ? "rgb(0,255,0)":"red");
	}
	if(typeof(props.LaylineWP) != 'undefined' && props.LaylineWP==true && intersections != null)
	{
		// Layline vom Wegpunkt:
		// BB
		p1=self.lonLatToPixel(intersections.WP.BB.P1._lon,intersections.WP.BB.P1._lat);
		p2=self.lonLatToPixel(intersections.WP.BB.P2._lon,intersections.WP.BB.P2._lat);
		DrawLine(p1,p2,((props.LLBB-TWD)+540)%360-180 > 0  ? "rgb(0,255,0)":"red");
		// SB
		p1=self.lonLatToPixel(intersections.WP.SB.P1._lon,intersections.WP.SB.P1._lat);
		p2=self.lonLatToPixel(intersections.WP.SB.P2._lon,intersections.WP.SB.P2._lat);
		DrawLine(p1,p2,((props.LLSB-TWD)+540)%360-180 > 0  ? "rgb(0,255,0)":"red");

	}
	ctx.restore()
}


let DrawLaylineArea=function(ctx, radius, angle,TWD_Abweichung, color) {

	// TWA und LL-angle auf pos bereich umrechnen
	// wenn TWD+360 > LL-angle+360 -> grün sonst -> rot
	ctx.save();
	var radius = 0.9*radius	//0.45*Math.min(x,y)
																									ctx.rotate((angle / 180) * Math.PI)

																									// Laylines
	ctx.beginPath();
	ctx.moveTo(0, 0);   // Move pen to center
	ctx.lineTo(0, -radius);
	ctx.closePath();

	ctx.lineWidth = 5;//0.02*Math.min(x,y)
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	let dashes=radius/4
	ctx.setLineDash([Math.floor(0.5*dashes), Math.floor(0.5*dashes)])	//0.1*Math.min(x,y), 0.1*Math.min(x,y)]);
	ctx.stroke();

	// Areas	
	ctx.globalAlpha *= 0.3;
	ctx.beginPath();
	ctx.moveTo(0, 0);   // Move pen to center
	ctx.arc(0, 0, radius, Math.PI * (TWD_Abweichung[0] - 90) / 180, Math.PI * (TWD_Abweichung[1] - 90) / 180)
																													ctx.closePath();

	ctx.fillStyle = color;
	ctx.fill()
																									ctx.restore()
}


let DrawCourseBox=function(ctx, radius,angle, color, Text) {
	ctx.save();
	ctx.rotate((angle / 180) * Math.PI)


	let roundRect=function(x, y, w, h, radius)
	{
		var r = x + w;
		var b = y + h;
		ctx.beginPath();
		ctx.strokeStyle="black";
		ctx.lineWidth="4";
		ctx.moveTo(x+radius, y);
		ctx.lineTo(r-radius, y);
		ctx.quadraticCurveTo(r, y, r, y+radius);
		ctx.lineTo(r, y+h-radius);
		ctx.quadraticCurveTo(r, b, r-radius, b);
		ctx.lineTo(x+radius, b);
		ctx.quadraticCurveTo(x, b, x, b-radius);
		ctx.lineTo(x, y+radius);
		ctx.quadraticCurveTo(x, y, x+radius, y);
		ctx.stroke();
	}
	let Muster="888"
			ctx.font = "bold "+radius/5+"px Arial";
	metrics = ctx.measureText(Muster);
	w=metrics.width
	h=(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
	roundRect(-1.2*w/2, -radius-1.2*h/2, 1.2*w, 1.2*h, 0.1*radius/4);
	ctx.fillStyle = "rgb(255,255,255)";
	ctx.fill();
	ctx.textAlign = "center";
	ctx.font = "bold "+radius/5+"px Arial";
	ctx.fillStyle = "rgb(0,0,0)";
	ctx.fillText(Text, 0, -radius+h/2);
	ctx.restore();

}

let DrawEierUhr=function(ctx, radius,angle, color, Text) {
	ctx.save();

	var radius_kompassring = radius	//0.525*Math.min(x,y);
	var radius_outer_ring = radius *1.3//= 0.65*Math.min(x,y);
	var thickness = radius/4;

	ctx.rotate((angle / 180) * Math.PI)
	let lx=-0.4*thickness
	let rx=+0.4*thickness
	let topy=-radius+0.9*thickness
	let boty=-radius-0.9*thickness
	ctx.beginPath();
	ctx.moveTo(lx, boty); // move to bottom left corner
	ctx.lineTo(rx, topy); // line to top right corner
	ctx.lineTo(lx, topy); // line to top left corner
	ctx.lineTo(rx, boty); // line to bottom right corner
	//ctx.lineTo(lx, boty); // line to bottom left corner
	ctx.closePath()
	ctx.fillStyle = color;
	ctx.lineWidth = 0.05*thickness;
	ctx.strokeStyle = color;
	ctx.fill();
	ctx.strokeStyle = "rgb(0,0,0)";
	ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';

	ctx.restore();

}



let DrawWindpfeilIcon=function(ctx, radius,angle, color, Text) {
	ctx.save();

	var radius_kompassring = radius	//0.525*Math.min(x,y);
	var radius_outer_ring = radius *1.3//= 0.65*Math.min(x,y);
	var thickness = radius/4;

	ctx.rotate((angle / 180) * Math.PI)

																													ctx.beginPath();
	if (Text == 'A')
		ctx.moveTo(0, -radius_kompassring + 0.75*thickness); // Move pen to bottom-center corner
	else
		ctx.moveTo(0, -radius_kompassring - 0.5*thickness); // Move pen to bottom-center corner
	ctx.lineTo(-0.75*thickness, -radius_outer_ring-thickness); // Line to top left corner
		ctx.lineTo(+0.75*thickness, -radius_outer_ring-thickness); // Line to top-right corner
	ctx.closePath(); // Line to bottom-center corner
		ctx.fillStyle = color;
	ctx.lineWidth = 0.05*thickness;
	ctx.strokeStyle = color;
	ctx.fill();
	ctx.strokeStyle = "rgb(0,0,0)";
	ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';

	ctx.fillStyle = "rgb(255,255,255)";
	ctx.textAlign = "center";
	ctx.font = "bold "+radius/4+"px Arial";
	ctx.fillText(Text, 0, -radius_outer_ring);
	ctx.restore();

}




let DrawOuterRing=function(ctx,radius, angle){
	ctx.save();
	ctx.rotate((angle / 180) * Math.PI)

																									var thickness = 0.2*radius
	radius*=1.25
	var someColors = [];
	someColors.push("#0F0");
	someColors.push("#000");
	someColors.push("#F00");

	drawMultiRadiantCircle(0, 0, radius, thickness, someColors);

	function drawMultiRadiantCircle(xc, yc, r, thickness, radientColors) 
	{
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
			ctx.moveTo(0, -radius+0.9*thickness/2); // Move the pen to (30, 50)
			ctx.lineTo(0, -radius-0.9*thickness/2); // Draw a line to (150, 100)
			ctx.lineWidth = 0.1*thickness;
			ctx.strokeStyle = "rgb(255,255,255)";
			ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';
		} else {
			ctx.beginPath();
			ctx.fillStyle = "rgb(190,190,190)";
			ctx.arc(0, -radius, 0.1*thickness, 0, 2 * Math.PI, false);
			ctx.fill();
			ctx.lineWidth = 0.05*thickness;
			ctx.strokeStyle = "rgb(190,190,190)";
			ctx.stroke();
		}
		ctx.restore();
	}
	ctx.restore();
} //Ende OuterRing

let DrawKompassring=function(ctx,radius, angle) {
	ctx.save();
	ctx.rotate((angle / 180) * Math.PI)
																									var thickness = 0.2*radius//1*Math.min(x,y)
																									ctx.beginPath();
	var fontsize=Math.round( radius/100*12 )
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
			ctx.font =  `bold ${fontsize}px Arial`;
			ctx.fillText(i.toString().padStart(3, "0"), 0, -radius + thickness/4);
		} else {
			ctx.beginPath();
			ctx.fillStyle = "rgb(100,100,100)";
			ctx.arc(0, -radius, 0.1*thickness, 0, 2 * Math.PI, false);
			ctx.fill();
			ctx.lineWidth = 0.05*thickness;
			ctx.strokeStyle = "rgb(100,100,100)";
			ctx.stroke();
		}
		ctx.restore();
	}
	ctx.restore();
} // Ende Kompassring



class polar
{
	constructor(r, alpha) {
		this.r = r;
		this.alpha = alpha;
	}
	toKartesisch()
	{
		let K = {};
		K['x'] = this.r*Math.cos((this.alpha * Math.PI) / 180);
        K['y'] = this.r*Math.sin((this.alpha * Math.PI) / 180);
        return(K);
	}    
}

class kartesisch
{
	constructor(x, y)  // [alpha in deg] 
	{
		this.x=x
		this.y=y
	}
	toPolar()
	{
		return(180 * Math.atan2(this.y, this.x) / Math.PI)
	}
}







let calcTrueWind=function(gpsdata)
{

	//# https://www.rainerstumpe.de/HTML/wind02.html
	//# https://www.segeln-forum.de/board1-rund-ums-segeln/board4-seemannschaft/46849-frage-zu-windberechnung/#post1263721      


	if(typeof(gpsdata['course']) != 'undefined' &&  typeof(gpsdata['windAngle']) != 'undefined')
	{
		gpsdata['AWA']=gpsdata['windAngle']
		gpsdata['AWS']=gpsdata['windSpeed']

		{
			gpsdata['AWD'] = (gpsdata['AWA'] + gpsdata['course']) % 360
			KaW = new polar(gpsdata['AWS'], gpsdata['AWD']).toKartesisch()
            KaB = new polar(gpsdata['speed'], gpsdata['course']).toKartesisch()

            if(gpsdata['speed'] == 0 || gpsdata['AWS'] == 0)
            	gpsdata['TWD'] = gpsdata['AWD'] 
            else
            	gpsdata['TWD'] = new kartesisch(KaW['x'] - KaB['x'], KaW['y'] - KaB['y']).toPolar() % 360
			gpsdata['TWS'] = Math.sqrt((KaW['x'] - KaB['x']) * (KaW['x'] - KaB['x']) + (KaW['y'] - KaB['y']) * (KaW['y'] - KaB['y']))

            gpsdata['TWA'] = gpsdata['TWD'] - gpsdata['course']
            return true;
            }
	}
}
