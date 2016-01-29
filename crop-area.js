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
                    
                    var relativeX = event.pageX - this.parentNode.offsetLeft + this.offsetWidth / 2;
                    var relativeY = event.pageY - this.parentNode.offsetTop + this.offsetHeight / 2;

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

                    var relativeX = event.pageX - this.parentNode.offsetLeft;
                    var relativeY = event.pageY - this.parentNode.offsetTop;

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
