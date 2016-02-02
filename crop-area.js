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
                boundX:         '=',
                boundY:         '=',
                boundWidth:     '=',
                boundHeight:    '=',
                handleSize:     '@', // integer | integer text: optional
                defaultWidth:   '@', // integer | integer text: if not set, a default value us used
                defaultHeight:  '@', // integer | integer text: if not set, a default value us used
                aspectRatio:    '=', // float | integer text: if not set, no aspect ratio is used
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

        // Model
        // -----

        var model = {
            fullHeight: calculateFullHeight(),  // px
            fullWidth:  calculateFullWidth(),   // px
            x:          options.defaultX,       // % of fullWidth
            y:          options.defaultY,       // % of fullHeight
            height:     options.defaultHeight,  // % of fullHeight
            width:      options.defaultWidth,   // % of fullWidth
        };

        if ( scope.aspectRatio ) {

            if ( options.defaultWidth ) {
                model.height = model.width / scope.aspectRatio;
            } else {
                model.width = model.height * scope.aspectRatio;
            }
        }

        // Initialization
        // --------------

        positionElements();
        handle[0].setAttribute( 'draggable', 'true' );
        croppedArea[0].setAttribute( 'draggable', 'true' );

        // Drag events: handle // DONE: ok

        handle.on( 'dragstart', function ( event ) {
            event.dataTransfer.setDragImage( emptyElement, 0, 0 );
        } );

        handle.on( 'drag touchmove', function ( event ) {

            if ( event.pageX ) {
                var pageX = event.pageX;
                var pageY = event.pageY;
            } else if ( event.touches ) {
                var pageX = event.touches[0].pageX;
                var pageY = event.touches[0].pageY;
            } else return;

            event.preventDefault();

            var relativeX = pageX - this.parentNode.offsetLeft + this.offsetWidth / 2;
            var relativeY = pageY - this.parentNode.offsetTop + this.offsetHeight / 2;

            if ( ! ( relativeX >= 0 && relativeY >= 0 ) ) {
                return;
            }

            model.height = relativeY/model.fullHeight*100 - model.y - options.handleSize/2;

            if ( scope.aspectRatio ) {
                model.width = model.height * scope.aspectRatio;
            }

            else {
                model.width = relativeX/model.fullWidth*100 - model.x - options.handleSize/2;
            }

            positionElements();

        } );

        // TODO: test
        angular.element( document ).on( 'resize', function ( event ) {
            positionElements();
        } );

        // Drag events: cropped area

        croppedArea.on( 'dragstart', function ( event ) {
            event.dataTransfer.setDragImage( emptyElement, 0, 0 );
        } );

        croppedArea.on( 'drag touchmove', function ( event ) {

            if ( event.pageX ) {
                var pageX = event.pageX;
                var pageY = event.pageY;
            } else {
                event.preventDefault();
                var pageX = event.touches[0].pageX;
                var pageY = event.touches[0].pageY;
            }

            var relativeX = pageX - this.parentNode.offsetLeft; //..
            var relativeY = pageY - this.parentNode.offsetTop; //..

            if ( ! ( relativeX >= 0 && relativeY >= 0 ) ) {
                return;
            }

            // current 1
            model.x = relativeX/model.fullWidth * 100 - model.width/2; //...
            model.y = relativeY/model.fullHeight * 100 - model.height/2; //...

            console.log( model.x, model.y );

            positionElements();
        } );

        scope.$watch( 'aspectRatio', function () {
            if ( scope.aspectRatio ) {
                model.width = model.height * scope.aspectRatio;
            }

            positionElements();
        } );

        // Implementation
        // --------------

        function updateScope() {
            scope.boundX = model.x;
            scope.boundY = model.y;
            scope.boundWidth = model.width;
            scope.boundHeight = model.height;

            if ( ! scope.$root.$$phase ) {
                scope.$apply();
            }
        }

        function positionElements() {

            boundCheck();
            updateScope();

            console.log( 'model @ positionElements', model );

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
                'left': ( model.x + model.width - options.handleSize/2 ) + '%',
                'top': ( model.y + model.height - options.handleSize/2 ) + '%',
                'border-radius': '100%',
                'width': options.handleSize + '%',
                'height': options.handleSize + '%',
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

        function boundCheck() {

            // Negative/zero width
            if ( model.width <= 0 ) {
                model.width = 1;
            }

            // Negative/zero height
            if ( model.height <= 0 ) {
                model.height = 1;
            }

            // Higher than canvas
            if ( model.height > 100 ) {
                model.height = ( 100 - model.y );

                if ( scope.aspectRatio ) {
                    model.width = model.height * scope.aspectRatio;
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
                    model.height = model.width / scope.aspectRatio; // Check height??? Loopy?
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
