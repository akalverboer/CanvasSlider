//==========================================================================
// CANVAS RANGE SLIDER CONTROL
// A pure Javascript Range Slider plugin, no dependencies required.
// Slider is implemented on a CANVAS element (sliding over pixels)
// All values of the slider are measured in pixels.
// The pixel range is transformed to the range the user has chosen.
// License: MIT 2020 Arthur Kalverboer
//==========================================================================

'use strict';
 
(function () {
   // CanvasSlider calls PixelSlider 

   var PIXSLD = function (iConf) {
     // Input parm is an object with required attribute for canvas reference (id or el).
     // All other properties are optional with default value.
     var thisSlider = this;  // global

     // If the canvas width is changed, the slider is scaled automatically horizontally.
     // This comes because we make the width properties of the drawing dependent of canvas.width.
     // If the canvas height is changed, no scaling: only more space on the canvas.
     // To implement the scaling, we define a drawing unit for width and height.
     // We make our design on a canvas with dimensions 600x80. One unit is 1px. Called by: this.ux and this.uy
     Object.defineProperty(this, 'ux', { get: function() { return this.canvas.width/600;  } });
     Object.defineProperty(this, 'uy', { get: function() { return 1;  } });  // CONSTANT UNIT
     ////Object.defineProperty(this, 'uy', { get: function() { return this.canvas.height/80;  } });
     ////Object.defineProperty(this, 'ux', { get: function() { return 1;  } });

     this.conf = {};
     this.conf.canvas = null;    // id or element  REQUIRED 
     this.conf.range = [0,100];  // array of real values; at least first/last but also tick values
     this.conf.start = [0, 0];   // set start values (= number of handles) 
     this.conf.handle = {shape: "rectangle", w: 20, h: 20, hue: null};  // shape: rectangle or ellipse, hue: number [0,360] 
     this.conf.format = {decimals: 0, prefix: "", suffix: ""};  // Simple number formatting
     this.conf.baseColor = {h: 207, s: 60, v: 100};  // Defines color scheme. Valid HSV color.
     // The following config properties can also be updated on the fly.
     this.conf.disabled = false;    // disable mouse 
     this.conf.onChange = null;     // Event fired if slider value changed  (parm: index, realValue)
     this.conf.onDragStart = null;  // Event fired if handle is start dragging (parm: index, realValue)
     this.conf.onDragEnd = null;    // Event fired if handle is stopped dragging (parm: index, realValue)
     this.conf.onMouseDown = null;  // Event fired if mouseclick moved down on slider track or handle
     this.conf.onMouseUp = null;    // Event fired if mouseclick moved up after mouseclick down
     this.conf.snapToTicks = false; // Handle positioned on tick values. Array conf.range used. 
     this.conf.showLabels = true;   // Show labels. If snapToTicks==true then show tick labels and markers. 
     this.conf.showMajorTicks = true;   // Show major ticks.
     this.conf.showMinorTicks = true;   // Show minor ticks if showMajorTicks == true 
     this.conf.showToolTip = true;      // boolean 
     this.conf.showValueBox = false;    // boolean 

     // System properties
     this.numWidth = 30;   // Max width for display number (px)
     this.euroSign = "€";  // Euro currency symbol

     // OBJECT DEFINITIONS
     this.canvas = null;  // HTML element
     this.ctx = null;

     // USER DEFINED RANGE
     this.re = {};  // Real values are FLOATS. Function "remap" for conversion slider values pix <-> real
     this.re.rmin = 0;
     this.re.rmax = 100;

     this.track = new (function() {
       // A slider is in concept a line from point a to point b with one or more points c at this line.
       // The track represents this line. It is drawn as a rectangle.
       // The track records the values of the slider along the width of the track.
       // Draw function. Partitioning of the track to highlight parts.
       var _this = this;
       this.x = 40; this.y = 100; this.w = 500; this.h = 14; // SEE INIT(). Dimensions of track (px).
       this.values = [];   // Array of slider values. Often 1 or 2 values, but there is no limit. Input from outside 

       Object.defineProperty(this, 'xmin', { get: function() { return this.x; } });
       Object.defineProperty(this, 'xmax', { get: function() { return (this.x + this.w); } });
       Object.defineProperty(this, 'len', { get: function() { return this.values.length; } });

       this.fillColor = "#EAEAEA"; 
       this.highlightColor = "#3FB8AF";
       this.highlightGradient = {stop1: "#4CE6D8", stop2: "#369B93"};
       this.strokeColor = "#000";

       this.getValue = function (idx) {
          // Return pixel slider value with given index: this.values[idx]
          // Neg idx allowed: -1 >> last
          var val = this.values.slice(idx)[0]; 
          return val;
       }  // getValue()

       this.setValue = function (idx, val) {
          // Set pixel slider value with given index. Neg index NOT allowed
          // Monitor SORTING of values and correct if needed.
          if (idx < 0 || idx >= this.len) {console.log("Error index track.setValue"); return 0;}
          var val2 = val;
          var arr = this.rangeArray();
          var minVal = arr[idx][0];   var maxVal = arr[idx][2];  // Limits for handler with index idx
          if (val2 < minVal) val2 = minVal;
          if (val2 > maxVal) val2 = maxVal;

          this.values[idx] = val2;
          thisSlider.onChangePixValue(idx, val2);  // run callback
          return 0;
       }  // setValue()

       this.rangeArray = function() {
          // Array of ranges of each value (handle) used to keep increasing order.
          // Element of resulting array is array [min, value, max]
          var rangeArr = new Array(this.values.length);
          var arr = this.trackArray();  // VALUES WITH MIN/MAX
          var idx = 0;
          for (var j=1; j < arr.length - 1; j++ ) {
             rangeArr[idx] = [arr[j-1], arr[j], arr[j+1]];
             idx++;
          }
          return rangeArr;
       }  // rangeArray()

       this.trackArray = function() {
          // Array of VALUES extended with MIN/MAX 
          var arr = [];  // Length: values.length + 2
          arr.push(this.xmin);
          arr.push(...this.values);  // spread operator
          arr.push(this.xmax);
          return arr;
       }  // trackArray()

       this.contains = function(iPoint) {
          var rect = {x: this.x, y: this.y, w: this.w, h: this.h};
          return pointInRect(rect, iPoint);
       }  // contains()

       this.createSections = function() {
          // Partition the track into rectangles positioned between slider values.  nouislider term: connects
          var Section = {x: _this.x, y: _this.y, w: _this.w, h: _this.h, highlight: false};
          var arr = this.trackArray();

          var sections = new Array(this.values.length + 1);
          for (var j=0; j < arr.length - 1; j++ ) {
             var section = Object.create(Section);
             section.x = arr[j];
             section.w = arr[j+1] - arr[j];
             if (j % 2 == 0) section.highlight = true;  // if even: highlight
             sections[j] = section;
          }
          return sections;
       }  // createSections()

       this.draw = function(ctx) {
          ctx.fillStyle = this.fillColor;
          ctx.strokeStyle = this.strokeColor;
          ctx.lineWidth = 1; var dx = 0.5; var dy = 0.5; // sharp line/border
          ctx.roundRect(this.x+dx, this.y+dy, this.w, this.h, 3).fill();
          ctx.roundRect(this.x+dx, this.y+dy, this.w, this.h, 3).stroke();
          //////drawRect(ctx, this.x+dx, this.y+dy, this.w, this.h);
          // Draw sections (with highlights)
          ctx.lineWidth = 1;
          var sect = this.createSections();
          for (var j=0; j < sect.length; j++ ) {
             if (sect[j].highlight == true) {
                var grd = ctx.createLinearGradient(0,sect[j].y+dy,0,sect[j].y+dy + sect[j].h); // vertical gradient
                grd.addColorStop(0,this.highlightGradient.stop1);
                grd.addColorStop(1,this.highlightGradient.stop2);
                ctx.fillStyle = grd;
                //  ctx.fillStyle = this.highlightColor;
                ctx.roundRect(sect[j].x+dx, sect[j].y+dy, sect[j].w, sect[j].h, 3).fill();
             }
          }
          return 0;
       }
       return this;
     })();  // === TRACK ===

     // === METHODS ===
     this.init = function () {
        // At init: override default conf by user parms
        for (var i in this.conf) { if (iConf.hasOwnProperty(i)) this.conf[i] = iConf[i]; } 

        if (typeof this.conf.canvas === 'object') this.canvas = this.conf.canvas;
        else this.canvas = document.getElementById(this.conf.canvas.replace('#', ''));

        if (!this.canvas) return console.log('Cannot find canvas element...');  // STOP
        // The width attribute of canvas element defaults to 300, and the height attribute defaults to 150.
        // DO NOT USE CSS (stylesheet) TO SET WIDTH

        //this.canvas.width = 600;   // TEST
        //this.canvas.height = 80;   // TEST
        this.ctx = this.canvas.getContext("2d");

        if (this.conf.range.length < 2) this.conf.range = [0,100];
        if (this.conf.start.length == 0) this.conf.start = [0];
        if (!this.conf.format.hasOwnProperty("decimals")) this.conf.format.decimals = 0;
        if (!this.conf.format.hasOwnProperty("prefix")) this.conf.format.prefix = "";
        if (!this.conf.format.hasOwnProperty("suffix")) this.conf.format.suffix = "";

        this.setColors();

        this.track.x = 30*this.ux;   // 0.05 * this.canvas.width;   // 30;
        this.track.w = 600*this.ux - 2*this.track.x;   //this.canvas.width - 2*this.track.x;
        this.track.h = 14*this.uy;  // 0.17*this.canvas.height;   // 14;
        this.track.y = parseInt(this.canvas.height / 2) - this.track.h/2 - 2;  // Verticale aligned MID
        this.track.fillColor = this.color.track.fill;
        this.track.highlightColor = this.color.track.highlight;
        this.track.highlightGradient = this.color.track.highlightGradient;
        this.track.strokeColor = this.color.track.stroke;

        this.re.rmin = this.conf.range[0];
        this.re.rmax = this.conf.range[this.conf.range.length -1];
        this.initSliderValues();

        this.sH = [];  // HANDLERS
        for (var j=0; j < this.track.values.length; j++ ) {
           var sH = Object.create(Handle);
           sH.shape = (this.conf.handle.hasOwnProperty("shape")) ? this.conf.handle.shape : "rectangle";  // user defined
           sH.w = (this.conf.handle.hasOwnProperty("w")) ? this.conf.handle.w : 20;  // user defined
           sH.h = (this.conf.handle.hasOwnProperty("h")) ? this.conf.handle.h : 20;  // user defined
           sH.fill = this.color.handle.fill;
           sH.fillDrag = this.color.handle.fillDrag
           sH.fillGradient = this.color.handle.fillGradient;
           sH.stroke = this.color.handle.stroke;

           sH.x = this.track.values[j] - sH.w/2;
           sH.y = this.track.y - (sH.h - this.track.h)/2;
           this.sH.push(sH);
        }

        var d = this.conf.format.decimals;
        var prefix = this.conf.format.prefix;
        var suffix = this.conf.format.suffix;
        this.toolTips = [];  // TOOLTIPS (above track)
        for (var j=0; j < this.track.values.length; j++ ) {
           var toolTip = Object.create(ValueBox);
           toolTip.fill = this.color.toolTip.fill;
           toolTip.stroke = this.color.toolTip.stroke;
           toolTip.visible = (this.conf.showToolTip == true);
           toolTip.w = 42*this.ux;  //0.07*this.canvas.width;
           toolTip.h = 20*this.uy;  // 0.24*this.canvas.height;
           toolTip.x = this.track.values[j] - toolTip.w/2;
           var h28 = 28*this.uy;   //0.32*this.canvas.height;
           toolTip.y = this.track.y - h28;
           toolTip.text = prefix + this.pixToReal(this.track.values[j]).toFixed(d) + suffix;
           this.toolTips.push(toolTip);
        }

        this.valueBoxes = [];  // VALUEBOXES (max. 2; left/right to track)
        for (var j=0; j < this.track.values.length; j++ ) {
           var valueBox = Object.create(ValueBox);
           valueBox.fill = null;      // NO FILL    this.color.valueBox.fill;
           valueBox.stroke = null;    // NO STROKE  this.color.valueBox.stroke;
           valueBox.visible = (this.conf.showValueBox == true);
           valueBox.w = 26*this.ux; 
           valueBox.h = 20*this.uy; 
           valueBox.y = this.track.y - 4*this.uy;
           if (j==0) {
             valueBox.x = 2*this.ux;
             valueBox.text = prefix + this.pixToReal(this.track.values[j]).toFixed(d) + suffix;
             this.valueBoxes.push(valueBox);
           }
           if (j==1) {
             valueBox.x = this.track.x + this.track.w + 2;
             valueBox.text = prefix + this.pixToReal(this.track.values[j]).toFixed(d) + suffix;
             this.valueBoxes.push(valueBox);
           }
           if (j>1) break;
        }

        this.initEventListener();  // Init events for mouse actions

        this.redraw();

        return 0;
     }  // init()

     this.setColors = function() { 
        var baseColor = this.conf.baseColor;
        //var baseColor = {h: 170, s: 60, v: 100};  // TEST
        var hue = (baseColor.hasOwnProperty("h")) ? baseColor.h : 0;
        var sat = (baseColor.hasOwnProperty("s")) ? baseColor.s : 0;
        var val = (baseColor.hasOwnProperty("v")) ? baseColor.v : 0;

        var hue_han = (this.conf.handle.hasOwnProperty("hue")) ? this.conf.handle.hue : null;
        var hue_han_auto = Math.abs(hue + 15) % 361;
        var hue_han = (hue_han == null) ? hue_han_auto : hue_han;
        var hue_han = (Math.abs(hue_han) % 361);

        this.color = {track: {}, handle: {}, toolTip: {}, valueBox: {}, tick:{} };
        this.color.track.fill = new Color( [hue, 0.02*sat, 0.2*val+80] ).hex; 
        this.color.track.highlight = new Color( [hue, 0.7*sat, 0.3*val+50] ).hex;
        this.color.track.highlightGradient = {}; 
        this.color.track.highlightGradient.stop1 = new Color( [hue, 0.5*sat+30, 0.1*val+90] ).hex;
        this.color.track.highlightGradient.stop2 = new Color( [hue, 0.5*sat+30, 0.3*val+30] ).hex; 
        this.color.track.stroke = new Color( [hue, 1.0*sat, 0.3*val+10] ).hex; 
        this.color.handle.fill = new Color( [0.9*hue, 0.7*sat, 0.3*val+50] ).hex; 
        this.color.handle.fillDrag = new Color( [hue, 0.02*sat, 0.2*val+80] ).hex; 
        this.color.handle.fillGradient = {};
        this.color.handle.fillGradient.stop1 = new Color( [hue_han, 0.3*sat+30, 0.1*val+90] ).hex;
        this.color.handle.fillGradient.stop2 = new Color( [hue_han, 0.3*sat+30, 0.3*val+30] ).hex; 
        this.color.handle.stroke = new Color( [hue_han, sat, 0.3*val+10] ).hex; 
        this.color.toolTip.fill = new Color( [hue, 0.02*sat, 0.2*val+80] ).hex; 
        this.color.toolTip.stroke = new Color( [hue, sat, 0.3*val+10] ).hex; 
        this.color.valueBox.fill = new Color( [hue, 0.02*sat, 0.2*val+80] ).hex; 
        this.color.valueBox.stroke = new Color( [hue, sat, 0.3*val+10] ).hex; 
        this.color.tick.stroke = new Color( [hue, sat, 0.3*val+10] ).hex;
        return 0;
     }  // setColors()

     this.pixToReal = function(iPixVal) { 
        // Convert pixel value to real value
        // Pixel values and real values are floats
        var realVal = remap(iPixVal, this.track.xmin, this.track.xmax, this.re.rmin, this.re.rmax); 
        //console.log("REMAP pixToReal", iPixVal, realVal);
        return realVal;
     }  // pixToReal()

     this.realToPix = function(iRealVal) {
        // Convert real value to pixel value
        // Pixel values and real values are floats
        var pixVal = remap(iRealVal, this.re.rmin, this.re.rmax, this.track.xmin, this.track.xmax);
        //console.log("REMAP pixToReal", iRealVal, pixVal);
        return pixVal;
     }  // realToPix()

     this.onChangePixValue = function(idx, pxVal) {
        // Define callback called when track.values changed.
        //console.log("CALLBACK 2 ", idx, pxVal);
        var d = this.conf.format.decimals;
        var prefix = this.conf.format.prefix;
        var suffix = this.conf.format.suffix;
        var h28 = 28*this.uy;   //0.32*this.canvas.height;
        thisSlider.toolTips[idx].x = pxVal - thisSlider.toolTips[idx].w/2;
        thisSlider.toolTips[idx].y = thisSlider.track.y - h28;
        thisSlider.toolTips[idx].text = prefix + this.pixToReal(pxVal).toFixed(d) + suffix;

        if (idx==0 || idx==1) {
           thisSlider.valueBoxes[idx].text = prefix + this.pixToReal(pxVal).toFixed(d) + suffix;
        }

        thisSlider.sH[idx].x = pxVal - thisSlider.sH[idx].w/2;

        // Call user defined callback
        if (thisSlider.conf.onChange && typeof thisSlider.conf.onChange === 'function') {
           var realVal = this.pixToReal(pxVal);
           thisSlider.conf.onChange(idx, realVal);
        }
        return 0;
     }  // onChangePixValue()


     this.redraw = function () {
        // redraw the canvas

        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (false) {
           // Draw canvas border and background TEST
           this.ctx.strokeStyle = "#333";
           this.ctx.fillStyle = "#FAF7F8";
           this.ctx.lineWidth = 2;
           this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height); // BETTER: use stylesheet
           this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);   // BETTER: use stylesheet
        }

        // Draw sliderTrack
        this.track.draw(this.ctx);

        // Draw sliderHandles
        for (var idx=0; idx < this.track.values.length; idx++ ) {
           this.sH[idx].draw(this.ctx);
        }

        // Draw toolTips/valueBoxes
        for (var idx=0; idx < this.track.values.length; idx++ ) {
           if (idx==0 || idx==1) {
             this.valueBoxes[idx].visible = this.conf.showValueBox;
             this.valueBoxes[idx].draw(this.ctx);
           }
           this.toolTips[idx].visible = this.conf.showToolTip;
           this.toolTips[idx].draw(this.ctx);
        }

        this.drawTickLabels(this.ctx, this.color.tick.stroke);
        this.drawMinMaxLabels(this.ctx);

        this.ctx.restore();
        return 0;
     }  // redraw()

     this.getSliderValue = function(idx) {
        var pxVal = this.track.getValue(idx);
        var realVal = this.pixToReal(pxVal);
        return realVal;
     }  // getSliderValue()

     this.setSliderValue = function(i, realVal) {
        var realVal2 = crop(realVal, this.re.rmin, this.re.rmax);  // update if too small/large
        var pxVal = this.realToPix(realVal2);
        var pxVal2 = this.snapPixToTick(pxVal);
        this.track.setValue(i, pxVal2);  // WITH CALLBACK
        return 0;
     }  // setSliderValue()

     this.initSliderValues = function() {
        this.track.values = Array(this.conf.start.length).fill(this.track.xmin);
        for (var j=0; j < this.conf.start.length; j++ ) {
           var realVal = this.conf.start[j];
           var realVal2 = crop(realVal, this.re.rmin, this.re.rmax);  // update if too small/large
           var pxVal = this.realToPix(realVal2);
           var pxVal2 = this.snapPixToTick(pxVal);
           this.track.values[j] = pxVal2;  // NO CALLBACK. 
        }
        //console.log("INIT VALUES 2", this.track.values);
        return 0;
     }  // initSliderValues()

     this.snapPixToTick = function(pxVal) {
        //console.log("SNAPTOTICK", this.conf.snapToTicks);
        if (!this.conf.snapToTicks) return pxVal;  // NOTHING TO DO
        var realVal = this.pixToReal(pxVal);
        var realVal2 = snapFromTickvalues(realVal, this.conf.range);
        var pxVal2 = this.realToPix(realVal2);
        return pxVal2;
     }  // snapPixToTick()

     this.drawMinMaxLabels = function(ctx) {
        if (!(this.conf.showLabels && !this.conf.showMajorTicks)) { return 0; }   // HIDE
        var d = this.conf.format.decimals;
        var prefix = this.conf.format.prefix;
        var suffix = this.conf.format.suffix;
        ctx.font = "11px Verdana";
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        var h28 = 28*this.uy; 
        var x10 = 10*this.ux; 
        var strMin = prefix + this.re.rmin.toFixed(d) + suffix;
        var strMax = prefix + this.re.rmax.toFixed(d) + suffix;
        ctx.fillText(strMin, this.track.xmin+x10, this.track.y+h28, this.numWidth);  // first label
        ctx.fillText(strMax, this.track.xmax-x10, this.track.y+h28, this.numWidth);  // last label
        return 0;
     }  // drawMinMaxLabels()

     this.drawTickLabels = function(ctx, strokeColor) {
        if (!this.conf.showMajorTicks) return 0;  // HIDE
        var d = this.conf.format.decimals;
        var prefix = this.conf.format.prefix;
        var suffix = this.conf.format.suffix;
        var dx = 0.5; var dy = 0.5; // sharp lines
        var minorTickSpace = 10;
        ctx.strokeStyle = strokeColor;
        //ctx.fillStyle = "#226660";
        ctx.lineWidth = 1;
        ctx.font = "11px Verdana";
        ctx.textAlign = "center";
        ctx.beginPath();
        var h20 = 20*this.uy; 
        var h24 = 24*this.uy; 
        var h28 = 28*this.uy; 
        var h38 = 38*this.uy; 
        for (var j=0; j < this.conf.range.length; j++ ) {
           var realVal = this.conf.range[j];
           var pxVal = parseInt(this.realToPix(realVal)) + dx;
           ctx.moveTo(pxVal, this.track.y + h20);
           ctx.lineTo(pxVal, this.track.y + h28);
           ctx.stroke(); // tickMarkers
           ctx.fillStyle = "#000";  // TEXT
           if (this.conf.showLabels) {
              var enoughSpace = true;
              if (j == this.conf.range.length-1) {  // LAST
                 var prevPxVal = this.realToPix(this.conf.range[j-1]); 
                 if (pxVal - prevPxVal < 30) {enoughSpace = false; }
              }
              if (enoughSpace) {
                 var str = prefix + realVal.toFixed(d) + suffix;
                 ctx.fillText(str, pxVal.toFixed(0), this.track.y + h38, this.numWidth);  // tickLabels
              }
           }
           // Draw minor ticks
           if (!this.conf.showMinorTicks) continue;  // NEXT ITERATION
           if (j < this.conf.range.length-1) {
              var minorTick = pxVal;
              var nextTick = this.realToPix(this.conf.range[j+1]);
              while (true) {
                 minorTick = minorTick + minorTickSpace;  // pixels
                 if (minorTick >= nextTick) break;
                 ctx.moveTo(minorTick, this.track.y + h20+0.5);
                 ctx.lineTo(minorTick, this.track.y + h24);
              }
           }
        }
        ctx.closePath();
        return 0;
     }  // drawTickLabels()

     this.initEventListener = function() {
        // Listen for mouse events 
        var dragok;
        var startX;  // last mouse position x
        var startY;  // last mouse position y
        var aH = -1;  // Active handler for events: index of handler (-1 if not valid)

        // Mouseup event: not linked to canvas (see later)
        this.canvas.addEventListener('mousedown', onMouseDown, false);
        this.canvas.addEventListener("mousemove", onMouseMove, false);

        function onMouseDown(evt) {
           if (thisSlider.conf.disabled) {console.log("MOUSEDOWN DISABLED"); return 0;} // MOUSE DISABLED
           function mouseDownEvent() {
              window.addEventListener('mouseup', onMouseUp, false);
              if (thisSlider.conf.onMouseDown && typeof thisSlider.conf.onMouseDown === 'function') {
                 thisSlider.conf.onMouseDown();  // CALLBACK 
              }
              return 0;
           }  // mouseDownEvent()

           evt.preventDefault();
           evt.stopPropagation();

           var m = getMousePos(evt);  // get the current mouse position
           if (m == null) { return null; }   // No data

           dragok = false;

           // TEST TO SEE WHERE MOUSE IS CLICKED DOWN
           // If handle clicked, we must take into account overlaying handles.
           // If clicked on overlaying handles: choose handle with largest range.
           var rangeArray = thisSlider.track.rangeArray();
           var maxRange = 0; var maxIdx = -1;
           var handleClicked = false;
           for (var j=0; j < thisSlider.track.values.length; j++ ) {
              if (thisSlider.sH[j].contains(m)) {
                 var range = rangeArray[j][2] - rangeArray[j][0];
                 if (range > maxRange) { maxRange = range; maxIdx = j; }
              }
           }
           if (maxRange > 0) {
                 handleClicked = true;
                 aH = maxIdx;
           }

           var trackClicked = thisSlider.track.contains(m);
           if (handleClicked) {
              // Start dragging
              dragok = true;
              mouseDownEvent();
              // save the current mouse position
              startX = crop(m.x, thisSlider.track.xmin, thisSlider.track.xmax);
              startY = m.y;
           } else if (trackClicked) {
              startX = crop(m.x, thisSlider.track.xmin, thisSlider.track.xmax);
              startY = m.y;
              // Track clicked: choose the handler closest to startX
              var minDist = +Infinity; var minIdx = -1;
              for (var j=0; j < rangeArray.length; j++ ) {
                 if ((startX > rangeArray[j][0]) && (startX < rangeArray[j][2])) {
                    var dist = Math.abs(startX - rangeArray[j][1]);  // dist to handler
                    if (dist < minDist) { minDist = dist; minIdx = j; }
                 }
              }
              if (minIdx >= 0) {
                 aH = minIdx;
                 var startX2 = thisSlider.snapPixToTick(startX);
                 thisSlider.track.setValue(aH, startX2);
                 mouseDownEvent();
              }
           }

           return 0;
        }  // onMouseDown()

        function onMouseUp(evt) {  
           // handle mouseup events
           evt.preventDefault();
           evt.stopPropagation();

           // Remove event to prevent fired by other events of different sliders.
           window.removeEventListener('mouseup', onMouseUp, false);

           // clear all the dragging flags
           if (dragok) {
              dragok = false;  // Dragging stopped
              if (thisSlider.sH[aH].isDragging) { 
                 // Actions on mouseUp 
                 thisSlider.sH[aH].isDragging = false;
                 var startX2 = thisSlider.snapPixToTick(startX);
                 thisSlider.track.setValue(aH, startX2);
                 if (thisSlider.conf.onDragEnd && typeof thisSlider.conf.onDragEnd === 'function') {
                    var realVal = thisSlider.pixToReal(startX2);
                    thisSlider.conf.onDragEnd(aH, realVal);  // CALLBACK
                 }
              }
           }

           if (thisSlider.conf.onMouseUp && typeof thisSlider.conf.onMouseUp === 'function') {
              thisSlider.conf.onMouseUp();  // CALLBACK 
           }

           thisSlider.redraw();
           return 0;
        }  // onMouseUp()

        function onMouseMove(evt) {
           // Handle mouse moves if we're dragging anything...
           if (dragok) {
               var m = getMousePos(evt);  // get the current mouse position
               if (m == null) { return null; }   // No data

               if (thisSlider.sH[aH].isDragging == false) {
                  // Dragging started
                  if (thisSlider.conf.onDragStart && typeof thisSlider.conf.onDragStart === 'function') {
                     var realVal = thisSlider.getSliderValue(aH);
                     thisSlider.conf.onDragStart(aH, realVal);  // CALLBACK with current slider value
                  }
               }

               thisSlider.sH[aH].isDragging = true; 
               evt.preventDefault();
               evt.stopPropagation();

               // Calculate the distance the mouse has moved since the last mousemove
               var dx = m.x - startX;
               var dy = m.y - startY;

               // Move handle that isDragging by the distance the mouse has moved since the last mousemove.
               // dy not used: y fixed (hor move)

               var newVal = +thisSlider.track.getValue(aH) + dx;  // + > force add num
               thisSlider.track.setValue(aH, newVal);

               // redraw the scene with the new positions 
               thisSlider.redraw();

               // reset the starting mouse position for the next mousemove
               startX = crop(m.x, thisSlider.track.xmin, thisSlider.track.xmax);
               startY = m.y;
           }
           return 0;
        }  // onMouseMove()


        function getMousePos(evt) {
           // Returns mouse position 
           // Test if browser does support getBoundingClientRect
           var button = {left: 0, middle: 1, right: 2};
           if (evt.button === button.right) { return null; }    // skip right mouse click
           if (evt.button === button.middle) { return null; }   // skip middle mouse click

           if (!thisSlider.canvas.getBoundingClientRect) { return null; }
           var rect = thisSlider.canvas.getBoundingClientRect();
           var mousePos = {
              x: parseInt(evt.clientX - rect.left),
              y: parseInt(evt.clientY - rect.top)
           };
           //  console.log("MOUSEPOS:", mousePos);
           return mousePos;
        }  // getMousePos()

        return 0;
     }  // === initEventListener ===

     this.init();

     return this;
   } // === PIXSLD() ===

   var Handle = {
      // Rectangle or Ellipse/Circle as sliderHandle
      _x: 0, _y: 0, _w: 40, _h: 10,
      _fill: "green",
      _stroke: "#000",
      _shape: "rectangle",
      get x() {return parseInt(this._x);}, set x(val) {this._x = val;},
      get y() {return parseInt(this._y);}, set y(val) {this._y = val;},
      get w() {return this._w},            set w(val) {this._w = val;},
      get h() {return this._h},            set h(val) {this._h = val;},
      get fill() {return this._fill;},     set fill(val) {this._fill = val;},
      get stroke() {return this._stroke;}, set stroke(val) {this._stroke = val;},
      get shape() {return this._shape;},   set shape(val) {this._shape = val;},
      isDragging: false,
      fillDrag: "#FFF",
      fillGradient: {stop1: "#4CE6D8", stop2: "#369B93"},
      contains: function(iPoint) {
         var rect = {x: this.x, y: this.y, w: this.w, h: this.h};
         return pointInRect(rect, iPoint);
      },
      draw: function(ctx) {
         var dx = 0.5; var dy = 0.5; // sharp border
         ctx.strokeStyle = this.stroke;
         var grd = ctx.createLinearGradient(0,this.y+dy,0,this.y+dy + this.h); // vertical gradient
         grd.addColorStop(0,this.fillGradient.stop1);
         grd.addColorStop(1,this.fillGradient.stop2);
         ctx.fillStyle = grd;
         // ctx.fillStyle = this.fill;
         if (this.isDragging) { ctx.fillStyle = this.fillDrag;}
         if (this.shape == "rectangle") {
            ctx.lineWidth = 1.2; 
            ctx.fillRect(this.x+dx, this.y+dy, this.w, this.h);
            ctx.strokeRect(this.x+dx, this.y+dy, this.w, this.h);
            //ctx.roundRect(this.x+dx, this.y+dy, this.w, this.h, 7).stroke();
         } else {
            ctx.lineWidth = 1.6;
            drawEllipse(ctx, this.x+dx, this.y+dy, this.w/2, this.h/2);
         }
         return 0;
      }
   }  // Handle

   var ValueBox = {
       // Box to display a value (e.g. toolTip)
      _x: 0, _y: 0, _w: 40, _h: 20, r: 2,
      _text: "",
      _visible: true,
      _fill: "#AAA",
      _stroke: "#111",
      get x() {return parseInt(this._x);},   set x(val) {this._x = val; },
      get y() {return parseInt(this._y);},   set y(val) {this._y = val; },
      get w() {return this._w;},             set w(val) {this._w = val; },
      get h() {return this._h;},             set h(val) {this._h = val; },
      get text() {return this._text;},       set text(val) {this._text = val; },
      get visible() {return this._visible;}, set visible(val) {this._visible = val; },
      get fill() {return this._fill;},       set fill(val) {this._fill = val;},
      get stroke() {return this._stroke;},   set stroke(val) {this._stroke = val;},
      draw: function (ctx) {
         if (!this.visible) return 0;  // HIDE
         ctx.lineWidth = 1; var dx = 0.5; var dy = 0.5; // sharp border
         if (this.fill != null) {
            ctx.fillStyle = this.fill;
            ctx.roundRect(this.x+dx, this.y+dy, this.w, this.h, this.r).fill();
         }
         if (this.stroke != null) {
            ctx.strokeStyle = this.stroke;
            ctx.roundRect(this.x+dx, this.y+dy, this.w, this.h, this.r).stroke();
         }
         ctx.font = "12px Verdana";
         ctx.textAlign = "center"; // auto fill
         ctx.fillStyle = "black";
         ctx.fillText(this.text, this.x+this.w/2, this.y+15, this.w-6);
         return 0;
      }
   }  // ValueBox()


   //===============================================================================
   var CANSLD = function(iConf) { 
      // User interface
      var _this = this;  // global
      var pixSlider;
      this.conf = {};
      this.conf.canvas = null;      // canvas id or canvas element Required.
      this.conf.range = [0,100];    // {step: 10};  or: {count: 15} or [0,3,7,9,15,27,100] 
      this.conf.start = [0, 0];             // set start values (= number of handles)
      this.conf.handle = {shape: "rectangle", w: 20, h: 20, hue: null};   // shape of handle 
      this.conf.format = {decimals: 0, prefix: "", suffix: ""};  // Simple number formatting 
      // The following config properties can be updated on the fly.
      this.conf.disabled = false;
      this.conf.onChange = null;      // Event fired if slider value changed (parm: index, value)
      this.conf.onDragStart = null;   // Event fired if handle is start dragging (parm: index, value)
      this.conf.onDragEnd = null;     // Event fired if handle is stopped dragging (parm: index, value)
      this.conf.onMouseDown = null;   // Event fired if mouseclick moved down on slider track or handle
      this.conf.onMouseUp = null;     // Event fired if mouseclick moved up after mouseclick down
      this.conf.snapToTicks = false;  // Handle positioned on tick values. Array conf.range used. 
      this.conf.showLabels = true;    // Show labels. If snapToTicks==true then show tick labels and markers. 
      this.conf.showMajorTicks = true;   // Show major ticks.
      this.conf.showMinorTicks = true;   // Show minor ticks if showMajorTicks == true 
      this.conf.showToolTip = true;      // boolean
      this.conf.showValueBox = false;    // boolean
      this.conf.baseColor = {h: 207, s: 60, v: 100};  // Defines color scheme. Valid HSV color.

      this.init = function() {
         // Override default conf by user settings (iConf)
         for (var i in this.conf) { if (iConf.hasOwnProperty(i)) this.conf[i] = iConf[i]; } 

         var rangeValues = this.createRangeValues();  // update: conf.range
         console.log("RANGE VALUES: ", rangeValues);
         this.conf.start.sort(function(a, b){return a-b});  // sort
         console.log("START VALUES: ", this.conf.start);

         pixSlider = new PIXSLD({
             canvas: this.conf.canvas,
             range: rangeValues,
             start: this.conf.start,
             handle: this.conf.handle,
             format: this.conf.format,
             disabled: this.conf.disabled, 
             onChange: this.conf.onChange,
             onDragStart: this.conf.onDragStart,
             onDragEnd: this.conf.onDragEnd,
             onMouseUp: this.conf.onMouseUp,
             onMouseDown: this.conf.onMouseDown,
             snapToTicks: this.conf.snapToTicks,
             showLabels: this.conf.showLabels,
             showMajorTicks: this.conf.showMajorTicks,
             showMinorTicks: this.conf.showMinorTicks,
             showToolTip: this.conf.showToolTip,
             showValueBox: this.conf.showValueBox,
             baseColor: this.conf.baseColor
         });
         return 0;
      }  // init()

      this.getValue = function(idx) {
         // Returns value of handle with idx
         if (idx==undefined) return undefined;
         return pixSlider.getSliderValue(idx);
      }  // getValue()

      this.setValue = function(i, val) {
         // Function that returns itself!!! Example: this.setValue(1,10)(2,20)(3,30)(4,40)
         if (i==undefined || val == undefined) return 0;
         function setValue(i, val) {
            pixSlider.setSliderValue(i,val);
            //console.log("TEST 1", i, val);
            pixSlider.redraw();
            return setValue;
         }
         setValue(i,val);
         return setValue;
      }  // setValue()

      this.createRangeValues = function() {
         // Create array with range of values depending on user input in iConf
         var values = [0,100];  // default
         var isArray = (this.conf.range instanceof Array);      // Boolean: true if prop 'values' is array
         if (isArray) {
            if (this.conf.range.length < 2) values = [0,100]; else values = this.conf.range;
         }
         if (!isArray) {
            if (this.conf.range.hasOwnProperty("min")) var rmin = this.conf.range.min; else rmin = 0;
            if (this.conf.range.hasOwnProperty("max")) var rmax = this.conf.range.max; else rmax = rmin + 100;
            values = [rmin, rmax];
            if (this.conf.range.hasOwnProperty("step")) values = linSpaceS(rmin, rmax, this.conf.range.step);
            if (this.conf.range.hasOwnProperty("count")) values = linSpaceN(rmin, rmax, this.conf.range.count);
         }
         // Sort array (to be sure of increasing values)
         values.sort(function(a, b){return a-b});
         return values;
      }  // createRangeValues()

      Object.defineProperty(this, 'disabled', {
        set: function(val) { pixSlider.conf.disabled = val; }
      });
      Object.defineProperty(this, 'onChange', {
        set: function(val) { pixSlider.conf.onChange = val; }
      });
      Object.defineProperty(this, 'onDragStart', {
        set: function(val) { pixSlider.conf.onDragStart = val; }
      });
      Object.defineProperty(this, 'onDragEnd', {
        set: function(val) { pixSlider.conf.onDragEnd = val; }
      });
      Object.defineProperty(this, 'onMouseUp', {
        set: function(val) { pixSlider.conf.onMouseUp = val; }
      });
      Object.defineProperty(this, 'onMouseDown', {
        set: function(val) { pixSlider.conf.onMouseDown = val; }
      });
      Object.defineProperty(this, 'snapToTicks', {
        set: function(val) { pixSlider.conf.snapToTicks = val; }
      });
      Object.defineProperty(this, 'showLabels', {
        set: function(val) { pixSlider.conf.showLabels = val; pixSlider.redraw(); }
      });
      Object.defineProperty(this, 'showMajorTicks', {
        set: function(val) { pixSlider.conf.showMajorTicks = val; pixSlider.redraw(); }
      });
      Object.defineProperty(this, 'showMinorTicks', {
        set: function(val) { pixSlider.conf.showMinorTicks = val; pixSlider.redraw(); }
      });
      Object.defineProperty(this, 'showToolTip', {
        set: function(val) { pixSlider.conf.showToolTip = val; pixSlider.redraw(); }
      });
      Object.defineProperty(this, 'showValueBox', {
        set: function(val) { pixSlider.conf.showValueBox = val; pixSlider.redraw(); }
      });

      this.init();
      return this;
   }  // === CANSLD() ===

   window.CanvasSlider = CANSLD;   // External view
   //window.PixelSlider = PIXSLD;  // Hidden
})();
//==================================================================================================

