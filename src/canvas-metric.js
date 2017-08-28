import {MetricsPanelCtrl} from  'app/plugins/sdk';
import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';

import appEvents from 'app/core/app_events';

var canvasID = 1;

// Expects a template with:
// <div class="canvas-spot"></div>
export class CanvasPanelCtrl extends MetricsPanelCtrl {

    constructor($scope, $injector, $q) {
        super($scope, $injector);

        this.q = $q;
        this.data = null;
        this.mouse = {
            position: null,
            down: null,
        };
        this.canvasID = canvasID++;
        this.$tooltip = $('<div id="tooltip.' + canvasID + '" class="graph-tooltip">');

        //this.events.on('panel-initialized', this.onPanelInitalized.bind(this));
        this.events.on('refresh', this.onRefresh.bind(this));
        //this.events.on('render', this.onRender.bind(this));
    }

    /*  onPanelInitalized() {
     //console.log("onPanelInitalized()");
     this.render();
     }*/

    onRefresh() {
        //console.log("onRefresh()");
        this.clear()
        //this.render();
    }

    // Typically you will override this
    /*onRender() {
     if( !(this.context) ) {
     console.log( 'No context!');
     return;
     }
     console.log( 'canvas render', this.mouse );

     var rect = this.wrap.getBoundingClientRect();


     var height = Math.max( this.height, 100 );
     var width = rect.width;
     this.canvas.width = width;
     this.canvas.height = height;

     var centerV = height / 2;

     var ctx = this.context;
     ctx.lineWidth = 1;
     ctx.textBaseline = 'middle';

     var time = "";
     if(this.mouse.position != null) {
     time = this.dashboard.formatDate( moment(this.mouse.position.ts) );
     }

     ctx.fillStyle = '#999999';
     ctx.fillRect(0, 0, width, height);
     ctx.fillStyle = "#111111";
     ctx.font = '24px "Open Sans", Helvetica, Arial, sans-serif';
     ctx.textAlign = 'left';
     ctx.fillText("Mouse @ "+time, 10, centerV);



     if(this.mouse.position != null ) {
     if(this.mouse.down != null) {
     var xmin = Math.min( this.mouse.position.x, this.mouse.down.x);
     var xmax = Math.max( this.mouse.position.x, this.mouse.down.x);

     // Fill canvas using 'destination-out' and alpha at 0.05
     ctx.globalCompositeOperation = 'destination-out';
     ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
     ctx.beginPath();
     ctx.fillRect(0, 0, xmin, height);
     ctx.fill();

     ctx.beginPath();
     ctx.fillRect(xmax, 0, width, height);
     ctx.fill();
     ctx.globalCompositeOperation = 'source-over';
     }
     else {
     ctx.strokeStyle = '#111';
     ctx.beginPath();
     ctx.moveTo(this.mouse.position.x, 0);
     ctx.lineTo(this.mouse.position.x, height);
     ctx.lineWidth = 3;
     ctx.stroke();

     ctx.beginPath();
     ctx.moveTo(this.mouse.position.x, 0);
     ctx.lineTo(this.mouse.position.x, height);
     ctx.strokeStyle = '#e22c14';
     ctx.lineWidth = 2;
     ctx.stroke();
     }
     }
     }*/

    clearTT() {
        this.$tooltip.detach();
    }

    normalizeTouchPosition(evt) {
        var position = evt;
        position.offsetX = evt.pageX;
        position.offsetY = evt.pageY;
        var parent = evt.target;
        while (parent.offsetParent) {
            position.offsetX -= parent.offsetLeft - parent.scrollLeft;
            position.offsetY -= parent.offsetTop - parent.scrollTop;
            parent = parent.offsetParent;
        }
        return position;
    }

    getMousePosition(evt) {
        var elapsed = this.range.to - this.range.from;
        var rect = this.canvas.getBoundingClientRect();
        var x = evt.offsetX; // - rect.left;
        var ts = this.range.from + (elapsed * (x / parseFloat(rect.right - rect.left)));
        var y = evt.clientY - rect.top;

        return {
            x: x,
            y: y,
            yRel: y / parseFloat(rect.height),
            ts: ts,
            evt: evt
        };
    }

    /*onGraphHover(evt, showTT, isExternal) {
     /!*console.log( "HOVER", evt, showTT, isExternal );*!/
     }*/

    onMouseClicked(where) {
        console.log("CANVAS CLICKED", where);
        this.render();
    }

