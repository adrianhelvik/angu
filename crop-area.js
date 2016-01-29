
//
// Shims first, then the actual code. :)
//


//
// IOS drag'n'drop shim copied 29 jan 2015
// Source: https://github.com/timruffles/ios-html5-drag-drop-shim
//

(function(doc) {

  log = noop; // noOp, remove this line to enable debugging

  var coordinateSystemForElementFromPoint;

  function main(config) {
    config = config || {};

    coordinateSystemForElementFromPoint = navigator.userAgent.match(/OS [1-4](?:_\d+)+ like Mac/) ? "page" : "client";

    var div = doc.createElement('div');
    var dragDiv = 'draggable' in div;
    var evts = 'ondragstart' in div && 'ondrop' in div;

    var needsPatch = !(dragDiv || evts) || /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
    log((needsPatch ? "" : "not ") + "patching html5 drag drop");

    if(!needsPatch) {
        return;
    }

    if(!config.enableEnterLeave) {
      DragDrop.prototype.synthesizeEnterLeave = noop;
    }

    doc.addEventListener("touchstart", touchstart);
  }

  function DragDrop(event, el) {

    this.dragData = {};
    this.dragDataTypes = [];
    this.dragImage = null;
    this.dragImageTransform = null;
    this.dragImageWebKitTransform = null;
    this.customDragImage = null;
    this.customDragImageX = null;
    this.customDragImageY = null;
    this.el = el || event.target;

    log("dragstart");

    if (this.dispatchDragStart()) {
      this.createDragImage();
      this.listen();
    }
  }

  DragDrop.prototype = {
    listen: function() {
      var move = onEvt(doc, "touchmove", this.move, this);
      var end = onEvt(doc, "touchend", ontouchend, this);
      var cancel = onEvt(doc, "touchcancel", cleanup, this);

      function ontouchend(event) {
        this.dragend(event, event.target);
        cleanup.call(this);
      }
      function cleanup() {
        log("cleanup");
        this.dragDataTypes = [];
        if (this.dragImage !== null) {
          this.dragImage.parentNode.removeChild(this.dragImage);
          this.dragImage = null;
          this.dragImageTransform = null;
          this.dragImageWebKitTransform = null;
        }
        this.customDragImage = null;
        this.customDragImageX = null;
        this.customDragImageY = null;
        this.el = this.dragData = null;
        return [move, end, cancel].forEach(function(handler) {
          return handler.off();
        });
      }
    },
    move: function(event) {
      var pageXs = [], pageYs = [];
      [].forEach.call(event.changedTouches, function(touch) {
        pageXs.push(touch.pageX);
        pageYs.push(touch.pageY);
      });

      var x = average(pageXs) - (this.customDragImageX || parseInt(this.dragImage.offsetWidth, 10) / 2);
      var y = average(pageYs) - (this.customDragImageY || parseInt(this.dragImage.offsetHeight, 10) / 2);
      this.translateDragImage(x, y);

      this.synthesizeEnterLeave(event);
    },
    // We use translate instead of top/left because of sub-pixel rendering and for the hope of better performance
    // http://www.paulirish.com/2012/why-moving-elements-with-translate-is-better-than-posabs-topleft/
    translateDragImage: function(x, y) {
      var translate = "translate(" + x + "px," + y + "px) ";

      if (this.dragImageWebKitTransform !== null) {
        this.dragImage.style["-webkit-transform"] = translate + this.dragImageWebKitTransform;
      }
      if (this.dragImageTransform !== null) {
        this.dragImage.style.transform = translate + this.dragImageTransform;
      }
    },
    synthesizeEnterLeave: function(event) {
      var target = elementFromTouchEvent(this.el,event)
      if (target != this.lastEnter) {
        if (this.lastEnter) {
          this.dispatchLeave(event);
        }
        this.lastEnter = target;
        if (this.lastEnter) {
          this.dispatchEnter(event);
        }
      }
      if (this.lastEnter) {
        this.dispatchOver(event);
      }
    },
    dragend: function(event) {

      // we'll dispatch drop if there's a target, then dragEnd.
      // drop comes first http://www.whatwg.org/specs/web-apps/current-work/multipage/dnd.html#drag-and-drop-processing-model
      log("dragend");

      if (this.lastEnter) {
        this.dispatchLeave(event);
      }

      var target = elementFromTouchEvent(this.el,event)
      if (target) {
        log("found drop target " + target.tagName);
        this.dispatchDrop(target, event);
      } else {
        log("no drop target");
      }

      var dragendEvt = doc.createEvent("Event");
      dragendEvt.initEvent("dragend", true, true);
      this.el.dispatchEvent(dragendEvt);
    },
    dispatchDrop: function(target, event) {
      var dropEvt = doc.createEvent("Event");
      dropEvt.initEvent("drop", true, true);

      var touch = event.changedTouches[0];
      var x = touch[coordinateSystemForElementFromPoint + 'X'];
      var y = touch[coordinateSystemForElementFromPoint + 'Y'];
      dropEvt.offsetX = x - target.x;
      dropEvt.offsetY = y - target.y;

      dropEvt.dataTransfer = {
        types: this.dragDataTypes,
        getData: function(type) {
          return this.dragData[type];
        }.bind(this),
        dropEffect: "move"
      };
      dropEvt.preventDefault = function() {
         // https://www.w3.org/Bugs/Public/show_bug.cgi?id=14638 - if we don't cancel it, we'll snap back
      }.bind(this);

      once(doc, "drop", function() {
        log("drop event not canceled");
      },this);

      target.dispatchEvent(dropEvt);
    },
    dispatchEnter: function(event) {

      var enterEvt = doc.createEvent("Event");
      enterEvt.initEvent("dragenter", true, true);
      enterEvt.dataTransfer = {
        types: this.dragDataTypes,
        getData: function(type) {
          return this.dragData[type];
        }.bind(this)
      };

      var touch = event.changedTouches[0];
      enterEvt.pageX = touch.pageX;
      enterEvt.pageY = touch.pageY;

      this.lastEnter.dispatchEvent(enterEvt);
    },
    dispatchOver: function(event) {

      var overEvt = doc.createEvent("Event");
      overEvt.initEvent("dragover", true, true);
      overEvt.dataTransfer = {
        types: this.dragDataTypes,
        getData: function(type) {
          return this.dragData[type];
        }.bind(this)
      };

      var touch = event.changedTouches[0];
      overEvt.pageX = touch.pageX;
      overEvt.pageY = touch.pageY;

      this.lastEnter.dispatchEvent(overEvt);
    },
    dispatchLeave: function(event) {

      var leaveEvt = doc.createEvent("Event");
      leaveEvt.initEvent("dragleave", true, true);
      leaveEvt.dataTransfer = {
        types: this.dragDataTypes,
        getData: function(type) {
          return this.dragData[type];
        }.bind(this)
      };

      var touch = event.changedTouches[0];
      leaveEvt.pageX = touch.pageX;
      leaveEvt.pageY = touch.pageY;

      this.lastEnter.dispatchEvent(leaveEvt);
      this.lastEnter = null;
    },
    dispatchDragStart: function() {
      var evt = doc.createEvent("Event");
      evt.initEvent("dragstart", true, true);
      evt.dataTransfer = {
        setData: function(type, val) {
          this.dragData[type] = val;
          if (this.dragDataTypes.indexOf(type) == -1) {
            this.dragDataTypes[this.dragDataTypes.length] = type;
          }
          return val;
        }.bind(this),
        setDragImage: function(el, x, y){
          this.customDragImage = el;
          this.customDragImageX = x
          this.customDragImageY = y
        }.bind(this),
        dropEffect: "move"
      };
      return this.el.dispatchEvent(evt);
    },
    createDragImage: function() {
      if (this.customDragImage) {
        this.dragImage = this.customDragImage.cloneNode(true);
        duplicateStyle(this.customDragImage, this.dragImage); 
      } else {
        this.dragImage = this.el.cloneNode(true);
        duplicateStyle(this.el, this.dragImage); 
      }
      this.dragImage.style.opacity = "0.5";
      this.dragImage.style.position = "absolute";
      this.dragImage.style.left = "0px";
      this.dragImage.style.top = "0px";
      this.dragImage.style.zIndex = "999999";

      var transform = this.dragImage.style.transform;
      if (typeof transform !== "undefined") {
        this.dragImageTransform = "";
        if (transform != "none") {
          this.dragImageTransform = transform.replace(/translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g, '');
        }
      }

      var webkitTransform = this.dragImage.style["-webkit-transform"];
      if (typeof webkitTransform !== "undefined") {
        this.dragImageWebKitTransform = "";
        if (webkitTransform != "none") {
          this.dragImageWebKitTransform = webkitTransform.replace(/translate\(\D*\d+[^,]*,\D*\d+[^,]*\)\s*/g, '');
        }
      }

      this.translateDragImage(-9999, -9999);

      doc.body.appendChild(this.dragImage);
    }
  };

  // event listeners
  function touchstart(evt) {
    var el = evt.target;
    do {
      if (el.draggable === true) {
        // If draggable isn't explicitly set for anchors, then simulate a click event.
        // Otherwise plain old vanilla links will stop working.
        // https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Touch_events#Handling_clicks
        if (!el.hasAttribute("draggable") && el.tagName.toLowerCase() == "a") {
          var clickEvt = document.createEvent("MouseEvents");
          clickEvt.initMouseEvent("click", true, true, el.ownerDocument.defaultView, 1,
            evt.screenX, evt.screenY, evt.clientX, evt.clientY,
            evt.ctrlKey, evt.altKey, evt.shiftKey, evt.metaKey, 0, null);
          el.dispatchEvent(clickEvt);
          log("Simulating click to anchor");
        }
        evt.preventDefault();
        new DragDrop(evt,el);
      }
    } while((el = el.parentNode) && el !== doc.body);
  }

  // DOM helpers
  function elementFromTouchEvent(el,event) {
    var touch = event.changedTouches[0];
    var target = doc.elementFromPoint(
      touch[coordinateSystemForElementFromPoint + "X"],
      touch[coordinateSystemForElementFromPoint + "Y"]
    );
    return target;
  }

  function onEvt(el, event, handler, context) {
    if(context) {
      handler = handler.bind(context);
    }
    el.addEventListener(event, handler);
    return {
      off: function() {
        return el.removeEventListener(event, handler);
      }
    };
  }

  function once(el, event, handler, context) {
    if(context) {
      handler = handler.bind(context);
    }
    function listener(evt) {
      handler(evt);
      return el.removeEventListener(event,listener);
    }
    return el.addEventListener(event,listener);
  }

  // duplicateStyle expects dstNode to be a clone of srcNode
  function duplicateStyle(srcNode, dstNode) {
    // Is this node an element?
    if (srcNode.nodeType == 1) {
      // Remove any potential conflict attributes
      dstNode.removeAttribute("id");
      dstNode.removeAttribute("class");
      dstNode.removeAttribute("style");
      dstNode.removeAttribute("draggable");

      // Clone the style
      var cs = window.getComputedStyle(srcNode);
      for (var i = 0; i < cs.length; i++) {
        var csName = cs[i];
        dstNode.style.setProperty(csName, cs.getPropertyValue(csName), cs.getPropertyPriority(csName));
      }

      // Pointer events as none makes the drag image transparent to document.elementFromPoint()
      dstNode.style.pointerEvents = "none";
    }

    // Do the same for the children
    if (srcNode.hasChildNodes()) {
      for (var j = 0; j < srcNode.childNodes.length; j++) {
        duplicateStyle(srcNode.childNodes[j], dstNode.childNodes[j]);
      }
    }
  }

  // general helpers
  function log(msg) {
    console.log(msg);
  }

  function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((function(s, v) {
      return v + s;
    }), 0) / arr.length;
  }

  function noop() {}

  main(window.iosDragDropShim);


})(document);