// === GENERAL FUNCTIONS ===
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  // Define path of a single rect with rounded corners
  r = r || 6;  // Radius of corners
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  this.beginPath();
  this.moveTo(x+r, y);
  this.arcTo(x+w, y,   x+w, y+h, r);
  this.arcTo(x+w, y+h, x,   y+h, r);
  this.arcTo(x,   y+h, x,   y,   r);
  this.arcTo(x,   y,   x+w, y,   r);
  this.closePath();
  return this;
} // roundRect()

function drawRect(ctx, x, y, w, h) {
   // Draw a single rect with FILL and STROKE
   ctx.beginPath();
   ctx.rect(x, y, w, h);
   ctx.closePath();
   ctx.fill();
   ctx.stroke();
   return 0;
}  // drawRect()

function drawEllipse(ctx, cx, cy, rx, ry) {
   ctx.save(); // save state
   ctx.beginPath();

   //   ctx.translate(cx-rx, cy-ry);
   ctx.translate(cx, cy);
   ctx.scale(rx, ry);
   ctx.arc(1, 1, 1, 0, 2 * Math.PI, false);
   ctx.closePath();

   ctx.restore(); // restore to original state
   ctx.stroke();
   ctx.fill();
   return 0;
}  // ellipse()

function strokeInset(ctx, x, y, w, h) {
   // Draw a empty rect(x, y, w, h) with INSET STROKE (BORDER)
   ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#825F66";
      ctx.moveTo(x, y); ctx.lineTo(x + w, y);
      ctx.moveTo(x, y); ctx.lineTo(x, y + h);
      ctx.stroke();
   ctx.closePath();
   ctx.beginPath();
      ctx.strokeStyle = "#BF909A";
      ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h);
      ctx.stroke();
   ctx.closePath();
   return 0;
}  // strokeInset()

