/* eslint-disable */

//
// TODO: @important: Aspect ratio for height
//
// TODO: Clear events on scope destruction
// TODO: Pinch and zoom causes scaling issue because of 'canvasDistance'?
//


//
// The code
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
                boundX:         '=cropX',
                boundY:         '=cropY',
                boundWidth:     '=cropWidth',
                boundHeight:    '=cropHeight',
                handleSize:     '@', // integer | text: optional
                defaultWidth:   '@', // integer | text: if not set, a default value is used
                defaultHeight:  '@', // integer | text: if not set, a default value is used
                defaultX:       '@', // integer | text: if not set, a default value is used
                defaultY:       '@', // integer | text: if not set, a default value is used
                aspectRatio:    '=cropAspectRatio', // float | integer text: if not set, no aspect ratio is used
            },
            link: linkFunction
        };
    } );

    function linkFunction( scope, rootElement, attributes ) {

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

        var image = rootElement.find( 'img' );

        var emptyElement = document.createElement( 'div' );
        emptyElement.style.visibility = 'hidden';

        // Argument checking
        // -----------------

        var options = {};

        options.handleSize    = parseNumber( scope.handleSize,    { defaultValue: 3 } );
        options.defaultHeight = parseNumber( scope.defaultHeight, { defaultValue: 80 } );
        options.defaultWidth  = parseNumber( scope.defaultWidth,  { defaultValue: 80 } );
        options.defaultX      = parseNumber( scope.defaultX,      { defaultValue: 10 });
        options.defaultY      = parseNumber( scope.defaultY,      { defaultValue: 10 });

        // Initialization
        // --------------

        var model = {};

        rootElement.ready( function () {
            handle[0].setAttribute( 'draggable', 'true' );
            croppedArea[0].setAttribute( 'draggable', 'true' );

            // Poll for view to be loaded
            var pollerId = setInterval( function () {

                calculateDimensions();

                // Only load when fullWidth and fullHeight is set
                if ( model.fullWidth !== 0 || model.fullHeight !== 0 ) {
                    console.log( 'INITIALIZING.... BOOM' );
                    clearInterval( pollerId );

                    model = {
                        fullHeight: calculateFullHeight(),  // px
                        fullWidth:  calculateFullWidth(),   // px
                        x:          options.defaultX,       // % of fullWidth
                        y:          options.defaultY,       // % of fullHeight
                        height:     null,                   // % of fullHeight
                        width:      null,                   // % of fullWidth
                        canvasDistance: null
                    };

                    setWidthAndHeight( { force: true, width: options.defaultWidth, height: options.defaultHeight } );
                    positionElements();
                    registerEvents();
                }

            }, 200 );

        } );

        // Event registration
        // ------------------

        function registerEvents() {

            // Drag events: handle

            handle.on( 'dragstart', function ( event ) {
                event.dataTransfer.setDragImage( emptyElement, 0, 0 );
            } );

            handle.on( 'drag touchmove', function ( event ) {

                // Set clientX for both drag and touchmove
                if ( event.clientX ) {
                    var clientX = event.clientX;
                    var clientY = event.clientY;
                } else if ( event.touches ) {
                    var clientX = event.touches[0].clientX;
                    var clientY = event.touches[0].clientY;
                } else return;

                event.preventDefault();

                setWidthAndHeight( { clientX: clientX, clientY: clientY } );
                positionElements();
            } );

            // Drag events: cropped area

            croppedArea.on( 'dragstart', function ( event ) {
                event.dataTransfer.setDragImage( emptyElement, 0, 0 );

                calculateCanvasDistance( event );
            } );

            croppedArea.on( 'drag touchmove', function ( event ) {

                console.log( 'CROPAREA DRAG-START. MODEL:', model );

                if ( event.clientX ) {
                    var clientX = event.clientX;
                    var clientY = event.clientY;
                } else if ( event.touches ) {
                    event.preventDefault();
                    var clientX = event.touches[0].clientX;
                    var clientY = event.touches[0].clientY;
                } else {
                    return;
                }

                var relativeX = clientX - container[0].getBoundingClientRect().left;
                var relativeY = clientY - container[0].getBoundingClientRect().top;

                if ( ! ( relativeX >= 0 && relativeY >= 0 ) ) {
                    return;
                }

                if ( model.fullWidth === 0 || model.fullHeight === 0 ) {
                    calculateDimensions();
                }

                model.x = relativeX / model.fullWidth * 100 - model.canvasDistance.left;
                model.y = relativeY / model.fullHeight * 100 - model.canvasDistance.top;

                // setWidthAndHeight();
                positionElements();

                console.log( 'CROPAREA DRAG-END. MODEL:', model );
            } );

            scope.$watch( 'aspectRatio', function () {
                setWidthAndHeight();
                positionElements();
            } );

            // Dragevents: document --- handle the few pixel units needed

            ( function () {
                var resizeId = false;

                angular.element( window ).on( 'resize', function() {
                    if ( resizeId !== false ) {
                        clearTimeout( resizeId );
                    }
                    resizeId = setTimeout( function () {
                        calculateDimensions();
                        positionElements();
                    }, 500 );
                });

            } ).call( this );
        }

        // Implementation
        // --------------

        function setWidthAndHeight( options ) {

            if ( ! options ) options = {};

            var clientX = options.clientX || 0;
            var clientY = options.clientY || 0;

            var relativeX = clientX - container[0].getBoundingClientRect().left + handle[0].offsetWidth / 2;
            var relativeY = clientY - container[0].getBoundingClientRect().top + handle[0].offsetHeight / 2;

            if ( ! ( relativeX >= 0 && relativeY >= 0 ) ) {
                if ( ! options.force ) {
                    return;
                }
            }

            // Set width and height
            if ( options.width && options.height ) {
                var possibleWidth = options.width;
                var possibleHeight = options.height;
            } else if ( options.clientX && options.clientY ) {
                var possibleHeight = relativeY / model.fullHeight * 100 - model.y - handleHeight() / 2;
                var possibleWidth = relativeX / model.fullWidth * 100 - model.x - handleWidth() / 2;
            } else {
                var possibleHeight = model.height;
                var possibleWidth = model.width;
            }

            // Attempt to set width based on aspect ratio and height
            if ( scope.aspectRatio ) {
                possibleWidth = aspectRatioWidth( possibleHeight );
            }

            if ( possibleWidth >= 100 ) {
                console.log( 'WIDTH OVERFLOWED' );

                var overflow = 100 - possibleWidth;

                model.width = possibleWidth - overflow;
                model.height = aspectRatioHeight( model.width );
            } else {
                console.log( 'NOT OVERFLOWED. width:', possibleWidth );
                model.width = possibleWidth;
                model.height = possibleHeight;
            }

        }

        function calculateCanvasDistance( event ) {

            return model.canvasDistance = {
                top: ( event.clientY - croppedArea[0].getBoundingClientRect().top ) / model.fullHeight * 100,
                left: ( event.clientX - croppedArea[0].getBoundingClientRect().left ) / model.fullWidth * 100
            }
        }

        function calculateDimensions( element, event ) {

            model.fullWidth = calculateFullWidth();
            model.fullHeight = calculateFullHeight();
        }

        function updateScope() {

            scope.boundX = parseInt( model.x * image[0].naturalWidth / 100 );
            scope.boundY = parseInt( model.y * image[0].naturalHeight / 100 );
            scope.boundWidth = parseInt( model.width * image[0].naturalWidth / 100 );
            scope.boundHeight = parseInt( model.height * image[0].naturalHeight / 100 );

            if ( ! scope.$root.$$phase ) {
                scope.$apply();
            }
        }

        function handleWidth() {
            return options.handleSize / model.fullWidth * 1000;
        }

        function handleHeight() {
            return options.handleSize / model.fullHeight * 1000;
        }

        function positionElements() {

            if ( ! model.fullWidth || ! model.fullHeight ) {
                throw new Error( 'positionElements: invalid model.fullWidth or model.fullHeight' );
            }

            console.log( 'positionElements. model:', model );

            boundCheck();
            updateScope();

            // Borders
            // -------

            var vertical = {
                'height': '2px',
                'width': model.width + '%'
            }

            var horizontal = {
                'height': model.height + '%',
                'width': '2px'
            };

            borders.top.css( vertical );
            borders.bottom.css( vertical);
            borders.left.css( horizontal );
            borders.right.css( horizontal );

            borders.top.css( {
                'left': model.x + '%',
                'top': model.y + '%'
            } );

            borders.left.css( {
                'left': model.x + '%',
                'top': model.y + '%'
            } );

            borders.right.css( {
                'left': ( model.x + model.width ) + '%',
                'top': model.y + '%'
            } );

            borders.bottom.css( {
                'left': model.x + '%',
                'top': ( model.y + model.height ) + '%'
            } );

            // Handle
            // ------

            handle.css( {
                'left': ( model.x + model.width - handleWidth()/2 ) + '%',
                'top': ( model.y + model.height - handleHeight()/2 ) + '%',
                'border-radius': '100%',
                'width': handleWidth() + '%',
                'height': handleHeight() + '%',
            } );

            // Shades
            // ------

            shades.left.css( {
                'top': 0 + '%',
                'left': 0 + '%',
                'width': model.x + '%',
                'height': '100%'
            } );

            shades.right.css( {
                'top': 0 + '%',
                'right': 0 + '%',
                'width': ( 100 - ( model.x + model.width ) ) + '%',
                'height': '100%'
            } );

            shades.top.css( {
                'top': 0 + '%',
                'left': model.x + '%',
                'width': model.width + '%',
                'height': model.y + '%'
            } );

            shades.bottom.css( {
                'bottom': 0 + '%',
                'left': model.x + '%',
                'width': model.width + '%',
                'height': ( 100 - ( model.y + model.height ) ) + '%'
            } );

            // Cropped area
            // ------------

            croppedArea.css( {
                'top': model.y + '%',
                'left': model.x + '%',
                'width': model.width + '%',
                'height': model.height + '%'
            } );
        }

        function calculateFullHeight() {
            return parseInt( container[0].clientHeight );
        }

        function calculateFullWidth() {
            return parseInt( container[0].clientWidth );
        }

        function parseNumber( possibleNumber, options ) {
            if ( typeof possibleNumber === 'undefined' && options && options.defaultValue ) {
                return options.defaultValue;
            }

            if ( typeof possibleNumber === 'string' ) {
                possibleNumber = possibleNumber.replace(/[a-zA-Z\s]+/g, '');
            }

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

        /**
         * When aspect ratio is 1, the pixel width and pixel height of the cropArea
         * should be equal. The height is the variable in this equation.
         * We have:
         *
         * pxWidth = aspectRatio * pxHeight
         *
         * and then we need to convert pxWidth to percentages.
         *
         * percentageWidth = pxWidth / model.fullWidth * 100
         *
         * which results is the equation:
         *
         * percentageWidth = ( aspectRatio * pxHeight ) / model.fullWidth * 100
         */
        function aspectRatioWidth( height ) {

            var pxHeight = height * model.fullHeight / 100;
            var pxWidth = scope.aspectRatio * pxHeight;
            var percentageWidth = pxWidth / model.fullWidth * 100;

            return percentageWidth;
        }

        function aspectRatioHeight( width ) {
            if ( width > 100 ) width = 100;

            var pxWidth = width * model.fullWidth / 100;

            var pxHeight = pxWidth / scope.aspectRatio;
            var percentageHeight = pxHeight / model.fullHeight * 100;

            return percentageHeight;
        }

        function croppedAreaAspectRatio() {
            return croppedArea[0].offsetWidth / croppedArea[0].offsetHeight;
        }

        // Currently ok
        function boundCheck() {

            // Negative/zero width
            if ( model.width < 0 ) {
                model.width = 0;
            }

            // Negative/zero height
            if ( model.height < 0 ) {
                model.height = 0;
            }

            // Higher than canvas (RAR)
            if ( model.height > 100 ) {
                model.height = ( 100 - model.y );

                if ( scope.aspectRatio ) {
                    model.width = aspectRatioWidth( croppedArea[0].offsetHeight / model.fullHeight * 100 );
                }
            }

            // below canvas
            if ( ( model.height + model.y ) > 100 ) {
                model.y = ( 100 - model.height );
            }

            // Wider than canvas
            if ( model.width > 100 ) {
                model.width = 100;

                if ( scope.aspectRatio ) {
                }
            }

            // Wider than canvas
            if ( model.width > 100 ) {
                model.x = ( 100 - model.width );
            }

            // To the right of canvas
            if ( ( model.x + model.width ) > 100 ) {
                model.x = ( 100 - model.width );
            }

            // To the left of canvas
            if ( model.x < 0 ) {
                model.x = 0;
            }

            // Above canvas
            if ( model.y < 0 ) {
                model.y = 0;
            }

        }
    }
} ).call( {} );