//
// Crop area directive
//

( function () {
    'use strict';

    var cropArea = angular.module( 'cropArea', [] );
    
    cropArea.directive( 'cropArea', function () {
        return {
            restrict: 'E',
            template:
                "<div class = 'CropArea'>" +
                    "<div class = 'CropArea-container'>" +
                        "<div class = 'CropArea-left'></div>" +
                        "<div class = 'CropArea-right'></div>" +
                        "<div class = 'CropArea-top'></div>" +
                        "<div class = 'CropArea-bottom'></div>" +
                        "<div class = 'CropArea-handle'></div>" +
                        "<div class = 'CropArea-shade CropArea-shade--left'></div>" +
                        "<div class = 'CropArea-shade CropArea-shade--right'></div>" +
                        "<div class = 'CropArea-shade CropArea-shade--top'></div>" +
                        "<div class = 'CropArea-shade CropArea-shade--bottom'></div>" +
                        "<div class = 'CropArea-croppedArea'></div>" +
                        "<div ng-transclude></div>" +
                    "</div>" +
                "</div>",
            transclude: true,
            scope: {
                boundX:         '=',
                boundY:         '=',
                boundWidth:     '=',
                boundHeight:    '=',
                handleSize:     '@', // integer | integer text: optional
                defaultWidth:   '@', // integer | integer text: if not set, a default value us used
                defaultHeight:  '@', // integer | integer text: if not set, a default value us used
                aspectRatio:    '@', // float | integer text: if not set, no aspect ratio is used
            },
            link: function ( scope, rootElement, attributes ) {

                // Argument parsing
                // ----------------

                var options = {};

                options.handleSize    = parseNumber( scope.handleSize,    { defaultValue: 20    } );
                options.defaultHeight = parseNumber( scope.defaultHeight, { defaultValue: 100   } );
                options.defaultWidth  = parseNumber( scope.defaultWidth,  { defaultValue: 100   } );
                options.aspectRatio   = parseNumber( scope.aspectRatio,   { defaultValue: false } );

                // Get elements
                // ------------

                var container = angular.element( rootElement[0].querySelector('.CropArea-container') );

                var borders = {
                    top: angular.element( rootElement[0].querySelector('.CropArea-top') ),
                    bottom: angular.element( rootElement[0].querySelector('.CropArea-bottom') ),
                    left: angular.element( rootElement[0].querySelector('.CropArea-left') ),
                    right: angular.element( rootElement[0].querySelector('.CropArea-right') ),
                };

                var shades = {
                    left: angular.element( rootElement[0].querySelector('.CropArea-shade--left') ),
                    right: angular.element( rootElement[0].querySelector('.CropArea-shade--right') ),
                    top: angular.element( rootElement[0].querySelector('.CropArea-shade--top') ),
                    bottom: angular.element( rootElement[0].querySelector('.CropArea-shade--bottom') ),
                };
                
                var handle = angular.element( rootElement[0].querySelector('.CropArea-handle') );

                var croppedArea = angular.element( rootElement[0].querySelector('.CropArea-croppedArea') );

                var emptyElement = document.createElement( 'div' );
                emptyElement.style.visibility = 'hidden';

                // Model
                // -----

                var model = {
                    x: 10,
                    y: 10,
                    height:     options.defaultHeight,
                    width:      options.defaultWidth,
                    fullHeight: calculateFullHeight(),
                    fullWidth:  calculateFullWidth()
                };

                if ( options.aspectRatio ) {
                    model.width = model.height * options.aspectRatio;
                }

                // Initialization
                // --------------

                positionElements();
                handle[0].setAttribute( 'draggable', 'true' );
                croppedArea[0].setAttribute( 'draggable', 'true' );

                // Drag events: handle

                handle.on( 'dragstart', function ( event ) {
                    event.dataTransfer.setDragImage( emptyElement, 0, 0 );
                } );

                handle.on( 'drag', function ( event ) {
                    
                    var relativeX = event.clientX - this.parentNode.offsetLeft;
                    var relativeY = event.clientY - this.parentNode.offsetTop;

                    if ( ! ( relativeX >= 0 && relativeY >= 0 ) ) {
                        return;
                    }

                    model.height = relativeY - model.y - options.handleSize/2;

                    if ( options.aspectRatio ) {
                        model.width = model.height * options.aspectRatio;
                    }

                    else {
                        model.width = relativeX - model.x - options.handleSize/2;
                    }

                    // Handle out of bounds stuff

                    if ( ( model.height + model.y ) > model.fullHeight ) {
                        model.height = ( model.fullHeight - model.y );

                        if ( options.aspectRatio ) {
                            model.width = model.height * options.aspectRatio;
                        }
                    }

                    if ( ( model.width + model.x ) > model.fullWidth ) {
                        model.width = ( model.fullWidth - model.x );
                        
                        if ( options.aspectRatio ) {
                            model.height = model.width / options.aspectRatio;
                        }
                    }

                    positionElements();
                
                } );

                // Drag events: cropped area

                croppedArea.on( 'dragstart', function ( event ) {
                    event.dataTransfer.setDragImage( emptyElement, 0, 0 );
                } );

                croppedArea.on( 'drag', function ( event ) {

                    var relativeX = event.clientX- this.parentNode.offsetLeft;
                    var relativeY = event.clientY - this.parentNode.offsetTop;

                    if ( ! ( relativeX >= 0 && relativeY >= 0 ) ) {
                        return;
                    }

                    model.x = relativeX - model.width/2;
                    model.y = relativeY - model.height/2;

                    if ( ( model.y + model.height ) > model.fullHeight ) {
                        model.y = ( model.fullHeight - model.height );
                    }

                    if ( ( model.x + model.width ) > model.fullWidth ) {
                        model.x = ( model.fullWidth - model.width );
                    }

                    if ( model.x < 0 ) {
                        model.x = 0;
                    }

                    if ( model.y < 0 ) {
                        model.y = 0;
                    }

                    positionElements();
                } );
                
                // Implementation
                // --------------

                function positionElements() {

                    // Update scope values
                    // -------------------
                    scope.boundX = model.x;
                    scope.boundY = model.y;
                    scope.boundWidth = model.width;
                    scope.boundHeight = model.height;

                    if ( ! scope.$root.$$phase ) {
                        scope.$apply();
                    }

                    // Borders
                    // -------

                    var vertical = {
                        'height': '2px',
                        'width': model.width + 'px'
                    }
                    
                    var horizontal = {
                        'height': model.height + 'px',
                        'width': '2px'
                    };
                    
                    borders.top.css( vertical );
                    borders.bottom.css( vertical);
                    borders.left.css( horizontal );
                    borders.right.css( horizontal );

                    borders.top.css( {
                        'left': model.x + 'px',
                        'top': model.y + 'px'
                    } );
                    
                    borders.left.css( {
                        'left': model.x + 'px',
                        'top': model.y + 'px'
                    } );
                    
                    borders.right.css( {
                        'left': ( model.x + model.width ) + 'px',
                        'top': model.y + 'px'
                    } );

                    borders.bottom.css( {
                        'left': model.x + 'px',
                        'top': ( model.y + model.height ) + 'px'
                    } );

                    // Handle
                    // ------

                    handle.css( {
                        'left': ( model.x + model.width - options.handleSize/2 ) + 'px',
                        'top': ( model.y + model.height - options.handleSize/2 ) + 'px',
                        'border-radius': options.handleSize + 'px',
                        'width': options.handleSize + 'px',
                        'height': options.handleSize + 'px',
                    } );

                    // Shades
                    // ------

                    shades.left.css( {
                        'top': 0 + 'px',
                        'left': 0 + 'px',
                        'width': model.x + 'px',
                        'height': model.fullHeight + 'px'
                    } );

                    shades.right.css( {
                        'top': 0 + 'px',
                        'right': 0 + 'px',
                        'width': ( model.fullWidth - ( model.x + model.width ) ) + 'px',
                        'height': model.fullHeight + 'px'
                    } );

                    shades.top.css( {
                        'top': 0 + 'px',
                        'left': model.x + 'px',
                        'width': model.width + 'px',
                        'height': model.y + 'px'
                    } );

                    shades.bottom.css( {
                        'bottom': 0 + 'px',
                        'left': model.x + 'px',
                        'width': model.width + 'px',
                        'height': ( model.fullHeight - ( model.y + model.height ) ) + 'px'
                    } );
                    
                    // Cropped area
                    // ------------

                    croppedArea.css( {
                        'top': model.y + 'px',
                        'left': model.x + 'px',
                        'width': model.width + 'px',
                        'height': model.height + 'px'
                    } );
                }

                function calculateFullHeight() {
                    return parseInt( container[0].clientHeight );
                }

                function calculateFullWidth() {
                    return parseInt( container[0].clientWidth );
                }

                function parseNumber( possibleNumber, options ) {
                    if ( isNumeric( possibleNumber ) ) {
                        return parseFloat( possibleNumber );
                    }

                    if ( options && options.defaultValue ) {
                        return options.defaultValue;
                    }

                    return null;
                }

                function isNumeric( possibleNumber ) {
                    return ! isNaN( parseFloat( possibleNumber ) ) && isFinite( possibleNumber );
                }
            }
        };
    } );

} ).call( {} );