function pointInRect(rect, point) {
   return point.x >= rect.x && point.x <= rect.x + rect.w &&
          point.y >= rect.y && point.y <= rect.y + rect.h;
}  // pointInRect()

function crop(iVal, a, b) {
   // Crop iVal in range [a,b]
   var val = iVal;
   if (iVal < a) val = a;
   if (iVal > b) val = b;
   return val; 
}  // crop()

function snapFromTickvalues(iVal, iTickValues) {
   // Return value from array iTickValues closest to iVal
   if (iTickValues.length == 0) return iVal;
   if (iVal <= iTickValues[0]) {return iTickValues[0];}
   if (iVal >= iTickValues[iTickValues.length-1]) {return iTickValues[iTickValues.length-1];}
   var d = Infinity;
   for (var j=0; j < iTickValues.length; j++ ) {
      var tick = iTickValues[j];
      if (d > Math.abs(iVal - tick)) {var snapValue = tick; d = Math.abs(iVal - tick)}
   }
   return snapValue; 
}  // snapFromTickvalues()

function remap( x, oMin, oMax, nMin, nMax ) {
   // Convert range of numbers to another, maintaining ratio. Old range >> New range.
   // All values are floats.    remap(x=oMin) = nMin  and  remap(x=oMax) = nMax

   //range check
   if (oMin == oMax) { console.log("Warning: Zero input range"); return None; }
   if (nMin == nMax) { console.log("Warning: Zero output range"); return None; }

   //check reversed input range
   var reverseInput = false;
   var oldMin = Math.min( oMin, oMax );
   var oldMax = Math.max( oMin, oMax );
   if (oldMin != oMin) { reverseInput = true; }

   //check reversed output range
   var reverseOutput = false;  
   var newMin = Math.min( nMin, nMax );
   var newMax = Math.max( nMin, nMax );
   if (newMin != nMin) { reverseOutput = true; }

   var portion = (x-oldMin)*(newMax-newMin)/(oldMax-oldMin);
   if (reverseInput) { portion = (oldMax-x)*(newMax-newMin)/(oldMax-oldMin); }

   var result = parseFloat(portion + newMin);
   if (reverseOutput) { result = newMax - portion; }

   result = result;
   return result;
}  // remap()

