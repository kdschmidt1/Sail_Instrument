console.log("layline plugin loaded");

sailsteerImageCanvasSource={};


//       		window.localStorage.setItem('kds',mycanvasFunction)
            let widgetParameters = {
				formatterParameters: false,
            };

var TWD_Abweichung = [0,0]
var old_time=performance.now()
var ln0_1=Math.log(0.1)
var widget={

    name:"LaylineWidget",
    /**
     * a function that will render the HTML content of the widget
     * normally it should return a div with the class widgetData
     * but basically you are free
     * If you return null, the widget will not be visible any more.
     * @param props
     * @returns {string}
     */

	initFunction:function(a,b)
	{
		var t=0;
		
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
	/* Fügt die storeKeys zum sailsteerImageCanvasSource hinzu */
	sailsteerImageCanvasSource.storeKeys=props;
	sailsteerImageCanvasSource.refresh();
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
      myValue: 'nav.gps.test', //stored at the server side with gps.test
		AWA:'nav.gps.AWA',
		AWD:'nav.gps.AWD',
		TWA:'nav.gps.TWA',
		TWD:'nav.gps.TWD',
		TSS:'nav.gps.TSS',
		LLSB:'nav.gps.LLSB',
		LLBB:'nav.gps.LLBB',
		valid:'nav.gps.valid',
		boatposition: 'nav.gps.position',
		WPposition:'nav.wp.position',
		},
    caption: "Laylines",
    unit: "",
};
avnav.api.registerWidget(widget, widgetParameters);

/**
 * a widget that demonstrates how a widget from a plugin can interact with the python part
 * the widget will display the number of received nmea records
 * with a reset button the counter in the plugin at the python side can be reset
 *
 */
var widgetServer={
    name:"testPlugin_ServerWidget",
    /**
     * if our plugin would like to use event handlers (like button click)
     * we need to register handler functions
     * this can be done at any time - but for performance reasons this should be done
     * inside an init function
     * @param context - the context - this is an object being the "this" for all other function calls
     *                  there is an empty eventHandler object in this context.
     *                  we need to register a function for every event handler we would like to use
     *                  later in renderHtml
     */
    initFunction:function(context){
        /**
         * each event handler we register will get the event as parameter
         * when being called, this is pointing to the context (not the event target - this can be obtained by ev.target)
         * in this example we issue a request to the python side of the plugin using the
         * global variable AVNAV_BASE_URL+"/api" and appending a further url
         * We expect the response to be json
         * @param ev
         */
        context.requestRunning=undefined;
    },
    /**
     * a function that will render the HTML content of the widget
     * normally it should return a div with the class widgetData
     * but basically you are free
     * If you return null, the widget will not be visible any more.
     * @param props
     * @returns {string}
     */
    renderHtml:function(props){
        /**
         * in our html below we assign an event handler to the button
         * just be careful: this is not a strict W3C conforming HTML syntax:
         * the event handler is not directly js code but only the name(!) of the registered event handler.
         * it must be one of the names we have registered at the context.eventHandler in our init function
         * Unknown handlers or pure java script code will be silently ignored!
         */
        var buttonClass="reset";
        //as we are not sure if the browser supports template strings we use the AvNav helper for that...
        var replacements={
            myValue:props.myValue,
            buttonClass: buttonClass,
            disabled: this.requestRunning?"disabled":""
        };
        var template='<div class="widgetData">' +
            '<button class="${buttonClass}" ${disabled}  onclick="buttonClick">Reset</button>' +
            '<div class="server">${myValue}</div></div>';
        return avnav.api.templateReplace(template,replacements);
    },
    /**
     * the access to the internal store
     * this should be an object where the keys are the names you would like to
     * see as properties when your render functions are called
     * whenever one of the values in the store is changing, your render functions will be called
     */
    storeKeys:{
        myValue: 'nav.gps.test' //stored at the server side with gps.test

    },
    caption: "Server Nmea Requests",
    unit: ""
};

//avnav.api.registerWidget(widgetServer);
//avnav.api.log("testPlugin widgets registered");
