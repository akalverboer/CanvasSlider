//==========================================================================
// CANVAS RANGE SLIDER CONTROL
// A pure Javascript Range Slider plugin, no dependencies required.
// Slider is implemented on a CANVAS element (sliding over pixels)
//
// License: MIT 2020 Arthur Kalverboer
//==========================================================================

'use strict';

(function () {
   // To obtain data privacy we use an IIFE, pronounced "iffy": Immediately-Invoked Function Expression
   // Objects: FRONTEND, VIEW and MODEL. The FRONTEND initiates the application.
   // Minimal interaction between VIEW and MODEL.
   // Create an instance of the slider by using global window.CanvasSlider.

   var VIEW = function (iConf) {
     // Object for drawing on the canvas and to signal mouse events.
     // VIEW can read MODEL properties and methods. Decoupled by functionality.
     var thisView = this;  // global
     var u = this;         // container for unit properties
     this.model = null;    // Ref to model object with abstract slider and state of slider
     this.conf = iConf;    // See creator for details
     /*
         conf.canvas = canvasElem;
         conf.handle = this.conf.handle;
         conf.format = this.conf.format;
         conf.baseColor = this.conf.baseColor;
         conf.showLabels = this.conf.showLabels;
         conf.showMajorTicks = this.conf.showMajorTicks;
         conf.showMinorTicks = this.conf.showMinorTicks;
         conf.showToolTip = this.conf.showToolTip;
         conf.showValueBox = this.conf.showValueBox;
     */

     this.canvas = this.conf.canvas;
     //this.canvas.width = 600;   // TEST
     //this.canvas.height = 80;   // TEST
     this.ctx = this.canvas.getContext("2d");


     // If the canvas width is changed, the slider is scaled automatically horizontally.
     // This comes because we make the width properties of the drawing dependent of canvas.width.
     // If the canvas height is changed, no scaling: only more space is used on the canvas.
     // To implement the scaling, we define a drawing unit for width and height.
     // We make our design on a canvas with dimensions 600x80.
     // One drawing unit is 1px. Refer to drawing unit by: u.x and u.y
     Object.defineProperty(u, 'x', { get: function() { return this.canvas.width/600;  } });
     Object.defineProperty(u, 'y', { get: function() { return 1;  } });  // CONSTANT UNIT

     // Margin of track relative to left and right borders of canvas. UPDATE ALLOWED.
     this.margin = {left: 36*u.x, right: 36*u.x};  // ********************
     this.xmin = this.margin.left;                 // TRACK RANGE for PIXEL VALUES
     this.xmax = 600*u.x - this.margin.right;  // TRACK RANGE for PIXEL VALUES

     this.numWidth = 30;   // Max width for display number (px)
     this.euroSign = "€";  // Euro currency symbol

     // === METHODS ===
     this.init = function () {
        if (!this.conf.format.hasOwnProperty("decimals")) this.conf.format.decimals = 0;
        if (!this.conf.format.hasOwnProperty("prefix")) this.conf.format.prefix = "";
        if (!this.conf.format.hasOwnProperty("suffix")) this.conf.format.suffix = "";

        // Set track dimensions
        this.track = new Track();
        this.track.x = this.xmin;                     // 0.05 * this.canvas.width;   // 30 units
        this.track.w = this.xmax - this.xmin;
        this.track.h = 14*u.y;                     // 0.17*this.canvas.height;   // 14 units
        this.track.y = parseInt(this.canvas.height / 2) - this.track.h/2 - 2;  // Track vertical aligned: middle
        this.setColors();
        this.track.fillColor = this.color.track.fill;
        this.track.highlightColor = this.color.track.highlight;
        this.track.highlightGradient = this.color.track.highlightGradient;
        this.track.strokeColor = this.color.track.stroke;

        this.model.initSliderValues();
        //console.log("VIEW VALUES MODEL VALUES ", this.model.values);

        this.sH = [];  // HANDLERS
        for (var j=0; j < this.model.values.length; j++ ) {
           var sH = Object.create(Handle);
           sH.shape = (this.conf.handle.hasOwnProperty("shape")) ? this.conf.handle.shape : "rectangle";  // user defined
           sH.w = (this.conf.handle.hasOwnProperty("w")) ? this.conf.handle.w : 20;  // user defined
           sH.h = (this.conf.handle.hasOwnProperty("h")) ? this.conf.handle.h : 20;  // user defined
           sH.fill = this.color.handle.fill;
           sH.fillDrag = this.color.handle.fillDrag
           sH.fillGradient = this.color.handle.fillGradient;
           sH.stroke = this.color.handle.stroke;

           sH.x = parseFloat(this.model.values[j] - sH.w/2);
           sH.y = parseFloat(this.track.y - (sH.h - this.track.h)/2);
           this.sH.push(sH);
        }

        var d = this.conf.format.decimals;
        var prefix = this.conf.format.prefix;
        var suffix = this.conf.format.suffix;
        this.toolTips = [];  // TOOLTIPS (above track)
        for (var j=0; j < this.model.values.length; j++ ) {
           var toolTip = Object.create(ValueBox);
           toolTip.fill = this.color.toolTip.fill;
           toolTip.stroke = this.color.toolTip.stroke;
           toolTip.visible = (this.conf.showToolTip == true);
           toolTip.w = 60*u.x;  //0.07*this.canvas.width;
           toolTip.h = 20*u.y;  // 0.24*this.canvas.height;
           toolTip.x = this.model.values[j] - toolTip.w/2;
           var h28 = 28*u.y;   //0.32*this.canvas.height;
           toolTip.y = this.track.y - h28;
           toolTip.text = prefix + this.model.pixToReal(this.model.values[j]).toFixed(d) + suffix;
           this.toolTips.push(toolTip);
        }

        this.valueBoxes = [];  // VALUEBOXES (max. 2; left/right to track)
        for (var j=0; j < this.model.values.length; j++ ) {
           var valueBox = Object.create(ValueBox);
           valueBox.fill = null;      // NO FILL    this.color.valueBox.fill;
           valueBox.stroke = null;    // NO STROKE  this.color.valueBox.stroke;
           valueBox.visible = (this.conf.showValueBox == true);
           valueBox.w = 26*u.x; 
           valueBox.h = 20*u.y; 
           valueBox.y = this.track.y - 4*u.y;
           if (j==0) {
             valueBox.x = 2*u.x;
             valueBox.text = prefix + this.model.pixToReal(this.model.values[j]).toFixed(d) + suffix;
             this.valueBoxes.push(valueBox);
           }
           if (j==1) {
             valueBox.x = this.track.x + this.track.w + 2;
             valueBox.text = prefix + this.model.pixToReal(this.model.values[j]).toFixed(d) + suffix;
             this.valueBoxes.push(valueBox);
           }
           if (j>1) break;
        }

        this.initEventListener();  // Init events for mouse actions

        this.redraw();
        return 0;
     }  // init()

     this.redraw = function () {
        // redraw the canvas
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (false) {
           // Draw canvas border and background TEST
           this.ctx.strokeStyle = "#333";
           this.ctx.fillStyle = "#FAF7F8";
           this.ctx.lineWidth = 2;
           this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);   // BETTER: use stylesheet
           this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height); // BETTER: use stylesheet
        }

        // Draw sliderTrack
        this.track.draw(this.ctx);

        // Draw sliderHandles
        for (var idx=0; idx < this.model.values.length; idx++ ) {
           this.sH[idx].draw(this.ctx);
        }

        // Draw toolTips/valueBoxes
        for (var idx=0; idx < this.model.values.length; idx++ ) {
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

     this.onChangePixValue = function(idx, pxVal) {
        // Define callback called when track.values changed.
        //console.log("CALLBACK 2 ", idx, pxVal);
        var d = this.conf.format.decimals;
        var prefix = this.conf.format.prefix;
        var suffix = this.conf.format.suffix;
        var h28 = 28*u.y;   //0.32*this.canvas.height;
        thisView.toolTips[idx].x = pxVal - thisView.toolTips[idx].w/2;
        thisView.toolTips[idx].y = thisView.track.y - h28;  // unchanged
        thisView.toolTips[idx].text = prefix + this.model.pixToReal(pxVal).toFixed(d) + suffix;

        if (idx==0 || idx==1) {
           thisView.valueBoxes[idx].text = prefix + this.model.pixToReal(pxVal).toFixed(d) + suffix;
        }

        thisView.sH[idx].x = pxVal - thisView.sH[idx].w/2;

        return 0;
     }  // onChangePixValue()

     this.drawMinMaxLabels = function(ctx) {
        if (!(this.conf.showLabels && !this.conf.showMajorTicks)) { return 0; }   // HIDE
        var d = this.conf.format.decimals;
        var prefix = this.conf.format.prefix;
        var suffix = this.conf.format.suffix;
        ctx.font = "11px Verdana";
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        var h28 = 28*u.y; 
        var x10 = 10*u.x; 
        var strMin = prefix + this.model.re.rmin.toFixed(d) + suffix;
        var strMax = prefix + this.model.re.rmax.toFixed(d) + suffix;
        ctx.fillText(strMin, this.xmin+x10, this.track.y+h28, this.numWidth);  // first label
        ctx.fillText(strMax, this.xmax-x10, this.track.y+h28, this.numWidth);  // last label
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
        var h20 = 20*u.y; 
        var h24 = 24*u.y; 
        var h28 = 28*u.y; 
        var h38 = 38*u.y; 
        for (var j=0; j < this.model.conf.range.length; j++ ) {
           var realVal = this.model.conf.range[j];
           var pxVal = parseInt(this.model.realToPix(realVal)) + dx;
           ctx.moveTo(pxVal, this.track.y + h20);
           ctx.lineTo(pxVal, this.track.y + h28);
           ctx.stroke(); // tickMarkers
           ctx.fillStyle = "#000";  // TEXT
           if (this.conf.showLabels) {
              var enoughSpace = true;
              if (j == this.model.conf.range.length-1) {  // LAST
                 var prevPxVal = this.model.realToPix(this.model.conf.range[j-1]); 
                 if (pxVal - prevPxVal < 30) {enoughSpace = false; }
              }
              if (enoughSpace) {
                 var str = prefix + realVal.toFixed(d) + suffix;
                 ctx.fillText(str, pxVal.toFixed(0), this.track.y + h38, this.numWidth);  // tickLabels
              }
           }
           // Draw minor ticks
           if (!this.conf.showMinorTicks) continue;  // NEXT ITERATION
           if (j < this.model.conf.range.length-1) {
              var minorTick = pxVal;
              var nextTick = this.model.realToPix(this.model.conf.range[j+1]);
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
        // Listen to mouse events 
        var dragok;
        var startX;  // last mouse position x
        var startY;  // last mouse position y
        var aH = -1;  // Active handler for events: index of handler (-1 if not valid)

        // Mouseup event: not linked to canvas (see later)
        this.canvas.addEventListener('mousedown', onMouseDown, false);
        this.canvas.addEventListener("mousemove", onMouseMove, false);

        function onMouseDown(evt) {
           if (thisView.model.conf.disabled) {console.log("MOUSEDOWN DISABLED"); return 0;} // MOUSE DISABLED

           function mouseDownEvent() {
              window.addEventListener('mouseup', onMouseUp, false);
              return 0;
           }  // mouseDownEvent()

           evt.preventDefault();
           evt.stopPropagation();

           var m = getMousePos(evt);  // get the current mouse position
           if (m == null) { return null; }   // No data

           dragok = false;

           // First test WHERE mouse is clicked down (handle or track).
           // If handle clicked, we must take into account overlaying handles.
           // If clicked on overlaying handles: choose handle with largest range.
           var rangeArray = thisView.model.rangeArray();
           var maxRange = 0; var maxIdx = -1;
           var handleClicked = false;
           for (var j=0; j < thisView.sH.length; j++ ) {
              // Loop through handles
              if (thisView.sH[j].contains(m)) {
                 var range = rangeArray[j][2] - rangeArray[j][0];
                 if (range > maxRange) { maxRange = range; maxIdx = j; }
              }
           }
           if (maxRange > 0) {
                 handleClicked = true;
                 aH = maxIdx;
           }

           var trackClicked = thisView.track.contains(m);
           if (handleClicked) {
              // EVENT mouse down on handle >> Ready for dragging
              dragok = true;
              // save the current mouse position
              startX = crop(m.x, thisView.xmin, thisView.xmax);
              startY = m.y;
              thisView.model.eventHandler("mouseDownOnHandle", aH, startX);   //***
              mouseDownEvent();  // Start dragging can begin
           } else if (trackClicked) {
              startX = crop(m.x, thisView.xmin, thisView.xmax);
              startY = m.y;
              // Track clicked: choose value (handle, index) closest to startX
              var minDist = +Infinity; var minIdx = -1;
              for (var j=0; j < rangeArray.length; j++ ) {
                 if ((startX > rangeArray[j][0]) && (startX < rangeArray[j][2])) {
                    var dist = Math.abs(startX - rangeArray[j][1]);  // dist to handler
                    if (dist < minDist) { minDist = dist; minIdx = j; }
                 }
              }
              if (minIdx >= 0) {
                 // EVENT mouse down on track (not handle) >> set value
                 aH = minIdx;
                 var newPxVal = startX;
                 thisView.model.eventHandler("mouseDownOnTrack", aH, newPxVal);   //***
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
           var pxVal = startX;  // last registered mouse position before mouse up

           // clear all the dragging flags
           if (dragok) {
              dragok = false;  // Dragging stopped
              if (thisView.sH[aH].isDragging) { 
                 // EVENT mouseUp after dragging (dragEnd) >> set value 
                 thisView.sH[aH].isDragging = false;
                 thisView.model.eventHandler("mouseUpDragEnd", aH, pxVal);   //***
              }
           }

           thisView.model.eventHandler("mouseUp", aH, pxVal);   //***

           thisView.redraw();
           return 0;
        }  // onMouseUp()

        function onMouseMove(evt) {
           // Handle mouse moves if we're dragging anything...
           if (!dragok) {
              // Hover over canvas without dragging.
              setMouseCursor(evt);
           }
           if (dragok) {
               var m = getMousePos(evt);  // get the current mouse position
               if (m == null) { return null; }   // No data

               if (thisView.sH[aH].isDragging == false) {
                  // EVENT mouseMove FIRST time after being ready for dragging >> publish onDragStart
                  thisView.model.eventHandler("dragStart", aH);   //***
               }

               thisView.sH[aH].isDragging = true; 
               evt.preventDefault();
               evt.stopPropagation();

               // Calculate the distance the mouse has moved since the last mousemove
               var dx = m.x - startX; 
               var dy = m.y - startY;

               // Move handle that isDragging by the distance the mouse has moved since the last mousemove.
               // dy not used: y fixed (hor move)

               var newVal = +thisView.model.getPixValue(aH) + dx;  // + > force add num
               thisView.model.setPixValue(aH, newVal, {snap: false, publish: true} ); // Running value: do not snap to tick

               // redraw the scene with the new positions 
               thisView.redraw();

               // reset the starting mouse position for the next mousemove
               startX = crop(m.x, thisView.xmin, thisView.xmax);
               startY = m.y;
           }
           return 0;
        }  // onMouseMove()
       
        function setMouseCursor(evt) {
           var m = getMousePos(evt);  // get the current mouse position
           if (m == null) { return null; }   // No data
           var found = false;

           for (var j=0; j < thisView.sH.length; j++ ) {
              // Loop through handles
              if (thisView.sH[j].contains(m)) { found = true; break; }
           }
           if (found) {
              thisView.canvas.style.cursor = "col-resize";
           }
           else {
              if (thisView.track.contains(m)) {
                 thisView.canvas.style.cursor = "pointer";
              }
              else {
                 thisView.canvas.style.cursor = "default";
              }
           }
           return 0;
        }  // setMouseCursor()

        function getMousePos(evt) {
           // Returns mouse position 
           // Test if browser does support getBoundingClientRect
           var button = {left: 0, middle: 1, right: 2};
           if (evt.button === button.right) { return null; }    // skip right mouse click
           if (evt.button === button.middle) { return null; }   // skip middle mouse click

           if (!thisView.canvas.getBoundingClientRect) { return null; }
           var rect = thisView.canvas.getBoundingClientRect();
           var mousePos = {
              x: parseInt(evt.clientX - rect.left),
              y: parseInt(evt.clientY - rect.top)
           };
           //  console.log("MOUSEPOS:", mousePos);
           return mousePos;
        }  // getMousePos()

        return 0;
     }  // === initEventListener ===

    var Track = function() {
       // Track object for VIEW.
       // A slider is in concept a line from point a to point b with one or more points c at this line.
       // The track represents this line. It is drawn as a rectangle.
       // The track records the values of the slider along the width of the track.
       // Draw function. Partitioning of the track to highlight parts.

       this.x = 40; this.y = 100; this.w = 500; this.h = 14; // SEE INIT(). Dimensions of track (px).
       this.fillColor = "#EAEAEA"; 
       this.highlightColor = "#3FB8AF";
       this.highlightGradient = {stop1: "#4CE6D8", stop2: "#369B93"};
       this.strokeColor = "#000";

       this.contains = function(iPoint) {
          var rect = {x: this.x, y: this.y, w: this.w, h: this.h};
          return pointInRect(rect, iPoint);
       }  // contains()

       this.createSections = function() {
          // Partition the track into rectangles positioned between slider values.  nouislider term: connects
          var Section = {x: this.x, y: this.y, w: this.w, h: this.h, highlight: false};
          var arr = thisView.model.trackArray();

          var sections = new Array(thisView.model.values.length + 1);
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
     };  // === TRACK ===

     ///////this.init();
     return this;
   } // === VIEW() ===

   //EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE

   var MODEL = function (iConf) {
     // Object holding data and do processing of the slider.
     // Important property: values array (the state of the slider). Measured in pixels.
     // Real values are calculated from the pixel values.
     // MODEL can read VIEW properties and methods. Decoupled by functionality.

     var thisModel = this;  // global
     this.view = null;
     this.conf = iConf;
     /*
         conf.range = rangeValues;
         conf.start = this.conf.start;
         conf.disabled = this.conf.disabled; 
         conf.onChange = this.conf.onChange;
         conf.onDragStart = this.conf.onDragStart;
         conf.onDragEnd = this.conf.onDragEnd;
         conf.onMouseUp = this.conf.onMouseUp;
         conf.onMouseDown = this.conf.onMouseDown;
         conf.snapToTicks = this.conf.snapToTicks;
     */
     // MIN/MAX of RANGE: used by function "remap" for conversion slider values pix <-> real
     this.re = {rmin: 0, rmax: 100};  // Limits of real values (floats)
     this.px = {rmin: 0, rmax: 100};  // Limits of pixel values (floats)
     this.values = [];   // Array object of slider values (pixels). Can be changed by handles. Often 1 or 2 values, sometimes more.

     // === METHODS ===
     this.init = function () {
        if (this.conf.range.length < 2) this.conf.range = [0,100];
        if (this.conf.start.length == 0) this.conf.start = [0];
        this.re.rmin = this.conf.range[0];
        this.re.rmax = this.conf.range[this.conf.range.length -1];
        this.px.rmin = this.view.xmin;  // From VIEW
        this.px.rmax = this.view.xmax;  // From VIEW
        this.initSliderValues();  
        return 0;
     }  // init()

     this.getPixValue = function (idx) {
        // Return slider value with given index: this.values[idx]
        // Neg idx allowed: -1 >> last
        var pxVal = this.values.slice(idx)[0]; 
        return pxVal;
     }  // getPixValue()

     this.setPixValue = function (idx, pxVal, callback) {
        // Set pixel slider value with given index. Neg index NOT allowed.
        // Monitor SORTING of values and correct if needed.
        callback = callback || {snap: true, publish: true};  // default
        if (idx < 0 || idx >= this.len) {console.log("Error index setValue"); return 0;}
        var pxVal2 = pxVal;
        var arr = this.rangeArray();
        var minVal = arr[idx][0];   var maxVal = arr[idx][2];  // Limits for handler with index idx
        if (pxVal2 < minVal) pxVal2 = minVal;
        if (pxVal2 > maxVal) pxVal2 = maxVal;

        if (callback.snap) pxVal2 = this.snapPixToTick(pxVal2);

        this.values[idx] = pxVal2;                // (1) set value
        this.view.onChangePixValue(idx, pxVal2);  // (2) update view

        if (callback.publish) {
           this.eventHandler("onChange", idx, pxVal2);   //***
        }
        return 0;
     }  // setPixValue()

     this.getRealValue = function(idx) {
        var pxVal = this.getPixValue(idx);
        var realVal = this.pixToReal(pxVal);
        return realVal;
     }  // getRealValue()

     this.setRealValue = function(idx, realVal) {
        var realVal2 = crop(realVal, this.re.rmin, this.re.rmax);  // update if too small/large
        var pxVal = this.realToPix(realVal2);
        this.setPixValue(idx, pxVal, {snap: true, publish: false} );  // NO PUBLISH TO PREVENT ENDLESS LOOP
        return 0;
     }  // setRealValue()

     this.rangeArray = function() {
        // Array of ranges of each pixel value (handle) used to keep increasing order.
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
        arr.push(this.px.rmin); 
        arr.push(...this.values);  // spread operator
        arr.push(this.px.rmax);
        return arr;
     }  // trackArray()

     this.initSliderValues = function() {
        this.values = Array(this.conf.start.length).fill(null);
        for (var j=0; j < this.conf.start.length; j++ ) {
           var realVal = this.conf.start[j];
           var realVal2 = crop(realVal, this.re.rmin, this.re.rmax);  // !!! update if too small/large
           var pxVal = this.realToPix(realVal2);
           var pxVal2 = this.snapPixToTick(pxVal);
           this.values[j] = pxVal2;  // NO USER-CALBACK and NO onChangePixValue
        }
        //console.log("INIT VALUES 2", this.values);
        return 0;
     }  // initSliderValues()

     this.pixToReal = function(iPixVal) { 
        // Convert pixel value to real value
        // Pixel values and real values are floats
        var realVal = remap(iPixVal, this.px.rmin, this.px.rmax, this.re.rmin, this.re.rmax); 
        //console.log("REMAP pixToReal", iPixVal, realVal);
        return realVal;
     }  // pixToReal()

     this.realToPix = function(iRealVal) {
        // Convert real value to pixel value
        // Pixel values and real values are floats
        var pixVal = remap(iRealVal, this.re.rmin, this.re.rmax, this.px.rmin, this.px.rmax);
        //console.log("REMAP pixToReal", iRealVal, pixVal);
        return pixVal;
     }  // realToPix()

     this.snapPixToTick = function(pxVal) {
        //console.log("SNAPTOTICK", this.conf.snapToTicks);
        if (!this.conf.snapToTicks) return pxVal;  // NOTHING TO DO
        var realVal = this.pixToReal(pxVal);
        var realVal2 = snapFromTickvalues(realVal, this.conf.range);
        var pxVal2 = this.realToPix(realVal2);
        return pxVal2;
     }  // snapPixToTick()

     this.eventHandler = function(event, idx, pxVal) {
        switch(event) {
           case "mouseDownOnHandle":
              if (this.conf.onMouseDown && typeof this.conf.onMouseDown === 'function') {
                 this.conf.onMouseDown(); 
              }
              break;
           case "mouseDownOnTrack":
              if (this.conf.onMouseDown && typeof this.conf.onMouseDown === 'function') {
                 this.conf.onMouseDown(); 
              }
              this.setPixValue(idx, pxVal, {snap: true, publish: true});
              break;
           case "dragStart":
              if (this.conf.onDragStart && typeof this.conf.onDragStart === 'function') {
                 var realVal = this.getRealValue(idx);  // no pxVal; use current val
                 this.conf.onDragStart(idx, realVal);   // CALLBACK with current slider value
              }
              break;
           case "mouseUpDragEnd":
              this.setPixValue(idx, pxVal, {snap: true, publish: true} );
              if (this.conf.onDragEnd && typeof this.conf.onDragEnd === 'function') {
                    var realVal = this.pixToReal(pxVal);
                    this.conf.onDragEnd(idx, realVal);
                 }
              break;
           case "mouseUp":
              if (this.conf.onMouseUp && typeof this.conf.onMouseUp === 'function') {
                 var realVal = this.pixToReal(pxVal);   // *AK* 11-08-2020
                 this.conf.onMouseUp(idx, realVal);     // *AK* 11-08-2020
              }
              break;
           case "onChange":
              // Call user defined callback for model (4) 
              if (this.conf.onChange && typeof this.conf.onChange === 'function') {
                 var realVal = this.pixToReal(pxVal);
                 this.conf.onChange(idx, realVal);
              }
              break;
           default:
              // code block
        } 
        return 0;
     }  // eventHandler()

     /////////this.init();
     return this;
   } // === MODEL() ===
   // EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEe

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
   var FRONTEND = function(iConf) { 
      // User interface
      var _this = this;  // global
      this.model = {};
      this.view = {};
      this.conf = {};  // defaults
      this.conf.canvas = null;      // canvas id or canvas element Required.
      this.conf.range = [0,100];    // {step: 10};  or: {count: 15} or [0,3,7,9,15,27,100] 
      this.conf.start = [0, 0];             // set start values (= number of handles)
      this.conf.handle = {shape: "rectangle", w: 20, h: 20, hue: null};   // shape of handle 
      this.conf.format = {decimals: 0, prefix: "", suffix: ""};  // Simple number formatting 
      this.conf.baseColor = {h: 207, s: 60, v: 100};  // Defines color scheme. Valid HSV color.
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

      this.init = function() {
         // Override default conf by user settings (iConf)
         for (var i in this.conf) { if (iConf.hasOwnProperty(i)) this.conf[i] = iConf[i]; } 

         // User defined cavans element. Width and height set in HTML. Auto-resize of slider (width).
         // The width attribute of canvas element defaults to 300, and the height attribute defaults to 150.
         // DO NOT USE CSS (stylesheet) TO SET WIDTH
         if (typeof this.conf.canvas === 'object') var canvasElem = this.conf.canvas;
         else var canvasElem = document.getElementById(this.conf.canvas.replace('#', ''));

         if (!canvasElem) return console.log('CanvasSlider: cannot find canvas element...');  // STOP
         //console.log("Canvas element found with width: ", canvasElem.width, "and height: ", canvasElem.height );

         var rangeValues = createRangeValues(this.conf.range); 
         //console.log("RANGE VALUES: ", rangeValues);
         this.conf.start.sort(function(a, b){return a-b});  // sort
         //console.log("START VALUES: ", this.conf.start);

         var confModel = {};
         confModel.range = rangeValues;    // update: conf.range 
         confModel.start = this.conf.start;
         confModel.disabled = this.conf.disabled; 
         confModel.onChange = this.conf.onChange;
         confModel.onDragStart = this.conf.onDragStart;
         confModel.onDragEnd = this.conf.onDragEnd;
         confModel.onMouseUp = this.conf.onMouseUp;
         confModel.onMouseDown = this.conf.onMouseDown;
         confModel.snapToTicks = this.conf.snapToTicks;

         var confView = {};
         confView.canvas = canvasElem;
         confView.handle = this.conf.handle;
         confView.format = this.conf.format;
         confView.baseColor = this.conf.baseColor;
         confView.showLabels = this.conf.showLabels;
         confView.showMajorTicks = this.conf.showMajorTicks;
         confView.showMinorTicks = this.conf.showMinorTicks;
         confView.showToolTip = this.conf.showToolTip;
         confView.showValueBox = this.conf.showValueBox;

         this.model = new MODEL(confModel);
         this.view = new VIEW(confView);
         this.view.model = this.model;
         this.model.view = this.view;
         this.model.init();
         this.view.init();

         return 0;
      }  // init()

      this.getValue = function(idx) {
         // FOR EXTERNAL USE: Returns value of handle with idx
         if (idx==undefined) return undefined;
         return this.model.getRealValue(idx);
      }  // getValue()

      this.setValue = function(i, realVal) {
         //  FOR EXTERNAL USE: Function that returns itself!!! Example: this.setValue(1,10)(2,20)(3,30)(4,40)
         if (i==undefined || realVal == undefined) return 0;
         function setValue(i, realVal) {
            _this.model.setRealValue(i,realVal);
              //console.log("TEST 1", i, realVal);
            _this.view.redraw();
            return setValue;
         }
         setValue(i,realVal);
         return setValue;
      }  // setValue()

      // FOR EXTERNAL USE: definition of how to set properties
      Object.defineProperty(this, 'disabled', {
        set: function(val) { this.model.conf.disabled = val; }
      });
      Object.defineProperty(this, 'onChange', {
        set: function(val) { this.model.conf.onChange = val; }
      });
      Object.defineProperty(this, 'onDragStart', {
        set: function(val) { this.model.conf.onDragStart = val; }
      });
      Object.defineProperty(this, 'onDragEnd', {
        set: function(val) { this.model.conf.onDragEnd = val; }
      });
      Object.defineProperty(this, 'onMouseUp', {
        set: function(val) { this.model.conf.onMouseUp = val; }
      });
      Object.defineProperty(this, 'onMouseDown', {
        set: function(val) { this.model.conf.onMouseDown = val; }
      });
      Object.defineProperty(this, 'snapToTicks', {
        set: function(val) { this.model.conf.snapToTicks = val; }
      });
      //xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      Object.defineProperty(this, 'showLabels', {
        set: function(val) { this.view.conf.showLabels = val; this.view.redraw(); }
      });
      Object.defineProperty(this, 'showMajorTicks', {
        set: function(val) { this.view.conf.showMajorTicks = val; this.view.redraw(); }
      });
      Object.defineProperty(this, 'showMinorTicks', {
        set: function(val) { this.view.conf.showMinorTicks = val; this.view.redraw(); }
      });
      Object.defineProperty(this, 'showToolTip', {
        set: function(val) { this.view.conf.showToolTip = val; this.view.redraw(); }
      });
      Object.defineProperty(this, 'showValueBox', {
        set: function(val) { this.view.conf.showValueBox = val; this.view.redraw(); }
      });

      function createRangeValues(iRange) {
         // Create array with input iRange depending on definition of iRange.
         var values = [0,100];  // default
         var isArray = (iRange instanceof Array);      // Boolean: true if prop 'values' is array
         if (isArray) {
            if (iRange.length < 2) values = [0,100]; else values = iRange;
         }
         if (!isArray) {
            if (iRange.hasOwnProperty("min")) var rmin = iRange.min; else rmin = 0;
            if (iRange.hasOwnProperty("max")) var rmax = iRange.max; else rmax = rmin + 100;
            values = [rmin, rmax];
            if (iRange.hasOwnProperty("step")) values = linSpaceS(rmin, rmax, iRange.step);
            if (iRange.hasOwnProperty("count")) values = linSpaceN(rmin, rmax, iRange.count);
         }
         // Sort array (to be sure of increasing values)
         values.sort(function(a, b){return a-b});
         return values;
      }  // createRangeValues()

      this.init();
      return this;
   }  // === FRONTEND() ===

   window.CanvasSlider = FRONTEND;   // FOR EXTERNAL USE: name of slider object to create new instance

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
   // Parm iColor: array [h,s,v] with h in [0,360], s in [0,100], v in [0,100]
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

   return 0;
})(); // IIFE
//=======================================================================================
//=======================================================================================