function linSpaceN(x1, x2, N) {
   // Generates array of N evenly spaced floats between x1 and x2 (incl).
   // The spacing between the points is: ds = (x2-x1)/(n-1).
   // Example: linspace(1,10,10): [1,2,3,4,5,6,7,8,9,10]
   // Example: linspace(0,10,10): [ 0, 1.11, 2.22, ..., 9.99]  10 evenly spaced points
   // If ds is integer, then all points are integer spaced
   var M = parseInt(N);
   var end = M - 1;
   var ds = ( x2-x1 ) / end;

   // Build the output array...
   var arr = new Array( M );
   var tmp = x1;
   arr[ 0 ] = tmp;
   for ( var i = 1; i < end; i++ ) {
      tmp += ds;
      arr[ i ] = tmp;
   }
   arr[ end ] = x2;
   return arr;
}  // linSpaceN()

function linSpaceS(x1, x2, S) {
   // Generates array of floats with spacing S between x1 and x2 (incl).
   // Number of points: Math.ceil(x2-x1/S) + 1
   var arr = [];
   var point = x1;
   while (true) {
      arr.push(point);
      point = point + S;
      if (point >= x2) {
         arr.push(x2);
         break;
      }
   }
   return arr;
}  // linSpaceS()

function getRandomColor() {
   var letters = '0123456789ABCDEF';
   var color = '#';
   for (var i = 0; i < 6; i++) {
     color += letters[Math.floor(Math.random() * 16)];
   }
   return color;
}  // getRandomColor()