    /*onMouseSelectedRange(range) {
     console.log( "CANVAS Range", range );
     }*/

    link(scope, elem, attrs, ctrl) {
        //console.log( 'panel-canvasMetric-link-elem', elem);
        var timeMouseDown = 0;
        this.wrap = elem.find('.canvas-spot')[0];
        this.canvas = document.createElement("canvas");
        this.wrap.appendChild(this.canvas);

        this.tableBody = elem.find('tbody')[0];

        //Фокусируемся на поле ввода
        $(this.tableBody).on('dblclick', '.table-field-comment', function(event){
            //console.log('JQUERY-dblclick', $(this));
            $(this).prop('disabled', false)
                /*.css('background', '#343232')*/
                .focus();
            $(this)[0].setSelectionRange($(this).prop('value').length, $(this).prop('value').length);
            scope.ctrl.panel.flagFocusInput = true;
        });

        //Завершение ввода по нажатию кнопки Enter (потеря фокуса)
        $(this.tableBody).on('keyup', '.table-field-comment', function (event) {
            if (event.keyCode == 13) {
                $(this).prop('disabled', true);
            }
        });

        //Отправка данных при потери фокуса поля ввода
        $(this.tableBody).on('blur', '.cel-emt.comment', function (event) {
            var dataSend = {};
            dataSend.user = scope.ctrl.dataWriteDB.user;
            dataSend.datapoint = {
                time: $(this).data('Time'),
                pointName: $(this).data('EventName'),
                commentText: $(this.children).prop('value'),
                fillColor: $(this).data('color'),
                pointNumber: $(this).data('pointNumber')
            };

            dataSend.target = $(this).data('Metric');
            dataSend.panelId = scope.ctrl.panel.id;
            $(this.children).prop('disabled', true);
            scope.ctrl.panel.flagFocusInput = false;
            if($(this.children).prop('value') == $(this).data('Comment')) return;
            scope.ctrl.writeToDB(dataSend);
            //console.log('JQUERY-blur', $(this).data('Comment'));
        });

        /*this.tableBody.addEventListener('dblclick', (evt) => {
            //console.log('dblclick-tBody', this);
            _.forEach(evt.path, function (tag, index) {
                if (tag.className == 'table-field-comment') {
                    tag.disabled = false;
                    tag.autofocus = true;
                    console.log('dblclick', evt.path);
                }
            })
        }, true);*/



        $(this.canvas).css('cursor', 'pointer');
        $(this.wrap).css('width', '100%');

        /*console.log( 'panel-canvasMetric-link', this );*/

        this.context = this.canvas.getContext('2d');

        this.canvas.addEventListener('mouseenter', (evt) => {
            /*console.log('mouseenter');*/
            if (this.mouse.down && !evt.buttons) {
                this.mouse.position = null;
                this.mouse.down = null;
                this.render();
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            }
            $(this.canvas).css('cursor', 'pointer');
        }, false);

        this.canvas.addEventListener('mouseout', (evt) => {
            /*console.log('mouseout');*/
            if (this.mouse.down == null) {
                this.mouse.position = null;
                this.render();
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            } else {
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            }
        }, false);

        this.canvas.addEventListener('mousemove', (evt) => {
            /* console.log('mousemove');*/
            this.mouse.position = this.getMousePosition(evt);
            var info = {
                pos: {
                    pageX: evt.pageX,
                    pageY: evt.pageY,
                    x: this.mouse.position.ts,
                    y: this.mouse.position.y,
                    panelRelY: this.mouse.position.yRel,
                    panelRelX: this.mouse.position.xRel
                },
                evt: evt,
                panel: this.panel
            };
            appEvents.emit('graph-hover', info);
            if (this.mouse.down != null) {
                $(this.canvas).css('cursor', 'col-resize');
            } else {
                $(this.canvas).css('cursor', 'pointer');
            }
        }, false);

        this.canvas.addEventListener('mousedown', (evt) => {
            /*console.log('mousedown');*/
            timeMouseDown = performance.now();
            this.mouse.down = this.getMousePosition(evt);
        }, false);

        this.canvas.addEventListener('mouseup', (evt) => {
            /*console.log('mouseup', evt);*/
            //console.log('touchend-mouse.position', this.mouse.position);
            /*this.$tooltip.detach();*/
            var up = this.getMousePosition(evt);
            if (this.mouse.down != null) {
                if (up.x == this.mouse.down.x && up.y == this.mouse.down.y) {
                    this.mouse.position = null;
                    this.mouse.down = null;
                    /*this.onMouseClicked(up);*/
                }
                else {
                    if (performance.now() - timeMouseDown > 200) {      // фильтрация на движение мыши
                        var min = Math.min(this.mouse.down.ts, up.ts);
                        var max = Math.max(this.mouse.down.ts, up.ts);
                        var range = {from: moment.utc(min), to: moment.utc(max)};
                        this.mouse.position = up;
                        this.onMouseSelectedRange(range);
                    }
                }
            }
            this.mouse.down = null;
            this.mouse.position = null;
        }, false);

        /*    this.canvas.addEventListener('click', (evt) => {
         console.log('click', evt);
         /!*this.onRender();
         this.$tooltip.detach();
         appEvents.emit('graph-hover-clear');*!/
         }, false);*/

        this.canvas.addEventListener('dblclick', (evt) => {
            /*console.log('dblclick');*/
            this.$tooltip.detach();
            var up = this.getMousePosition(evt);
            this.onMouseClicked(up);
            this.mouse.down = null;
            this.mouse.position = null;
        }, true);

        this.canvas.addEventListener('touchstart', (evt) => {
            event.preventDefault();
            event.stopPropagation();

            /*var touchEvt = this.normalizeTouchPosition(evt.changedTouches[0]);
            /!*console.log('touchStart', touchEvt);*!/
            appEvents.emit('graph-hover-clear');
            this.mouse.position = this.getMousePosition(touchEvt);
            var info = {
                pos: {
                    pageX: touchEvt.pageX,
                    pageY: touchEvt.pageY,
                    x: this.mouse.position.ts,
                    y: this.mouse.position.y,
                    panelRelY: this.mouse.position.yRel,
                    panelRelX: this.mouse.position.xRel
                },
                evt: touchEvt,
                panel: this.panel
            };*/
            /*appEvents.emit('graph-hover', info);*/
        }, false);

        /*this.canvas.addEventListener('touchmove', (evt) => {
         event.preventDefault();
         event.stopPropagation();

         var touchEvt = this.normalizeTouchPosition(evt.changedTouches[0]);
         console.log('touchMove', touchEvt);
         appEvents.emit('graph-hover-clear');
         this.mouse.position = this.getMousePosition(touchEvt);
         var info = {
         pos: {
         pageX: touchEvt.pageX,
         pageY: touchEvt.pageY,
         x: this.mouse.position.ts,
         y: this.mouse.position.y,
         panelRelY: this.mouse.position.yRel,
         panelRelX: this.mouse.position.xRel
         },
         evt: touchEvt,
         panel: this.panel
         };
         appEvents.emit('graph-hover', info);

         }, false);*/

        this.canvas.addEventListener('touchend', (evt) => {
            /*console.log('touchEnd');*/
            event.preventDefault();
            event.stopPropagation();

            /*this.onRender();
             this.$tooltip.detach();
             appEvents.emit('graph-hover-clear');*/
        }, false);



        // global events
        appEvents.on('graph-hover', (event) => {

            // ignore other graph hover events if shared tooltip is disabled
            var isThis = event.panel.id === this.panel.id;
            if (!this.dashboard.sharedTooltipModeEnabled() && !isThis) {
                return;
            }

            // ignore if other panels are fullscreen
            if (this.otherPanelInFullscreenMode()) {
                return;
            }

            // Calculate the mouse position when it came from somewhere else
            if (!isThis) {
                if (!event.pos.x) {
                    /*console.log( "Invalid hover point", event );*/
                    return;
                }

                var ts = event.pos.x;
                var rect = this.canvas.getBoundingClientRect();
                var elapsed = parseFloat(this.range.to - this.range.from);
                var x = ((ts - this.range.from) / elapsed) * rect.width;

                this.mouse.position = {
                    x: x,
                    y: event.pos.panelRelY * rect.height,
                    yRel: event.pos.panelRelY,
                    ts: ts,
                    gevt: event
                };
                //console.log( "Calculate mouseInfo", event, this.mouse.position);
            }

            this.onGraphHover(event, isThis || !this.dashboard.sharedCrosshairModeOnly(), !isThis);
        }, scope);

        appEvents.on('graph-hover-clear', (event, info) => {
            this.mouse.position = null;
            this.mouse.down = null;
            //this.render();
            this.$tooltip.detach();
        }, scope);

        // scope.$on('$destroy', () => {
        //   this.$tooltip.destroy();
        //   elem.off();
        //   elem.remove();
        // });
    }
}