var Color = function (iColor) {
   // Very simple object to convert HSV color to HEX color.
   // Usage: var hex = new Color([257, 98, 12]).hex;
   // Parm: HSV color as array [h,s,v] with h in [0,360], s in [0,100], v in [0,100]
   this.color = convert(iColor);  // HSV with components in [0,1]

   function convert(iColor) {
      var hue = (Math.abs(iColor[0]) % 361)/360;
      var sat = (Math.abs(iColor[1]) % 101)/100;
      var val = (Math.abs(iColor[2]) % 101)/100;
      return {h: hue, s: sat, v: val};
   }

   function HSVtoRGB(h,s,v) {
      var r, g, b,
          i = Math.floor(h * 6),
          f = h * 6 - i,
          p = v * (1 - s),
          q = v * (1 - f * s),
          t = v * (1 - (1 - f) * s);
      switch (i % 6) {
          case 0: r = v, g = t, b = p; break;
          case 1: r = q, g = v, b = p; break;
          case 2: r = p, g = v, b = t; break;
          case 3: r = p, g = q, b = v; break;
          case 4: r = t, g = p, b = v; break;
          case 5: r = v, g = p, b = q; break;
      }
      return {r: Math.floor(r * 255), g: Math.floor(g * 255), b: Math.floor(b * 255)};
   }  // HSVtoRGB()

   function RGBtoHEX(r, g, b) {
      var hexColor = "#" + numberToHex(parseInt(r)) + numberToHex(parseInt(g)) + numberToHex(parseInt(b));
      return hexColor;
   }  // RGBtoHEX()

   function numberToHex(n) {
      var hex = n.toString(16);
      return hex.length == 1 ? "0" + hex : hex;
   }  // numberToHex()

   Object.defineProperty(this, 'hex', {
      get: function() {
         var rgbColor = HSVtoRGB(this.color.h, this.color.s, this.color.v);
         var hexColor = RGBtoHEX(rgbColor.r, rgbColor.g, rgbColor.b);
         return hexColor;
      }  // get()
   });

   return this;
}  // Color()

// TEST COLORS
//var c = new Color([10,100,100]);
//console.log("Color: ", c.color, c.hex);

//==========================================================================

